"""
Unit tests for Key Management Service.
Tests individual methods in isolation.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from cryptography.fernet import Fernet

from app.services.key_management_service import KMS


class TestKMS:
    """Unit tests for KMS class methods."""
    
    @pytest.fixture
    def kek(self):
        """Generate a test KEK."""
        return Fernet.generate_key().decode()
    
    @pytest.fixture
    def kms(self, kek):
        """Create a KMS instance."""
        return KMS(kek)
    
    @pytest.fixture
    def mock_mongo_db(self):
        """Create a mock MongoDB database."""
        return MagicMock()
    
    @pytest.mark.asyncio
    async def test_encrypt_and_store_success(self, kms, mock_mongo_db):
        """Test successful encryption and storage of API key."""
        userid = "user123"
        provider_name = "openai"
        api_key = "sk-test123456"
        
        mock_collection = AsyncMock()
        mock_collection.update_one = AsyncMock()
        mock_mongo_db.__getitem__ = MagicMock(return_value=mock_collection)
        
        with patch("app.services.key_management_service.insert_dek", return_value=True):
            success, encrypted_api_key = await kms.encrypt_and_store(
                userid, provider_name, api_key, mock_mongo_db
            )
            
            assert success is True
            assert encrypted_api_key is not None
            assert isinstance(encrypted_api_key, str)
            assert encrypted_api_key != api_key
    
    @pytest.mark.asyncio
    async def test_encrypt_and_store_failure(self, kms, mock_mongo_db):
        """Test encryption and storage when database insert fails."""
        userid = "user123"
        provider_name = "openai"
        api_key = "sk-test123456"
        
        with patch("app.services.key_management_service.insert_dek", return_value=False):
            success, encrypted_api_key = await kms.encrypt_and_store(
                userid, provider_name, api_key, mock_mongo_db
            )
            
            assert success is False
            assert encrypted_api_key is not None  # Encryption still happens
    
    @pytest.mark.asyncio
    async def test_decrypt_api_key_success(self, kms, mock_mongo_db):
        """Test successful decryption of API key."""
        userid = "user123"
        provider_name = "openai"
        original_api_key = "sk-test123456"
        
        with patch("app.services.key_management_service.insert_dek", return_value=True):
            _, encrypted_api_key = await kms.encrypt_and_store(
                userid, provider_name, original_api_key, mock_mongo_db
            )
        
        
        DEK = Fernet.generate_key()
        fernet_dek = Fernet(DEK)
        encrypted_test_key = fernet_dek.encrypt(original_api_key.encode()).decode("utf-8")
        encrypted_dek = kms.f.encrypt(DEK).decode("utf-8")
        
        with patch("app.services.key_management_service.get_dek", return_value=encrypted_dek):
            decrypted = await kms.decrypt_api_key(
                encrypted_test_key, userid, provider_name, mock_mongo_db
            )
            
            assert decrypted == original_api_key
    
    @pytest.mark.asyncio
    async def test_decrypt_api_key_dek_not_found(self, kms, mock_mongo_db):
        """Test decryption fails when DEK is not found."""
        encrypted_api_key = "encrypted_key"
        userid = "user123"
        provider_name = "openai"
        
        with patch("app.services.key_management_service.get_dek", return_value=None):
            with pytest.raises(ValueError, match="DEK not found"):
                await kms.decrypt_api_key(
                    encrypted_api_key, userid, provider_name, mock_mongo_db
                )
    
    @pytest.mark.asyncio
    async def test_get_api_provider_success(self, kms, mock_mongo_db):
        """Test getting API providers for a user."""
        userid = "user123"
        providers = ["openai", "anthropic"]
        
        with patch("app.services.key_management_service.get_api_provider", return_value=providers):
            result = await kms.get_api_provider(userid, mock_mongo_db)
            
            assert result == providers
    
    @pytest.mark.asyncio
    async def test_get_api_provider_empty(self, kms, mock_mongo_db):
        """Test getting API providers when none exist."""
        userid = "user123"
        
        with patch("app.services.key_management_service.get_api_provider", return_value=None):
            result = await kms.get_api_provider(userid, mock_mongo_db)
            
            assert result == []
    
    @pytest.mark.asyncio
    async def test_delete_api_key_success(self, kms, mock_mongo_db):
        """Test successful deletion of API key."""
        userid = "user123"
        provider_name = "openai"
        
        with patch("app.services.key_management_service.delete_api_key", return_value=True):
            result = await kms.delete_api_key(userid, provider_name, mock_mongo_db)
            
            assert result is True
    
    @pytest.mark.asyncio
    async def test_delete_api_key_not_found(self, kms, mock_mongo_db):
        """Test deletion when key doesn't exist."""
        userid = "user123"
        provider_name = "openai"
        
        with patch("app.services.key_management_service.delete_api_key", return_value=False):
            result = await kms.delete_api_key(userid, provider_name, mock_mongo_db)
            
            assert result is False

