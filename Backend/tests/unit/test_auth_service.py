"""
Unit tests for authentication service functions.
Tests individual functions in isolation.
"""

import pytest
import os
from unittest.mock import AsyncMock, MagicMock, patch
from passlib.context import CryptContext
from jose import jwt
from bson import ObjectId
import time

from app.services.auth import (
    authenticate_user,
    create_access_token,
    create_refresh_token,
    get_secret_key,
    ALGORITHM,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    REFRESH_TOKEN_EXPIRE_DAYS,
)


class TestGetSecretKey:
    """Unit tests for get_secret_key function."""
    
    def test_get_secret_key_success(self):
        """Test retrieving secret key from environment."""
        test_key = "test-secret-key-123"
        with patch.dict(os.environ, {"JWT_SECRET": test_key}):
            result = get_secret_key()
            assert result == test_key
    
    def test_get_secret_key_missing(self):
        """Test that missing JWT_SECRET raises RuntimeError."""
        with patch.dict(os.environ, {}, clear=True):
            os.environ.pop("JWT_SECRET", None)
            with pytest.raises(RuntimeError, match="JWT_SECRET environment variable"):
                get_secret_key()


class TestAuthenticateUser:
    """Unit tests for authenticate_user function."""
    
    @pytest.mark.asyncio
    async def test_authenticate_user_success(self):
        """Test successful authentication with correct credentials."""
        email = "test@example.com"
        password = "correct_password"
        
        
        hashed_password = CryptContext(schemes=["bcrypt"], deprecated="auto").hash(password)
        
        mock_user = {
            "_id": ObjectId(),
            "email": email,
            "hashed_password": hashed_password,
            "role": "user"
        }
        
        async def mock_find_one(*args, **kwargs):
            return mock_user
        
        class MockCollection:
            def __init__(self):
                self.find_one = mock_find_one
        
        mock_collection = MockCollection()
        mock_mongo_db = MagicMock()
        
        def get_collection_side_effect(db, name):
            return mock_collection
        
        with patch("app.services.auth._get_collection", side_effect=get_collection_side_effect):
            result = await authenticate_user(email, password, mock_mongo_db)
            
            assert result is not None
            assert result["email"] == email
            assert result["_id"] == mock_user["_id"]
    
    @pytest.mark.asyncio
    async def test_authenticate_user_wrong_password(self):
        """Test authentication fails with wrong password."""
        email = "test@example.com"
        correct_password = "correct_password"
        wrong_password = "wrong_password"
        hashed_password = CryptContext(schemes=["bcrypt"], deprecated="auto").hash(correct_password)
        
        mock_user = {
            "_id": ObjectId(),
            "email": email,
            "hashed_password": hashed_password,
            "role": "user"
        }
        
        async def mock_find_one(*args, **kwargs):
            return mock_user
        
        class MockCollection:
            def __init__(self):
                self.find_one = mock_find_one
        
        mock_collection = MockCollection()
        mock_mongo_db = MagicMock()
        
        def get_collection_side_effect(db, name):
            return mock_collection
        
        with patch("app.services.auth._get_collection", side_effect=get_collection_side_effect):
            result = await authenticate_user(email, wrong_password, mock_mongo_db)
            
            assert result is None
    
    @pytest.mark.asyncio
    async def test_authenticate_user_not_found(self):
        """Test authentication fails when user doesn't exist."""
        email = "nonexistent@example.com"
        password = "any_password"
        
        async def mock_find_one(*args, **kwargs):
            return None
        
        class MockCollection:
            def __init__(self):
                self.find_one = mock_find_one
        
        mock_collection = MockCollection()
        mock_mongo_db = MagicMock()
        
        def get_collection_side_effect(db, name):
            return mock_collection
        
        with patch("app.services.auth._get_collection", side_effect=get_collection_side_effect):
            result = await authenticate_user(email, password, mock_mongo_db)
            
            assert result is None


class TestCreateAccessToken:
    """Unit tests for create_access_token function."""
    
    def test_create_access_token_success(self):
        """Test successful access token creation."""
        test_secret = "test-secret-key"
        data = {"sub": "user123", "role": "user"}
        
        with patch.dict(os.environ, {"JWT_SECRET": test_secret}):
            token = create_access_token(data)
            
            assert token is not None
            assert isinstance(token, str)
            
            # Decode and verify token
            decoded = jwt.decode(token, test_secret, algorithms=[ALGORITHM])
            assert decoded["sub"] == "user123"
            assert decoded["role"] == "user"
            assert "exp" in decoded
    
    def test_create_access_token_expiration(self):
        """Test that access token has correct expiration time."""
        import time
        test_secret = "test-secret-key"
        data = {"sub": "user123"}
        
        with patch.dict(os.environ, {"JWT_SECRET": test_secret}):
            current_time = int(time.time())
            token = create_access_token(data)
            
            decoded = jwt.decode(token, test_secret, algorithms=[ALGORITHM])
            expected_exp = current_time + (ACCESS_TOKEN_EXPIRE_MINUTES * 60)
            
            assert abs(decoded["exp"] - expected_exp) <= 2


class TestCreateRefreshToken:
    """Unit tests for create_refresh_token function."""
    
    def test_create_refresh_token_success(self):
        """Test successful refresh token creation."""
        test_secret = "test-secret-key"
        data = {"sub": "user123", "role": "user"}
        
        with patch.dict(os.environ, {"JWT_SECRET": test_secret}):
            token = create_refresh_token(data)
            
            assert token is not None
            assert isinstance(token, str)
            
            decoded = jwt.decode(token, test_secret, algorithms=[ALGORITHM])
            assert decoded["sub"] == "user123"
            assert decoded["role"] == "user"
            assert decoded["type"] == "refresh"
            assert "exp" in decoded
    
    def test_create_refresh_token_expiration(self):
        """Test that refresh token has correct expiration time."""
        test_secret = "test-secret-key"
        data = {"sub": "user123"}
        
        with patch.dict(os.environ, {"JWT_SECRET": test_secret}):
            current_time = int(time.time())
            token = create_refresh_token(data)
            
            decoded = jwt.decode(token, test_secret, algorithms=[ALGORITHM])
            expected_exp = current_time + (REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60)
            
            assert abs(decoded["exp"] - expected_exp) <= 2
    
    def test_create_refresh_token_has_type(self):
        """Test that refresh token includes type field."""
        test_secret = "test-secret-key"
        data = {"sub": "user123"}
        
        with patch.dict(os.environ, {"JWT_SECRET": test_secret}):
            token = create_refresh_token(data)
            decoded = jwt.decode(token, test_secret, algorithms=[ALGORITHM])
            
            assert decoded["type"] == "refresh"

