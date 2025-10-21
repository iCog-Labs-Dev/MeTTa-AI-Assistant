# MeTTa-AI-Assistant

## Running the Backend

### 1. Clone the repository

```bash
git clone https://github.com/iCog-Labs-Dev/MeTTa-AI-Assistant
cd MeTTa-AI-Assistant/Backend
```

### 2. Set up environment

```bash
cp .env.example .env
# Update .env with your values
```

### 3. Ingest documents (first time setup)

Before running the application, you need to ingest documents:

```bash
docker compose run --rm api python -m app.scripts.ingest_docs
```

You can also use the `--force` flag to re-ingest documents:
```bash
docker compose run --rm api python -m app.scripts.ingest_docs --force
```

This only needs to be done once (unless you want to re-ingest with `--force`).

### 4. Build and run using Docker

```bash
docker-compose up --build
```

This will start the FastAPI server on http://localhost:8000.

### 5. Ingest documents (for local setup)

Before running the application locally, you need to ingest documents:

```bash
python -m app.scripts.ingest_docs
```

You can also use the `--force` flag to re-ingest documents:
```bash
python -m app.scripts.ingest_docs --force
```

### 6. Run locally (without Docker)

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/macOS
venv\Scripts\activate     # Windows

# Install dependencies
pip install -r requirements.txt

# Start FastAPI server
python -m run.py

```

Note: Remove the --reload flag in production.
