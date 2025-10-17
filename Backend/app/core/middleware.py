from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from jose import JWTError, jwt
from jose.exceptions import ExpiredSignatureError
import os
from loguru import logger

ALGORITHM = "HS256"
PUBLIC_PATHS = ["/api/auth/login", "/api/auth/register"]  

class AuthMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        self.secret_key = os.getenv("JWT_SECRET")
        if not self.secret_key:
            raise RuntimeError(
                "JWT_SECRET environment variable is not set. Please configure it in your .env file."
            )
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):
        # Skip authentication for public endpoints
        if any(request.url.path.startswith(p) for p in PUBLIC_PATHS):
            return await call_next(request)

        token = request.headers.get("Authorization")
        if not token:
            raise HTTPException(status_code=401, detail="No token provided")

        try:
            # Safely split "Bearer <token>"
            scheme, jwt_token = token.split()
            if scheme.lower() != "bearer":
                raise HTTPException(status_code=401, detail="Invalid authentication scheme")

            # Decode JWT
            payload = jwt.decode(jwt_token, self.secret_key, algorithms=[ALGORITHM])
            user_id = payload.get("sub")
            role = payload.get("role") or "user"  # Default role if missing
            if not user_id:
                raise HTTPException(status_code=401, detail="Token missing 'sub' claim")

            # Store user info in request.state for downstream routes
            request.state.user = {"id": user_id, "role": role}

        except ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token expired")
        except JWTError as e:
            logger.warning("JWTError: {}", e)
            raise HTTPException(status_code=401, detail="Invalid token")
        except ValueError:
            # Raised if split() fails
            raise HTTPException(status_code=401, detail="Malformed Authorization header")

        # Proceed to next middleware or route
        response = await call_next(request)
        return response
