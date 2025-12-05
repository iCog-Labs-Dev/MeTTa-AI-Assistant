from app.rag.embedding.pipeline import embedding_user_input
from loguru import logger
from qdrant_client.models import ScoredPoint
from app.rag.retriever.schema import Document
import asyncio
from typing import Dict, List, Tuple


class EmbeddingRetriever:
    def __init__(self, model, qdrant, collection_name: str):
        self.model = model
        self.qdrant = qdrant
        self.collection_name = collection_name

    async def _search_category(
        self, category: str, query_embedding: List[float], top_k: int, min_score: float
) -> Tuple[str, List[Document]]:
        
        """Search one category and return (category, documents)."""
        
        search_filter = {
            "must": [
                {"key": "source", "match": {"value": category}}
            ]
        }
        try:
            results: List[ScoredPoint] = await self.qdrant.search(
                collection_name=self.collection_name,
                query_vector=query_embedding,
                limit=top_k,
                query_filter=search_filter
            )
        except Exception as e:
            logger.error(f"Qdrant search failed for category={category}: {e}")
            return category, []

        documents: List[Document] = []
        for result in results:
            payload = dict(result.payload or {})
            chunk_text = payload.pop("chunk", "")
            score = getattr(result, "score", None)
            payload["_score"] = score
            payload["_id"] = getattr(result, "id", None)

            if score is None:
                logger.warning(f"Dropping document without score in category={category}")
                continue
            if score < min_score:
                logger.info(f"Dropping document with score {score} < min_score {min_score} in category={category}")
                continue

            documents.append(Document(text=chunk_text, metadata=payload))
            logger.info(f"Retrieved {category} document from Qdrant with chunk: {chunk_text[:30]}...")
        return category, documents

    async def retrieve(self, query: str, top_k: int = 5, min_score: float = 0.0) -> Dict[str, List[Document]]:
        query_embedding = await embedding_user_input(self.model, query)
        categories = ["code", "documentation", "others"]

        tasks = [
            asyncio.create_task(self._search_category(category, query_embedding, top_k, min_score))
            for category in categories
        ]

        results = await asyncio.gather(*tasks)

        results_by_category = {category: docs for category, docs in results}
        return results_by_category