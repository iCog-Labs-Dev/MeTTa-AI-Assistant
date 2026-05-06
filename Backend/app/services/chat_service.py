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
import json
import asyncio
from typing import Optional, Dict, Any, List, Literal
from datetime import datetime, timedelta, timezone
from bson import ObjectId
from pymongo.database import Database
from sentence_transformers import SentenceTransformer
from qdrant_client import AsyncQdrantClient

from app.db.learning_progress import get_user_progress, save_user_progress, UserProgressModel
from app.core.logging import logger
from app.core.clients.llm_clients import LLMClient, LLMProvider
from app.services.key_management_service import KMS
from app.rag.retriever.retriever import EmbeddingRetriever
from app.rag.generator.rag_generator import RAGGenerator
from app.db.chat_db import (
    insert_chat_message,
    get_last_messages,
    create_chat_session,
    update_chat_session_title,
)
from app.rag.rag_logging import log_rag_interaction


from fastapi import BackgroundTasks



class ChatService:
    # --- Curriculum and Progress Integration ---
    CURRICULUM_FILE = os.path.join(os.path.dirname(__file__), '../learning_curriculum.json')
    with open(CURRICULUM_FILE, encoding='utf-8') as f:
        curriculum_data = json.load(f)
    CURRICULUM: Dict[str, dict] = {}
    for level in curriculum_data.get('levels', []):
        for module in level.get('modules', []):
            CURRICULUM[module['id']] = {
                **module,
                'level_id': level['id'],
                'level_title': level['title']
            }

    @classmethod
    def get_curriculum(cls):
        return cls.curriculum_data

    @classmethod
    def get_module(cls, module_id):
        return cls.CURRICULUM.get(module_id)

    async def get_user_progress(self, user_id: str, chat_id: str) -> UserProgressModel:
        return await get_user_progress(user_id, chat_id, self.mongo_db)

    async def save_user_progress(self, progress: UserProgressModel):
        await save_user_progress(progress, self.mongo_db)

    async def complete_module(self, user_id: str, chat_id: str, module_id: str):
        progress = await self.get_user_progress(user_id, chat_id)
        if module_id not in progress.completed_modules:
            progress.completed_modules.append(module_id)
            await self.save_user_progress(progress)
        return progress

    async def self_claim_module(self, user_id: str, chat_id: str, module_id: str):
        progress = await self.get_user_progress(user_id, chat_id)
        if module_id not in progress.self_claimed_modules:
            progress.self_claimed_modules.append(module_id)
            await self.save_user_progress(progress)
        return progress

    def module_unlocked(self, progress: UserProgressModel, module: dict) -> bool:
        prereqs = module.get('prerequisites', [])
        return all(pr in progress.completed_modules or pr in progress.self_claimed_modules for pr in prereqs)

    def get_next_module(self, progress: UserProgressModel) -> dict:
        # Return the next unlocked module not yet completed
        for module_id, module in self.CURRICULUM.items():
            if module_id not in progress.completed_modules and self.module_unlocked(progress, module):
                return module
        return None
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
        isLearning: bool = False,
        moduleId: str = None,
    ) -> tuple[str, bool]:
        """
        Get existing session or create a new one.
        
        Returns:
            Tuple of (session_id, created_new_session)
        """
        if session_id:
            return session_id, False

        new_session_id = await create_chat_session(
            user_id,
            isLearning=isLearning,
            moduleId=moduleId,
            mongo_db=self.mongo_db
        )
        # No automatic welcome message insertion here
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
        background_tasks: BackgroundTasks,
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
            background_tasks: FastAPI BackgroundTasks
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
                mongo_db=self.mongo_db,
            )
        else:
            provider_enum = LLMProvider(provider.lower())
            generator = RAGGenerator(
                retriever=retriever,
                provider=provider_enum,
                model_name=model,
                mongo_db=self.mongo_db,
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

        is_first_message = len(history) == 0

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

        # If first message, generate title in background
        if is_first_message:
            background_tasks.add_task(
                self.generate_session_title,
                session_id=session_id,
                query=query,
                response=result.get("response", ""),
                provider=provider,
            )

        # Prepare response
        result.pop("sources", None)
        result["session_id"] = session_id
        result["userMessageId"] = user_message_id
        result["messageId"] = message_id
        result["responseId"] = response_id
        
        return result

    async def generate_streaming_response(
        self,
        query: str,
        session_id: str,
        user_id: str,
        provider: Literal["openai", "gemini"],
        background_tasks: BackgroundTasks,
        model: Optional[str] = None,
        api_key: Optional[str] = None,
        top_k: int = 5,
    ):
        """
        Generate a streaming response using RAG pipeline.
        Yields events for SSE.
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
                mongo_db=self.mongo_db,
            )
        else:
            provider_enum = LLMProvider(provider.lower())
            generator = RAGGenerator(
                retriever=retriever,
                provider=provider_enum,
                model_name=model,
                mongo_db=self.mongo_db,
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
        is_first_message = len(history) == 0

        # Initial metadata
        response_id = f"resp_{ObjectId()}"
        full_response = []
        sources = []

        # Yield initial metadata
        yield f"data: {json.dumps({'type': 'start', 'session_id': session_id, 'userMessageId': user_message_id, 'responseId': response_id})}\n\n"

        # Stream from generator
        async for item in generator.stream_response(
            query,
            top_k=top_k,
            api_key=api_key,
            include_sources=True,
            history=history,
        ):
            if "sources" in item:
                sources = item["sources"]

            if "chunk" in item:
                chunk = item["chunk"]
                full_response.append(chunk)
                yield f"data: {json.dumps({'type': 'chunk', 'chunk': chunk})}\n\n"

        final_content = "".join(full_response)
        
        # Save assistant message
        message_id = await insert_chat_message(
            {
                "sessionId": session_id,
                "role": "assistant",
                "content": final_content,
                "responseId": response_id,
            },
            mongo_db=self.mongo_db,
        )

        yield f"data: {json.dumps({'type': 'end', 'messageId': message_id})}\n\n"

        # Log RAG interaction in background
        background_tasks.add_task(
            self._log_interaction,
            query=query,
            response=final_content,
            sources=sources,
            session_id=session_id,
            provider=provider,
            model=model,
            response_id=response_id,
            execution_time=time.time() - start_time,
        )

        # If first message, generate title in background
        if is_first_message:
            background_tasks.add_task(
                self.generate_session_title,
                session_id=session_id,
                query=query,
                response=final_content,
                provider=provider,
            )

    async def generate_session_title(
        self,
        session_id: str,
        query: str,
        response: str,
        provider: str,
    ) -> None:
        """
        Generate a concise title for the session using LLM and update DB.
        """
        try:
            prompt = (
                f"Summarize the following conversation into a short, concise title (max 4-6 words). "
                f"Do not use quotes or special characters.\n\n"
                f"User: {query}\n"
                f"Assistant: {response}\n\n"
                f"Title:"
            )

            title = await self.default_llm_client.generate_text(prompt, temperature=0.7)
            title = title.strip().strip('"').strip("'")

            if title:
                await update_chat_session_title(
                    session_id=session_id, title=title, mongo_db=self.mongo_db
                )
        except Exception as e:
            logger.error(f"Failed to generate session title: {e}")

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
        background_tasks: BackgroundTasks,
        mode: Literal["search", "generate"] = "generate",
        model: Optional[str] = None,
        session_id: Optional[str] = None,
        encrypted_api_key: Optional[str] = None,
        top_k: int = 5,
        isLearning: bool = False,
        moduleId: Optional[str] = None,
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
            background_tasks: FastAPI BackgroundTasks
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
        session_id, _ = await self.get_or_create_session(session_id, user_id, isLearning=isLearning, moduleId=moduleId)

        # Handle search mode
        if mode == "search":
            return await self.perform_search(query, top_k)

        # Handle learning mode
        if isLearning:
            # Save the user message before generating a response
            await insert_chat_message(
                {
                    "sessionId": session_id,
                    "role": "user",
                    "content": query,
                },
                mongo_db=self.mongo_db,
            )

            # Check if this is the first message in the session
            raw_history = await get_last_messages(
                session_id=session_id,
                limit=2,
                mongo_db=self.mongo_db,
            )
            is_first_message = len(raw_history) == 1 and raw_history[0].get("role") == "user"

            # Compose welcome + first lesson if first message
            if is_first_message:
                welcome_message = (
                    "👋 Welcome to MeTTa Learning Mode!\n\n"
                    "I'm your friendly AI tutor, here to guide you through the world of MeTTa—an innovative, pattern-based language for cognitive architectures and symbolic reasoning.\n\n"
                    "In this interactive journey, you'll progress through a series of modules, each designed to build your understanding step by step. At any time, you can ask questions, request examples, or even jump to a specific module if you're feeling adventurous.\n\n"
                    "Here's how your learning experience will work:\n"
                    "- I'll introduce each module and explain key concepts in a clear, approachable way.\n"
                    "- You'll have opportunities to try exercises and quizzes to check your understanding.\n"
                    "- If you get stuck, just ask for help—I'm here to support you!\n"
                    "- You can always say things like 'jump to [module name]' to explore topics in your own order.\n\n"
                    "Let's get started! Which module would you like to begin with, or shall I recommend a starting point?"
                )
                # Compose pre-prompt for first lesson
                pre_prompt = (
                    "You are a warm, friendly, and expert AI tutor for the MeTTa language. "
                    "After the introduction, guide the user through the curriculum step by step, adapting to their progress. "
                    "Use the provided module content if available. Quiz the user, explain concepts, and adapt based on their answers. "
                    "Do not reveal answers to quizzes unless the user is stuck."
                )

                # Load curriculum if available
                import os, json
                CURRICULUM_FILE = os.path.join(os.path.dirname(__file__), '../learning_curriculum.json')
                with open(CURRICULUM_FILE, encoding='utf-8') as f:
                    curriculum_data = json.load(f)
                CURRICULUM = {}
                for level in curriculum_data.get('levels', []):
                    for module in level.get('modules', []):
                        CURRICULUM[module['id']] = {
                            **module,
                            'level_id': level['id'],
                            'level_title': level['title']
                        }

                module_content = None
                module_title = None
                if moduleId:
                    module = CURRICULUM.get(moduleId)
                    if module:
                        module_title = module.get("title")
                        module_content = module.get("content")

                # Compose prompt for first lesson
                prompt = welcome_message + "\n\n" + pre_prompt + "\n"
                if module_title:
                    prompt += f"Current module: {module_title}\n"
                if module_content:
                    prompt += f"Module content: {module_content}\n"
                prompt += "\nRespond as the tutor."

                # Call LLM
                response = await self.default_llm_client.generate_text(prompt, temperature=0.7, max_tokens=600)

                # Save assistant message
                await insert_chat_message(
                    {
                        "sessionId": session_id,
                        "role": "assistant",
                        "content": response,
                    },
                    mongo_db=self.mongo_db,
                )

                return {
                    "response": response,
                    "module_id": moduleId,
                    "session_id": session_id,
                }

            # Otherwise, continue as before (not first message)
            # Compose pre-prompt (copied from routers/learning.py)
            pre_prompt = (
                "You are a warm, friendly, and expert AI tutor for the MeTTa language. "
                "Your first message in every new learning session should always be a welcoming, descriptive introduction to MeTTa and the learning journey ahead. "
                "Briefly explain what MeTTa is, what the user will learn, and how the interactive lessons will work. "
                "Give a quick roadmap of the modules or topics available, and encourage the user to ask questions or jump to any module. "
                "After the introduction, guide the user through the curriculum step by step, adapting to their progress. "
                "Use the provided module content if available. Quiz the user, explain concepts, and adapt based on their answers. "
                "Do not reveal answers to quizzes unless the user is stuck."
            )

            # Load curriculum if available
            import os, json
            CURRICULUM_FILE = os.path.join(os.path.dirname(__file__), '../learning_curriculum.json')
            with open(CURRICULUM_FILE, encoding='utf-8') as f:
                curriculum_data = json.load(f)
            CURRICULUM = {}
            for level in curriculum_data.get('levels', []):
                for module in level.get('modules', []):
                    CURRICULUM[module['id']] = {
                        **module,
                        'level_id': level['id'],
                        'level_title': level['title']
                    }

            module_content = None
            module_title = None
            if moduleId:
                module = CURRICULUM.get(moduleId)
                if module:
                    module_title = module.get("title")
                    module_content = module.get("content")

            # Build chat history from all persisted messages for this session
            raw_history = await get_last_messages(
                session_id=session_id,
                limit=50,  # Arbitrary large number to get full history
                mongo_db=self.mongo_db,
            )
            chat_history = ""
            for msg in raw_history:
                role = msg.get("role")
                content = msg.get("content", "")
                if role == "user":
                    chat_history += f"User: {content}\n"
                else:
                    chat_history += f"Tutor: {content}\n"

            # Compose final prompt
            prompt = pre_prompt + "\n"
            if module_title:
                prompt += f"Current module: {module_title}\n"
            if module_content:
                prompt += f"Module content: {module_content}\n"
            prompt += "Conversation so far:\n" + chat_history
            prompt += "\nRespond as the tutor."

            # Call LLM
            response = await self.default_llm_client.generate_text(prompt, temperature=0.7, max_tokens=600)

            # Save assistant message
            await insert_chat_message(
                {
                    "sessionId": session_id,
                    "role": "assistant",
                    "content": response,
                },
                mongo_db=self.mongo_db,
            )

            return {
                "response": response,
                "module_id": moduleId,
                "session_id": session_id,
            }

        # Handle normal generate mode
        return await self.generate_response(
            query=query,
            session_id=session_id,
            user_id=user_id,
            provider=provider,
            background_tasks=background_tasks,
            model=model,
            api_key=api_key if api_key else None,
            top_k=top_k,
        )

    async def process_streaming_chat_request(
        self,
        query: str,
        user_id: str,
        provider: Literal["openai", "gemini"],
        background_tasks: BackgroundTasks,
        mode: Literal["search", "generate"] = "generate",
        model: Optional[str] = None,
        session_id: Optional[str] = None,
        encrypted_api_key: Optional[str] = None,
        top_k: int = 5,
    ):
        """
        Main entry point for processing streaming chat requests.
        """
        # Decrypt API key if provided
        api_key = await self.decrypt_api_key(
            encrypted_api_key, user_id, provider
        )
        
        # Get or create session
        session_id, _ = await self.get_or_create_session(session_id, user_id)

        if mode == "search":
            async def search_generator():
                result = await self.perform_search(query, top_k)
                yield f"data: {json.dumps({'type': 'params', 'mode': 'search', 'result': result})}\n\n"
                yield f"data: {json.dumps({'type': 'end'})}\n\n"
            
            return search_generator()
        
        return self.generate_streaming_response(
            query=query,
            session_id=session_id,
            user_id=user_id,
            provider=provider,
            background_tasks=background_tasks,
            model=model,
            api_key=api_key if api_key else None,
            top_k=top_k,
        )
