from fastapi import HTTPException
from unittest.mock import patch, AsyncMock
import pytest

from jose import jwt
from passlib.context import CryptContext
from bson.objectid import ObjectId

from app.services.auth import (
    get_secret_key,
    authenticate_user,
    create_access_token,
    create_refresh_token,
)
from app.db.db import _get_collection


@pytest.fixture
def pwd_context():
    return CryptContext(schemes=["bcrypt"], deprecated="auto")

@pytest.fixture
def fixed_timestamp(monkeypatch):
    fixed = 4102444800
    monkeypatch.setattr("time.time", lambda: fixed)
    monkeypatch.setattr("app.services.auth.time.time", lambda: fixed)
    return fixed

@pytest.fixture
def mock_db():
    db = AsyncMock()
    db.users.find_one = AsyncMock()
    return db

@pytest.fixture
def user_id():
    return ObjectId("507f1f77bcf86cd799439011")


# === get_secret_key tests ===
def test_get_secret_key_happy_path(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "test-secret-key")
    assert get_secret_key() == "test-secret-key"


def test_get_secret_key_missing(monkeypatch):
    monkeypatch.delenv("JWT_SECRET", raising=False)
    with pytest.raises(RuntimeError, match="JWT_SECRET environment variable is not set"):
        get_secret_key()


# === authenticate_user tests ===
@pytest.mark.asyncio
async def test_authenticate_user_happy_path(user_id,mock_db, pwd_context):
    user_data = {
        "_id": user_id,
        "email": "test@example.com",
        "hashed_password": pwd_context.hash("Testpass123!")
    }
    mock_db.users.find_one.return_value = user_data

    with patch("app.services.auth._get_collection", return_value=mock_db.users):
        result = await authenticate_user("test@example.com", "Testpass123!", mock_db)
        assert result == user_data


@pytest.mark.asyncio
async def test_authenticate_user_invalid_password(mock_db, pwd_context):
    user_data = {
        "email": "test@example.com",
        "hashed_password": pwd_context.hash("Testpass123!")
    }
    mock_db.users.find_one.return_value = user_data

    with patch("app.services.auth._get_collection", return_value=mock_db.users):
        result = await authenticate_user("test@example.com", "Wrongpass!", mock_db)
        assert result is None


@pytest.mark.asyncio
async def test_authenticate_user_missing_user(mock_db):
    mock_db.users.find_one.return_value = None

    with patch("app.services.auth._get_collection", return_value=mock_db.users):
        result = await authenticate_user("ghost@example.com", "pass", mock_db)
        assert result is None


# === create_access_token tests ===
def test_create_access_token_happy_path(fixed_timestamp):
    with patch("app.services.auth.get_secret_key", return_value="test-secret-key"):
        token = create_access_token({"sub": "user123", "role": "user"})
        payload = jwt.decode(token, "test-secret-key", algorithms=["HS256"])
        assert payload["sub"] == "user123"
        assert payload["role"] == "user"
        assert payload["exp"] == fixed_timestamp + 15 * 60


def test_create_access_token_with_large_payload(fixed_timestamp):
    large_data = {"sub": "user123", "extra": "x" * 1000}
    with patch("app.services.auth.get_secret_key", return_value="test-secret-key"):
        token = create_access_token(large_data)
        payload = jwt.decode(token, "test-secret-key", algorithms=["HS256"])
        assert payload["extra"] == "x" * 1000
        assert payload["exp"] == fixed_timestamp + 900


# === create_refresh_token tests ===
def test_create_refresh_token_happy_path(fixed_timestamp):
    with patch("app.services.auth.get_secret_key", return_value="test-secret-key"):
        token = create_refresh_token({"sub": "user123", "role": "user"})
        payload = jwt.decode(token, "test-secret-key", algorithms=["HS256"])
        assert payload["type"] == "refresh"
        assert payload["exp"] == fixed_timestamp + 7 * 24 * 60 * 60


def test_create_refresh_token_expiration_boundary(fixed_timestamp):
    expected_exp = fixed_timestamp + 7 * 24 * 60 * 60  # 7 days from now (creation time)

    with patch("app.services.auth.get_secret_key", return_value="test-secret-key"):
        token = create_refresh_token({"sub": "user123"})
        payload = jwt.decode(token, "test-secret-key", algorithms=["HS256"])
        
        assert payload["exp"] == expected_exp
        # Token is still valid at creation time
        assert payload["exp"] > fixed_timestamp