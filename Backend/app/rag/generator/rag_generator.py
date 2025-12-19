from typing import Dict, List, Optional, Any
import json
import re
from app.rag.retriever.retriever import EmbeddingRetriever
from app.rag.retriever.schema import Document
from app.core.clients.llm_clients import LLMClient, LLMProvider
from app.core.utils.llm_utils import LLMClientFactory, LLMResponseFormatter
from app.core.utils.rewriter_utils import RewriterUtils
class RAGGenerator:
    def __init__(
        self,
        retriever: EmbeddingRetriever,
        llm_client: Optional[LLMClient] = None,
        provider: LLMProvider = LLMProvider.GEMINI,
        model_name: Optional[str] = None,
    ):
        self.retriever = retriever
        self.llm_client = llm_client or LLMClientFactory.create_client(
            provider=provider, model_name=model_name
        )

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
            context = self._assemble_context(retrieved_docs)
            prompt = LLMResponseFormatter.build_rag_prompt(query, context, history)
            response = await self.llm_client.generate_text(prompt, api_key)
        else:
            response = rewritten_query.get("query", query)

        sources = self._format_sources(retrieved_docs) if include_sources else None
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
