"""Spotify tool: search + now-playing via the Web API.

Token is stored in config/tool_keys.json under name 'spotify' (Settings ->
Tool Connections). A full OAuth flow is out of scope; the stored token is
used for search and playback-control calls.

IMPORTANT: Spotify requires an OAuth 2.0 Bearer token (access token), NOT just
a Client ID or Client Secret. To get a token:
1. Create a Spotify Developer app at https://developer.spotify.com/dashboard/
2. Use the Client Credentials flow or Authorization Code flow to obtain an access token
3. Store the access token (not the Client ID) in Settings -> Tool Connections as 'spotify'

For testing, you can get a temporary token from:
- https://developer.spotify.com/console/get-search-item/ (use the "Get Token" button)
- Or use: curl -X POST "https://accounts.spotify.com/api/token" -H "Content-Type: application/x-www-form-urlencoded" -d "grant_type=client_credentials&client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET"
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


def _client_credentials_token() -> str | None:
    """Fetch a fresh app access token via Client Credentials flow, using the
    SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET env vars (the durable way to run
    Spotify on an ephemeral host like Render). Returns None if not configured."""
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
            resp = httpx.get(
                f"{_API}/search",
                params={"q": query, "type": kind, "limit": limit},
                headers={"Authorization": f"Bearer {token}"},
                timeout=20,
            )
            if resp.status_code == 401:
                return (
                    "Spotify rejected the token (HTTP 401) — it's expired or "
                    "invalid. Get a fresh access token from "
                    "https://developer.spotify.com/console/get-search-item/ (Get "
                    "Token) and paste it into Settings -> Tool Connections "
                    "(name: 'spotify'). Tokens are short-lived."
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
        except httpx.HTTPError as exc:
            return f"Spotify request failed: {exc}"


spotify_tool = SpotifyTool()
