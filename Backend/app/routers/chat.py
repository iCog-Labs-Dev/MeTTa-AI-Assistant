import os
from typing import Optional, Literal
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Depends, Request
from app.dependencies import (
    get_embedding_model_dep,
    get_qdrant_client_dep,
    get_llm_provider_dep,
    get_mongo_db,
)
from app.rag.retriever.retriever import EmbeddingRetriever
from app.core.clients.llm_clients import LLMProvider
from app.rag.generator.rag_generator import RAGGenerator
from app.db.db import insert_chat_message, get_last_messages, create_chat_session
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


@router.post("/session", summary="Create a new chat session")
async def create_session(mongo_db=Depends(get_mongo_db)):
    sid = await create_chat_session(mongo_db=mongo_db)
    return {"session_id": sid}


@router.post("/", summary="Chat with RAG system")
async def chat(
    request: Request,
    chat_request: ChatRequest,
    model_dep=Depends(get_embedding_model_dep),
    qdrant=Depends(get_qdrant_client_dep),
    default_llm=Depends(get_llm_provider_dep),
    mongo_db=Depends(get_mongo_db),
):

    query, provider, model = (
        chat_request.query,
        chat_request.provider,
        chat_request.model,
    )
    mode, top_k = chat_request.mode, chat_request.top_k
    session_id = chat_request.session_id
    created_new_session = False
    if not session_id:
        session_id = await create_chat_session(mongo_db=mongo_db)
        created_new_session = True
    collection_name = os.getenv("COLLECTION_NAME")
    if not collection_name:
        raise HTTPException(status_code=500, detail="COLLECTION_NAME not set")
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
            await insert_chat_message(
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

            result = await generator.generate_response(
                query, top_k=top_k, include_sources=True, history=history
            )

            await insert_chat_message(
                {
                    "sessionId": session_id,
                    "role": "assistant",
                    "content": result.get("response", ""),
                },
                mongo_db=mongo_db,
            )
            if created_new_session:
                result["session_id"] = session_id
            return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")
