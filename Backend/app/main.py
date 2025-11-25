from fastapi import FastAPI, Request, Response
import time
import os
from loguru import logger
from contextlib import asynccontextmanager
from typing import AsyncIterator, Dict
from app.core.middleware import AuthMiddleware, UserWindowRateLimiter
from pymongo import AsyncMongoClient
from pymongo.errors import PyMongoError
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer
from app.rag.embedding.metadata_index import (
    setup_metadata_indexes,
    create_collection_if_not_exists,
)
from qdrant_client import AsyncQdrantClient
from app.db.users import seed_admin
from app.core.utils.llm_utils import LLMClientFactory
from app.core.utils.helpers import get_required_env
from app.routers import (
    chunks,
    auth,
    protected,
    chunk_annotation,
    chat,
    key_management,
    chat_sessions,
    feedback
)
from app.repositories.chunk_repository import ChunkRepository
from app.services.key_management_service import KMS
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    logger.info("Application has started")
    mongo_uri = get_required_env("MONGO_URI")
    mongo_db_name = get_required_env("MONGO_DB")

    app.state.mongo_client = AsyncMongoClient(mongo_uri)
    app.state.mongo_db = app.state.mongo_client[mongo_db_name]

    # Validate connection by issuing a ping. If ping fails, close the client and stop startup.
    try:
        await app.state.mongo_db.command({"ping": 1})
        logger.info("Successfully connected to MongoDB")
        await seed_admin(app.state.mongo_db)
    except PyMongoError as e:
        logger.exception("Failed to connect to MongoDB: {}", e)
        try:
            await app.state.mongo_client.close()
        except Exception:
            logger.exception("Error while closing MongoDB client after failed connect")
        raise RuntimeError("Unable to connect to MongoDB") from e

    try:
        repo = ChunkRepository(app.state.mongo_db)
        await repo._ensure_indexes()
        logger.info("Chunk indexes ensured")
    except Exception as e:
        logger.exception(f"Failed to ensure chunk indexes: {e}")

    # === Qdrant Setup ===
    qdrant_host = get_required_env("QDRANT_HOST")
    qdrant_port = int(get_required_env("QDRANT_PORT", 6333))
    qdrant_api_key = os.getenv("QDRANT_API_KEY")
    collection_name = get_required_env("COLLECTION_NAME")

    if isinstance(qdrant_host, str) and qdrant_host.startswith(("http://", "https://")):
        app.state.qdrant_client = AsyncQdrantClient(url=qdrant_host, api_key=qdrant_api_key)
    else:
        app.state.qdrant_client = AsyncQdrantClient(host=qdrant_host, port=qdrant_port)

    
    try:
        await create_collection_if_not_exists(app.state.qdrant_client, collection_name)
        logger.info("Qdrant collection setup completed")
    except Exception as e:
        logger.error(f"Failed to create Qdrant collection: {e}")
        raise
    # Setup metadata indexes (optional, non-blocking)
    try:
        await setup_metadata_indexes(app.state.qdrant_client, collection_name)
        logger.info("Metadata indexes setup completed")
    except Exception as e:
        logger.warning(f"Metadata index setup skipped or failed: {e}")

    # === Embedding Model Setup ===
    app.state.embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
    logger.info("Embedding model loaded and ready")

    # === LLM Provider Setup ===
    app.state.default_llm_provider = LLMClientFactory.create_default_client()
    logger.info(
        f"Default LLM provider: {app.state.default_llm_provider.get_model_name()}"
    )

    # ===== Key management service setup =====
    KEK = get_required_env("KEY_ENCRYPTION_KEY")
    
    try:
        app.state.kms = KMS(KEK)
    except ValueError as e:
        logger.error(f"Invalid KMS_KEK: {e}")
        raise

    logger.info("Key Management Service initialized")
    yield

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
app.add_middleware(
    UserWindowRateLimiter,
    redis_url=get_required_env("REDIS_URL"),
    max_requests=int(get_required_env("MAX_REQUESTS")),
    window_seconds=int(get_required_env("WINDOW_SECONDS")),
)
app.add_middleware(AuthMiddleware)

frontend_url = get_required_env("FRONTEND_URL")
origins = [
    "http://localhost:5173",
]

if frontend_url:
    origins.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(chunks.router)
app.include_router(auth.router)
app.include_router(protected.router)
app.include_router(chat.router)
app.include_router(chunk_annotation.router)
app.include_router(feedback.router)
app.include_router(key_management.router)
app.include_router(chat_sessions.router)


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
