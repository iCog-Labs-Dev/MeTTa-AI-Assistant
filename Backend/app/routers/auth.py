from fastapi import APIRouter, HTTPException, status, Depends
from app.db.users import create_user, UserCreate, UserRole
from app.services.auth import authenticate_user, create_access_token, create_refresh_token, get_secret_key
from app.db.db import _get_collection  
from app.dependencies import get_mongo_db  
from pymongo.database import Database
from bson import ObjectId
from pydantic import BaseModel 
from jose import JWTError, jwt
from jose.exceptions import ExpiredSignatureError

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

@router.post("/login", response_model=TokenResponse)
async def login(login_data: LoginRequest, mongo_db: Database = Depends(get_mongo_db)):
    user = await authenticate_user(login_data.email, login_data.password, mongo_db)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    access_token = create_access_token({"sub": str(user["_id"]), "role": user["role"]})
    refresh_token = create_refresh_token({"sub": str(user["_id"]), "role": user["role"]})
    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}

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