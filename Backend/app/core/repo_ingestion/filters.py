import os
import hashlib
import json
import shutil
from app.core.logging import logger
from typing import Optional, List, Dict

def hash_file_content(filepath: str) -> str:
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def process_metta_files(
    file_paths: List[str],
    output_dir: str,
    repo_root: Optional[str] = None,
    json_path: str = "../metta_index.json"
) -> Dict[str, str]:
    """
    file_paths: list of all files in the repo
    output_dir: where to store hashed .metta files (flat)
    repo_root: path to the root of the cloned repo (used for relative paths in index)
    json_path: name of JSON file mapping hash → relative path
    """
    os.makedirs(output_dir, exist_ok=True)
    index: Dict[str, str] = {}

    repo_name: str = os.path.basename(os.path.normpath(repo_root)) if repo_root else "repo"

    for file in file_paths:
        if file.endswith(".metta"):
            file_hash: str = hash_file_content(file)
            new_name: str = f"{file_hash}.metta"

            rel_path_inside_repo: str = (
                os.path.relpath(file, repo_root).replace("\\", "/") if repo_root else os.path.basename(file)
            )
            index[file_hash] = f"{repo_name}/{rel_path_inside_repo}"

            dest_path: str = os.path.join(output_dir, new_name)
            shutil.copy(file, dest_path)

            logger.info(f"Processed {rel_path_inside_repo} → {new_name}")

    os.system(f"rd /s /q {repo_root}")

    json_full_path: str = os.path.join(output_dir, json_path)
    with open(json_full_path, "w") as f:
        json.dump(index, f, indent=2)

    logger.info(f"Index saved at {json_full_path}")
    return index
