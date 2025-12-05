import json
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, status, Depends, Response, Request
from pymongo.database import Database
from app.dependencies import get_mongo_db, get_kms, get_current_user
from app.model.key import APIKeyIn
from app.services.key_management_service import KMS
from app.core.utils.helpers import validate_api_key
from app.services.auth import get_secret_key
from app.core.security import encrypt_cookie_value, decrypt_cookie_value
from app.services.list_models import list_available_models

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
    """
    Encrypt and store a new API key using the user's password.
    
    The API key is encrypted with the user's password and stored in MongoDB.
    The API key is then encrypted with a session-specific key and stored in a cookie.
    
    Security: Verifies that the provided password is the user's actual login password.
    """
    
    # Validate API Key format and check for quota issues
    validation_warning = None
    try:
        is_valid, warning = await validate_api_key(payload.provider_name, payload.api_key)
        if warning:
            validation_warning = warning
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid API Key: {str(e)}")

    # Verify that the password is the user's actual login password
    try:
        is_valid = await kms.verify_user_password(user["id"], payload.password, mongo_db)
        if not is_valid:
            raise HTTPException(
                status_code=401, 
                detail="Invalid password. Please enter your login password."
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Password verification failed: {e}")

    # Encrypt and store the API key with user's verified login password
    try:
        success, result = await kms.encrypt_and_store(
            user["id"], 
            payload.provider_name, 
            payload.api_key,
            payload.password,
            mongo_db,
            payload.key_name
        )

        if not success:
            raise HTTPException(
                status_code=500, 
                detail=result or "Failed to store API key"
            )
        
        # Encrypt the API key for cookie storage (session-specific encryption)
        encrypted_cookie_value = encrypt_cookie_value(payload.api_key, user["id"], get_secret_key())
        
        # Cookie name format: {provider}_{key_id}
        cookie_name = f"{payload.provider_name}_{result}"
        
        response.set_cookie(
            key=cookie_name,
            value=encrypted_cookie_value, 
            httponly=True,  
            secure=True,  
            samesite="none",
            expires=(datetime.now(timezone.utc) + timedelta(days=7))
        )

        response_data = {"message": "API key stored securely", "key_id": result}
        if validation_warning:
            response_data["warning"] = validation_warning
        
        return response_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to store API key: {e}")

@router.post("/verify-password")
async def verify_password_endpoint(
    password: str,
    user = Depends(get_current_user),
    kms: KMS = Depends(get_kms),
    mongo_db: Database = Depends(get_mongo_db),
):
    """Verify user's password before allowing key operations."""
    is_valid = await kms.verify_user_password(user["id"], password, mongo_db)
    
    if not is_valid:
        raise HTTPException(status_code=401, detail="Invalid password")
    
    return {"message": "Password verified"}

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

@router.get("/models/{key_id}")
async def get_available_models(
    key_id: str,
    request: Request,
    user = Depends(get_current_user),
    kms: KMS = Depends(get_kms),
    mongo_db: Database = Depends(get_mongo_db),
):
    """
    Get available models for a specific API key.
    Uses caching (5 minutes TTL) to avoid excessive API calls.
    """

    providers = await kms.get_api_provider(user["id"], mongo_db)
    key_info = next((p for p in providers if p["id"] == key_id), None)
    
    if not key_info:
        raise HTTPException(status_code=404, detail="Key not found")
    
    provider_name = key_info["provider_name"]
    

    cookie_name = f"{provider_name.lower()}_{key_id}"
    encrypted_cookie = request.cookies.get(cookie_name)
    
    if not encrypted_cookie:
        raise HTTPException(status_code=401, detail="API key cookie not found. Please re-login.")
    
    try:
        api_key = decrypt_cookie_value(encrypted_cookie, user["id"], get_secret_key())
        
        result = await list_available_models(provider_name, api_key, key_id)
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch models: {e}")

@router.delete("/delete/{key_id}")
async def delete_api_key(
    key_id: str,
    response: Response,
    user = Depends(get_current_user),
    kms: KMS = Depends(get_kms),
    mongo_db: Database = Depends(get_mongo_db),
):
    """Delete an API key by its ID and remove the associated cookie."""

    providers = await kms.get_api_provider(user["id"], mongo_db)
    key_info = next((p for p in providers if p["id"] == key_id), None)
    
    if not key_info:
        raise HTTPException(status_code=404, detail="Key not found")
    
    provider_name = key_info["provider_name"]
    

    deleted = await kms.delete_api_key(user["id"], key_id, mongo_db)
    if not deleted:
        raise HTTPException(status_code=404, detail="Key could not be deleted")

    cookie_name = f"{provider_name}_{key_id}"
    
    resp = Response(
        content=json.dumps({"message": "API key deleted successfully"}),
        media_type="application/json",
        status_code=status.HTTP_200_OK
    )
    
    resp.delete_cookie(
        key=cookie_name,
        secure=True,
        samesite="none"
    )
    
    return resp