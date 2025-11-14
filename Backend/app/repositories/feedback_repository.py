from typing import List, Optional, Dict, Any
from bson import ObjectId
from pymongo.database import Database
from pymongo.collection import Collection
from loguru import logger
import time
import asyncio
import pymongo.errors

from app.model.feedback import FeedbackSchema, FeedbackStatsSchema


# ============================================================================
# CONFIGURATION & TIMEOUT SETTINGS
# ============================================================================
DB_OPERATION_TIMEOUT = 10  
MAX_FEEDBACK_BATCH = 1000  


async def _get_feedback_collection(mongo_db: Database) -> Collection:
    """Get feedback collection from MongoDB instance. """
    if mongo_db is None:
        raise RuntimeError("Database connection not initialized")

    # get_collection is normally synchronous in pymongo, but some async
    # clients or test mocks may return a coroutine. Support both.
    coll = mongo_db.get_collection("feedback")
    # If the result is awaitable (coroutine), await it.
    try:
        if hasattr(coll, "__await__"):
            coll = await coll
    except TypeError:
        # Not awaitable
        pass

    return coll


async def insert_feedback(feedback_data: dict, mongo_db: Database) -> Optional[str]:
    """
    Insert new feedback into MongoDB.

    Args:
        feedback_data: Validated feedback data.
        mongo_db: Active MongoDB instance.

    Returns:
        feedbackId or None on failure.
    """

    collection = await _get_feedback_collection(mongo_db)
    
    try:
        # Convert to FeedbackSchema to ensure all fields are properly initialized
        if not isinstance(feedback_data, FeedbackSchema):
            feedback = FeedbackSchema(**feedback_data)
        else:
            feedback = feedback_data
        
        # Insert with timeout protection
        try:
            result = await asyncio.wait_for(
                collection.insert_one(feedback.model_dump()),
                timeout=DB_OPERATION_TIMEOUT
            )
            
            if not result.inserted_id:
                logger.error("Insert operation returned no ID - this should never happen")
                return None
            
            logger.info(
                f"Feedback inserted: feedbackId={feedback.feedbackId}, "
                f"responseId={feedback.responseId}, userId={feedback.userId}, "
                f"rating={feedback.rating}"
            )
            return feedback.feedbackId
            
        except asyncio.TimeoutError:
            logger.error(f"Database insert timeout after {DB_OPERATION_TIMEOUT}s for response {feedback.responseId}")
            return None
            
    except ValueError as e:
        logger.error(f"Feedback validation error: {e}")
        return None
    except pymongo.errors.DuplicateKeyError as e:
        logger.warning(f"Duplicate feedback record: {e}")
        return None
    except pymongo.errors.WriteError as e:
        logger.error(f"Database write error: {e}")
        return None
    except Exception as e:
        logger.exception(f"Failed to insert feedback: {e}")
        return None


async def get_feedback_by_response_id(
    response_id: str, mongo_db: Database
) -> List[dict]:
    """
    Retrieve all feedback for a specific response.
    
    Args:
        response_id: ID of the response to query
        mongo_db: MongoDB database instance
        
    Returns:
        List of feedback documents for the response
    """
    collection = await _get_feedback_collection(mongo_db)
    
    try:
        cursor = collection.find({"responseId": response_id}).sort("createdAt", -1)
        # If the collection.find returned an awaitable (some mocks), await it
        if hasattr(cursor, "__await__"):
            cursor = await cursor

        # Support both async and sync cursors/mocks
        if hasattr(cursor, "__aiter__"):
            feedback_list = [doc async for doc in cursor]
        else:
            feedback_list = [doc for doc in cursor]
        
        logger.debug(f"Retrieved {len(feedback_list)} feedback records for response {response_id}")
        return feedback_list
        
    except Exception as e:
        logger.exception(f"Failed to retrieve feedback for response {response_id}: {e}")
        return []


async def get_feedback_by_session_id(
    session_id: str, mongo_db: Database
) -> List[dict]:
    """
    Retrieve all feedback for a specific session.
    
    Args:
        session_id: ID of the session to query
        mongo_db: MongoDB database instance
        
    Returns:
        List of feedback documents for the session
    """
    collection = await _get_feedback_collection(mongo_db)
    
    try:
        cursor = collection.find({"sessionId": session_id}).sort("createdAt", -1)
        # If the collection.find returned an awaitable (some mocks), await it
        if hasattr(cursor, "__await__"):
            cursor = await cursor

        # Support both async and sync cursors/mocks
        if hasattr(cursor, "__aiter__"):
            feedback_list = [doc async for doc in cursor]
        else:
            feedback_list = [doc for doc in cursor]
        
        logger.debug(f"Retrieved {len(feedback_list)} feedback records for session {session_id}")
        return feedback_list
        
    except Exception as e:
        logger.exception(f"Failed to retrieve feedback for session {session_id}: {e}")
        return []


async def get_feedback_stats(
    filter_query: Optional[Dict[str, Any]] = None, 
    mongo_db: Database = None
) -> FeedbackStatsSchema:
    """
    Compute feedback statistics using MongoDB aggregation.

    Args:
        filter_query: Optional filter (e.g., {"sessionId": "abc123"}).
        mongo_db: MongoDB database instance.

    Returns:
        FeedbackStatsSchema with counts and percentages.
    """

    collection = await _get_feedback_collection(mongo_db)
    
    try:
        filter_query = filter_query or {}
        
        # Use aggregation pipeline for efficiency
        pipeline = [
            {"$match": filter_query},
            {
                "$group": {
                    "_id": "$rating",
                    "count": {"$sum": 1},
                }
            },
        ]
        
        stats_cursor = collection.aggregate(pipeline)
        # If aggregate returned a coroutine (mock), await it
        if hasattr(stats_cursor, "__await__"):
            stats_cursor = await stats_cursor

        # Support both async and sync aggregation cursors/mocks
        if hasattr(stats_cursor, "__aiter__"):
            stats_data = [doc async for doc in stats_cursor]
        else:
            stats_data = [doc for doc in stats_cursor]
        
        # Calculate totals and counts from aggregation results
        total_count = 0
        good_count = 0
        bad_count = 0
        
        for stat in stats_data:
            total_count += stat["count"]
            if stat["_id"] == "good_response":
                good_count = stat["count"]
            elif stat["_id"] == "bad_response":
                bad_count = stat["count"]
        
        # Calculate percentages
        good_percentage = (good_count / total_count * 100) if total_count > 0 else 0
        bad_percentage = (bad_count / total_count * 100) if total_count > 0 else 0
        
        stats = FeedbackStatsSchema(
            totalFeedback=total_count,
            goodCount=good_count,
            badCount=bad_count,
            goodPercentage=round(good_percentage, 2),
            badPercentage=round(bad_percentage, 2),
        )
        
        logger.debug(f"Computed feedback stats: {stats.model_dump()}")
        return stats
        
    except Exception as e:
        logger.exception(f"Failed to compute feedback statistics: {e}")
        return FeedbackStatsSchema(
            totalFeedback=0, goodCount=0, badCount=0, 
            goodPercentage=0.0, badPercentage=0.0
        )


async def get_feedback_for_export(
    filter_query: Optional[Dict[str, Any]] = None,
    mongo_db: Database = None
) -> List[Dict[str, Any]]:
    """
    Fetch feedback records not yet used for training.

    Args:
        filter_query: Optional MongoDB filter.
        mongo_db: MongoDB database instance.

    Returns:
        List of feedback documents ready for export.
    """

    collection = await _get_feedback_collection(mongo_db)
    
    try:
        query = {"usedForTraining": False}
        if filter_query:
            query.update(filter_query)
        
        cursor = collection.find(query).sort("createdAt", 1)
        # If the collection.find returned an awaitable (some mocks), await it
        if hasattr(cursor, "__await__"):
            cursor = await cursor

        # Support both async and sync cursors/mocks
        if hasattr(cursor, "__aiter__"):
            export_data = [doc async for doc in cursor]
        else:
            export_data = [doc for doc in cursor]
        
        logger.debug(f"Retrieved {len(export_data)} feedback records for export")
        return export_data
        
    except Exception as e:
        logger.exception(f"Failed to retrieve feedback for export: {e}")
        return []


async def mark_feedback_as_used(
    feedback_ids: list, mongo_db: Database
) -> int:
    """
    Mark feedback records as used for training.
    
    Args:
        feedback_ids: List of feedbackIds to mark
        mongo_db: MongoDB database instance
        
    Returns:
        Number of documents updated
    """
    collection = await _get_feedback_collection(mongo_db)
    
    try:
        update_call = collection.update_many(
            {"feedbackId": {"$in": feedback_ids}},
            {"$set": {"usedForTraining": True}},
        )
        # Support both async and sync update_many implementations
        if hasattr(update_call, "__await__"):
            result = await update_call
        else:
            result = update_call
        
        logger.info(f"Marked {result.modified_count} feedback records as used for training")
        return result.modified_count
        
    except Exception as e:
        logger.exception(f"Failed to mark feedback as used: {e}")
        return 0


async def ensure_feedback_indexes(mongo_db: Database) -> None:
    """
    Create indexes for optimal feedback queries.

    """
    collection = _get_feedback_collection(mongo_db)
    
    try:
        # Index for querying feedback by response
        idx1 = collection.create_index("responseId")
        if hasattr(idx1, "__await__"):
            await idx1

        # Index for querying feedback by session
        idx2 = collection.create_index("sessionId")
        if hasattr(idx2, "__await__"):
            await idx2

        # Index for querying feedback by user
        idx3 = collection.create_index("userId")
        if hasattr(idx3, "__await__"):
            await idx3

        # Compound index for faster export queries
        idx4 = collection.create_index([("usedForTraining", 1), ("createdAt", 1)])
        if hasattr(idx4, "__await__"):
            await idx4
        
        logger.info("Feedback indexes created successfully")
        
    except Exception as e:
        logger.warning(f"Failed to create feedback indexes: {e}")
