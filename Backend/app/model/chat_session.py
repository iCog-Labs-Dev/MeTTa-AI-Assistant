from pydantic import BaseModel
from typing import Optional


class ChatSessionSchema(BaseModel):
    sessionId: str
    createdAt: Optional[int] = None
    userId: Optional[str] = None
