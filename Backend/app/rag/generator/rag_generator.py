from typing import Dict, List, Optional, Any, AsyncIterator
from app.rag.retriever.retriever import EmbeddingRetriever
from app.rag.retriever.schema import Document
from app.core.clients.llm_clients import LLMClient, LLMProvider
from app.core.utils.llm_utils import LLMClientFactory, LLMResponseFormatter
import asyncio

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

    async def generate_response_stream(
    self,
    query: str,
    top_k: int = 5,
    api_key: Optional[str] = None,
    include_sources: bool = True,
    history: Optional[List[Dict[str, str]]] = None,
) -> AsyncIterator[Dict[str, Any]]:

        retrieved_docs = await self.retriever.retrieve(query, top_k=top_k)
        context = self._assemble_context(retrieved_docs)
        prompt = LLMResponseFormatter.build_rag_prompt(query, context, history)
        buffer_parts: List[str] = []

        try:
            idx = 0
            async for chunk in self.llm_client.generate_text_stream(
                prompt, api_key=api_key, max_tokens=2000
            ):
                buffer_parts.append(chunk)

                for token in self._split_into_tokens(chunk, max_len=6):
                    yield {"type": "partial", "delta": token}
                    await asyncio.sleep(0) 

                idx += 1
            final_text = "".join(buffer_parts)
            sources = self._format_sources(retrieved_docs) if include_sources else None
            final_payload = LLMResponseFormatter.format_rag_response(
                query=query,
                response=final_text,
                client=self.llm_client,
                sources=sources,
            )

            yield {"type": "final", "response": final_payload}

        except Exception as e:
            yield {"type": "error", "error": str(e)}


        
    def _split_into_tokens(self, text: str, max_len: int = 6):
        for i in range(0, len(text), max_len):
            yield text[i:i+max_len]


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
