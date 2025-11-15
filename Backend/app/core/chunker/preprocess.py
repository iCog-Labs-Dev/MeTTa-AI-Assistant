import re, os
from collections import defaultdict
from typing import Any, Dict, List
from pymongo.database import Database
from app.core.chunker import metta_ast_parser 
from app.db.db import get_all_symbols, upsert_symbol
from app.core.logging import setup_logging

logger = setup_logging(log_level=os.getenv("LOG_LEVEL", "INFO")).with_prefix("[PREPROCESS] ")
# take the src code return the potential chunks retrieved from the symbol index table
async def preprocess_code(repo_files: defaultdict, db: Database) -> List[List[str]]:
    for repo_name, files_path in repo_files.items():
        logger.info(f"Processing repo: {repo_name}")
        for rel_path, file_path in files_path:

            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    code = f.read()
                await parse_file(code,rel_path, db)
                logger.info(f"Processed file: {rel_path}")
            except FileNotFoundError:   
                logger.error(f"Error: Input file not found at '{rel_path}'")
                continue
            except Exception as e:
                logger.error(f"Error processing file '{rel_path}': {e}")
                continue
    
    # fetch all symbols
    rows = await get_all_symbols(db)

    potential_chunks: List[List[str]] = []

    for row in rows:
        single_chunk: List[str] = []
        values = list(row.values())  # expected: [symbol, type, [ids...]]
        for code in values[2:]:
            single_chunk.extend(code) 
        potential_chunks.append(single_chunk)

    # return the potential chunks
    return potential_chunks

async def parse_file(source_code:str, rel_path:str, db:Database) -> None:
    tree = metta_ast_parser.parse(source_code)

    # Cache comments above a function/type/assertion 
    # as part of that symbol's chunk
    comment_cache = []

    for node in tree:
        head_symbol = extract_symbol_from_node(node, source_code)

        if head_symbol["type"] == "unknown":
            continue

        if head_symbol["type"] == "comment":
            comment_cache.append(source_code[node.src_range[0]:node.src_range[1]])
            continue  

        if head_symbol["symbol"] == None:
            continue
        
        # insert symbol
        st, end = node.src_range
        # add comment above function/type/assertion
        if comment_cache:
            await upsert_symbol(head_symbol["symbol"], head_symbol["type"] + "s",\
                            ["\n".join(comment_cache) + "\n" + source_code[st:end], rel_path], \
                            db)
        # no comment associated with function
        else:
            await upsert_symbol(head_symbol["symbol"], head_symbol["type"] + "s",\
                                [source_code[st:end], rel_path], \
                                db)
        # clear cache
        comment_cache = []
    
    # remaining comments
    if comment_cache:
        await upsert_symbol(f"{rel_path}_comment", "comments", ["\n".join(comment_cache), rel_path], db)

def extract_symbol_from_node(node: metta_ast_parser.SyntaxNode, source_text: str) -> Dict[str, Any]:
    st, end = node.src_range
    code_snippet = source_text[st:end]

    if node.node_type_str == "RuleGroup":
        m = re.match(r'^\(\=\s*\(\s*([a-zA-Z0-9_-]+)', code_snippet)
        if m:
            return {"type": "def", "symbol": m.group(1)}

    elif node.node_type_str in ("CallGroup", "ExpressionGroup"):
        m = re.match(r'^\!\(\s*([a-zA-Z0-9_-]+)', code_snippet)
        if m:
            head = m.group(1)
            if head == "assertEqual":
                m2 = re.match(r'^\!\(assertEqual\s*\(\s*([a-zA-Z0-9_-]+)', code_snippet)
                if m2:
                    return {"type": "assert", "symbol": m2.group(1)}
                else:
                    return {"type": "assert", "symbol": None}
            else:
                return {"type": "call", "symbol": head}

    elif node.node_type_str == "TypeCheckGroup":
        m = re.match(r'^\(:\s*([a-zA-Z0-9_-]+)', code_snippet)
        if m:
            return {"type": "type", "symbol": m.group(1)}
    
    elif node.node_type_str == "Comment":
        return {"type": "comment", "symbol": None}

    return {"type": "unknown", "symbol": None}