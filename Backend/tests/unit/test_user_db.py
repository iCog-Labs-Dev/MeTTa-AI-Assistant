"""
Unit tests for user database functions.
Tests individual functions in isolation.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from bson import ObjectId
from passlib.context import CryptContext

from app.db.users import create_user, UserCreate, UserRole


class TestCreateUser:
    """Unit tests for create_user function."""
    
    @pytest.mark.asyncio
    async def test_create_user_success(self):
        """Test successful user creation."""
        
        user_data = UserCreate(
            email="newuser@example.com",
            password="securepassword123",
            role=UserRole.USER
        )
        
        mock_collection = AsyncMock()
        mock_collection.find_one = AsyncMock(return_value=None)
        inserted_id = ObjectId()
        mock_collection.insert_one = AsyncMock(
            return_value=MagicMock(inserted_id=inserted_id)
        )
        mock_mongo_db = MagicMock()
        
        with patch("app.db.users._get_collection", return_value=mock_collection):
            result = await create_user(user_data, mock_mongo_db)
            
            assert result == inserted_id
            mock_collection.find_one.assert_called_once_with({"email": user_data.email})
            mock_collection.insert_one.assert_called_once()
            
            # Verify password was hashed
            call_args = mock_collection.insert_one.call_args[0][0]
            assert "password" not in call_args
            assert "hashed_password" in call_args
            assert call_args["email"] == user_data.email
            assert call_args["role"] == "user"
    
    @pytest.mark.asyncio
    async def test_create_user_duplicate_email(self):
        """Test user creation fails with duplicate email."""
        existing_user = {
            "_id": ObjectId(),
            "email": "existing@example.com",
            "hashed_password": "hashed",
            "role": "user"
        }
        
        user_data = UserCreate(
            email="existing@example.com",
            password="password123"
        )
        
        mock_collection = AsyncMock()
        mock_collection.find_one = AsyncMock(return_value=existing_user)
        mock_mongo_db = MagicMock()
        
        with patch("app.db.users._get_collection", return_value=mock_collection):
            with pytest.raises(ValueError, match="Email.*already registered"):
                await create_user(user_data, mock_mongo_db)
            
            mock_collection.insert_one.assert_not_called()
    
    
    @pytest.mark.asyncio
    async def test_create_user_admin_role(self):
        """Test user creation with admin role."""
        user_data = UserCreate(
            email="admin@example.com",
            password="adminpassword123",
            role=UserRole.ADMIN
        )
        
        mock_collection = AsyncMock()
        mock_collection.find_one = AsyncMock(return_value=None)
        inserted_id = ObjectId()
        mock_collection.insert_one = AsyncMock(
            return_value=MagicMock(inserted_id=inserted_id)
        )
        mock_mongo_db = MagicMock()
        
        with patch("app.db.users._get_collection", return_value=mock_collection):
            await create_user(user_data, mock_mongo_db)
            
            call_args = mock_collection.insert_one.call_args[0][0]
            assert call_args["role"] == "admin"
    
    @pytest.mark.asyncio
    async def test_create_user_password_stripped(self):
        """Test that password is stripped before hashing."""
        user_data = UserCreate(
            email="user@example.com",
            password="  password_with_spaces  ",
            role=UserRole.USER
        )
        
        mock_collection = AsyncMock()
        mock_collection.find_one = AsyncMock(return_value=None)
        inserted_id = ObjectId()
        mock_collection.insert_one = AsyncMock(
            return_value=MagicMock(inserted_id=inserted_id)
        )
        mock_mongo_db = MagicMock()
        
        with patch("app.db.users._get_collection", return_value=mock_collection):
            await create_user(user_data, mock_mongo_db)
            
            call_args = mock_collection.insert_one.call_args[0][0]
            hashed = call_args["hashed_password"]
            
            pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
            assert pwd_context.verify("password_with_spaces", hashed)
           
            # Should not verify with original password with spaces
            assert not pwd_context.verify("  password_with_spaces  ", hashed)
    
    @pytest.mark.asyncio
    async def test_create_user_no_database(self):
        """Test that missing database raises RuntimeError."""
        user_data = UserCreate(
            email="user@example.com",
            password="password123"
        )
        
        with pytest.raises(RuntimeError, match="Database connection not initialized"):
            await create_user(user_data, None)

