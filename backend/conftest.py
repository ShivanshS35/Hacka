"""Test-wide settings that must exist before `main` is imported: an API token and a throwaway signing key."""
import os
import tempfile
from pathlib import Path

_tmp = tempfile.mkdtemp(prefix="prahari-test-")
os.environ.setdefault("PRAHARI_API_TOKEN", "test-token-0123456789abcdef")
os.environ.setdefault("PRAHARI_SIGNING_KEY_PATH", str(Path(_tmp) / "keys" / "station_ed25519.key"))
os.environ.pop("PRAHARI_SIGNING_KEY", None)
