from typing import Dict, List, Optional, Any
import json
import re
from app.rag.retriever.retriever import EmbeddingRetriever
from app.rag.retriever.schema import Document
from app.core.clients.llm_clients import LLMClient, LLMProvider
from app.core.utils.llm_utils import LLMClientFactory, LLMResponseFormatter
from app.core.utils.rewriter_utils import RewriterUtils
from app.core.logging import logger
from app.db.db import get_chunks

class RAGGenerator:
    def __init__(
        self,
        retriever: EmbeddingRetriever,
        llm_client: Optional[LLMClient] = None,
        provider: LLMProvider = LLMProvider.GEMINI,
        model_name: Optional[str] = None,
        mongo_db = None,
    ):
        self.retriever = retriever
        self.llm_client = llm_client or LLMClientFactory.create_client(
            provider=provider, model_name=model_name
        )
        self.mongo_db = mongo_db

    async def generate_response(
        self,
        query: str,
        top_k: int = 5,
        api_key: Optional[str] = None,
        include_sources: bool = False,
        history: Optional[List[Dict[str, str]]] = None,
    ) -> Dict[str, Any]:
        prompt = RewriterUtils.rewrite_query(query, history)
        rewritten_query_str = await self.llm_client.generate_text(prompt, api_key)

        cleaned_query_str = re.sub(r"```(?:json)?\n?(.*?)\n?```", r"\1", rewritten_query_str, flags=re.DOTALL).strip()

        try:
            rewritten_query = json.loads(cleaned_query_str)
            logger.info("Rewritten query: %s", rewritten_query)
        except json.JSONDecodeError:
            logger.warning("Failed to parse rewritten query JSON: %s", cleaned_query_str)
            rewritten_query = {"retriever_needed": True, "query": query}

        if rewritten_query.get("retriever_needed"):
            retrieval_query = rewritten_query.get("query", query)
            retrieved_docs = await self.retriever.retrieve(retrieval_query, top_k=top_k)
            await self._expand_dependencies(retrieved_docs, max_depth=3)
            context = self._assemble_context(retrieved_docs)
            prompt = LLMResponseFormatter.build_rag_prompt(query, context, history)
            response = await self.llm_client.generate_text(prompt, api_key)
            sources = self._format_sources(retrieved_docs) if include_sources else None
        else:
            sources = []
            response = rewritten_query.get("query", query)

        return LLMResponseFormatter.format_rag_response(
            query=query, response=response, client=self.llm_client, sources=sources
        )

    def _assemble_context(self, docs_by_category: Dict[str, List[Document]]) -> str:
        context_parts = []
        for category, docs in docs_by_category.items():
            if docs:
                context_parts.append(f"\n=== {category.upper()} ===")
                for doc in docs:
                    context_parts.append(f"- {doc.text}")
        return "\n".join(context_parts)

    def _format_sources(
        self, docs_by_category: Dict[str, List[Document]]
    ) -> List[Dict[str, Any]]:
        sources = []
        for category, docs in docs_by_category.items():
            for doc in docs:
                sources.append(
                    {
                        "category": category,
                        "text": doc.text,
                        "metadata": doc.metadata,
                        "score": doc.metadata.get("_score"),
                    }
                )
        return sources

    async def _expand_dependencies(
        self, docs_by_category: Dict[str, List[Document]], max_depth: int = 3
    ) -> None:
        """
        Recursively fetch function dependencies for code chunks.
        
        Args:
            docs_by_category: Dictionary of documents by category
            max_depth: Maximum recursion depth for dependency retrieval
        """
        if self.mongo_db is None:
            logger.warning("MongoDB not initialized in RAGGenerator, skipping dependency expansion")
            return

        code_docs = docs_by_category.get("code", [])
        if not code_docs:
            return

        # Initialize processed_docs with currently retrieved documents
        processed_docs: Dict[str, Document] = {}
        ids_to_check: List[str] = []

        for doc in code_docs:
            # Try both IDs to be robust
            chunk_id = doc.metadata.get("original_chunkId") or doc.metadata.get("chunkId")
            if chunk_id:
                processed_docs[chunk_id] = doc
                ids_to_check.append(chunk_id)

        current_depth = 0

        while current_depth < max_depth and ids_to_check:
            logger.info(f"Dependency expansion depth {current_depth + 1}: checking {len(ids_to_check)} chunks")
            
            # Fetch all chunks in current batch
            chunks_data = await get_chunks(
                {"chunkId": {"$in": ids_to_check}}, 
                limit=len(ids_to_check), 
                mongo_db=self.mongo_db
            )
            
            # Map for easy access
            fetched_chunks_map = {c.get("chunkId"): c for c in chunks_data if c.get("chunkId")}
            
            next_level_ids = set()
            
            for chunk_id in ids_to_check:
                chunk_data = fetched_chunks_map.get(chunk_id)
                if not chunk_data:
                    continue

                # If this is a new dependency (not in initial set), add it to processed_docs
                if chunk_id not in processed_docs:
                    metadata = {
                        "original_chunkId": chunk_id,
                        "project": chunk_data.get("project"),
                        "repo": chunk_data.get("repo"),
                        "file": chunk_data.get("file"),
                        "source": "code",
                        "functions": chunk_data.get("functions", []),
                        "is_dependency": True
                    }
                    new_doc = Document(
                        text=chunk_data.get("chunk", ""),
                        metadata=metadata
                    )
                    processed_docs[chunk_id] = new_doc
                    logger.info(f"Added dependency chunk {chunk_id} to context")

                # Collect dependencies for next level
                dependencies = chunk_data.get("functions", [])
                if dependencies:
                    for dep_id in dependencies:
                        # Only follow dependencies we haven't seen yet
                        if dep_id and dep_id not in processed_docs and dep_id not in next_level_ids:
                            next_level_ids.add(dep_id)
            
            ids_to_check = list(next_level_ids)
            current_depth += 1
            
        docs_by_category["code"] = list(processed_docs.values())
        logger.info(f"Dependency expansion complete. Total code chunks: {len(docs_by_category['code'])}")

