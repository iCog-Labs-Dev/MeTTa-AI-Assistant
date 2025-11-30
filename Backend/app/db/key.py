from loguru import logger
from typing import Optional, List, Dict
from pymongo.database import Database
from bson import ObjectId
from app.model.key import KeyModel
from app.db.db import _get_collection

async def insert_encrypted_key(key_data: dict, mongo_db: Database = None) -> Optional[str]:
    """
    Insert/update an encrypted API key with salt.
    
    Args:
        key_data: Dictionary containing encrypted_api_key, provider_name, userid, and salt
        mongo_db: MongoDB database instance
    
    Returns:
        str: The ID of the inserted key, or None if failed
    """
    collection = _get_collection(mongo_db, "keys")
    try:
        key = KeyModel(**key_data)
    except Exception as e:
        logger.error("Validation error: {}", e)
        return None

    try:
        result = await collection.insert_one(key.model_dump())
        return str(result.inserted_id)
    except Exception as e:
        logger.error("Insert error: {}", e)
        return None

async def get_encrypted_key(provider_name: str, userid: str, mongo_db: Database = None) -> Optional[Dict[str, str]]:
    """
    Retrieve encrypted API key and salt by provider_name and userid.
    NOTE: This might be ambiguous if there are multiple keys for the same provider.
    It returns the first one found.
    
    Args:
        provider_name: LLM provider name (e.g., 'gemini', 'openai')
        userid: User ID
        mongo_db: MongoDB database instance
    
    Returns:
        Dict with 'encrypted_api_key' and 'salt', or None if not found
    """
    collection = _get_collection(mongo_db, "keys")
    document = await collection.find_one({"provider_name": provider_name, "userid": userid})
    if document:
        return {
            "encrypted_api_key": document.get("encrypted_api_key"),
            "salt": document.get("salt")
        }
    return None

async def get_all_encrypted_keys(userid: str, mongo_db: Database = None) -> List[Dict[str, str]]:
    """
    Retrieve all encrypted API keys for a user.
    
    Args:
        userid: User ID
        mongo_db: MongoDB database instance
    
    Returns:
        List of dicts containing id, provider_name, encrypted_api_key, and salt
    """
    collection = _get_collection(mongo_db, "keys")
    cursor = collection.find({"userid": userid})
    keys: List[Dict[str, str]] = []
    async for doc in cursor:
        keys.append({
            "id": str(doc["_id"]),
            "provider_name": doc.get("provider_name"),
            "encrypted_api_key": doc.get("encrypted_api_key"),
            "salt": doc.get("salt")
        })
    return keys

async def get_api_provider(userid: str, mongo_db: Database) -> List[Dict[str, str]]:
    """
    Retrieve a list of API keys associated with a given user ID.
    
    Args:
        userid: User ID
        mongo_db: MongoDB database instance
    
    Returns:
        List of dicts containing id, provider_name, and key_name
    """
    collection = _get_collection(mongo_db, "keys")
    cursor = collection.find({"userid": userid}, {"provider_name": 1, "key_name": 1, "_id": 1})
    keys: List[Dict[str, str]] = []
    async for doc in cursor:
        keys.append({
            "id": str(doc["_id"]),
            "provider_name": doc.get("provider_name"),
            "key_name": doc.get("key_name")
        })
    return keys

async def get_user_salt(userid: str, mongo_db: Database = None) -> Optional[str]:
    """
    Retrieve the salt for a user (from any of their keys).
    All keys for a user share the same salt.
    
    Args:
        userid: User ID
        mongo_db: MongoDB database instance
    
    Returns:
        Base64-encoded salt, or None if user has no keys
    """
    collection = _get_collection(mongo_db, "keys")
    document = await collection.find_one({"userid": userid})
    if document:
        return document.get("salt")
    return None

async def delete_api_key(userid: str, key_id: str, mongo_db: Database = None) -> bool:
    """
    Delete encrypted API key by its unique ID.
    
    Args:
        userid: User ID
        key_id: The unique ID of the key to delete
        mongo_db: MongoDB database instance
    
    Returns:
        bool: True if deleted, False otherwise
    """
    collection = _get_collection(mongo_db, "keys")
    try:
        result = await collection.delete_one({"_id": ObjectId(key_id), "userid": userid})
        return result.deleted_count > 0
    except Exception as e:
        logger.error(f"Error deleting key {key_id}: {e}")
        return False