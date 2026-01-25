import os
import subprocess
from urllib.parse import urlparse
from app.core.logging import logger
from typing import List

def get_repo_name(repo_url: str) -> str:
    """Extract repo name from URL, e.g. metta-moses.git → metta-moses"""
    return os.path.splitext(os.path.basename(urlparse(repo_url).path))[0]

def clone_repo(repo_url: str, temp_dir: str, branch: str = "main") -> str:
    repo_name = get_repo_name(repo_url)
    repo_path = os.path.join(temp_dir, repo_name)

    if os.path.exists(repo_path):
        logger.info(f"Repo already exists at {repo_path}, removing...")
        subprocess.run(["rm", "-rf", repo_path], check=True)

    logger.info(f"Cloning {repo_url} (branch: {branch}) into {repo_path}")
    subprocess.run(["git", "clone", "--branch", branch, repo_url, repo_path], check=True)

    return repo_path

def list_branches(repo_url: str) -> List[str]:
    """
    Returns a list of branches in the given repository.
    """
    try:
        # Run git ls-remote to get all refs and filter for heads (branches)
        result = subprocess.run(
            ["git", "ls-remote", "--heads", repo_url],
            capture_output=True,
            text=True,
            check=True
        )
        branches = []
        for line in result.stdout.splitlines():
            parts = line.split()
            if len(parts) == 2 and parts[1].startswith("refs/heads/"):
                branch_name = parts[1].replace("refs/heads/", "")
                branches.append(branch_name)
        return branches
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"Failed to list branches for {repo_url}: {e.stderr}")


def get_all_files(repo_dir: str) -> List[str]:
    return [
        os.path.join(root, file)
        for root, _, files in os.walk(repo_dir)
        for file in files
    ]
