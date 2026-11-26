# PRAHARI FastAPI prototype

This backend supports analyst text submissions, CSV/JSON dataset imports, a rules based classifier, regex entity extraction, an in-memory entity graph, SQLite storage, and an optional public Telegram web-preview request. It is a hackathon prototype; it does not provide authenticated collection, source verification, legal certification, or a production case-management system.

## Run locally

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The API is available at `http://localhost:8000`; OpenAPI docs are at `/docs`.

## Data and provenance

- Startup seed records and the browser's built-in feed are synthetic and labeled `SYNTHETIC_DEMO`.
- A Telegram scan reports only posts returned by Telegram's public preview. An unavailable/empty preview returns an empty result; no fallback posts are created.
- Uploaded records are labeled `UPLOADED_DATASET`; analyst text is labeled `ANALYST_SUBMISSION`.
- SHA-256 is computed over the UTF-8 bytes of `rawText`. It is a content digest only. It does not prove source authenticity, time of collection, custody, or legal admissibility. Reports are not Section 65B / Section 63 certificates.
- Text without a lexicon match remains unclassified with zero confidence; this rules based prototype does not infer a default crime category.
- District totals are derived from stored rows and explicitly include synthetic startup seed records.
- Legacy database entries are relabeled `LEGACY_UNKNOWN`, their text digest is recalculated, and prior automatic verification/certification claims are removed on load.

## Import format

CSV requires a header and a non-empty `text`, `message`, `rawText`, or `raw_text` column. Optional columns include `channel`, `source`, `timestamp`, `date`, and `views`. Quoted commas, quotes, and newlines follow standard CSV parsing. JSON accepts an array of records, a single record object, or an object with a `records` array; record text fields follow the same names. Imports are limited to 10 MB and 500 records per request.

Text scan requests are limited to 50,000 characters. Public channel preview requests accept a page size from 1 to 50.

## Persistence and deployment

SQLite uses `PRAHARI_DB_PATH`; by default the file is `backend/prahari.db`. Set the variable to a durable mounted volume path in a hosted environment. The checked-in Render service uses the free plan and does not provision a persistent disk, so its local SQLite file is ephemeral across instance replacement. For persistence on Render, attach a persistent disk and set `PRAHARI_DB_PATH` to its mount path, then redeploy manually. The entity graph is rebuilt from the latest 100 stored records at startup and is not a separately persisted full history.

Set `PRAHARI_CORS_ORIGINS` to a comma-separated list of exact frontend origins in deployment. Local defaults allow Vite at `localhost:5173` and `127.0.0.1:5173`.

## Run backend tests

```bash
cd backend
python3 -m unittest test_ingestion
```
