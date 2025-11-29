"""
Unit tests for chat database functions.
Tests individual functions in isolation.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from bson import ObjectId
from datetime import datetime, timezone

from app.db.chat_db import (
    insert_chat_message,
    get_last_messages,
    create_chat_session,
    delete_chat_session,
    get_chat_session_by_id,
    get_chat_sessions,
    
)


class TestInsertChatMessage:
    """Unit tests for insert_chat_message function."""
    
    @pytest.mark.asyncio
    async def test_insert_chat_message_success(self):
        
        msg_data = {
            "sessionId": str(ObjectId()),
            "role": "user",
            "content": "Hello, world!",
        }
        
        mock_collection = AsyncMock()
        mock_collection.insert_one = AsyncMock()
        mock_mongo_db = MagicMock()
        
        with patch("app.db.chat_db._get_collection", return_value=mock_collection):
            result = await insert_chat_message(msg_data, mock_mongo_db)
            
            assert result is not None
            assert isinstance(result, str)
            mock_collection.insert_one.assert_called_once()
            
            call_args = mock_collection.insert_one.call_args[0][0]
            assert "messageId" in call_args
            assert "createdAt" in call_args
    
    @pytest.mark.asyncio
    async def test_insert_chat_message_with_id(self):
        """Test insertion with provided messageId."""
        message_id = str(ObjectId())
        msg_data = {
            "messageId": message_id,
            "sessionId": str(ObjectId()),
            "role": "user",
            "content": "Hello!",
        }
        
        mock_collection = AsyncMock()
        mock_collection.insert_one = AsyncMock()
        mock_mongo_db = MagicMock()
        
        with patch("app.db.chat_db._get_collection", return_value=mock_collection):
            result = await insert_chat_message(msg_data, mock_mongo_db)
            
            assert result == message_id
    
    @pytest.mark.asyncio
    async def test_insert_chat_message_validation_error(self):
        """Test insertion fails with invalid message data."""
        invalid_msg_data = {
            "sessionId": str(ObjectId()),
            # Missing required fields
        }
        
        mock_collection = AsyncMock()
        mock_mongo_db = MagicMock()
        
        with patch("app.db.chat_db._get_collection", return_value=mock_collection):
            result = await insert_chat_message(invalid_msg_data, mock_mongo_db)
            
            assert result is None
            mock_collection.insert_one.assert_not_called()


class TestGetLastMessages:
    """Unit tests for get_last_messages function."""
    
    @pytest.mark.asyncio
    async def test_get_last_messages_success(self):
        """Test successfully retrieving last messages."""
        session_id = str(ObjectId())
        limit = 5
        
        mock_messages = [
            {
                "messageId": str(ObjectId()),
                "sessionId": session_id,
                "content": f"Message {i}",
                "createdAt": datetime.now(timezone.utc),
            }
            for i in range(5)
        ]
        
        async def async_iter():
            for msg in reversed(mock_messages):
                yield msg
        
        class MockCursor:
            def __aiter__(self):
                return async_iter()
            
            def sort(self, *args, **kwargs):
                return self
            
            def limit(self, *args, **kwargs):
                return self
        
        mock_cursor = MockCursor()
        
        class MockCollection:
            def find(self, *args, **kwargs):
                return mock_cursor
        
        mock_collection = MockCollection()
        mock_mongo_db = MagicMock()
        
        with patch("app.db.chat_db._get_collection", return_value=mock_collection):
            result = await get_last_messages(session_id, limit, mock_mongo_db)
            
            assert len(result) == 5
            assert result[0]["content"] == "Message 0"


class TestCreateChatSession:
    """Unit tests for create_chat_session function."""
    
    @pytest.mark.asyncio
    async def test_create_chat_session_success(self):
        """Test successful chat session creation."""
        user_id = str(ObjectId())
        
        mock_collection = AsyncMock()
        mock_collection.insert_one = AsyncMock()
        mock_mongo_db = MagicMock()
        
        with patch("app.db.chat_db._get_collection", return_value=mock_collection):
            result = await create_chat_session(user_id, mock_mongo_db)
            
            assert result is not None
            assert isinstance(result, str)
            mock_collection.insert_one.assert_called_once()
            
            call_args = mock_collection.insert_one.call_args[0][0]
            assert call_args["sessionId"] == result
            assert call_args["userId"] == user_id
            assert "createdAt" in call_args


class TestDeleteChatSession:
    """Unit tests for delete_chat_session function."""
    
    @pytest.mark.asyncio
    async def test_delete_chat_session_success(self):
        """Test successfully deleting a chat session."""
        session_id = str(ObjectId())
        
        mock_collection = AsyncMock()
        mock_result = MagicMock()
        mock_result.deleted_count = 1
        mock_collection.delete_one = AsyncMock(return_value=mock_result)
        mock_mongo_db = MagicMock()
        
        with patch("app.db.chat_db._get_collection", return_value=mock_collection):
            result = await delete_chat_session(session_id, mock_mongo_db)
            
            assert result == 1
            mock_collection.delete_one.assert_called_once_with({"sessionId": session_id})
    
    @pytest.mark.asyncio
    async def test_delete_chat_session_not_found(self):
        """Test deleting non-existent session."""
        session_id = str(ObjectId())
        
        mock_collection = AsyncMock()
        mock_result = MagicMock()
        mock_result.deleted_count = 0
        mock_collection.delete_one = AsyncMock(return_value=mock_result)
        mock_mongo_db = MagicMock()
        
        with patch("app.db.chat_db._get_collection", return_value=mock_collection):
            result = await delete_chat_session(session_id, mock_mongo_db)
            
            assert result == 0


class TestGetChatSessionById:
    """Unit tests for get_chat_session_by_id function."""
    
    @pytest.mark.asyncio
    async def test_get_chat_session_by_id_success(self):
        """Test successfully retrieving session by ID."""
        session_id = str(ObjectId())
        mock_session = {
            "sessionId": session_id,
            "userId": str(ObjectId()),
            "createdAt": datetime.now(timezone.utc),
        }
        
        mock_collection = AsyncMock()
        mock_collection.find_one = AsyncMock(return_value=mock_session)
        mock_mongo_db = MagicMock()
        
        with patch("app.db.chat_db._get_collection", return_value=mock_collection):
            result = await get_chat_session_by_id(session_id, mock_mongo_db)
            
            assert result == mock_session
            mock_collection.find_one.assert_called_once_with(
                {"sessionId": session_id}, {"_id": 0}
            )
    
    @pytest.mark.asyncio
    async def test_get_chat_session_by_id_not_found(self):
        """Test retrieving non-existent session."""
        session_id = str(ObjectId())
        
        mock_collection = AsyncMock()
        mock_collection.find_one = AsyncMock(return_value=None)
        mock_mongo_db = MagicMock()
        
        with patch("app.db.chat_db._get_collection", return_value=mock_collection):
            result = await get_chat_session_by_id(session_id, mock_mongo_db)
            
            assert result is None


class TestGetChatSessions:
    """Unit tests for get_chat_sessions function."""
    
    @pytest.mark.asyncio
    async def test_get_chat_sessions_success(self):
        """Test successfully retrieving chat sessions."""
        user_id = str(ObjectId())
        page = 1
        limit = 20
        
        mock_sessions = [
            {
                "sessionId": str(ObjectId()),
                "userId": user_id,
                "createdAt": datetime.now(timezone.utc),
            }
            for _ in range(10)
        ]
        
        async def async_iter():
            for session in mock_sessions:
                yield session
        
        class MockCursor:
            def __aiter__(self):
                return async_iter()
            
            def sort(self, *args, **kwargs):
                return self
            
            def skip(self, *args, **kwargs):
                return self
            
            def limit(self, *args, **kwargs):
                return self
        
        mock_cursor = MockCursor()
        
        class MockCollection:
            def __init__(self):
                self.count_documents = AsyncMock(return_value=10)
            
            def find(self, *args, **kwargs):
                return mock_cursor
        
        mock_collection = MockCollection()
        mock_mongo_db = MagicMock()
        
        with patch("app.db.chat_db._get_collection", return_value=mock_collection):
            result = await get_chat_sessions(user_id, page, limit, mock_mongo_db)
            
            assert "sessions" in result
            assert result["total"] == 10
            assert result["page"] == page
            assert result["limit"] == limit
            assert len(result["sessions"]) == 10
    
    @pytest.mark.asyncio
    async def test_get_chat_sessions_pagination(self):
        """Test pagination of chat sessions."""
        user_id = str(ObjectId())
        page = 2
        limit = 5
        total = 12
        
        mock_collection = AsyncMock()
        mock_collection.count_documents = AsyncMock(return_value=total)
        
        mock_sessions = [
            {
                "sessionId": str(ObjectId()),
                "userId": user_id,
                "createdAt": datetime.now(timezone.utc),
            }
            for _ in range(5)
        ]
        
        async def async_iter():
            for session in mock_sessions:
                yield session
        
        class MockCursor:
            def __aiter__(self):
                return async_iter()
            
            def sort(self, *args, **kwargs):
                return self
            
            def skip(self, *args, **kwargs):
                return self
            
            def limit(self, *args, **kwargs):
                return self
        
        mock_cursor = MockCursor()
        
        class MockCollection:
            def __init__(self):
                self.count_documents = AsyncMock(return_value=total)
            
            def find(self, *args, **kwargs):
                return mock_cursor
        
        mock_collection = MockCollection()
        mock_mongo_db = MagicMock()
        
        with patch("app.db.chat_db._get_collection", return_value=mock_collection):
            result = await get_chat_sessions(user_id, page, limit, mock_mongo_db)
            
            assert result["page"] == 2
            assert result["total_pages"] == 3  
            assert result["has_next"] is True
            assert result["has_prev"] is True
    
    @pytest.mark.asyncio
    async def test_get_chat_sessions_empty_user_id(self):
        """Test that empty user_id raises ValueError."""
        with pytest.raises(ValueError, match="user_id is required"):
            await get_chat_sessions("", 1, 20, MagicMock())
    
    @pytest.mark.asyncio
    async def test_get_chat_sessions_invalid_page(self):
        """Test that invalid page number raises ValueError."""
        user_id = str(ObjectId())
        
        with pytest.raises(ValueError, match="page and limit must be positive"):
            await get_chat_sessions(user_id, 0, 20, MagicMock())

