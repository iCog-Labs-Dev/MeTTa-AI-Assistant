from typing import Literal, List, Optional, Union
from pydantic import BaseModel
from bson import ObjectId
from pymongo.errors import BulkWriteError
from pymongo.database import Database
from pymongo.collection import Collection
from loguru import logger

def _get_collection(mongo_db: Database, name: str) -> Collection:
    if mongo_db is None:
        raise RuntimeError("Database connection not initialized — pass a valid mongo_db")
    return mongo_db.get_collection(name)

# Set up MongoDB schema/collections for chunks and metadata.
class ChunkSchema(BaseModel):
    chunkId: str
    source: Literal["code", "documentation", "others"]
    chunk: str
    isEmbedded: bool = False

    # Code-specific fields
    project: Optional[str] = None
    repo: Optional[str] = None
    section: Optional[List[str]] = None
    file: Optional[List[str]] = None
    version: Optional[str] = None

    # Documentation-specific fields
    url: Optional[str] = None
    page_title: Optional[str] = None
    category: Optional[str] = None

    # PDF-specific fields
    filename: Optional[str] = None
    page_numbers: Optional[List[int]] = None


# Function to insert a single chunk into the MongoDB collection with validation.
async def insert_chunk(chunk_data: dict, mongo_db: Database = None) -> str | None:
    """
    Insert a single chunk.
    Returns inserted ID.
    """
    collection = _get_collection(mongo_db, "chunks")
    try: 
        chunk = ChunkSchema(**chunk_data)
    except Exception as e:
        logger.error("Validation error:", e)
        return None
    
    if await collection.find_one({"chunkId": chunk.chunkId}):
        logger.warning(f"Chunk with chunkId '{chunk.chunkId}' already exists.")
        return None
    result = await collection.insert_one(chunk.model_dump())
    return chunk.chunkId

# Function to insert many chunks into the MongoDB collection with validation.
async def insert_chunks(
    chunks_data: List[dict], mongo_db: Database = None
) -> List[str]:
    """
    Insert multiple chunks with duplicate checking.
    Returns a list of inserted chunkIds.
    """
    collection = _get_collection(mongo_db, "chunks")
    valid_chunks = []

    # Validate and check duplicates
    for chunk_data in chunks_data:
        try:
            chunk = ChunkSchema(**chunk_data)
            if not await collection.find_one({"chunkId": chunk.chunkId}):
                valid_chunks.append(chunk.model_dump())
            else:
                logger.warning(f"Skipping duplicate chunkId: {chunk.chunkId}")
        except Exception as e:
            logger.error("Validation error:", e)

        if not valid_chunks:
            return []

    # Insert many
    try:
        result = await collection.insert_many(valid_chunks, ordered=False)
        inserted_ids = result.inserted_ids
    except BulkWriteError as e:
        logger.warning("Some duplicates were skipped.", e.details)
        inserted_ids = e.details.get("writeErrors", [])
        # Extract inserted ids if available
        inserted_ids = [item["op"]["chunkId"] for item in inserted_ids if "op" in item and "chunkId" in item["op"]]

        # Return list of inserted chunkIds
        return [chunk["chunkId"] for chunk in valid_chunks]


# Function to retrieve  chunks by ChunkId from the MongoDB collection.
async def get_chunk_by_id(chunk_id: str, mongo_db: Database =None) -> dict | None:
    """
    Retrieve a chunk by its ID.
    """
    collection = _get_collection(mongo_db, "chunks")
    return await collection.find_one({"chunkId": chunk_id}, {"_id": 0})


# Function to retrieve all chunks from the MongoDB collection.
async def get_chunks(
    filter_query: dict = None, limit: int = 10, mongo_db: Database = None
) -> List[dict]:
    """
    Retrieve multiple chunks matching the filter.
    Returns a list of dictionaries.
    """
    collection = _get_collection(mongo_db, "chunks")
    filter_query = filter_query or {}
    cursor = collection.find(filter_query, {"_id": 0}).limit(limit)
    return [doc async for doc in cursor]

# Function to update embedding status of a chunk by chunkId.
async def update_embedding_status(
    chunk_id: str, status: bool, mongo_db: Database = None
) -> int:
    """
    Update the embedding status of a chunk.
    """
    collection = _get_collection(mongo_db, "chunks")
    result = await collection.update_one(
        {"chunkId": chunk_id}, {"$set": {"isEmbedded": status}}
    )
    return result.modified_count


# Function to update any fields of a single chunk by chunkID.
async def update_chunk(
    chunk_id: str, updates: dict, mongo_db: Database = None
) -> int:
    """
    Update any fields of a single chunk by chunkId.
    Returns the number of documents modified (0 or 1).
    """
    collection = _get_collection(mongo_db, "chunks")
    result = await collection.update_one({"chunkId": chunk_id}, {"$set": updates})
    return result.modified_count

# Function to update multiple chunks matching a filter query.
async def update_chunks(
    filter_query: dict, updates: dict, mongo_db: Database = None
) -> int:
    """
    Update any fields for multiple chunks matching the filter.
    Returns the number of documents modified.
    """
    collection = _get_collection(mongo_db, "chunks")
    result = await collection.update_many(filter_query, {"$set": updates})
    return result.modified_count

# Function to delete a chunk by chunkId.
async def delete_chunk(chunk_id: str, mongo_db: Database = None) -> int:
    """
    Delete a chunk by its ID.
    """
    collection = _get_collection(mongo_db, "chunks")
    result = await collection.delete_one({"chunkId": chunk_id})
    return result.deleted_count


# ----------------------------------'
# INGESTION STATUS CRUD
# ----------------------------------'


async def mark_ingestion_complete(
    site_name: str, total_chunks: int, mongo_db: Database = None
) -> None:
    """
    Mark an ingestion process as complete for a specific site.
    """
    ingestion_collection = _get_collection(mongo_db, "ingestion_status")
    await ingestion_collection.update_one(
        {"site_name": site_name},
        {
            "$set": {
                "site_name": site_name,
                "completed": True,
                "total_chunks": total_chunks,
                "completed_at": {
                    "$date": {"$numberLong": str(int(__import__("time").time() * 1000))}
                },
                "status": "success",
            }
        },
        upsert=True,
    )


async def check_ingestion_complete(
    site_name: str, mongo_db: Database = None
) -> dict | None:
    """
    Check if ingestion has been completed for a specific site.
    Returns the completion record if found, None otherwise.
    """
    ingestion_collection = _get_collection(mongo_db, "ingestion_status")
    return await ingestion_collection.find_one(
        {"site_name": site_name, "completed": True}
    )


async def get_all_ingestion_status(mongo_db: Database = None) -> List[dict]:
    """
    Get all ingestion completion records.
    """
    ingestion_collection = _get_collection(mongo_db, "ingestion_status")
    results = []
    async for doc in ingestion_collection.find({}):
        results.append(doc)
    return results


async def clear_ingestion_status(
    site_name: str = None, mongo_db: Database = None
) -> None:
    """
    Clear ingestion status for a specific site or all sites.
    """
    ingestion_collection = _get_collection(mongo_db, "ingestion_status")
    if site_name:
        await ingestion_collection.delete_one({"site_name": site_name})
    else:
        await ingestion_collection.delete_many({})


# ----------------------------------'
# SYMBOLS CRUD
# ----------------------------------
async def upsert_symbol(name: str, col: str, code: str, mongo_db: Database = None) -> Optional[ObjectId]:
    """Add a node_id to the given symbol's column (defs, calls, asserts, types)."""
    symbols_collection = _get_collection(mongo_db, "symbols")
    update = {"$addToSet": {col: code}}
    result = await symbols_collection.update_one({"name": name}, update, upsert=True)
    return result.upserted_id if result.upserted_id else None

async def get_symbol(name: str, mongo_db: Database = None) -> Union[dict, str]:
    """Fetch a symbol document by name."""
    symbols_collection = _get_collection(mongo_db, "symbols")
    result = await symbols_collection.find_one({"name": name})
    if result:
        return result
    return "Symbol not found"

async def get_all_symbols(mongo_db: Database = None) -> List[dict]:
    """Return all documents from the symbols collection."""
    symbols_collection = _get_collection(mongo_db, "symbols")
    results = []
    async for doc in symbols_collection.find({}):
        results.append(doc)
    return results

async def clear_symbols_index(mongo_db: Database = None) -> None:
        """
        clear these collections after a function scope is processed
        to avoid duplicate key errors on processing same function names 
        in different scopes
        """
        symbols_collection = _get_collection(mongo_db, "symbols")
        await symbols_collection.delete_many({})
