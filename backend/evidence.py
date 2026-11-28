"""Append-only evidence store: every captured record is written together with a signed hash-chain link.

For each record, in ONE SQLite transaction (BEGIN IMMEDIATE, so concurrent ingests cannot fork the chain):
  record_sha256 = SHA-256 of the exact stored record JSON (intercepts.data_json, canonical form)
  chain_hash    = SHA-256 of "sequence|prev_hash|record_sha256|created_at"   (prev_hash of #1 = 64 zeros)
  signature     = Ed25519 over the canonical JSON of the link fields (see `_signed_payload`)

SQLite triggers reject UPDATE and DELETE on intercepts, evidence_chain and signing_keys, so the application cannot
change a record after capture. Someone with the database file can drop the triggers and edit it; the chain and the
signatures are what make that detectable afterwards. Someone who ALSO holds the private key could rebuild and re-sign
the whole chain, which is why the chain head should be recorded off the server regularly (GET /api/chain/head).
"""
import hashlib
import sqlite3
from contextlib import closing
from pathlib import Path
from typing import Any, Dict, List, Optional

from sign import ALGORITHM, StationSigner, canonical_bytes, verify

GENESIS_PREV = "0" * 64
LINK_SCHEME = "sha256(sequence|prevHash|recordSha256|createdAt)"
SIGNED_FIELDS = ["sequence", "recordId", "recordSha256", "textSha256", "prevHash", "chainHash", "createdAt", "keyId"]


# Open the database with a busy timeout so a second writer waits instead of failing.
def _connect(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path, timeout=30)
    conn.row_factory = sqlite3.Row
    return conn


# Create the chain and key tables plus the triggers that make records append-only.
def init_tables(db_path: Path) -> None:
    with closing(_connect(db_path)) as conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS evidence_chain (
            sequence INTEGER PRIMARY KEY,
            record_id TEXT NOT NULL UNIQUE,
            record_sha256 TEXT NOT NULL,
            text_sha256 TEXT NOT NULL,
            prev_hash TEXT NOT NULL,
            chain_hash TEXT NOT NULL,
            created_at TEXT NOT NULL,
            key_id TEXT NOT NULL,
            signature TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS signing_keys (
            key_id TEXT PRIMARY KEY,
            algorithm TEXT NOT NULL,
            public_key TEXT NOT NULL,
            first_used_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TRIGGER IF NOT EXISTS intercepts_no_update BEFORE UPDATE ON intercepts
            BEGIN SELECT RAISE(ABORT, 'intercepts are append-only'); END;
        CREATE TRIGGER IF NOT EXISTS intercepts_no_delete BEFORE DELETE ON intercepts
            BEGIN SELECT RAISE(ABORT, 'intercepts are append-only'); END;
        CREATE TRIGGER IF NOT EXISTS chain_no_update BEFORE UPDATE ON evidence_chain
            BEGIN SELECT RAISE(ABORT, 'evidence_chain is append-only'); END;
        CREATE TRIGGER IF NOT EXISTS chain_no_delete BEFORE DELETE ON evidence_chain
            BEGIN SELECT RAISE(ABORT, 'evidence_chain is append-only'); END;
        CREATE TRIGGER IF NOT EXISTS keys_no_update BEFORE UPDATE ON signing_keys
            BEGIN SELECT RAISE(ABORT, 'signing_keys is append-only'); END;
        CREATE TRIGGER IF NOT EXISTS keys_no_delete BEFORE DELETE ON signing_keys
            BEGIN SELECT RAISE(ABORT, 'signing_keys is append-only'); END;
        """)
        conn.commit()


# SHA-256 of a string's UTF-8 bytes, as hex.
def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


# The exact text stored for a record: canonical JSON, so the same record always hashes the same way.
def record_json(post: Dict[str, Any]) -> str:
    return canonical_bytes(post).decode("utf-8")


# Hash that links one chain entry to the previous one and to the record's content.
def link_hash(sequence: int, prev_hash: str, record_sha256: str, created_at: str) -> str:
    return _sha256(f"{sequence}|{prev_hash}|{record_sha256}|{created_at}")


# The fields covered by the Ed25519 signature, rebuilt identically when verifying.
def _signed_payload(row: Dict[str, Any]) -> Dict[str, Any]:
    return {"sequence": row["sequence"], "recordId": row["record_id"], "recordSha256": row["record_sha256"],
            "textSha256": row["text_sha256"], "prevHash": row["prev_hash"], "chainHash": row["chain_hash"],
            "createdAt": row["created_at"], "keyId": row["key_id"]}


# Insert the record and its signed chain link atomically. Raises sqlite3.IntegrityError if the id already exists.
def append_record(db_path: Path, signer: StationSigner, post: Dict[str, Any]) -> Dict[str, Any]:
    data_json = record_json(post)
    with closing(_connect(db_path)) as conn:
        conn.execute("BEGIN IMMEDIATE")
        try:
            conn.execute(
                "INSERT INTO intercepts (id, channel, raw_text, categories, confidence, district_id, district_name, "
                "sha256, views, data_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (post["id"], post["channel"], post["rawText"], canonical_bytes(post["categories"]).decode("utf-8"),
                 post["confidence"], post["districtId"], post["districtName"], post["sha256"], post.get("views", 0),
                 data_json))
            conn.execute("INSERT OR IGNORE INTO signing_keys (key_id, algorithm, public_key) VALUES (?, ?, ?)",
                         (signer.key_id, ALGORITHM, signer.public_info()["publicKey"]))
            last = conn.execute("SELECT sequence, chain_hash FROM evidence_chain ORDER BY sequence DESC LIMIT 1").fetchone()
            sequence = (last["sequence"] + 1) if last else 1
            prev = last["chain_hash"] if last else GENESIS_PREV
            row = {"sequence": sequence, "record_id": post["id"], "record_sha256": _sha256(data_json),
                   "text_sha256": _sha256(post["rawText"]), "prev_hash": prev,
                   "created_at": post["capturedAtUtc"], "key_id": signer.key_id}
            row["chain_hash"] = link_hash(sequence, prev, row["record_sha256"], row["created_at"])
            row["signature"] = signer.sign(_signed_payload(row))
            conn.execute(
                "INSERT INTO evidence_chain (sequence, record_id, record_sha256, text_sha256, prev_hash, chain_hash, "
                "created_at, key_id, signature) VALUES (:sequence, :record_id, :record_sha256, :text_sha256, "
                ":prev_hash, :chain_hash, :created_at, :key_id, :signature)", row)
            conn.commit()
        except Exception:
            conn.rollback()
            raise
    return public_link(row)


# The chain/signature summary attached to a record in API responses.
def public_link(row: Dict[str, Any]) -> Dict[str, Any]:
    return {"sequence": row["sequence"], "recordSha256": row["record_sha256"], "prevHash": row["prev_hash"],
            "chainHash": row["chain_hash"], "createdAt": row["created_at"],
            "stationSignature": {"algorithm": ALGORITHM, "keyId": row["key_id"], "signature": row["signature"],
                                 "signedFields": SIGNED_FIELDS,
                                 "canonicalization": "JSON, sorted keys, compact separators, UTF-8"},
            "rfc3161Timestamp": {"notImplemented": True,
                                 "note": "Trusted RFC 3161 timestamping needs an external Time Stamping Authority and "
                                         "is not implemented. createdAt is this server's clock and is not "
                                         "independently attested."},
            "linkScheme": LINK_SCHEME}


# Chain links for every record, keyed by record id (one query, for decorating a whole feed).
def links_by_record(db_path: Path) -> Dict[str, Dict[str, Any]]:
    with closing(_connect(db_path)) as conn:
        rows = conn.execute("SELECT * FROM evidence_chain").fetchall()
    return {r["record_id"]: public_link(dict(r)) for r in rows}


# All public keys ever used to sign, keyed by key id.
def known_keys(db_path: Path) -> Dict[str, str]:
    with closing(_connect(db_path)) as conn:
        return {r["key_id"]: r["public_key"] for r in conn.execute("SELECT key_id, public_key FROM signing_keys")}


# Check one link: record still hashes to what was chained, link hash recomputes, and the signature is valid.
def _check_link(row: sqlite3.Row, record: Optional[sqlite3.Row], expected_prev: Optional[str],
                keys: Dict[str, str]) -> Dict[str, Any]:
    r = dict(row)
    record_ok = record is not None and _sha256(record["data_json"]) == r["record_sha256"]
    text_ok = record is not None and _sha256(record["raw_text"] or "") == r["text_sha256"]
    link_ok = link_hash(r["sequence"], r["prev_hash"], r["record_sha256"], r["created_at"]) == r["chain_hash"]
    prev_ok = expected_prev is None or r["prev_hash"] == expected_prev
    pub = keys.get(r["key_id"])
    sig_ok = bool(pub) and verify(_signed_payload(r), r["signature"], pub)
    reason = None
    if record is None:
        reason = "record missing"
    elif not record_ok:
        reason = "stored record changed since capture"
    elif not text_ok:
        reason = "stored raw_text column changed since capture"
    elif not prev_ok:
        reason = "prev_hash does not match previous link"
    elif not link_ok:
        reason = "chain_hash does not recompute"
    elif not sig_ok:
        reason = "signature invalid or signing key unknown"
    return {"recordHashValid": record_ok and text_ok, "chainLinkValid": link_ok and prev_ok,
            "signatureValid": sig_ok, "reason": reason}


# Walk the whole chain from sequence 1 and report the first broken link, if any.
def verify_chain(db_path: Path) -> Dict[str, Any]:
    keys = known_keys(db_path)
    with closing(_connect(db_path)) as conn:
        links = conn.execute("SELECT * FROM evidence_chain ORDER BY sequence ASC").fetchall()
        records = {r["id"]: r for r in conn.execute("SELECT id, raw_text, data_json FROM intercepts")}
    prev = GENESIS_PREV
    for i, link in enumerate(links, start=1):
        if link["sequence"] != i:
            return {"valid": False, "length": len(links), "brokenAt": i, "reason": f"sequence gap: expected {i}, found {link['sequence']}",
                    "head": None, "unchainedRecords": max(0, len(records) - len(links))}
        check = _check_link(link, records.get(link["record_id"]), prev, keys)
        if check["reason"]:
            return {"valid": False, "length": len(links), "brokenAt": link["sequence"], "reason": check["reason"],
                    "head": None, "unchainedRecords": max(0, len(records) - len(links))}
        prev = link["chain_hash"]
    return {"valid": True, "length": len(links), "brokenAt": None, "reason": None,
            "head": prev if links else None, "unchainedRecords": max(0, len(records) - len(links)),
            "note": "Records captured before the evidence chain existed are counted in unchainedRecords and are not covered."}


# Latest chain entry, to be written down off the server so a rebuilt chain would be noticed.
def chain_head(db_path: Path) -> Dict[str, Any]:
    with closing(_connect(db_path)) as conn:
        row = conn.execute("SELECT sequence, chain_hash, created_at, key_id FROM evidence_chain ORDER BY sequence DESC LIMIT 1").fetchone()
    if not row:
        return {"sequence": 0, "chainHash": GENESIS_PREV, "createdAt": None, "keyId": None}
    return {"sequence": row["sequence"], "chainHash": row["chain_hash"], "createdAt": row["created_at"], "keyId": row["key_id"]}


# Verify a single record's link (and that it connects to the link before it).
def verify_record(db_path: Path, record_id: str) -> Dict[str, Any]:
    keys = known_keys(db_path)
    with closing(_connect(db_path)) as conn:
        link = conn.execute("SELECT * FROM evidence_chain WHERE record_id = ?", (record_id,)).fetchone()
        if link is None:
            return {"chained": False, "note": "This record was captured before the evidence chain existed."}
        before = conn.execute("SELECT chain_hash FROM evidence_chain WHERE sequence = ?", (link["sequence"] - 1,)).fetchone()
        record = conn.execute("SELECT id, raw_text, data_json FROM intercepts WHERE id = ?", (record_id,)).fetchone()
    expected_prev = GENESIS_PREV if link["sequence"] == 1 else (before["chain_hash"] if before else "missing")
    return {"chained": True, "sequence": link["sequence"], "keyId": link["key_id"],
            **_check_link(link, record, expected_prev, keys)}
