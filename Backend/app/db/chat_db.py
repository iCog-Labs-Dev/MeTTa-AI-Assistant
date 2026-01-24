from typing import Optional, List, Tuple
from bson import ObjectId
from pymongo.database import Database
from pymongo.errors import PyMongoError
import math
from datetime import datetime, timezone

from app.core.logging import logger
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
        logger.error("Validation error: %s", e)
        return None

    await collection.insert_one(chat_msg.model_dump())
    return chat_msg.messageId


async def get_last_messages(
    session_id: str,
    limit: int = 10,
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


async def update_chat_session_title(
    session_id: str, title: str, mongo_db: Database = None
) -> bool:
    """
    Update the title of a chat session.
    """
    collection = _get_collection(mongo_db, "chat_sessions")
    result = await collection.update_one(
        {"sessionId": session_id}, {"$set": {"title": title}}
    )
    return result.modified_count > 0


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
        logger.error("Failed to count chat sessions: %s", e)
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
        logger.error("Failed to fetch chat sessions: %s", e)
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


def _encode_msg_cursor(dt: datetime, mid: str) -> str:
    return f"{dt.isoformat()}|{mid}"


def _decode_msg_cursor(cursor: str) -> Tuple[datetime, str]:
    if "|" not in cursor:
        raise ValueError("Invalid cursor format")
    dt_str, mid = cursor.split("|", 1)
    return datetime.fromisoformat(dt_str), mid


async def get_messages_cursor(
    session_id: str,
    limit: int = 10,
    cursor: Optional[str] = None,
    mongo_db: Database = None,
) -> dict:
    if limit < 1:
        raise ValueError("limit must be a positive integer")

    collection = _get_collection(mongo_db, "chat_messages")
    filter_query = {"sessionId": session_id}

    if cursor:
        cursor_created_at, cursor_message_id = _decode_msg_cursor(cursor)
        filter_query.update(
            {
                "$or": [
                    {"createdAt": {"$lt": cursor_created_at}},
                    {"createdAt": cursor_created_at, "messageId": {"$lt": cursor_message_id}},
                ]
            }
        )

    message_cursor = (
        collection.find(filter_query, {"_id": 0})
        .sort([("createdAt", -1), ("messageId", -1)])
        .limit(limit + 1)
    )

    docs = [ChatMessageSchema(**doc).model_dump() async for doc in message_cursor]

    has_next = len(docs) > limit
    page_desc = docs[:limit]
    messages = list(reversed(page_desc))

    next_cursor = None
    if has_next:
        pivot = docs[limit - 1]
        next_cursor = _encode_msg_cursor(pivot["createdAt"], pivot["messageId"])

    return {
        "messages": messages,
        "limit": limit,
        "nextCursor": next_cursor,
        "hasNext": has_next,
    }


async def get_first_user_message(
    session_id: str,
    mongo_db: Database = None,
) -> Optional[dict]:
    collection = _get_collection(mongo_db, "chat_messages")
    cursor = (
        collection.find(
            {"sessionId": session_id, "role": "user"},
            {"_id": 0, "messageId": 1, "content": 1, "createdAt": 1},
        )
        .sort("createdAt", 1)
        .limit(1)
    )
    docs = [doc async for doc in cursor]
    if not docs:
        return None
    doc = docs[0]
    if "createdAt" in doc and isinstance(doc["createdAt"], datetime):
        doc["createdAt"] = doc["createdAt"].isoformat()
    return doc