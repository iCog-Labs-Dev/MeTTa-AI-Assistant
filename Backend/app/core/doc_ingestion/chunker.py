import hashlib
from typing import List, Dict, Any
from langchain_text_splitters import RecursiveCharacterTextSplitter

from .config import CHUNK_SIZE, CHUNK_OVERLAP



def chunk_documentation_from_pages(pages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Chunk documentation directly from a list of page data.

    Args:
        pages: List of page data dictionaries

    Returns:
        List of chunk documents ready for database insertion
    """
    chunks = []

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n```", "\n\n", "\n", " ", ""],
    )

    for page_data in pages:
        page_chunks = text_splitter.split_text(page_data["content"])

        for i, chunk_text in enumerate(page_chunks):
            if chunk_text.strip():  
                chunk_doc = _build_scraped_chunk_doc(
                    chunk_text=chunk_text,
                    url=page_data["url"],
                    page_title=page_data["page_title"],
                    category=page_data["category"],
                    chunk_index=i,
                )
                chunks.append(chunk_doc)

    print(f"Generated {len(chunks)} chunks from {len(pages)} pages")
    return chunks


def _build_scraped_chunk_doc(
    chunk_text: str, url: str, page_title: str, category: str, chunk_index: int
) -> Dict[str, Any]:
    """Build a chunk document for scraped content."""

    chunk_id = hashlib.sha256(f"{url}:{chunk_text}".encode("utf-8")).hexdigest()[:16]

    # Determine source based on URL - only metta-lang.dev is documentation
    if "metta-lang.dev" in url:
        source = "documentation"
    else:
        source = "others"

    return {
        "chunkId": chunk_id,
        "source": source,
        "chunk": chunk_text,
        "isEmbedded": False,
        # Documentation-specific fields
        "url": url,
        "page_title": page_title,
        "category": category,
        # Code-specific fields (None for scraped content)
        "project": None,
        "repo": None,
        "section": None,
        "file": None,
        "version": None,
        # PDF-specific fields (None for scraped content)
        "filename": None,
        "page_numbers": None,
    }


