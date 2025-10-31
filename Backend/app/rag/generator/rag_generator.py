from typing import Dict, List, Optional, Any
from app.rag.retriever.retriever import EmbeddingRetriever
from app.rag.retriever.schema import Document
from app.core.clients.llm_clients import LLMClient, LLMProvider
from app.core.utils.llm_utils import LLMClientFactory, LLMResponseFormatter


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
        self, query: str, top_k: int = 5, include_sources: bool = True
    ) -> Dict[str, Any]:
        retrieved_docs = await self.retriever.retrieve(query, top_k=top_k)
        context = self._assemble_context(retrieved_docs)
        prompt = LLMResponseFormatter.build_rag_prompt(query, context)
        response = await self.llm_client.generate_text(prompt)
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
