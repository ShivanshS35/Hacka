"""Officer authentication and role-based access control.

* Officers live in the `users` table. Passwords are hashed with scrypt (stdlib `hashlib.scrypt`, random 16-byte salt)
  and compared with `hmac.compare_digest`. On Pythons without scrypt (Apple's LibreSSL build) PBKDF2-SHA256 is used.
* A successful login returns an HS256-signed JWT (stdlib HMAC-SHA256, 24-hour expiry) signed with PRAHARI_JWT_SECRET.
  Every request re-reads the officer from the database, so deactivating an account takes effect immediately.
* Backward compatibility: if PRAHARI_API_TOKEN is set, that exact bearer token is accepted as a SYSTEM service account
  with the ADMIN rank (for scripts and automated tests).
* Ranks, lowest to highest: CONSTABLE < INSPECTOR < DSP < ADMIN.

The audit log records the actor derived from the verified token, never a name typed by the client.
"""
import base64
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import sys
import threading
import time
from contextlib import closing
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

RANKS = ("CONSTABLE", "INSPECTOR", "DSP", "ADMIN")
RANK_LEVEL = {r: i for i, r in enumerate(RANKS)}
MIN_TOKEN_LENGTH = 16
TOKEN_TTL_SECONDS = 24 * 3600
SCRYPT_N, SCRYPT_R, SCRYPT_P, SCRYPT_DKLEN = 2 ** 14, 8, 1, 64
# Apple's system Python is built against LibreSSL and has no hashlib.scrypt; there we fall back to PBKDF2-SHA256.
HAVE_SCRYPT = hasattr(hashlib, "scrypt")
PBKDF2_ITERATIONS = 600_000

# Login throttling: this many failures for one username within the window locks that username for the window.
MAX_FAILED_LOGINS = 5
LOCKOUT_WINDOW_SECONDS = 15 * 60

DEMO_PASSWORD = "Prahari@2026"
DEMO_OFFICERS = [
    ("inspector_alwar", "Vikram Singh Rathore", "RJ-CY-4412", "INSPECTOR", "Alwar", "Cyber Crime Police Station Alwar"),
    ("dsp_jaipur", "Ananya Sharma", "RJ-IPS-1092", "DSP", "Jaipur Rural", "State Cyber Crime Cell HQ"),
    ("constable_ganganagar", "Manish Meena", "RJ-CY-7821", "CONSTABLE", "Sri Ganganagar", "Border Cyber Unit"),
]

# auto_error=False so we return our own 401 with a WWW-Authenticate header instead of FastAPI's 403.
bearer_scheme = HTTPBearer(auto_error=False, description="Officer JWT from POST /api/auth/login (or the legacy PRAHARI_API_TOKEN)")

_DB_PATH: Optional[Path] = None
_failed: Dict[str, list] = {}
_failed_lock = threading.Lock()


@dataclass(frozen=True)
class OfficerProfile:
    username: str
    full_name: str
    badge_number: str
    rank: str
    district: str
    police_station: str
    is_service_account: bool = False

    # The audit-log actor string, e.g. "INSPECTOR Vikram Singh Rathore [RJ-CY-4412] (Alwar)".
    def actor(self) -> str:
        return f"{self.rank} {self.full_name} [{self.badge_number}] ({self.district})"

    # Fields stored inside each audit entry's hashed detail, binding the entry to this officer.
    def audit_meta(self) -> Dict[str, str]:
        return {"username": self.username, "badge": self.badge_number, "rank": self.rank}

    # Profile sent to the browser (camelCase, no secrets).
    def public(self) -> Dict[str, Any]:
        return {"username": self.username, "fullName": self.full_name, "badgeNumber": self.badge_number,
                "rank": self.rank, "district": self.district, "policeStation": self.police_station,
                "isServiceAccount": self.is_service_account}

    # True when this officer's rank is at least `minimum`.
    def at_least(self, minimum: str) -> bool:
        return RANK_LEVEL[self.rank] >= RANK_LEVEL[minimum]


SYSTEM_ACCOUNT = OfficerProfile("system", "SYSTEM Service Account", "SYSTEM", "ADMIN", "All districts",
                                "Automation (PRAHARI_API_TOKEN)", is_service_account=True)


# --------------------------------------------------------------------------------------------- configuration
# Optional legacy service token; refuse to start with a weak one rather than silently accept it.
def load_api_token() -> Optional[str]:
    token = os.environ.get("PRAHARI_API_TOKEN", "").strip()
    if not token:
        return None
    if len(token) < MIN_TOKEN_LENGTH:
        raise RuntimeError(
            f"PRAHARI_API_TOKEN is set but shorter than {MIN_TOKEN_LENGTH} characters. Use a random value, e.g. "
            "python -c 'import secrets; print(secrets.token_urlsafe(32))', or unset it to allow officer logins only.")
    return token


# JWT signing secret. Without PRAHARI_JWT_SECRET a random one is made per process, so a forgeable default never exists;
# the cost is that every officer has to log in again after a restart.
def load_jwt_secret() -> bytes:
    raw = os.environ.get("PRAHARI_JWT_SECRET", "").strip()
    if len(raw) >= 32:
        return raw.encode("utf-8")
    if raw:
        raise RuntimeError("PRAHARI_JWT_SECRET must be at least 32 characters")
    print("PRAHARI: PRAHARI_JWT_SECRET is not set; using a random per-process secret (officers must log in again "
          "after every restart). Set it in production.", file=sys.stderr, flush=True)
    return secrets.token_bytes(32)


API_TOKEN = load_api_token()
JWT_SECRET = load_jwt_secret()


# Constant-time check of a bearer value against the legacy service token.
def token_matches(candidate: Optional[str]) -> bool:
    return bool(API_TOKEN) and bool(candidate) and hmac.compare_digest(candidate.encode("utf-8"), API_TOKEN.encode("utf-8"))


# ------------------------------------------------------------------------------------------------- passwords
# scrypt hash stored as "scrypt$N$r$p$salt_b64$hash_b64" (or "pbkdf2_sha256$iterations$salt_b64$hash_b64" where
# this Python has no scrypt). Both use a random 16-byte salt.
def hash_password(password: str, salt: Optional[bytes] = None) -> str:
    salt = salt or secrets.token_bytes(16)
    b64 = lambda b: base64.b64encode(b).decode()  # noqa: E731
    if HAVE_SCRYPT:
        dk = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=SCRYPT_N, r=SCRYPT_R, p=SCRYPT_P, dklen=SCRYPT_DKLEN)
        return f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${b64(salt)}${b64(dk)}"
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${b64(salt)}${b64(dk)}"


# Recompute the hash with the stored parameters and compare in constant time.
def verify_password(password: str, stored: str) -> bool:
    try:
        parts = stored.split("$")
        if parts[0] == "scrypt" and len(parts) == 6 and HAVE_SCRYPT:
            _, n, r, p, salt_b64, hash_b64 = parts
            expected = base64.b64decode(hash_b64)
            dk = hashlib.scrypt(password.encode("utf-8"), salt=base64.b64decode(salt_b64), n=int(n), r=int(r), p=int(p),
                                dklen=len(expected))
        elif parts[0] == "pbkdf2_sha256" and len(parts) == 4:
            _, iterations, salt_b64, hash_b64 = parts
            expected = base64.b64decode(hash_b64)
            dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), base64.b64decode(salt_b64), int(iterations))
        else:
            return False
        return hmac.compare_digest(dk, expected)
    except (ValueError, TypeError):
        return False


# Spent on unknown usernames so a login attempt takes the same time whether or not the account exists.
_DUMMY_HASH = hash_password(secrets.token_urlsafe(16))


# ----------------------------------------------------------------------------------------------------- users
def _connect(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path, timeout=30)
    conn.row_factory = sqlite3.Row
    return conn


# Create the officers table, remember the database path, and seed the demo officers into an empty table.
def init_tables(db_path: Path) -> None:
    global _DB_PATH
    _DB_PATH = Path(db_path)
    with closing(_connect(db_path)) as conn:
        conn.execute(f"""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            full_name TEXT NOT NULL,
            badge_number TEXT NOT NULL,
            rank TEXT NOT NULL CHECK (rank IN ({",".join(repr(r) for r in RANKS)})),
            district TEXT NOT NULL,
            police_station TEXT NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )""")
        conn.commit()
        empty = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0
    if empty and os.environ.get("PRAHARI_SEED_DEMO_OFFICERS", "1").strip().lower() not in ("0", "false", "no"):
        for username, full_name, badge, rank, district, station in DEMO_OFFICERS:
            create_user(db_path, username, DEMO_PASSWORD, full_name, badge, rank, district, station)


# Add an officer account (password is hashed here; the plain password is never stored).
def create_user(db_path: Path, username: str, password: str, full_name: str, badge_number: str, rank: str,
                district: str, police_station: str) -> None:
    if rank not in RANK_LEVEL:
        raise ValueError(f"rank must be one of {', '.join(RANKS)}")
    with closing(_connect(db_path)) as conn:
        conn.execute(
            "INSERT INTO users (username, password_hash, full_name, badge_number, rank, district, police_station) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (username.strip().lower(), hash_password(password), full_name, badge_number, rank, district, police_station))
        conn.commit()


def _row_to_profile(r: sqlite3.Row) -> OfficerProfile:
    return OfficerProfile(r["username"], r["full_name"], r["badge_number"], r["rank"], r["district"], r["police_station"])


# Active officer by username, or None.
def get_officer(username: str, db_path: Optional[Path] = None) -> Optional[OfficerProfile]:
    path = db_path or _DB_PATH
    if path is None:
        return None
    with closing(_connect(path)) as conn:
        r = conn.execute("SELECT * FROM users WHERE username = ? AND is_active = 1", (username,)).fetchone()
    return _row_to_profile(r) if r else None


# ------------------------------------------------------------------------------------------------------ login
class LoginLocked(Exception):
    pass


def _recent_failures(username: str, now: float) -> list:
    window = [t for t in _failed.get(username, []) if now - t < LOCKOUT_WINDOW_SECONDS]
    _failed[username] = window
    return window


# Check a username/password; returns the officer, None for wrong credentials, or raises LoginLocked when throttled.
def authenticate(username: str, password: str, db_path: Optional[Path] = None) -> Optional[OfficerProfile]:
    username = (username or "").strip().lower()
    now = time.time()
    with _failed_lock:
        if len(_recent_failures(username, now)) >= MAX_FAILED_LOGINS:
            raise LoginLocked()
    path = db_path or _DB_PATH
    with closing(_connect(path)) as conn:
        r = conn.execute("SELECT * FROM users WHERE username = ? AND is_active = 1", (username,)).fetchone()
    ok = verify_password(password or "", r["password_hash"] if r else _DUMMY_HASH) and r is not None
    with _failed_lock:
        if ok:
            _failed.pop(username, None)
        else:
            _failed.setdefault(username, []).append(now)
    return _row_to_profile(r) if ok else None


# ------------------------------------------------------------------------------------------------------- JWT
def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


# Signed HS256 JWT for an officer, valid for 24 hours.
def issue_token(officer: OfficerProfile, now: Optional[int] = None, ttl: int = TOKEN_TTL_SECONDS) -> str:
    now = int(now if now is not None else time.time())
    header = _b64url(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    payload = _b64url(json.dumps({"sub": officer.username, "rank": officer.rank, "iat": now, "exp": now + ttl,
                                  "jti": secrets.token_hex(8)}, separators=(",", ":")).encode())
    sig = hmac.new(JWT_SECRET, f"{header}.{payload}".encode("ascii"), hashlib.sha256).digest()
    return f"{header}.{payload}.{_b64url(sig)}"


# Verify signature, algorithm and expiry; returns the claims or None. Never raises.
def decode_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        header_b64, payload_b64, sig_b64 = token.split(".")
        header = json.loads(_b64url_decode(header_b64))
        if header.get("alg") != "HS256":   # rejects "none" and algorithm-swap attacks
            return None
        expected = hmac.new(JWT_SECRET, f"{header_b64}.{payload_b64}".encode("ascii"), hashlib.sha256).digest()
        if not hmac.compare_digest(expected, _b64url_decode(sig_b64)):
            return None
        claims = json.loads(_b64url_decode(payload_b64))
        if not isinstance(claims.get("exp"), int) or claims["exp"] <= time.time():
            return None
        return claims
    except (ValueError, TypeError, AttributeError):
        return None


# Resolve a bearer value (legacy service token or officer JWT) to an officer, or None.
def officer_for_bearer(value: Optional[str]) -> Optional[OfficerProfile]:
    if not value:
        return None
    if token_matches(value):
        return SYSTEM_ACCOUNT
    claims = decode_token(value)
    return get_officer(str(claims.get("sub", ""))) if claims else None


def _unauthorized() -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing, invalid or expired login",
                         headers={"WWW-Authenticate": "Bearer"})


# FastAPI dependency: the officer behind "Authorization: Bearer <JWT or service token>", else 401.
def get_current_officer(credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)) -> OfficerProfile:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise _unauthorized()
    officer = officer_for_bearer(credentials.credentials)
    if officer is None:
        raise _unauthorized()
    return officer


# 403 unless the officer's rank is at least `minimum`.
def require_rank(officer: OfficerProfile, minimum: str, action: str) -> None:
    if not officer.at_least(minimum):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail=f"{action} requires rank {minimum} or above; you are logged in as {officer.rank}")
