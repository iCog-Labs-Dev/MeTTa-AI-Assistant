from typing import Optional, List, Dict, Any
from loguru import logger
from pymongo.database import Database

from app.model.feedback import FeedbackSchema, FeedbackStatsSchema, FeedbackExportSchema
from app.repositories import feedback_repository as repo


# ============================================================================
# CONFIGURATION & LIMITS
# ============================================================================
MAX_COMMENT_LENGTH = 300
RATING_FORMAT_MAP = {
    "good_response": "good",
    "bad_response": "bad",
}
ALLOWED_RATINGS = {"good_response", "bad_response"}
EXPORT_BATCH_SIZE = 100  # For chunking large exports
EXPORT_TIMEOUT_SECONDS = 30


class FeedbackService:
    """
    Service layer for feedback operations.
    
    Handles validation, logging, preprocessing, and coordination with
    the repository layer.
    """
    
    def __init__(self, mongo_db: Database):
        """Initialize feedback service with database connection."""
        self.mongo_db = mongo_db
    
    async def submit_feedback(
        self,
        response_id: str,
        session_id: str,
        user_id: str,
        rating: str,
        comment: Optional[str] = None,
    ) -> Optional[str]:
        """
        Handle feedback submission for a chat response.

        Validates input, logs the action, and saves the feedback.
        """

        logger.info(
            f"Feedback submission initiated by user={user_id}, "
            f"response={response_id}, session={session_id}, rating={rating}"
        )
        
        try:
            # Validate rating value (note: Pydantic schema already validates this)
            if rating not in ALLOWED_RATINGS:
                raise ValueError(
                    f"Invalid rating '{rating}'. Must be one of {ALLOWED_RATINGS}"
                )
            
            # Build feedback data - let FeedbackSchema handle field initialization
            feedback_data = {
                "responseId": response_id,
                "sessionId": session_id,
                "userId": user_id,
                "rating": rating,
                "comment": comment,
            }
            
            # Insert into database (validates and initializes all fields)
            feedback_id = await repo.insert_feedback(feedback_data, self.mongo_db)
            
            if feedback_id:
                logger.info(
                    f"Feedback successfully submitted: feedbackId={feedback_id}, "
                    f"user={user_id}, rating={rating}"
                )
                return feedback_id
            else:
                logger.error("Failed to insert feedback into database")
                return None
                
        except ValueError as e:
            logger.warning(f"Feedback validation failed: {e}")
            raise
        except Exception as e:
            logger.exception(f"Unexpected error during feedback submission: {e}")
            raise
    
    async def get_response_feedback(self, response_id: str) -> List[dict]:
        """
        Retrieve all feedback for a specific response.
        
        Args:
            response_id: ID of the response
            
        Returns:
            List of feedback documents
        """
        logger.debug(f"Fetching feedback for response={response_id}")
        return await repo.get_feedback_by_response_id(response_id, self.mongo_db)
    
    async def get_session_feedback(self, session_id: str) -> List[dict]:
        """
        Retrieve all feedback for a specific session.
        
        Args:
            session_id: ID of the session
            
        Returns:
            List of feedback documents
        """
        logger.debug(f"Fetching feedback for session={session_id}")
        return await repo.get_feedback_by_session_id(session_id, self.mongo_db)
    
    async def get_stats(
        self, 
        session_id: Optional[str] = None
    ) -> FeedbackStatsSchema:
        """
        Get feedback statistics, optionally filtered by session.
        
        Args:
            session_id: Optional session ID to filter by
            
        Returns:
            FeedbackStatsSchema with counts and percentages
        """
        filter_query = None
        if session_id:
            filter_query = {"sessionId": session_id}
            logger.debug(f"Computing feedback stats for session={session_id}")
        else:
            logger.debug("Computing global feedback stats")
        
        return await repo.get_feedback_stats(filter_query, self.mongo_db)
    
    async def prepare_for_export(
        self,
        chat_messages: List[Dict[str, Any]],
        feedback_record: Dict[str, Any],
    ) -> Optional[FeedbackExportSchema]:
        """
        Prepare feedback record for fine-tuning dataset export.
        
        converts raw feedback + message data into JSONL-compatible
        format ready for fine-tuning pipelines.
        
        Args:
            chat_messages: List of chat messages from the session
            feedback_record: The feedback document to convert
            
        Returns:
            FeedbackExportSchema if successful, None otherwise
            
        Note:
            Searches for the most recent user message (prompt) and assistant
            message (response) in the chat history. Logs warnings if data
            appears incomplete but continues with partial data when possible.
        """
        try:
            prompt = None
            response = None
            
            # Find the most recent user and assistant messages
            for msg in reversed(chat_messages):
                if msg.get("role") == "assistant" and response is None:
                    response = msg.get("content", "").strip()
                    if response:  # Only accept non-empty responses
                        continue
                elif msg.get("role") == "user" and prompt is None:
                    prompt = msg.get("content", "").strip()
                    if prompt:  # Only accept non-empty prompts
                        continue
                
                # Stop if we have both
                if prompt and response:
                    break
            
            # Log warnings for missing data but try to continue
            if not prompt:
                logger.warning(
                    f"No user prompt found for feedback {feedback_record.get('feedbackId')}. "
                    "Export may be incomplete."
                )
                prompt = ""
            
            if not response:
                logger.warning(
                    f"No assistant response found for feedback {feedback_record.get('feedbackId')}. "
                    "Export may be incomplete."
                )
                response = ""
            
            # Skip export if both are missing
            if not prompt and not response:
                logger.error(
                    f"Could not find prompt or response for feedback {feedback_record.get('feedbackId')}. "
                    "Skipping export."
                )
                return None
            
            # Convert rating format
            rating_map = RATING_FORMAT_MAP
            rating = rating_map.get(feedback_record.get("rating"))
            
            if not rating:
                feedback_id = feedback_record.get('feedbackId', 'UNKNOWN')
                logger.error(
                    f"Invalid rating in feedback: feedbackId={feedback_id}, "
                    f"rating={feedback_record.get('rating')}"
                )
                return None
            
            export_data = FeedbackExportSchema(
                prompt=prompt,
                completion=response,
                feedback=rating,
                comment=feedback_record.get("comment"),
            )
            
            logger.debug(
                f"Prepared feedback export: prompt_len={len(prompt)}, "
                f"response_len={len(response)}, rating={rating}"
            )
            return export_data
            
        except Exception as e:
            feedback_id = feedback_record.get('feedbackId', 'UNKNOWN')
            logger.exception(
                f"Failed to prepare feedback for export: feedbackId={feedback_id}, error={e}"
            )
            return None
    
    async def get_export_data(
        self, 
        filter_query: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Get feedback records ready for fine-tuning export.
        
        This retrieves feedback marked as usedForTraining=False.
        
        Args:
            filter_query: Optional MongoDB filter query
            
        Returns:
            List of feedback documents ready for export
        """
        logger.debug("Retrieving feedback for fine-tuning export")
        return await repo.get_feedback_for_export(filter_query, self.mongo_db)
    
    async def mark_exported(self, feedback_ids: List[str]) -> int:
        """
        Mark feedback records as used for training.
        
        Args:
            feedback_ids: List of feedbackIds that were exported
            
        Returns:
            Number of records updated
        """
        logger.info(f"Marking {len(feedback_ids)} feedback records as used for training")
        return await repo.mark_feedback_as_used(feedback_ids, self.mongo_db)
