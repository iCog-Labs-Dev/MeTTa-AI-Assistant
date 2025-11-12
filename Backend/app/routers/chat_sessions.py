from typing import Dict, Any
from pymongo.database import Database
from fastapi import APIRouter, HTTPException, status, Depends, Query

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


@router.get("/{session_id}", response_model=ChatSessionWithMessages)
async def get_session(
    session_id: str,
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
    messages = await get_messages_for_session(session_id, mongo_db=mongo_db)
    session["messages"] = messages
    return session

@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: str,
    mongo_db: Database = Depends(get_mongo_db),
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