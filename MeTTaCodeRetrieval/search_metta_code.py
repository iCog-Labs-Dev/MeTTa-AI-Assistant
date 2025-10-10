from qdrant_client import QdrantClient
from qdrant_client.http.models import Filter, FieldCondition, MatchValue
from sentence_transformers import SentenceTransformer

# Configuration
QDRANT_URL = "http://localhost:6333"
COLLECTION_NAME = "metta_codebase"

# Initialize clients
client = QdrantClient(url=QDRANT_URL, timeout=5)
model = SentenceTransformer('google/embeddinggemma-300m')

# Search function
def search_metta_code(query, repo_filter=None, source_filter=None, is_embedded_filter=None, limit=5):
    try:
        # Embed the query
        query_vector = model.encode(query).tolist()

        # Build metadata filter
        filters = []
        if repo_filter:
            filters.append(
                FieldCondition(
                    key="repo",
                    match=MatchValue(value=repo_filter)
                )
            )
        if source_filter:
            filters.append(
                FieldCondition(
                    key="source",
                    match=MatchValue(value=source_filter)
                )
            )
        if is_embedded_filter is not None:
            filters.append(
                FieldCondition(
                    key="isEmbedded",
                    match=MatchValue(value=is_embedded_filter)
                )
            )
        
        query_filter = Filter(must=filters) if filters else None

        # Perform search
        results = client.search(
            collection_name=COLLECTION_NAME,
            query_vector=query_vector,
            query_filter=query_filter,
            limit=limit
        )

        # Display results
        print(f"\nSearch results for query: '{query}'")
        for i, result in enumerate(results, 1):
            print(f"\nResult {i}:")
            print(f"Score: {result.score:.4f}")
            print(f"Chunk ID: {result.payload['chunkId']}")
            print(f"Chunk: {result.payload['chunk']}")
            print(f"Source: {result.payload['source']}")
            print(f"Project: {result.payload['project']}")
            print(f"Repo: {result.payload['repo']}")
            print(f"Section: {result.payload['section']}")
            print(f"File: {result.payload['file']}")
            print(f"Version: {result.payload['version']}")
            print(f"Is Embedded: {result.payload['isEmbedded']}")
            print("-" * 50)
        
        return results
    
    except Exception as e:
        print("Search failed:", str(e))
        return []

# Example searches
if __name__ == "__main__":
    # Basic semantic search
    search_metta_code("recursive function")
    
    # Search with repo filter
    search_metta_code(
        query="recursive function",
        repo_filter="github.com/trueagi-io/hyperon-experimental"
    )
    
    # Search for code chunks
    search_metta_code(
        query="graph relation",
        source_filter="code"
    )
    
    # Search for unembedded chunks (should be empty after embedding)
    search_metta_code(
        query="multivalued propagation",
        is_embedded_filter=False
    )