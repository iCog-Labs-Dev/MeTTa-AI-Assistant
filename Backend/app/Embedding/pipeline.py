# app/embedding/embedding_pipeline.py
import asyncio
import uuid
from qdrant_client.models import PointStruct
from app.db.db import get_chunks, update_embedding_status

async def embedding_pipeline(collection_name, mongo_db, model, qdrant, batch_size: int = 50):
    """Runs the full embedding pipeline."""
    chunks = await get_chunks({"isEmbedded": False}, limit=batch_size, mongo_db=mongo_db)
    if not chunks:
        print("No new chunks to embed.")
        return

    texts, ids, valid_chunks = [], [], []
    for chunk in chunks:
        if "chunk" not in chunk or "chunkId" not in chunk:
            continue
        texts.append(chunk["chunk"])
        ids.append(str(uuid.uuid5(uuid.NAMESPACE_OID, chunk["chunkId"])))
        valid_chunks.append(chunk)

    embeddings = await asyncio.to_thread(model.encode, texts)

    points = [
        PointStruct(
            id=ids[i],
            vector=embeddings[i].tolist(),
            payload={
                **{k: valid_chunks[i].get(k) for k in ["project", "repo", "file", "section", "version", "source"]},
                "original_chunkId": valid_chunks[i].get("chunkId")
            }
        )
        for i in range(len(valid_chunks))
    ]

    await qdrant.upsert(collection_name=collection_name, points=points)

    for chunk in valid_chunks:
        await update_embedding_status(chunk["chunkId"], True, mongo_db=mongo_db)

    print(f"✅ Inserted {len(points)} embeddings and updated MongoDB.")

