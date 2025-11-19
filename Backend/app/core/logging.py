import os
import sys
import logging
from logging.handlers import RotatingFileHandler
from dotenv import load_dotenv
import json
from datetime import datetime
import gzip
import shutil

load_dotenv()

# ------------------------
# Configurable constants
# ------------------------
LEVEL_COLORS = {
    "DEBUG": "\033[94m",
    "INFO": "\033[92m",
    "WARNING": "\033[93m",
    "ERROR": "\033[91m",
    "CRITICAL": "\033[91m",
}
RESET_COLOR = "\033[0m"
MAX_MSG_LENGTH = 7000 

# ------------------------
# Helper: compress rotated logs
# ------------------------
def compress_file(file_path: str):
    """Compress a file to .gz and remove the original."""
    if os.path.exists(file_path):
        with open(file_path, "rb") as f_in, gzip.open(file_path + ".gz", "wb") as f_out:
            shutil.copyfileobj(f_in, f_out)
        os.remove(file_path)

# ------------------------
# Formatters
# ------------------------
class JSONFormatter(logging.Formatter):
    """Format log records as JSON, including custom dimensions and exceptions."""
    def format(self, record: logging.LogRecord) -> str:
        msg = record.getMessage()
        if len(msg) > MAX_MSG_LENGTH:
            msg = msg[:MAX_MSG_LENGTH] + "...[TRUNCATED]"
        log_entry = {
            "timestamp": datetime.fromtimestamp(record.created).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": msg,
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        if hasattr(record, "custom_dimensions") and record.custom_dimensions:
            log_entry["custom_dimensions"] = record.custom_dimensions
        if record.exc_info:
            exc_text = self.formatException(record.exc_info)
            if len(exc_text) > MAX_MSG_LENGTH:
                exc_text = exc_text[:MAX_MSG_LENGTH] + "...[TRUNCATED]"
            log_entry["exception"] = exc_text
        return json.dumps(log_entry, default=str)

class PlainFormatter(logging.Formatter):
    """Human-readable plain formatter, includes exceptions for file logs."""
    def format(self, record: logging.LogRecord) -> str:
        msg = record.getMessage()
        if len(msg) > MAX_MSG_LENGTH:
            msg = msg[:MAX_MSG_LENGTH] + "...[TRUNCATED]"
        if record.exc_info:
            msg += "\n" + self.formatException(record.exc_info)
        return f"{self.formatTime(record, '%Y-%m-%d %H:%M:%S')} | {record.levelname:<8} | {record.filename}:{record.lineno}:{record.funcName} - {msg}"

class ColoredFormatter(logging.Formatter):
    """Colored console formatter."""
    def format(self, record: logging.LogRecord) -> str:
        color = LEVEL_COLORS.get(record.levelname, "")
        msg = record.getMessage()
        if len(msg) > MAX_MSG_LENGTH:
            msg = msg[:MAX_MSG_LENGTH] + "...[TRUNCATED]"
            
        if record.exc_info:
            exc_text = self.formatException(record.exc_info)
            if len(exc_text) > MAX_MSG_LENGTH:
                exc_text = exc_text[:MAX_MSG_LENGTH] + "...[TRUNCATED]"
            msg += "\n" + exc_text
       
        return f"{color}{self.formatTime(record, '%Y-%m-%d %H:%M:%S')} | {record.levelname:<8} | {record.filename}:{record.lineno}:{record.funcName} - {msg}{RESET_COLOR}"
       
# ------------------------
# RotatingFileHandler subclass with compression
# ------------------------
class CompressedRotatingFileHandler(RotatingFileHandler):
    """Rotating file handler that compresses old logs to .gz."""
    def doRollover(self):
        super().doRollover()
        if self.backupCount > 0:
            for i in range(self.backupCount, 0, -1):
                sfn = f"{self.baseFilename}.{i}"
                if os.path.exists(sfn):
                    compress_file(sfn)

# ------------------------
# Logging setup
# ------------------------
def setup_logging(log_level: str = "DEBUG") -> logging.Logger:
    """Configure logging: console, file (plain + JSON), error logs, rotation, compression, minimal library noise."""
    level = getattr(logging, log_level.upper(), logging.DEBUG)

    # Log directory
    log_dir = os.getenv("LOG_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../logs"))
    os.makedirs(log_dir, exist_ok=True)

    # File paths
    main_log = os.path.join(log_dir, "app.log")
    error_log = os.path.join(log_dir, "error.log")
    json_log = os.path.join(log_dir, "app.jsonl")
    json_error_log = os.path.join(log_dir, "error.jsonl")

    # Root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(level)
    root_logger.handlers = []

    # Console handler (colored optional)
    color_enabled = os.getenv("FORCE_COLOR", "").lower() in ("1", "true", "yes") or (hasattr(sys.stdout, "isatty") and sys.stdout.isatty())
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(ColoredFormatter() if color_enabled else PlainFormatter())
    root_logger.addHandler(console_handler)

    # Plain file handlers with compression
    file_handler = CompressedRotatingFileHandler(main_log, maxBytes=50 * 1024 * 1024, backupCount=10)
    file_handler.setFormatter(PlainFormatter())
    root_logger.addHandler(file_handler)

    error_handler = CompressedRotatingFileHandler(error_log, maxBytes=25 * 1024 * 1024, backupCount=30)
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(PlainFormatter())
    root_logger.addHandler(error_handler)

    # JSON file handlers
    json_handler = CompressedRotatingFileHandler(json_log, maxBytes=75 * 1024 * 1024, backupCount=7)
    json_handler.setFormatter(JSONFormatter())
    root_logger.addHandler(json_handler)

    json_error_handler = CompressedRotatingFileHandler(json_error_log, maxBytes=50 * 1024 * 1024, backupCount=21)
    json_error_handler.setLevel(logging.ERROR)
    json_error_handler.setFormatter(JSONFormatter())
    root_logger.addHandler(json_error_handler)

    # Minimal library noise filtering
    for noisy_logger in ("uvicorn", "uvicorn.error", "fastapi", "asyncio"):
        logging.getLogger(noisy_logger).handlers = [console_handler]
        logging.getLogger(noisy_logger).propagate = False
        logging.getLogger(noisy_logger).setLevel(level)

    root_logger.info(f"Logging initialized at level {log_level}")
    root_logger.info(f"Logs directory: {os.path.abspath(log_dir)}")

    return root_logger

# Initialize global logger when the module is imported
logger = setup_logging(log_level=os.getenv("LOG_LEVEL", "INFO"))
