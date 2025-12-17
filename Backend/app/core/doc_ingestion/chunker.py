import hashlib
import re
import tiktoken
from typing import List, Dict, Any, Optional, Tuple

from app.core.doc_ingestion.config import CHUNK_SIZE, CHUNK_OVERLAP


class StructureAwareRecursiveTokenChunker:


    def __init__(self, max_tokens: int = 1024, overlap_tokens: int = 128):
        self.max_tokens = max_tokens
        self.overlap_tokens = overlap_tokens
        self.tokenizer = tiktoken.get_encoding("cl100k_base")
        self.separators = ["\n\n", "\n", " ", ""]

    def count_tokens(self, text: str) -> int:
        """Count tokens in text using tiktoken."""
        return len(self.tokenizer.encode(text))

    def chunk_text(
        self, text: str, metadata: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """Chunk text using recursive character splitting."""
        clean_text, code_blocks = self._preserve_code_blocks(text)

        chunks = self._recursive_split(clean_text)

        # Restore code blocks and create chunk objects
        result_chunks = []
        for chunk_text in chunks:
            restored_text = self._restore_code_blocks(chunk_text, code_blocks)
            result_chunks.append(
                {
                    "text": restored_text,
                    "tokens": self.count_tokens(restored_text),
                    "strategy": "recursive_character",
                    "metadata": metadata or {},
                }
            )

        return self._add_overlap(result_chunks)

    def _preserve_code_blocks(self, text: str) -> Tuple[str, List[Dict[str, Any]]]:
        """Extract and preserve code blocks, returning clean text and code block info."""
        code_blocks = []

        code_pattern = r"```(?:metta)?\n(.*?)\n```"
        matches = re.finditer(code_pattern, text, re.DOTALL)

        clean_text = text
        for i, match in enumerate(matches):
            code_content = match.group(1).strip()
            placeholder = f"__CODE_BLOCK_{i}__"
            code_blocks.append(
                {
                    "placeholder": placeholder,
                    "content": code_content,
                    "start": match.start(),
                    "end": match.end(),
                    "original_match": match.group(0),
                }
            )
            clean_text = clean_text.replace(match.group(0), placeholder, 1)

        return clean_text, code_blocks

    def _restore_code_blocks(self, text: str, code_blocks: List[Dict[str, Any]]) -> str:
        """Restore code blocks in text."""
        for code_block in code_blocks:
            text = text.replace(
                code_block["placeholder"], f"```metta\n{code_block['content']}\n```"
            )
        return text

    def _recursive_split(
        self, text: str, separators: Optional[List[str]] = None
    ) -> List[str]:
        """Recursively split text using separators."""
        if separators is None:
            separators = self.separators

        if not separators:
            return [text] if text.strip() else []

        separator = separators[0]
        remaining_separators = separators[1:]

        if separator == "":
            return self._split_by_characters(text)

        splits = text.split(separator)

        if len(splits) == 1:
            return self._recursive_split(text, remaining_separators)

        chunks = []
        current_chunk = ""

        for split in splits:
            if not split.strip():
                continue

            test_chunk = current_chunk + (separator if current_chunk else "") + split
            test_tokens = self.count_tokens(test_chunk)

            if test_tokens <= self.max_tokens:
                current_chunk = test_chunk
            else:
                if current_chunk:
                    chunks.append(current_chunk)

                if self.count_tokens(split) > self.max_tokens:
                    sub_chunks = self._recursive_split(split, remaining_separators)
                    chunks.extend(sub_chunks)
                    current_chunk = ""
                else:
                    current_chunk = split

        if current_chunk:
            chunks.append(current_chunk)

        return chunks

    def _split_by_characters(self, text: str) -> List[str]:
        """Split text by characters when other separators fail."""
        chunks = []
        current_chunk = ""

        for char in text:
            test_chunk = current_chunk + char
            if self.count_tokens(test_chunk) > self.max_tokens:
                if current_chunk:
                    chunks.append(current_chunk)
                current_chunk = char
            else:
                current_chunk = test_chunk

        if current_chunk:
            chunks.append(current_chunk)

        return chunks

    def _add_overlap(self, chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Add overlap between chunks."""
        if len(chunks) <= 1 or self.overlap_tokens <= 0:
            return chunks

        overlapped_chunks = []

        for i, chunk in enumerate(chunks):
            if i == 0:
                overlapped_chunks.append(chunk)
                continue

            prev_text = chunks[i - 1]["text"]
            prev_tokens = chunks[i - 1]["tokens"]

            if prev_tokens > self.overlap_tokens:
                words = prev_text.split()
                overlap_words = []
                overlap_token_count = 0

                for word in reversed(words):
                    word_tokens = self.count_tokens(word)
                    if overlap_token_count + word_tokens > self.overlap_tokens:
                        break
                    overlap_words.insert(0, word)
                    overlap_token_count += word_tokens

                overlap_text = " ".join(overlap_words)
                overlapped_text = overlap_text + " " + chunk["text"]
            else:
                overlapped_text = chunk["text"]

            overlapped_chunks.append(
                {
                    "text": overlapped_text,
                    "tokens": self.count_tokens(overlapped_text),
                    "strategy": chunk["strategy"],
                    "metadata": chunk["metadata"],
                }
            )

        return overlapped_chunks


def chunk_documentation_from_pages(pages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Chunk documentation directly from a list of page data.

    Args:
        pages: List of page data dictionaries

    Returns:
        List of chunk documents ready for database insertion
    """
    chunks = []
    
    chunker = StructureAwareRecursiveTokenChunker(max_tokens=CHUNK_SIZE, overlap_tokens=CHUNK_OVERLAP)

    for page_data in pages:
        chunk_dicts = chunker.chunk_text(page_data["content"])

        for i, chunk_dict in enumerate(chunk_dicts):
            chunk_text = chunk_dict["text"]
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
