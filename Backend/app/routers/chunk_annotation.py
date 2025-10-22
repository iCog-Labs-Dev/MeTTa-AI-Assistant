from fastapi import APIRouter, Depends, HTTPException, status
from app.services.chunk_annotation_service import ChunkAnnotationService
from app.services.llm_service import LLMQuotaExceededError
from app.dependencies import get_annotation_service
from app.model.chunk import Chunk 

router = APIRouter(
    prefix="/annotation",
    tags=["Chunk Annotation"]
)


@router.post("/batch", status_code=status.HTTP_202_ACCEPTED)
async def trigger_batch_annotation(
    limit: int = 100,
    annotation_service: ChunkAnnotationService = Depends(get_annotation_service)
):
    """
    Triggers an asynchronous batch job to annotate the oldest N unannotated chunks.
    """
    try:
        annotated_ids = await annotation_service.batch_annotate_unannotated_chunks(limit=limit)
        return {
            "message": "Batch annotation process initiated.",
            "annotated_chunks_count": len(annotated_ids),
            "chunk_ids": annotated_ids
        }
    except LLMQuotaExceededError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"LLM Annotation Service Quota Exceeded during batch process. Details: {e}"
        )


@router.post("/retry", status_code=status.HTTP_202_ACCEPTED)
async def retry_failed_annotations(
    limit: int = 100,
    include_quota: bool = False,
    annotation_service: ChunkAnnotationService = Depends(get_annotation_service)
):
    """
    Retries annotation for chunks that previously failed.
    Optionally include 'FAILED_QUOTA' chunks using `include_quota=true`.
    """
    try:
        retried_ids = await annotation_service.retry_failed_chunks(limit=limit, include_quota=include_quota)
        return {
            "message": "Retry process completed.",
            "retried_chunks_count": len(retried_ids),
            "chunk_ids": retried_ids
        }

    except LLMQuotaExceededError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Quota still exceeded while retrying failed chunks. Details: {e}"
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error while retrying failed chunks: {e}"
        )


@router.post("/{chunk_id}", response_model=Chunk, status_code=status.HTTP_200_OK)
async def annotate_chunk(
    chunk_id: str,
    annotation_service: ChunkAnnotationService = Depends(get_annotation_service)
):
    """
    Triggers description generation for a single chunk by ID.
    Returns the newly annotated chunk document.
    """
    try:
        annotated_chunk = await annotation_service.annotate_single_chunk(chunk_id)
        if not annotated_chunk:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Chunk ID '{chunk_id}' not found or annotation failed."
            )
        
        if annotated_chunk.status in ["FAILED_QUOTA", "FAILED_GEN"]:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Annotation process failed for chunk ID '{chunk_id}'. Status: {annotated_chunk.status}"
            )

        return annotated_chunk
        
    except LLMQuotaExceededError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"LLM Annotation Service Quota Exceeded. Operational Issue: {e}"
        )
