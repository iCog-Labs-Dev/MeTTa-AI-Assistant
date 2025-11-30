import pytest
from unittest.mock import AsyncMock, patch
from app.services.chunk_annotation_service import ChunkAnnotationService
from app.model.chunk import ChunkSchema, AnnotationStatus

class TestChunkAnnotationService:
    """Test the chunk annotation service"""
    
    @pytest.mark.asyncio
    async def test_annotate_single_chunk_success(self, mock_llm_client, mock_mongo_db):
        """Test successful single chunk annotation"""
        # Mock repository
        mock_repo = AsyncMock()
        mock_chunk = ChunkSchema(
            chunkId="test-chunk-1",
            source="code", 
            chunk="(= (factorial 0) 1)",
            status=AnnotationStatus.RAW
        )
        mock_repo.get_chunk_for_annotation.return_value = mock_chunk
        mock_repo.update_chunk_annotation.return_value = True
        
        # Mock LLM response
        mock_llm_client.generate_text.return_value = "Defines factorial function with base case"
        
        service = ChunkAnnotationService(mock_repo, mock_llm_client)
        result = await service.annotate_single_chunk("test-chunk-1")
        
        # Verify interactions
        mock_repo.get_chunk_for_annotation.assert_called_with("test-chunk-1")
        mock_llm_client.generate_text.assert_called_once()
        mock_repo.update_chunk_annotation.assert_called()
        
        assert result is not None
    
    @pytest.mark.asyncio 
    async def test_annotate_empty_chunk(self, mock_llm_client):
        """Test annotation of empty chunk fails validation"""
        mock_repo = AsyncMock()
        empty_chunk = ChunkSchema(
            chunkId="empty-chunk",
            source="code",
            chunk="",  # Empty content
            status=AnnotationStatus.RAW
        )
        mock_repo.get_chunk_for_annotation.return_value = empty_chunk
        
        service = ChunkAnnotationService(mock_repo, mock_llm_client)
        result = await service.annotate_single_chunk("empty-chunk")
        
        # Should return None for invalid chunk
        assert result is None
        mock_llm_client.generate_text.assert_not_called()
    
    @pytest.mark.asyncio
    async def test_batch_annotation(self, mock_llm_client):
        """Test batch annotation of multiple chunks"""
        mock_repo = AsyncMock()
        
        # Mock multiple chunks
        chunks = [
            ChunkSchema(chunkId=f"chunk-{i}", source="code", chunk=f"code {i}", status=AnnotationStatus.RAW)
            for i in range(3)
        ]
        mock_repo.get_unannotated_chunks.return_value = chunks
        mock_repo.update_chunk_annotation.return_value = True
        
        # Mock LLM responses
        mock_llm_client.generate_text.side_effect = [
            f"Description for chunk {i}" for i in range(3)
        ]
        
        service = ChunkAnnotationService(mock_repo, mock_llm_client)
        results = await service.batch_annotate_unannotated_chunks(limit=5)
        
        assert len(results) == 3
        assert all(f"chunk-{i}" in results for i in range(3))
        assert mock_llm_client.generate_text.call_count == 3