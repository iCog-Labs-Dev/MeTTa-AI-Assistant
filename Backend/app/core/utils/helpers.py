import os
from loguru import logger
from typing import Any
from langchain.chat_models import init_chat_model

def get_required_env(key: str, default: Any = None) -> str:
    value = os.getenv(key, default)
    if not value:
        logger.error(f"Environment variable {key} is required")
        raise RuntimeError(f"Environment variable {key} is required")
    return value

async def validate_api_key(provider_name: str, api_key: str) -> tuple[bool, str | None]:
    """
    Validates the API key by making a minimal request to the provider.
    
    Returns:
        tuple[bool, str | None]: (is_valid, warning_message)
        - is_valid: True if key works or has quota exceeded, False if invalid
        - warning_message: None if valid, warning message if quota exceeded
    
    Raises:
        ValueError: Only if the key is completely invalid (wrong format, doesn't exist)
    """
    provider = provider_name.lower()
    
    try:
        if provider == "gemini":
            model = "gemini-2.5-flash"
            model_provider = "google_genai"
            kwargs = {"google_api_key": api_key}
        elif provider == "openai":
            model = "gpt-4.1-mini"
            model_provider = "openai"
            kwargs = {"api_key": api_key}
        else:
            raise ValueError(f"Unsupported provider for validation: {provider}")

        client = init_chat_model(
            model=model,
            model_provider=model_provider,
            temperature=0,
            **kwargs
        )
        
        await client.ainvoke("hi")
        
        
        return True, None
        
    except Exception as e:
        msg = str(e).lower()
        
        # Check for quota/rate limit errors - these are valid keys, just exhausted
        if any(keyword in msg for keyword in ["quota", "rate limit", "429", "resource exhausted"]):
            warning = "API key quota exceeded. The key is valid but has reached its usage limit. You can still save it and use it once the quota resets."
            logger.info(f"API key validation: quota exceeded for {provider}")
            return True, warning
        
        # Check for authentication errors - these are invalid keys
        if any(keyword in msg for keyword in ["401", "invalid", "unauthenticated", "unauthorized", "api key"]):
            logger.error(f"API key validation failed for {provider}: {e}")
            raise ValueError("Authentication failed. Please check your API key.")
        
        # Other errors - treat as invalid
        logger.error(f"API key validation failed for {provider}: {e}")
        raise ValueError(f"Validation failed: {str(e)}")
