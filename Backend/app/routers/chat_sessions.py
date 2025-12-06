from typing import Dict, Any
from pymongo.database import Database
from fastapi import APIRouter, HTTPException, status, Depends, Query
from typing import Optional

from app.dependencies import get_mongo_db, get_current_user
from app.db.chat_db import (
    get_chat_session_by_id,
    get_chat_sessions,
    delete_chat_session,
    get_messages_for_session
)
from app.model.chat_session import (
    ChatSessionWithMessages
)

router = APIRouter(
    prefix="/api/chat/sessions",
    tags=["chat_sessions"],
    responses={404: {"description": "Not found"}},
)


@router.get("/", response_model=Dict[str, Any])
async def list_sessions(
    page: int = Query(1, ge=1, description="Page number (starts at 1)"),
    limit: int = Query(20, ge=1, le=100, description="Number of results per page (1-100)"),
    current_user = Depends(get_current_user),
    mongo_db: Database = Depends(get_mongo_db),
):
    """
    List chat sessions with pagination.
    """
    user_id = current_user["id"]
    
    try:
        result = await get_chat_sessions(
            page=page, limit=limit, user_id=user_id, mongo_db=mongo_db
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving sessions: {str(e)}",
        )

@router.get("/{session_id}/messages/paginated", response_model=Dict[str, Any])
async def get_session_messages_paginated(
    session_id: str,
    limit: int = Query(50, ge=1, le=200, description="Number of messages to return"),
    before: Optional[str] = Query(None, description="Get messages before this messageId"),
    after: Optional[str] = Query(None, description="Get messages after this messageId"),
    current_user: dict = Depends(get_current_user),
    mongo_db: Database = Depends(get_mongo_db),
):
    """
    Get paginated messages for a chat session using cursor-based pagination.    
    Usage:
    - Initial load: No parameters (gets most recent messages)
    - Load older: Provide `before` with the oldest messageId you have
    - Load newer: Provide `after` with the newest messageId you have
    """
    session = await get_chat_session_by_id(session_id, mongo_db=mongo_db)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session with ID {session_id} not found",
        )

    if session.get("userId") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    collection = mongo_db["chat_messages"]
    query = {"sessionId": session_id}
    
    # Cursor-based pagination logic
    if before:
        before_message = await collection.find_one(
            {"sessionId": session_id, "messageId": before},
            {"createdAt": 1}
        )
        
        if before_message:
            query["createdAt"] = {"$lt": before_message["createdAt"]}
        
        # Default sort for "before": newest of the older messages first
        sort_direction = -1
        
    elif after:  
        after_message = await collection.find_one(
            {"sessionId": session_id, "messageId": after},
            {"createdAt": 1}
        )
        if after_message:
            query["createdAt"] = {"$gt": after_message["createdAt"]}
            # For "after" cursor, we want chronological order (oldest first)
            sort_direction = 1
        else:
            sort_direction = -1
    else:
        # Default: newest messages first (for initial load)
        sort_direction = -1
    
    cursor = collection.find(
        query,
        {"_id": 0}  # Exclude MongoDB _id
    ).sort("createdAt", sort_direction).limit(limit)
    
    messages = await cursor.to_list(length=limit)
    
    # Calculate pagination metadata
    total_count = await collection.count_documents({"sessionId": session_id})
    
    if messages:
        oldest_message = min(messages, key=lambda x: x["createdAt"])
        newest_message = max(messages, key=lambda x: x["createdAt"])
        
        older_messages_count = await collection.count_documents({
            "sessionId": session_id,
            "createdAt": {"$lt": oldest_message["createdAt"]}
        })
        
        newer_messages_count = await collection.count_documents({
            "sessionId": session_id,
            "createdAt": {"$gt": newest_message["createdAt"]}
        })
    else:
        older_messages_count = 0
        newer_messages_count = 0
    
    return {
        "messages": messages,
        "pagination": {
            "limit": limit,
            "total": total_count,
            "hasOlder": older_messages_count > 0,
            "hasNewer": newer_messages_count > 0,
            "cursors": {
                "newest": messages[0]["messageId"] if messages else None,
                "oldest": messages[-1]["messageId"] if messages else None
            }
        }
    }     
@router.get("/{session_id}", response_model=ChatSessionWithMessages)
async def get_session(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    mongo_db: Database = Depends(get_mongo_db),
):
    """
    Get a chat session with messages by its ID.
    """
    session = await get_chat_session_by_id(session_id, mongo_db=mongo_db)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session with ID {session_id} not found",
        )

    if session.get("userId") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
        
    messages = await get_messages_for_session(session_id, mongo_db=mongo_db)
    session["messages"] = messages
    return session

@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: str,
    mongo_db: Database = Depends(get_mongo_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Delete a chat session by its ID.
    """
    existing_session = await get_chat_session_by_id(session_id, mongo_db=mongo_db)
    if not existing_session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session with ID {session_id} not found",
        )

    if existing_session.get("userId") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    try:
        deleted_count = await delete_chat_session(session_id, mongo_db=mongo_db)
        if deleted_count == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete session",
            )
        return None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting session: {str(e)}",
        )
