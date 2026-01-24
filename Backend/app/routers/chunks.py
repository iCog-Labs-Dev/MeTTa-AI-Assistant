import os
from typing import Optional, Dict, Any, List
from pydantic import BaseModel
from pymongo.database import Database
from fastapi import APIRouter, HTTPException, status, Depends, Query
from ..core.repo_ingestion.ingest import ingest_pipeline
from app.db.db import update_chunk, delete_chunk, get_chunk_by_id, get_chunks, _get_collection
from app.core.logging import logger
from app.dependencies import (
    get_mongo_db,
    get_embedding_model_dep,
    get_qdrant_client_dep,
    require_role,
)
from app.rag.embedding.pipeline import embedding_pipeline
from app.rag.retriever.retriever import EmbeddingRetriever
from app.db.users import UserRole

router = APIRouter(
    prefix="/api/chunks",
    tags=["chunks"],
    responses={404: {"description": "Not found"}},
)

# -------------------- Schemas --------------------
class ChunkUpdate(BaseModel):
    source: Optional[str] = None
    chunk: Optional[str] = None
    isEmbedded: Optional[bool] = None
    project: Optional[str] = None
    repo: Optional[str] = None
    section: Optional[List[str]] = None
    file: Optional[List[str]] = None
    version: Optional[str] = None
    url: Optional[str] = None
    page_title: Optional[str] = None
    category: Optional[str] = None
    filename: Optional[str] = None
    page_numbers: Optional[List[int]] = None

# -------------------- Endpoints --------------------
@router.post("/ingest", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
async def ingest_repository(
    repo_url: str,
    branch: str = Query("main", description="Git branch to ingest"),
    chunk_size: int = Query(1500, ge=500, le=1500),
    mongo_db: Database = Depends(get_mongo_db),
    _: None = Depends(require_role(UserRole.ADMIN)),
):
    """Ingest a code repository and optional branch selection"""
    try:
        await ingest_pipeline(repo_url, chunk_size, mongo_db, branch)
        return {"message": f"Repository '{repo_url}' (branch: {branch}) ingested successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error ingesting repository: {str(e)}"
        )

@router.patch("/{chunk_id}", response_model=Dict[str, Any])
async def update_chunk_endpoint(
    chunk_id: str, chunk_update: ChunkUpdate, 
    mongo_db : Database =Depends(get_mongo_db),
    _: None = Depends(require_role(UserRole.ADMIN)),
):
    update_data = {k: v for k, v in chunk_update.dict().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided")
    
    existing_chunk = await get_chunk_by_id(chunk_id, mongo_db=mongo_db)
    if not existing_chunk:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Chunk {chunk_id} not found")

    updated_count = await update_chunk(chunk_id, update_data, mongo_db=mongo_db)
    if updated_count == 0:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update chunk")

    updated_chunk = await get_chunk_by_id(chunk_id, mongo_db=mongo_db)
    return {"message": "Chunk updated successfully", "chunk": updated_chunk}

@router.delete("/{chunk_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chunk_endpoint(
    chunk_id: str, 
    mongo_db: Database =Depends(get_mongo_db),
    _: None = Depends(require_role(UserRole.ADMIN)),
):
    existing_chunk = await get_chunk_by_id(chunk_id, mongo_db=mongo_db)
    if not existing_chunk:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Chunk {chunk_id} not found")

    deleted_count = await delete_chunk(chunk_id, mongo_db=mongo_db)
    if deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete chunk")

    return None

@router.get("/paginated", response_model=Dict[str, Any])
async def list_chunks_paginated(
    project: Optional[str] = None,
    repo: Optional[str] = None,
    section: Optional[str] = None,
    source: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(25, ge=1, le=1000),
    page: int = Query(1, ge=1),
    mongo_db : Database =Depends(get_mongo_db),
    _: None = Depends(require_role(UserRole.ADMIN)),
):
    filter_query = {}
    if project: filter_query["project"] = project
    if repo: filter_query["repo"] = repo
    if section: filter_query["section"] = section
    if source: filter_query["source"] = source
    if search: filter_query["chunk"] = {"$regex": search, "$options": "i"}
    
    try:
        collection = _get_collection(mongo_db, "chunks")
        total = await collection.count_documents(filter_query)
        skip = (page - 1) * limit
        chunks = await get_chunks(filter_query=filter_query, limit=limit, skip=skip, mongo_db=mongo_db)
        return {
            "chunks": chunks,
            "total": total,
            "page": page,
            "limit": limit,
            "totalPages": (total + limit - 1) // limit
        }
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
