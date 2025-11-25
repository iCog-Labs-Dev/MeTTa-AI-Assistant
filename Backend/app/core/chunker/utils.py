import os 
import hashlib
from typing import Dict

def _build_chunk_doc(chunk_text: str, rel_path: set, repo_url: str) -> Dict[str, object]:
    """Build a Chunk Create-style document for insertion."""
    # Derive identifiers
    parts = rel_path[0].split("/") if rel_path else ["unknown-repo"]
    repo_name = parts[0] if parts else "unknown-repo"
    sections = []
    file_names = []
    for path in rel_path:
        path_parts = path.split("/")
        inside_repo = "/".join(path_parts[1:]) if len(path_parts) > 1 else ""
        section = os.path.dirname(inside_repo).replace("\\", "/") if inside_repo else None
        file_name = os.path.basename(inside_repo) if inside_repo else path
        sections.append(section)
        file_names.append(file_name)

    # chunk id using content + rel_path
    chunk_id = hashlib.sha256(f"{rel_path}:{chunk_text}".encode("utf-8")).hexdigest()[:16]

    return {
        "chunkId": chunk_id,
        "source": "code",
        "chunk": chunk_text,
        "project": repo_name,
        "repo": repo_url,
        "section": sections if sections else None,
        "file": file_names,
        "version": "1",      # or a commit hash if available
        "isEmbedded": False,
        "description": None     # fill later
    }