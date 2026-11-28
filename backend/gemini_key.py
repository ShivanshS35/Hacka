"""Per-request Gemini API key handling.

The key is supplied by the user in the `X-Gemini-Key` header. It is never stored on disk,
never hardcoded, and never written to logs. Every Gemini call must take its key from
`key_from_header(...)`; there is deliberately no default or environment fallback.
"""
import json
import urllib.error
import urllib.request
from typing import Optional

GEMINI_MODELS_URL = "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1"


def key_from_header(value: Optional[str]) -> Optional[str]:
    if not isinstance(value, str):  # handler called directly without a header
        return None
    key = value.strip()
    return key if 10 <= len(key) <= 200 and " " not in key else None


def check_key(key: Optional[str]) -> dict:
    """Validate a key by listing models (free; no generation, no credits used)."""
    if not key:
        return {"valid": False, "reason": "No key provided"}
    req = urllib.request.Request(GEMINI_MODELS_URL, headers={"x-goog-api-key": key})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            json.load(resp)
        return {"valid": True, "reason": "Key accepted by Gemini"}
    except urllib.error.HTTPError as e:
        if e.code in (400, 401, 403):
            return {"valid": False, "reason": "Gemini rejected this key"}
        return {"valid": False, "reason": f"Gemini returned HTTP {e.code}"}
    except Exception:
        return {"valid": False, "reason": "Could not reach Gemini"}
