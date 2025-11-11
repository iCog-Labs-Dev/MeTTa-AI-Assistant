import json
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, status, Depends, Response
from pymongo.database import Database
from app.dependencies import get_mongo_db, get_kms, get_current_user
from app.model.key import APIKeyIn
from app.services.key_management_service import KMS

router = APIRouter(
    prefix="/api/kms",
    tags=["kms"],
    responses={404: {"description": "Not found"}},
)

@router.post("/store")
async def store_api_key(
    payload: APIKeyIn,
    response: Response,
    user = Depends(get_current_user),
    kms: KMS = Depends(get_kms),
    mongo_db: Database = Depends(get_mongo_db),
):
    """Encrypt and store a new API key, and set it as an HTTP-only cookie."""
    try:
        generated, encrypted_api_key = await kms.encrypt_and_store(
            user["id"], payload.provider_name, payload.api_key, mongo_db
        )

        if not generated:
            raise HTTPException(status_code=500, detail="Failed to store API key")
        
        response.set_cookie(
            key=payload.provider_name,
            value=encrypted_api_key,
            httponly=True,   # prevents JS access
            secure=True,     # only sent over HTTPS
            samesite="Strict", # CSRF protection
            expires=(datetime.now(timezone.utc) + timedelta(days=7))
        )

        return {"message": "API key stored securely"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to store API key: {e}")

@router.get("/providers")
async def get_providers(
    user = Depends(get_current_user),
    kms: KMS = Depends(get_kms),
    mongo_db: Database = Depends(get_mongo_db),
):
    """Retrieve all stored API providers for the current user."""

    services = await kms.get_api_provider(user["id"], mongo_db)
    if not services:
        raise HTTPException(status_code=404, detail="No services found")
    return {"services": services}

@router.delete("/delete/{provider_name}")
async def delete_api_key(
    provider_name: str,
    user = Depends(get_current_user),
    kms: KMS = Depends(get_kms),
    mongo_db: Database = Depends(get_mongo_db),
):
    """Delete an API key for a given service and remove the related cookie."""

    deleted = await kms.delete_api_key(user["id"], provider_name, mongo_db)
    if not deleted:
        raise HTTPException(status_code=404, detail="Service not found or could not be deleted")

    # remove cookies for the service
    resp = Response(
        content=json.dumps({"message": f"API key for service '{provider_name}' deleted successfully"}),
        media_type="application/json",
        status_code=status.HTTP_200_OK
    )

    resp.delete_cookie(provider_name)
    return resp