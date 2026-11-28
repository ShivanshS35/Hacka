"""Tests for authentication, CORS, upload limits, Ed25519 signatures and the append-only evidence chain.

All data is invented.
"""
import base64
import json
import os
import sqlite3
import subprocess
import sys
import tempfile
import textwrap
import threading
from pathlib import Path

_db_dir = tempfile.TemporaryDirectory()
os.environ.setdefault("PRAHARI_DB_PATH", str(Path(_db_dir.name) / "integrity.db"))

import pytest
from fastapi.testclient import TestClient
from nacl.signing import SigningKey
from starlette.websockets import WebSocketDisconnect

import evidence
import main
import sign

TOKEN = os.environ["PRAHARI_API_TOKEN"]
AUTH = {"Authorization": f"Bearer {TOKEN}"}
client = TestClient(main.app, headers=AUTH)
anon = TestClient(main.app)
HERE = Path(__file__).parent


def _ingest(text, channel="@integrity_chan"):
    r = client.post("/api/scan/text", json={"text": text, "channel": channel})
    assert r.status_code == 200, r.text
    return r.json()


def _without_trigger(trigger, sql, params=()):
    """Simulate someone editing the database file directly: drop the guard trigger, run the edit, restore it."""
    with sqlite3.connect(main.DB_PATH) as conn:
        conn.execute(f"DROP TRIGGER {trigger}")
        conn.execute(sql, params)
    evidence.init_tables(main.DB_PATH)


# ----------------------------------------------------------------------------------------------- authentication
@pytest.mark.parametrize("path", ["/api/feed", "/api/graph", "/api/districts", "/api/alerts", "/api/audit", "/api/complaints/summary",
                                  "/api/chain/verify", "/api/chain/head", "/api/export?format=json"])
def test_protected_get_routes_need_the_token(path):
    assert anon.get(path).status_code == 401
    assert anon.get(path, headers={"Authorization": "Bearer wrong-token-wrong-token"}).status_code == 401
    assert anon.get(path, headers={"Authorization": TOKEN}).status_code == 401   # no "Bearer" scheme
    assert client.get(path).status_code == 200


def test_401_says_bearer_and_post_routes_are_protected():
    r = anon.post("/api/scan/text", json={"text": "chitta available 5g dm"})
    assert r.status_code == 401 and r.headers["www-authenticate"] == "Bearer"
    assert anon.post("/api/ingest/file", files={"file": ("a.csv", b"text\nhello", "text/csv")}).status_code == 401
    assert anon.post("/api/dossier/nope/verify").status_code == 401
    assert anon.delete("/api/complaints").status_code == 401
    assert anon.post("/api/complaints/upload", files={"files": ("c.csv", b"a,b\n1,2", "text/csv")}).status_code == 401


def test_health_pubkey_and_docs_are_open():
    assert anon.get("/api/health").status_code == 200
    pk = anon.get("/api/pubkey").json()
    assert pk["algorithm"] == "Ed25519" and len(base64.b64decode(pk["publicKey"])) == 32
    assert pk["keyId"] == sign.key_id_for(base64.b64decode(pk["publicKey"]))
    assert anon.get("/docs").status_code == 200
    schemes = anon.get("/openapi.json").json()["components"]["securitySchemes"]
    assert any(s.get("scheme") == "bearer" for s in schemes.values())


def test_server_refuses_to_start_without_a_strong_token(tmp_path):
    env = {**os.environ, "PRAHARI_API_TOKEN": "short", "PRAHARI_DB_PATH": str(tmp_path / "x.db")}
    r = subprocess.run([sys.executable, "-c", "import main"], cwd=HERE, env=env, capture_output=True, text=True)
    assert r.returncode != 0 and "PRAHARI_API_TOKEN" in r.stderr


def test_websocket_requires_the_token_as_first_message():
    with anon.websocket_connect("/ws/stream") as ws:
        ws.send_text(json.dumps({"type": "auth", "token": "wrong-token-wrong-token"}))
        with pytest.raises(WebSocketDisconnect) as exc:
            ws.receive_text()
        assert exc.value.code == 1008
    with anon.websocket_connect("/ws/stream") as ws:
        ws.send_text("ping")   # not an auth message
        with pytest.raises(WebSocketDisconnect) as exc:
            ws.receive_text()
        assert exc.value.code == 1008
    with anon.websocket_connect("/ws/stream") as ws:
        ws.send_text(json.dumps({"type": "auth", "token": TOKEN}))
        assert json.loads(ws.receive_text())["type"] == "AUTH_OK"
        ws.send_text("ping")
        assert ws.receive_text() == "pong"


# ------------------------------------------------------------------------------------------------------- CORS
def test_cors_allows_only_listed_origins():
    ok = anon.options("/api/feed", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET",
                                             "Access-Control-Request-Headers": "authorization"})
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert "access-control-allow-credentials" not in ok.headers
    bad = anon.options("/api/feed", headers={"Origin": "https://someone-else.vercel.app", "Access-Control-Request-Method": "GET"})
    assert "access-control-allow-origin" not in bad.headers


def test_wildcard_cors_origin_is_refused(tmp_path):
    env = {**os.environ, "PRAHARI_CORS_ORIGINS": "*", "PRAHARI_DB_PATH": str(tmp_path / "x.db")}
    r = subprocess.run([sys.executable, "-c", "import main"], cwd=HERE, env=env, capture_output=True, text=True)
    assert r.returncode != 0 and "PRAHARI_CORS_ORIGINS" in r.stderr


# ------------------------------------------------------------------------------------------------ upload limit
def test_dataset_over_20_mb_is_rejected_with_413():
    big = b"text\n" + b"a" * (21 * 1024 * 1024)
    r = client.post("/api/ingest/file", files={"file": ("big.csv", big, "text/csv")})
    assert r.status_code == 413 and "20 MB" in r.json()["detail"]


def test_upload_without_content_length_is_rejected():
    def body():
        yield b"--x\r\nContent-Disposition: form-data; name=\"file\"; filename=\"a.csv\"\r\n\r\ntext\nhi\r\n--x--\r\n"
    r = client.post("/api/ingest/file", content=body(), headers={"Content-Type": "multipart/form-data; boundary=x"})
    assert r.status_code == 411


# ------------------------------------------------------------------------------------------------- signatures
def test_signature_round_trip_and_tamper_detection():
    signer = sign.StationSigner(SigningKey.generate())
    payload = {"recordId": "post_abc", "sequence": 1, "text": "नमस्ते chitta"}
    sig = signer.sign(payload)
    pub = signer.public_info()["publicKey"]
    assert sign.verify(payload, sig, pub)
    assert not sign.verify({**payload, "sequence": 2}, sig, pub)
    assert not sign.verify(payload, sig, sign.StationSigner(SigningKey.generate()).public_info()["publicKey"])
    flipped = bytearray(base64.b64decode(sig)); flipped[0] ^= 1
    assert not sign.verify(payload, base64.b64encode(bytes(flipped)).decode(), pub)


def test_key_file_is_created_owner_only_and_loose_permissions_are_refused(tmp_path, monkeypatch):
    monkeypatch.delenv("PRAHARI_SIGNING_KEY", raising=False)
    path = tmp_path / "keys" / "k.key"
    k1 = sign.load_or_create_key(path)
    assert oct(path.stat().st_mode & 0o777) == "0o600"
    assert bytes(sign.load_or_create_key(path)) == bytes(k1)   # reloaded, not regenerated
    os.chmod(path, 0o644)
    with pytest.raises(sign.SigningKeyError):
        sign.load_or_create_key(path)


def test_key_from_environment_variable(monkeypatch):
    seed = bytes(range(32))
    monkeypatch.setenv("PRAHARI_SIGNING_KEY", base64.b64encode(seed).decode())
    assert bytes(sign.load_or_create_key()) == seed
    monkeypatch.setenv("PRAHARI_SIGNING_KEY", base64.b64encode(b"short").decode())
    with pytest.raises(sign.SigningKeyError):
        sign.load_or_create_key()


# --------------------------------------------------------------------------------------------- evidence chain
def test_every_record_gets_a_signed_link_and_no_fake_timestamp():
    r = _ingest("integrity check one: kyc verified current account for rent")
    link = r["evidenceChain"]
    assert link["stationSignature"]["algorithm"] == "Ed25519"
    assert len(base64.b64decode(link["stationSignature"]["signature"])) == 64
    assert link["rfc3161Timestamp"] == {"notImplemented": True, "note": link["rfc3161Timestamp"]["note"]}
    feed = {p["id"]: p for p in client.get("/api/feed?limit=500").json()}
    assert feed[r["id"]]["evidenceChain"]["chainHash"] == link["chainHash"]
    v = client.post(f"/api/dossier/{r['id']}/verify").json()["evidenceChain"]
    assert v["chained"] and v["recordHashValid"] and v["chainLinkValid"] and v["signatureValid"]


def test_chain_of_five_verifies_then_breaks_at_the_edited_record():
    ids = [_ingest(f"chain record {i}: chitta available {i}g dm", channel=f"@chain_{i}")["id"] for i in range(5)]
    status = client.get("/api/chain/verify").json()
    assert status["valid"] is True and status["brokenAt"] is None and status["length"] >= 5
    assert client.get("/api/chain/head").json()["chainHash"] == status["head"]

    with sqlite3.connect(main.DB_PATH) as conn:
        seq = conn.execute("SELECT sequence FROM evidence_chain WHERE record_id = ?", (ids[2],)).fetchone()[0]
        original = conn.execute("SELECT data_json FROM intercepts WHERE id = ?", (ids[2],)).fetchone()[0]
    _without_trigger("intercepts_no_update", "UPDATE intercepts SET data_json = replace(data_json, 'chain record', 'CHAIN RECORD') WHERE id = ?", (ids[2],))
    broken = client.get("/api/chain/verify").json()
    assert broken["valid"] is False and broken["brokenAt"] == seq and "record changed" in broken["reason"]
    _without_trigger("intercepts_no_update", "UPDATE intercepts SET data_json = ? WHERE id = ?", (original, ids[2]))
    assert client.get("/api/chain/verify").json()["valid"] is True


def test_rewritten_link_fails_the_signature_check():
    rid = _ingest("link rewrite: fake aadhaar card dispatch dm")["id"]
    with sqlite3.connect(main.DB_PATH) as conn:
        orig_ts, orig_hash = conn.execute("SELECT created_at, chain_hash FROM evidence_chain WHERE record_id = ?", (rid,)).fetchone()
    _without_trigger("chain_no_update", "UPDATE evidence_chain SET created_at = '2020-01-01T00:00:00+00:00' WHERE record_id = ?", (rid,))
    res = client.get("/api/chain/verify").json()
    assert res["valid"] is False   # chain_hash no longer recomputes
    with sqlite3.connect(main.DB_PATH) as conn:
        row = dict(zip(["sequence", "record_sha256", "prev_hash"], conn.execute(
            "SELECT sequence, record_sha256, prev_hash FROM evidence_chain WHERE record_id = ?", (rid,)).fetchone()))
    # Even with a recomputed chain hash, the attacker cannot produce a valid signature without the key.
    new_hash = evidence.link_hash(row["sequence"], row["prev_hash"], row["record_sha256"], "2020-01-01T00:00:00+00:00")
    _without_trigger("chain_no_update", "UPDATE evidence_chain SET chain_hash = ? WHERE record_id = ?", (new_hash, rid))
    res = client.get("/api/chain/verify").json()
    assert res["valid"] is False and res["reason"].startswith("signature invalid")
    _without_trigger("chain_no_update", "UPDATE evidence_chain SET created_at = ?, chain_hash = ? WHERE record_id = ?", (orig_ts, orig_hash, rid))
    assert client.get("/api/chain/verify").json()["valid"] is True


def test_app_cannot_update_or_delete_records_or_links():
    rid = _ingest("immutable: desi katta available dm")["id"]
    with sqlite3.connect(main.DB_PATH) as conn:
        for sql in ("UPDATE intercepts SET raw_text = 'x' WHERE id = ?", "DELETE FROM intercepts WHERE id = ?",
                    "UPDATE evidence_chain SET signature = 'x' WHERE record_id = ?", "DELETE FROM evidence_chain WHERE record_id = ?"):
            with pytest.raises(sqlite3.IntegrityError):
                conn.execute(sql, (rid,))


def test_file_import_chains_every_row():
    before = client.get("/api/chain/head").json()["sequence"]
    rows = "text,channel\n" + "\n".join(f"bulk sim kit ready batch {i},@bulk_{i}" for i in range(4))
    r = client.post("/api/ingest/file", files={"file": ("b.csv", rows.encode(), "text/csv")}).json()
    assert r["ingested_count"] == 4 and all("evidenceChain" in rec for rec in r["records"])
    assert client.get("/api/chain/head").json()["sequence"] == before + 4
    assert client.get("/api/chain/verify").json()["valid"] is True


def test_concurrent_ingests_produce_a_gap_free_chain(tmp_path):
    db = tmp_path / "conc.db"
    signer = sign.StationSigner(SigningKey.generate())
    with sqlite3.connect(db) as conn:   # same intercepts schema as main.init_db
        conn.execute("CREATE TABLE intercepts (id TEXT PRIMARY KEY, channel TEXT, raw_text TEXT, categories TEXT, "
                     "confidence REAL, district_id TEXT, district_name TEXT, sha256 TEXT, views INTEGER, data_json TEXT, "
                     "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)")
    evidence.init_tables(db)

    def write(i):
        evidence.append_record(db, signer, {"id": f"post_c{i:03d}", "channel": "@c", "rawText": f"text {i}",
                                            "categories": [], "confidence": 0.0, "districtId": "jaipur",
                                            "districtName": "Jaipur", "sha256": "", "views": 0,
                                            "capturedAtUtc": f"2026-01-01T00:00:{i:02d}+00:00"})
    threads = [threading.Thread(target=write, args=(i,)) for i in range(20)]
    for t in threads: t.start()
    for t in threads: t.join()
    res = evidence.verify_chain(db)
    assert res["valid"] is True and res["length"] == 20


def test_restart_keeps_the_key_and_the_chain(tmp_path):
    env = {**os.environ, "PRAHARI_DB_PATH": str(tmp_path / "r.db"),
           "PRAHARI_SIGNING_KEY_PATH": str(tmp_path / "keys" / "k.key")}
    script = textwrap.dedent("""
        import json, os
        from fastapi.testclient import TestClient
        import main
        c = TestClient(main.app, headers={"Authorization": "Bearer " + os.environ["PRAHARI_API_TOKEN"]})
        print(json.dumps({"key": c.get("/api/pubkey").json()["keyId"], "chain": c.get("/api/chain/verify").json()}))
    """)
    first = json.loads(subprocess.run([sys.executable, "-c", script], cwd=HERE, env=env, capture_output=True, text=True, check=True).stdout.splitlines()[-1])
    second = json.loads(subprocess.run([sys.executable, "-c", script], cwd=HERE, env=env, capture_output=True, text=True, check=True).stdout.splitlines()[-1])
    assert first["key"] == second["key"]
    assert first["chain"]["valid"] and second["chain"]["valid"] and second["chain"]["length"] == first["chain"]["length"] >= 5
