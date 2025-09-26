from dotenv import load_dotenv, find_dotenv
import os
from pymongo import MongoClient
from pydantic import BaseModel, Field
from typing import Literal
from uuid import uuid4
from typing import List
from pymongo.errors import BulkWriteError

load_dotenv(find_dotenv()) 

conn = os.getenv("MONGO_URI")
client = MongoClient(conn)

db = client["chunkDB"]
chunks_collection = db["chunks"]

# Set up MongoDB schema/collections for chunks and metadata.
class ChunkSchema(BaseModel):
    chunkId: str 
    source: Literal["code", "specification", "documentation"]
    chunk: str
    project: str
    repo: str
    section: str
    file: str
    version: str
    isEmbedded: bool = False

# Function to insert a single chunk into the MongoDB collection with validation.
def insert_chunk(chunk_data: dict):
    """
    Insert a single chunk.
    Returns inserted ID.
    """
    chunk = ChunkSchema(**chunk_data)
    # Check if chunkId already exists
    if chunks_collection.find_one({"chunkId": chunk.chunkId}):
        print(f"Chunk with chunkId '{chunk.chunkId}' already exists.")
        return None
    chunks_collection.insert_one(chunk.model_dump())
    return chunk.chunkId

# Function to insert many chunks into the MongoDB collection with validation.
def insert_chunks(chunks_data: list):
    """
    Insert multiple chunks.
    """
    valid_chunks = []
    for chunk_data in chunks_data:
        try:
            chunk = ChunkSchema(**chunk_data)
            # Check if already exists
            if not chunks_collection.find_one({"chunkId": chunk.chunkId}):
                valid_chunks.append(chunk.model_dump())
            else:
                print(f"Skipping duplicate chunkId: {chunk.chunkId}")
        except Exception as e:
            print("Validation error:", e)

    if not valid_chunks:
        return []

    try:
        chunks_collection.insert_many(valid_chunks, ordered=False)
    except BulkWriteError as e:
        print("Some duplicates were skipped.", e.details)

    # Return inserted chunkIds
    return [chunk["chunkId"] for chunk in valid_chunks]


# Function to retrieve  chunks by ChunkId from the MongoDB collection.
def get_chunk_by_id(chunk_id: str):
    """ 
    Retrieve a chunk by its ID.
    """
    return chunks_collection.find_one({"chunkId": chunk_id})

# Function to retrieve all chunks from the MongoDB collection.
def get_chunks(filter_query: dict = None, limit: int = 10):
    """
    Retrieve multiple chunks matching the filter.
    Returns a list of dictionaries.
    """
    filter_query = filter_query or {}  # If no filter is given, get all
    cursor = chunks_collection.find(filter_query, {"_id": 0}).limit(limit)
    return list(cursor)


# Function to update embedding status of a chunk by chunkId.
def update_embedding_status(chunk_id: str, status: bool):
    """
    Update the embedding status of a chunk.
    """
    result = chunks_collection.update_one(
        {"chunkId": chunk_id},
        {"$set": {"isEmbedded": status}}
    )
    return result.modified_count

# Function to update any fields of a single chunk by chunkID.
def update_chunk(chunk_id: str, updates: dict) -> int:
    """
    Update any fields of a single chunk by chunkId.
    Returns the number of documents modified (0 or 1).
    """
    result = chunks_collection.update_one(
        {"chunkId": chunk_id},
        {"$set": updates}
    )
    return result.modified_count

# Function to update multiple chunks matching a filter query.
def update_chunks(filter_query: dict, updates: dict) -> int:
    """
    Update any fields for multiple chunks matching the filter.
    Returns the number of documents modified.
    """
    result = chunks_collection.update_many(
        filter_query,
        {"$set": updates}
    )
    return result.modified_count

# Function to delete a chunk by chunkId.

def delete_chunk(chunk_id: str):
    """ 
    Delete a chunk by its ID.
    """
    result = chunks_collection.delete_one({"chunkId": chunk_id})
    return result.deleted_count