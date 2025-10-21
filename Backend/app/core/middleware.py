from fastapi import Request, HTTPException
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
            logger.error("JWT_SECRET environment variable is not set. Please configure it in your .env file.")
            raise RuntimeError(
                "JWT_SECRET environment variable is not set. Please configure it in your .env file."
            )
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):
        if request.url.path.startswith(
            "/api/auth/"
        ):  # Allow auth endpoints without token
            return await call_next(request)
        token = request.headers.get("Authorization")
        if not token or not token.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="No token provided")
        try:
            payload = jwt.decode(token[7:], self.secret_key, algorithms=[ALGORITHM])
            user_id = payload.get("sub")
            role = payload.get("role")
            if not user_id:
                raise HTTPException(status_code=401, detail="Token missing 'sub' claim")
            request.state.user = {"id": user_id, "role": role}
        except ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token expired")
        except JWTError:
            raise HTTPException(status_code=401, detail="Invalid token")
        response = await call_next(request)
        return response