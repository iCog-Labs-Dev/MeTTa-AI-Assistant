from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum


class FeedbackSentiment(str, Enum):
    """Simple feedback sentiment"""
    POSITIVE = "positive"
    NEUTRAL = "neutral"
    NEGATIVE = "negative"


class FeedbackSchema(BaseModel):
    """Simple feedback schema"""
    feedbackId: str
    responseId: str
    sessionId: str
    userId: str
    sentiment: FeedbackSentiment
    comment: Optional[str] = Field(None, max_length=500)
    createdAt: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_schema_extra = {
            "example": {
                "feedbackId": "fb_123",
                "responseId": "resp_456",
                "sessionId": "sess_789",
                "userId": "user_001",
                "sentiment": "positive",
                "comment": "Great response!",
                "createdAt": "2024-11-11T14:00:00Z"
            }
        }
