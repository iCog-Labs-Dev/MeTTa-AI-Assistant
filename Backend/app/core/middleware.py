from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from jose import JWTError, jwt
from jose.exceptions import ExpiredSignatureError
import os
from loguru import logger
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
        redis_url,
        max_requests: int,
        window_seconds: int,
    ):
        super().__init__(app)
        self.redis = Redis.from_url(redis_url, decode_responses=True)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.atomic_incr_script = """
            local key = KEYS[1]
            local window_seconds = tonumber(ARGV[1])
            
            local current_count = redis.call('INCR', key)
            
            if current_count == 1 then
                redis.call('EXPIRE', key, window_seconds)
            end
            
            return current_count
        """
    
    async def _is_using_user_api_key(self, request: Request, user_id: str) -> bool:
        """Check if user is using their own API key (and it's valid).
        
        Validates that:
        1. Cookie exists and is non-empty
        2. Cookie can be successfully decrypted
        
        Args:
            request: The incoming request
            user_id: The user ID from the JWT token
            
        Returns:
            bool: True if user has a valid API key cookie, False otherwise
        """
        gemini_cookie = request.cookies.get("gemini")
        openai_cookie = request.cookies.get("openai")
        
        # Get KMS and DB from app.state
        kms = request.app.state.kms
        mongo_db = request.app.state.mongo_db
        
        # Check gemini cookie
        if gemini_cookie and gemini_cookie.strip():
            try:
                decrypted = await kms.decrypt_api_key(gemini_cookie, user_id, "gemini", mongo_db)
                if decrypted and decrypted.strip():
                    logger.debug(f"Valid gemini API key for user {user_id}")
                    return True
            except Exception as e:
                logger.warning(f"Invalid gemini cookie for user {user_id}: {e}")
        
        # Check openai cookie
        if openai_cookie and openai_cookie.strip():
            try:
                decrypted = await kms.decrypt_api_key(openai_cookie, user_id, "openai", mongo_db)
                if decrypted and decrypted.strip():
                    logger.debug(f"Valid openai API key for user {user_id}")
                    return True
            except Exception as e:
                logger.warning(f"Invalid openai cookie for user {user_id}: {e}")
        
        # Log if user had cookies but none were valid
        if gemini_cookie or openai_cookie:
            logger.info(f"User {user_id} has API key cookies but none are valid")
        
        return False

    async def dispatch(self, request: Request, call_next):
        if not request.url.path.startswith("/api/chat"):
            return await call_next(request)
        
        user = getattr(request.state, "user", None)
        if not user:
            return JSONResponse(status_code=401, content={"detail": "Unauthorized"})

        user_id = user["id"]
        user_role = user.get("role")

        if await self._is_using_user_api_key(request, user_id):
            
            logger.debug(f"Rate limiting skipped for user {user_id} - using own API key")
            
            return await call_next(request)

        if user_role != "user":
            logger.debug(f"Rate limiting skipped for user {user_id} - not a regular user")
            return await call_next(request)
        
        logger.debug(f"Rate limiting applied for user {user_id} - using system API key")

        redis_key = f"ratelimit:fixed{self.window_seconds}s:{user_id}"

        req_count = await self.redis.eval(
            self.atomic_incr_script,
            1,
            redis_key,
            self.window_seconds
        )

        if req_count > self.max_requests:
            ttl_remaining = await self.redis.ttl(redis_key)
            logger.warning(f"Rate limit exceeded for user {user_id}. Try again in {ttl_remaining} seconds.")
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded. Try again in {ttl_remaining} seconds.",
            )
            
        response = await call_next(request)
        
        response.headers["X-RateLimit-Limit"] = str(self.max_requests)
        response.headers["X-RateLimit-Remaining"] = str(self.max_requests - req_count)
        response.headers["X-RateLimit-Reset"] = str(await self.redis.ttl(redis_key))
        
        return response