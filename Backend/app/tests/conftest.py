import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock
from fastapi.testclient import TestClient
import os
import sys

# Add project root to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
from app.core.clients.llm_clients import LLMClient, LLMProvider

@pytest.fixture
def client():
    """FastAPI test client"""
    return TestClient(app)

@pytest.fixture
def mock_mongo_db():
    """Mock MongoDB database"""
    mock_db = AsyncMock()
    mock_collection = AsyncMock()
    mock_db.get_collection.return_value = mock_collection
    return mock_db

@pytest.fixture
def mock_llm_client():
    """Mock LLM client"""
    mock_client = AsyncMock(spec=LLMClient)
    mock_client.generate_text.return_value = "Mocked AI response"
    mock_client.get_provider.return_value = LLMProvider.GEMINI
    mock_client.get_model_name.return_value = "gemini:test-model"
    return mock_client

@pytest.fixture
def sample_chunk_data():
    """Sample chunk data for testing"""
    return {
        "chunkId": "test-chunk-123",
        "source": "code",
        "chunk": "(= (factorial 0) 1)",
        "isEmbedded": False,
        "project": "test-project",
        "repo": "test-repo",
        "file": ["math.metta"],
        "status": "RAW"
    }

@pytest.fixture
def sample_user_data():
    """Sample user data for testing"""
    return {
        "id": "user123",
        "email": "test@example.com",
        "role": "user"
    }

@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()