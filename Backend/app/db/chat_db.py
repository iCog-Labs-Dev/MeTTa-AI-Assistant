from typing import Optional, List
from bson import ObjectId
from pymongo.database import Database
from loguru import logger
from pymongo.errors import PyMongoError
import math
from datetime import datetime, timezone

from app.model.chat_message import ChatMessageSchema
from app.model.chat_session import ChatSessionSchema, ChatSessionWithMessages
from app.db.db import _get_collection




# ----------------------------------
# CHAT MESSAGES CRUD
# ----------------------------------
async def insert_chat_message(
    msg_data: dict, mongo_db: Database = None
) -> Optional[str]:
    """
    Insert a single chat message into the 'chat_messages' collection.
    Generates messageId/createdAt if missing. Returns messageId.
    """
    collection = _get_collection(mongo_db, "chat_messages")
    try:
        if "messageId" not in msg_data or not msg_data.get("messageId"):
            msg_data["messageId"] = str(ObjectId())
        if "createdAt" not in msg_data or msg_data.get("createdAt") is None:
            msg_data["createdAt"] = datetime.now(timezone.utc)
        chat_msg = ChatMessageSchema(**msg_data)
    except Exception as e:
        logger.error("Validation error:", e)
        return None

    await collection.insert_one(chat_msg.model_dump())
    return chat_msg.messageId


async def get_last_messages(
    session_id: str,
    limit: int = 5,
    mongo_db: Database = None,
) -> List[dict]:
    """
    Return the last `limit` messages for a session ordered chronologically (oldest -> newest).
    """
    collection = _get_collection(mongo_db, "chat_messages")
    cursor = (
        collection.find({"sessionId": session_id}).sort("createdAt", -1).limit(limit)
    )
    recent = [doc async for doc in cursor]
    recent.reverse()
    return recent



# ----------------------------------
# CHAT SESSIONS CRUD
# ----------------------------------
async def create_chat_session(user_id: str, mongo_db: Database = None) -> str:
    """
    Create a new chat session and return its sessionId.
    """
    collection = _get_collection(mongo_db, "chat_sessions")
    sid = str(ObjectId())
    doc = ChatSessionSchema(
        sessionId=sid, createdAt=datetime.now(timezone.utc), userId=user_id
    ).model_dump()
    await collection.insert_one(doc)
    return sid


async def delete_chat_session(session_id: str, mongo_db: Database = None) -> int:
    """
    Delete a chat session document. Returns number of documents deleted (0 or 1).
    """
    collection = _get_collection(mongo_db, "chat_sessions")
    result = await collection.delete_one({"sessionId": session_id})
    return result.deleted_count


async def get_chat_session_by_id(session_id: str, mongo_db: Database = None) -> dict | None:
    """
    Retrieve a chat session by its sessionId.
    Returns the session document or None if not found.
    """
    collection = _get_collection(mongo_db, "chat_sessions")
    return await collection.find_one({"sessionId": session_id}, {"_id": 0})


async def get_chat_sessions(
    user_id: str,
    page: int = 1,
    limit: int = 20,
    mongo_db: Database = None,
) -> dict:
    """
    Retrieve paginated chat sessions for a specific user.
    Returns sessions list and pagination metadata.
    """
    if not user_id:
        raise ValueError("user_id is required to fetch chat sessions")

    if page < 1 or limit < 1:
        raise ValueError("page and limit must be positive integers")

    collection = _get_collection(mongo_db, "chat_sessions")
    filter_query = {"userId": user_id}

    try:
        total = await collection.count_documents(filter_query)
    except PyMongoError as e:
        logger.error(f"Failed to count chat sessions: {e}")
        return {"sessions": [], "error": "database_error"}

    total_pages = math.ceil(total / limit)
    skip = (page - 1) * limit

    if skip >= total:
        return {
            "sessions": [],
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": total_pages,
            "has_next": False,
            "has_prev": page > 1,
        }

    try:
        cursor = (
            collection.find(filter_query, {"_id": 0})
            .sort("createdAt", -1)
            .skip(skip)
            .limit(limit)
        )
        sessions = [doc async for doc in cursor]

        for s in sessions:
            if "createdAt" in s and isinstance(s["createdAt"], datetime):
                s["createdAt"] = s["createdAt"].isoformat()

    except PyMongoError as e:
        logger.error(f"Failed to fetch chat sessions: {e}")
        return {"sessions": [], "error": "database_error"}

    return {
        "sessions": sessions,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
        "has_next": page < total_pages,
        "has_prev": page > 1,
    }

async def get_messages_for_session(
    session_id: str,
    mongo_db: Database = None,
    limit: Optional[int] = None,
) -> List[dict]:
    """
    Return chat messages for a session ordered oldest → newest.
    """
    collection = _get_collection(mongo_db, "chat_messages")
    cursor = (
        collection.find({"sessionId": session_id}, {"_id": 0})
        .sort("createdAt", 1)
    )
    if limit is not None:
        cursor = cursor.limit(limit)

    return [ChatMessageSchema(**doc).model_dump() async for doc in cursor]