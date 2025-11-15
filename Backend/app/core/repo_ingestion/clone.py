import os
import subprocess
from urllib.parse import urlparse
from app.core.logging import setup_logging
from typing import List

logger = setup_logging(log_level=os.getenv("LOG_LEVEL", "INFO")).with_prefix("[CLONE] ")

def get_repo_name(repo_url: str) -> str:
    """Extract repo name from URL, e.g. metta-moses.git → metta-moses"""
    return os.path.splitext(os.path.basename(urlparse(repo_url).path))[0]

def clone_repo(repo_url: str, temp_dir: str) -> str:
    repo_name = get_repo_name(repo_url)
    repo_path = os.path.join(temp_dir, repo_name)

    if os.path.exists(repo_path):
        logger.info(f"Repo already exists at {repo_path}, removing...")
        subprocess.run(["rm", "-rf", repo_path], shell=True)
    logger.info(f"Cloning {repo_url} into {repo_path}")
    subprocess.run(["git", "clone", repo_url, repo_path], check=True)

    return repo_path

def get_all_files(repo_dir: str) -> List[str]:
    return [
        os.path.join(root, file)
        for root, _, files in os.walk(repo_dir)
        for file in files
    ]
