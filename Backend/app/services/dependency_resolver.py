from typing import List, Dict, Optional
from pymongo.database import Database
from loguru import logger
from app.core.chunker.function_analyzer import extract_function_calls, extract_function_definitions
from app.db.db import get_chunks, update_chunk, _get_collection


async def add_function_dependencies(
    mongo_db: Database, 
    batch_size: int = 100,
    force: bool = False
) -> Dict[str, int]:
    """
    Process all code chunks and add function dependencies.
    
    Args:
        mongo_db: MongoDB database connection
        batch_size: Number of chunks to process in each batch
        force: If True, reprocess chunks that already have dependencies
        
    Returns:
        Dictionary with statistics: {
            'total_processed': int,
            'total_updated': int,
            'total_dependencies_added': int
        }
    """
    stats = {
        'total_processed': 0,
        'total_updated': 0,
        'total_dependencies_added': 0
    }
    
    logger.info("Starting function dependency resolution...")
    
    filter_query = {"source": "code"}
    if not force:
        filter_query["$or"] = [
            {"functions": {"$exists": False}},
            {"functions": None},
            {"functions": []}
        ]
    
    collection = _get_collection(mongo_db, "chunks")
    
    total_chunks = await collection.count_documents(filter_query)
    logger.info(f"Found {total_chunks} chunks to process")
    
    if total_chunks == 0:
        logger.info("No chunks to process")
        return stats
    
    skip = 0
    while skip < total_chunks:
        cursor = collection.find(filter_query, {"_id": 0}).skip(skip).limit(batch_size)
        chunks = [doc async for doc in cursor]
        
        if not chunks:
            break
        
        logger.info(f"Processing batch: {skip + 1} to {skip + len(chunks)} of {total_chunks}")
        
        for chunk in chunks:
            stats['total_processed'] += 1
            
            try:
                dependency_ids = await resolve_chunk_dependencies(chunk, mongo_db)
                
                if dependency_ids:
                    updated = await update_chunk(
                        chunk["chunkId"],
                        {"functions": dependency_ids},
                        mongo_db
                    )
                    
                    if updated > 0:
                        stats['total_updated'] += 1
                        stats['total_dependencies_added'] += len(dependency_ids)
                        logger.debug(
                            f"Updated chunk {chunk['chunkId']} with {len(dependency_ids)} dependencies"
                        )
                else:
                    await update_chunk(
                        chunk["chunkId"],
                        {"functions": []},
                        mongo_db
                    )
                    
            except Exception as e:
                logger.error(f"Error processing chunk {chunk.get('chunkId', 'unknown')}: {e}")
                continue
        
        skip += len(chunks)
    
    logger.info(f"Dependency resolution complete. Stats: {stats}")
    return stats


async def resolve_chunk_dependencies(
    chunk: dict, 
    mongo_db: Database
) -> List[str]:
    """
    Resolve function dependencies for a single chunk.
    
    Args:
        chunk: Chunk document from MongoDB
        mongo_db: MongoDB database connection
        
    Returns:
        List of chunkIds that this chunk depends on
    """
    chunk_code = chunk.get("chunk", "")
    if not chunk_code:
        return []
    
    function_calls = extract_function_calls(chunk_code)
    
    if not function_calls:
        return []
    
    project = chunk.get("project")
    repo = chunk.get("repo")
    section = chunk.get("section", [])
    file = chunk.get("file", [])
    
    dependency_ids = []
    
    for func_name in function_calls:
        defining_chunks = await get_chunks_with_function_def(
            func_name, project, repo, section, file, mongo_db
        )
        
        for def_chunk in defining_chunks:
            def_chunk_id = def_chunk.get("chunkId")
            if def_chunk_id and def_chunk_id != chunk.get("chunkId"):
                if def_chunk_id not in dependency_ids:
                    dependency_ids.append(def_chunk_id)
    
    return dependency_ids


async def get_chunks_with_function_def(
    function_name: str,
    project: Optional[str],
    repo: Optional[str],
    section: Optional[List[str]],
    file: Optional[List[str]],
    mongo_db: Database
) -> List[dict]:
    """
    Find chunks that define a specific function within the same scope.
    
    Args:
        function_name: Name of the function to find
        project: Project name for scoping
        repo: Repository URL for scoping
        section: Section path for scoping
        file: File name for scoping
        mongo_db: MongoDB database connection
        
    Returns:
        List of chunk documents that define the function
    """
    collection = _get_collection(mongo_db, "chunks")
    
    query = {
        "source": "code",
        "project": project,
        "repo": repo,
    }
    
    if section:
        query["section"] = section
    if file:
        query["file"] = file
    
    cursor = collection.find(query, {"_id": 0})
    chunks = [doc async for doc in cursor]
    
    defining_chunks = []
    for chunk in chunks:
        chunk_code = chunk.get("chunk", "")
        definitions = extract_function_definitions(chunk_code)
        
        if function_name in definitions:
            defining_chunks.append(chunk)
    
    return defining_chunks
