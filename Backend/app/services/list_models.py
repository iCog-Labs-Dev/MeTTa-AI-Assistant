"""
Service for listing available models from AI providers.
"""
from typing import List, Dict, Optional
from loguru import logger
from datetime import datetime, timedelta
import httpx
import os

_model_cache: Dict[str, Dict] = {}
CACHE_TTL_MINUTES = os.getenv("CACHE_TTL_MINUTES")


async def _get_gemini_models(api_key: str) -> List[Dict[str, str]]:
    """
    Fetch available Gemini models using the API key.
    
    Returns:
        List of dicts with 'id' and 'name' keys
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://generativelanguage.googleapis.com/v1beta/models",
                params={"key": api_key},
                timeout=10.0
            )
            response.raise_for_status()
            data = response.json()
            
            result = []
            for model in data.get("models", []):
                if "generateContent" in model.get("supportedGenerationMethods", []):
                    model_id = model.get("name", "").replace("models/", "")
                    model_name = model.get("displayName", model_id)
                    result.append({
                        "id": model_id,
                        "name": model_name
                    })
            
            logger.info(f"Fetched {len(result)} Gemini models from API")
            return result
    except Exception as e:
        logger.warning(f"Failed to fetch Gemini models from API: {e}")
        return _get_default_gemini_models()


def _get_default_gemini_models() -> List[Dict[str, str]]:
    """Fallback list of common Gemini models."""
    return [
        {"id": "gemini-1.5-flash", "name": "Gemini 1.5 Flash"},
        {"id": "gemini-2.5-flash", "name": "Gemini 2.5 Flash"},
    ]


async def _get_openai_models(api_key: str) -> List[Dict[str, str]]:
    """
    Fetch available OpenAI models using the API key.
    
    Returns:
        List of dicts with 'id' and 'name' keys
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.openai.com/v1/models",
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=10.0
            )
            response.raise_for_status()
            data = response.json()
            
            result = []
            # Filter to only chat models
            chat_model_prefixes = ['gpt-4', 'gpt-3.5']
            for model in data.get("data", []):
                model_id = model.get("id", "")
                if any(model_id.startswith(prefix) for prefix in chat_model_prefixes):
                    result.append({
                        "id": model_id,
                        "name": model_id.upper().replace('-', ' ')
                    })
            
            logger.info(f"Fetched {len(result)} OpenAI models from API")
            return result
    except Exception as e:
        logger.warning(f"Failed to fetch OpenAI models from API: {e}")
        return _get_default_openai_models()


def _get_default_openai_models() -> List[Dict[str, str]]:
    """Fallback list of common OpenAI models."""
    return [
        {"id": "gpt-4o", "name": "GPT-4o"},
        {"id": "gpt-4o-mini", "name": "GPT-4o Mini"},
        {"id": "gpt-4-turbo", "name": "GPT-4 Turbo"},
        {"id": "gpt-3.5-turbo", "name": "GPT-3.5 Turbo"},
    ]


async def list_available_models(
    provider: str, 
    api_key: str, 
    key_id: str,
    use_cache: bool = True
) -> Dict[str, any]:
    """
    List available models for a provider.
    
    Args:
        provider: Provider name (e.g., 'gemini', 'openai')
        api_key: Decrypted API key
        key_id: Unique key identifier for caching
        use_cache: Whether to use cached results
    
    Returns:
        Dict with 'models' (list) and 'default_model' (str)
    """

    if use_cache and key_id in _model_cache:
        cache_entry = _model_cache[key_id]
        if datetime.now() < cache_entry["expires_at"]:
            logger.debug(f"Using cached models for key {key_id}")
            return cache_entry["data"]
    

    provider_lower = provider.lower()
    
    if provider_lower == "gemini":
        models = await _get_gemini_models(api_key)
        default_model = "gemini-2.0-flash-exp"
    elif provider_lower == "openai":
        models = await _get_openai_models(api_key)
        default_model = "gpt-4o-mini"
    else:
        logger.warning(f"Unknown provider: {provider}")
        models = []
        default_model = None
    
    result = {
        "models": models,
        "default_model": default_model
    }
    
    _model_cache[key_id] = {
        "data": result,
        "expires_at": datetime.now() + timedelta(minutes=CACHE_TTL_MINUTES)
    }
    
    return result


def clear_model_cache(key_id: Optional[str] = None):
    """
    Clear model cache.
    
    Args:
        key_id: If provided, clear only this key's cache. Otherwise clear all.
    """
    global _model_cache
    if key_id:
        _model_cache.pop(key_id, None)
        logger.debug(f"Cleared model cache for key {key_id}")
    else:
        _model_cache.clear()
        logger.debug("Cleared all model cache")
