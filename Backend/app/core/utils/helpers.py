import os
from loguru import logger
from typing import Any
from langchain.chat_models import init_chat_model

def get_required_env(key: str, default: Any = None) -> str:
    value = os.getenv(key, default)
    if value is None:
        logger.error(f"Environment variable {key} is required")
        raise RuntimeError(f"Environment variable {key} is required")
    return value

async def validate_api_key(provider_name: str, api_key: str):
    """
    Validates the API key by making a minimal request to the provider.
    Raises an exception if the key is invalid.
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
        
    except Exception as e:
        msg = str(e)
        if "401" in msg or "invalid" in msg.lower() or "unauthenticated" in msg.lower():
            raise ValueError("Authentication failed. Please check your API key.")
        logger.debug("Validation failed: please enter a valid API key. %s", msg)
        raise ValueError(f"Validation failed: please enter a valid API key.")
