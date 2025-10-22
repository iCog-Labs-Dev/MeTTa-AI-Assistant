from loguru import logger
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, List
import time
from app.model.chunk import Chunk, AnnotationStatus

STALE_PENDING_THRESHOLD = 60 * 60  


class ChunkRepository:
    """
    Manages asynchronous CRUD operations for Chunk documents in MongoDB.
    Uses 'chunkId' as the unique key and 'annotation' as the description field name in the DB.
    """

    def __init__(self, db: AsyncIOMotorDatabase, collection_name: str = "chunks"):
        self.collection = db.get_collection(collection_name)

        

    async def _ensure_indexes(self):
        await self.collection.create_index("chunkId", unique=True)
        await self.collection.create_index("status")
        await self.collection.create_index([("status", 1), ("annotation", 1)])
        logger.info("MongoDB indexes ensured for chunks collection.")

    async def get_chunk_by_id(self, chunk_id: str) -> Optional[Chunk]:
        doc = await self.collection.find_one({"chunkId": chunk_id})
        if doc:
            return Chunk(**doc)
        return None

    get_chunk_for_annotation = get_chunk_by_id

    async def update_chunk_annotation(
        self, chunk_id: str, description: Optional[str], status: AnnotationStatus
    ) -> bool:
        """
        Updates chunk annotation, status, last_annotated_at, and pending_since.
        """
        updates = {
            "annotation": description,
            "status": status.value,  # Use .value for consistency
            "last_annotated_at": time.time()
        }

        if status == AnnotationStatus.PENDING:
            updates["pending_since"] = time.time()
        else:
            # Setting to None allows MongoDB to remove the field if it was there,
            # but we use $set instead of $unset to maintain idempotency.
            updates["pending_since"] = None

        update_result = await self.collection.update_one(
            {"chunkId": chunk_id},
            {"$set": updates}
        )
        return update_result.modified_count > 0

    async def increment_retry_count(self, chunk_id: str) -> bool:
        """Increments the retry_count field for a chunk."""
        update_result = await self.collection.update_one(
            {"chunkId": chunk_id},
            {"$inc": {"retry_count": 1}}
        )
        return update_result.modified_count > 0

    async def get_unannotated_chunks(self, limit: int = 100, include_failed: bool = False) -> List[Chunk]:
        """
        Retrieves chunks that have not yet been annotated or are stale PENDING.
        Includes chunks with missing/null 'annotation', status 'RAW', or stuck 'PENDING'.
        Optionally includes failed ones if include_failed=True.
        """
        now = time.time()
        base_conditions = [
            {"annotation": {"$exists": False}},
            {"annotation": None},
            {"status": "RAW"},
            {"status": "PENDING", "pending_since": {"$lt": now - STALE_PENDING_THRESHOLD}}
        ]

        if include_failed:
            base_conditions.append({"status": {"$in": [AnnotationStatus.FAILED_GEN.value, AnnotationStatus.FAILED_QUOTA.value]}})

        query = {"$or": base_conditions}

        cursor = self.collection.find(query).limit(limit)
        results = [Chunk(**doc) async for doc in cursor]

        logger.info(f"Fetched {len(results)} unannotated chunks (include_failed={include_failed})")
        return results

    async def get_failed_chunks(self, limit: int = 100, include_quota: bool = False) -> List[Chunk]:
        """
        Return chunks in FAILED_GEN or (optionally) FAILED_QUOTA for retry attempts.
        """
        statuses = [AnnotationStatus.FAILED_GEN.value]
        if include_quota:
            statuses.append(AnnotationStatus.FAILED_QUOTA.value)

        cursor = self.collection.find({"status": {"$in": statuses}}).limit(limit)
        return [Chunk(**doc) async for doc in cursor]