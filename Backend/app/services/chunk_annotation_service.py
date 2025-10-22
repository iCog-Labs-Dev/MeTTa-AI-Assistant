import asyncio
from typing import List, Optional
from loguru import logger
from app.repositories.chunk_repository import ChunkRepository
from app.services.llm_service import BaseLLMProvider, LLMQuotaExceededError
from app.model.chunk import Chunk, AnnotationStatus 

MAX_RETRIES = 3  
class ChunkAnnotationService:
    """Orchestrates chunk retrieval, LLM annotation, and DB update."""

    def __init__(self, repository: ChunkRepository, llm_provider: BaseLLMProvider):
        self.repository = repository
        self.llm_provider = llm_provider

    async def annotate_single_chunk(self, chunk_id: str) -> Optional[Chunk]:
        """Robust pipeline for a single chunk."""
        chunk = await self.repository.get_chunk_for_annotation(chunk_id)
        if not chunk:
            logger.debug("annotate_single_chunk: chunk not found: {}", chunk_id)
            return None

        await self.repository.update_chunk_annotation(chunk_id, description=None, status=AnnotationStatus.PENDING)

        try:
            description = await self.llm_provider.generate_description(chunk.chunk)

            await self.repository.update_chunk_annotation(
                chunk_id=chunk_id,
                description=description,
                status=AnnotationStatus.ANNOTATED,
            )
            logger.info("Chunk {} annotated successfully.", chunk_id)
            return await self.repository.get_chunk_for_annotation(chunk_id)

        except LLMQuotaExceededError as e:
            await self.repository.update_chunk_annotation(chunk_id, description=None, status=AnnotationStatus.FAILED_QUOTA)
            logger.critical("LLM Quota Exceeded for chunk {}: {}", chunk_id, e)
            raise

        except Exception as e:
            await self.repository.update_chunk_annotation(chunk_id, description=None, status=AnnotationStatus.FAILED_GEN)
            logger.error("Error annotating chunk {}: {}: {}", chunk_id, type(e).__name__, e)
            
            await self.repository.increment_retry_count(chunk_id)
            return None

    async def batch_annotate_unannotated_chunks(self, limit: int = 100) -> List[str]:
        chunks = await self.repository.get_unannotated_chunks(limit=limit)
        if not chunks:
            logger.info("No unannotated chunks found.")
            return []

        processed_ids: List[str] = []

        for chunk in chunks:
            chunk_id = chunk.chunkId
            try:
                await self.repository.update_chunk_annotation(chunk_id, description=None, status=AnnotationStatus.PENDING)

                desc = await self.llm_provider.generate_description(chunk.chunk)

                if isinstance(desc, str) and desc.startswith("Annotation failed"):
                    await self.repository.update_chunk_annotation(chunk_id, description=None, status=AnnotationStatus.FAILED_GEN)
                    
                    await self.repository.increment_retry_count(chunk_id)
                    logger.warning("LLM returned failure placeholder for chunk {}", chunk_id)
                else:
                    await self.repository.update_chunk_annotation(chunk_id, description=desc, status=AnnotationStatus.ANNOTATED)
                    logger.info("Annotated chunk {}", chunk_id)
                    processed_ids.append(chunk_id)

            except LLMQuotaExceededError as e:
                await self.repository.update_chunk_annotation(chunk_id, description=None, status=AnnotationStatus.FAILED_QUOTA)
                logger.critical("Quota exceeded while annotating chunk {}: {}", chunk_id, e)
                break

            except Exception as e:
                await self.repository.update_chunk_annotation(chunk_id, description=None, status=AnnotationStatus.FAILED_GEN)
                
                await self.repository.increment_retry_count(chunk_id)
                
                logger.error("Failed to annotate chunk {}: {}: {}", chunk_id, type(e).__name__, e)
                continue

        return processed_ids

    async def retry_failed_chunks(self, limit: int = 100, include_quota: bool = False) -> List[str]:
        """
        Retry chunks that previously failed. Only retries chunks with retry_count < MAX_RETRIES.
        """
        failed_chunks = await self.repository.get_failed_chunks(limit=limit, include_quota=include_quota)
        if not failed_chunks:
            logger.info("No failed chunks to retry.")
            return []

        processed = []

        for chunk in failed_chunks:
            chunk_id = chunk.chunkId
            
            retry_count = chunk.retry_count
            

            if retry_count >= MAX_RETRIES:
                logger.warning("Chunk {} reached max retry count; skipping.", chunk_id)
                continue

            try:
                res = await self.annotate_single_chunk(chunk_id)
                if res:
                    processed.append(chunk_id)
            except LLMQuotaExceededError:
                logger.critical("Quota still exceeded when retrying chunk {}; aborting.", chunk_id)
                break
            except Exception as e:
                logger.error("Error retrying chunk {}: {}: {}", chunk_id, type(e).__name__, e)
                continue

        return processed
