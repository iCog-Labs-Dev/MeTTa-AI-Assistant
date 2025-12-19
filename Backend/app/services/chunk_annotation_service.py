import asyncio
import time
from typing import List, Optional
from app.core.logging import logger

from app.repositories.chunk_repository import ChunkRepository
from app.model.chunk import ChunkSchema, AnnotationStatus
from app.core.clients.llm_clients import LLMClient, LLMQuotaExceededError

# ------------------------------------------------------------------------------
# CONFIGURABLE CONSTANTS
# ------------------------------------------------------------------------------
MAX_RETRIES = 3
MAX_CONCURRENCY = 5
LLM_TIMEOUT = 45  # seconds for each annotation
RETRY_BACKOFF_BASE = 2  # exponential backoff base


# ------------------------------------------------------------------------------
# MAIN SERVICE
# ------------------------------------------------------------------------------
class ChunkAnnotationService:
    """Handles chunk retrieval, annotation generation, and database updates."""

    def __init__(self, repository: ChunkRepository, llm_provider: LLMClient):
        self.repository = repository
        self.llm_provider = llm_provider

    async def _generate_description(self, code_chunk: str) -> str:
        """Generate a concise description for a code chunk using LLM."""
        if not code_chunk or not code_chunk.strip():
            raise ValueError("Code chunk cannot be empty.")

        max_len = 8000
        if len(code_chunk) > max_len:
            code_chunk = code_chunk[:max_len] + "\n# --- TRUNCATED ---"

        prompt = (
            "You are an expert in MeTTa programming language. "
            "Generate a concise, human-readable summary description (under 20 words) "
            f"for the following MeTTa code chunk: \n\n{code_chunk}"
        )
        return await self.llm_provider.generate_text(prompt)

    # --------------------------------------------------------------------------
    # VALIDATION
    # --------------------------------------------------------------------------
    async def _validate_chunk_for_annotation(self, code: str) -> bool:
        if not code or not code.strip():
            return False
        if len(code) > 16000:  # soft upper bound to protect token limits
            logger.warning("Chunk skipped due to excessive size; len={}", len(code))
            return False
        return True

    # --------------------------------------------------------------------------
    # SINGLE CHUNK ANNOTATION
    # --------------------------------------------------------------------------
    async def annotate_single_chunk(self, chunk_id: str) -> Optional[ChunkSchema]:
        """Annotate one chunk and update its status."""
        chunk = await self.repository.get_chunk_for_annotation(chunk_id)
        if not chunk:
            logger.debug("Chunk not found: {}", chunk_id)
            return None

        if not await self._validate_chunk_for_annotation(chunk.chunk):
            await self.repository.update_chunk_annotation(
                chunk_id, description=None, status=AnnotationStatus.FAILED_GEN
            )
            logger.error("Chunk {} failed validation; skipping.", chunk_id)
            return None

        await self.repository.update_chunk_annotation(
            chunk_id, None, AnnotationStatus.PENDING
        )

        try:
            desc = await asyncio.wait_for(
                self._generate_description(chunk.chunk),
                timeout=LLM_TIMEOUT,
            )
            await self.repository.update_chunk_annotation(
                chunk_id, desc, AnnotationStatus.ANNOTATED
            )
            logger.info("Annotated chunk {}", chunk_id)
            return await self.repository.get_chunk_for_annotation(chunk_id)

        except asyncio.TimeoutError:
            await self.repository.update_chunk_annotation(
                chunk_id, None, AnnotationStatus.FAILED_GEN
            )
            logger.error("LLM timeout while annotating chunk {}", chunk_id)

        except LLMQuotaExceededError as e:
            await self.repository.update_chunk_annotation(
                chunk_id, None, AnnotationStatus.FAILED_QUOTA
            )
            logger.critical("LLM quota exceeded for chunk {}: {}", chunk_id, e)

        except Exception as e:
            await self.repository.update_chunk_annotation(
                chunk_id, None, AnnotationStatus.FAILED_GEN
            )
            await self.repository.increment_retry_count(chunk_id)
            logger.error(
                "Error annotating chunk {}: {}: {}", chunk_id, type(e).__name__, e
            )

        return None

    # --------------------------------------------------------------------------
    # BATCH ANNOTATION
    # --------------------------------------------------------------------------
    async def batch_annotate_unannotated_chunks(
        self, limit: Optional[int] = None
    ) -> List[str]:
        """
        Annotate a batch of unannotated chunks concurrently.
        Continues on per-chunk errors and collects statistics.
        """
        chunks = await self.repository.get_unannotated_chunks(limit=limit)
        if not chunks:
            logger.info("No unannotated chunks found.")
            return []

        sem = asyncio.Semaphore(MAX_CONCURRENCY)
        processed, quota_failed, failed = [], 0, 0

        start_time = time.perf_counter()

        async def process_chunk(chunk) -> Optional[str]:
            """Annotate a single chunk with retry, timeout, and error handling."""
            chunk_id = chunk.chunkId
            async with sem:
                if not await self._validate_chunk_for_annotation(chunk.chunk):
                    await self.repository.update_chunk_annotation(
                        chunk_id, None, AnnotationStatus.FAILED_GEN
                    )
                    return None

                await self.repository.update_chunk_annotation(
                    chunk_id, None, AnnotationStatus.PENDING
                )

                for attempt in range(MAX_RETRIES):
                    try:
                        desc = await asyncio.wait_for(
                            self._generate_description(chunk.chunk),
                            timeout=LLM_TIMEOUT,
                        )
                        await self.repository.update_chunk_annotation(
                            chunk_id, desc, AnnotationStatus.ANNOTATED
                        )
                        logger.info(
                            "Annotated chunk {} (attempt {})", chunk_id, attempt + 1
                        )
                        return chunk_id

                    except LLMQuotaExceededError:
                        await self.repository.update_chunk_annotation(
                            chunk_id, None, AnnotationStatus.FAILED_QUOTA
                        )
                        logger.critical(
                            "Quota exceeded for chunk {} on attempt {}",
                            chunk_id,
                            attempt + 1,
                        )
                        return "QUOTA_FAIL"

                    except asyncio.TimeoutError:
                        logger.warning(
                            "Timeout for chunk {} (attempt {})", chunk_id, attempt + 1
                        )

                    except Exception as e:
                        logger.error(
                            "Failed chunk {} (attempt {}): {}: {}",
                            chunk_id,
                            attempt + 1,
                            type(e).__name__,
                            e,
                        )

                    # Exponential backoff before retry
                    if attempt < MAX_RETRIES - 1:
                        await asyncio.sleep(RETRY_BACKOFF_BASE**attempt)

                await self.repository.increment_retry_count(chunk_id)
                await self.repository.update_chunk_annotation(
                    chunk_id, None, AnnotationStatus.FAILED_GEN
                )
                return None

        # ----------------------------------------------------------------------
        # Execute concurrent tasks
        # ----------------------------------------------------------------------
        tasks = [process_chunk(chunk) for chunk in chunks]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # ----------------------------------------------------------------------
        # Post-process results
        # ----------------------------------------------------------------------
        for chunk, result in zip(chunks, results):
            if isinstance(result, Exception):
                logger.error("Unexpected error in chunk {}: {}", chunk.chunkId, result)
                failed += 1
                continue

            if result == "QUOTA_FAIL":
                quota_failed += 1
            elif result:
                processed.append(result)
            else:
                failed += 1

        duration = time.perf_counter() - start_time
        logger.info(
            "Batch summary → Total: {}, Success: {}, Quota: {}, Failed: {}, Duration: {:.2f}s",
            len(chunks),
            len(processed),
            quota_failed,
            failed,
            duration,
        )

        return processed

    # --------------------------------------------------------------------------
    # RETRY FAILED CHUNKS
    # --------------------------------------------------------------------------
    async def retry_failed_chunks(
        self, limit: int = 100, include_quota: bool = False
    ) -> List[str]:
        """
        Retry previously failed chunks (with retry_count < MAX_RETRIES).
        """
        failed_chunks = await self.repository.get_failed_chunks(
            limit=limit, include_quota=include_quota
        )
        if not failed_chunks:
            logger.info("No failed chunks to retry.")
            return []

        processed = []

        for chunk in failed_chunks:
            chunk_id = chunk.chunkId
            retry_count = getattr(chunk, "retry_count", 0)

            if retry_count >= MAX_RETRIES:
                logger.warning("Chunk {} reached max retries; skipping.", chunk_id)
                continue

            try:
                res = await self.annotate_single_chunk(chunk_id)
                if res:
                    processed.append(chunk_id)
            except LLMQuotaExceededError:
                logger.critical(
                    "Quota still exceeded on retry for {}; aborting further retries.",
                    chunk_id,
                )
                break
            except Exception as e:
                logger.error(
                    "Error retrying chunk {}: {}: {}", chunk_id, type(e).__name__, e
                )
                continue

        logger.info(
            "Retried {} failed chunks; {} succeeded.",
            len(failed_chunks),
            len(processed),
        )
        return processed
