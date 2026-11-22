import datetime
import json
import uuid
import asyncio
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, UploadFile, File, Form, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from classifier import classify_text
from extractor import extract_entities, generate_sha256
from graph_engine import DynamicEntityGraph
from telegram_scraper import scrape_public_telegram_channel

app = FastAPI(
    title="PRAHARI OSINT Backend Engine",
    description="Cross-Channel OSINT & Illicit Trade Intelligence Platform for Rajasthan Police",
    version="1.0.0"
)

# Enable CORS for Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory intelligence repository
INTERCEPTS_STORE: List[Dict[str, Any]] = []
ENTITY_GRAPH = DynamicEntityGraph()
ACTIVE_WEBSOCKETS: List[WebSocket] = []

# District initial counts
DISTRICT_COUNTS: Dict[str, int] = {
    "jaipur": 43,
    "jodhpur": 28,
    "alwar": 31,
    "kota": 22,
    "bikaner": 26,
    "ganganagar": 35,
    "sikar": 19,
    "ajmer": 14,
    "udaipur": 12,
    "bharatpur": 18,
    "barmer": 15,
    "jaisalmer": 11,
}

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
        "district": "ganganagar"
    }
]

def process_and_store_post(channel: str, raw_text: str, district_hint: str = "", views: str = "540") -> Dict[str, Any]:
    classification = classify_text(raw_text)
    entities = extract_entities(raw_text)

    district_id = district_hint or entities["district_id"]
    post_id = f"post_{str(uuid.uuid4())[:6]}"
    now = datetime.datetime.now()

    # Tamper-evident cryptographic signature: SHA256(timestamp + channel + rawText)
    raw_packet = f"{now.isoformat()}||{channel}||{raw_text}"
    sha256_hash = generate_sha256(raw_packet)

    district_name = district_id.capitalize()

    post_record = {
        "id": post_id,
        "channel": channel if channel.startswith("@") else f"@{channel}",
        "channelSubscribers": "14.2K members",
        "timestamp": "Just now",
        "capturedAt": now.strftime("%I:%M:%S %p IST"),
        "rawText": raw_text,
        "categories": classification["categories"],
        "confidence": classification["confidence"],
        "matchedSlang": classification["matched_slang"],
        "entities": {
            "phones": entities["phones"],
            "upis": entities["upis"],
            "handles": entities["handles"],
            "wallets": entities["wallets"],
            "bankAccounts": entities["bank_accounts"]
        },
        "districtId": district_id,
        "districtName": district_name,
        "sha256": sha256_hash,
        "views": int(views) if views.isdigit() else 420,
        "verified": True,
        "status": "FLAGGED",
        "section65B": {
            "certified": True,
            "hashAlgorithm": "SHA-256 (FIPS PUB 180-4)",
            "packetHash": sha256_hash,
            "legalStatute": "Section 65B(4) Indian Evidence Act / Section 63 BSA 2023",
            "jurisdiction": "Rajasthan Police State Cyber Cell",
            "timestampUtc": now.astimezone(datetime.timezone.utc).isoformat()
        }
    }

    # Prepend to store
    INTERCEPTS_STORE.insert(0, post_record)
    if len(INTERCEPTS_STORE) > 100:
        INTERCEPTS_STORE.pop()

    # Update Dynamic Entity Graph
    ENTITY_GRAPH.ingest_intercept(post_record)

    # Update District Threat Counts
    DISTRICT_COUNTS[district_id] = DISTRICT_COUNTS.get(district_id, 10) + 1

    return post_record

# Initialize seed data
for seed in SEED_INTERCEPTS:
    process_and_store_post(seed["channel"], seed["text"], seed["district"])

# -----------------
# API Models
# -----------------
class TextScanRequest(BaseModel):
    text: str
    channel: Optional[str] = "@manual_ingest"
    districtId: Optional[str] = ""

class ChannelScanRequest(BaseModel):
    channel: str
    limit: Optional[int] = 10

# -----------------
# REST Endpoints
# -----------------
@app.get("/api/health")
def health_check():
    return {
        "status": "ONLINE",
        "system": "PRAHARI OSINT Engine",
        "intercepts_count": len(INTERCEPTS_STORE),
        "entities_count": len(ENTITY_GRAPH.nodes),
        "timestamp": datetime.datetime.now().isoformat()
    }

@app.get("/api/feed")
def get_intercept_feed(limit: int = 50, category: Optional[str] = None):
    results = INTERCEPTS_STORE
    if category and category != "ALL":
        results = [p for p in results if category in p["categories"]]
    return results[:limit]

@app.post("/api/scan/text")
async def scan_raw_text(req: TextScanRequest):
    record = process_and_store_post(
        channel=req.channel or "@manual_ingest",
        raw_text=req.text,
        district_hint=req.districtId or ""
    )
    # Broadcast to active WebSockets
    await broadcast_new_intercept(record)
    return record

@app.post("/api/scan/channel")
async def scan_telegram_channel(req: ChannelScanRequest):
    scraped_posts = await scrape_public_telegram_channel(req.channel, limit=req.limit or 8)
    processed_records = []

    for item in scraped_posts:
        rec = process_and_store_post(
            channel=item["channel"],
            raw_text=item["raw_text"],
            views=item.get("views", "500")
        )
        processed_records.append(rec)
        await broadcast_new_intercept(rec)

    return {
        "channel": req.channel,
        "scraped_count": len(processed_records),
        "intercepts": processed_records
    }

@app.post("/api/ingest/file")
async def ingest_dataset_file(file: UploadFile = File(...)):
    content = await file.read()
    raw_str = content.decode("utf-8", errors="ignore")
    new_records = []

    try:
        # Try JSON parsing
        data = json.loads(raw_str)
        if isinstance(data, list):
            for item in data[:30]:
                text = item.get("text") or item.get("message") or item.get("rawText")
                chan = item.get("channel") or item.get("source") or "@uploaded_dataset"
                if text:
                    rec = process_and_store_post(channel=chan, raw_text=text)
                    new_records.append(rec)
                    await broadcast_new_intercept(rec)
    except Exception:
        # Fallback to CSV / plain line parsing
        lines = [l.strip() for l in raw_str.split("\n") if len(l.strip()) > 10]
        for line in lines[:30]:
            parts = line.split(",", 1)
            chan = parts[0] if len(parts) > 1 and parts[0].startswith("@") else "@uploaded_csv"
            text = parts[1] if len(parts) > 1 and parts[0].startswith("@") else line
            rec = process_and_store_post(channel=chan, raw_text=text)
            new_records.append(rec)
            await broadcast_new_intercept(rec)

    return {
        "filename": file.filename,
        "ingested_count": len(new_records),
        "records": new_records
    }

@app.get("/api/graph")
def get_entity_graph():
    return ENTITY_GRAPH.to_dict()

@app.get("/api/districts")
def get_district_telemetry():
    return [
        {
            "id": dist_id,
            "flaggedCount": count,
            "threatLevel": "CRITICAL" if count > 30 else "HIGH" if count > 20 else "ELEVATED"
        }
        for dist_id, count in DISTRICT_COUNTS.items()
    ]

@app.get("/api/dossier/{post_id}")
def get_dossier(post_id: str):
    for post in INTERCEPTS_STORE:
        if post["id"] == post_id:
            return post
    return {"error": "Dossier not found", "postId": post_id}

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
