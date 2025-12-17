"""
Unit tests for chunk database functions.
Tests individual functions in isolation.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from bson import ObjectId
from datetime import datetime, timezone

from app.db.db import (
    insert_chunk,
    get_chunk_by_id,
    get_chunks,
    update_chunk,
    update_embedding_status,
    delete_chunk,
    _get_collection,
)


class TestGetCollection:
    """Unit tests for _get_collection function."""
    
    def test_get_collection_success(self):
        """Test successfully getting a collection."""
        mock_db = MagicMock()
        mock_collection = MagicMock()
        mock_db.get_collection = MagicMock(return_value=mock_collection)
        
        result = _get_collection(mock_db, "chunks")
        
        assert result == mock_collection
        mock_db.get_collection.assert_called_once_with("chunks")
    
    def test_get_collection_no_database(self):
        """Test that missing database raises RuntimeError."""
        with pytest.raises(RuntimeError, match="Database connection not initialized"):
            _get_collection(None, "chunks")


class TestInsertChunk:
    """Unit tests for insert_chunk function."""
    
    @pytest.mark.asyncio
    async def test_insert_chunk_success(self):
        """Test successful chunk insertion."""
        chunk_data = {
            "chunkId": "chunk123",
            "chunk": "Test chunk content",
            "source": "code",
            "isEmbedded": False,
            "project": "test_project",
            "repo": "test_repo",
        }
        
        mock_collection = AsyncMock()
        mock_collection.find_one = AsyncMock(return_value=None)
        mock_collection.insert_one = AsyncMock()
        mock_mongo_db = MagicMock()
        
        with patch("app.db.db._get_collection", return_value=mock_collection):
            result = await insert_chunk(chunk_data, mock_mongo_db)
            
            assert result == "chunk123"
            mock_collection.find_one.assert_called_once_with({"chunkId": "chunk123"})
            mock_collection.insert_one.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_insert_chunk_duplicate(self):
        """Test insertion fails when chunk already exists."""
        chunk_data = {
            "chunkId": "chunk123",
            "chunk": "Test chunk content",
            "source": "code",
        }
        
        existing_chunk = {"chunkId": "chunk123", "_id": ObjectId()}
        mock_collection = AsyncMock()
        mock_collection.find_one = AsyncMock(return_value=existing_chunk)
        mock_mongo_db = MagicMock()
        
        with patch("app.db.db._get_collection", return_value=mock_collection):
            result = await insert_chunk(chunk_data, mock_mongo_db)
            
            assert result is None
            mock_collection.insert_one.assert_not_called()
    
    @pytest.mark.asyncio
    async def test_insert_chunk_validation_error(self):
        """Test insertion fails with invalid chunk data."""
        invalid_chunk_data = {
            "chunkId": "chunk123",
        }
        
        mock_collection = AsyncMock()
        mock_mongo_db = MagicMock()
        
        with patch("app.db.db._get_collection", return_value=mock_collection):
            result = await insert_chunk(invalid_chunk_data, mock_mongo_db)
            
            assert result is None
            mock_collection.insert_one.assert_not_called()


class TestGetChunkById:
    """Unit tests for get_chunk_by_id function."""
    
    @pytest.mark.asyncio
    async def test_get_chunk_by_id_success(self):
        """Test successfully retrieving chunk by ID."""
        chunk_id = "chunk123"
        mock_chunk = {
            "chunkId": chunk_id,
            "chunk": "Test chunk",
            "source": "code",
        }
        
        mock_collection = AsyncMock()
        mock_collection.find_one = AsyncMock(return_value=mock_chunk)
        mock_mongo_db = MagicMock()
        
        with patch("app.db.db._get_collection", return_value=mock_collection):
            result = await get_chunk_by_id(chunk_id, mock_mongo_db)
            
            assert result == mock_chunk
            mock_collection.find_one.assert_called_once_with(
                {"chunkId": chunk_id}, {"_id": 0}
            )
    
    @pytest.mark.asyncio
    async def test_get_chunk_by_id_not_found(self):
        """Test retrieving non-existent chunk."""
        chunk_id = "nonexistent"
        
        mock_collection = AsyncMock()
        mock_collection.find_one = AsyncMock(return_value=None)
        mock_mongo_db = MagicMock()
        
        with patch("app.db.db._get_collection", return_value=mock_collection):
            result = await get_chunk_by_id(chunk_id, mock_mongo_db)
            
            assert result is None


class TestGetChunks:
    """Unit tests for get_chunks function."""
    
    @pytest.mark.asyncio
    async def test_get_chunks_with_filter(self):
        """Test retrieving chunks with filter."""
        mock_chunks = [
            {"chunkId": "chunk1", "project": "test"},
            {"chunkId": "chunk2", "project": "test"},
        ]
        
        async def async_iter():
            for chunk in mock_chunks:
                yield chunk
        
        class MockCursor:
            def __aiter__(self):
                return async_iter()
            
            def limit(self, *args, **kwargs):
                return self
        
        mock_cursor = MockCursor()
        
        class MockCollection:
            def find(self, *args, **kwargs):
                return mock_cursor
        
        mock_collection = MockCollection()
        mock_mongo_db = MagicMock()
        
        with patch("app.db.db._get_collection", return_value=mock_collection):
            result = await get_chunks({"project": "test"}, limit=10, mongo_db=mock_mongo_db)
            
            assert len(result) == 2
            assert result[0]["chunkId"] == "chunk1"
    
    @pytest.mark.asyncio
    async def test_get_chunks_default_limit(self):
        """Test retrieving chunks with default limit."""
        mock_chunks = [{"chunkId": f"chunk{i}"} for i in range(5)]
        
        async def async_iter():
            for chunk in mock_chunks:
                yield chunk
        
        class MockCursor:
            def __aiter__(self):
                return async_iter()
            
            def limit(self, *args, **kwargs):
                return self
        
        mock_cursor = MockCursor()
        
        class MockCollection:
            def find(self, *args, **kwargs):
                return mock_cursor
        
        mock_collection = MockCollection()
        mock_mongo_db = MagicMock()
        
        with patch("app.db.db._get_collection", return_value=mock_collection):
            result = await get_chunks(limit=10, mongo_db=mock_mongo_db)
            
            assert len(result) == 5


class TestUpdateChunk:
    """Unit tests for update_chunk function."""
    
    @pytest.mark.asyncio
    async def test_update_chunk_success(self):
        """Test successfully updating a chunk."""
        chunk_id = "chunk123"
        updates = {"chunk": "Updated content"}
        
        mock_collection = AsyncMock()
        mock_result = MagicMock()
        mock_result.modified_count = 1
        mock_collection.update_one = AsyncMock(return_value=mock_result)
        mock_mongo_db = MagicMock()
        
        with patch("app.db.db._get_collection", return_value=mock_collection):
            result = await update_chunk(chunk_id, updates, mock_mongo_db)
            
            assert result == 1
            mock_collection.update_one.assert_called_once_with(
                {"chunkId": chunk_id}, {"$set": updates}
            )
    
    @pytest.mark.asyncio
    async def test_update_chunk_not_found(self):
        """Test updating non-existent chunk."""
        chunk_id = "nonexistent"
        updates = {"chunk": "Updated content"}
        
        mock_collection = AsyncMock()
        mock_result = MagicMock()
        mock_result.modified_count = 0
        mock_collection.update_one = AsyncMock(return_value=mock_result)
        mock_mongo_db = MagicMock()
        
        with patch("app.db.db._get_collection", return_value=mock_collection):
            result = await update_chunk(chunk_id, updates, mock_mongo_db)
            
            assert result == 0


class TestUpdateEmbeddingStatus:
    """Unit tests for update_embedding_status function."""
    
    @pytest.mark.asyncio
    async def test_update_embedding_status_single_chunk(self):
        """Test updating embedding status for a single chunk."""
        chunk_id = "chunk123"
        status = True
        
        mock_collection = AsyncMock()
        mock_result = MagicMock()
        mock_result.modified_count = 1
        mock_collection.update_one = AsyncMock(return_value=mock_result)
        mock_mongo_db = MagicMock()
        
        with patch("app.db.db._get_collection", return_value=mock_collection):
            result = await update_embedding_status(chunk_id, status, mock_mongo_db)
            
            assert result == 1
            mock_collection.update_one.assert_called_once_with(
                {"chunkId": chunk_id}, {"$set": {"isEmbedded": status}}
            )
    
    @pytest.mark.asyncio
    async def test_update_embedding_status_multiple_chunks(self):
        """Test updating embedding status for multiple chunks."""
        chunk_ids = ["chunk1", "chunk2", "chunk3"]
        status = True
        
        mock_collection = AsyncMock()
        mock_result = MagicMock()
        mock_result.modified_count = 3
        mock_collection.update_many = AsyncMock(return_value=mock_result)
        mock_mongo_db = MagicMock()
        
        with patch("app.db.db._get_collection", return_value=mock_collection):
            result = await update_embedding_status(chunk_ids, status, mock_mongo_db)
            
            assert result == 3
            mock_collection.update_many.assert_called_once_with(
                {"chunkId": {"$in": chunk_ids}}, {"$set": {"isEmbedded": status}}
            )


class TestDeleteChunk:
    """Unit tests for delete_chunk function."""
    
    @pytest.mark.asyncio
    async def test_delete_chunk_success(self):
        """Test successfully deleting a chunk."""
        chunk_id = "chunk123"
        
        mock_collection = AsyncMock()
        mock_result = MagicMock()
        mock_result.deleted_count = 1
        mock_collection.delete_one = AsyncMock(return_value=mock_result)
        mock_mongo_db = MagicMock()
        
        with patch("app.db.db._get_collection", return_value=mock_collection):
            result = await delete_chunk(chunk_id, mock_mongo_db)
            
            assert result == 1
            mock_collection.delete_one.assert_called_once_with({"chunkId": chunk_id})
    
    @pytest.mark.asyncio
    async def test_delete_chunk_not_found(self):
        """Test deleting non-existent chunk."""
        chunk_id = "nonexistent"
        
        mock_collection = AsyncMock()
        mock_result = MagicMock()
        mock_result.deleted_count = 0
        mock_collection.delete_one = AsyncMock(return_value=mock_result)
        mock_mongo_db = MagicMock()
        
        with patch("app.db.db._get_collection", return_value=mock_collection):
            result = await delete_chunk(chunk_id, mock_mongo_db)
            
            assert result == 0

