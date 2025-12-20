import os
import time
from typing import Optional, Literal
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Depends, Request, Response
from bson import ObjectId
from app.dependencies import (
    get_embedding_model_dep,
    get_qdrant_client_dep,
    get_llm_provider_dep,
    get_mongo_db,
    get_kms,
    get_current_user
)
from app.rag.retriever.retriever import EmbeddingRetriever
from app.core.clients.llm_clients import LLMProvider
from app.rag.generator.rag_generator import RAGGenerator
from app.db.chat_db import insert_chat_message, get_last_messages, create_chat_session
from app.rag.rag_logging import log_rag_interaction

from app.core.logging import logger

router = APIRouter(
    prefix="/api/chat",
    tags=["chat"],
    responses={404: {"description": "Not found"}},
)


class ChatRequest(BaseModel):
    query: str
    provider: Literal["openai", "gemini"] = "gemini"
    model: Optional[str] = None
    mode: Literal["search", "generate"] = "generate"
    top_k: int = Field(default=5, ge=1, le=50)
    session_id: Optional[str] = None

@router.post("/", summary="Chat with RAG system")
async def chat(
    request: Request,
    response: Response, 
    chat_request: ChatRequest,
    model_dep=Depends(get_embedding_model_dep),
    qdrant=Depends(get_qdrant_client_dep),
    default_llm=Depends(get_llm_provider_dep),
    mongo_db=Depends(get_mongo_db),
    current_user = Depends(get_current_user),
    kms = Depends(get_kms)
):


    start_time = time.time()
    query, provider, model = (
        chat_request.query,
        chat_request.provider,
        chat_request.model,
    )

    mode, top_k = chat_request.mode, chat_request.top_k
    session_id = chat_request.session_id
    created_new_session = False
    if not session_id:
        session_id = await create_chat_session(current_user["id"],mongo_db=mongo_db)
        created_new_session = True
    collection_name = os.getenv("COLLECTION_NAME")
    if not collection_name:
        raise HTTPException(status_code=500, detail="COLLECTION_NAME not set")
    
    if not provider:
        raise HTTPException(status_code=400, detail="Provider must be specified")
    # Extract cookies
    encrypted_key = request.cookies.get(provider.lower())
    api_key = ""

    if encrypted_key and encrypted_key.strip():
        try:
            api_key = await kms.decrypt_api_key(encrypted_key, current_user["id"], provider.lower(), mongo_db)
            
            # Validate decrypted key is not empty
            if not api_key or not api_key.strip():
                logger.warning(f"Decrypted API key is empty for user {current_user['id']}, provider {provider}")
                api_key = ""
            else:
                # refresh encrypted_api_key expiry date | sliding expiration refresh
                response.set_cookie(
                    key=provider.lower(), 
                    value=encrypted_key, 
                    httponly=True, 
                    samesite="none",
                    secure=True,
                    expires=(datetime.now(timezone.utc) + timedelta(days=7))
                )
        except Exception as e:
            logger.warning(f"Failed to decrypt API key cookie for user {current_user['id']}, provider {provider}: {e}")
            api_key = ""
    
    try:
        retriever = EmbeddingRetriever(
            model=model_dep, qdrant=qdrant, collection_name=collection_name
        )
        if mode == "search":
            results = await retriever.retrieve(query, top_k=top_k)
            return {"query": query, "mode": "search", "results": results}
        else:
            if provider.lower() == "gemini" and not model:
                generator = RAGGenerator(retriever=retriever, llm_client=default_llm)
            else:
                provider_enum = LLMProvider(provider.lower())
                generator = RAGGenerator(
                    retriever=retriever, provider=provider_enum, model_name=model
                )
            user_message_id = await insert_chat_message(
                {"sessionId": session_id, "role": "user", "content": query},
                mongo_db=mongo_db,
            )

            raw_history = await get_last_messages(
                session_id=session_id, limit=5, mongo_db=mongo_db
            )
            raw_history = raw_history[:-1] if raw_history else raw_history

            history = [
                {"role": m.get("role"), "content": m.get("content", "")}
                for m in raw_history
            ]
            
            if encrypted_key and api_key:
                result = await generator.generate_response(
                    query, top_k=top_k,api_key=api_key, include_sources=True, history=history,
                )
            else:
                result = await generator.generate_response(
                    query, top_k=top_k, api_key=None, include_sources=True, history=history
                )

            response_id = f"resp_{ObjectId()}"

            message_id = await insert_chat_message(
                {
                    "sessionId": session_id,
                    "role": "assistant",
                    "content": result.get("response", ""),
                    "responseId": response_id,
                },
                mongo_db=mongo_db,
            )
            try:
                sources = result.get("sources", []) or []
                contexts = [str(s.get("text", "")) for s in sources]
                execution_time = time.time() - start_time
                await log_rag_interaction(
                    {
                        "question": query,
                        "answer": result.get("response", ""),
                        "contexts": contexts,
                        "metadata": {
                            "session_id": session_id,
                            "provider": provider,
                            "model": model if model else "system",
                            "response_id": response_id,
                            "execution_time_seconds": execution_time
                        },
                    },
                    mongo_db=mongo_db
                )
            except Exception:
                logger.warning("Failed to log RAG interaction", exc_info=True)
            result.pop("sources")
            result["session_id"] = session_id
            result["userMessageId"] = user_message_id
            result["messageId"] = message_id
            result["responseId"] = response_id
            return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")