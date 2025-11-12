from fastapi.testclient import TestClient
from fastapi import FastAPI
from unittest.mock import patch, AsyncMock
import pytest
from jose import jwt, JWTError
from bson.objectid import ObjectId

from app.routers.auth import router
from app.dependencies import get_mongo_db
from app.services.auth import get_secret_key


app = FastAPI()
app.include_router(router)


@pytest.fixture
def client():
    async def override_get_mongo_db():
        return AsyncMock()
    app.dependency_overrides[get_mongo_db] = override_get_mongo_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def user_id():
    return ObjectId("507f1f77bcf86cd799439011")


@pytest.fixture
def mock_user(user_id):
    return {"_id": user_id, "role": "user"}


@pytest.fixture
def valid_refresh_token(user_id, monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "test-secret-key")
    payload = {"sub": str(user_id), "role": "user", "type": "refresh"}
    return jwt.encode(payload, "test-secret-key", algorithm="HS256")


@pytest.fixture
def expired_refresh_token(user_id, monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "test-secret-key")
    payload = {"sub": str(user_id), "role": "user", "type": "refresh", "exp": 1609459200 - 3600}
    return jwt.encode(payload, "test-secret-key", algorithm="HS256")


def test_signup_happy_path(client, user_id):
    with patch("app.routers.auth.create_user", return_value=str(user_id)):
        response = client.post("/api/auth/signup", json={
            "email": "test@example.com", "password": "pass", "full_name": "Test", "role": "user"
        })
        assert response.status_code == 201
        assert response.json()["user_id"] == str(user_id)


def test_signup_failure(client):
    with patch("app.routers.auth.create_user", return_value=None):
        response = client.post("/api/auth/signup", json={
            "email": "test@example.com",
            "password": "short" 
        })
        assert response.status_code == 422


def test_signup_invalid_data(client):
    response = client.post("/api/auth/signup", json={"password": "pass"})
    assert response.status_code == 422


def test_login_happy_path(client, mock_user):
    with patch("app.routers.auth.authenticate_user", return_value=mock_user):
        with patch("app.routers.auth.create_access_token", return_value="access"):
            with patch("app.routers.auth.create_refresh_token", return_value="refresh"):
                response = client.post("/api/auth/login", json={
                    "email": "test@example.com", "password": "pass"
                })
                assert response.status_code == 200
                data = response.json()
                assert "access_token" in data
                assert "refresh_token" in data


def test_login_invalid_credentials(client):
    with patch("app.routers.auth.authenticate_user", return_value=None):
        response = client.post("/api/auth/login", json={"email": "x", "password": "y"})
        assert response.status_code == 401


def test_refresh_happy_path(client, valid_refresh_token, mock_user):
    with patch("app.routers.auth._get_collection") as mock_get:
        coll = AsyncMock()
        coll.find_one.return_value = mock_user
        mock_get.return_value = coll
        with patch("app.routers.auth.create_access_token", return_value="new.access"):
            with patch("app.routers.auth.create_refresh_token", return_value="new.refresh"):
                response = client.post("/api/auth/refresh", json={"refresh_token": valid_refresh_token})
                assert response.status_code == 200
                data = response.json()
                assert data["access_token"] == "new.access"
                assert data["refresh_token"] == "new.refresh"


def test_refresh_expired_token(client, expired_refresh_token):
    response = client.post("/api/auth/refresh", json={"refresh_token": expired_refresh_token})
    assert response.status_code == 401
    assert "expired" in response.json()["detail"].lower()


def test_refresh_invalid_token(client, monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "test-secret-key")
    with patch("app.routers.auth.jwt.decode", side_effect=JWTError()):
        response = client.post("/api/auth/refresh", json={"refresh_token": "bad"})
        assert response.status_code == 401


def test_refresh_missing_user(client, valid_refresh_token):
    with patch("app.routers.auth._get_collection") as mock_get:
        coll = AsyncMock()
        coll.find_one.return_value = None
        mock_get.return_value = coll
        response = client.post("/api/auth/refresh", json={"refresh_token": valid_refresh_token})
        assert response.status_code == 404