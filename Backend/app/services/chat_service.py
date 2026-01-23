"""
Chat Service - Handles all business logic for chat operations.

This service orchestrates:
- API key decryption and validation
- RAG pipeline (retrieval and generation)
- Message persistence
- Chat history management
- RAG interaction logging
"""
import os
import time
from typing import Optional, Dict, Any, List, Literal
from datetime import datetime, timedelta, timezone
from bson import ObjectId
from pymongo.database import Database
from sentence_transformers import SentenceTransformer
from qdrant_client import AsyncQdrantClient

from app.core.logging import logger
from app.core.clients.llm_clients import LLMClient, LLMProvider
from app.services.key_management_service import KMS
from app.rag.retriever.retriever import EmbeddingRetriever
from app.rag.generator.rag_generator import RAGGenerator
from app.db.chat_db import insert_chat_message, get_last_messages, create_chat_session
from app.rag.rag_logging import log_rag_interaction


class ChatService:
    """Service for handling chat operations with RAG system."""

    def __init__(
        self,
        mongo_db: Database,
        embedding_model: SentenceTransformer,
        qdrant_client: AsyncQdrantClient,
        default_llm_client: LLMClient,
        kms: KMS,
    ):
        self.mongo_db = mongo_db
        self.embedding_model = embedding_model
        self.qdrant_client = qdrant_client
        self.default_llm_client = default_llm_client
        self.kms = kms
        self.collection_name = os.getenv("COLLECTION_NAME")
        
        if not self.collection_name:
            raise ValueError("COLLECTION_NAME environment variable not set")

    async def decrypt_api_key(
        self,
        encrypted_key: Optional[str],
        user_id: str,
        provider: str,
    ) -> str:
        """
        Decrypt and validate API key from cookie.
        
        Returns:
            Decrypted API key or empty string if invalid/missing
        """
        if not encrypted_key or not encrypted_key.strip():
            return ""
        
        try:
            api_key = await self.kms.decrypt_api_key(
                encrypted_key, user_id, provider.lower(), self.mongo_db
            )
            
            if not api_key or not api_key.strip():
                logger.warning(
                    f"Decrypted API key is empty for user {user_id}, provider {provider}"
                )
                return ""
            
            return api_key
            
        except Exception as e:
            logger.warning(
                f"Failed to decrypt API key cookie for user {user_id}, "
                f"provider {provider}: {e}"
            )
            return ""

    async def get_or_create_session(
        self,
        session_id: Optional[str],
        user_id: str,
    ) -> tuple[str, bool]:
        """
        Get existing session or create a new one.
        
        Returns:
            Tuple of (session_id, created_new_session)
        """
        if session_id:
            return session_id, False
        
        new_session_id = await create_chat_session(user_id, mongo_db=self.mongo_db)
        return new_session_id, True

    async def get_chat_history(
        self,
        session_id: str,
        limit: int = 10,
    ) -> List[Dict[str, str]]:
        """
        Retrieve chat history for a session.
        
        Returns:
            List of message dicts with 'role' and 'content' keys
        """
        raw_history = await get_last_messages(
            session_id=session_id,
            limit=limit + 1,  # Get one extra to exclude current message
            mongo_db=self.mongo_db,
        )
        
        # Exclude the last message (current query)
        raw_history = raw_history[:-1] if raw_history else []
        
        return [
            {"role": m.get("role"), "content": m.get("content", "")}
            for m in raw_history
        ]

    async def perform_search(
        self,
        query: str,
        top_k: int = 5,
    ) -> Dict[str, Any]:
        """
        Perform semantic search without generation.
        
        Returns:
            Dict with query, mode, and results
        """
        retriever = EmbeddingRetriever(
            model=self.embedding_model,
            qdrant=self.qdrant_client,
            collection_name=self.collection_name,
        )
        
        results = await retriever.retrieve(query, top_k=top_k)
        
        return {
            "query": query,
            "mode": "search",
            "results": results,
        }

    async def generate_response(
        self,
        query: str,
        session_id: str,
        user_id: str,
        provider: Literal["openai", "gemini"],
        model: Optional[str] = None,
        api_key: Optional[str] = None,
        top_k: int = 5,
    ) -> Dict[str, Any]:
        """
        Generate a response using RAG pipeline.
        
        Args:
            query: User's question
            session_id: Chat session ID
            user_id: User ID for logging
            provider: LLM provider (openai or gemini)
            model: Optional specific model name
            api_key: Optional user's API key
            top_k: Number of chunks to retrieve
            
        Returns:
            Dict with response, session_id, message IDs, and response ID
        """
        start_time = time.time()
        
        # Create retriever
        retriever = EmbeddingRetriever(
            model=self.embedding_model,
            qdrant=self.qdrant_client,
            collection_name=self.collection_name,
        )
        
        # Create generator
        if provider.lower() == "gemini" and not model:
            generator = RAGGenerator(
                retriever=retriever,
                llm_client=self.default_llm_client,
            )
        else:
            provider_enum = LLMProvider(provider.lower())
            generator = RAGGenerator(
                retriever=retriever,
                provider=provider_enum,
                model_name=model,
            )
        
        # Save user message
        user_message_id = await insert_chat_message(
            {
                "sessionId": session_id,
                "role": "user",
                "content": query,
            },
            mongo_db=self.mongo_db,
        )
        
        # Get chat history
        history = await self.get_chat_history(session_id, limit=10)
        
        # Generate response
        result = await generator.generate_response(
            query,
            top_k=top_k,
            api_key=api_key,
            include_sources=True,
            history=history,
        )
        
        # Generate response ID
        response_id = f"resp_{ObjectId()}"
        
        # Save assistant message
        message_id = await insert_chat_message(
            {
                "sessionId": session_id,
                "role": "assistant",
                "content": result.get("response", ""),
                "responseId": response_id,
            },
            mongo_db=self.mongo_db,
        )
        
        # Log RAG interaction
        await self._log_interaction(
            query=query,
            response=result.get("response", ""),
            sources=result.get("sources", []),
            session_id=session_id,
            provider=provider,
            model=model,
            response_id=response_id,
            execution_time=time.time() - start_time,
        )
        
        # Prepare response
        result.pop("sources", None)
        result["session_id"] = session_id
        result["userMessageId"] = user_message_id
        result["messageId"] = message_id
        result["responseId"] = response_id
        
        return result

    async def _log_interaction(
        self,
        query: str,
        response: str,
        sources: List[Dict[str, Any]],
        session_id: str,
        provider: str,
        model: Optional[str],
        response_id: str,
        execution_time: float,
    ) -> None:
        """Log RAG interaction for analytics."""
        try:
            contexts = [str(s.get("text", "")) for s in (sources or [])]
            
            await log_rag_interaction(
                {
                    "question": query,
                    "answer": response,
                    "contexts": contexts,
                    "metadata": {
                        "session_id": session_id,
                        "provider": provider,
                        "model": model if model else "system",
                        "response_id": response_id,
                        "execution_time_seconds": execution_time,
                    },
                },
                mongo_db=self.mongo_db,
            )
        except Exception:
            logger.warning("Failed to log RAG interaction", exc_info=True)

    async def process_chat_request(
        self,
        query: str,
        user_id: str,
        provider: Literal["openai", "gemini"],
        mode: Literal["search", "generate"] = "generate",
        model: Optional[str] = None,
        session_id: Optional[str] = None,
        encrypted_api_key: Optional[str] = None,
        top_k: int = 5,
    ) -> Dict[str, Any]:
        """
        Main entry point for processing chat requests.
        
        This orchestrates the entire chat flow:
        1. Decrypt API key if provided
        2. Get or create session
        3. Either perform search or generate response
        
        Args:
            query: User's question
            user_id: User ID
            provider: LLM provider
            mode: 'search' or 'generate'
            model: Optional model name
            session_id: Optional existing session ID
            encrypted_api_key: Optional encrypted API key from cookie
            top_k: Number of chunks to retrieve
            
        Returns:
            Dict with response data
        """
        # Decrypt API key if provided
        api_key = await self.decrypt_api_key(
            encrypted_api_key, user_id, provider
        )
        
        # Get or create session
        session_id, _ = await self.get_or_create_session(session_id, user_id)
        
        # Handle search mode
        if mode == "search":
            return await self.perform_search(query, top_k)
        
        # Handle generate mode
        return await self.generate_response(
            query=query,
            session_id=session_id,
            user_id=user_id,
            provider=provider,
            model=model,
            api_key=api_key if api_key else None,
            top_k=top_k,
        )
