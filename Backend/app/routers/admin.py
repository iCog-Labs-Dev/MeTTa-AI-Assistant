from fastapi import APIRouter, HTTPException, status, Depends
from typing import Optional, List
from pydantic import BaseModel
from pymongo.database import Database
from bson import ObjectId
from loguru import logger

from app.dependencies import get_mongo_db, require_role
from app.db.users import UserRole, get_users, delete_user
from app.db.db import _get_collection

router = APIRouter(
    prefix="/api/admin",
    tags=["admin"],
    responses={404: {"description": "Not found"}},
)

class AdminStatsResponse(BaseModel):
    total_users: int
    total_chunks: int
    annotated_chunks: int
    failed_annotations: int
    quota_exceeded: int

class AnnotationStatsResponse(BaseModel):
    total: int
    completed: int
    pending: int
    failed: int
    completedPercentage: float
    pendingPercentage: float
    failedPercentage: float

class UserResponse(BaseModel):
    id: str
    email: str
    role: str
    createdAt: Optional[str] = None

class RepositoryResponse(BaseModel):
    id: str
    url: str
    chunkSize: int
    chunks: int
    status: str
    createdAt: str

@router.get("/stats", response_model=AdminStatsResponse)
async def get_admin_stats(
    mongo_db: Database = Depends(get_mongo_db),
    _: None = Depends(require_role(UserRole.ADMIN))
):
    """
    Get comprehensive admin statistics including users, chunks, and annotations
    """
    try:
        # Get total users count
        users_collection = _get_collection(mongo_db, "users")
        total_users = await users_collection.count_documents({})
        
        # Get chunks statistics
        chunks_collection = _get_collection(mongo_db, "chunks")
        total_chunks = await chunks_collection.count_documents({})
        
        # Get annotation statistics
        annotated_chunks = await chunks_collection.count_documents({
            "status": "ANNOTATED"
        })
        
        failed_annotations = await chunks_collection.count_documents({
            "status": "FAILED"
        })
        
        quota_exceeded = await chunks_collection.count_documents({
            "status": "QUOTA_EXCEEDED"
        })
        
        return AdminStatsResponse(
            total_users=total_users,
            total_chunks=total_chunks,
            annotated_chunks=annotated_chunks,
            failed_annotations=failed_annotations,
            quota_exceeded=quota_exceeded
        )
        
    except Exception as e:
        logger.error(f"Error getting admin stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving admin statistics: {str(e)}"
        )

@router.get("/annotation-stats", response_model=AnnotationStatsResponse)
async def get_annotation_stats(
    mongo_db: Database = Depends(get_mongo_db),
    _: None = Depends(require_role(UserRole.ADMIN))
):
    """
    Get detailed annotation progress statistics
    """
    try:
        chunks_collection = _get_collection(mongo_db, "chunks")
        
        total_chunks = await chunks_collection.count_documents({})
        completed = await chunks_collection.count_documents({"status": "ANNOTATED"})
        failed = await chunks_collection.count_documents({"status": "FAILED"})
        quota_exceeded = await chunks_collection.count_documents({"status": "QUOTA_EXCEEDED"})
        
        # Calculate pending (everything else)
        pending = total_chunks - completed - failed - quota_exceeded
        
        completed_percentage = (completed / total_chunks * 100) if total_chunks > 0 else 0
        pending_percentage = (pending / total_chunks * 100) if total_chunks > 0 else 0
        failed_percentage = (failed / total_chunks * 100) if total_chunks > 0 else 0
        
        return AnnotationStatsResponse(
            total=total_chunks,
            completed=completed,
            pending=pending,
            failed=failed,
            completedPercentage=completed_percentage,
            pendingPercentage=pending_percentage,
            failedPercentage=failed_percentage
        )
        
    except Exception as e:
        logger.error(f"Error getting annotation stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving annotation statistics: {str(e)}"
        )

@router.get("/users", response_model=List[UserResponse])
async def get_admin_users(
    mongo_db: Database = Depends(get_mongo_db),
    _: None = Depends(require_role(UserRole.ADMIN))
):
    """
    Get list of all users for admin management
    """
    try:
        users_list = await get_users(mongo_db)
        
        formatted_users = []
        for user in users_list:
            user_response = UserResponse(
                id=user["id"],
                email=user["email"],
                role=user["role"].capitalize(),
                createdAt=user.get("createdAt", None)
            )
            formatted_users.append(user_response)
        
        return formatted_users
        
    except Exception as e:
        logger.error(f"Error getting users: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving users: {str(e)}"
        )

@router.delete("/users/{user_id}")
async def delete_admin_user(
    user_id: str,
    mongo_db: Database = Depends(get_mongo_db),
    _: None = Depends(require_role(UserRole.ADMIN))
):
    """
    Delete a user (admin only)
    """
    try:
        success = await delete_user(user_id, mongo_db)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found or failed to delete"
            )
        
        return {"message": "User deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting user: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting user: {str(e)}"
        )

@router.get("/repositories", response_model=List[RepositoryResponse])
async def get_repositories(
    mongo_db: Database = Depends(get_mongo_db),
    _: None = Depends(require_role(UserRole.ADMIN))
):
    """
    Get list of all ingested repositories with statistics
    """
    try:
        chunks_collection = _get_collection(mongo_db, "chunks")
        
        pipeline = [
            {
                "$match": {
                    "repo": {"$exists": True, "$ne": None},
                    "project": {"$exists": True, "$ne": None}
                }
            },
            {
                "$group": {
                    "_id": {
                        "repo": "$repo",
                        "project": "$project"
                    },
                    "chunks": {"$sum": 1},
                    "annotated": {
                        "$sum": {
                            "$cond": [{"$eq": ["$status", "ANNOTATED"]}, 1, 0]
                        }
                    },
                    "failed": {
                        "$sum": {
                            "$cond": [{"$eq": ["$status", "FAILED"]}, 1, 0]
                        }
                    },
                    "first_seen": {"$min": "$_id"},
                    "last_seen": {"$max": "$_id"},
                    "chunk_size": {"$first": "$chunk_size"}
                }
            },
            {
                "$project": {
                    "_id": 0,
                    "url": "$_id.repo",
                    "project": "$_id.project",
                    "chunks": 1,
                    "annotated": 1,
                    "failed": 1,
                    "chunk_size": 1,
                    "first_seen": 1,
                    "last_seen": 1
                }
            }
        ]
        
        repositories = []
        async for repo_data in chunks_collection.aggregate(pipeline):
            if repo_data["failed"] > 0:
                status = "Failed"
            elif repo_data["annotated"] == repo_data["chunks"]:
                status = "Completed"
            else:
                status = "Processing"
            
            created_at = repo_data.get("first_seen", ObjectId())
            if isinstance(created_at, ObjectId):
                created_at = created_at.generation_time.isoformat()
            
            repository = RepositoryResponse(
                id=f"{repo_data['project']}_{repo_data['url']}".replace("/", "_").replace(":", "_"),
                url=repo_data["url"],
                chunkSize=repo_data.get("chunk_size", 1000),
                chunks=repo_data["chunks"],
                status=status,
                createdAt=created_at
            )
            repositories.append(repository)
        
        repositories.sort(key=lambda x: x.createdAt, reverse=True)
        
        return repositories
        
    except Exception as e:
        logger.error(f"Error getting repositories: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving repositories: {str(e)}"
        )
