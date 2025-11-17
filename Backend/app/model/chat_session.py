from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.model.chat_message import ChatMessageSchema

class ChatSessionSchema(BaseModel):
    sessionId: str
    createdAt: datetime
    userId: Optional[str] = None


class ChatSessionCreate(BaseModel):
    userId: str

class ChatSessionWithMessages(ChatSessionSchema):
    messages: List[ChatMessageSchema] = []