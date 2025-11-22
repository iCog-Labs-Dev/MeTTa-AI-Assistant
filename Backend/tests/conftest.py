"""
Pytest configuration and shared fixtures for all tests.
"""
import os
import pytest
from typing import AsyncGenerator, Generator
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient
from fastapi import FastAPI
from pymongo.database import Database
from pymongo import AsyncMongoClient
from sentence_transformers import SentenceTransformer
from qdrant_client import AsyncQdrantClient
from bson import ObjectId
from datetime import datetime, timezone

# Set test environment variables before importing app
os.environ["JWT_SECRET"] = "test-secret-key-for-testing-only"
os.environ["MONGO_URI"] = "mongodb://localhost:27017"
os.environ["MONGO_DB"] = "test_db"
os.environ["QDRANT_HOST"] = "localhost"
os.environ["QDRANT_PORT"] = "6333"
os.environ["COLLECTION_NAME"] = "test_collection"
os.environ["KEY_ENCRYPTION_KEY"] = "Gs8d0pOL_hhYuwRB_NKiVUh3-2j0PLQkm_i4iZGiEAk="
os.environ["ADMIN_EMAIL"] = "admin@test.com"
os.environ["ADMIN_PASSWORD"] = "admin123"

from app.main import app
from app.services.key_management_service import KMS
from app.core.clients.llm_clients import LLMClient


@pytest.fixture
def test_app() -> FastAPI:
    """Create a test FastAPI application instance."""
    return app


@pytest.fixture
def client(test_app: FastAPI) -> Generator[TestClient, None, None]:
    """Create a test client for the FastAPI application."""
    # Mock the lifespan dependencies
    with patch("app.main.AsyncMongoClient") as mock_mongo, \
         patch("app.main.AsyncQdrantClient") as mock_qdrant, \
         patch("app.main.SentenceTransformer") as mock_model, \
         patch("app.main.LLMClientFactory") as mock_llm_factory, \
         patch("app.main.seed_admin"), \
         patch("app.main.ChunkRepository") as mock_repo, \
         patch("app.main.create_collection_if_not_exists"), \
         patch("app.main.setup_metadata_indexes"):
        
        # Setup mocks
        mock_mongo_instance = AsyncMock(spec=AsyncMongoClient)
        mock_db = AsyncMock(spec=Database)
        mock_db.command = AsyncMock(return_value={"ok": 1})
        mock_mongo_instance.__getitem__.return_value = mock_db
        mock_mongo.return_value = mock_mongo_instance
        
        mock_qdrant_instance = AsyncMock(spec=AsyncQdrantClient)
        mock_qdrant.return_value = mock_qdrant_instance
        
        mock_model_instance = MagicMock(spec=SentenceTransformer)
        mock_model.return_value = mock_model_instance
        
        mock_llm_client = AsyncMock(spec=LLMClient)
        mock_llm_client.get_model_name.return_value = "test-model"
        mock_llm_factory.create_default_client.return_value = mock_llm_client
        
        mock_repo_instance = AsyncMock()
        mock_repo_instance._ensure_indexes = AsyncMock()
        mock_repo.return_value = mock_repo_instance
        
        # Set app state
        test_app.state.mongo_client = mock_mongo_instance
        test_app.state.mongo_db = mock_db
        test_app.state.qdrant_client = mock_qdrant_instance
        test_app.state.embedding_model = mock_model_instance
        test_app.state.default_llm_provider = mock_llm_client
        test_app.state.kms = KMS(os.environ["KEY_ENCRYPTION_KEY"])
        
        with TestClient(test_app) as test_client:
            yield test_client


@pytest.fixture
def mock_mongo_db() -> AsyncMock:
    """Create a mock MongoDB database."""
    mock_db = AsyncMock(spec=Database)
    return mock_db


@pytest.fixture
def mock_qdrant_client() -> AsyncMock:
    """Create a mock Qdrant client."""
    return AsyncMock(spec=AsyncQdrantClient)


@pytest.fixture
def mock_embedding_model() -> MagicMock:
    """Create a mock embedding model."""
    model = MagicMock(spec=SentenceTransformer)
    model.encode.return_value = [[0.1] * 384]  # Mock embedding vector
    return model


@pytest.fixture
def mock_llm_client() -> AsyncMock:
    """Create a mock LLM client."""
    client = AsyncMock(spec=LLMClient)
    client.generate_response = AsyncMock(return_value="Test response")
    client.get_model_name.return_value = "test-model"
    return client


@pytest.fixture
def mock_kms() -> KMS:
    """Create a KMS instance for testing."""
    return KMS(os.environ["KEY_ENCRYPTION_KEY"])


@pytest.fixture
def sample_user_data() -> dict:
    """Sample user data for testing."""
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    return {
        "_id": ObjectId(),
        "email": "test@example.com",
        "hashed_password": pwd_context.hash("password123"),
        "role": "user"
    }


@pytest.fixture
def sample_admin_data() -> dict:
    """Sample admin user data for testing."""
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    return {
        "_id": ObjectId(),
        "email": "admin@example.com",
        "hashed_password": pwd_context.hash("admin123"),
        "role": "admin"
    }


@pytest.fixture
def auth_headers(client: TestClient, sample_user_data: dict) -> dict:
    """Create authentication headers with a valid token."""
    from app.services.auth import create_access_token
    
    token = create_access_token({
        "sub": str(sample_user_data["_id"]),
        "role": sample_user_data["role"]
    })
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_headers(client: TestClient, sample_admin_data: dict) -> dict:
    """Create authentication headers for admin user."""
    from app.services.auth import create_access_token
    
    token = create_access_token({
        "sub": str(sample_admin_data["_id"]),
        "role": sample_admin_data["role"]
    })
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def sample_chunk_data() -> dict:
    """Sample chunk data for testing."""
    return {
        "_id": ObjectId(),
        "chunk": "This is a test chunk",
        "source": "test_source",
        "isEmbedded": False,
        "project": "test_project",
        "repo": "test_repo",
        "section": ["section1"],
        "file": ["file1.py"],
        "version": "1.0.0",
        "created_at": datetime.now(timezone.utc)
    }


@pytest.fixture
def sample_chat_session() -> dict:
    """Sample chat session data for testing."""
    return {
        "_id": ObjectId(),
        "userId": str(ObjectId()),
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc)
    }


@pytest.fixture
def sample_chat_message() -> dict:
    """Sample chat message data for testing."""
    return {
        "_id": ObjectId(),
        "sessionId": str(ObjectId()),
        "role": "user",
        "content": "Test message",
        "createdAt": datetime.now(timezone.utc)
    }

