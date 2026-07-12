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
    try:
        resp = httpx.post(
            cfg["token_url"],
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": _redirect_uri(service),
                "client_id": cid,
                "client_secret": secret,
            },
            headers={"Accept": "application/json"},
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
    return redirect


@router.post("/{service}/disconnect")
def oauth_disconnect(service: str) -> dict:
    _service_cfg(service)
    store.delete_token(service)
    return {"ok": True, "service": service, "connected": False}
