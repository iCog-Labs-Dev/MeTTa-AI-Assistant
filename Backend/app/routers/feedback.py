from typing import Optional, List
from loguru import logger
from fastapi import APIRouter, HTTPException, Depends, status, Query
from pydantic import BaseModel, Field

from app.dependencies import get_current_user, get_feedback_service
from app.services.feedback_service import FeedbackService
from app.model.feedback import FeedbackSchema, FeedbackStatsSchema


# ============================================================================
# CONFIGURATION
# ============================================================================
MAX_COMMENT_LENGTH = 300
FEEDBACK_RATING_GOOD = "good_response"
FEEDBACK_RATING_BAD = "bad_response"
ALLOWED_RATINGS = {FEEDBACK_RATING_GOOD, FEEDBACK_RATING_BAD}


router = APIRouter(
    prefix="/api/feedback",
    tags=["feedback"],
    responses={
        200: {"description": "Success"},
        201: {"description": "Created"},
        400: {"description": "Bad request"},
        401: {"description": "Unauthorized"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)


# Request/Response Schemas
class FeedbackSubmitRequest(BaseModel):
    """Request schema for feedback submission via JSON body."""
    responseId: str = Field(..., min_length=1, description="ID of the response being rated")
    sessionId: str = Field(..., min_length=1, description="ID of the chat session")
    rating: str = Field(
        ..., 
        description=f"Binary rating: {FEEDBACK_RATING_GOOD} or {FEEDBACK_RATING_BAD}"
    )
    comment: Optional[str] = Field(
        None, 
        max_length=MAX_COMMENT_LENGTH,
        description=f"Optional user comment (max {MAX_COMMENT_LENGTH} chars)"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "responseId": "resp-12345",
                "sessionId": "sess-abc123",
                "rating": FEEDBACK_RATING_GOOD,
                "comment": "Clear and helpful response!",
            }
        }


class FeedbackResponse(BaseModel):
    """Standard response schema for feedback operations."""
    status: str = Field(..., description="Operation status: 'success' or 'error'")
    feedbackId: Optional[str] = Field(
        None, description="ID of the created feedback record"
    )
    message: str = Field(..., description="Human-readable message")
    
    class Config:
        json_schema_extra = {
            "example": {
                "status": "success",
                "feedbackId": "507f1f77bcf86cd799439011",
                "message": "Feedback submitted successfully",
            }
        }


class FeedbackListResponse(BaseModel):
    """Response schema for feedback list endpoints."""
    feedback: List[dict] = Field(..., description="List of feedback documents")
    count: int = Field(..., description="Number of feedback records")
    
    class Config:
        json_schema_extra = {
            "example": {
                "feedback": [
                    {
                        "feedbackId": "507f1f77bcf86cd799439011",
                        "responseId": "resp-12345",
                        "rating": "good_response",
                        "comment": "Helpful!",
                        "createdAt": 1699900000000,
                    }
                ],
                "count": 1,
            }
        }


@router.post(
    "/submit",
    response_model=FeedbackResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit feedback for a chat response",
)
async def submit_feedback(
    request: FeedbackSubmitRequest,
    current_user: dict = Depends(get_current_user),
    service: FeedbackService = Depends(get_feedback_service),
) -> FeedbackResponse:
    """
    Submit feedback for a chat response.
    
    Accepts a binary rating (good_response or bad_response) and optional comment.
    Feedback is immediately stored for analytics and future fine-tuning.

    """
    try:
        user_id = current_user.get("id")
        if not user_id:
            logger.warning("Feedback submission attempted without valid user ID")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User ID not found in authentication",
            )
        
        # Validate rating
        if request.rating not in ALLOWED_RATINGS:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"rating must be one of {list(ALLOWED_RATINGS)}",
            )
        
        # Submit feedback
        feedback_id = await service.submit_feedback(
            response_id=request.responseId,
            session_id=request.sessionId,
            user_id=user_id,
            rating=request.rating,
            comment=request.comment,
        )
        
        if not feedback_id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to store feedback",
            )
        
        return FeedbackResponse(
            status="success",
            feedbackId=feedback_id,
            message="Feedback submitted successfully",
        )
        
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Validation error in feedback submission: {e}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except Exception as e:
        logger.exception(f"Unexpected error during feedback submission: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred",
        )


@router.get(
    "/response/{response_id}",
    response_model=FeedbackListResponse,
    status_code=status.HTTP_200_OK,
    summary="Get feedback for a specific response",
)
async def get_response_feedback(
    response_id: str,
    current_user: dict = Depends(get_current_user),
    service: FeedbackService = Depends(get_feedback_service),
) -> FeedbackListResponse:
    """
    Retrieve all feedback for a specific response.
    
    Returns a list of feedback documents including ratings, comments,
    and submission timestamps, ordered by creation date (newest first).
    
    **Path Parameters:**
    - response_id: ID of the response to query
    """
    try:
        user_id = current_user.get("id")
        if not response_id or not response_id.strip():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="response_id is required",
            )
        
        feedback_list = await service.get_response_feedback(response_id)
        
        logger.info(
            f"Response feedback retrieval: user={user_id}, response={response_id}, "
            f"feedback_records={len(feedback_list)}"
        )
        
        return FeedbackListResponse(
            feedback=feedback_list,
            count=len(feedback_list),
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error retrieving feedback for response {response_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve feedback",
        )


@router.get(
    "/session/{session_id}",
    response_model=dict,
    status_code=status.HTTP_200_OK,
    summary="Get feedback for a specific session",
)
async def get_session_feedback(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    service: FeedbackService = Depends(get_feedback_service),
) -> dict:
    """
    Retrieve all feedback for a specific session with statistics.
    
    Returns a list of feedback documents for all responses in a session,
    along with aggregated statistics for that session.
    
    **Path Parameters:**
    - session_id: ID of the session to query
    """
    try:
        user_id = current_user.get("id")
        if not session_id or not session_id.strip():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="session_id is required",
            )
        
        feedback_list = await service.get_session_feedback(session_id)
        stats = await service.get_stats(session_id=session_id)
        
        logger.info(
            f"Session feedback retrieval: user={user_id}, session={session_id}, "
            f"feedback_records={len(feedback_list)}"
        )
        
        return {
            "feedback": feedback_list,
            "stats": stats.model_dump(),
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error retrieving feedback for session {session_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve feedback",
        )


@router.get(
    "/stats",
    response_model=FeedbackStatsSchema,
    status_code=status.HTTP_200_OK,
    summary="Get global feedback statistics",
)
async def get_feedback_stats(
    current_user: dict = Depends(get_current_user),
    service: FeedbackService = Depends(get_feedback_service),
) -> FeedbackStatsSchema:
    """
    Retrieve global feedback statistics.
    
    Returns aggregated feedback metrics including total count, good/bad ratio,
    and percentages. 
    
    """
    try:
        stats = await service.get_stats()
        logger.debug(f"Global feedback stats computed: {stats.model_dump()}")
        return stats
        
    except Exception as e:
        logger.exception(f"Error computing feedback statistics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to compute statistics",
        )
