import os
from typing import Optional, Literal
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Depends
from app.dependencies import (
    get_embedding_model_dep,
    get_qdrant_client_dep,
    get_llm_provider_dep,
)
from app.rag.retriever.retriever import EmbeddingRetriever
from app.core.clients.llm_clients import LLMProvider
from app.rag.generator.rag_generator import RAGGenerator


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

@router.post("/", summary="Chat with RAG system")
async def chat(
    request: ChatRequest,
    model_dep = Depends(get_embedding_model_dep),
    qdrant = Depends(get_qdrant_client_dep),
    default_llm = Depends(get_llm_provider_dep),
):
    query, provider, model = request.query, request.provider, request.model
    mode, top_k = request.mode, request.top_k
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
            result = await generator.generate_response(query, top_k=top_k)
            return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")
