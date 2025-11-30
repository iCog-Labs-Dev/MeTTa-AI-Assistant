from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from cryptography.fernet import Fernet, InvalidToken
import os
import base64
import hashlib
from loguru import logger

PBKDF2_ITERATIONS = 600_000

def generate_salt() -> bytes:
    """
    Generate a random 16-byte salt for key derivation.
    
    Returns:
        16 bytes of random data
    """
    return os.urandom(16)


def derive_key_from_password(password: str, salt: bytes) -> bytes:
    """
    Derive a Fernet-compatible encryption key from a password using PBKDF2.
    
    Args:
        password: User's password
        salt: 16-byte salt
    
    Returns:
        32-byte key suitable for Fernet encryption
    """
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,  # 256 bits
        salt=salt,
        iterations=PBKDF2_ITERATIONS,
    )
    key = kdf.derive(password.encode('utf-8'))
    return base64.urlsafe_b64encode(key)


def encrypt_with_password(data: str, password: str, salt: bytes) -> str:
    """
    Encrypt data using a password-derived key.
    
    Args:
        data: Plaintext data to encrypt
        password: User's password
        salt: Salt for key derivation
    
    Returns:
        Base64-encoded encrypted data
    """
    key = derive_key_from_password(password, salt)
    f = Fernet(key)
    encrypted = f.encrypt(data.encode('utf-8'))
    return base64.b64encode(encrypted).decode('utf-8')


def decrypt_with_password(encrypted_data: str, password: str, salt: bytes) -> str:
    """
    Decrypt data using a password-derived key.
    
    Args:
        encrypted_data: Base64-encoded encrypted data
        password: User's password
        salt: Salt used for key derivation
    
    Returns:
        Decrypted plaintext data
    
    Raises:
        InvalidToken: If decryption fails (wrong password or corrupted data)
    """
    key = derive_key_from_password(password, salt)
    f = Fernet(key)
    encrypted_bytes = base64.b64decode(encrypted_data.encode('utf-8'))
    decrypted = f.decrypt(encrypted_bytes)
    return decrypted.decode('utf-8')


def verify_password_can_decrypt(encrypted_data: str, password: str, salt: bytes) -> bool:
    """
    Verify that a password can decrypt the given data.
    
    Args:
        encrypted_data: Base64-encoded encrypted data
        password: Password to test
        salt: Salt used for key derivation
    
    Returns:
        True if password can decrypt the data, False otherwise
    """
    try:
        decrypt_with_password(encrypted_data, password, salt)
        return True
    except InvalidToken:
        return False
    except Exception as e:
        logger.error(f"Unexpected error during password verification: {e}")
        return False


def derive_cookie_encryption_key(user_id: str, secret_key: str) -> bytes:
    """
    Derive a session-specific encryption key for cookies.
    
    This key is derived from the user ID and JWT secret, making it:
    - Unique per user
    - Tied to the server's secret
    - Deterministic (same key for same user across requests)
    
    Args:
        user_id: User's unique identifier
        secret_key: JWT secret key
    
    Returns:
        32-byte Fernet-compatible key
    """
    combined = f"{user_id}:{secret_key}".encode('utf-8')
    key_bytes = hashlib.sha256(combined).digest()
    return base64.urlsafe_b64encode(key_bytes)


def encrypt_cookie_value(value: str, user_id: str, secret_key: str) -> str:
    """
    Encrypt a cookie value with user-specific session key.
    
    Args:
        value: Plaintext value to encrypt (e.g., API key)
        user_id: User's unique identifier
        secret_key: JWT secret key
    
    Returns:
        Base64-encoded encrypted value
    """
    key = derive_cookie_encryption_key(user_id, secret_key)
    f = Fernet(key)
    encrypted = f.encrypt(value.encode('utf-8'))
    return base64.b64encode(encrypted).decode('utf-8')


def decrypt_cookie_value(encrypted_value: str, user_id: str, secret_key: str) -> str:
    """
    Decrypt a cookie value with user-specific session key.
    
    Args:
        encrypted_value: Base64-encoded encrypted value
        user_id: User's unique identifier
        secret_key: JWT secret key
    
    Returns:
        Decrypted plaintext value
    
    Raises:
        InvalidToken: If decryption fails
    """
    key = derive_cookie_encryption_key(user_id, secret_key)
    f = Fernet(key)
    encrypted_bytes = base64.b64decode(encrypted_value.encode('utf-8'))
    decrypted = f.decrypt(encrypted_bytes)
    return decrypted.decode('utf-8')
