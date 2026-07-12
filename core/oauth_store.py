"""Per-user OAuth token storage for NIRA integrations.

Tokens are stored ENCRYPTED at rest in MongoDB (a dedicated ``nira_oauth``
database, separate from any other app data). There is NO per-user login in
NIRA yet — it's a single local profile — so every token is filed under one
fixed ``user_id`` ("default"). When real accounts arrive, swap that constant
for the authenticated user's id; the rest of the code is unchanged.

Security model:
  * Client secrets live ONLY in backend env vars (GITHUB_CLIENT_SECRET, …).
    They are never sent to the frontend and never stored here.
  * Access/refresh tokens are encrypted with Fernet (key from TOKEN_ENCRYPTION_KEY).
  * Tokens are never logged.
  * If TOKEN_ENCRYPTION_KEY is missing we refuse to store tokens (fail closed)
    rather than write them in plaintext.
"""
from __future__ import annotations

import os
import threading

try:
    from cryptography.fernet import Fernet, InvalidToken
except Exception:  # pragma: no cover - cryptography is a required dep
    Fernet = None  # type: ignore
    InvalidToken = Exception  # type: ignore

try:
    import pymongo
except Exception:  # pragma: no cover
    pymongo = None  # type: ignore

# Single local profile. Replace with the real auth uid once accounts exist.
USER_ID = "default"

_COLLECTION = "user_integrations"

_fernet = None
_fernet_ready = False
_lock = threading.Lock()


def _fernet_key() -> str | None:
    return (os.getenv("TOKEN_ENCRYPTION_KEY") or "").strip() or None


def _get_fernet():
    """Lazily build the Fernet cipher; None if disabled/unavailable."""
    global _fernet, _fernet_ready
    if _fernet_ready:
        return _fernet
    with _lock:
        if _fernet_ready:
            return _fernet
        key = _fernet_key()
        if Fernet and key:
            try:
                _fernet = Fernet(key.encode() if isinstance(key, str) else key)
            except Exception:
                _fernet = None
        else:
            _fernet = None
        _fernet_ready = True
        return _fernet


def _encrypt(plain: str) -> str:
    f = _get_fernet()
    if not f:
        # Fail closed: never persist tokens without encryption.
        raise RuntimeError(
            "TOKEN_ENCRYPTION_KEY is not set — refusing to store OAuth tokens in plaintext."
        )
    return f.encrypt(plain.encode()).decode()


def _decrypt(blob: str) -> str:
    f = _get_fernet()
    if not f:
        raise RuntimeError("TOKEN_ENCRYPTION_KEY is not set — cannot read stored tokens.")
    try:
        return f.decrypt(blob.encode()).decode()
    except InvalidToken:
        raise RuntimeError("Stored token is corrupt or encrypted with a different key.")


# ---- MongoDB client (lazy, single instance) ----
_client = None
_db = None
_store_ready = False


def _collection():
    global _client, _db, _store_ready
    if _store_ready:
        return _db[_COLLECTION] if _db is not None else None
    with _lock:
        if _store_ready:
            return _db[_COLLECTION] if _db is not None else None
        uri = (os.getenv("MONGODB_URI") or "").strip()
        if pymongo and uri:
            try:
                _client = pymongo.MongoClient(uri, serverSelectionTimeoutMS=4000, tls=True, tlsAllowInvalidCertificates=False)
                db_name = (os.getenv("OAUTH_DB_NAME") or "nira_oauth").strip()
                # Support a DB name embedded in the URI (".../dbname?...").
                _db = _client.get_database(db_name)
                _client.admin.command("ping")
                # Ensure the collection + a unique index exist up-front so the
                # DB shows up in Atlas even before the first token is saved.
                col = _db[_COLLECTION]
                col.create_index(
                    [("user_id", 1), ("service", 1)],
                    unique=True,
                    name="user_service_unique",
                )
            except Exception:
                _client = None
                _db = None
        else:
            _client = None
            _db = None
        _store_ready = True
        return _db[_COLLECTION] if _db is not None else None


def _redact(d: dict) -> dict:
    """Return a copy safe for logging (no secrets)."""
    red = dict(d)
    red.pop("access_token", None)
    red.pop("refresh_token", None)
    return red


def save_token(service: str, *, access_token: str, refresh_token: str | None = None,
               expires_at: float | None = None, scopes: list[str] | None = None) -> None:
    """Encrypt and upsert the token for ``service`` under the local user."""
    col = _collection()
    if col is None:
        raise RuntimeError("OAuth storage unavailable (MONGODB_URI not configured).")
    enc_access = _encrypt(access_token)
    enc_refresh = _encrypt(refresh_token) if refresh_token else None
    col.update_one(
        {"user_id": USER_ID, "service": service},
        {"$set": {
            "user_id": USER_ID,
            "service": service,
            "access_token": enc_access,
            "refresh_token": enc_refresh,
            "expires_at": expires_at,
            "scopes": scopes or [],
            "connected_at": __import__("time").time(),
        }},
        upsert=True,
    )


def get_token(service: str) -> dict | None:
    """Return the decrypted token record for ``service``, or None if absent."""
    col = _collection()
    if col is None:
        return None
    doc = col.find_one({"user_id": USER_ID, "service": service})
    if not doc:
        return None
    try:
        access = _decrypt(doc["access_token"])
    except Exception:
        return None
    refresh = None
    if doc.get("refresh_token"):
        try:
            refresh = _decrypt(doc["refresh_token"])
        except Exception:
            refresh = None
    return {
        "access_token": access,
        "refresh_token": refresh,
        "expires_at": doc.get("expires_at"),
        "scopes": doc.get("scopes", []),
    }


def delete_token(service: str) -> None:
    col = _collection()
    if col is None:
        return
    col.delete_one({"user_id": USER_ID, "service": service})


def is_connected(service: str) -> bool:
    return get_token(service) is not None


def list_status(services: list[str]) -> dict:
    return {s: is_connected(s) for s in services}


# Scopes that grant a refresh token, keyed by service name.
_REFRESH_SCOPES = {
    "spotify": ["user-read-playback-state", "user-read-currently-playing"],
    "google": ["openid", "https://www.googleapis.com/auth/userinfo.email",
               "https://www.googleapis.com/auth/userinfo.profile"],
    "reddit": ["identity"],
    "x": ["tweet.read", "users.read", "offline.access"],
}

# Token-refresh endpoints + credential env vars, keyed by service.
# Kept here (not imported from core.oauth) to avoid a circular import.
_REFRESH_CFG = {
    "spotify": {
        "token_url": "https://accounts.spotify.com/api/token",
        "client_id_env": "SPOTIFY_CLIENT_ID",
        "client_secret_env": "SPOTIFY_CLIENT_SECRET",
    },
    "google": {
        "token_url": "https://oauth2.googleapis.com/token",
        "client_id_env": "GOOGLE_CLIENT_ID",
        "client_secret_env": "GOOGLE_CLIENT_SECRET",
    },
    "reddit": {
        "token_url": "https://www.reddit.com/api/v1/access_token",
        "client_id_env": "REDDIT_CLIENT_ID",
        "client_secret_env": "REDDIT_CLIENT_SECRET",
        "user_agent": "nira/0.1 by u/your_reddit_username",
    },
    "x": {
        "token_url": "https://api.twitter.com/2/oauth2/token",
        "client_id_env": "X_CLIENT_ID",
        "client_secret_env": "X_CLIENT_SECRET",
    },
}


def refresh_token(service: str, current_refresh: str) -> dict | None:
    """Exchange a refresh token for a fresh access token. Returns the updated
    record dict (encrypted & persisted) or None if the service isn't refreshable
    or the refresh failed."""
    cfg = _REFRESH_CFG.get(service)
    if not cfg:
        return None
    cid = (os.getenv(cfg["client_id_env"]) or "").strip()
    secret = (os.getenv(cfg["client_secret_env"]) or "").strip()
    if not (cid and secret):
        return None
    headers = {"Accept": "application/json"}
    if cfg.get("user_agent"):
        headers["User-Agent"] = cfg["user_agent"]
    try:
        resp = httpx.post(
            cfg["token_url"],
            data={
                "grant_type": "refresh_token",
                "refresh_token": current_refresh,
                "client_id": cid,
                "client_secret": secret,
            },
            headers=headers,
            timeout=15,
        )
        resp.raise_for_status()
        body = resp.json()
    except httpx.HTTPError:
        return None
    access = body.get("access_token")
    if not access:
        return None
    refresh = body.get("refresh_token") or current_refresh
    expires_in = int(body.get("expires_in", 0) or 0)
    expires_at = (time.time() + expires_in - 60) if expires_in else None
    save_token(
        service,
        access_token=access,
        refresh_token=refresh,
        expires_at=expires_at,
        scopes=body.get("scope", "").split() or _REFRESH_SCOPES.get(service, []),
    )
    return get_token(service)


def get_access_token(service: str) -> str | None:
    """Return a usable (refreshed if needed) access token for ``service``."""
    rec = get_token(service)
    if not rec:
        return None
    expires_at = rec.get("expires_at")
    if expires_at and time.time() >= expires_at and rec.get("refresh_token"):
        refreshed = refresh_token(service, rec["refresh_token"])
        if refreshed:
            return refreshed["access_token"]
    return rec["access_token"]
