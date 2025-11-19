import os
from loguru import logger
from typing import Any

def get_required_env(key: str, default: Any = None) -> str:
    value = os.getenv(key, default)
    if not value:
        logger.error(f"Environment variable {key} is required")
        raise RuntimeError(f"Environment variable {key} is required")
    return value
