"""Analyst case workflow, tamper-evident audit log and evidence re-verification.

Everything here lives in separate SQLite tables. The stored intercept record (and therefore its SHA-256) is never
modified by a status change, so working a case cannot alter the evidence.

The audit log is hash-chained: each entry stores the hash of the previous one, so editing or deleting an old row is
detectable by `verify_chain`. That is tamper-EVIDENCE against casual edits, not authentication: there are no user
accounts in this prototype, the `actor` is whatever the client sent, and someone who owns the database file could
rewrite the whole chain.
"""
import datetime
import hashlib
import json
import sqlite3
from contextlib import closing
from pathlib import Path
from typing import Any, Dict, List, Optional

STATUSES = ("NEW", "REVIEWING", "ESCALATED", "FALSE_POSITIVE", "CLOSED")
GENESIS = "GENESIS"


def _now() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def _connect(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn


def init_tables(db_path: Path) -> None:
    with closing(_connect(db_path)) as conn:
        conn.execute("""
        CREATE TABLE IF NOT EXISTS case_status (
            post_id TEXT PRIMARY KEY,
            status TEXT NOT NULL,
            note TEXT,
            actor TEXT,
            updated_at TEXT
        )""")
        conn.execute("""
        CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT NOT NULL,
            actor TEXT NOT NULL,
            action TEXT NOT NULL,
            post_id TEXT,
            detail_json TEXT,
            prev_hash TEXT NOT NULL,
            entry_hash TEXT NOT NULL
        )""")
        conn.commit()


def _canonical(body: Dict[str, Any]) -> str:
    return json.dumps(body, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


def _entry_hash(prev_hash: str, body: Dict[str, Any]) -> str:
    return hashlib.sha256((prev_hash + _canonical(body)).encode("utf-8")).hexdigest()


def log_event(db_path: Path, action: str, post_id: Optional[str] = None, actor: str = "analyst",
              detail: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    actor = (actor or "analyst").strip()[:64] or "analyst"
    with closing(_connect(db_path)) as conn:
        conn.execute("BEGIN IMMEDIATE")   # one writer at a time, so the chain cannot fork
        last = conn.execute("SELECT entry_hash FROM audit_log ORDER BY id DESC LIMIT 1").fetchone()
        prev = last["entry_hash"] if last else GENESIS
        body = {"ts": _now(), "actor": actor, "action": action, "postId": post_id, "detail": detail or {}}
        h = _entry_hash(prev, body)
        cur = conn.execute(
            "INSERT INTO audit_log (ts, actor, action, post_id, detail_json, prev_hash, entry_hash) VALUES (?,?,?,?,?,?,?)",
            (body["ts"], actor, action, post_id, _canonical(body["detail"]), prev, h))
        conn.commit()
        return {"id": cur.lastrowid, **body, "prevHash": prev, "entryHash": h}


def _row_to_entry(r: sqlite3.Row) -> Dict[str, Any]:
    return {"id": r["id"], "ts": r["ts"], "actor": r["actor"], "action": r["action"], "postId": r["post_id"],
            "detail": json.loads(r["detail_json"] or "{}"), "prevHash": r["prev_hash"], "entryHash": r["entry_hash"]}


def audit_entries(db_path: Path, post_id: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
    limit = max(1, min(limit, 1000))
    with closing(_connect(db_path)) as conn:
        if post_id:
            rows = conn.execute("SELECT * FROM audit_log WHERE post_id = ? ORDER BY id DESC LIMIT ?", (post_id, limit)).fetchall()
        else:
            rows = conn.execute("SELECT * FROM audit_log ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
    return [_row_to_entry(r) for r in rows]


def verify_chain(db_path: Path) -> Dict[str, Any]:
    """Recompute every entry hash from the start. Reports the first entry that does not match."""
    with closing(_connect(db_path)) as conn:
        rows = conn.execute("SELECT * FROM audit_log ORDER BY id ASC").fetchall()
    prev = GENESIS
    for r in rows:
        body = {"ts": r["ts"], "actor": r["actor"], "action": r["action"], "postId": r["post_id"],
                "detail": json.loads(r["detail_json"] or "{}")}
        if r["prev_hash"] != prev or _entry_hash(prev, body) != r["entry_hash"]:
            return {"ok": False, "entries": len(rows), "brokenAtId": r["id"]}
        prev = r["entry_hash"]
    return {"ok": True, "entries": len(rows), "headHash": prev if rows else None}


# ----------------------------------------------------------------------------------------------- status workflow
def set_status(db_path: Path, post_id: str, status: str, note: str = "", actor: str = "analyst") -> Dict[str, Any]:
    status = (status or "").strip().upper()
    if status not in STATUSES:
        raise ValueError(f"status must be one of {', '.join(STATUSES)}")
    note = (note or "").strip()[:500]
    actor = (actor or "analyst").strip()[:64] or "analyst"
    with closing(_connect(db_path)) as conn:
        old = conn.execute("SELECT status FROM case_status WHERE post_id = ?", (post_id,)).fetchone()
        previous = old["status"] if old else "NEW"
        conn.execute(
            "INSERT INTO case_status (post_id, status, note, actor, updated_at) VALUES (?,?,?,?,?) "
            "ON CONFLICT(post_id) DO UPDATE SET status=excluded.status, note=excluded.note, actor=excluded.actor, updated_at=excluded.updated_at",
            (post_id, status, note, actor, _now()))
        conn.commit()
    log_event(db_path, "STATUS_CHANGE", post_id, actor, {"from": previous, "to": status, "note": note})
    return {"postId": post_id, "status": status, "note": note, "actor": actor, "previous": previous}


def all_statuses(db_path: Path) -> Dict[str, Dict[str, Any]]:
    with closing(_connect(db_path)) as conn:
        rows = conn.execute("SELECT * FROM case_status").fetchall()
    return {r["post_id"]: {"analystStatus": r["status"], "analystNote": r["note"], "statusActor": r["actor"],
                           "statusUpdatedAt": r["updated_at"]} for r in rows}


# ----------------------------------------------------------------------------------------------- dedup + verify
def find_duplicate(db_path: Path, channel: str, sha256: str, source_ts: Optional[str]) -> Optional[str]:
    """Same channel + same exact text + same source timestamp = the same message imported again."""
    with closing(_connect(db_path)) as conn:
        row = conn.execute(
            "SELECT id FROM intercepts WHERE sha256 = ? AND channel = ? AND json_extract(data_json, '$.sourceTimestamp') IS ? LIMIT 1",
            (sha256, channel, source_ts)).fetchone()
    return row["id"] if row else None


def load_dedup_index(db_path: Path) -> Dict[tuple, str]:
    """(channel, sha256, sourceTimestamp) -> post id for every stored post; kept in memory so an import is not slowed per row."""
    with closing(_connect(db_path)) as conn:
        rows = conn.execute("SELECT id, channel, sha256, json_extract(data_json, '$.sourceTimestamp') AS ts FROM intercepts").fetchall()
    return {(r["channel"], r["sha256"], r["ts"]): r["id"] for r in rows}


def stored_post(db_path: Path, post_id: str) -> Optional[Dict[str, Any]]:
    with closing(_connect(db_path)) as conn:
        row = conn.execute("SELECT data_json FROM intercepts WHERE id = ?", (post_id,)).fetchone()
    return json.loads(row["data_json"]) if row else None


def verify_hash(db_path: Path, post_id: str, actor: str = "analyst") -> Optional[Dict[str, Any]]:
    """Re-hash the text as it is stored in the database now and compare with the digest recorded at capture."""
    with closing(_connect(db_path)) as conn:
        row = conn.execute("SELECT raw_text, sha256, data_json FROM intercepts WHERE id = ?", (post_id,)).fetchone()
    if not row:
        return None
    recomputed = hashlib.sha256(row["raw_text"].encode("utf-8")).hexdigest()
    record = json.loads(row["data_json"])
    recorded = {
        "column": row["sha256"],
        "record": record.get("sha256"),
        "evidenceDigest": (record.get("evidenceDigest") or {}).get("packetHash"),
    }
    # The text inside the JSON record must match the text column too, otherwise the copies disagree.
    json_text_matches = record.get("rawText") == row["raw_text"]
    match = json_text_matches and all(v == recomputed for v in recorded.values() if v)
    result = {
        "postId": post_id, "match": bool(match), "recomputed": recomputed, "recorded": recorded,
        "textCopiesAgree": json_text_matches, "algorithm": "SHA-256", "scope": "UTF-8 rawText bytes",
        "checkedAtUtc": _now(),
        "note": "Detects a change to the stored text since capture. It does not prove who captured it or when.",
    }
    log_event(db_path, "VERIFY_HASH", post_id, actor, {"match": result["match"], "recomputed": recomputed})
    return result
