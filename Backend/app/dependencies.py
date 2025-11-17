from fastapi import Request, Depends, HTTPException
from pymongo import AsyncMongoClient
from pymongo.database import Database
from sentence_transformers import SentenceTransformer
from qdrant_client import AsyncQdrantClient
from app.core.clients.llm_clients import LLMClient
from app.repositories.chunk_repository import ChunkRepository
from app.services.chunk_annotation_service import ChunkAnnotationService
from app.services.key_management_service import KMS
from app.db.users import UserRole


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
    """Return Qdrant client stored in app.state"""
    return request.app.state.qdrant_client


def get_llm_provider_dep(request: Request) -> LLMClient:
    """Return default LLM provider stored in app.state"""
    return request.app.state.default_llm_provider


def get_chunk_repository(mongo_db: Database = Depends(get_mongo_db)) -> ChunkRepository:
    """Provide a ChunkRepository instance with MongoDB dependency injection."""
    return ChunkRepository(mongo_db)


def get_annotation_service(
    repository: ChunkRepository = Depends(get_chunk_repository),
    llm_provider: LLMClient = Depends(get_llm_provider_dep),
) -> ChunkAnnotationService:
    """Provide ChunkAnnotationService that orchestrates chunk retrieval and annotation."""
    return ChunkAnnotationService(repository=repository, llm_provider=llm_provider)

def get_kms(request: Request) -> KMS:
    '''Key management service class dependency'''
    return request.app.state.kms


def get_current_user(request: Request) -> dict:
    """Return current user dict injected by AuthMiddleware or raise 401."""
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


def require_role(required_role: UserRole):
    """Factory returning a dependency that enforces the required role."""

    def _enforce_role(current_user: dict = Depends(get_current_user)) -> None:
        role = current_user.get("role")
        if role != required_role.value:
            raise HTTPException(
                status_code=403, detail=f"{required_role.value} access required"
            )
        return None

    return _enforce_role
