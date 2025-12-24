from __future__ import annotations
from typing import Dict, Any, Optional, List
from app.core.clients.llm_clients import (
    LLMClient,
    LLMProvider,
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
        if provider not in (LLMProvider.GEMINI, LLMProvider.OPENAI):
            raise ValueError(f"Unsupported provider: {provider}")

        if not model_name:
            model_name = (
                "gemini-2.5-flash" if provider == LLMProvider.GEMINI else "gpt-4.1-mini"
            )

        return LLMClient(
            provider=provider,
            model_name=model_name,
            api_keys=api_keys,
            retry_cfg=retry_cfg,
            **kwargs,
        )

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
    def build_rag_prompt(
        query: str, context: str, history: Optional[List[Dict[str, str]]] = None
    ) -> str:
        history_block = ""
        if history:
            lines = ["Conversation History:"]
            for m in history:
                role = m.get("role", "user").capitalize()
                content = m.get("content", "").strip()
                lines.append(f"{role}: {content}")
            history_block = "\n" + "\n".join(lines) + "\n"
        return f"""You are Metta AI Assistant, an intelligent assistant designed to accelerate the development and adoption of the MeTTa programming language—central to the Hyperon framework for AGI. Your primary role is to help developers write, understand, and translate MeTTa code using your knowledge base. 

Context: {context}
History: {history_block}
User Question: {query}

Instructions:

* Give clear, direct, concise answers. Avoid unnecessary explanations or long narratives if not asked explictly.
* Do NOT include meta-phrases such as “based on the context…”, “as an AI assistant…”, or any self-referential commentary.
* Focus strictly on:

  * MeTTa syntax, semantics, and best practices
  * Hyperon concepts and usage
  * Code examples, patterns, and translations when relevant
* Include every non-built-in helper function needed for the implementation, using any previously provided functions from the context or chat history.    
* Keep answers medium length. If the user wants more details, they will ask.
* You may answer greetings, farewells, small talk, and simple conversational questions.
* Only provide answers that are directly supported by Context or History. Do NOT invent or assume information.
* If the question is unrelated to MeTTa, Hyperon, or AGI, politely say you can only answer MeTTa/Hyperon questions.
* If Context is empty and the question is not covered in History, you may reply like I couldn’t find anything related to that in the knowledge base. Could you clarify what exactly you want?"""
