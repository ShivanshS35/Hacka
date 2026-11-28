import datetime
import json
import uuid
import asyncio
import sqlite3
import csv
import io
import os
from pathlib import Path
from contextlib import closing
from zoneinfo import ZoneInfo
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, UploadFile, File, HTTPException, WebSocket, WebSocketDisconnect, Header
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from classifier import classify_text
from gemini_classifier import hybrid_classify, self_test as gemini_self_test
from extractor import extract_entities, generate_sha256
from graph_engine import DynamicEntityGraph
from gemini_key import key_from_header, check_key
from analytics import build_alerts, find_coordinated
from telegram_scraper import TelegramPreviewError, scrape_public_telegram_channel

app = FastAPI(
    title="PRAHARI OSINT Backend Engine",
    description="Hackathon prototype for cross-channel OSINT data analysis; not an operational agency system",
    version="1.0.0"
)

_allowed_origins = [origin.strip() for origin in os.environ.get(
    "PRAHARI_CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,https://prahari-osint.vercel.app"
).split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    # Vercel preview deployments get random subdomains; set PRAHARI_CORS_REGEX="" to disable.
    allow_origin_regex=os.environ.get("PRAHARI_CORS_REGEX", r"https://.*\.vercel\.app") or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory intelligence repository
INTERCEPTS_STORE: List[Dict[str, Any]] = []
ENTITY_GRAPH = DynamicEntityGraph()
ACTIVE_WEBSOCKETS: List[WebSocket] = []

# Persistent SQLite Database initialization
DB_PATH = Path(os.environ.get("PRAHARI_DB_PATH", Path(__file__).with_name("prahari.db")))

def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(DB_PATH)) as conn:
        conn.execute("""
        CREATE TABLE IF NOT EXISTS intercepts (
            id TEXT PRIMARY KEY,
            channel TEXT,
            raw_text TEXT,
            categories TEXT,
            confidence REAL,
            district_id TEXT,
            district_name TEXT,
            sha256 TEXT,
            views INTEGER,
            data_json TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)
        conn.commit()

def save_to_db(post: Dict[str, Any]):
    try:
        with closing(sqlite3.connect(DB_PATH)) as conn:
            conn.execute("""
            INSERT OR REPLACE INTO intercepts 
            (id, channel, raw_text, categories, confidence, district_id, district_name, sha256, views, data_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                post["id"],
                post["channel"],
                post["rawText"],
                json.dumps(post["categories"]),
                post["confidence"],
                post["districtId"],
                post["districtName"],
                post["sha256"],
                post.get("views", 0),
                json.dumps(post)
            ))
            conn.commit()
    except Exception as e:
        raise RuntimeError(f"Could not persist intercept to {DB_PATH}") from e

def load_from_db() -> List[Dict[str, Any]]:
    with closing(sqlite3.connect(DB_PATH)) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, data_json FROM intercepts ORDER BY created_at DESC LIMIT 100")
        rows = cursor.fetchall()
        posts = []
        for post_id, raw_json in rows:
            post = json.loads(raw_json)
            previous_evidence = post.get("section65B") or {}
            if "sourceType" not in post or post.get("verified") or previous_evidence.get("certified"):
                post["sourceType"] = "LEGACY_UNKNOWN"
                post["verified"] = False
                if isinstance(post.get("rawText"), str):
                    post["sha256"] = generate_sha256(post["rawText"])
                    post["sha256Scope"] = "UTF-8 rawText bytes"
                post["section65B"] = {
                    "certified": False,
                    "status": "NOT_CERTIFIED",
                    "hashAlgorithm": "SHA-256",
                    "hashScope": post.get("sha256Scope", "unknown"),
                    "packetHash": post.get("sha256", ""),
                    "timestampUtc": post.get("capturedAtUtc", "")
                }
                cursor.execute("UPDATE intercepts SET data_json = ?, sha256 = ? WHERE id = ?", (json.dumps(post), post.get("sha256", ""), post_id))
            posts.append(post)
        conn.commit()
        return posts

# Counts are derived from persisted records and include synthetic demo seeds.
DISTRICT_COUNTS: Dict[str, int] = {}

def load_district_counts() -> Dict[str, int]:
    with closing(sqlite3.connect(DB_PATH)) as conn:
        rows = conn.execute("SELECT district_id, COUNT(*) FROM intercepts GROUP BY district_id").fetchall()
    return {district_id: count for district_id, count in rows}

# Seed default realistic initial intercepts into the working backend
SEED_INTERCEPTS = [
    {
        "channel": "@delhi_highs",
        "text": "Pure white chitta consignment ready. 10g score available for Jaipur / Bikaner delivery. Payment advance via UPI raj.pay@oksbi or DM @seller_raj.",
        "district": "jaipur"
    },
    {
        "channel": "@mule_bazaar",
        "text": "Fresh KYC verified current account kit with ATM card + netbanking SIM available for rent. Jaipur delivery. Escrow verified via raj.pay@oksbi.",
        "district": "jaipur"
    },
    {
        "channel": "@rajasthan_arms_hub",
        "text": "Desi .315 bore katta with 10 raund available. Alwar / Sikar pickup only. WhatsApp order +91 9876543210 or BTC escrow bc1qar0srr7x9z4xpmdq.",
        "district": "alwar"
    },
    {
        "channel": "@doc_forge_raj",
        "text": "Fake Aadhaar card biometric bypass + Driving license original PVC card dispatched to Kota client. Admin @seller_raj.",
        "district": "kota"
    },
    {
        "channel": "@border_drop_01",
        "text": "Border synthetic consignment arrived at Sri Ganganagar drop point. Direct escrow to bc1qar0srr7x9z4xpmdq or contact @seller_raj.",
        "district": "sri-ganganagar"
    }
]

def process_and_store_post(channel: str, raw_text: str, district_hint: str = "", views: str = "0", source_type: str = "ANALYST_SUBMISSION", source_timestamp: Optional[str] = None, source_reference: Optional[str] = None, classification: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    # `classification` may be precomputed off the event loop (Gemini calls are slow network I/O).
    classification = classification or hybrid_classify(raw_text, None)
    entities = extract_entities(raw_text)

    aliases = {"bundli": "bundi", "sawaimadhopur": "sawai-madhopur", "sawai madhopur": "sawai-madhopur"}
    normalized_hint = district_hint.strip().lower().replace("_", "-")
    normalized_hint = aliases.get(normalized_hint, normalized_hint)
    district_ids = {"jaipur", "jodhpur", "alwar", "kota", "bikaner", "sri-ganganagar", "sikar", "ajmer", "udaipur", "bharatpur", "barmer", "jaisalmer", "nagaur", "pali", "bhilwara", "chittorgarh", "jhunjhunu", "churu", "hanumangarh", "dholpur", "dausa", "sawai-madhopur", "tonk", "bundi", "baran", "jhalawar", "sirohi", "jalore", "rajsamand", "dungarpur", "banswara", "pratapgarh", "karauli", "unknown"}
    district_id = normalized_hint if normalized_hint in district_ids else entities["district_id"]
    post_id = f"post_{str(uuid.uuid4())[:6]}"
    now = datetime.datetime.now(datetime.timezone.utc)

    view_count = 0
    if isinstance(views, str):
        normalized_views = views.strip().lower().replace(",", "")
        try:
            multiplier = 1_000_000 if normalized_views.endswith("m") else 1_000 if normalized_views.endswith("k") else 1
            view_count = int(float(normalized_views.rstrip("km")) * multiplier)
        except ValueError:
            pass

    # Content digest only: deterministic SHA-256 over the exact captured text.
    sha256_hash = generate_sha256(raw_text)

    district_name = district_id.replace("-", " ").title()

    post_record = {
        "id": post_id,
        "channel": channel if channel.startswith("@") else f"@{channel}",
        "channelSubscribers": "Unknown",
        "timestamp": now.astimezone(datetime.timezone.utc).isoformat(),
        "capturedAt": now.astimezone(ZoneInfo("Asia/Kolkata")).strftime("%I:%M:%S %p IST"),
        "rawText": raw_text,
        "categories": classification["categories"],
        "confidence": classification["confidence"],
        "matchedSlang": classification["matched_slang"],
        "aiAssisted": bool(classification["ai"].get("assisted")),
        "aiReason": classification["ai"].get("reason"),
        "aiModel": classification["ai"].get("model"),
        "aiStatus": classification["ai"].get("status"),
        "entities": {
            "phones": entities["phones"],
            "upis": entities["upis"],
            "handles": entities["handles"],
            "wallets": entities["wallets"],
            "bankAccounts": entities["bank_accounts"],
            "ifscCodes": entities["ifsc_codes"]
        },
        "districtId": district_id,
        "districtName": district_name,
        "sha256": sha256_hash,
        "views": view_count,
        # A digest detects changes to the captured text; it does not authenticate
        # the source, establish chain of custody, or certify legal admissibility.
        "sha256Scope": "UTF-8 rawText bytes",
        "sourceType": source_type,
        "sourceTimestamp": source_timestamp,
        "sourceReference": source_reference,
        "capturedAtUtc": now.astimezone(datetime.timezone.utc).isoformat(),
        "verified": False,
        "status": "FLAGGED" if classification["categories"] else "UNCLASSIFIED",
        "section65B": {
            "certified": False,
            "status": "NOT_CERTIFIED",
            "hashAlgorithm": "SHA-256 (FIPS PUB 180-4)",
            "hashScope": "UTF-8 rawText bytes",
            "packetHash": sha256_hash,
            "timestampUtc": now.astimezone(datetime.timezone.utc).isoformat()
        }
    }

    # Persist first; a failed write must not leave an API-visible record.
    save_to_db(post_record)

    # Prepend to store
    INTERCEPTS_STORE.insert(0, post_record)
    if len(INTERCEPTS_STORE) > 100:
        INTERCEPTS_STORE.pop()

    # Update Dynamic Entity Graph
    ENTITY_GRAPH.ingest_intercept(post_record)

    # Update District Threat Counts
    DISTRICT_COUNTS[district_id] = DISTRICT_COUNTS.get(district_id, 0) + 1

    return post_record

# Initialize SQLite database & Seed Data
init_db()
existing_db_posts = load_from_db()
DISTRICT_COUNTS.update(load_district_counts())
if existing_db_posts:
    for p in reversed(existing_db_posts):
        INTERCEPTS_STORE.insert(0, p)
        ENTITY_GRAPH.ingest_intercept(p)
else:
    for seed in SEED_INTERCEPTS:
        process_and_store_post(seed["channel"], seed["text"], seed["district"], source_type="SYNTHETIC_DEMO")

# -----------------
# API Models
# -----------------
class TextScanRequest(BaseModel):
    text: str = Field(min_length=1, max_length=50_000)
    channel: Optional[str] = Field(default="@manual_ingest", max_length=256)
    districtId: Optional[str] = Field(default="", max_length=64)

class ChannelScanRequest(BaseModel):
    channel: str = Field(min_length=1, max_length=256)
    limit: int = Field(default=10, ge=1, le=50)

# -----------------
# REST Endpoints
# -----------------
@app.get("/", response_class=HTMLResponse)
def root_dashboard():
    return f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>PRAHARI OSINT // Backend Engine Status</title>
      <style>
        body {{
          background-color: #070A10;
          color: #F1F5F9;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
          margin: 0;
          padding: 40px 20px;
          display: flex;
          justify-content: center;
        }}
        .container {{
          max-width: 680px;
          width: 100%;
          background: #0C101A;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 32px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(34, 211, 238, 0.1);
        }}
        .badge {{
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(16, 185, 129, 0.12);
          border: 1px solid rgba(16, 185, 129, 0.3);
          color: #10B981;
          font-size: 11px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 9999px;
          letter-spacing: 0.05em;
        }}
        .dot {{
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #10B981;
          box-shadow: 0 0 8px #10B981;
        }}
        h1 {{
          font-size: 24px;
          margin: 16px 0 8px 0;
          color: #FFFFFF;
          display: flex;
          align-items: center;
          gap: 10px;
        }}
        p {{
          color: #94A3B8;
          font-size: 14px;
          line-height: 1.6;
          margin: 0 0 24px 0;
        }}
        .metrics {{
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 24px;
        }}
        .metric-box {{
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          padding: 14px;
          text-align: center;
        }}
        .metric-val {{
          font-size: 20px;
          font-weight: 800;
          color: #22D3EE;
          font-family: monospace;
        }}
        .metric-lbl {{
          font-size: 10px;
          color: #64748B;
          margin-top: 4px;
          letter-spacing: 0.05em;
        }}
        .links {{
          display: flex;
          flex-direction: column;
          gap: 10px;
        }}
        .btn {{
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 12px 16px;
          color: #F1F5F9;
          text-decoration: none;
          font-size: 13px;
          transition: all 0.15s ease;
        }}
        .btn:hover {{
          background: rgba(34, 211, 238, 0.08);
          border-color: rgba(34, 211, 238, 0.4);
          color: #22D3EE;
        }}
        .btn-primary {{
          background: #22D3EE;
          color: #070A10;
          font-weight: 700;
          border-color: #22D3EE;
        }}
        .btn-primary:hover {{
          background: #67E8F9;
          color: #070A10;
        }}
        .footer {{
          margin-top: 24px;
          padding-top: 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          font-size: 11px;
          color: #475569;
          display: flex;
          justify-content: space-between;
        }}
      </style>
    </head>
    <body>
      <div class="container">
        <div class="badge"><span class="dot"></span> SYSTEM ONLINE · PORT 8000</div>
        <h1>PRAHARI // OSINT Engine</h1>
        <p>Hackathon prototype for cross-channel OSINT analysis. Synthetic examples are labeled in each record.</p>

        <div class="metrics">
          <div class="metric-box">
            <div class="metric-val">{len(INTERCEPTS_STORE)}</div>
            <div class="metric-lbl">ACTIVE INTERCEPTS</div>
          </div>
          <div class="metric-box">
            <div class="metric-val">{len(ENTITY_GRAPH.nodes)}</div>
            <div class="metric-lbl">GRAPH ENTITIES</div>
          </div>
          <div class="metric-box">
            <div class="metric-val">SHA-256</div>
            <div class="metric-lbl">SEC 65B CHAIN</div>
          </div>
        </div>

        <div class="links">
          <a class="btn btn-primary" href="http://localhost:5173" target="_blank">
            <span>Launch Web Command Center UI</span>
            <span>&rarr;</span>
          </a>
          <a class="btn" href="/docs" target="_blank">
            <span>Interactive OpenAPI Swagger Docs</span>
            <span style="color:#64748B;">/docs</span>
          </a>
          <a class="btn" href="/api/health">
            <span>System Health JSON Telemetry</span>
            <span style="color:#64748B;">/api/health</span>
          </a>
          <a class="btn" href="/api/feed">
            <span>Live Intercept Feed JSON Stream</span>
            <span style="color:#64748B;">/api/feed</span>
          </a>
          <a class="btn" href="/api/graph">
            <span>Dynamic Entity Graph JSON</span>
            <span style="color:#64748B;">/api/graph</span>
          </a>
        </div>

        <div class="footer">
          <span>RAJASTHAN POLICE · R4C HACKATHON 2026</span>
          <span>WEBSOCKET: ws://localhost:8000/ws/stream</span>
        </div>
      </div>
    </body>
    </html>
    """

@app.head("/")
def root_head():
    return ""

@app.head("/api/health")
def health_head():
    return ""

@app.get("/api/health")
def health_check():
    return {
        "status": "ONLINE",
        "system": "PRAHARI OSINT Engine",
        "intercepts_count": len(INTERCEPTS_STORE),
        "entities_count": len(ENTITY_GRAPH.nodes),
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }

@app.get("/api/feed")
def get_intercept_feed(limit: int = 50, category: Optional[str] = None):
    limit = max(1, min(limit, 500))
    results = INTERCEPTS_STORE
    if category and category != "ALL":
        results = [p for p in results if category in p["categories"]]
    return results[:limit]

@app.post("/api/scan/text")
async def scan_raw_text(req: TextScanRequest, x_gemini_key: Optional[str] = Header(default=None)):
    classification = await asyncio.to_thread(hybrid_classify, req.text, key_from_header(x_gemini_key))
    record = process_and_store_post(
        channel=req.channel or "@manual_ingest",
        raw_text=req.text,
        district_hint=req.districtId or "",
        classification=classification,
    )
    # Broadcast to active WebSockets
    await broadcast_new_intercept(record)
    return record

@app.post("/api/scan/channel")
async def scan_telegram_channel(req: ChannelScanRequest, x_gemini_key: Optional[str] = Header(default=None)):
    gkey = key_from_header(x_gemini_key)
    try:
        scraped_posts = await scrape_public_telegram_channel(req.channel, limit=max(1, min(req.limit or 8, 50)))
    except TelegramPreviewError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    processed_records = []

    for item in scraped_posts:
        rec = process_and_store_post(
            channel=item["channel"],
            raw_text=item["raw_text"],
            views=item.get("views", "500"),
            source_type=item.get("source", "LIVE_TELEGRAM_PREVIEW"),
            source_timestamp=item.get("timestamp"),
            classification=await asyncio.to_thread(hybrid_classify, item["raw_text"], gkey),
        )
        processed_records.append(rec)
        await broadcast_new_intercept(rec)

    return {
        "channel": req.channel,
        "scraped_count": len(processed_records),
        "intercepts": processed_records
    }

@app.post("/api/ingest/file")
async def ingest_dataset_file(file: UploadFile = File(...), x_gemini_key: Optional[str] = Header(default=None)):
    gkey = key_from_header(x_gemini_key)
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File exceeds 10 MB limit")
    try:
        raw_str = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File must be UTF-8 encoded")
    new_records = []
    filename = (file.filename or "").lower()
    if filename.endswith(".json") or raw_str.lstrip().startswith(("[", "{")):
        try:
            data = json.loads(raw_str)
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=400, detail=f"Invalid JSON: {exc.msg}") from exc
        if isinstance(data, dict):
            data = data.get("records", [data])
        if not isinstance(data, list):
            raise HTTPException(status_code=400, detail="JSON must be an object or array of records")
        rows = data
    else:
        try:
            dialect = csv.Sniffer().sniff(raw_str[:8192], delimiters=",\t;")
        except csv.Error:
            dialect = csv.excel
        reader = csv.DictReader(io.StringIO(raw_str), dialect=dialect)
        if not reader.fieldnames:
            raise HTTPException(status_code=400, detail="CSV header row is required")
        text_columns = {name.strip().lower() for name in reader.fieldnames if name}
        if not text_columns.intersection({"text", "message", "rawtext", "raw_text"}):
            raise HTTPException(status_code=400, detail="CSV header must include a text, message, rawText, or raw_text column")
        rows = list(reader)

    if len(rows) > 500:
        raise HTTPException(status_code=413, detail="Import exceeds the 500 record limit")

    for item in rows:
        if not isinstance(item, dict):
            continue
        normalized = {str(k).strip().lower(): v for k, v in item.items() if k is not None}
        text = normalized.get("text") or normalized.get("message") or normalized.get("rawtext") or normalized.get("raw_text")
        if not isinstance(text, str) or not text.strip():
            continue
        channel = normalized.get("channel") or "uploaded_dataset"
        rec = process_and_store_post(channel=str(channel), raw_text=text.strip(), views=str(normalized.get("views", "0")), source_type="UPLOADED_DATASET", source_timestamp=normalized.get("timestamp") or normalized.get("date"), source_reference=str(normalized.get("source") or file.filename or "uploaded file"), classification=await asyncio.to_thread(hybrid_classify, text.strip(), gkey))
        new_records.append(rec)
        await broadcast_new_intercept(rec)

    if not new_records:
        raise HTTPException(status_code=422, detail="No rows with a non-empty text, message, or rawText field were found")

    return {
        "filename": file.filename,
        "ingested_count": len(new_records),
        "records": new_records
    }

@app.get("/api/graph")
def get_entity_graph():
    return ENTITY_GRAPH.to_dict()

@app.post("/api/gemini/check")
async def gemini_check(x_gemini_key: Optional[str] = Header(default=None)):
    """Verify a user-supplied key. The key is used for this call only and is never stored or logged."""
    key = key_from_header(x_gemini_key)
    result = await asyncio.to_thread(check_key, key)
    if result.get("valid"):
        # One real classification call: proves the whole Gemini path, not just the key.
        result["generation"] = await asyncio.to_thread(gemini_self_test, key)
    return result


@app.get("/api/alerts")
def get_alerts(limit: int = 50, risk: Optional[str] = None):
    alerts = build_alerts(INTERCEPTS_STORE)
    if risk:
        alerts = [a for a in alerts if a["riskLevel"] == risk.upper()]
    return alerts[: max(1, min(limit, 200))]


@app.get("/api/coordinated")
def get_coordinated_ads(threshold: float = 0.65):
    return find_coordinated(INTERCEPTS_STORE, max(0.3, min(threshold, 0.95)))


@app.get("/api/districts")
def get_district_telemetry():
    return [
        {
            "id": dist_id,
            "flaggedCount": count,
            "threatLevel": "CRITICAL" if count > 30 else "HIGH" if count > 20 else "ELEVATED" if count >= 10 else "MODERATE",
            "countScope": "stored records; includes synthetic demo seeds"
        }
        for dist_id, count in DISTRICT_COUNTS.items()
    ]

@app.get("/api/dossier/{post_id}")
def get_dossier(post_id: str):
    for post in INTERCEPTS_STORE:
        if post["id"] == post_id:
            return post
    raise HTTPException(status_code=404, detail=f"Dossier not found: {post_id}")

# -----------------
# WebSocket Real-time Stream
# -----------------
@app.websocket("/ws/stream")
async def websocket_stream(websocket: WebSocket):
    await websocket.accept()
    ACTIVE_WEBSOCKETS.append(websocket)
    try:
        while True:
            # Keepalive ping/pong
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        if websocket in ACTIVE_WEBSOCKETS:
            ACTIVE_WEBSOCKETS.remove(websocket)

async def broadcast_new_intercept(record: Dict[str, Any]):
    dead_sockets = []
    payload = json.dumps({"type": "NEW_INTERCEPT", "data": record})
    for ws in ACTIVE_WEBSOCKETS:
        try:
            await ws.send_text(payload)
        except Exception:
            dead_sockets.append(ws)
    for ws in dead_sockets:
        if ws in ACTIVE_WEBSOCKETS:
            ACTIVE_WEBSOCKETS.remove(ws)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
