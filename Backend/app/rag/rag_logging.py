import json
import os
from datetime import datetime
from typing import Any, Dict, List

LOG_PATH = os.getenv("RAG_LOG_PATH", os.path.join(os.path.dirname(__file__), "rag_interactions.jsonl"))

def log_rag_interaction(record: Dict[str, Any]) -> None:
    """Append a single RAG interaction record to a JSONL file.

    Expected keys in record (not enforced):
    - question: str
    - answer: str
    - contexts: List[str]
    - metadata: Dict[str, Any]
    """
    safe_record: Dict[str, Any] = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        **record,
    }

    # Ensure contexts is serializable
    contexts: List[str] = [str(c) for c in safe_record.get("contexts", [])]
    safe_record["contexts"] = contexts

    # Never log raw API keys if accidentally passed
    if "api_key" in safe_record:
        safe_record.pop("api_key", None)

    os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
    with open(LOG_PATH, "a", encoding="utf-8") as f:
        f.write(json.dumps(safe_record, ensure_ascii=False) + "\n")
