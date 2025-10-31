from __future__ import annotations
from typing import Dict, Any, Optional, List
from app.core.clients.llm_clients import (
    LLMClient,
    LLMProvider,
    GeminiClient,
    OpenAIClient,
)
from app.core.utils.retry import RetryConfig


class LLMClientFactory:
    @staticmethod
    def create_client(
        provider: LLMProvider,
        model_name: Optional[str] = None,
        api_keys: Optional[List[str]] = None,
        retry_cfg: Optional[RetryConfig] = None,
        **kwargs,
    ) -> LLMClient:
        if provider == LLMProvider.GEMINI:
            return GeminiClient(
                model_name=model_name or "gemini-2.5-flash",
                api_keys=api_keys,
                retry_cfg=retry_cfg,
                **kwargs,
            )
        elif provider == LLMProvider.OPENAI:
            return OpenAIClient(
                model_name=model_name or "gpt-3.5-turbo",
                api_keys=api_keys,
                retry_cfg=retry_cfg,
                **kwargs,
            )
        else:
            raise ValueError(f"Unsupported provider: {provider}")

    @staticmethod
    def create_default_client() -> LLMClient:
        return LLMClientFactory.create_client(LLMProvider.GEMINI)


class LLMResponseFormatter:
    @staticmethod
    def format_rag_response(
        query: str,
        response: str,
        client: LLMClient,
        sources: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        return {
            "query": query,
            "response": response,
            "model": client.get_model_name(),
            "provider": client.get_provider().value,
            "sources": sources or [],
        }

    @staticmethod
    def build_rag_prompt(query: str, context: str) -> str:
        return f"""You are Metta AI Assistant, an intelligent assistant designed to accelerate the development and adoption of the MeTTa programming language—central to the Hyperon framework for AGI. Your primary role is to help developers write, understand, and translate MeTTa code using your knowledge base.

Based on the following context from the MeTTa knowledge base, provide a comprehensive and accurate answer to the user's question about MeTTa programming, Hyperon framework, or related AGI concepts.

Context:
{context}

User Question: {query}

Please provide a clear, well-structured response that helps the user with their MeTTa development needs. Focus on:
- MeTTa syntax, semantics, and best practices
- Hyperon framework concepts and usage
- Code examples and translations when relevant

If the context doesn't contain enough information to answer the question completely, please say so and suggest what additional MeTTa or Hyperon documentation might be helpful. Be precise, educational, and focused on advancing MeTTa development."""
