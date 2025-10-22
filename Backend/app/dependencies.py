from fastapi import Request, Depends
from pymongo import AsyncMongoClient
from pymongo.database import Database
from sentence_transformers import SentenceTransformer
from qdrant_client import AsyncQdrantClient
from decouple import config
from app.repositories.chunk_repository import ChunkRepository
from app.services.llm_service import BaseLLMProvider, GeminiLLMProvider
from app.services.chunk_annotation_service import ChunkAnnotationService


def get_mongo_client(request: Request) -> AsyncMongoClient:
    """Retrieve the MongoDB client from FastAPI application state."""
    return request.app.state.mongo_client


def get_mongo_db(request: Request) -> Database:
    """Retrieve the MongoDB database instance from FastAPI application state."""
    return request.app.state.mongo_db


def get_embedding_model_dep(request: Request) -> SentenceTransformer:
    """Retrieve the embedding model from FastAPI application state."""
    return request.app.state.embedding_model


def get_qdrant_client_dep(request: Request) -> AsyncQdrantClient:
    """Retrieve Qdrant client from FastAPI application state."""
    return request.app.state.qdrant_client


def get_chunk_repository(mongo_db: Database = Depends(get_mongo_db)) -> ChunkRepository:
    """Provide a ChunkRepository instance with MongoDB dependency injection."""
    return ChunkRepository(mongo_db)


def get_llm_provider() -> BaseLLMProvider:
    """Provide the configured LLM Provider instance."""
    gemini_api_key = config("GEMINI_API_KEY", default=None)

    if not gemini_api_key:
        # Raise an error instead of just printing
        raise ValueError(
            "GEMINI_API_KEY is not set. The application cannot function without it."
        )

    return GeminiLLMProvider(api_key=gemini_api_key)


def get_annotation_service(
    repository: ChunkRepository = Depends(get_chunk_repository),
    llm_provider: BaseLLMProvider = Depends(get_llm_provider),
) -> ChunkAnnotationService:
    """Provide ChunkAnnotationService that orchestrates chunk retrieval and annotation."""
    return ChunkAnnotationService(repository=repository, llm_provider=llm_provider)
