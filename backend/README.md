# PRAHARI FastAPI prototype

This backend supports analyst text submissions, CSV/JSON dataset imports, a rules based classifier, regex entity extraction, an in-memory entity graph, SQLite storage, and an optional public Telegram web-preview request. It is a hackathon prototype; it does not provide authenticated collection, source verification, legal certification, or a production case-management system.

## Run locally

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export PRAHARI_JWT_SECRET=$(python -c 'import secrets; print(secrets.token_urlsafe(48))')
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The API is available at `http://localhost:8000`; OpenAPI docs are at `/docs` (click **Authorize** and paste the token).

## Security settings

| Variable | Required | Meaning |
|---|---|---|
| `PRAHARI_JWT_SECRET` | recommended | Secret (32+ chars) for signing officer session tokens (HS256, 24 h). If unset, a random secret is used per process, so everyone must sign in again after a restart. |
| `PRAHARI_SEED_DEMO_OFFICERS` | no | `1` (default) seeds the three demo officers into an empty `users` table; `0` disables it. |
| `PRAHARI_API_TOKEN` | no | Legacy shared token (16+ chars) for scripts and tests. Accepted as the `SYSTEM` service account with ADMIN rank. |

Every `/api/*` route except `/api/health`, `/api/pubkey` and `POST /api/auth/login` returns 401 without `Authorization: Bearer <officer token or service token>`. `POST /api/auth/login` takes `{username, password}` and returns `{accessToken, officer}`; `GET /api/auth/me` returns the signed-in officer. Five failed logins for one username lock it for 15 minutes. The WebSocket `/ws/stream` expects `{"type":"auth","token":"<token>"}` as its first message and closes with code 1008 otherwise.

**Roles:** CONSTABLE < INSPECTOR < DSP < ADMIN. Anyone signed in can view and triage (e.g. REVIEWING); marking a case ESCALATED or CLOSED, and uploading or deleting NCRP complaint data, needs INSPECTOR or above (HTTP 403 otherwise). The audit actor is always the signed-in officer, e.g. `INSPECTOR Vikram Singh Rathore [RJ-CY-4412] (Alwar)`; any `analyst` value sent by the client is ignored.
| `PRAHARI_CORS_ORIGINS` | no | Comma-separated exact origins. Default `http://localhost:5173`. `*` is refused. |
| `PRAHARI_CORS_REGEX` | no | Optional origin regex (e.g. your own Vercel previews only). Unset by default. |
| `PRAHARI_SIGNING_KEY` | no | Base64 of a 32-byte Ed25519 seed. Use on hosts without a persistent disk so the key survives redeploys. Generate: `python -c "import base64,nacl.signing; print(base64.b64encode(bytes(nacl.signing.SigningKey.generate())).decode())"` |
| `PRAHARI_SIGNING_KEY_PATH` | no | Key file location if the env key is not set. Default `backend/keys/station_ed25519.key`, created with mode 0600 on first start; the server refuses a key file readable by others. |
| `PRAHARI_DISABLE_DOCS` | no | `1` removes `/docs`, `/redoc`, `/openapi.json`. |

The token is one shared secret, not user accounts: anyone holding it has full access, and the `analyst` name in the audit log is self-declared.

## Evidence chain

Each record is stored together with a signed link in `evidence_chain`, in one transaction (`BEGIN IMMEDIATE`, so concurrent ingests cannot fork the chain). `recordSha256` is the SHA-256 of the exact stored record JSON; `chainHash = sha256(sequence|prevHash|recordSha256|createdAt)`; the Ed25519 signature covers the canonical JSON of `sequence, recordId, recordSha256, textSha256, prevHash, chainHash, createdAt, keyId`. SQLite triggers reject UPDATE and DELETE on records, links and keys.

- `GET /api/pubkey` (public): current key and every key used so far.
- `GET /api/chain/verify`: walks 1..N, recomputes every record hash, link hash and signature; returns `{valid, length, brokenAt, reason, head, unchainedRecords}`.
- `GET /api/chain/head`: latest sequence and hash. Record it off the server daily.
- `POST /api/dossier/{id}/verify`: now also returns `evidenceChain` for that record.

RFC 3161 trusted timestamps are not implemented; every link says so (`rfc3161Timestamp.notImplemented: true`).

## Data and provenance

- Startup seed records and the browser's built-in feed are synthetic and labeled `SYNTHETIC_DEMO`.
- A Telegram scan reports only posts returned by Telegram's public preview. An unavailable/empty preview returns an empty result; no fallback posts are created.
- Uploaded records are labeled `UPLOADED_DATASET`; analyst text is labeled `ANALYST_SUBMISSION`.
- SHA-256 is computed over the UTF-8 bytes of `rawText`. It is a content digest only. It does not prove source authenticity, time of collection, custody, or legal admissibility. Reports are not Section 65B / Section 63 certificates.
- Text without a lexicon match remains unclassified with zero confidence; this rules based prototype does not infer a default crime category.
- District totals are derived from stored rows and explicitly include synthetic startup seed records.
- Legacy database entries are relabeled `LEGACY_UNKNOWN` in memory on load (digest recalculated, old certification claims dropped). The stored rows are not rewritten.

## Import format

CSV requires a header and a non-empty `text`, `message`, `rawText`, or `raw_text` column. Optional columns include `channel`, `source`, `timestamp`, `date`, and `views`. Quoted commas, quotes, and newlines follow standard CSV parsing. JSON accepts an array of records, a single record object, or an object with a `records` array; record text fields follow the same names. Imports are limited to 20 MB and 3000 records per file (larger uploads get HTTP 413; uploads without a Content-Length header get 411).

Text scan requests are limited to 50,000 characters. Public channel preview requests accept a page size from 1 to 50.

## Persistence and deployment

SQLite uses `PRAHARI_DB_PATH`; by default the file is `backend/prahari.db`. Set the variable to a durable mounted volume path in a hosted environment. The checked-in Render service uses the free plan and does not provision a persistent disk, so its local SQLite file is ephemeral across instance replacement. For persistence on Render, attach a persistent disk and set `PRAHARI_DB_PATH` to its mount path, then redeploy manually. The entity graph is rebuilt from the latest 100 stored records at startup and is not a separately persisted full history.

Set `PRAHARI_CORS_ORIGINS` to a comma-separated list of exact frontend origins in deployment. The local default allows only Vite at `http://localhost:5173`. On Render's free plan the disk is not persistent, so set `PRAHARI_SIGNING_KEY` there; otherwise a new key (and an empty database) appears after each redeploy.

## Run backend tests

```bash
cd backend
pip install pytest
python -m pytest -q          # conftest.py supplies a test token and a throwaway signing key
```
