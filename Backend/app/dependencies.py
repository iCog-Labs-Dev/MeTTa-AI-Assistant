from fastapi import Request
from pymongo import AsyncMongoClient
from pymongo.database import Database
from sentence_transformers import SentenceTransformer
from qdrant_client import AsyncQdrantClient

def get_mongo_client(request: Request) -> AsyncMongoClient:
    return request.app.state.mongo_client



def get_embedding_model_dep(request: Request) -> SentenceTransformer:
    return request.app.state.embedding_model


def get_qdrant_client_dep(request: Request) -> AsyncQdrantClient:
    """Return Qdrant client stored in app.state"""
    return request.app.state.qdrant_client
