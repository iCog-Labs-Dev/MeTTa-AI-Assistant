import uuid
import string
import random
import pytest

from unittest.mock import patch, Mock, ANY, AsyncMock
from pymongo.results import InsertOneResult
from pydantic import ValidationError

from app.db.users import create_user, seed_admin, UserCreate, UserRole
from mongomock import MongoClient


@pytest.fixture(scope="session")
def seeded_random():
    """Seed random for reproducible tests"""
    random.seed(42)
    return random


@pytest.fixture
def unique_email():
    return f"test-{uuid.uuid4()}@example.com"


@pytest.fixture
def random_password(seeded_random):
    chars = string.ascii_letters + string.digits + "!@#$%^&*()"
    return "".join(seeded_random.choice(chars) for _ in range(12))


@pytest.fixture
def random_role(seeded_random):
    """Reproducible role selection"""
    return seeded_random.choice([UserRole.USER, UserRole.ADMIN])


@pytest.fixture
def mock_env(monkeypatch):
    """Simplified & safer env cleanup"""
    admin_email = f"admin-{uuid.uuid4()}@example.com"
    admin_password = "".join(random.choices(string.ascii_letters + string.digits, k=12))
    monkeypatch.setenv("ADMIN_EMAIL", admin_email)
    monkeypatch.setenv("ADMIN_PASSWORD", admin_password)
    yield {"email": admin_email, "password": admin_password}
    # monkeypatch automatically restores env — no manual cleanup needed


@pytest.fixture
def mock_db():
    client = MongoClient()
    db = client.test_db
    collection = Mock()
    collection.find_one = AsyncMock(return_value=None)
    
    # Simplified insert_one — returns dict with inserted_id directly 
    async def mock_insert_one(doc):
        return type("Result", (), {"inserted_id": str(uuid.uuid4())})()
    
    collection.insert_one = AsyncMock(side_effect=mock_insert_one)
    db.get_collection = Mock(return_value=collection)
    yield db
    client.close()


# === create_user tests ===
@pytest.mark.asyncio
async def test_create_user_success_returns_id(mock_db, unique_email, random_password, random_role):
    """Happy path: valid user creation returns ID and calls insert_once"""
    user_data = UserCreate(email=unique_email, password=random_password, role=random_role)
    user_id = await create_user(user_data, mock_db)
    assert isinstance(user_id, str) and len(user_id) > 0
    mock_db.get_collection().insert_one.assert_called_once()


@pytest.mark.asyncio
async def test_create_user_duplicate_email_raises_error(mock_db, unique_email, random_password):
    mock_db.get_collection().find_one.return_value = {"email": unique_email}
    user_data = UserCreate(email=unique_email, password=random_password, role=UserRole.USER)
    with pytest.raises(ValueError, match="already registered"):
        await create_user(user_data, mock_db)


@pytest.mark.asyncio
async def test_create_user_invalid_email_raises_validation_error():
    with pytest.raises(ValidationError, match="valid email address"):
        UserCreate(email="not-an-email", password="pass123", role=UserRole.USER)


@pytest.mark.asyncio
async def test_create_user_password_is_stripped_before_hashing(mock_db, unique_email, random_password):
    user_data = UserCreate(email=unique_email, password=f"  {random_password}  ", role=UserRole.USER)
    with patch("app.db.users.pwd_context.hash") as mock_hash:
        mock_hash.return_value = "hashed"
        await create_user(user_data, mock_db)
        mock_hash.assert_called_once_with(random_password)  


@pytest.mark.asyncio
async def test_create_user_handles_long_email_and_password(mock_db):
    """Test handling of very long but valid email/password"""
    long_email = "a" * 200 + "@example.com"
    long_password = "x" * 1000
    user_data = UserCreate(email=long_email, password=long_password, role=UserRole.USER)
    await create_user(user_data, mock_db)  # should not raise
    mock_db.get_collection().insert_one.assert_called_once()


@pytest.mark.asyncio
async def test_create_user_missing_db_raises_runtime_error():
    with pytest.raises(RuntimeError, match="Database connection not initialized"):
        await create_user(UserCreate(email="test@example.com", password="pass", role=UserRole.USER), None)


# === seed_admin tests ===
@pytest.mark.asyncio
async def test_seed_admin_creates_admin_when_none_exists(mock_db, mock_env):
    mock_db.get_collection().find_one.return_value = None
    await seed_admin(mock_db)
    mock_db.get_collection().insert_one.assert_called_once()


@pytest.mark.asyncio
async def test_seed_admin_skips_when_admin_exists(mock_db, mock_env):
    mock_db.get_collection().find_one.return_value = {"role": "ADMIN"}
    await seed_admin(mock_db)
    mock_db.get_collection().insert_one.assert_not_called()


@pytest.mark.asyncio
async def test_seed_admin_raises_error_when_env_missing(monkeypatch, mock_db):
    monkeypatch.delenv("ADMIN_EMAIL", raising=False)
    monkeypatch.delenv("ADMIN_PASSWORD", raising=False)
    with pytest.raises(RuntimeError, match="One or more admin credentials"):
        await seed_admin(mock_db)