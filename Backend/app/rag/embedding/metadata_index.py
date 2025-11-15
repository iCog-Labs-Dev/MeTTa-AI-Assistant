from qdrant_client import AsyncQdrantClient
from qdrant_client.http.models import PayloadSchemaType, VectorParams, Distance
from app.core.logging import logger

async def create_collection_if_not_exists(qdrant_client: AsyncQdrantClient, collection_name: str):
    """Create Qdrant collection if it doesn't exist"""
    try:
        collections = await qdrant_client.get_collections()
        existing_collections = [col.name for col in collections.collections]
        
        if collection_name not in existing_collections:
            await qdrant_client.create_collection(
                collection_name=collection_name,
                vectors_config=VectorParams(
                    size=384,
                    distance=Distance.COSINE
                )
            )
            logger.info(f"Created Qdrant collection: {collection_name}")
        else:
            logger.info(f"Qdrant collection {collection_name} already exists")
    except Exception as e:
        logger.error(f"Failed to create/check collection {collection_name}: {e}")
        raise

async def setup_metadata_indexes(qdrant_client: AsyncQdrantClient, collection_name: str):
    metadata_fields = {
        # "chunkId": PayloadSchemaType.KEYWORD,
        # "project": PayloadSchemaType.KEYWORD,
        # "repo": PayloadSchemaType.KEYWORD,
        # "file": PayloadSchemaType.KEYWORD,
        # "section": PayloadSchemaType.KEYWORD,
        # "version": PayloadSchemaType.KEYWORD,
        "source": PayloadSchemaType.KEYWORD,
    }

    for field, schema in metadata_fields.items():
        try:
            await qdrant_client.create_payload_index(
                collection_name=collection_name,
                field_name=field,
                field_schema=schema,
            )
            logger.info(f"Metadata index created for '{field}'")
        except Exception as e:
            if "already exists" in str(e):
                logger.warning(f"Index for '{field}' already exists")
            else:
                logger.error(f"Failed to create index for '{field}': {e}")
