from typing import Optional, List
from pydantic import BaseModel
from pymongo.database import Database
from app.db.db import _get_collection

class UserProgressModel(BaseModel):
    user_id: str
    chat_id: str
    completed_modules: List[str] = []
    self_claimed_modules: List[str] = []

async def get_user_progress(user_id: str, chat_id: str, mongo_db: Database) -> UserProgressModel:
    collection = _get_collection(mongo_db, "learning_progress")
    doc = await collection.find_one({"user_id": user_id, "chat_id": chat_id})
    if doc:
        return UserProgressModel(**doc)
    return UserProgressModel(user_id=user_id, chat_id=chat_id)

async def save_user_progress(progress: UserProgressModel, mongo_db: Database):
    collection = _get_collection(mongo_db, "learning_progress")
    await collection.update_one(
        {"user_id": progress.user_id, "chat_id": progress.chat_id},
        {"$set": progress.model_dump()},
        upsert=True
    )
