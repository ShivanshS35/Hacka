"""Station signing key: real Ed25519 signatures (PyNaCl / libsodium) over evidence-chain entries.

What a signature here proves: the entry was produced by a server holding this private key and has not been
changed since. It does NOT prove which officer collected the content, or when (there is no trusted timestamp),
and anyone who controls the server can also use the key. Publish the public key (GET /api/pubkey) and record
it somewhere off the server so later verification does not depend on trusting the server's own copy.

Key sources, in order:
  1. PRAHARI_SIGNING_KEY env var: base64 of the 32-byte Ed25519 seed (for hosts with no persistent disk).
  2. Key file at PRAHARI_SIGNING_KEY_PATH (default backend/keys/station_ed25519.key), created on first start.
"""
import base64
import hashlib
import json
import os
import stat
import sys
from pathlib import Path
from typing import Any, Dict, Optional

from nacl.exceptions import BadSignatureError
from nacl.signing import SigningKey, VerifyKey

ALGORITHM = "Ed25519"
DEFAULT_KEY_PATH = Path(__file__).with_name("keys") / "station_ed25519.key"


class SigningKeyError(RuntimeError):
    pass


# Serialise a payload the same way every time, so the signed bytes can be rebuilt exactly when verifying.
def canonical_bytes(payload: Dict[str, Any]) -> bytes:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


# Short, stable identifier for a public key: first 16 hex characters of its SHA-256.
def key_id_for(public_key: bytes) -> str:
    return hashlib.sha256(public_key).hexdigest()[:16]


# Refuse to use a key file that other users on this machine could read.
def _check_permissions(path: Path) -> None:
    if os.name != "posix":
        return
    mode = stat.S_IMODE(path.stat().st_mode)
    if mode & 0o077:
        raise SigningKeyError(
            f"Signing key {path} has permissions {oct(mode)}; it must be readable only by its owner. "
            f"Fix with: chmod 600 {path}")


# Create a new key file with owner-only permissions from the first byte (no window where it is world-readable).
def _create_key_file(path: Path) -> SigningKey:
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    key = SigningKey.generate()
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w") as fh:
        fh.write(base64.b64encode(bytes(key)).decode("ascii") + "\n")
    print(
        "\n" + "=" * 78 +
        f"\nPRAHARI: generated a NEW station signing key at {path}\n"
        f"Key ID: {key_id_for(bytes(key.verify_key))}\n"
        "Back this file up offline now. If it is lost, records signed with it can still be verified with the\n"
        "public key, but no new records can be signed with the same identity. Never commit it to git.\n" +
        "=" * 78 + "\n", file=sys.stderr, flush=True)
    return key


# Turn base64 text into an Ed25519 key, with a clear error if it is not a 32-byte seed.
def _key_from_b64(text: str, where: str) -> SigningKey:
    try:
        seed = base64.b64decode(text.strip(), validate=True)
    except ValueError as exc:
        raise SigningKeyError(f"{where} is not valid base64") from exc
    if len(seed) != 32:
        raise SigningKeyError(f"{where} must decode to a 32-byte Ed25519 seed, got {len(seed)} bytes")
    return SigningKey(seed)


# Load the station key from the environment or the key file, creating the file on first start.
def load_or_create_key(path: Optional[Path] = None) -> SigningKey:
    env_key = os.environ.get("PRAHARI_SIGNING_KEY", "").strip()
    if env_key:
        return _key_from_b64(env_key, "PRAHARI_SIGNING_KEY")
    path = Path(path or os.environ.get("PRAHARI_SIGNING_KEY_PATH") or DEFAULT_KEY_PATH)
    if not path.exists():
        return _create_key_file(path)
    _check_permissions(path)
    return _key_from_b64(path.read_text(encoding="ascii"), str(path))


class StationSigner:
    """Holds the station key and signs / verifies canonical JSON payloads."""

    # Load (or create) the key once when the server starts.
    def __init__(self, signing_key: Optional[SigningKey] = None):
        self._key = signing_key or load_or_create_key()
        self.public_key = bytes(self._key.verify_key)
        self.key_id = key_id_for(self.public_key)

    # Sign the canonical form of a payload; returns the 64-byte signature as base64.
    def sign(self, payload: Dict[str, Any]) -> str:
        return base64.b64encode(self._key.sign(canonical_bytes(payload)).signature).decode("ascii")

    # Public half of the key, safe to publish.
    def public_info(self) -> Dict[str, str]:
        return {"algorithm": ALGORITHM, "keyId": self.key_id,
                "publicKey": base64.b64encode(self.public_key).decode("ascii"), "encoding": "base64 raw 32-byte key"}


# Check a base64 signature against a payload with a base64 public key; never raises.
def verify(payload: Dict[str, Any], signature_b64: str, public_key_b64: str) -> bool:
    try:
        VerifyKey(base64.b64decode(public_key_b64)).verify(canonical_bytes(payload), base64.b64decode(signature_b64))
        return True
    except (BadSignatureError, ValueError, TypeError):
        return False
