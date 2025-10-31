from __future__ import annotations
import os
from typing import List, Optional
from enum import Enum
from abc import ABC, abstractmethod
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from app.core.utils.retry import async_retry, RetryConfig


class LLMProvider(str, Enum):
    OPENAI = "openai"
    GEMINI = "gemini"

class LLMClient(ABC):
    @abstractmethod
    async def generate_text(self, prompt: str, **kwargs) -> str:
        pass
    @abstractmethod
    def get_provider(self) -> LLMProvider:
        pass
    @abstractmethod
    def get_model_name(self) -> str:
        pass

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

class GeminiClient(LLMClient):
    def __init__(
        self,
        model_name: str = "gemini-2.5-flash",
        api_keys: Optional[List[str]] = None,
        retry_cfg: Optional[RetryConfig] = None,
    ) -> None:
        self._model_name = model_name
        self._retry_cfg = retry_cfg or RetryConfig()
        keys = api_keys or _load_gemini_keys_from_env()
        if not keys:
            raise ValueError("No Gemini API keys provided")
        self._keys = keys
        self._idx = 0
    def get_provider(self) -> LLMProvider:
        return LLMProvider.GEMINI
    def get_model_name(self) -> str:
        return f"gemini:{self._model_name}"
    def _next_key(self) -> str:
        key = self._keys[self._idx % len(self._keys)]
        self._idx += 1
        return key
    async def _call_generate(self, prompt: str, **kwargs):
        current_key = self._next_key()
        client = ChatGoogleGenerativeAI(
            model=self._model_name,
            google_api_key=current_key,
            temperature=kwargs.get("temperature", 0.7),
            max_output_tokens=kwargs.get("max_tokens", 1000)
        )
        response = await client.ainvoke(prompt)
        return response
    @async_retry(retry_on=_is_rate_limit)
    async def generate_text(self, prompt: str, *, temperature: float = 0.7, max_tokens: int = 1000, **kwargs) -> str:
        resp = await self._call_generate(prompt, temperature=temperature, max_tokens=max_tokens, **kwargs)
        return resp.content.strip()

class OpenAIClient(LLMClient):
    def __init__(
        self,
        model_name: str = "gpt-3.5-turbo",
        api_keys: Optional[List[str]] = None,
        retry_cfg: Optional[RetryConfig] = None,
    ) -> None:
        self._model_name = model_name
        self._retry_cfg = retry_cfg or RetryConfig()
        keys = api_keys or _load_openai_keys_from_env()
        if not keys:
            raise ValueError("No OpenAI API keys provided")
        self._keys = keys
        self._idx = 0
    def get_provider(self) -> LLMProvider:
        return LLMProvider.OPENAI
    def get_model_name(self) -> str:
        return f"openai:{self._model_name}"
    def _next_key(self) -> str:
        key = self._keys[self._idx % len(self._keys)]
        self._idx += 1
        return key
    async def _call_generate(self, prompt: str, **kwargs):
        current_key = self._next_key()
        client = ChatOpenAI(
            model=self._model_name,
            api_key=current_key,
            temperature=kwargs.get("temperature", 0.7),
            max_tokens=kwargs.get("max_tokens", 1000)
        )
        response = await client.ainvoke(prompt)
        return response

    @async_retry(retry_on=_is_rate_limit)
    async def generate_text(
        self, prompt: str, *, temperature: float = 0.7, max_tokens: int = 1000, **kwargs
    ) -> str:
        resp = await self._call_generate(
            prompt, temperature=temperature, max_tokens=max_tokens, **kwargs
        )
        return resp.content.strip()


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
