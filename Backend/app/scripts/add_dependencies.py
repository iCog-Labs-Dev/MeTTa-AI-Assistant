import asyncio
import argparse
from loguru import logger
from pymongo import AsyncMongoClient
from app.core.utils.helpers import get_required_env
from app.services.dependency_resolver import add_function_dependencies


async def main(batch_size: int = 100, force: bool = False):
    """
    Main function to process chunks and add dependencies.
    
    Args:
        batch_size: Number of chunks to process in each batch
        force: If True, reprocess all chunks even if they have dependencies
    """
    
    mongo_uri = get_required_env("MONGO_URI")
    mongo_db_name = get_required_env("MONGO_DB")
    
    logger.info(f"Connecting to MongoDB: {mongo_db_name}")
    mongo_client = AsyncMongoClient(mongo_uri)
    mongo_db = mongo_client[mongo_db_name]
    
    try:
        await mongo_db.command({"ping": 1})
        logger.info("Successfully connected to MongoDB")
        
        logger.info(f"Starting dependency resolution (batch_size={batch_size}, force={force})")
        stats = await add_function_dependencies(mongo_db, batch_size=batch_size, force=force)
        
        logger.info("Results:")
        logger.info(f"  Total chunks processed: {stats['total_processed']}")
        logger.info(f"  Total chunks updated: {stats['total_updated']}")
        logger.info(f"  Total dependencies added: {stats['total_dependencies_added']}")
        
        if stats['total_updated'] > 0:
            avg_deps = stats['total_dependencies_added'] / stats['total_updated']
            logger.info(f"  Average dependencies per chunk: {avg_deps:.2f}")
        
        logger.info("Dependency resolution completed successfully!")
        
    except Exception as e:
        logger.error(f"Error during dependency resolution: {e}")
        raise
    finally:
        await mongo_client.close()
        logger.info("MongoDB connection closed")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Add function dependencies to code chunks in MongoDB"
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=100,
        help="Number of chunks to process in each batch (default: 100)"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Reprocess all chunks, even those with existing dependencies"
    )
    
    args = parser.parse_args()
    
    asyncio.run(main(batch_size=args.batch_size, force=args.force))
