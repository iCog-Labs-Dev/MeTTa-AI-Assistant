from __future__ import annotations
import os
from typing import List, Optional
from enum import Enum
from abc import ABC, abstractmethod
from langchain.chat_models import init_chat_model
from app.core.utils.retry import async_retry, RetryConfig

class LLMQuotaExceededError(Exception):
    """Raised when the LLM service returns a quota/rate limit error."""
    pass


class LLMProvider(str, Enum):
    OPENAI = "openai"
    GEMINI = "gemini"


def _is_rate_limit(err: Exception) -> bool:
    msg = str(err).lower()
    return (
        "429" in msg
        or "rate" in msg
        or "quota" in msg
        or "resourceexhausted" in msg
        or "exceeded" in msg
        or "insufficient_quota" in msg
    )

class BaseLLMClient(ABC):
    
    @abstractmethod
    async def generate_text(self, prompt: str, **kwargs) -> str:
        pass

    @abstractmethod
    def get_provider(self) -> LLMProvider:
        pass

    @abstractmethod
    def get_model_name(self) -> str:
        pass
    


class LLMClient(BaseLLMClient):

    def __init__(
        self,
        provider: LLMProvider,
        model_name: Optional[str] = None,
        api_keys: Optional[List[str]] = None,
        retry_cfg: Optional[RetryConfig] = None,
    ) -> None:
        self._provider = provider
        self._retry_cfg = retry_cfg or RetryConfig()
        self._idx = 0

        if provider == LLMProvider.GEMINI:
            self._model_name = model_name or "gemini-2.5-flash"
            self._keys = api_keys or _load_gemini_keys_from_env()
            if not self._keys:
                raise ValueError("No Gemini API keys provided")
        elif provider == LLMProvider.OPENAI:
            self._model_name = model_name or "gpt-4.1-mini"
            self._keys = api_keys or _load_openai_keys_from_env()
            if not self._keys:
                raise ValueError("No OpenAI API keys provided")
        else:
            raise ValueError(f"Unsupported provider: {provider}")

    def get_provider(self) -> LLMProvider:
        return self._provider

    def get_model_name(self) -> str:
        return f"{self._provider.value}:{self._model_name}"

    def _next_key(self) -> str:
        key = self._keys[self._idx % len(self._keys)]
        self._idx += 1
        return key

    async def _call_generate(self, prompt: str, api_key: Optional[str] = None, **kwargs):
        current_key = api_key or self._next_key()

        temperature = kwargs.get("temperature", 0.7)
        max_tokens = kwargs.get("max_tokens", 1000)

        if self._provider == LLMProvider.GEMINI:
            client = init_chat_model(
                model=self._model_name,
                model_provider="google_genai",
                google_api_key=current_key,
                temperature=temperature,
            )
        else:  # OpenAI
            client = init_chat_model(
                model=self._model_name,
                model_provider="openai",
                api_key=current_key,
                temperature=temperature,
            )

        response = await client.ainvoke(prompt)
        return response

    @async_retry(retry_on=_is_rate_limit)
    async def _generate_with_retry(self, prompt: str, api_key: Optional[str] = None, **kwargs):
        return await self._call_generate(prompt, api_key, **kwargs)

    async def generate_text(
        self, prompt: str, api_key: Optional[str] = None, *, temperature: float = 0.7, max_tokens: int = 1000, **kwargs
    ) -> str:
        try:
            resp = await self._generate_with_retry(
                prompt, api_key=api_key, temperature=temperature, max_tokens=max_tokens, **kwargs
            )
            content = getattr(resp, "content", None)
            return content if content is not None else "[No content generated]"
        except Exception as e:
            if _is_rate_limit(e):
                raise LLMQuotaExceededError(f"Rate limit/quota exceeded: {e}") from e
            raise


def _load_gemini_keys_from_env() -> List[str]:
    csv = os.getenv("GEMINI_API_KEYS", "").strip()
    keys = [k.strip() for k in csv.split(",") if k.strip()]
    if not keys:
        single = os.getenv("GEMINI_API_KEY")
        if single:
            keys = [single]
    return keys


def _load_openai_keys_from_env() -> List[str]:
    csv = os.getenv("OPENAI_API_KEYS", "").strip()
    keys = [k.strip() for k in csv.split(",") if k.strip()]
    if not keys:
        single = os.getenv("OPENAI_API_KEY")
        if single:
            keys = [single]
    return keys