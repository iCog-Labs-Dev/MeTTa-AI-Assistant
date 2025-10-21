import os
import sys
import logging
from typing import Any, Dict
from loguru import logger
from dotenv import load_dotenv

# Define colors for log levels
LEVEL_COLORS = {
    "DEBUG": "<blue>{level}</blue>",
    "INFO": "<green>{level}</green>",
    "WARNING": "<yellow>{level}</yellow>",
    "ERROR": "<red>{level}</red>",
    "CRITICAL": "<red>{level}</red>",
}

load_dotenv()


# Custom format for log messages
def custom_format(record: Dict[str, Any]) -> str:
    try:
        rel_file = os.path.relpath(record["file"].path)
    except (ValueError, TypeError):
        rel_file = str(record["file"])

    level_name = record["level"].name
    level_colored = LEVEL_COLORS.get(level_name, level_name)

    
    message = record.get("message", "")
    if isinstance(message, dict):
        message = str(message)
    elif not isinstance(message, str):
        message = str(message)

    
    if len(message) > 1000:
        message = message[:1000] + "..."

    
    return (
        f"{record['time'].strftime('%Y-%m-%d %H:%M:%S')} | "
        f"{level_colored:<8} | "
        f"{rel_file}:{record['line']}:{record['function']} - "
        f"{message}\n"
    )


def setup_logging(log_level: str = "DEBUG") -> None:
    """
    Setup Loguru logging for the project.
    Creates console logs, file logs, error logs, and JSON structured logs.
    """
    # Map string level to both Loguru and stdlib logging levels
    level_name = str(log_level).upper()
    std_levels = {
        "TRACE": 5,
        "DEBUG": logging.DEBUG,
        "INFO": logging.INFO,
        "WARNING": logging.WARNING,
        "ERROR": logging.ERROR,
        "CRITICAL": logging.CRITICAL,
    }
    std_level = std_levels.get(level_name, logging.DEBUG)

    # Fallback to relative path if the environment variable is not set
    env_log_dir = os.getenv("LOG_DIR")
    if env_log_dir and env_log_dir.strip():
        log_dir = env_log_dir.strip()
    else:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        log_dir = os.path.join(base_dir, "../../logs")
    os.makedirs(log_dir, exist_ok=True)

    # Paths for different log files
    log_file_path = os.path.join(log_dir, "app.log")  # Main log file
    log_file_jsonl = os.path.join(log_dir, "app.jsonl")  # Main structured JSON log
    error_log_path = os.path.join(log_dir, "error.log")  # Separate error log file
    error_log_jsonl = os.path.join(log_dir, "error.jsonl")  # JSON error log

    logger.remove()

    # Check if we should enable colors (Docker or TTY)
    color_enabled = os.getenv("FORCE_COLOR", "").lower() in ("1", "true", "yes") or (
        hasattr(sys.stdout, "isatty") and sys.stdout.isatty()
    )

    # Create a format function that handles both colors and relative paths
    def get_console_format(colorized: bool):
        if colorized:

            def colored_format(record):
                try:
                    rel_file = os.path.relpath(record["file"].path)
                except (ValueError, TypeError):
                    rel_file = str(record["file"])

                message = record.get("message", "")
                if isinstance(message, dict):
                    message = str(message)
                elif not isinstance(message, str):
                    message = str(message)

                # Truncate very long messages
                if len(message) > 1000:
                    message = message[:1000] + "..."

                return (
                    f"<green>{record['time'].strftime('%Y-%m-%d %H:%M:%S')}</green> | "
                    f"<level>{record['level'].name:<8}</level> | "
                    f"<cyan>{rel_file}</cyan>:<cyan>{record['line']}</cyan>:<cyan>{record['function']}</cyan> - "
                    f"<level>{message}</level>\n"
                )

            return colored_format
        else:
            return custom_format

    console_format = get_console_format(color_enabled)

    logger.add(
        sys.stdout,
        format=console_format,
        level=level_name,
        enqueue=True,  # Enable thread-safe logging
        backtrace=False,  # Reduce console noise
        diagnose=False,  # Reduce console noise
        colorize=color_enabled,
    )

    # Main application log (rotates when >50MB, keeps 10 days, compresses old logs)
    logger.add(
        log_file_path,
        format=custom_format,
        level=level_name,
        rotation="50 MB",
        retention="10 days",
        compression="zip",
        enqueue=True,
        backtrace=True,
    )

    # Separate error log for easier debugging
    logger.add(
        error_log_path,
        format=custom_format,
        level="ERROR",
        rotation="25 MB",
        retention="30 days",
        compression="zip",
        enqueue=True,
        backtrace=True,
        diagnose=True,  # Include full error info
    )

    # JSON structured logs for analytics tools
    logger.add(
        log_file_jsonl,
        level=level_name,
        rotation="75 MB",
        retention="7 days",
        compression="zip",
        serialize=True,
        enqueue=True,
        backtrace=False,
        diagnose=False,
    )

    # JSON structured error logs for error analysis
    logger.add(
        error_log_jsonl,
        level="ERROR",
        rotation="50 MB",
        retention="21 days",
        compression="zip",
        serialize=True,
        enqueue=True,
        backtrace=False,
        diagnose=False,
    )

    # Bridge stdlib logging (including Uvicorn/FastAPI) into Loguru
    class InterceptHandler(logging.Handler):
        def emit(self, record: logging.LogRecord) -> None:
            try:
                # Filter out noisy MongoDB driver logs that cause formatting issues
                logger_name = record.name
                message = record.getMessage()

                if "pymongo" in logger_name.lower() and "heartbeat" in message.lower():
                    return

                if "pymongo" in logger_name.lower() and len(message) > 500:
                    return

                level = logger.level(record.levelname).name
            except ValueError:
                level = record.levelno
            except Exception:
                return

            frame, depth = logging.currentframe(), 2
            while frame and frame.f_code.co_filename == logging.__file__:
                frame = frame.f_back
                depth += 1

            try:
                logger.opt(depth=depth, exception=record.exc_info).log(
                    level, record.getMessage()
                )
            except Exception:
                logger.log(level, f"[{record.name}] {record.getMessage()[:200]}")

    logging.root.handlers = [InterceptHandler()]
    logging.root.setLevel(std_level)

    for noisy_logger in (
        "uvicorn",
        "uvicorn.error",
        # keep access logs off unless explicitly enabled
        # "uvicorn.access",
        "fastapi",
        "asyncio",
    ):
        logging.getLogger(noisy_logger).handlers = [InterceptHandler()]
        logging.getLogger(noisy_logger).propagate = False
        logging.getLogger(noisy_logger).setLevel(std_level)

    # Set MongoDB driver to higher log level to reduce noise
    logging.getLogger("pymongo").setLevel(logging.WARNING)
    logging.getLogger("pymongo.connection").setLevel(logging.WARNING)
    logging.getLogger("pymongo.pool").setLevel(logging.WARNING)

    logger.info(f"Logging initialized with level: {level_name}")
    logger.info(f"Log directory: {os.path.abspath(log_dir)}")
