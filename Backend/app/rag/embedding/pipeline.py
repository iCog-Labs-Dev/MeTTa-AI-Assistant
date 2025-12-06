import asyncio
import uuid
from qdrant_client.models import PointStruct
from app.db.db import get_chunks, update_embedding_status
from app.core.logging import logger

async def embedding_pipeline(collection_name, mongo_db, model, qdrant, batch_size: int = 50):
    """Runs the full embedding pipeline."""
    chunks = await get_chunks({"isEmbedded": False}, limit=batch_size, mongo_db=mongo_db)
    if not chunks:
        logger.info("No new chunks to embed.")
        return 0

    texts, ids, valid_chunks = [], [], []
    for chunk in chunks:
        if "chunk" not in chunk or "chunkId" not in chunk:
            continue
        text_to_embed = chunk["chunk"]
        if chunk.get("description"):
            text_to_embed = f"{chunk['description']}\n{chunk['chunk']}"
        texts.append(text_to_embed)
        ids.append(str(uuid.uuid5(uuid.NAMESPACE_OID, chunk["chunkId"])))
        valid_chunks.append(chunk)
    if not valid_chunks:
        logger.info("No valid chunks to embed in this batch.")
        return 0

    embeddings = await asyncio.to_thread(model.encode, texts)

    points = [
        PointStruct(
            id=ids[i],
            vector=embeddings[i].tolist(),
            payload={
                **{k: valid_chunks[i].get(k) for k in ["project", "repo", "file", "section", "version", "source"]},
                "original_chunkId": valid_chunks[i].get("chunkId"),
                "chunk": valid_chunks[i].get("chunk", "")
            }
        )
        for i in range(len(valid_chunks))
    ]

    await qdrant.upsert(collection_name=collection_name, points=points)

    # Batch update MongoDB - much more efficient than individual updates
    chunk_ids = [chunk["chunkId"] for chunk in valid_chunks]
    updated_count = await update_embedding_status(chunk_ids, True, mongo_db)


    logger.info(f"Inserted {len(points)} embeddings and updated {updated_count} chunks in MongoDB.")
    return len(valid_chunks)
async def embedding_user_input(model, user_input: str):
    """Embeds and inserts a single user input."""
    embedding = await asyncio.to_thread(model.encode, [user_input])
    return embedding[0].tolist()