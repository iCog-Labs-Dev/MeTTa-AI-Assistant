from pydantic import BaseModel
from typing import Optional

class KeyModel(BaseModel):
    """
    Model for storing encrypted API keys in MongoDB.
    
    The API key is encrypted using the user's password with PBKDF2 key derivation.
    Each user has a unique salt stored for key derivation.
    """
    encrypted_api_key: str
    provider_name: str
    userid: str
    salt: str
    key_name: Optional[str] = None

class APIKeyIn(BaseModel):
    """Request model for storing an API key."""
    api_key: str
    provider_name: str
    password: str
    key_name: Optional[str] = None