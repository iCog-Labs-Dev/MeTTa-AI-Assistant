from fastapi import APIRouter, HTTPException, status, Depends
from typing import Optional, Dict, Any
from pydantic import BaseModel
from pymongo.database import Database
from bson import ObjectId
from loguru import logger

from app.model.feedback import FeedbackSentiment
from app.db import db
from app.dependencies import get_mongo_db, get_current_user

router = APIRouter(
    prefix="/api/feedback",
    tags=["feedback"],
)


class SubmitFeedbackRequest(BaseModel):
    """Request model for feedback submission"""
    responseId: str
    sessionId: str
    sentiment: FeedbackSentiment
    comment: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "responseId": "resp_123",
                "sessionId": "sess_456",
                "sentiment": "positive",
                "comment": "Very helpful!"
            }
        }


@router.post("/submit", status_code=status.HTTP_201_CREATED)
async def submit_feedback(
    request: SubmitFeedbackRequest,
    mongo_db: Database = Depends(get_mongo_db),
    current_user: dict = Depends(get_current_user),
):
    """Submit feedback for a response"""
    try:
        feedback_id = f"fb_{ObjectId()}"
        feedback_data = {
            "feedbackId": feedback_id,
            "responseId": request.responseId,
            "sessionId": request.sessionId,
            "userId": current_user.get("id"),
            "sentiment": request.sentiment,
            "comment": request.comment,
        }
        
        result = await db.insert_feedback(feedback_data, mongo_db)
        if not result:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save feedback"
            )
        
        logger.info(f"Feedback {feedback_id} submitted by {current_user.get('userId')}")
        return {
            "feedbackId": feedback_id,
            "message": "Feedback submitted successfully",
            "status": "success"
        }
    except Exception as e:
        logger.error(f"Error submitting feedback: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/response/{response_id}")
async def get_feedback_for_response(
    response_id: str,
    mongo_db: Database = Depends(get_mongo_db),
    current_user: dict = Depends(get_current_user),
):
    """Get all feedback for a response"""
    try:
        feedbacks = await db.get_feedback_by_response(response_id, mongo_db)
        return {
            "responseId": response_id,
            "feedbacks": feedbacks,
            "total": len(feedbacks)
        }
    except Exception as e:
        logger.error(f"Error retrieving feedback: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/stats")
async def get_stats(
    mongo_db: Database = Depends(get_mongo_db),
    current_user: dict = Depends(get_current_user),
):
    """Get feedback statistics"""
    try:
        stats = await db.get_feedback_stats(mongo_db)
        return {
            "status": "success",
            "statistics": stats
        }
    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
