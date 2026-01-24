import shutil
from app.core.logging import logger
from pymongo.database import Database
from app.core.repo_ingestion.clone import clone_repo, get_all_files
from app.core.repo_ingestion.filters import process_metta_files
from app.core.repo_ingestion.config import TEMP_DIR, DATA_DIR
from app.core.chunker import chunker


async def ingest_pipeline(repo_url: str, max_size: int, db: Database, branch: str = "main") -> None:
    repo_path: str = clone_repo(repo_url, TEMP_DIR, branch=branch)

    try:
        files: list[str] = get_all_files(repo_path)
        indexes = process_metta_files(files, DATA_DIR, repo_root=repo_path)
        await chunker.ast_based_chunker(indexes, db, repo_url, max_size)
    finally:
        logger.info(f"Cleaning up {repo_path}")
        shutil.rmtree(repo_path, ignore_errors=True)
        logger.info(f"Cleaning up {DATA_DIR}")
        shutil.rmtree(DATA_DIR, ignore_errors=True)
