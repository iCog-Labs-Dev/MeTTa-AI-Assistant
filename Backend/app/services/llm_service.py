import asyncio
import random
from abc import ABC, abstractmethod
from typing import List

from loguru import logger
from starlette.concurrency import run_in_threadpool

from google import genai
from google.genai.errors import APIError


class LLMQuotaExceededError(Exception):
    """Raised when the LLM service returns a quota/rate limit error."""
    pass


class BaseLLMProvider(ABC):
    @abstractmethod
    async def generate_description(self, code_chunk: str, **kwargs) -> str:
        raise NotImplementedError

    @abstractmethod
    async def generate_descriptions_batch(self, code_chunks: List[str], **kwargs) -> List[str]:
        raise NotImplementedError


class GeminiLLMProvider(BaseLLMProvider):
    def __init__(self, api_key: str, model_name: str = "gemini-2.0-flash"):
        self.client = genai.Client(api_key=api_key)
        self.model_name = model_name

    async def _safe_api_call(self, prompt: str, *, retries: int = 3, base_delay: float = 1.0) -> str:
        """
        Wraps the gemini client call with retries + exponential backoff + jitter.
        Raises LLMQuotaExceededError for quota/rate issues.
        """
        last_exc = None
        for attempt in range(1, retries + 1):
            try:
                response = await run_in_threadpool(
                    self.client.models.generate_content,
                    model=self.model_name,
                    contents=prompt
                )

                text = getattr(response, "text", None)
                if not text or not text.strip():
                    raise APIError("LLM returned an empty response.")

                return text.strip()

            except APIError as e:
                error_message = str(e).lower()
                if 'resource exhausted' in error_message or 'quota' in error_message or 'rate limit' in error_message:
                    logger.warning("LLM quota/rate limit detected on attempt {}: {}", attempt, e)
                    # quota/rate-limit => treat specially
                    raise LLMQuotaExceededError(e)
                last_exc = e
                logger.warning("APIError on attempt {}: {}", attempt, e)

            except Exception as e:
                # keep last exception to re-raise after retries
                last_exc = e
                logger.warning("Exception on LLM call attempt {}: {}", attempt, e)

            # if not last attempt, sleep with exponential backoff + jitter
            if attempt < retries:
                backoff = base_delay * (2 ** (attempt - 1))
                # jitter reduces thundering herd
                jitter = random.uniform(0, backoff * 0.1)
                sleep_for = backoff + jitter
                logger.debug("Sleeping {}s before next LLM attempt", sleep_for)
                await asyncio.sleep(sleep_for)

        # all retries exhausted
        logger.error("LLM call failed after {} attempts: {}", retries, last_exc)
        raise last_exc

    async def generate_description(self, code_chunk: str) -> str:
        if not code_chunk or not code_chunk.strip():
            raise ValueError("Code chunk cannot be empty.")

        # optional truncation threshold
        max_len = 8000
        if len(code_chunk) > max_len:
            code_chunk = code_chunk[:max_len] + "\n# --- TRUNCATED ---"

        prompt = (
            "You are an expert in MeTTa programming language. "
            "Generate a concise, human-readable summary description (under 20 words) "
            f"for the following MeTTa code chunk: \n\n{code_chunk}"
        )
        return await self._safe_api_call(prompt)

    async def generate_descriptions_batch(self, code_chunks: List[str]) -> List[str]:
        # Implemented as sequential calls to maintain per-chunk granularity & backoff behavior.
        results = []
        for chunk in code_chunks:
            try:
                res = await self.generate_description(chunk)
                results.append(res)
            except LLMQuotaExceededError as e:
                # propagate quota to caller so it can decide to pause entire job
                raise e
            except Exception as e:
                logger.warning("Failed to generate description for a chunk: {}", e)
                results.append("Annotation failed due to internal LLM error.")

        return results
