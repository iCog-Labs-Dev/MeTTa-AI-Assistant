from fastapi import APIRouter, HTTPException, status, Depends, Response
from app.db.users import create_user, UserCreate, UserRole
from app.services.auth import authenticate_user, create_access_token, create_refresh_token, get_secret_key
from app.db.db import _get_collection  
from app.dependencies import get_mongo_db, get_kms
from app.services.key_management_service import KMS
from pymongo.database import Database
from bson import ObjectId
from pydantic import BaseModel 
from jose import JWTError, jwt
from jose.exceptions import ExpiredSignatureError
from datetime import datetime, timedelta, timezone
from loguru import logger
from app.core.security import encrypt_cookie_value

class LoginRequest(BaseModel):
    email: str
    password: str

class RefreshRequest(BaseModel):
    refresh_token: str

router = APIRouter(
    prefix="/api/auth",
    tags=["auth"],
    responses={404: {"description": "Not found"}},
)
ALGORITHM = "HS256"

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str

@router.post("/signup", response_model=dict, status_code=status.HTTP_201_CREATED)
async def signup(user: UserCreate, mongo_db: Database = Depends(get_mongo_db)):
    # Temporarily disable signup
    raise HTTPException(status_code=403, detail="Signup is temporarily disabled")
    
    # user.role = UserRole.USER
    # try:
    #     user_id = await create_user(user, mongo_db)
    # except ValueError:
    #     raise HTTPException(status_code=400, detail={"message": "Email in use"})
    # except Exception:
    #     raise HTTPException(status_code=500, detail="User creation failed")
        
    # return {"message": "User created", "user_id": str(user_id)}

@router.post("/login")
async def login(
    login_data: LoginRequest, 
    response: Response,
    mongo_db: Database = Depends(get_mongo_db),
    kms: KMS = Depends(get_kms)
):
    """
    Authenticate user and decrypt all their API keys.
    
    On successful login:
    1. Verify credentials
    2. Decrypt all stored API keys using the password
    3. Encrypt keys with session-specific key
    4. Store encrypted keys in secure HTTP-only cookies (format: {provider}_{key_id})
    5. Return JWT tokens
    """
    
    # Authenticate user
    user = await authenticate_user(login_data.email, login_data.password, mongo_db)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user_id = str(user["_id"])
    
    try:
        decrypted_keys = await kms.decrypt_all_keys(
            user_id, 
            login_data.password, 
            mongo_db
        )
        
        # Create cookies with format: {provider}_{key_id}
        for key_info in decrypted_keys:
            key_id = key_info["key_id"]
            provider_name = key_info["provider_name"]
            api_key = key_info["api_key"]
            
            encrypted_cookie_value = encrypt_cookie_value(api_key, user_id, get_secret_key())
            
            # Cookie name format: gemini_507f1f77bcf86cd799439011
            cookie_name = f"{provider_name}_{key_id}"
            
            response.set_cookie(
                key=cookie_name,
                value=encrypted_cookie_value,
                httponly=True,
                secure=True,
                samesite="none",
                expires=(datetime.now(timezone.utc) + timedelta(days=7))
            )
        
        logger.info(f"Decrypted and stored {len(decrypted_keys)} encrypted keys for user {user_id}")
        
    except Exception as e:
        logger.warning(f"Failed to decrypt keys for user {user_id}: {e}")

    
    access_token = create_access_token({"sub": user_id, "role": user["role"]})
    refresh_token = create_refresh_token({"sub": user_id, "role": user["role"]})
    
    return {
        "access_token": access_token, 
        "refresh_token": refresh_token, 
        "token_type": "bearer"
    }

@router.post("/refresh", response_model=TokenResponse)
async def refresh(refresh_request: RefreshRequest, mongo_db: Database = Depends(get_mongo_db)):
    try:
        payload = jwt.decode(refresh_request.refresh_token, get_secret_key(), algorithms=[ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=400, detail="Invalid refresh token")
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Token missing 'sub' claim")
        user = await _get_collection(mongo_db, "users").find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        new_access_token = create_access_token({"sub": user_id, "role": user["role"]})
        new_refresh_token = create_refresh_token({"sub": user_id, "role": user["role"]})
        return {"access_token": new_access_token, "refresh_token": new_refresh_token, "token_type": "bearer"}
    except ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")