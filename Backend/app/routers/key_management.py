import json
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, status, Depends, Response
from langchain.chat_models import init_chat_model
from pymongo.database import Database

from app.dependencies import get_mongo_db, get_kms, get_current_user
from app.model.key import APIKeyIn
from app.services.key_management_service import KMS

router = APIRouter(
    prefix="/api/kms",
    tags=["kms"],
    responses={404: {"description": "Not found"}},
)

_SUPPORTED_PROVIDERS = ("openai", "gemini")
_PROVIDER_PROMPT = "Respond with OK."


class InvalidProviderKey(Exception):
    """Raised when the provided API key is invalid for the declared provider."""


class ProviderValidationUnavailable(Exception):
    """Raised when provider validation cannot be completed."""


def _build_langchain_client(provider: str, api_key: str):
    if provider == "openai":
        return init_chat_model(
            model="gpt-3.5-turbo",
            model_provider="openai",
            api_key=api_key,
            temperature=0.0,
        )
    if provider == "gemini":
        return init_chat_model(
            model="gemini-2.5-flash",
            model_provider="google_genai",
            google_api_key=api_key,
            temperature=0.0,
        )
    raise ValueError(f"Unsupported provider '{provider}'")


async def _try_provider(provider: str, api_key: str) -> None:
    client = _build_langchain_client(provider, api_key)
    try:
        await client.ainvoke(_PROVIDER_PROMPT)
    except Exception as exc:  # pragma: no cover
        message = str(exc).lower()
        if any(
            token in message
            for token in (
                "unauthorized",
                "permission",
                "401",
                "403",
                "api key",
                "invalid",
            )
        ):
            raise InvalidProviderKey(
                f"{provider.capitalize()} rejected the provided API key"
            ) from exc
        if any(
            token in message for token in ("429", "rate", "quota", "exhausted", "limit")
        ):
            raise ProviderValidationUnavailable(
                f"{provider.capitalize()} rate-limited the validation request"
            ) from exc
        raise ProviderValidationUnavailable(
            f"{provider.capitalize()} validation failed: {exc}"
        ) from exc


async def _detect_provider_from_api(
    api_key: str, skip: Optional[str] = None
) -> Optional[str]:
    for candidate in _SUPPORTED_PROVIDERS:
        if candidate == skip:
            continue
        try:
            await _try_provider(candidate, api_key)
            return candidate
        except InvalidProviderKey:
            continue
        except ProviderValidationUnavailable:
            continue
    return None


async def _validate_declared_provider(provider_name: str, api_key: str) -> None:
    normalized = provider_name.strip().lower()
    if normalized not in _SUPPORTED_PROVIDERS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Supported providers are 'openai' and 'gemini'.",
        )
    try:
        await _try_provider(normalized, api_key)
    except InvalidProviderKey as exc:
        detected = await _detect_provider_from_api(api_key, skip=normalized)
        if detected:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"API key appears to belong to '{detected}' but '{normalized}' was declared."
                ),
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"The provided API key is not valid for '{normalized}'.",
        ) from exc
    except ProviderValidationUnavailable as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc


@router.post("/store")
async def store_api_key(
    payload: APIKeyIn,
    response: Response,
    user=Depends(get_current_user),
    kms: KMS = Depends(get_kms),
    mongo_db: Database = Depends(get_mongo_db),
):
    """Encrypt and store a new API key, and set it as an HTTP-only cookie."""
    try:
        await _validate_declared_provider(payload.provider_name, payload.api_key)
        generated, encrypted_api_key = await kms.encrypt_and_store(
            user["id"], payload.provider_name, payload.api_key, mongo_db
        )

        if not generated:
            raise HTTPException(status_code=500, detail="Failed to store API key")

        response.set_cookie(
            key=payload.provider_name,
            value=encrypted_api_key,
            httponly=True,  # prevents JS access
            secure=True,  # only sent over HTTPS
            samesite="Strict",  # CSRF protection
            expires=(datetime.now(timezone.utc) + timedelta(days=7)),
        )

        return {"message": "API key stored securely"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to store API key: {e}")


@router.get("/providers")
async def get_providers(
    user=Depends(get_current_user),
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
    user=Depends(get_current_user),
    kms: KMS = Depends(get_kms),
    mongo_db: Database = Depends(get_mongo_db),
):
    """Delete an API key for a given service and remove the related cookie."""

    deleted = await kms.delete_api_key(user["id"], provider_name, mongo_db)
    if not deleted:
        raise HTTPException(
            status_code=404, detail="Service not found or could not be deleted"
        )

    # remove cookies for the service
    resp = Response(
        content=json.dumps(
            {"message": f"API key for service '{provider_name}' deleted successfully"}
        ),
        media_type="application/json",
        status_code=status.HTTP_200_OK,
    )

    resp.delete_cookie(provider_name)
    return resp
