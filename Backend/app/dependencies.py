from fastapi import Request
from pymongo import AsyncMongoClient
from pymongo.database import Database
from sentence_transformers import SentenceTransformer
from qdrant_client import AsyncQdrantClient
from app.core.clients.llm_clients import LLMClient


def get_mongo_client(request: Request) -> AsyncMongoClient:
    return request.app.state.mongo_client


def get_mongo_db(request: Request) -> Database:
    return request.app.state.mongo_db



def get_embedding_model_dep(request: Request) -> SentenceTransformer:
    return request.app.state.embedding_model


def get_qdrant_client_dep(request: Request) -> AsyncQdrantClient:
    """Return Qdrant client stored in app.state"""
    return request.app.state.qdrant_client


def get_llm_provider_dep(request: Request) -> LLMClient:
    """Return default LLM provider stored in app.state"""
    return request.app.state.default_llm_provider
