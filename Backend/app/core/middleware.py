from fastapi import Request, HTTPException, Depends
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from jose import JWTError, jwt
from jose.exceptions import ExpiredSignatureError
import os
from loguru import logger
from app.dependencies import get_current_user
from redis.asyncio import Redis

ALGORITHM = "HS256"


class AuthMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        self.secret_key = os.getenv("JWT_SECRET")
        if not self.secret_key:
            logger.error(
                "JWT_SECRET environment variable is not set. Please configure it in your .env file."
            )
            raise RuntimeError(
                "JWT_SECRET environment variable is not set. Please configure it in your .env file."
            )
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):
        # Allow unauthenticated access to auth endpoints, health checks, and preflight
        PUBLIC_PATHS = [
            "/api/auth/",
            "/health",
            "/openapi.json",
            "/docs",
            "/redoc",
        ]

        if request.method == "OPTIONS" or any(
            request.url.path.startswith(path) for path in PUBLIC_PATHS
        ):
            return await call_next(request)

        token = request.headers.get("Authorization")
        if not token or not token.startswith("Bearer "):
            return JSONResponse(
                status_code=401, content={"detail": "No token provided"}
            )
        try:
            payload = jwt.decode(token[7:], self.secret_key, algorithms=[ALGORITHM])
            user_id = payload.get("sub")
            role = payload.get("role")
            if not user_id:
                return JSONResponse(
                    status_code=401, content={"detail": "Token missing 'sub' claim"}
                )
            request.state.user = {"id": user_id, "role": role}
        except ExpiredSignatureError:
            return JSONResponse(status_code=401, content={"detail": "Token expired"})
        except JWTError:
            return JSONResponse(status_code=401, content={"detail": "Invalid token"})
        except Exception:
            logger.exception("Unexpected error while processing auth token")
            return JSONResponse(
                status_code=500, content={"detail": "Internal authentication error"}
            )

        return await call_next(request)
    
class UserWindowRateLimiter(BaseHTTPMiddleware):
    def __init__(
        self,
        app,
        redis_url="redis://localhost:6379/0",
        max_requests: int = 100,
        window_seconds: int = 86400,
    ):
        super().__init__(app)
        self.redis = Redis.from_url(redis_url, decode_responses=True)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.secret_key = os.getenv("JWT_SECRET")

    def _is_using_user_api_key(self, request: Request) -> bool:
        
        gemini_cookie = request.cookies.get("gemini")
        openai_cookie = request.cookies.get("openai")
        
        return bool(gemini_cookie or openai_cookie)

    async def dispatch(self, request: Request, call_next):
        if not request.url.path.startswith("/api/chat"):
            return await call_next(request)
        
        token = request.headers.get("Authorization")
        payload = jwt.decode(token[7:], self.secret_key, algorithms=[ALGORITHM])
        user_id = payload.get("sub")

        if self._is_using_user_api_key(request):
            
            logger.debug(f"Rate limiting skipped for user {user_id} - using own API key")
            
            return await call_next(request)


        logger.debug(f"Rate limiting applied for user {user_id} - using system API key")

        redis_key = f"ratelimit:rolling24h:{user_id}"

        req_count = await self.redis.incr(redis_key)
        
        if req_count == 1:
            await self.redis.expire(redis_key, self.window_seconds)

        if req_count > self.max_requests:
            ttl_remaining = await self.redis.ttl(redis_key)
            logger.warning(f"Rate limit exceeded for user {user_id}. Try again in {ttl_remaining} seconds.")
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded. Try again in {ttl_remaining} seconds.",
            )

        return await call_next(request)
