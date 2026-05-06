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
    Query,
)
from fastapi.responses import StreamingResponse

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
    isLearning: bool = False
    moduleId: Optional[str] = None

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
            isLearning=chat_request.isLearning,
            moduleId=chat_request.moduleId,
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
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Chat request failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Chat failed: Retry later")


@router.post("/stream", summary="Stream chat response")
async def chat_stream(
    request: Request,
    chat_request: ChatRequest,
    background_tasks: BackgroundTasks,
    chat_service: ChatService = Depends(get_chat_service),
    current_user: dict = Depends(get_current_user),
):
    """
    Streaming chat endpoint.
    """
    provider = chat_request.provider
    if not provider:
        raise HTTPException(status_code=400, detail="Provider must be specified")

    encrypted_key = request.cookies.get(provider.lower())

    try:
        generator = await chat_service.process_streaming_chat_request(
            query=chat_request.query,
            user_id=current_user["id"],
            provider=provider,
            background_tasks=background_tasks,
            model=chat_request.model,
            mode=chat_request.mode,
            session_id=chat_request.session_id,
            encrypted_api_key=encrypted_key,
            top_k=chat_request.top_k,
            isLearning=chat_request.isLearning,
            moduleId=chat_request.moduleId,
        )

        streaming_response = StreamingResponse(
            generator,
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        )

        if encrypted_key and encrypted_key.strip():
            streaming_response.set_cookie(
                key=provider.lower(),
                value=encrypted_key,
                httponly=True,
                samesite="none",
                secure=True,
                expires=(datetime.now(timezone.utc) + timedelta(days=7)),
            )

        return streaming_response
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Streaming chat request failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Streaming failed")


# --- Curriculum and Learning Mode Endpoints (migrated from learning.py) ---
@router.get("/structure")
def get_curriculum(chat_service: ChatService = Depends(get_chat_service)):
    """Return the full curriculum structure (levels and modules)."""
    return chat_service.get_curriculum()

@router.get("/start")
def start_learning_mode(chat_service: ChatService = Depends(get_chat_service)):
    """Entry point for learning mode. Returns a welcome message and a flat list of all lessons."""
    curriculum_data = chat_service.get_curriculum()
    # Gather all lessons (content items) from all modules
    lessons = []
    for level in curriculum_data.get("levels", []):
        for module in level.get("modules", []):
            for lesson in module.get("content", []):
                lessons.append({
                    "module_id": module["id"],
                    "module_title": module["title"],
                    "level": level["title"],
                    "lesson": lesson
                })
    welcome_message = (
        "Hello, welcome to MeTTa learning mode! "
        "Here you will learn about MeTTa step by step. "
        "These are the main lessons you will cover: "
        + ", ".join([l["lesson"] for l in lessons]) + ". "
        "If you want to see the list of modules, just ask! "
        "You can progress in order, or if you feel comfortable, you can say things like 'jump to [module]' to skip ahead. "
        "At any point, you may be quizzed to check your understanding!")
    return {
        "message": welcome_message,
        "lessons": lessons
    }

@router.get("/progress/{user_id}/{chat_id}")
async def get_progress(user_id: str, chat_id: str, chat_service: ChatService = Depends(get_chat_service)):
    progress = await chat_service.get_user_progress(user_id, chat_id)
    return progress

@router.post("/complete/{user_id}/{chat_id}/{module_id}")
async def complete_module(user_id: str, chat_id: str, module_id: str, chat_service: ChatService = Depends(get_chat_service)):
    progress = await chat_service.complete_module(user_id, chat_id, module_id)
    return progress

@router.post("/self-claim/{user_id}/{chat_id}/{module_id}")
async def self_claim_module(user_id: str, chat_id: str, module_id: str, chat_service: ChatService = Depends(get_chat_service)):
    progress = await chat_service.self_claim_module(user_id, chat_id, module_id)
    return progress

@router.get("/module/{user_id}/{chat_id}/{module_id}")
async def get_module(user_id: str, chat_id: str, module_id: str, chat_service: ChatService = Depends(get_chat_service)):
    module = chat_service.get_module(module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    progress = await chat_service.get_user_progress(user_id, chat_id)
    unlocked = chat_service.module_unlocked(progress, module)
    if unlocked:
        return module
    else:
        missing = [pr for pr in module.get('prerequisites', []) if pr not in progress.completed_modules and pr not in progress.self_claimed_modules]
        return {
            "locked": True,
            "missing_prerequisites": missing,
            "message": f"This module is locked. Complete or claim: {missing}"
        }

@router.get("/quiz-prompt/{module_id}")
def get_quiz_prompt(module_id: str, chat_service: ChatService = Depends(get_chat_service)):
    module = chat_service.get_module(module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    prompt = (
        f"Generate a short quiz to test understanding of the following module: {module['title']}. "
        f"Module content: {module['content']}"
    )
    return {
        "module_id": module_id,
        "module_title": module["title"],
        "prompt": prompt,
        "content": module["content"]
    }
