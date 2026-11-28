"""Shared bearer-token authentication for the API and the WebSocket stream.

One token (PRAHARI_API_TOKEN) for the whole deployment. This keeps the API off the open internet, but it is NOT
per-user authentication: everyone with the token has the same access, and the `analyst` name recorded in the
audit log is still whatever the client sends.
"""
import hmac
import os
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

MIN_TOKEN_LENGTH = 16

# auto_error=False so we can return our own 401 with a WWW-Authenticate header instead of FastAPI's 403.
bearer_scheme = HTTPBearer(auto_error=False, description="PRAHARI_API_TOKEN")


# Read the configured token once at startup and refuse to run with a missing or weak one.
def load_api_token() -> str:
    token = os.environ.get("PRAHARI_API_TOKEN", "").strip()
    if len(token) < MIN_TOKEN_LENGTH:
        raise RuntimeError(
            "PRAHARI_API_TOKEN must be set to a random string of at least "
            f"{MIN_TOKEN_LENGTH} characters, e.g.  export PRAHARI_API_TOKEN=$(python -c 'import secrets; print(secrets.token_urlsafe(32))')")
    return token


API_TOKEN = load_api_token()


# Constant-time comparison, so response timing does not leak how much of a guess was right.
def token_matches(candidate: Optional[str]) -> bool:
    return bool(candidate) and hmac.compare_digest(candidate.encode("utf-8"), API_TOKEN.encode("utf-8"))


# FastAPI dependency: 401 unless the request carries "Authorization: Bearer <PRAHARI_API_TOKEN>".
def require_token(credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)) -> None:
    if credentials is None or credentials.scheme.lower() != "bearer" or not token_matches(credentials.credentials):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing or invalid access token",
                            headers={"WWW-Authenticate": "Bearer"})
