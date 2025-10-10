# MeTTa Code Retrieval Module

## Overview
This module is a component of a larger project for managing and processing MeTTa code. It provides semantic and metadata-based retrieval of MeTTa code snippets stored in a MongoDB database (`chunkDB.chunks`). The module fetches unembedded chunks (`isEmbedded: False`), embeds them into 768-dimensional vectors, stores them in Qdrant, and updates `isEmbedded` to `True`. It supports hybrid searches combining semantic similarity (e.g., "recursive function") with metadata filters (e.g., `repo`, `source`, `isEmbedded`).

### Functionality
- Retrieves MeTTa code chunks from MongoDB (`chunkDB.chunks`) that have not been embedded (`isEmbedded: False`).
- Embeds chunk content using `google/embeddinggemma-300m` into 768-dimensional vectors.
- Stores embeddings in Qdrant’s `metta_codebase` collection with metadata (`chunkId`, `source`, `chunk`, `project`, `repo`, `section`, `file`, `version`, `isEmbedded`).
- Updates `isEmbedded` to `True` in MongoDB after successful embedding to prevent re-embedding.
- Enables semantic searches (e.g., "recursive function") and metadata-filtered searches (e.g., `repo="github.com/trueagi-io/hyperon-experimental"`, `source="code"`, `isEmbedded=True`).

### Technologies Used
- **MongoDB**: Stores MeTTa code chunks in the `chunkDB.chunks` collection (local for testing, MongoDB Atlas in production).
- **Qdrant**: Manages vector storage and search in the `metta_codebase` collection.
- **google/embeddinggemma-300m**: Generates 768-dimensional embeddings for MeTTa code.
- **Python**: Implements the pipeline using libraries like `pymongo`, `qdrant-client`, `sentence-transformers`, and `python-dotenv`.
- **Docker**: Runs Qdrant locally for development.

### Integration
- Uses the project’s `chunkDB.chunks` schema for metadata-based indexing.
- Supports local MongoDB for development and testing, with production deployment using the project’s MongoDB Atlas cluster.
- Integrates with the larger project’s data pipeline, potentially alongside FastAPI endpoints for search or ingestion.
- Ensures efficient embedding by checking `isEmbedded` status.

## Usage
- **Run a Search**:
  ```
  python search_metta_code.py
  ```
  - Example queries:
    - Semantic: `"recursive function"`.
    - Filtered by repo: `"recursive function"` from `"github.com/trueagi-io/hyperon-experimental"`.
    - Filtered by source: `"graph relation"` with `source="code"`.
    - Filtered by embedding status: `"multivalued propagation"` with `is_embedded_filter=False`.

- **Customize Searches**:
  Modify `search_metta_code.py`:
  ```python
  search_metta_code(
      query="multivalued propagation",
      repo_filter="github.com/trueagi-io/hyperon-experimental",
      source_filter="code"
  )
  ```