from datetime import datetime, timezone
from typing import Any, Dict, List
from loguru import logger
from pymongo.database import Database


async def log_rag_interaction(record: Dict[str, Any], mongo_db: Database) -> None:
    """Append a single RAG interaction record to MongoDB.

    Expected keys in record (not enforced):
    - question: str
    - answer: str
    - contexts: List[str]
    - metadata: Dict[str, Any]
    """
    safe_record: Dict[str, Any] = {
        "timestamp": datetime.now(timezone.utc),
        **record,
    }

    # Never log raw API keys if accidentally passed
    if "api_key" in safe_record:
        safe_record.pop("api_key", None)

    try:
        if mongo_db is not None:
            await mongo_db["rag_logs"].insert_one(safe_record)
            logger.info("Successfully logged to database")
    except Exception as e:
        logger.error("Failed to log RAG interaction to MongoDB: %e", e)

