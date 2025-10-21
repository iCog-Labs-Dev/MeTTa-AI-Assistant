from jose import JWTError, jwt
from passlib.context import CryptContext
from typing import Optional, Dict
from pymongo.database import Database
from loguru import logger
import os
from app.db.db import _get_collection
import time


def get_secret_key():
    secret_key = os.getenv("JWT_SECRET")
    if not secret_key:
        logger.error("JWT_SECRET environment variable is not set. Please configure it in your .env file.")
        raise RuntimeError(
            "JWT_SECRET environment variable is not set. Please configure it in your .env file."
        )
    return secret_key


ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def authenticate_user(
    email: str, password: str, mongo_db: Database
) -> Optional[Dict]:
    collection = _get_collection(mongo_db, "users")
    user = await collection.find_one({"email": email})
    if user and pwd_context.verify(password, user["hashed_password"]):
        return user
    return None


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = ACCESS_TOKEN_EXPIRE_MINUTES * 60  # Convert to seconds
    to_encode.update({"exp": int(time.time()) + expire})
    encoded_jwt = jwt.encode(to_encode, get_secret_key(), algorithm=ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60  # Convert days to seconds
    to_encode.update({"exp": int(time.time()) + expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, get_secret_key(), algorithm=ALGORITHM)
    return encoded_jwt
