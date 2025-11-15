from fastapi import FastAPI, Request, Response
import time
import os
from app.core.logging import setup_logging
from contextlib import asynccontextmanager
from typing import AsyncIterator, Dict
from app.core.middleware import AuthMiddleware
from pymongo import AsyncMongoClient
from pymongo.errors import PyMongoError
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer
from app.rag.embedding.metadata_index import setup_metadata_indexes, create_collection_if_not_exists
from qdrant_client import AsyncQdrantClient
from qdrant_client.http.models import VectorParams, Distance
from app.db.users import seed_admin
from app.core.utils.llm_utils import LLMClientFactory
from app.routers import chunks, auth, protected,chunk_annotation, chat, key_management, chat_sessions
from app.repositories.chunk_repository import ChunkRepository
from app.services.key_management_service import KMS

load_dotenv()
logger = setup_logging(log_level=os.getenv("LOG_LEVEL", "INFO"))

# --- Contextual loggers ---
db_logger = logger.with_prefix("[DB] ")
qdrant_logger = logger.with_prefix("[QDRANT] ")
llm_logger = logger.with_prefix("[LLM] ")
kms_logger = logger.with_prefix("[KMS] ")
app_logger = logger.with_prefix("[APP] ")

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    app_logger.info("Application has started")
    mongo_uri = os.getenv("MONGO_URI")
    mongo_db_name = os.getenv("MONGO_DB")
    if not mongo_uri:
        db_logger.error("MONGO_URI is not set. Please set the MONGO_URI environment variable.")
        raise RuntimeError("MONGO_URI environment variable is required")
    
    if not mongo_db_name:
        db_logger.error("MONGO_DB is not set. Please set the MONGO_DB environment variable.")
        raise RuntimeError("MONGO_DB environment variable is required")

    app.state.mongo_client = AsyncMongoClient(mongo_uri)
    app.state.mongo_db = app.state.mongo_client[mongo_db_name]

    # Validate connection by issuing a ping. If ping fails, close the client and stop startup.
    try:
        await app.state.mongo_db.command({"ping": 1})
        db_logger.info("Successfully connected to MongoDB")
        await seed_admin(app.state.mongo_db)
    except PyMongoError as e:
        db_logger.exception(f"Failed to connect to MongoDB: {e}")
        try:
            await app.state.mongo_client.close()
        except Exception:
            db_logger.exception("Error while closing MongoDB client after failed connect")
        raise RuntimeError("Unable to connect to MongoDB") from e

    try:
        repo = ChunkRepository(app.state.mongo_db)
        await repo._ensure_indexes()
        db_logger.info("Chunk indexes ensured")
    except Exception as e:
        db_logger.exception(f"Failed to ensure chunk indexes: {e}")

    # === Qdrant Setup ===
    qdrant_host = os.getenv("QDRANT_HOST")
    qdrant_port = int(os.getenv("QDRANT_PORT", 6333))
    collection_name = os.getenv("COLLECTION_NAME")

    if not qdrant_host or not collection_name:
        raise RuntimeError("QDRANT_HOST and COLLECTION_NAME must be set in .env")
   

    if isinstance(qdrant_host, str) and qdrant_host.startswith(("http://", "https://")):
        app.state.qdrant_client = AsyncQdrantClient(url=qdrant_host)
    else:
        app.state.qdrant_client = AsyncQdrantClient(host=qdrant_host, port=qdrant_port)
        
    try:
        await create_collection_if_not_exists(app.state.qdrant_client, collection_name)
        qdrant_logger.info("Qdrant collection setup completed")
    except Exception as e:
        qdrant_logger.error(f"Failed to create Qdrant collection: {e}")
        raise
    # Setup metadata indexes (optional, non-blocking)
    try:
        await setup_metadata_indexes(app.state.qdrant_client, collection_name)
        qdrant_logger.info("Metadata indexes setup completed")
    except Exception as e:
        qdrant_logger.warning(f"Metadata index setup skipped or failed: {e}")


    # === Embedding Model Setup ===
    app.state.embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
    llm_logger.info("Embedding model loaded and ready")

    # === LLM Provider Setup ===
    app.state.default_llm_provider = LLMClientFactory.create_default_client()
    logger.info(
        f"Default LLM provider: {app.state.default_llm_provider.get_model_name()}"
    )

    # ===== Key management service setup =====
    KEK = os.getenv("KEY_ENCRYPTION_KEY")
    if not KEK:
        raise ValueError("KEY_ENCRYPTION_KEY environment variable is required")
    
    try:
        app.state.kms = KMS(KEK)
        kms_logger.info("Key Management Service initialized")
    except ValueError as e:
        kms_logger.error(f"Invalid KMS_KEK: {e}")
        raise

    yield  # -----> Application runs here

    # === Shutdown cleanup ===
    try:
        await app.state.mongo_client.close()
        db_logger.info("MongoDB client closed")
    except Exception:
        db_logger.exception("Error closing MongoDB client during shutdown")

    try:
        await app.state.qdrant_client.close()
        qdrant_logger.info("Qdrant client closed")
    except Exception:
        qdrant_logger.exception("Error closing Qdrant client during shutdown")

    app_logger.info("Application shutdown complete.")


app = FastAPI(lifespan=lifespan)
app.add_middleware(AuthMiddleware)
app.include_router(chunks.router)
app.include_router(auth.router)
app.include_router(protected.router)
app.include_router(chat.router)
app.include_router(chunk_annotation.router)
app.include_router(key_management.router)
app.include_router(chat_sessions.router)


@app.middleware("http") 
async def log_requests(request: Request, call_next) -> Response:
    start_time = time.time()
    response = await call_next(request)
    duration_ms = int((time.time() - start_time) * 1000)
    app_logger.info(
        f"{request.method} {request.url.path} -> {response.status_code} ({duration_ms} ms)"
    )
    return response


@app.get("/health")
def health_check() -> Dict[str, str]:
    return {"status": "ok"}
