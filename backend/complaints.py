"""Cybercrime complaint cross-check (the "Suspect Repository" CSVs).

Complaint exports contain real people's data, so this module keeps as little as possible:
- stored: acknowledgement number, district, police station, category, sub-category, date, and the suspect
  identifiers (profile URL / handle, UPI, phone, bank account, wallet, email as given);
- NOT stored: the complaint narrative (identifiers are extracted from it, then the text is discarded) and names;
- topic flags only (does the complaint mention Telegram / Instagram / WhatsApp / a job or task scam).
Nothing here is committed to git or bundled with the site: an analyst uploads the CSVs at run time.
"""
import csv
import datetime
import io
import re
import sqlite3
from collections import Counter
from contextlib import closing
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

from extractor import extract_entities

REQUIRED = {"acknowledgement no", "id number"}
_DISTRICT_ALIASES = {"ganga nagar": "sri-ganganagar", "sri ganga nagar": "sri-ganganagar", "hanumangargh": "hanumangarh"}
_PROFILE_RE = re.compile(
    r"(?:https?://)?(?:www\.|m\.|mobile\.)?(instagram\.com|facebook\.com|fb\.com|t\.me|telegram\.me|x\.com|twitter\.com|"
    r"youtube\.com|snapchat\.com|linkedin\.com|sharechat\.com)/(?:add/|in/|@|s/|profile\.php\?id=)?([A-Za-z0-9_.\-]{2,64})",
    re.IGNORECASE)
_TOPICS = {
    "telegram": re.compile(r"telegram|टेलीग्राम|t\.me/", re.I),
    "instagram": re.compile(r"instagram|इंस्टाग्राम", re.I),
    "whatsapp": re.compile(r"whats\s?app|व्हाट्सएप", re.I),
    "job_or_task": re.compile(r"\b(job|task|part[- ]time|work from home)\b|नौकरी|टास्क", re.I),
    "upi": re.compile(r"\bupi\b|यूपीआई", re.I),
}
MAX_ROWS = 20000
_MASKED_EMAIL = re.compile(r"X{3,}|\*{2,}")


def _connect(db: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(db, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn


def init_tables(db: Path) -> None:
    with closing(_connect(db)) as c:
        c.execute("""CREATE TABLE IF NOT EXISTS complaints (
            ack_no TEXT PRIMARY KEY, district_raw TEXT, district_id TEXT, police_station TEXT, category TEXT,
            sub_category TEXT, reported_on TEXT, topics TEXT, loaded_at TEXT)""")
        c.execute("""CREATE TABLE IF NOT EXISTS complaint_ids (
            ack_no TEXT, id_type TEXT, id_key TEXT, platform TEXT, UNIQUE(ack_no, id_key))""")
        c.execute("CREATE INDEX IF NOT EXISTS idx_complaint_key ON complaint_ids(id_key)")
        c.commit()


def _district_id(raw: str) -> str:
    low = (raw or "").strip().lower()
    if low in _DISTRICT_ALIASES:
        return _DISTRICT_ALIASES[low]
    did = extract_entities(raw.title())["district_id"] if raw else "unknown"
    return did


def handle_key(value: str) -> str:
    """Platform-agnostic handle key: '@Seller_Raj', 't.me/seller_raj' and 'instagram.com/seller_raj' all -> 'handle:seller_raj'."""
    return "handle:" + value.strip().lstrip("@").rstrip("/").lower()


def keys_for_entities(ents: Dict[str, Any]) -> List[Tuple[str, str]]:
    """(type, key) pairs for an extractor result (either the extractor's names or the stored record's names)."""
    out = []
    for p in ents.get("phones", []):
        out.append(("phone", f"phone:{p}"))
    for u in ents.get("upis", []):
        out.append(("upi", f"upi:{u.lower()}"))
    for h in ents.get("handles", []):
        out.append(("handle", handle_key(h)))
    for w in ents.get("wallets", []):
        out.append(("wallet", f"wallet:{w.lower() if w.lower().startswith('0x') else w}"))
    for b in ents.get("bank_accounts", ents.get("bankAccounts", [])):
        out.append(("bank_account", f"bank:{b}"))
    return out


def _row_keys(row: Dict[str, str]) -> List[Tuple[str, str, str]]:
    """(type, key, platform) for one complaint row: the reported ID plus identifiers inside the narrative."""
    keys: List[Tuple[str, str, str]] = []
    idv = (row.get("id number") or "").strip()
    idname = (row.get("id name") or "").strip().lower()
    m = _PROFILE_RE.search(idv)
    if m:
        site = m.group(1).lower().replace("telegram.me", "t.me").replace("fb.com", "facebook.com").replace("twitter.com", "x.com")
        user = m.group(2).rstrip(".").lower()
        if user not in {"share", "p", "reel", "watch", "groups", "stories", "photo", "permalink.php"}:
            keys.append(("profile", handle_key(user), site))
    elif idname == "email" and "@" in idv:
        # Masked exports hide most of the address ("abXXXX@gmail.com"); different people collapse to the same mask,
        # so masked emails are not usable for matching and are left out.
        if not _MASKED_EMAIL.search(idv):
            keys.append(("email", f"email:{idv.lower()}", "email"))
    elif idv:
        for t, k in keys_for_entities(extract_entities(idv)):
            keys.append((t, k, ""))
    narrative = row.get("crime aditional information") or row.get("crime additional information") or ""
    if narrative:
        ents = extract_entities(narrative)
        for t, k in keys_for_entities(ents):
            keys.append((t, k, ""))
        for m in _PROFILE_RE.finditer(narrative):
            user = m.group(2).rstrip(".").lower()
            if user not in {"share", "p", "reel", "watch", "groups", "stories"}:
                keys.append(("profile", handle_key(user), m.group(1).lower()))
    return keys


def load_csv(db: Path, raw: str) -> Dict[str, Any]:
    reader = csv.DictReader(io.StringIO(raw))
    if not reader.fieldnames:
        raise ValueError("CSV header row is required")
    header = {h.strip().lower() for h in reader.fieldnames if h}
    if not REQUIRED <= header:
        raise ValueError("Not a complaint export: needs 'Acknowledgement No' and 'Id Number' columns")
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    rows = n_ids = 0
    with closing(_connect(db)) as c:
        for item in reader:
            rows += 1
            if rows > MAX_ROWS:
                raise ValueError(f"More than {MAX_ROWS} rows")
            row = {str(k).strip().lower(): (v or "").strip() for k, v in item.items() if k}
            ack = row.get("acknowledgement no", "")
            if not ack:
                continue
            narrative = row.get("crime aditional information") or row.get("crime additional information") or ""
            topics = ",".join(t for t, rx in _TOPICS.items() if rx.search(narrative))
            c.execute(
                "INSERT INTO complaints (ack_no, district_raw, district_id, police_station, category, sub_category, reported_on, topics, loaded_at) "
                "VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(ack_no) DO UPDATE SET topics = CASE WHEN excluded.topics != '' THEN excluded.topics ELSE complaints.topics END",
                (ack, row.get("district", ""), _district_id(row.get("district", "")), row.get("police station", ""),
                 row.get("category", ""), row.get("sub category", ""), row.get("date", ""), topics, now))
            for t, k, plat in _row_keys(row):
                cur = c.execute("INSERT OR IGNORE INTO complaint_ids (ack_no, id_type, id_key, platform) VALUES (?,?,?,?)",
                                (ack, t, k, plat))
                n_ids += cur.rowcount
        c.commit()
    return {"rows": rows, "identifiersAdded": n_ids}


def clear(db: Path) -> None:
    with closing(_connect(db)) as c:
        c.execute("DELETE FROM complaint_ids")
        c.execute("DELETE FROM complaints")
        c.commit()


def lookup(db: Path, keys: Iterable[str]) -> Dict[str, List[Dict[str, Any]]]:
    keys = list(dict.fromkeys(keys))
    if not keys:
        return {}
    out: Dict[str, List[Dict[str, Any]]] = {}
    with closing(_connect(db)) as c:
        for i in range(0, len(keys), 500):
            chunk = keys[i:i + 500]
            q = ("SELECT ci.id_key, ci.platform, c.ack_no, c.district_id, c.police_station, c.category, c.sub_category, c.reported_on "
                 f"FROM complaint_ids ci JOIN complaints c ON c.ack_no = ci.ack_no WHERE ci.id_key IN ({','.join('?' * len(chunk))})")
            for r in c.execute(q, chunk).fetchall():
                out.setdefault(r["id_key"], []).append({
                    "ackNo": r["ack_no"], "districtId": r["district_id"], "policeStation": r["police_station"],
                    "category": r["category"], "subCategory": r["sub_category"], "reportedOn": r["reported_on"],
                    "platform": r["platform"]})
    return out


def count(db: Path) -> int:
    with closing(_connect(db)) as c:
        return c.execute("SELECT COUNT(*) FROM complaints").fetchone()[0]


def _mask(key: str) -> str:
    kind, _, v = key.partition(":")
    if len(v) <= 4:
        return f"{kind}:{v[0]}***"
    return f"{kind}:{v[:3]}***{v[-2:]}"


def summary(db: Path) -> Dict[str, Any]:
    with closing(_connect(db)) as c:
        rows = c.execute("SELECT * FROM complaints").fetchall()
        ids = c.execute("SELECT id_key, id_type, COUNT(DISTINCT ack_no) AS n FROM complaint_ids GROUP BY id_key").fetchall()
        loaded = c.execute("SELECT MAX(loaded_at) FROM complaints").fetchone()[0]
    topics = Counter(t for r in rows for t in (r["topics"] or "").split(",") if t)
    repeat = sorted((r for r in ids if r["n"] > 1), key=lambda r: -r["n"])
    return {
        "complaints": len(rows),
        "loadedAt": loaded,
        "identifiers": len(ids),
        "identifierTypes": dict(Counter(r["id_type"] for r in ids)),
        "byDistrict": dict(Counter(r["district_id"] for r in rows).most_common()),
        "byCategory": dict(Counter(r["category"] or "Unspecified" for r in rows).most_common(8)),
        "bySubCategory": dict(Counter(r["sub_category"] or "Unspecified" for r in rows).most_common(8)),
        "topics": dict(topics),
        # Identifiers reported in more than one complaint: likely repeat offenders. Values are masked here.
        "repeatIdentifiers": [{"key": _mask(r["id_key"]), "type": r["id_type"], "complaints": r["n"]} for r in repeat[:15]],
        "repeatIdentifierCount": len(repeat),
        "note": "Stored: acknowledgement no, district, police station, category, date and suspect identifiers. "
                "Not stored: complaint text and names.",
    }
