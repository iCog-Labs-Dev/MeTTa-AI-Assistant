from fastapi.testclient import TestClient
from fastapi import FastAPI, HTTPException
import pytest
from jose import jwt
from datetime import datetime, timedelta

from app.routers.protected import router
from app.dependencies import get_current_user


app = FastAPI()
app.include_router(router)
SECRET_KEY = "test-secret-key"


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def override_user():
    def _set(user):
        app.dependency_overrides[get_current_user] = lambda: user
    yield _set
    app.dependency_overrides.clear()


@pytest.fixture
def admin_token(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", SECRET_KEY)
    payload = {"sub": "admin1", "role": "admin", "exp": datetime.utcnow() + timedelta(hours=1)}
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


def test_admin_only_happy_path(client, override_user):
    override_user({"_id": "1", "role": "admin"})
    r = client.get("/api/protected/admin-only")
    assert r.status_code == 200


def test_admin_only_unauthenticated(client, override_user):
    def raise_unauth():
        raise HTTPException(status_code=401, detail="Not authenticated")
    app.dependency_overrides[get_current_user] = raise_unauth
    
    r = client.get("/api/protected/admin-only")
    assert r.status_code == 401
    assert r.json()["detail"] == "Not authenticated"
    
    app.dependency_overrides.clear()


def test_admin_only_expired_token(client, monkeypatch):
    monkeypatch.setenv("JWT_SECRET", SECRET_KEY)
    payload = {"sub": "1", "role": "admin", "exp": datetime.utcnow() - timedelta(hours=1)}
    token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")
    r = client.get("/api/protected/admin-only", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401


def test_admin_only_malformed_token(client):
    r = client.get("/api/protected/admin-only", headers={"Authorization": "Bearer abc.def.ghi"})
    assert r.status_code == 401


def test_admin_only_wrong_secret_token(client, monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "wrong")
    token = jwt.encode({"sub": "1", "role": "admin"}, "wrong", algorithm="HS256")
    r = client.get("/api/protected/admin-only", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401


def test_admin_only_token_tampering(client, monkeypatch):
    monkeypatch.setenv("JWT_SECRET", SECRET_KEY)
    valid = jwt.encode({"sub": "1", "role": "admin"}, SECRET_KEY, algorithm="HS256")
    tampered = valid[:-5] + "xxxxx"
    r = client.get("/api/protected/admin-only", headers={"Authorization": f"Bearer {tampered}"})
    assert r.status_code == 401