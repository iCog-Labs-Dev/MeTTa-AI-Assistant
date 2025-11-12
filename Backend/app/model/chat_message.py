from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime

class ChatMessageSchema(BaseModel):
    messageId: Optional[str] = None
    sessionId: str
    role: Literal["user", "assistant"]
    content: str
    createdAt: datetime
