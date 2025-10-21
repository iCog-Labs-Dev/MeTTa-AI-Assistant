import os
from typing import Optional, Dict, Any, List
from pydantic import BaseModel
from pymongo.database import Database
from fastapi import APIRouter, HTTPException, status, Depends, Query
from ..core.repo_ingestion.ingest import ingest_pipeline
from app.db.db import update_chunk, delete_chunk, get_chunk_by_id, get_chunks
from app.dependencies import get_mongo_db, get_embedding_model_dep, get_qdrant_client_dep
from app.Embedding.pipeline import embedding_pipeline


router = APIRouter(
    prefix="/api/chunks",
    tags=["chunks"],
    responses={404: {"description": "Not found"}},
)

class ChunkUpdate(BaseModel):
    source: Optional[str] = None
    chunk: Optional[str] = None
    isEmbedded: Optional[bool] = None
    
    # Code-specific fields
    project: Optional[str] = None
    repo: Optional[str] = None
    section: Optional[List[str]] = None
    file: Optional[List[str]] = None
    version: Optional[str] = None

    # Documentation-specific fields
    url: Optional[str] = None
    page_title: Optional[str] = None
    category: Optional[str] = None

    # PDF-specific fields
    filename: Optional[str] = None
    page_numbers: Optional[List[int]] = None

# chunk repository
@router.post("/ingest", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
async def ingest_repository(
    repo_url: str, 
    chunk_size: int = Query(1500, ge=500, le=1500), 
    mongo_db: Database = Depends(get_mongo_db)
):
    """Ingest and chunk a code repository."""
    try:
        await ingest_pipeline(repo_url, chunk_size, mongo_db)
        return {"message": "Repository ingested and chunked successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error ingesting repository: {str(e)}"
        )

@router.patch("/{chunk_id}", response_model=Dict[str, Any])
async def update_chunk_endpoint(
    chunk_id: str, chunk_update: ChunkUpdate, mongo_db : Database =Depends(get_mongo_db)
):
    """
    Update a chunk by its ID.
    Only the fields provided in the request body will be updated.
    """
    update_data = {k: v for k, v in chunk_update.dict().items() if v is not None}
    
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No update data provided"
        )
    
    existing_chunk = await get_chunk_by_id(chunk_id, mongo_db=mongo_db)
    if not existing_chunk:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chunk with ID {chunk_id} not found"
        )

    updated_count = await update_chunk(chunk_id, update_data, mongo_db=mongo_db)
    if updated_count == 0:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update chunk"
        )

    updated_chunk = await get_chunk_by_id(chunk_id, mongo_db=mongo_db)
    return {"message": "Chunk updated successfully", "chunk": updated_chunk}

@router.delete("/{chunk_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chunk_endpoint(chunk_id: str, mongo_db : Database =Depends(get_mongo_db)):
    """
    Delete a chunk by its ID.
    """
    existing_chunk = await get_chunk_by_id(chunk_id, mongo_db=mongo_db)
    if not existing_chunk:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chunk with ID {chunk_id} not found"
        )

    deleted_count = await delete_chunk(chunk_id, mongo_db=mongo_db)
    if deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete chunk"
        )

    return None

@router.get("/", response_model=List[Dict[str, Any]])
async def list_chunks(
    project: Optional[str] = None,
    repo: Optional[str] = None,
    section: Optional[str] = None,
    limit: int = Query(100, ge=1, le=1000, description="Limit the number of results (1-1000)"),
    mongo_db : Database =Depends(get_mongo_db),
):
    """
    List all chunks with optional filtering.
    
    - **project**: Filter by project name
    - **repo**: Filter by repository name
    - **section**: Filter by section name
    - **limit**: Number of results to return (1-1000)
    """
    filter_query = {}
    if project:
        filter_query["project"] = project
    if repo:
        filter_query["repo"] = repo
    if section:
        filter_query["section"] = section
    
    try:
        return await get_chunks(
            filter_query=filter_query, limit=limit, mongo_db=mongo_db
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving chunks: {str(e)}"
        )


@router.post("/embed", summary="Run embedding pipeline for unembedded chunks")
async def run_embedding_pipeline(
    mongo_db: Database = Depends(get_mongo_db),
    model = Depends(get_embedding_model_dep),
    qdrant = Depends(get_qdrant_client_dep)
):
    """Trigger the embedding pipeline."""
    collection_name = os.getenv("COLLECTION_NAME")
    if not collection_name:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="COLLECTION_NAME not set in environment variables."
        )

    try:
        await embedding_pipeline(
            collection_name=collection_name,
            mongo_db=mongo_db,
            model=model,
            qdrant=qdrant
        )
        return {"message": "Embedding pipeline completed successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Embedding pipeline failed: {str(e)}"
        )