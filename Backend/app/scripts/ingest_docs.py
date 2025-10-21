#!/usr/bin/env python3
"""
Standalone script to scrape and chunk documentation from MeTTa websites.
This script can be run independently to populate the database with documentation chunks.

Features:
- Automatic completion tracking: Skips sites that have been processed successfully
- Duplicate prevention: Won't re-process sites unless forced
- Command line options: Use --force to re-run even if completed

Usage:
    python ingest_docs.py                    # Run normally (skips completed sites)
    python ingest_docs.py --force            # Force re-run all sites

Related scripts:
    python check_ingestion_status.py         # Check which sites have been processed
    python clear_ingestion_status.py --all   # Clear all completion records
    python clear_ingestion_status.py --site <site_name>  # Clear specific site
"""

import asyncio
import sys
import argparse
from pathlib import Path
import os

project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from app.core.doc_ingestion.scraper import scrape_site
from app.core.doc_ingestion.chunker import chunk_documentation_from_pages
from app.core.doc_ingestion.config import SITES_TO_SCRAPE
from app.db.db import insert_chunks, check_ingestion_complete, mark_ingestion_complete

from pymongo import AsyncMongoClient
from pymongo.database import Database

from dotenv import load_dotenv

load_dotenv()


async def get_mongo_db_standalone() -> Database:
    """Get MongoDB database connection for standalone scripts."""
    mongo_uri = os.getenv("MONGO_URI")
    mongo_db_name = os.getenv("MONGO_DB")

    if not mongo_uri:
        logger.error("MONGO_URI is not set. Please set the MONGO_URI environment variable.")
        raise RuntimeError("MONGO_URI environment variable is required")
    
    if not mongo_db_name:
        logger.error("MONGO_DB is not set. Please set the MONGO_DB environment variable.")
        raise RuntimeError("MONGO_DB environment variable is required")

    client = AsyncMongoClient(mongo_uri)
    return client[mongo_db_name]


async def main(force: bool = False):
    """Main function to scrape, chunk, and ingest documentation."""
    print("Starting documentation ingestion process...")

    try:
        db = await get_mongo_db_standalone()
    except Exception as e:
        print(f"Error: Could not connect to MongoDB: {e}")
        return

    total_chunks = 0
    sites_processed = 0

    for site_name in SITES_TO_SCRAPE:
        print(f"\n{'='*60}")
        print(f"Processing site: {site_name}")
        print(f"{'='*60}")

        # Check if this site has already been processed successfully
        if not force:
            completion_record = await check_ingestion_complete(site_name, db)
            if completion_record:
                print(f"Site {site_name} has already been processed successfully!")
                print(
                    f"   Completed at: {completion_record.get('completed_at', 'Unknown')}"
                )
                print(
                    f"   Total chunks: {completion_record.get('total_chunks', 'Unknown')}"
                )
                print(f"   Skipping...")
                continue

        try:
            print(f"Scraping {site_name}...")
            pages = await scrape_site(site_name, delay=1.0)
            print(f"Scraped {len(pages)} pages from {site_name}")

            if pages:
                print(f"Chunking content from {site_name}...")
                chunks = chunk_documentation_from_pages(pages)
                print(f"Generated {len(chunks)} chunks")

                if chunks:
                    print(f"Inserting chunks into database...")
                    inserted_ids = await insert_chunks(chunks, db)
                    if inserted_ids is not None and len(inserted_ids) > 0:
                        print(f"Inserted {len(inserted_ids)} new chunks into database")
                        total_chunks += len(inserted_ids)
                    else:
                        print(
                            f"ℹAll {len(chunks)} chunks already exist in database (duplicates skipped)"
                        )
                        total_chunks += len(chunks)

                    # Mark this site as successfully processed
                    await mark_ingestion_complete(site_name, len(chunks), db)
                    sites_processed += 1
                    print(f"Marked {site_name} as successfully processed")

                    categories = set(chunk["category"] for chunk in chunks)
                    print(f"Sample categories: {list(categories)[:5]}")
                else:
                    print("No chunks generated")
            else:
                print("No pages scraped")

        except Exception as e:
            print(f"Error processing {site_name}: {e}")
            continue

    print(f"\n{'='*60}")
    if sites_processed > 0:
        print(f"Documentation ingestion complete!")
        print(f"Sites processed: {sites_processed}")
        print(f"Total chunks processed: {total_chunks}")
    else:
        print(f"All sites have already been processed successfully!")
        print(f"Use --force flag to re-run the ingestion process.")
    print(f"{'='*60}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Scrape and chunk documentation from MeTTa websites"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force re-run ingestion even if sites have been processed successfully before",
    )
    args = parser.parse_args()

    asyncio.run(main(force=args.force))
