"""Spotify tool: search + now-playing via the Web API.

Token resolution order:
  1. User-connected OAuth token (per-user, from the Connect flow).
  2. Manually-pasted token (env SPOTIFY_API_KEY or UI Tool Connection).
  3. Auto-fetched via Client Credentials (env SPOTIFY_CLIENT_ID/SECRET).

IMPORTANT: Spotify requires an OAuth 2.0 Bearer access token, NOT just a
Client ID/Secret. Get a token from:
  https://developer.spotify.com/console/get-search-item/  (Get Token button)
or via the Client Credentials flow:
  curl -X POST "https://accounts.spotify.com/api/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=client_credentials&client_id=ID&client_secret=SECRET"
"""
from __future__ import annotations

import httpx

from ._keys import get_tool_key, get_tool_extra
from .base import Tool

_API = "https://api.spotify.com/v1"
_TOKEN_URL = "https://accounts.spotify.com/api/token"

# Cache a client-credentials token (short-lived) so we don't hit the token
# endpoint on every search. Refreshed on 401.
_token_cache = {"token": None, "expires": 0.0}


class SpotifyAuthError(Exception):
    """Raised for 401/403 so run() can return an actionable message."""

    def __init__(self, status: int, message: str):
        self.status = status
        self.message = message
        super().__init__(message)


def _client_credentials_token() -> str | None:
    """Fetch a fresh app access token via Client Credentials flow, using the
    SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET env vars. Returns None if not
    configured."""
    import os
    import time

    cid = (os.getenv("SPOTIFY_CLIENT_ID") or "").strip()
    secret = (os.getenv("SPOTIFY_CLIENT_SECRET") or "").strip()
    if not (cid and secret):
        return None
    if _token_cache["token"] and time.time() < _token_cache["expires"]:
        return _token_cache["token"]
    try:
        resp = httpx.post(
            _TOKEN_URL,
            data={"grant_type": "client_credentials"},
            auth=(cid, secret),
            timeout=15,
        )
        resp.raise_for_status()
        body = resp.json()
        tok = body.get("access_token")
        if not tok:
            return None
        _token_cache["token"] = tok
        _token_cache["expires"] = time.time() + int(body.get("expires_in", 3600)) - 30
        return tok
    except httpx.HTTPError:
        return None


def _resolve_token() -> str:
    # 1) User-connected OAuth token (per-user, survives the Connect flow).
    from core.oauth_store import get_access_token

    tok = get_access_token("spotify")
    if tok:
        return tok
    # 2) Manually-pasted token (env SPOTIFY_API_KEY or UI Tool Connection).
    tok = (get_tool_key("spotify") or "").strip()
    if tok:
        return tok
    # 3) Auto-fetched via Client Credentials (env CLIENT_ID/SECRET).
    return _client_credentials_token() or ""


def _search_with(token: str, query: str, kind: str, limit: int) -> str:
    """Perform a Spotify search. Raises SpotifyAuthError on 401/403."""
    resp = httpx.get(
        f"{_API}/search",
        params={"q": query, "type": kind, "limit": limit},
        headers={"Authorization": f"Bearer {token}"},
        timeout=20,
    )
    if resp.status_code == 401:
        raise SpotifyAuthError(
            401,
            "Spotify rejected the token (HTTP 401) — it's expired or invalid. "
            "Get a fresh access token from "
            "https://developer.spotify.com/console/get-search-item/ (Get Token) "
            "and paste it into Settings -> Tool Connections (name: 'spotify'). "
            "Tokens are short-lived.",
        )
    if resp.status_code == 403:
        raise SpotifyAuthError(
            403,
            "Spotify returned HTTP 403 — your Spotify app is in Development "
            "Mode (the default for new Spotify apps) and this account isn't "
            "authorized for the Web API. Fix in the Spotify Developer Dashboard "
            "(https://developer.spotify.com/dashboard): open your app -> Settings "
            "-> Users and Access -> add your Spotify account (email/username), "
            "then DISCONNECT and reconnect Spotify in Nira. (Search needs no "
            "special scope; the gate is account authorization, not scopes.)",
        )
    resp.raise_for_status()
    data = resp.json()
    items = (data.get(f"{kind}s", {}) or {}).get("items", [])
    if not items:
        return f"No Spotify {kind}s found for '{query}'."
    lines = []
    for it in items:
        name = it.get("name", "")
        if kind == "artist":
            lines.append(f"- {name}")
        else:
            artists = ", ".join(a.get("name", "") for a in it.get("artists", []))
            url = it.get("external_urls", {}).get("spotify", "")
            lines.append(f"- {name} — {artists}\n {url}")
    return f"Spotify {kind}s for '{query}':\n" + "\n".join(lines[:limit])


class SpotifyTool(Tool):
    name = "spotify"
    description = (
        "Search Spotify for tracks, artists, or playlists, and get the user's "
        "currently playing track. Requires a Spotify token stored as the "
        "'spotify' tool key. Use when the user mentions music, a song, or artist."
    )
    parameters = {
        "query": {"type": "string", "description": "Search term, e.g. 'lofi beats'."},
        "kind": {"type": "string", "description": "'track' (default), 'artist', or 'playlist'."},
        "limit": {"type": "integer", "description": "Number of results (default 5)."},
    }
    required = ["query"]

    def run(self, query: str, kind: str = "track", limit: int = 5) -> str:
        token = _resolve_token()
        if not token:
            return (
                "Spotify needs an access token. Add one in Settings -> Tool "
                "Connections (name: 'spotify'). Get a token from "
                "https://developer.spotify.com/console/get-search-item/ (Get Token) "
                "or via the Client Credentials flow. Tokens expire — refresh it "
                "if requests start failing."
            )
        limit = max(1, min(int(limit or 5), 20))
        kind = (kind or "track").lower()
        try:
            return _search_with(token, query, kind, limit)
        except SpotifyAuthError as e:
            # On 401 (expired) or 403 (connected account not allowlisted for
            # the app in Dev Mode), fall back to the app-level Client
            # Credentials token — it works for non-user-scoped endpoints like
            # search/artist without needing the user account to be authorized.
            cc = _client_credentials_token() if e.status in (401, 403) and token != (_token_cache.get("token") or "") else None
            if cc and cc != token:
                try:
                    return _search_with(cc, query, kind, limit)
                except SpotifyAuthError:
                    pass  # fall through to the message below
            return e.message
        except httpx.HTTPError as exc:
            return f"Spotify request failed: {exc}"


spotify_tool = SpotifyTool()
