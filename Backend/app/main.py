from fastapi import FastAPI, Request, Response
import time
from loguru import logger
from contextlib import asynccontextmanager
from typing import AsyncIterator, Dict
from app.routers import chunks
from pymongo import AsyncMongoClient
import os
from pymongo.errors import PyMongoError
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer
from app.embedding.metadata_index import setup_metadata_indexes
from qdrant_client import AsyncQdrantClient
from qdrant_client.http.models import VectorParams, Distance


load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    logger.info("Application has started")
    mongo_uri = os.getenv("MONGO_URI")
    if not mongo_uri:
        logger.error("MONGO_URI is not set. Please set the MONGO_URI environment variable.")
        raise RuntimeError("MONGO_URI environment variable is required")

    app.state.mongo_client = AsyncMongoClient(mongo_uri)
    app.state.mongo_db = app.state.mongo_client["chunkDB"]

    # Validate connection by issuing a ping. If ping fails, close the client and stop startup.
    try:
        await app.state.mongo_db.command({"ping": 1})
        logger.info("Successfully connected to MongoDB")
    except PyMongoError as e:
        logger.exception("Failed to connect to MongoDB: {}", e)
        try:
            await app.state.mongo_client.close()
        except Exception:
            logger.exception("Error while closing MongoDB client after failed connect")
        raise RuntimeError("Unable to connect to MongoDB") from e

        # === Qdrant Setup ===
    qdrant_host = os.getenv("QDRANT_HOST")
    qdrant_port = int(os.getenv("QDRANT_PORT", 6333))
    collection_name = os.getenv("COLLECTION_NAME")

    if not qdrant_host or not collection_name:
        raise RuntimeError("QDRANT_HOST and COLLECTION_NAME must be set in .env")

    app.state.qdrant_client = AsyncQdrantClient(host=qdrant_host, port=qdrant_port)
    logger.info("Qdrant client initialized")

    # Setup metadata indexes (optional, non-blocking)
    try:
        await setup_metadata_indexes(app.state.qdrant_client, collection_name)
        logger.info("Metadata indexes setup completed")
    except Exception as e:
        logger.warning(f"Metadata index setup skipped or failed: {e}")

    # === Embedding Model Setup ===
    app.state.embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
    logger.info("Embedding model loaded and ready")

    yield  # -----> Application runs here

    # === Shutdown cleanup ===
    try:
        await app.state.mongo_client.close()
        logger.info("MongoDB client closed")
    except Exception:
        logger.exception("Error closing MongoDB client during shutdown")

    try:
        await app.state.qdrant_client.close()
        logger.info("Qdrant client closed")
    except Exception:
        logger.exception("Error closing Qdrant client during shutdown")

    logger.info("Application shutdown complete.")

app = FastAPI(lifespan=lifespan)
app.include_router(chunks.router)


@app.middleware("http") 
async def log_requests(request: Request, call_next) -> Response:
    start_time = time.time()
    response = await call_next(request)
    duration_ms = int((time.time() - start_time) * 1000)
    logger.info(
        f"{request.method} {request.url.path} -> {response.status_code} ({duration_ms} ms)"
    )
    return response

@app.get("/health")
def health_check() -> Dict[str, str]:
    return {"status": "ok"}
