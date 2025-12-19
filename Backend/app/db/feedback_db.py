"""
Feedback CRUD operations for MongoDB.
"""

from typing import List, Optional
from datetime import datetime
from pymongo.database import Database
from pymongo.collection import Collection
from app.core.logging import logger
from app.model.feedback import FeedbackSchema
from app.db.db import _get_collection


async def insert_feedback(feedback_data: dict, mongo_db: Database = None) -> Optional[str]:
    """
    Insert feedback into database.
    Returns feedbackId on success, None on failure.
    """
    collection = _get_collection(mongo_db, "feedback")
    try:
        feedback = FeedbackSchema(**feedback_data)
        await collection.insert_one(feedback.model_dump())
        logger.info(f"Feedback inserted: {feedback.feedbackId}")
        return feedback.feedbackId
    except Exception as e:
        logger.error(f"Error inserting feedback: {e}")
        return None


async def upsert_feedback(feedback_data: dict, mongo_db: Database = None) -> Optional[str]:
    """
    Upsert feedback into database.
    Updates existing feedback if found by userId and responseId, otherwise inserts new.
    Returns feedbackId on success, None on failure.
    """
    collection = _get_collection(mongo_db, "feedback")
    try:
        feedback_data["updatedAt"] = datetime.utcnow()
        feedback = FeedbackSchema(**feedback_data)
        
        model_dump = feedback.model_dump()
        
        update_fields = {
            "sentiment": model_dump["sentiment"],
            "comment": model_dump["comment"],
            "updatedAt": model_dump["updatedAt"]
        }
        
        # Fields to insert (only if new)
        # We exclude fields that are in update_fields to avoid redundancy, 
        # though $setOnInsert only acts on insert.
        insert_fields = {
            k: v for k, v in model_dump.items() 
            if k not in ["sentiment", "comment", "updatedAt"]
        }

        result = await collection.update_one(
            {
                "userId": feedback.userId,
                "responseId": feedback.responseId
            },
            {
                "$set": update_fields,
                "$setOnInsert": insert_fields
            },
            upsert=True
        )
        
        if result.upserted_id:
            logger.info(f"Feedback inserted: {feedback.feedbackId}")
        else:
            logger.info(f"Feedback updated for response: {feedback.responseId}")
            
        return feedback.feedbackId
    except Exception as e:
        logger.error(f"Error upserting feedback: {e}")
        return None


async def get_feedback_by_response(response_id: str, mongo_db: Database = None) -> List[dict]:
    """
    Get all feedback for a specific response.
    """
    collection = _get_collection(mongo_db, "feedback")
    cursor = collection.find({"responseId": response_id}).sort("createdAt", -1)
    return [doc async for doc in cursor]


async def get_feedback_stats(mongo_db: Database = None) -> dict:
    """
    Get feedback statistics (positive, neutral, negative counts).
    """
    collection = _get_collection(mongo_db, "feedback")
    stats = await collection.aggregate([
        {
            "$group": {
                "_id": None,
                "totalFeedback": {"$sum": 1},
                "positiveFeedback": {
                    "$sum": {"$cond": [{"$eq": ["$sentiment", "positive"]}, 1, 0]}
                },
                "neutralFeedback": {
                    "$sum": {"$cond": [{"$eq": ["$sentiment", "neutral"]}, 1, 0]}
                },
                "negativeFeedback": {
                    "$sum": {"$cond": [{"$eq": ["$sentiment", "negative"]}, 1, 0]}
                }
            }
        }
    ]).to_list(None)
    
    return stats[0] if stats else {
        "totalFeedback": 0,
        "positiveFeedback": 0,
        "neutralFeedback": 0,
        "negativeFeedback": 0
    }
