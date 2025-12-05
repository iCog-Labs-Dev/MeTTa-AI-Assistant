import os
import time
from typing import Optional, Literal
from datetime import datetime, timedelta, timezone

import json
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Depends, Request, Response
from fastapi.responses import StreamingResponse
from bson import ObjectId

from app.dependencies import (
    get_embedding_model_dep,
    get_qdrant_client_dep,
    get_llm_provider_dep,
    get_mongo_db,
    get_kms,
    get_current_user,
)
from app.rag.retriever.retriever import EmbeddingRetriever
from app.core.clients.llm_clients import LLMProvider
from app.rag.generator.rag_generator import RAGGenerator
from app.db.chat_db import insert_chat_message, get_last_messages, create_chat_session
from app.rag.rag_logging import log_rag_interaction

from loguru import logger


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
    current_user=Depends(get_current_user),
    kms=Depends(get_kms),
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
        session_id = await create_chat_session(current_user["id"], mongo_db=mongo_db)
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
            api_key = await kms.decrypt_api_key(
                encrypted_key, current_user["id"], provider.lower(), mongo_db
            )

            # Validate decrypted key is not empty
            if not api_key or not api_key.strip():
                logger.warning(
                    f"Decrypted API key is empty for user {current_user['id']}, provider {provider}"
                )
                api_key = ""
            else:
                # refresh encrypted_api_key expiry date | sliding expiration refresh
                response.set_cookie(
                    key=provider.lower(),
                    value=encrypted_key,
                    httponly=True,
                    samesite="none",
                    secure=True,
                    expires=(datetime.now(timezone.utc) + timedelta(days=7)),
                )
        except Exception as e:
            logger.warning(
                f"Failed to decrypt API key cookie for user {current_user['id']}, provider {provider}: {e}"
            )
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

            key_for_llm = api_key if encrypted_key and api_key else None

            async def event_generator():
                response_id = f"resp_{ObjectId()}"
                final_payload = None

                try:
                    async for evt in generator.generate_response_stream(
                        query,
                        top_k=top_k,
                        api_key=key_for_llm,
                        include_sources=True,
                        history=history,
                    ):
                        etype = evt.get("type")

                        if etype == "partial":
                            delta = evt.get("delta", "")
                            data = {"type": "partial", "delta": delta}
                            yield f"data: {json.dumps(data)}\n\n"

                        elif etype == "error":
                            err = evt.get("error", "")
                            logger.error(f"Streaming error event: {err}")
                            data = {"type": "error", "error": err}
                            yield f"data: {json.dumps(data)}\n\n"

                        elif etype == "final":
                            final_payload = evt.get("response") or {}
                            final_payload["responseId"] = response_id
                            if created_new_session:
                                final_payload["session_id"] = session_id
                            yield (
                                f"data: {json.dumps({'type': 'final', 'payload': final_payload})}\n\n"
                            )
                            break

                        else:
                            logger.warning(f"[CHAT] UNKNOWN EVENT TYPE: {evt!r}")
                            yield f"data: {json.dumps(evt)}\n\n"
                except Exception as e:
                    logger.exception(f"Exception during streaming: {e}")
                    yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"

                try:
                    if final_payload:
                        assistant_content = (
                            final_payload.get("response", "")
                            if isinstance(final_payload, dict)
                            else str(final_payload)
                        )
                        message_id = await insert_chat_message(
                            {
                                "sessionId": session_id,
                                "role": "assistant",
                                "content": assistant_content,
                                "responseId": response_id,
                            },
                            mongo_db=mongo_db,
                        )
                        
                        sources = final_payload.get("sources", []) or []
                        contexts = [str(s.get("text", "")) for s in sources]
                        execution_time = time.time() - start_time
                        await log_rag_interaction(
                            {
                                "question": query,
                                "answer": final_payload.get("response", ""),
                                "contexts": contexts,
                                "metadata": {
                                    "session_id": session_id,
                                    "provider": provider,
                                    "model": model if model else "system",
                                    "response_id": response_id,
                                    "execution_time_seconds": execution_time,
                                },
                            },
                            mongo_db=mongo_db,
                        )

                        # enrich final_payload with IDs for the client
                        final_payload.setdefault("session_id", session_id)
                        final_payload["userMessageId"] = user_message_id
                        final_payload["messageId"] = message_id
                except Exception as db_exc:
                    logger.exception(
                        f"Failed to insert assistant message after streaming: {db_exc}"
                    )

            return StreamingResponse(event_generator(), media_type="text/event-stream")
    except Exception as e:
        logger.exception(f"Chat failed with exception: {e}")
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")
