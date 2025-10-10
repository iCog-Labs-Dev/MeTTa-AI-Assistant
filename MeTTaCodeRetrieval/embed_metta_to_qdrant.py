import os
import asyncio
from qdrant_client import QdrantClient
from qdrant_client.http.models import PointStruct
from sentence_transformers import SentenceTransformer
from pymongo import AsyncMongoClient
import uuid
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
MONGO_URI = os.getenv("MONGO_URI")
if not MONGO_URI:
    raise ValueError("MONGO_URI not set in .env file")

# Configuration
QDRANT_URL = "http://localhost:6333"
COLLECTION_NAME = "metta_codebase"

# Initialize clients
qdrant_client = QdrantClient(url=QDRANT_URL, timeout=5)
mongo_client = AsyncMongoClient(MONGO_URI)
db = mongo_client["chunkDB"]
chunks_collection = db.get_collection("chunks")
model = SentenceTransformer('google/embeddinggemma-300m')

# Async function to fetch chunks from MongoDB
async def get_chunks(filter_query: dict = None, limit: int = 100) -> list:
    filter_query = filter_query or {"source": "code", "isEmbedded": False}
    cursor = chunks_collection.find(filter_query, {"_id": 0}).limit(limit)
    return [doc async for doc in cursor]

# Async function to update embedding status in MongoDB
async def update_embedding_status(chunk_id: str, status: bool) -> int:
    result = await chunks_collection.update_one(
        {"chunkId": chunk_id},
        {"$set": {"isEmbedded": status}}
    )
    return result.modified_count

# Embedding and storage function
async def embed_and_store():
    try:
        # Fetch unembedded chunks from MongoDB
        chunks = await get_chunks()
        if not chunks:
            print("No unembedded chunks found.")
            return

        points = []
        for chunk_data in chunks:
            # Embed the chunk content
            embedding = model.encode(chunk_data["chunk"]).tolist()
            
            # Prepare metadata (all ChunkSchema fields)
            metadata = {
                "chunkId": chunk_data["chunkId"],
                "source": chunk_data["source"],
                "chunk": chunk_data["chunk"],
                "project": chunk_data["project"],
                "repo": chunk_data["repo"],
                "section": chunk_data["section"],
                "file": chunk_data["file"],
                "version": chunk_data["version"],
                "isEmbedded": chunk_data["isEmbedded"]
            }
            
            points.append(
                PointStruct(
                    id=str(uuid.uuid4()),  # Unique ID for Qdrant
                    vector=embedding,
                    payload=metadata
                )
            )
        
        # Upsert to Qdrant
        qdrant_client.upsert(
            collection_name=COLLECTION_NAME,
            points=points
        )
        print(f"Stored {len(points)} chunks in {COLLECTION_NAME}")

        # Update isEmbedded status in MongoDB
        for chunk_data in chunks:
            modified = await update_embedding_status(chunk_data["chunkId"], True)
            if modified:
                print(f"Updated isEmbedded to True for chunkId: {chunk_data['chunkId']}")

    except Exception as e:
        print("Failed to embed and store chunks:", str(e))

# Run the pipeline
if __name__ == "__main__":
    asyncio.run(embed_and_store())