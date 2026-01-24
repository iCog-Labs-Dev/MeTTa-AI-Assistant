from typing import Optional, Literal
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel, Field
from fastapi import (
    APIRouter,
    HTTPException,
    Depends,
    Request,
    Response,
    BackgroundTasks,
)

from app.dependencies import get_chat_service, get_current_user
from app.services.chat_service import ChatService
from app.core.logging import logger

router = APIRouter(
    prefix="/api/chat",
    tags=["chat"],
    responses={404: {"description": "Not found"}},
)


class ChatRequest(BaseModel):
    query: str
    provider: Literal["openai", "gemini"] = "gemini"
    model: Optional[str] = None
    mode: Literal["search", "generate"] = "generate"
    top_k: int = Field(default=5, ge=1, le=50)
    session_id: Optional[str] = None

@router.post("/", summary="Chat with RAG system")
async def chat(
    request: Request,
    response: Response,
    chat_request: ChatRequest,
    background_tasks: BackgroundTasks,
    chat_service: ChatService = Depends(get_chat_service),
    current_user: dict = Depends(get_current_user),
):
    """
    Chat endpoint that handles both search and generate modes.
    
    - Decrypts user API keys from cookies if provided
    - Creates or uses existing chat session
    - Performs semantic search or generates RAG response
    - Refreshes cookie expiration on successful key usage
    """
    provider = chat_request.provider
    
    if not provider:
        raise HTTPException(status_code=400, detail="Provider must be specified")
    
    # Extract encrypted API key from cookie
    encrypted_key = request.cookies.get(provider.lower())
    
    try:
        # Process chat request through service
        result = await chat_service.process_chat_request(
            query=chat_request.query,
            user_id=current_user["id"],
            provider=provider,
            background_tasks=background_tasks,
            mode=chat_request.mode,
            model=chat_request.model,
            session_id=chat_request.session_id,
            encrypted_api_key=encrypted_key,
            top_k=chat_request.top_k,
        )
        
        # Refresh cookie expiration if user provided valid API key
        if encrypted_key and encrypted_key.strip():
            response.set_cookie(
                key=provider.lower(),
                value=encrypted_key,
                httponly=True,
                samesite="none",
                secure=True,
                expires=(datetime.now(timezone.utc) + timedelta(days=7)),
            )
        
        return result
        
    except Exception as e:
        logger.error(f"Chat request failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Chat failed: Retry later")