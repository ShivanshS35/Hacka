import datetime
import json
import re
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
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, WebSocket, WebSocketDisconnect, Header
from fastapi.responses import HTMLResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

from classifier import classify_text, detect_direction
import casework
import complaints
import images
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
MAX_STORED_POSTS = int(os.environ.get("PRAHARI_MAX_POSTS", "5000"))   # newest posts kept in memory (all are saved to SQLite)
MAX_IMPORT_RECORDS = 3000   # per uploaded file (the PS02 Telegram exports are up to ~240 messages each)
INTERCEPTS_STORE: List[Dict[str, Any]] = []
DEDUP_INDEX: Dict[tuple, str] = {}   # (channel, sha256, sourceTimestamp) -> post id; filled after init_db()
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
    casework.init_tables(DB_PATH)
    complaints.init_tables(DB_PATH)

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
        cursor.execute("SELECT id, data_json FROM intercepts ORDER BY created_at DESC LIMIT ?", (MAX_STORED_POSTS,))
        rows = cursor.fetchall()
        posts = []
        for post_id, raw_json in rows:
            post = json.loads(raw_json)
            previous_evidence = post.get("evidenceDigest") or post.get("section65B") or {}
            if "sourceType" not in post or post.get("verified") or previous_evidence.get("certified"):
                post["sourceType"] = "LEGACY_UNKNOWN"
                post["verified"] = False
                if isinstance(post.get("rawText"), str):
                    post["sha256"] = generate_sha256(post["rawText"])
                    post["sha256Scope"] = "UTF-8 rawText bytes"
                post["evidenceDigest"] = {
                    "note": "Content digest of rawText; not a legal certificate",
                    "certified": False,
                    "status": "NOT_CERTIFIED",
                    "hashAlgorithm": "SHA-256",
                    "hashScope": post.get("sha256Scope", "unknown"),
                    "packetHash": post.get("sha256", ""),
                    "timestampUtc": post.get("capturedAtUtc", "")
                }
                cursor.execute("UPDATE intercepts SET data_json = ?, sha256 = ? WHERE id = ?", (json.dumps(post), post.get("sha256", ""), post_id))
            post.setdefault("platform", "UNKNOWN")
            post.setdefault("direction", "UNKNOWN")
            post.setdefault("sharedIdentifiers", [])
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

def _clean_channel(channel: str) -> str:
    """Channel names come from untrusted files; drop control characters and spreadsheet-formula
    characters (=, +, -, @ at the start of a cell, quotes, pipes) so an export cannot smuggle a formula."""
    cleaned = re.sub(r"[^\w@. \-]", "", str(channel)).strip().lstrip("=+-@ ")[:64].strip()
    return f"@{cleaned}" if cleaned else "@unknown"

def _str(value: Any, default: str = "") -> str:
    """Form()/Header() defaults are objects when an endpoint function is called directly (as the tests do)."""
    return value if isinstance(value, str) else default

PLATFORMS = {"TELEGRAM", "WHATSAPP", "INSTAGRAM", "FACEBOOK", "X", "OLX", "QUIKR", "YOUTUBE", "SHARECHAT", "OTHER", "UNKNOWN"}
_PLATFORM_ALIASES = {"TWITTER": "X", "WA": "WHATSAPP", "IG": "INSTAGRAM", "FB": "FACEBOOK", "TG": "TELEGRAM",
                     "YOUTUBECOMMENT": "YOUTUBE", "YT": "YOUTUBE", "YOUTUBECOMMENTS": "YOUTUBE"}

def normalize_platform(value: Any) -> str:
    v = re.sub(r"[^A-Z]", "", str(value or "").upper())
    v = _PLATFORM_ALIASES.get(v, v)
    if not v:
        return "UNKNOWN"
    return v if v in PLATFORMS else "OTHER"

def link_similar_images(post: Dict[str, Any], others: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Connect this post to earlier posts whose image is a near-duplicate (perceptual-hash distance <= 10 of 64)."""
    phash = (post.get("image") or {}).get("phash")
    if not phash:
        return []
    matches = images.find_similar(phash, [o for o in others if o["id"] != post["id"]])
    cat = (post.get("categories") or ["UNCLASSIFIED"])[0]
    for m in matches:
        ENTITY_GRAPH.add_edge(post["id"], m["postId"], f"SIMILAR IMAGE (d={m['distance']})", cat)
    return matches

def process_and_store_post(channel: str, raw_text: str, district_hint: str = "", views: str = "0", source_type: str = "ANALYST_SUBMISSION", source_timestamp: Optional[str] = None, source_reference: Optional[str] = None, classification: Optional[Dict[str, Any]] = None, entities: Optional[Dict[str, Any]] = None, platform: str = "UNKNOWN", image: Optional[Dict[str, Any]] = None, actor: str = "analyst", log: bool = True, meta: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    # `classification` may be precomputed off the event loop (Gemini calls are slow network I/O).
    classification = classification or hybrid_classify(raw_text, None)
    entities = entities or extract_entities(raw_text)

    # The same message imported again (same channel, same exact text, same source timestamp) is not stored twice.
    sha256_hash = generate_sha256(raw_text)
    clean_channel = _clean_channel(channel)
    source_timestamp = str(source_timestamp) if source_timestamp not in (None, "") else None
    dedup_key = (clean_channel, sha256_hash, source_timestamp)
    existing_id = DEDUP_INDEX.get(dedup_key)
    if existing_id:
        existing = casework.stored_post(DB_PATH, existing_id) or {"id": existing_id}
        return {**existing, "duplicate": True}

    aliases = {"bundli": "bundi", "sawaimadhopur": "sawai-madhopur", "sawai madhopur": "sawai-madhopur"}
    normalized_hint = district_hint.strip().lower().replace("_", "-")
    normalized_hint = aliases.get(normalized_hint, normalized_hint)
    district_ids = {"jaipur", "jodhpur", "alwar", "kota", "bikaner", "sri-ganganagar", "sikar", "ajmer", "udaipur", "bharatpur", "barmer", "jaisalmer", "nagaur", "pali", "bhilwara", "chittorgarh", "jhunjhunu", "churu", "hanumangarh", "dholpur", "dausa", "sawai-madhopur", "tonk", "bundi", "baran", "jhalawar", "sirohi", "jalore", "rajsamand", "dungarpur", "banswara", "pratapgarh", "karauli", "deeg", "balotra", "beawar", "didwana-kuchaman", "kotputli-behror", "khairthal-tijara", "phalodi", "salumbar", "unknown"}
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

    # Content digest only: deterministic SHA-256 over the exact captured text (computed above).
    district_name = district_id.replace("-", " ").title()

    post_record = {
        "id": post_id,
        "channel": clean_channel,
        "platform": normalize_platform(platform),
        "direction": (classification.get("direction") or detect_direction(raw_text)) if classification["categories"] else "UNKNOWN",
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
        "sharedIdentifiers": entities.get("shared", []),
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
        "evidenceDigest": {
            "note": "Content digest of rawText; not a legal certificate",
            "certified": False,
            "status": "NOT_CERTIFIED",
            "hashAlgorithm": "SHA-256 (FIPS PUB 180-4)",
            "hashScope": "UTF-8 rawText bytes",
            "packetHash": sha256_hash,
            "timestampUtc": now.astimezone(datetime.timezone.utc).isoformat()
        }
    }

    if image:
        post_record["image"] = image
    # Optional source metadata from imports: author inside a group, forwarded-from channel, attached image name, location tag.
    for k, v in (meta or {}).items():
        if v not in (None, ""):
            post_record[k] = v

    # Persist first; a failed write must not leave an API-visible record.
    save_to_db(post_record)
    DEDUP_INDEX[dedup_key] = post_id
    if log:
        casework.log_event(DB_PATH, "INGEST", post_id, actor, {"channel": clean_channel, "sourceType": source_type, "sha256": sha256_hash})

    # Prepend to store
    INTERCEPTS_STORE.insert(0, post_record)
    if len(INTERCEPTS_STORE) > MAX_STORED_POSTS:
        INTERCEPTS_STORE.pop()

    # Update Dynamic Entity Graph
    ENTITY_GRAPH.ingest_intercept(post_record)
    if image:
        post_record["similarImages"] = link_similar_images(post_record, INTERCEPTS_STORE[1:])

    # Update District Threat Counts
    DISTRICT_COUNTS[district_id] = DISTRICT_COUNTS.get(district_id, 0) + 1

    return post_record

# Initialize SQLite database & Seed Data
init_db()
DEDUP_INDEX.update(casework.load_dedup_index(DB_PATH))
existing_db_posts = load_from_db()
DISTRICT_COUNTS.update(load_district_counts())
if existing_db_posts:
    for p in reversed(existing_db_posts):
        INTERCEPTS_STORE.insert(0, p)
        ENTITY_GRAPH.ingest_intercept(p)
    _earlier: List[Dict[str, Any]] = []
    for p in reversed(existing_db_posts):   # oldest first, so each image links to the ones before it
        if (p.get("image") or {}).get("phash"):
            link_similar_images(p, _earlier)
        _earlier.append(p)
else:
    for seed in SEED_INTERCEPTS:
        process_and_store_post(seed["channel"], seed["text"], seed["district"], source_type="SYNTHETIC_DEMO", platform="TELEGRAM", actor="system", log=False)
    casework.log_event(DB_PATH, "SEED", None, "system", {"count": len(SEED_INTERCEPTS), "note": "synthetic demo records"})

# -----------------
# API Models
# -----------------
class TextScanRequest(BaseModel):
    text: str = Field(min_length=1, max_length=50_000)
    channel: Optional[str] = Field(default="@manual_ingest", max_length=256)
    districtId: Optional[str] = Field(default="", max_length=64)
    platform: Optional[str] = Field(default="UNKNOWN", max_length=32)
    analyst: Optional[str] = Field(default="analyst", max_length=64)

    @field_validator("text")
    @classmethod
    def _text_not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("text must contain at least one non-space character")
        return value

class StatusRequest(BaseModel):
    status: str = Field(max_length=32)
    note: Optional[str] = Field(default="", max_length=500)
    analyst: Optional[str] = Field(default="analyst", max_length=64)


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
            <div class="metric-lbl">SHA-256 DIGEST</div>
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
    statuses = casework.all_statuses(DB_PATH)
    return [_decorate(p, statuses) for p in results[:limit]]

@app.post("/api/scan/text")
async def scan_raw_text(req: TextScanRequest, x_gemini_key: Optional[str] = Header(default=None)):
    classification = await asyncio.to_thread(hybrid_classify, req.text, key_from_header(x_gemini_key))
    record = process_and_store_post(
        channel=req.channel or "@manual_ingest",
        raw_text=req.text,
        district_hint=req.districtId or "",
        classification=classification,
        entities=await asyncio.to_thread(extract_entities, req.text),
        platform=req.platform or "UNKNOWN",
        actor=req.analyst or "analyst",
    )
    if not record.get("duplicate"):
        await broadcast_new_intercept(record)
    return _decorate(record)

@app.post("/api/scan/channel")
async def scan_telegram_channel(req: ChannelScanRequest, x_gemini_key: Optional[str] = Header(default=None)):
    gkey = key_from_header(x_gemini_key)
    try:
        scraped_posts = await scrape_public_telegram_channel(req.channel, limit=max(1, min(req.limit or 8, 50)))
    except TelegramPreviewError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    processed_records = []
    duplicates = 0

    for item in scraped_posts:
        rec = process_and_store_post(
            channel=item["channel"],
            raw_text=item["raw_text"],
            views=item.get("views", "500"),
            source_type=item.get("source", "LIVE_TELEGRAM_PREVIEW"),
            source_timestamp=item.get("timestamp"),
            classification=await asyncio.to_thread(hybrid_classify, item["raw_text"], gkey),
            entities=await asyncio.to_thread(extract_entities, item["raw_text"]),
            platform="TELEGRAM",
        )
        if rec.get("duplicate"):
            duplicates += 1
            continue
        processed_records.append(rec)
        await broadcast_new_intercept(rec)

    return {
        "channel": req.channel,
        "scraped_count": len(processed_records),
        "duplicates_skipped": duplicates,
        "intercepts": processed_records
    }

def _first_str(row: Dict[str, Any], keys) -> Optional[str]:
    for k in keys:
        v = row.get(k)
        if isinstance(v, (str, int, float)) and str(v).strip():
            return str(v).strip()
    return None

def _flatten_text(value: Any) -> Optional[str]:
    """Telegram exports store formatted text as a list of strings and {"type", "text"} entities."""
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        parts = [p if isinstance(p, str) else p.get("text", "") if isinstance(p, dict) and isinstance(p.get("text"), str) else "" for p in value]
        return "".join(parts)
    return None

@app.post("/api/ingest/file")
async def ingest_dataset_file(file: UploadFile = File(...), platform: str = Form(""), analyst: str = Form("analyst"), x_gemini_key: Optional[str] = Header(default=None)):
    gkey = key_from_header(x_gemini_key)
    platform, analyst = _str(platform), _str(analyst, "analyst") or "analyst"
    content = await file.read()
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File exceeds 20 MB limit")
    try:
        raw_str = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File must be UTF-8 encoded")
    new_records = []
    duplicates = 0
    export_name = None
    filename = (file.filename or "").lower()
    if filename.endswith(".json") or raw_str.lstrip().startswith(("[", "{")):
        try:
            data = json.loads(raw_str)
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=400, detail=f"Invalid JSON: {exc.msg}") from exc
        export_name = None
        if isinstance(data, dict):
            # Accept a bare record, {"records": [...]}, or a Telegram Desktop export ({"name", "messages": [...]}).
            if isinstance(data.get("name"), str):
                export_name = data["name"]
            wrapped = next((data[k] for k in ("records", "messages", "posts", "items", "data", "results") if isinstance(data.get(k), list)), None)
            data = wrapped if wrapped is not None else [data]
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

    if len(rows) > MAX_IMPORT_RECORDS:
        raise HTTPException(status_code=413, detail=f"Import exceeds the {MAX_IMPORT_RECORDS} record limit")
    image_only = 0

    for item in rows:
        if not isinstance(item, dict):
            continue
        normalized = {str(k).strip().lower(): v for k, v in item.items() if k is not None}
        if normalized.get("type") == "service":      # Telegram "channel created" etc.
            continue
        text = next((t for t in (_flatten_text(normalized.get(k)) for k in ("text", "message", "rawtext", "raw_text", "caption")) if t and t.strip()), None)
        image_ref = _first_str(normalized, ("photo", "image_file", "image", "file"))
        if not text:
            if image_ref:
                image_only += 1    # picture without caption: needs OCR (Import Intel > Screenshot / Image)
            continue
        author = _first_str(normalized, ("from", "author", "username", "account", "page", "user"))
        # Telegram exports: the export name is the channel; a CSV row names its own account/page.
        channel = normalized.get("channel") or export_name or author or "uploaded_dataset"
        row_platform = normalized.get("platform") or platform or ("TELEGRAM" if export_name else "")
        location = _first_str(normalized, ("location_tag", "location", "city", "district"))
        district_hint = extract_entities(location)["district_id"] if location else ""
        meta = {
            "author": author if author and author != channel else None,
            "forwardedFrom": _first_str(normalized, ("forwarded_from",)),
            "imageRef": image_ref,
            "locationTag": location,
            "sourceMessageId": str(normalized["id"]) if normalized.get("id") not in (None, "") else None,
        }
        source_ts = _first_str(normalized, ("timestamp", "date", "posted_at", "posted_at_ist", "created_at", "time"))
        rec = process_and_store_post(channel=str(channel), raw_text=text.strip(), district_hint=district_hint if district_hint != "unknown" else "", views=str(normalized.get("views") or normalized.get("likes") or "0"), source_type="UPLOADED_DATASET", source_timestamp=source_ts, source_reference=str(normalized.get("source") or file.filename or "uploaded file"), classification=await asyncio.to_thread(hybrid_classify, text.strip(), gkey), entities=await asyncio.to_thread(extract_entities, text.strip()), platform=str(row_platform), actor=analyst, log=False, meta=meta)
        if rec.get("duplicate"):
            duplicates += 1
            continue
        new_records.append(rec)
        await broadcast_new_intercept(rec)

    if not new_records and not duplicates:
        raise HTTPException(status_code=422, detail="No rows with a non-empty text, message, or rawText field were found" + (f" ({image_only} picture-only posts need the Screenshot / Image tab)" if image_only else ""))

    # One audit entry per import (not per row) keeps a 500-row import fast.
    await asyncio.to_thread(casework.log_event, DB_PATH, "INGEST_BATCH", None, analyst, {
        "filename": file.filename, "ingested": len(new_records), "duplicatesSkipped": duplicates, "imageOnlySkipped": image_only,
        "firstId": new_records[0]["id"] if new_records else None, "lastId": new_records[-1]["id"] if new_records else None})

    return {
        "filename": file.filename,
        "ingested_count": len(new_records),
        "duplicates_skipped": duplicates,
        "image_only_skipped": image_only,
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
def get_alerts(limit: int = 50, risk: Optional[str] = None, status: Optional[str] = None):
    return _alerts_with_status(risk, status)[: max(1, min(limit, 200))]


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
            rec = _decorate(post)
            return _attach_complaints([rec], {post_id: post}, rescore=False)[0]
    raise HTTPException(status_code=404, detail=f"Dossier not found: {post_id}")


@app.post("/api/dossier/{post_id}/verify")
def verify_dossier_hash(post_id: str, analyst: str = "analyst"):
    """Re-hash the text as stored in the database right now and compare it with the digest recorded at capture."""
    result = casework.verify_hash(DB_PATH, post_id, analyst)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Dossier not found: {post_id}")
    return result


# -----------------
# Analyst workflow, audit log, export
# -----------------
def _decorate(post: Dict[str, Any], statuses: Optional[Dict[str, Dict[str, Any]]] = None) -> Dict[str, Any]:
    statuses = statuses if statuses is not None else casework.all_statuses(DB_PATH)
    default = {"analystStatus": "NEW", "analystNote": "", "statusActor": None, "statusUpdatedAt": None}
    return {**post, **statuses.get(post["id"], default)}


def _complaint_keys(post: Dict[str, Any]) -> List[str]:
    keys = [k for _, k in complaints.keys_for_entities(post.get("entities") or {})]
    for name in (post.get("channel"), post.get("author")):
        if isinstance(name, str) and name.startswith("@") and " " not in name:
            keys.append(complaints.handle_key(name))
    return keys


def _attach_complaints(items: List[Dict[str, Any]], posts_by_id: Dict[str, Dict[str, Any]], rescore: bool) -> List[Dict[str, Any]]:
    """Cross-check each item's identifiers against loaded cybercrime complaints (if any were uploaded)."""
    if not items or complaints.count(DB_PATH) == 0:
        return items
    keys_by_item = {i: _complaint_keys(posts_by_id.get(it.get("postId") or it.get("id"), it)) for i, it in enumerate(items)}
    found = complaints.lookup(DB_PATH, [k for ks in keys_by_item.values() for k in ks])
    for i, it in enumerate(items):
        acks: Dict[str, Dict[str, Any]] = {}
        matched_keys = []
        for k in keys_by_item[i]:
            if k in found:
                matched_keys.append(k)
                for m in found[k]:
                    acks.setdefault(m["ackNo"], {**m, "matchedOn": k})
        if not acks:
            continue
        it["complaintCount"] = len(acks)
        it["complaintMatches"] = list(acks.values())[:5]
        it["complaintMatchedOn"] = matched_keys
        if rescore:
            it["riskScore"] = it.get("riskScore", 0) + 2
            it["riskReasons"] = [*it.get("riskReasons", []), f"identifier found in {len(acks)} cybercrime complaint{'s' if len(acks) > 1 else ''}"]
            it["riskLevel"] = "HIGH" if it["riskScore"] >= 5 else "MEDIUM" if it["riskScore"] >= 3 else "LOW"
    if rescore:
        order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
        items.sort(key=lambda a: (order[a["riskLevel"]], -a["riskScore"]))
    return items


def _alerts_with_status(risk: Optional[str] = None, status: Optional[str] = None) -> List[Dict[str, Any]]:
    statuses = casework.all_statuses(DB_PATH)
    alerts = [_decorate_alert(a, statuses) for a in build_alerts(INTERCEPTS_STORE)]
    alerts = _attach_complaints(alerts, {p["id"]: p for p in INTERCEPTS_STORE}, rescore=True)
    if risk:
        alerts = [a for a in alerts if a["riskLevel"] == risk.upper()]
    if status:
        alerts = [a for a in alerts if a["analystStatus"] == status.upper()]
    return alerts


def _decorate_alert(alert: Dict[str, Any], statuses: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    default = {"analystStatus": "NEW", "analystNote": "", "statusActor": None, "statusUpdatedAt": None}
    return {**alert, **statuses.get(alert["postId"], default)}


def _check_admin(token: Optional[str]) -> None:
    """Complaint data is real and sensitive. If PRAHARI_ADMIN_TOKEN is set on the server, uploads and deletes need it."""
    expected = os.environ.get("PRAHARI_ADMIN_TOKEN", "")
    if expected and (token or "") != expected:
        raise HTTPException(status_code=403, detail="Admin token required to load or clear complaint data")


@app.post("/api/complaints/upload")
async def upload_complaints(files: List[UploadFile] = File(...), analyst: str = Form("analyst"),
                            x_admin_token: Optional[str] = Header(default=None)):
    _check_admin(_str(x_admin_token) or None)
    analyst = _str(analyst, "analyst") or "analyst"
    totals = {"files": 0, "rows": 0, "identifiersAdded": 0}
    errors = []
    for f in files:
        content = await f.read()
        if len(content) > 20 * 1024 * 1024:
            errors.append(f"{f.filename}: larger than 20 MB")
            continue
        try:
            res = await asyncio.to_thread(complaints.load_csv, DB_PATH, content.decode("utf-8-sig"))
        except (UnicodeDecodeError, ValueError) as exc:
            errors.append(f"{f.filename}: {exc}")
            continue
        totals["files"] += 1
        totals["rows"] += res["rows"]
        totals["identifiersAdded"] += res["identifiersAdded"]
    if not totals["files"]:
        raise HTTPException(status_code=400, detail="; ".join(errors) or "No complaint files")
    # Audit: counts only, never content.
    await asyncio.to_thread(casework.log_event, DB_PATH, "COMPLAINTS_LOADED", None, analyst, {**totals, "errors": len(errors)})
    return {**totals, "errors": errors, "summary": complaints.summary(DB_PATH)}


@app.get("/api/complaints/summary")
def complaints_summary():
    s = complaints.summary(DB_PATH)
    if s["complaints"]:
        matched = _attach_complaints([dict(p) for p in INTERCEPTS_STORE], {p["id"]: p for p in INTERCEPTS_STORE}, rescore=False)
        s["postsMatched"] = sum(1 for p in matched if p.get("complaintCount"))
        s["postsChecked"] = len(matched)
    return s


@app.delete("/api/complaints")
def clear_complaints(analyst: str = "analyst", x_admin_token: Optional[str] = Header(default=None)):
    _check_admin(_str(x_admin_token) or None)
    complaints.clear(DB_PATH)
    casework.log_event(DB_PATH, "COMPLAINTS_CLEARED", None, analyst or "analyst", {})
    return {"cleared": True}


@app.post("/api/posts/{post_id}/status")
def set_post_status(post_id: str, req: StatusRequest):
    if not any(p["id"] == post_id for p in INTERCEPTS_STORE) and casework.stored_post(DB_PATH, post_id) is None:
        raise HTTPException(status_code=404, detail=f"Post not found: {post_id}")
    try:
        return casework.set_status(DB_PATH, post_id, req.status, req.note or "", req.analyst or "analyst")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/api/posts/{post_id}/history")
def post_history(post_id: str):
    return casework.audit_entries(DB_PATH, post_id=post_id, limit=200)


@app.get("/api/audit")
def audit_log(limit: int = 100):
    return casework.audit_entries(DB_PATH, limit=limit)


@app.get("/api/audit/verify")
def audit_verify():
    return casework.verify_chain(DB_PATH)


_EXPORT_FIELDS = ["alertId", "postId", "capturedAtUtc", "platform", "channel", "sourceType", "categories", "direction",
                  "confidence", "riskLevel", "riskScore", "riskReasons", "districtId", "phones", "upis", "handles",
                  "wallets", "bankAccounts", "analystStatus", "analystNote", "sha256", "text"]


def _csv_safe(value: Any) -> str:
    """Untrusted text must not become a spreadsheet formula when the export is opened in Excel."""
    text = "" if value is None else str(value)
    return "'" + text if text[:1] in ("=", "+", "-", "@", "\t", "\r") else text


def _export_row(a: Dict[str, Any]) -> Dict[str, Any]:
    ents = a.get("entities") or {}
    return {
        "alertId": a["alertId"], "postId": a["postId"], "capturedAtUtc": a["evidence"].get("capturedAtUtc"),
        "platform": a.get("platform"), "channel": a.get("channel"), "sourceType": a["evidence"].get("sourceType"),
        "categories": a.get("categories"), "direction": a.get("direction"), "confidence": a.get("confidence"),
        "riskLevel": a["riskLevel"], "riskScore": a["riskScore"], "riskReasons": a["riskReasons"],
        "districtId": a.get("districtId"), "phones": ents.get("phones", []), "upis": ents.get("upis", []),
        "handles": ents.get("handles", []), "wallets": ents.get("wallets", []), "bankAccounts": ents.get("bankAccounts", []),
        "analystStatus": a["analystStatus"], "analystNote": a.get("analystNote", ""),
        "sha256": a["evidence"].get("sha256"), "text": a["evidence"].get("text"),
    }


@app.get("/api/export")
def export_alerts(format: str = "csv", risk: Optional[str] = None, status: Optional[str] = None, analyst: str = "analyst"):
    rows = [_export_row(a) for a in _alerts_with_status(risk, status)]
    casework.log_event(DB_PATH, "EXPORT", None, analyst, {"format": format, "risk": risk, "status": status, "rows": len(rows)})
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    if format.lower() == "json":
        body = json.dumps({"exportedAtUtc": stamp, "note": "Prototype export; SHA-256 values are content digests, not legal certificates", "alerts": rows}, ensure_ascii=False, indent=2)
        return Response(body, media_type="application/json", headers={"Content-Disposition": f'attachment; filename="prahari_alerts_{stamp}.json"'})
    if format.lower() != "csv":
        raise HTTPException(status_code=422, detail="format must be csv or json")
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(_EXPORT_FIELDS)
    for r in rows:
        writer.writerow([_csv_safe("; ".join(r[f]) if isinstance(r[f], list) else r[f]) for f in _EXPORT_FIELDS])
    return Response("\ufeff" + buf.getvalue(), media_type="text/csv; charset=utf-8", headers={"Content-Disposition": f'attachment; filename="prahari_alerts_{stamp}.csv"'})


# -----------------
# Image intake (OCR + perceptual hash)
# -----------------
@app.post("/api/ingest/image")
async def ingest_image(file: UploadFile = File(...), channel: str = Form("@image_upload"), platform: str = Form("UNKNOWN"),
                       districtId: str = Form(""), ocrText: str = Form(""), analyst: str = Form("analyst"),
                       sourceTimestamp: str = Form(""), x_gemini_key: Optional[str] = Header(default=None)):
    channel, platform, districtId = _str(channel, "@image_upload"), _str(platform, "UNKNOWN"), _str(districtId)
    sourceTimestamp = _str(sourceTimestamp) or None
    ocrText, analyst = _str(ocrText), _str(analyst, "analyst") or "analyst"
    data = await file.read(images.MAX_IMAGE_BYTES + 1)
    try:
        meta, _img = await asyncio.to_thread(images.analyse_image, data)
    except images.ImageError as exc:
        raise HTTPException(status_code=413 if "8 MB" in str(exc) else 400, detail=str(exc)) from exc
    text = await asyncio.to_thread(images.server_ocr, data)
    ocr_source = "server_tesseract"
    if not text.strip():
        text = (ocrText or "").strip()[:50_000]
        ocr_source = "browser_ocr" if text else "none"
    text = images.clean_ocr_text(text)
    if not text:
        # Keep the image (its hash can still link it to other posts), with a text unique to this file.
        text = f"[no readable text in image sha256:{meta['sha256'][:16]}]"
    meta["ocrSource"] = ocr_source
    meta["note"] = "The image file itself is not stored; only its SHA-256, perceptual hash and the extracted text are kept"
    gkey = key_from_header(x_gemini_key)
    rec = process_and_store_post(
        channel=channel, raw_text=text, district_hint=districtId, source_type="UPLOADED_IMAGE",
        source_reference=file.filename or "uploaded image", source_timestamp=sourceTimestamp,
        classification=await asyncio.to_thread(hybrid_classify, text, gkey),
        entities=await asyncio.to_thread(extract_entities, text),
        platform=platform, image=meta, actor=analyst)
    if not rec.get("duplicate"):
        await broadcast_new_intercept(rec)
    return _decorate(rec)


@app.get("/api/image-matches")
def image_matches(max_distance: int = 10):
    """Groups of posts whose images are near-identical (perceptual-hash distance), nearest pairs first."""
    max_distance = max(0, min(max_distance, 20))
    posts = [p for p in INTERCEPTS_STORE if (p.get("image") or {}).get("phash")]
    parent = {p["id"]: p["id"] for p in posts}
    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x
    best: Dict[str, int] = {}
    for i, a in enumerate(posts):
        for b in posts[i + 1:]:
            d = images.hamming(a["image"]["phash"], b["image"]["phash"])
            if d <= max_distance:
                parent[find(a["id"])] = find(b["id"])
                best[a["id"]] = min(best.get(a["id"], 64), d)
                best[b["id"]] = min(best.get(b["id"], 64), d)
    groups: Dict[str, List[Dict[str, Any]]] = {}
    for p in posts:
        groups.setdefault(find(p["id"]), []).append(p)
    out = []
    for members in groups.values():
        if len(members) < 2:
            continue
        chans = sorted({m["channel"] for m in members})
        out.append({"size": len(members), "channels": chans, "crossChannel": len(chans) > 1,
                    "postIds": [m["id"] for m in members], "closest": min(best.get(m["id"], 64) for m in members)})
    out.sort(key=lambda g: (-g["crossChannel"], -g["size"]))
    return out

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
