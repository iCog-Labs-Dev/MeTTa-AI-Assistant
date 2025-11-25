import os
import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException, status
from pymongo.database import Database

from app.routers.chunks import (
    ingest_repository,
    update_chunk_endpoint,
    delete_chunk_endpoint,
    list_chunks,
    run_embedding_pipeline,
    semantic_search,
    ChunkUpdate
)

# -------------------------------
# Tests for POST /api/chunks/ingest
# -------------------------------

@pytest.mark.asyncio
async def test_ingest_repository_success():
    mock_db = MagicMock(spec=Database)
    with patch("app.routers.chunks.ingest_pipeline", new_callable=AsyncMock) as mock_pipeline:
        response = await ingest_repository("https://fake.repo", mongo_db=mock_db)
        assert response == {"message": "Repository ingested and chunked successfully"}
        mock_pipeline.assert_awaited_once()

@pytest.mark.asyncio
async def test_ingest_repository_exception():
    mock_db = MagicMock(spec=Database)
    with patch("app.routers.chunks.ingest_pipeline", new_callable=AsyncMock) as mock_pipeline:
        mock_pipeline.side_effect = Exception("ingest error")
        with pytest.raises(HTTPException) as exc:
            await ingest_repository("https://fake.repo", mongo_db=mock_db)
        assert exc.value.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert "ingest error" in exc.value.detail

@pytest.mark.asyncio
@pytest.mark.parametrize("chunk_size", [500, 1500])
async def test_ingest_repository_chunk_size_boundaries(chunk_size):
    mock_db = MagicMock(spec=Database)
    with patch("app.routers.chunks.ingest_pipeline", new_callable=AsyncMock) as mock_pipeline:
        await ingest_repository("https://fake.repo", chunk_size=chunk_size, mongo_db=mock_db)
        mock_pipeline.assert_awaited_once_with("https://fake.repo", chunk_size, mock_db)


# -------------------------------
# Tests for PATCH /api/chunks/{chunk_id}
# -------------------------------

@pytest.mark.asyncio
async def test_update_chunk_endpoint_success():
    mock_db = MagicMock(spec=Database)
    chunk_update = ChunkUpdate(source="code", project="proj1")
    mock_chunk = {"chunkId": "123", "source": "old", "project": "old_proj"}

    with patch("app.routers.chunks.get_chunk_by_id", new_callable=AsyncMock) as mock_get, \
         patch("app.routers.chunks.update_chunk", new_callable=AsyncMock) as mock_update:
        mock_get.side_effect = [mock_chunk, {**mock_chunk, **chunk_update.dict(exclude_none=True)}]
        mock_update.return_value = 1

        response = await update_chunk_endpoint("123", chunk_update, mongo_db=mock_db)
        assert response["message"] == "Chunk updated successfully"
        assert response["chunk"]["source"] == "code"
        assert response["chunk"]["project"] == "proj1"

@pytest.mark.asyncio
async def test_update_chunk_endpoint_no_data():
    mock_db = MagicMock(spec=Database)
    empty_update = ChunkUpdate()
    with pytest.raises(HTTPException) as exc:
        await update_chunk_endpoint("123", empty_update, mongo_db=mock_db)
    assert exc.value.status_code == status.HTTP_400_BAD_REQUEST

@pytest.mark.asyncio
async def test_update_chunk_endpoint_chunk_not_found():
    mock_db = MagicMock(spec=Database)
    chunk_update = ChunkUpdate(source="new")
    with patch("app.routers.chunks.get_chunk_by_id", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = None
        with pytest.raises(HTTPException) as exc:
            await update_chunk_endpoint("123", chunk_update, mongo_db=mock_db)
        assert exc.value.status_code == status.HTTP_404_NOT_FOUND

@pytest.mark.asyncio
async def test_update_chunk_endpoint_partial_update_only_changes_provided_fields():
    mock_db = MagicMock(spec=Database)
    chunk_update = ChunkUpdate(source="new_source")
    original_chunk = {"chunkId": "123", "source": "old_source", "project": "old_proj"}

    with patch("app.routers.chunks.get_chunk_by_id", new_callable=AsyncMock) as mock_get, \
         patch("app.routers.chunks.update_chunk", new_callable=AsyncMock) as mock_update:
        mock_get.side_effect = [original_chunk, {**original_chunk, **chunk_update.dict(exclude_none=True)}]
        mock_update.return_value = 1

        response = await update_chunk_endpoint("123", chunk_update, mongo_db=mock_db)
        assert response["chunk"]["source"] == "new_source"
        assert response["chunk"]["project"] == "old_proj"  # unchanged

@pytest.mark.asyncio
async def test_update_chunk_endpoint_update_failure_raises_500():
    mock_db = MagicMock(spec=Database)
    chunk_update = ChunkUpdate(source="new")
    existing_chunk = {"chunkId": "123", "source": "old"}

    with patch("app.routers.chunks.get_chunk_by_id", new_callable=AsyncMock) as mock_get, \
         patch("app.routers.chunks.update_chunk", new_callable=AsyncMock) as mock_update:
        mock_get.side_effect = [existing_chunk, existing_chunk]
        mock_update.return_value = 0
        with pytest.raises(HTTPException) as exc:
            await update_chunk_endpoint("123", chunk_update, mongo_db=mock_db)
        assert exc.value.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR


# -------------------------------
# Tests for DELETE /api/chunks/{chunk_id}
# -------------------------------

@pytest.mark.asyncio
async def test_delete_chunk_endpoint_success():
    mock_db = MagicMock(spec=Database)
    mock_chunk = {"chunkId": "123"}

    with patch("app.routers.chunks.get_chunk_by_id", new_callable=AsyncMock) as mock_get, \
         patch("app.routers.chunks.delete_chunk", new_callable=AsyncMock) as mock_delete:
        mock_get.return_value = mock_chunk
        mock_delete.return_value = 1

        result = await delete_chunk_endpoint("123", mongo_db=mock_db)
        assert result is None

@pytest.mark.asyncio
async def test_delete_chunk_endpoint_not_found():
    mock_db = MagicMock(spec=Database)
    with patch("app.routers.chunks.get_chunk_by_id", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = None
        with pytest.raises(HTTPException) as exc:
            await delete_chunk_endpoint("123", mongo_db=mock_db)
        assert exc.value.status_code == status.HTTP_404_NOT_FOUND

@pytest.mark.asyncio
async def test_delete_chunk_endpoint_double_delete_returns_404():
    mock_db = MagicMock(spec=Database)
    mock_chunk = {"chunkId": "123"}

    with patch("app.routers.chunks.get_chunk_by_id", new_callable=AsyncMock) as mock_get, \
         patch("app.routers.chunks.delete_chunk", new_callable=AsyncMock) as mock_delete:
        # first delete
        mock_get.return_value = mock_chunk
        mock_delete.return_value = 1
        result = await delete_chunk_endpoint("123", mongo_db=mock_db)
        assert result is None

        # second delete
        mock_get.return_value = None
        with pytest.raises(HTTPException) as exc:
            await delete_chunk_endpoint("123", mongo_db=mock_db)
        assert exc.value.status_code == status.HTTP_404_NOT_FOUND

@pytest.mark.asyncio
async def test_delete_chunk_endpoint_failure_raises_500():
    mock_db = MagicMock(spec=Database)
    existing_chunk = {"chunkId": "123"}
    with patch("app.routers.chunks.get_chunk_by_id", new_callable=AsyncMock) as mock_get, \
         patch("app.routers.chunks.delete_chunk", new_callable=AsyncMock) as mock_delete:
        mock_get.return_value = existing_chunk
        mock_delete.return_value = 0
        with pytest.raises(HTTPException) as exc:
            await delete_chunk_endpoint("123", mongo_db=mock_db)
        assert exc.value.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR


# -------------------------------
# Tests for GET /api/chunks/
# -------------------------------

@pytest.mark.asyncio
async def test_list_chunks_success():
    mock_db = MagicMock(spec=Database)
    mock_docs = [{"chunkId": "1"}, {"chunkId": "2"}]

    with patch("app.routers.chunks.get_chunks", new_callable=AsyncMock) as mock_get_chunks:
        mock_get_chunks.return_value = mock_docs
        results = await list_chunks(limit=2, mongo_db=mock_db)
        assert results == mock_docs

@pytest.mark.asyncio
async def test_list_chunks_exception():
    mock_db = MagicMock(spec=Database)
    with patch("app.routers.chunks.get_chunks", new_callable=AsyncMock) as mock_get_chunks:
        mock_get_chunks.side_effect = Exception("DB Error")
        with pytest.raises(HTTPException) as exc:
            await list_chunks(limit=2, mongo_db=mock_db)
        assert exc.value.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert "DB Error" in exc.value.detail

@pytest.mark.asyncio
async def test_list_chunks_empty_result():
    mock_db = MagicMock(spec=Database)
    with patch("app.routers.chunks.get_chunks", new_callable=AsyncMock) as mock_get_chunks:
        mock_get_chunks.return_value = []
        results = await list_chunks(limit=10, mongo_db=mock_db)
        assert results == []

@pytest.mark.asyncio
async def test_list_chunks_filters_combination():
    mock_db = MagicMock(spec=Database)
    mock_docs = [{"chunkId": "1", "project": "proj", "repo": "r1", "section": "s1"}]
    with patch("app.routers.chunks.get_chunks", new_callable=AsyncMock) as mock_get_chunks:
        mock_get_chunks.return_value = mock_docs
        results = await list_chunks(project="proj", repo="r1", section="s1", limit=10, mongo_db=mock_db)
        assert results == mock_docs


# -------------------------------
# Tests for POST /api/chunks/embed
# -------------------------------

@pytest.mark.asyncio
async def test_run_embedding_pipeline_success_multiple_batches():
    mock_db = MagicMock(spec=Database)
    os.environ["COLLECTION_NAME"] = "test_collection"

    with patch("app.routers.chunks.embedding_pipeline", new_callable=AsyncMock) as mock_embed:
        mock_embed.side_effect = [2, 3, 0]
        response = await run_embedding_pipeline(mongo_db=mock_db, model=MagicMock(), qdrant=MagicMock())
        assert "Total embedded: 5" in response["message"]

@pytest.mark.asyncio
async def test_run_embedding_pipeline_no_collection_name():
    mock_db = MagicMock(spec=Database)
    if "COLLECTION_NAME" in os.environ:
        del os.environ["COLLECTION_NAME"]
    with pytest.raises(HTTPException) as exc:
        await run_embedding_pipeline(mongo_db=mock_db, model=MagicMock(), qdrant=MagicMock())
    assert exc.value.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR

@pytest.mark.asyncio
async def test_run_embedding_pipeline_no_chunks_to_embed():
    mock_db = MagicMock(spec=Database)
    os.environ["COLLECTION_NAME"] = "test_collection"
    with patch("app.routers.chunks.embedding_pipeline", new_callable=AsyncMock) as mock_embed:
        mock_embed.return_value = 0
        response = await run_embedding_pipeline(mongo_db=mock_db, model=MagicMock(), qdrant=MagicMock())
        assert "Total embedded: 0" in response["message"]

@pytest.mark.asyncio
async def test_run_embedding_pipeline_failure_raises_500():
    mock_db = MagicMock(spec=Database)
    os.environ["COLLECTION_NAME"] = "test_collection"
    with patch("app.routers.chunks.embedding_pipeline", new_callable=AsyncMock) as mock_embed:
        mock_embed.side_effect = Exception("embedding failed")
        with pytest.raises(HTTPException) as exc:
            await run_embedding_pipeline(mongo_db=mock_db, model=MagicMock(), qdrant=MagicMock())
        assert exc.value.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert "embedding failed" in exc.value.detail


# -------------------------------
# Tests for GET /api/chunks/search
# -------------------------------

@pytest.mark.asyncio
async def test_semantic_search_success():
    os.environ["COLLECTION_NAME"] = "test_collection"
    mock_model = MagicMock()
    mock_qdrant = MagicMock()
    fake_results = [{"chunkId": "1", "score": 0.9}]

    with patch("app.routers.chunks.EmbeddingRetriever", autospec=True) as mock_retriever_class:
        mock_retriever = mock_retriever_class.return_value
        mock_retriever.retrieve = AsyncMock(return_value=fake_results)

        response = await semantic_search(q="test query", top_k=5, model=mock_model, qdrant=mock_qdrant)
        assert response["query"] == "test query"
        assert response["top_k"] == 5
        assert response["results"] == fake_results

@pytest.mark.asyncio
async def test_semantic_search_no_collection_name():
    if "COLLECTION_NAME" in os.environ:
        del os.environ["COLLECTION_NAME"]
    with pytest.raises(HTTPException) as exc:
        await semantic_search(q="query", model=MagicMock(), qdrant=MagicMock())
    assert exc.value.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR

@pytest.mark.asyncio
async def test_semantic_search_empty_results():
    os.environ["COLLECTION_NAME"] = "test_collection"
    mock_model = MagicMock()
    mock_qdrant = MagicMock()

    with patch("app.routers.chunks.EmbeddingRetriever", autospec=True) as mock_retriever_class:
        mock_retriever = mock_retriever_class.return_value
        mock_retriever.retrieve = AsyncMock(return_value=[])

        response = await semantic_search(q="empty query", top_k=5, model=mock_model, qdrant=mock_qdrant)
        assert response["results"] == []

@pytest.mark.asyncio
async def test_semantic_search_top_k_greater_than_results():
    os.environ["COLLECTION_NAME"] = "test_collection"
    mock_model = MagicMock()
    mock_qdrant = MagicMock()
    fake_results = [{"chunkId": "1", "score": 0.9}]

    with patch("app.routers.chunks.EmbeddingRetriever", autospec=True) as mock_retriever_class:
        mock_retriever = mock_retriever_class.return_value
        mock_retriever.retrieve = AsyncMock(return_value=fake_results)

        response = await semantic_search(q="query", top_k=10, model=mock_model, qdrant=mock_qdrant)
        assert len(response["results"]) == 1

@pytest.mark.asyncio
async def test_semantic_search_retrieve_raises_exception():
    os.environ["COLLECTION_NAME"] = "test_collection"
    mock_model = MagicMock()
    mock_qdrant = MagicMock()

    with patch("app.routers.chunks.EmbeddingRetriever", autospec=True) as mock_retriever_class:
        mock_retriever = mock_retriever_class.return_value
        mock_retriever.retrieve = AsyncMock(side_effect=Exception("retriever failed"))

        with pytest.raises(HTTPException) as exc:
            await semantic_search(q="query", top_k=5, model=mock_model, qdrant=mock_qdrant)
        assert exc.value.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert "retriever failed" in exc.value.detail
