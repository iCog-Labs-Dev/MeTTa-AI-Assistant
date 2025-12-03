import pytest
from datetime import datetime
from app.model.chat_message import ChatMessageSchema
from app.model.chunk import ChunkSchema, AnnotationStatus
from app.model.feedback import FeedbackSchema, FeedbackSentiment
from app.model.chat_session import ChatSessionSchema

class TestDataModels:
    """Test data model validation and serialization"""
    
    def test_chat_message_validation(self):
        """Test chat message model validation"""
        valid_data = {
            "messageId": "msg123",
            "sessionId": "sess456",
            "role": "user",
            "content": "Hello, world!",
            "createdAt": datetime.now()
        }
        
        message = ChatMessageSchema(**valid_data)
        assert message.messageId == "msg123"
        assert message.role == "user"
        assert message.content == "Hello, world!"
    
    def test_chunk_schema_validation(self):
        """Test chunk model validation with different sources"""
        # Code chunk
        code_chunk = {
            "chunkId": "code-chunk-1",
            "source": "code",
            "chunk": "(= (add x y) (+ x y))",
            "isEmbedded": False,
            "project": "math-library",
            "repo": "metta-math",
            "status": AnnotationStatus.RAW
        }
        
        chunk = ChunkSchema(**code_chunk)
        assert chunk.source == "code"
        assert chunk.project == "math-library"
        assert chunk.status == AnnotationStatus.RAW
        
        # Documentation chunk
        doc_chunk = {
            "chunkId": "doc-chunk-1", 
            "source": "documentation",
            "chunk": "MeTTa is a programming language...",
            "isEmbedded": True,
            "url": "https://metta-lang.dev/docs",
            "page_title": "Introduction",
            "category": "tutorial",
            "status": AnnotationStatus.ANNOTATED
        }
        
        doc = ChunkSchema(**doc_chunk)
        assert doc.source == "documentation"
        assert doc.url == "https://metta-lang.dev/docs"
        assert doc.status == AnnotationStatus.ANNOTATED
    
    def test_feedback_schema(self):
        """Test feedback model validation"""
        feedback_data = {
            "feedbackId": "fb123",
            "responseId": "resp456", 
            "sessionId": "sess789",
            "userId": "user001",
            "sentiment": FeedbackSentiment.POSITIVE,
            "comment": "Very helpful response!",
            "createdAt": datetime.now()
        }
        
        feedback = FeedbackSchema(**feedback_data)
        assert feedback.sentiment == FeedbackSentiment.POSITIVE
        assert feedback.comment == "Very helpful response!"
    
    def test_invalid_chat_message_role(self):
        """Test that invalid role raises validation error"""
        invalid_data = {
            "sessionId": "sess123",
            "role": "invalid_role",  # Should be 'user' or 'assistant'
            "content": "Test message",
            "createdAt": datetime.now()
        }
        
        with pytest.raises(ValueError):
            ChatMessageSchema(**invalid_data)