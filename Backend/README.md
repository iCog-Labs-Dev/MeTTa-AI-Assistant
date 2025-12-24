<div align="center">

  # MeTTa AI Assistant - Backend

</div>

## Running the Backend
### Initial Setup
#### 1. Clone the repository

```bash
git clone https://github.com/iCog-Labs-Dev/MeTTa-AI-Assistant
cd MeTTa-AI-Assistant/Backend
```

#### 2. Set up environment

```bash
cp .env.example .env
# Update .env with your values
```

### Option A: Run using Docker
#### 1. Build the containers
```bash
docker compose build
```

#### 2. Ingest documents (first time setup)
```bash
docker compose run --rm api python -m app.scripts.ingest_docs
```

You can also use the `--force` flag to re-ingest documents:
```bash
docker compose run --rm api python -m app.scripts.ingest_docs --force
```

This only needs to be done once (unless you want to re-ingest with `--force`).
#### 3. Add function dependencies
```bash
docker compose run --rm api python -m app.scripts.add_dependencies
```

#### 4. Start the server
```bash
docker compose up
```
This will start the FastAPI server on http://localhost:8000.

### Option B: Run locally (without Docker)
#### 1. Create and activate virtual environment
```bash
python -m venv venv
source venv/bin/activate  # Linux/macOS
venv\Scripts\activate     # Windows
```
#### 2. Install dependencies
```bash
pip install -r requirements.txt
```

#### 3. Ingest documents (first time setup)
```bash
python -m app.scripts.ingest_docs
```
You can also use the `--force` flag to re-ingest documents:
```bash
python -m app.scripts.ingest_docs --force
```

#### 4. Add function dependencies
```bash
python -m app.scripts.add_dependencies
```

#### 5. Start the FastAPI server
```bash
python -m app.run

```
