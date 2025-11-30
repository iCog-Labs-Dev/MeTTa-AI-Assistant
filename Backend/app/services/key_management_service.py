from typing import List, Dict
import base64
from pymongo.database import Database
from cryptography.fernet import InvalidToken
from app.db.key import (
    get_user_salt,
    insert_encrypted_key,
    get_encrypted_key,
    get_all_encrypted_keys,
    get_api_provider,
    delete_api_key
)
from app.core.security import (
    encrypt_with_password,
    decrypt_with_password,
    generate_salt,
    verify_password_can_decrypt
)
from app.services.auth import verify_password
from loguru import logger

class KMS:
    """
    Key Management Service using password-based encryption.
    
    API keys are encrypted with the user's login password using PBKDF2 key derivation.
    Each user has a unique salt stored for key derivation.
    """

    async def encrypt_and_store(
        self, 
        userid: str, 
        provider_name: str, 
        api_key: str, 
        password: str,
        mongo_db: Database,
        key_name: str = None
    ) -> tuple[bool, str]:
        """
        Encrypt and store an API key using the user's password.
        
        Args:
            userid: User ID
            provider_name: LLM provider name (e.g., 'gemini', 'openai')
            api_key: The plaintext API key to encrypt
            password: User's login password for encryption
            mongo_db: MongoDB database instance
            key_name: Optional custom name for the key
        
        Returns:
            Tuple of (success: bool, key_id: str or error_message: str)
        """
        try:
            # Get or generate salt for this user
            salt = await get_user_salt(userid, mongo_db)
            if salt is None:
                # First key for this user - generate new salt
                salt_bytes = generate_salt()
                salt = base64.b64encode(salt_bytes).decode('utf-8')
            else:
                # Decode existing salt
                salt_bytes = base64.b64decode(salt.encode('utf-8'))
            
            # Encrypt the API key with user's password
            encrypted_api_key = encrypt_with_password(api_key, password, salt_bytes)
            
            # Store in database
            key_dict = {
                "userid": userid,
                "provider_name": provider_name,
                "encrypted_api_key": encrypted_api_key,
                "salt": salt
            }
            
            if key_name:
                key_dict["key_name"] = key_name
            
            key_id = await insert_encrypted_key(key_dict, mongo_db)
            
            if key_id:
                logger.info(f"Successfully stored encrypted key for user {userid}, provider {provider_name}, id {key_id}")
                return True, key_id
            else:
                return False, "Failed to store encrypted key in database"
                
        except Exception as e:
            logger.error(f"Error encrypting and storing key: {e}")
            return False, str(e)

    async def decrypt_api_key(
        self, 
        userid: str, 
        provider_name: str, 
        password: str,
        mongo_db: Database
    ) -> tuple[str | None, str | None]:
        """
        Decrypt a stored API key using the user's password.
        
        Args:
            userid: User ID
            provider_name: LLM provider name
            password: User's login password for decryption
            mongo_db: MongoDB database instance
        
        Returns:
            Tuple of (decrypted_key: str or None, error_message: str or None)
        """
        try:
            # Get encrypted key and salt from database
            key_data = await get_encrypted_key(provider_name, userid, mongo_db)
            if key_data is None:
                return None, f"No key found for provider {provider_name}"
            
            encrypted_api_key = key_data["encrypted_api_key"]
            salt = base64.b64decode(key_data["salt"].encode('utf-8'))
            
            # Decrypt using password
            decrypted_key = decrypt_with_password(encrypted_api_key, password, salt)
            
            logger.info(f"Successfully decrypted key for user {userid}, provider {provider_name}")
            return decrypted_key, None
            
        except InvalidToken:
            logger.error(f"Failed to decrypt key - invalid password for user {userid}")
            return None, "Invalid password or corrupted key data"
        except Exception as e:
            logger.error(f"Error decrypting key: {e}")
            return None, str(e)

    async def decrypt_all_keys(
        self,
        userid: str,
        password: str,
        mongo_db: Database
    ) -> List[Dict[str, str]]:
        """
        Decrypt all API keys for a user (used during login).
        
        Args:
            userid: User ID
            password: User's login password
            mongo_db: MongoDB database instance
        
        Returns:
            List of dicts with 'key_id', 'provider_name', and 'api_key'
        """
        decrypted_keys = []
        
        try:
            # Get all encrypted keys for user
            all_keys = await get_all_encrypted_keys(userid, mongo_db)
            
            if not all_keys:
                logger.info(f"No keys found for user {userid}")
                return decrypted_keys
            
            # Decrypt each key
            for key_data in all_keys:
                key_id = key_data["id"]
                provider_name = key_data["provider_name"]
                encrypted_api_key = key_data["encrypted_api_key"]
                salt = base64.b64decode(key_data["salt"].encode('utf-8'))
                
                try:
                    decrypted_key = decrypt_with_password(encrypted_api_key, password, salt)
                    decrypted_keys.append({
                        "key_id": key_id,
                        "provider_name": provider_name,
                        "api_key": decrypted_key
                    })
                except InvalidToken:
                    logger.error(f"Failed to decrypt key {key_id} for provider {provider_name}")
                    # Continue with other keys
                    continue
            
            logger.info(f"Decrypted {len(decrypted_keys)} keys for user {userid}")
            return decrypted_keys
            
        except Exception as e:
            logger.error(f"Error decrypting all keys: {e}")
            return decrypted_keys

    async def verify_user_password(
        self,
        userid: str,
        password: str,
        mongo_db: Database
    ) -> bool:
        """
        Verify user's password by attempting to decrypt one of their keys.
        
        Args:
            userid: User ID
            password: Password to verify
            mongo_db: MongoDB database instance
        
        Returns:
            bool: True if password is correct, False otherwise
        """
        try:
            # Get any key for this user
            all_keys = await get_all_encrypted_keys(userid, mongo_db)
            
            if not all_keys:
                # No keys stored - verify against user's hashed password instead
                return await verify_password(userid, password, mongo_db)
            
            # Try to decrypt the first key
            key_data = all_keys[0]
            encrypted_api_key = key_data["encrypted_api_key"]
            salt = base64.b64decode(key_data["salt"].encode('utf-8'))
            
            return verify_password_can_decrypt(encrypted_api_key, password, salt)
            
        except Exception as e:
            logger.error(f"Error verifying password: {e}")
            return False

    async def get_api_provider(self, userid: str, mongo_db: Database) -> List[Dict[str, str]]:
        """Retrieve all stored API providers for the current user."""
        services = await get_api_provider(userid, mongo_db)
        return services if services else []

    async def delete_api_key(self, userid: str, key_id: str, mongo_db: Database) -> bool:
        """Delete a stored API key by ID."""
        return await delete_api_key(userid, key_id, mongo_db)
