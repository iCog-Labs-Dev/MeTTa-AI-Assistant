from fastapi import FastAPI, Request, Response
import time
from loguru import logger
from contextlib import asynccontextmanager
from typing import AsyncIterator, Dict
from app.routers import chunks


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    logger.info("Application has started")
    yield
    logger.info("Application shutting down .....")

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
