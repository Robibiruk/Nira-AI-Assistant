"""Generic OAuth 2.0 Authorization Code flow for NIRA integrations.

Implements GET /auth/{service}/login, /auth/{service}/callback,
POST /auth/{service}/disconnect, GET /auth/status. Tokens are stored per
service via core.oauth_store (encrypted in MongoDB).

Security:
  * ``state`` is a random value set in an httpOnly cookie on login and
    validated on callback (CSRF protection).
  * Client secrets are read from backend env vars only. Never sent to the UI.
  * Access/refresh tokens are stored encrypted at rest.
  * Scopes are kept minimal per service.
"""
from __future__ import annotations

import os
import base64
import hashlib
import secrets
import time
import urllib.parse

import httpx
from fastapi import APIRouter, HTTPException, Query, Request, Response
from fastapi.responses import RedirectResponse

from core import oauth_store as store

router = APIRouter(prefix="/auth", tags=["oauth"])

# Where to send the user back after connecting (the Integrations UI).
_RETURN_TO = os.getenv("OAUTH_RETURN_TO", "/?tab=settings").strip() or "/?tab=settings"

STATE_COOKIE = "oauth_state"
VERIFIER_COOKIE = "oauth_verifier"  # PKCE code_verifier (X only)
STATE_MAX_AGE = 600  # 10 minutes


# ---------------------------------------------------------------------------
# Service registry. Add new OAuth services here (Google, Reddit, X, …) using
# the same shape. Client creds MUST come from env vars, not code.
# ---------------------------------------------------------------------------
def _env(name: str, default: str = "") -> str:
    return (os.getenv(name) or "").strip() or default


SERVICES = {
    "github": {
        "auth_url": "https://github.com/login/oauth/authorize",
        "token_url": "https://github.com/login/oauth/access_token",
        "scopes": ["read:user", "repo"],
        "client_id_env": "GITHUB_CLIENT_ID",
        "client_secret_env": "GITHUB_CLIENT_SECRET",
        "refreshable": False,  # GitHub access tokens live until revoked
    },
    "spotify": {
        "auth_url": "https://accounts.spotify.com/authorize",
        "token_url": "https://accounts.spotify.com/api/token",
        "scopes": ["user-read-playback-state", "user-read-currently-playing"],
        "client_id_env": "SPOTIFY_CLIENT_ID",
        "client_secret_env": "SPOTIFY_CLIENT_SECRET",
        "refreshable": True,
    },
    "google": {
        "auth_url": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url": "https://oauth2.googleapis.com/token",
        "scopes": [
            "openid",
            "https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/userinfo.profile",
        ],
        "client_id_env": "GOOGLE_CLIENT_ID",
        "client_secret_env": "GOOGLE_CLIENT_SECRET",
        "refreshable": True,  # offline access -> refresh token
    },
    "reddit": {
        "auth_url": "https://www.reddit.com/api/v1/authorize",
        "token_url": "https://www.reddit.com/api/v1/access_token",
        "scopes": ["identity"],
        "client_id_env": "REDDIT_CLIENT_ID",
        "client_secret_env": "REDDIT_CLIENT_SECRET",
        "refreshable": True,
        "user_agent": "nira/0.1 by u/your_reddit_username",  # Reddit requires a UA
    },
    "x": {
        "auth_url": "https://twitter.com/i/oauth2/authorize",
        "token_url": "https://api.twitter.com/2/oauth2/token",
        "scopes": ["tweet.read", "users.read", "offline.access"],
        "client_id_env": "X_CLIENT_ID",
        "client_secret_env": "X_CLIENT_SECRET",
        "refreshable": True,
        "pkce": True,  # X mandates PKCE for the auth-code flow
    },
}


def _redirect_uri(service: str) -> str:
    base = (os.getenv("OAUTH_REDIRECT_BASE") or "").rstrip("/")
    if not base:
        # Fall back to same-origin as the backend if not configured.
        base = os.getenv("RENDER_EXTERNAL_URL", "").rstrip("/")
    if not base:
        raise HTTPException(
            status_code=500,
            detail=f"OAUTH_REDIRECT_BASE is not set; cannot build callback URL for '{service}'.",
        )
    return f"{base}/auth/{service}/callback"


def _service_cfg(service: str) -> dict:
    cfg = SERVICES.get(service)
    if cfg is None:
        raise HTTPException(status_code=404, detail=f"Unknown OAuth service: {service}")
    return cfg


@router.get("/status")
def oauth_status() -> dict:
    """Status of every known service for the Integrations UI."""
    return {"connected": store.list_status(list(SERVICES.keys()))}


@router.get("/{service}/login")
def oauth_login(service: str, response: Response, req: Request) -> RedirectResponse:
    cfg = _service_cfg(service)
    cid = _env(cfg["client_id_env"])
    if not cid:
        raise HTTPException(
            status_code=400,
            detail=f"{cfg['client_id_env']} is not set on the server; cannot start {service} OAuth.",
        )
    state = secrets.token_urlsafe(24)
    response.set_cookie(
        STATE_COOKIE,
        state,
        max_age=STATE_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=not _env("OAUTH_INSECURE_COOKIE"),
    )
    params = {
        "client_id": cid,
        "redirect_uri": _redirect_uri(service),
        "scope": " ".join(cfg["scopes"]),
        "state": state,
        "response_type": "code",
    }
    # PKCE is required by X (Twitter) and harmless elsewhere if omitted.
    verifier = None
    if cfg.get("pkce"):
        verifier = base64.urlsafe_b64encode(secrets.token_bytes(32)).rstrip(b"=").decode()
        chal = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
        params["code_challenge"] = chal
        params["code_challenge_method"] = "S256"
        response.set_cookie(
            VERIFIER_COOKIE,
            verifier,
            max_age=STATE_MAX_AGE,
            httponly=True,
            samesite="lax",
            secure=not _env("OAUTH_INSECURE_COOKIE"),
        )
    if cfg.get("refreshable"):
        params["access_type"] = "offline"
        params["prompt"] = "consent"
    url = f"{cfg['auth_url']}?{urllib.parse.urlencode(params)}"
    return RedirectResponse(url)


@router.get("/{service}/callback")
def oauth_callback(
    service: str,
    code: str = Query(...),
    state: str = Query(...),
    req: Request = None,
    response: Response = None,
) -> RedirectResponse:
    cfg = _service_cfg(service)
    expected = req.cookies.get(STATE_COOKIE) if req else None
    if not expected or not secrets.compare_digest(expected, state):
        raise HTTPException(status_code=400, detail="Invalid OAuth state (possible CSRF).")
    cid = _env(cfg["client_id_env"])
    secret = _env(cfg["client_secret_env"])
    if not (cid and secret):
        raise HTTPException(status_code=500, detail=f"{cfg['client_id_env']}/{cfg['client_secret_env']} not set on server.")
    token_data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": _redirect_uri(service),
        "client_id": cid,
        "client_secret": secret,
    }
    if cfg.get("pkce"):
        verifier = req.cookies.get(VERIFIER_COOKIE) if req else None
        if verifier:
            token_data["code_verifier"] = verifier
    try:
        headers = {"Accept": "application/json"}
        if cfg.get("user_agent"):
            headers["User-Agent"] = cfg["user_agent"]
        resp = httpx.post(
            cfg["token_url"],
            data=token_data,
            headers=headers,
            timeout=15,
        )
        resp.raise_for_status()
        body = resp.json()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Token exchange failed: {exc}")
    access = body.get("access_token")
    if not access:
        raise HTTPException(status_code=502, detail="Provider did not return an access token.")
    refresh = body.get("refresh_token")
    expires_in = int(body.get("expires_in", 0) or 0)
    expires_at = (time.time() + expires_in - 60) if expires_in else None
    try:
        store.save_token(
            service,
            access_token=access,
            refresh_token=refresh,
            expires_at=expires_at,
            scopes=cfg["scopes"],
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    # Clear state cookie; return to the Integrations UI with a success flag.
    redirect = RedirectResponse(f"{_RETURN_TO}&connected={service}" if "?" in _RETURN_TO else f"{_RETURN_TO}?connected={service}")
    response.delete_cookie(STATE_COOKIE)
    response.delete_cookie(VERIFIER_COOKIE)
    return redirect


@router.post("/{service}/disconnect")
def oauth_disconnect(service: str) -> dict:
    _service_cfg(service)
    store.delete_token(service)
    return {"ok": True, "service": service, "connected": False}
