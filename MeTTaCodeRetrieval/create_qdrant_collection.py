from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams

# Configuration
QDRANT_URL = "http://localhost:6333"
COLLECTION_NAME = "metta_codebase"
EMBEDDING_DIM = 768  # Dimension for google/embeddinggemma-300m

# Initialize client
client = QdrantClient(url=QDRANT_URL, timeout=5)

# Check and recreate collection if needed
try:
    collections = client.get_collections()
    if COLLECTION_NAME in [col.name for col in collections.collections]:
        # Delete existing collection to update vector size
        client.delete_collection(collection_name=COLLECTION_NAME)
        print(f"Deleted existing collection: {COLLECTION_NAME}")
    
    # Create collection with correct vector size
    client.create_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=VectorParams(size=EMBEDDING_DIM, distance=Distance.COSINE)
    )
    print(f"Created collection: {COLLECTION_NAME} with vector size {EMBEDDING_DIM}")
    
    # Verify
    collections = client.get_collections()
    print("Current collections:", [col.name for col in collections.collections])
except Exception as e:
    print("Failed to update collection:", str(e))