"""Officer login, JWT validation, role-based access control and audit binding.

Uses the three demo officers seeded on startup (password Prahari@2026). All data is invented.
"""
import base64
import json
import os
import sqlite3
import tempfile
import time
from pathlib import Path

_db_dir = tempfile.TemporaryDirectory()
os.environ.setdefault("PRAHARI_DB_PATH", str(Path(_db_dir.name) / "auth.db"))

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

import auth
import main

PASSWORD = auth.DEMO_PASSWORD
anon = TestClient(main.app)
service = TestClient(main.app, headers={"Authorization": "Bearer " + os.environ["PRAHARI_API_TOKEN"]})


def _login(username, password=PASSWORD):
    return anon.post("/api/auth/login", json={"username": username, "password": password})


def _client_for(username, password=PASSWORD):
    r = _login(username, password)
    assert r.status_code == 200, r.text
    return TestClient(main.app, headers={"Authorization": "Bearer " + r.json()["accessToken"]})


def _new_post(text="rbac test: chitta available 5g dm"):
    return service.post("/api/scan/text", json={"text": f"{text} {time.time_ns()}", "channel": "@rbac_chan"}).json()["id"]


def _b64(obj):
    return base64.urlsafe_b64encode(json.dumps(obj, separators=(",", ":")).encode()).rstrip(b"=").decode()


# --------------------------------------------------------------------------------------------- 1. login + me
def test_valid_login_returns_token_and_profile_and_me_matches():
    r = _login("inspector_alwar")
    assert r.status_code == 200
    body = r.json()
    assert body["officer"] == {"username": "inspector_alwar", "fullName": "Vikram Singh Rathore", "badgeNumber": "RJ-CY-4412",
                               "rank": "INSPECTOR", "district": "Alwar", "policeStation": "Cyber Crime Police Station Alwar",
                               "isServiceAccount": False}
    assert body["accessToken"].count(".") == 2 and body["expiresIn"] == 24 * 3600
    me = anon.get("/api/auth/me", headers={"Authorization": "Bearer " + body["accessToken"]})
    assert me.status_code == 200 and me.json()["badgeNumber"] == "RJ-CY-4412"
    # the token works on ordinary protected routes too
    assert anon.get("/api/feed", headers={"Authorization": "Bearer " + body["accessToken"]}).status_code == 200


def test_username_is_case_insensitive_and_all_demo_officers_exist():
    assert _login("DSP_Jaipur").json()["officer"]["rank"] == "DSP"
    assert _login("constable_ganganagar").json()["officer"]["district"] == "Sri Ganganagar"


def test_legacy_service_token_is_a_system_admin():
    me = service.get("/api/auth/me").json()
    assert me["isServiceAccount"] is True and me["rank"] == "ADMIN" and me["badgeNumber"] == "SYSTEM"


# ---------------------------------------------------------------------------------------- 2. bad credentials
def test_invalid_password_and_unknown_user_return_401():
    r = _login("inspector_alwar", "wrong-password")
    assert r.status_code == 401 and r.headers["www-authenticate"] == "Bearer"
    assert _login("nobody_here").status_code == 401
    assert anon.post("/api/auth/login", json={"username": "", "password": ""}).status_code == 422


def test_repeated_failures_lock_the_username():
    for _ in range(auth.MAX_FAILED_LOGINS):
        assert _login("lockout_probe", "nope").status_code == 401
    assert _login("lockout_probe", "nope").status_code == 429
    auth._failed.pop("lockout_probe", None)


def test_passwords_are_stored_hashed_with_a_salt():
    with sqlite3.connect(main.DB_PATH) as conn:
        hashes = [h for (h,) in conn.execute("SELECT password_hash FROM users")]
    assert len(hashes) == 3 and len(set(hashes)) == 3          # same password, different salts
    assert all(PASSWORD not in h and h.split("$")[0] in ("scrypt", "pbkdf2_sha256") for h in hashes)
    assert auth.verify_password(PASSWORD, hashes[0]) and not auth.verify_password(PASSWORD + "x", hashes[0])


# --------------------------------------------------------------------------------- 3. expired / tampered JWT
def test_expired_token_is_rejected():
    officer = auth.get_officer("inspector_alwar")
    old = auth.issue_token(officer, now=int(time.time()) - 2 * auth.TOKEN_TTL_SECONDS)
    assert anon.get("/api/auth/me", headers={"Authorization": f"Bearer {old}"}).status_code == 401


def test_tampered_token_is_rejected():
    token = _login("constable_ganganagar").json()["accessToken"]
    header, payload, sig = token.split(".")
    claims = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
    forged = f"{header}.{_b64({**claims, 'sub': 'dsp_jaipur', 'rank': 'DSP'})}.{sig}"     # claims changed, signature kept
    assert anon.get("/api/auth/me", headers={"Authorization": f"Bearer {forged}"}).status_code == 401
    unsigned = f"{_b64({'alg': 'none', 'typ': 'JWT'})}.{payload}."                        # "alg: none" attack
    assert anon.get("/api/auth/me", headers={"Authorization": f"Bearer {unsigned}"}).status_code == 401
    flipped = token[:-2] + ("A" if token[-2] != "A" else "B") + token[-1]
    assert anon.get("/api/auth/me", headers={"Authorization": f"Bearer {flipped}"}).status_code == 401
    assert anon.get("/api/auth/me", headers={"Authorization": "Bearer not.a.jwt"}).status_code == 401
    assert anon.get("/api/auth/me").status_code == 401


def test_deactivated_officer_token_stops_working():
    auth.create_user(main.DB_PATH, "temp_officer", "Temp@Pass123", "Temp Officer", "RJ-TMP-0001", "CONSTABLE", "Ajmer", "Test PS")
    c = _client_for("temp_officer", "Temp@Pass123")
    assert c.get("/api/auth/me").status_code == 200
    with sqlite3.connect(main.DB_PATH) as conn:
        conn.execute("UPDATE users SET is_active = 0 WHERE username = 'temp_officer'")
    assert c.get("/api/auth/me").status_code == 401
    assert _login("temp_officer", "Temp@Pass123").status_code == 401


# ------------------------------------------------------------------------------------------------- 4. RBAC
def test_constable_can_triage_but_not_escalate_or_close():
    pid = _new_post()
    constable = _client_for("constable_ganganagar")
    assert constable.post(f"/api/posts/{pid}/status", json={"status": "REVIEWING"}).status_code == 200
    for status in ("ESCALATED", "closed"):
        r = constable.post(f"/api/posts/{pid}/status", json={"status": status})
        assert r.status_code == 403 and "INSPECTOR" in r.json()["detail"]
    assert service.get(f"/api/dossier/{pid}").json()["analystStatus"] == "REVIEWING"


def test_inspector_and_dsp_can_escalate_and_close():
    pid = _new_post()
    assert _client_for("inspector_alwar").post(f"/api/posts/{pid}/status", json={"status": "ESCALATED"}).status_code == 200
    assert _client_for("dsp_jaipur").post(f"/api/posts/{pid}/status", json={"status": "CLOSED"}).status_code == 200


def test_complaint_upload_and_delete_need_inspector():
    constable = _client_for("constable_ganganagar")
    csv = b"Acknowledgement No,Category\n1,Online Financial Fraud\n"
    assert constable.post("/api/complaints/upload", files={"files": ("c.csv", csv, "text/csv")}).status_code == 403
    assert constable.delete("/api/complaints").status_code == 403
    assert _client_for("inspector_alwar").delete("/api/complaints").status_code == 200


# ------------------------------------------------------------------------------------- 5. audit binding
def test_audit_records_the_logged_in_officer_not_the_client_supplied_name():
    pid = _new_post()
    constable = _client_for("constable_ganganagar")
    r = constable.post(f"/api/posts/{pid}/status",
                       json={"status": "REVIEWING", "note": "checking", "analyst": "DSP Spoofed Name"})
    assert r.status_code == 200
    assert r.json()["actor"] == "CONSTABLE Manish Meena [RJ-CY-7821] (Sri Ganganagar)"
    entry = service.get(f"/api/posts/{pid}/history").json()[0]
    assert entry["action"] == "STATUS_CHANGE"
    assert "RJ-CY-7821" in entry["actor"] and "Spoofed" not in entry["actor"]
    assert entry["detail"]["officer"] == {"username": "constable_ganganagar", "badge": "RJ-CY-7821", "rank": "CONSTABLE"}

    v = _client_for("inspector_alwar").post(f"/api/dossier/{pid}/verify?analyst=Someone%20Else")
    assert v.status_code == 200
    entry = service.get(f"/api/posts/{pid}/history").json()[0]
    assert entry["action"] == "VERIFY_HASH" and "RJ-CY-4412" in entry["actor"] and "Someone" not in entry["actor"]

    _client_for("dsp_jaipur").get("/api/export?format=json&analyst=Fake%20Exporter")
    exports = [e for e in service.get("/api/audit?limit=50").json() if e["action"] == "EXPORT"]
    assert "RJ-IPS-1092" in exports[0]["actor"] and "Fake" not in exports[0]["actor"]
    assert service.get("/api/audit/verify").json()["ok"] is True


def test_changing_the_officer_in_an_audit_entry_breaks_the_chain():
    pid = _new_post()
    _client_for("constable_ganganagar").post(f"/api/posts/{pid}/status", json={"status": "REVIEWING"})
    with sqlite3.connect(main.DB_PATH) as conn:
        row_id, detail = conn.execute(
            "SELECT id, detail_json FROM audit_log WHERE post_id = ? AND action = 'STATUS_CHANGE'", (pid,)).fetchone()
        forged = detail.replace("RJ-CY-7821", "RJ-IPS-1092")
        conn.execute("UPDATE audit_log SET detail_json = ? WHERE id = ?", (forged, row_id))
    broken = service.get("/api/audit/verify").json()
    assert broken["ok"] is False and broken["brokenAtId"] == row_id
    with sqlite3.connect(main.DB_PATH) as conn:
        conn.execute("UPDATE audit_log SET detail_json = ? WHERE id = ?", (detail, row_id))
    assert service.get("/api/audit/verify").json()["ok"] is True


def test_login_attempts_are_audited():
    _login("inspector_alwar", "bad-password-for-audit")
    _login("inspector_alwar")
    actions = [(e["action"], e["actor"]) for e in service.get("/api/audit?limit=10").json()]
    assert ("LOGIN", "INSPECTOR Vikram Singh Rathore [RJ-CY-4412] (Alwar)") in actions
    assert any(a == "LOGIN_FAILED" for a, _ in actions)
    auth._failed.pop("inspector_alwar", None)


# ------------------------------------------------------------------------------------------- WebSocket
def test_websocket_accepts_an_officer_jwt():
    token = _login("constable_ganganagar").json()["accessToken"]
    with anon.websocket_connect("/ws/stream") as ws:
        ws.send_text(json.dumps({"type": "auth", "token": token}))
        assert json.loads(ws.receive_text())["type"] == "AUTH_OK"
    with anon.websocket_connect("/ws/stream") as ws:
        ws.send_text(json.dumps({"type": "auth", "token": token + "x"}))
        with pytest.raises(WebSocketDisconnect) as exc:
            ws.receive_text()
        assert exc.value.code == 1008
