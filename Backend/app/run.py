import os
import uvicorn
from dotenv import load_dotenv
from app.core.log_config import setup_logging

load_dotenv()
def main() -> None:
    setup_logging(os.getenv("LOG_LEVEL", "DEBUG"))

    reload_enabled = os.getenv("RELOAD", "0").strip() == "1"

    # Always use import string to support reload reliably
    app_ref = "app.main:app"

    uvicorn.run(
        app_ref,
        host="0.0.0.0",
        port=8000,
        reload=reload_enabled,
        log_config=None,
        access_log=True,
    )


if __name__ == "__main__":
    main()
