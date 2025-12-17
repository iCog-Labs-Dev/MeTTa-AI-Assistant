import os
from collections import defaultdict 
from typing import List, Dict, Any
from pymongo.database import Database as DB
from app.core.chunker import metta_ast_parser, preprocess, utils
from app.db.db import insert_chunks, clear_symbols_index
from app.core.logging import logger

def getSize(node: metta_ast_parser.SyntaxNode) -> int:
    """Gets the size of a node based on its source text length."""
    start, end = node.src_range
    return end - start

async def ChunkPreprocessedCode(potential_chunks: List[List[str]], max_size: int, repo_url: str) -> List[Dict[str, Any]]:
    """Chunks a list of potential chunks based on max_size.
    Each potential chunk is a list of text_node table IDs from our db.
    Returns a list of chunked code strings.
    """
    # chunk, rel_path 
    chunks = []

    for codes in potential_chunks:
        chunk, rel_paths, chunk_size = [], set(), 0
        for code, rel_path in codes:
            text_node = code
            text_size = len(code)
            
            # when single text node is larger than max_size
            if text_size > max_size:
                if chunk:
                    chunks.append(["\n".join(chunk), rel_paths])
                    chunk, rel_paths, chunk_size = [], set(), 0
                # recursively split this big single node
                nodes = metta_ast_parser.parse(text_node)[0]
                subChunks = ChunkCodeRecursively(nodes, text_node, max_size)
                if subChunks:
                    chunks.extend([[subChunk, {rel_path}] for subChunk in subChunks])

            # when adding this text node exceeds max_size
            elif chunk_size + text_size > max_size:
                if chunk:
                    chunks.append(["\n".join(chunk), rel_paths])
                chunk, rel_paths, chunk_size = [], set(), 0
            else:
                chunk.append(text_node)
                rel_paths.add(rel_path)
                chunk_size += text_size

        if chunk:
            chunks.append(["\n".join(chunk), rel_paths])

    chunks = [ utils._build_chunk_doc(chunk, list(rel_paths), repo_url) for chunk, rel_paths in chunks if chunk != ""]
    return chunks

async def ChunkCode(repo_files: defaultdict, max_size: int, db: DB, repo_url: str) -> List[Dict[str, Any]]:
    """
    Chunks the code into smaller pieces based on the max_size.
    Stores the chunks in the database.
    """
    
    potential_chunks = await preprocess.preprocess_code(repo_files, db)
    chunks = await ChunkPreprocessedCode(potential_chunks, max_size, repo_url)
    ids = await insert_chunks(chunks, db)
    return chunks

def ChunkCodeRecursively(node: metta_ast_parser.SyntaxNode, text: str, max_size: int) -> list[str]:
    """Recursively chunks a potential chunk (syntax node) when it exceeds max_size."""
    if getSize(node) <= max_size:
        st, en = node.src_range
        return [text[st:en]]

    # No children to recurse into, accept oversized node
    if not node.sub_nodes:  
        st, en = node.src_range
        return [text[st:en]]

    chunks = []
    for sub_node in node.sub_nodes:
        sub_chunks = ChunkCodeRecursively(sub_node, text, max_size)
        length_sub_chunks,cnt = len(sub_chunks), 0
        if chunks:
            for idx in range(length_sub_chunks):
                if len(chunks[-1]) + len(sub_chunks[idx]) > max_size:
                    break

                chunks[-1] += "\n" + sub_chunks[idx]
                cnt += 1

            sub_chunks = sub_chunks[cnt:]
        chunks.extend(sub_chunks)
    return chunks


async def ast_based_chunker(index: Dict[str, str], db: DB, repo_url: str,max_size: int = 1500) -> None:   
    # Group files by repo (can adjust this by determining scope)
    data_dir = os.path.join(os.path.dirname(__file__), "../repo_ingestion/data")
    data_dir = os.path.abspath(data_dir)

    repo_files = defaultdict(list)
    for file_hash, rel_path in index.items():
        repo_name = rel_path.split('/')[0]
        repo_files[repo_name].append([rel_path, os.path.join(data_dir, f"{file_hash}.metta")])

    # pass the repo_files to chunk_code
    await ChunkCode(repo_files, max_size, db, repo_url)
    # After all files in this repo are processed, reset symbol index
    await clear_symbols_index(db)

    logger.info("Chunks Stored in database")
    logger.info("Chunking complete!")
