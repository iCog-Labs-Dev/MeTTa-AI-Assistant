from app.core.logging import logger
from pymongo.database import Database
from typing import Optional, List
import time
from app.model.chunk import ChunkSchema, AnnotationStatus
from app.repositories.constants import MongoFields

STALE_PENDING_THRESHOLD = 60 * 60


class ChunkRepository:
    """
    Manages asynchronous CRUD operations for Chunk documents in MongoDB.
    Uses 'chunkId' as the unique key and 'description' as the description field name in the DB.
    """

    def __init__(self, db: Database, collection_name: str = "chunks"):
        self.collection = db.get_collection(collection_name)

    async def _ensure_indexes(self):
        await self.collection.create_index(MongoFields.CHUNK_ID, unique=True)
        await self.collection.create_index(MongoFields.STATUS)
        await self.collection.create_index([(MongoFields.STATUS, 1), (MongoFields.DESCRIPTION, 1)])
        await self.collection.create_index([(MongoFields.SOURCE, 1), (MongoFields.STATUS, 1)])
        logger.info("MongoDB indexes ensured for chunks collection.")

    async def get_chunk_by_id(self, chunk_id: str) -> Optional[ChunkSchema]:
        doc = await self.collection.find_one({MongoFields.CHUNK_ID: chunk_id})
        if doc:
            return ChunkSchema(**doc)
        return None

    async def get_chunk_for_annotation(self, chunk_id: str) -> Optional[ChunkSchema]:
        """Retrieve a chunk by ID."""
        doc = await self.collection.find_one({MongoFields.CHUNK_ID: chunk_id, MongoFields.SOURCE: "code"})
        if doc:
            return ChunkSchema(**doc)
        return None

    async def update_chunk_annotation(
        self, chunk_id: str, description: Optional[str], status: AnnotationStatus
    ) -> bool:
        """
        Updates chunk annotation, status, last_annotated_at, and pending_since.
        """
        updates = {
            MongoFields.DESCRIPTION: description,
            MongoFields.STATUS: status.value,
            MongoFields.LAST_ANNOTATED_AT: time.time(),
        }

        if status == AnnotationStatus.PENDING:
            updates[MongoFields.PENDING_SINCE] = time.time()
        else:
            updates[MongoFields.PENDING_SINCE] = None

        update_result = await self.collection.update_one(
            {MongoFields.CHUNK_ID: chunk_id}, {"$set": updates}
        )
        return update_result.modified_count > 0

    async def increment_retry_count(self, chunk_id: str) -> bool:
        """Increments the retry_count field for a chunk."""
        update_result = await self.collection.update_one(
            {MongoFields.CHUNK_ID: chunk_id}, {"$inc": {MongoFields.RETRY_COUNT: 1}}
        )
        return update_result.modified_count > 0

    async def get_unannotated_chunks(
        self, limit: Optional[int] = None, include_failed: bool = False
    ) -> List[ChunkSchema]:
        """
        Retrieves chunks that have not yet been annotated or are stale PENDING.
        If limit is None, retrieves ALL matching chunks.
        """
        now = time.time()
        base_conditions = [
            {MongoFields.DESCRIPTION: {"$exists": False}},
            {MongoFields.DESCRIPTION: None},
            {MongoFields.STATUS: AnnotationStatus.RAW.value},
            {MongoFields.STATUS: AnnotationStatus.UNANNOTATED.value},
            {
                MongoFields.STATUS: AnnotationStatus.PENDING.value,
                MongoFields.PENDING_SINCE: {"$lt": now - STALE_PENDING_THRESHOLD},
            },
        ]

        if include_failed:
            base_conditions.append(
                {
                    MongoFields.STATUS: {
                        "$in": [
                            AnnotationStatus.FAILED_GEN.value,
                            AnnotationStatus.FAILED_QUOTA.value,
                        ]
                    }
                }
            )

        query = {"$or": base_conditions, MongoFields.SOURCE: "code"}

        cursor = self.collection.find(query)

        if limit is not None and limit > 0:
            cursor = cursor.limit(limit)

        results = [ChunkSchema(**doc) async for doc in cursor]

        logger.info(
            f"Fetched {len(results)} unannotated chunks (limit={limit}, include_failed={include_failed})"
        )
        return results

    async def get_failed_chunks(
        self, limit: int = 100, include_quota: bool = False
    ) -> List[ChunkSchema]:
        """
        Return chunks in FAILED_GEN or (optionally) FAILED_QUOTA for retry attempts.
        """
        statuses = [AnnotationStatus.FAILED_GEN.value]
        if include_quota:
            statuses.append(AnnotationStatus.FAILED_QUOTA.value)

        cursor = self.collection.find(
            {MongoFields.STATUS: {"$in": statuses}, MongoFields.SOURCE: "code"}
        ).limit(limit)
        return [ChunkSchema(**doc) async for doc in cursor]
