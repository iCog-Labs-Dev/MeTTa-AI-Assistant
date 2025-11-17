from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from jose import JWTError, jwt
from jose.exceptions import ExpiredSignatureError
import os
from loguru import logger

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

        if (
            request.method == "OPTIONS"
            or any(request.url.path.startswith(path) for path in PUBLIC_PATHS)
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
