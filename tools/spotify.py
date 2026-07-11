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

from ._keys import get_tool_key
from .base import Tool

_API = "https://api.spotify.com/v1"


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
        token = get_tool_key("spotify")
        if not token:
            return "Spotify needs a token. Add one in Settings -> Tool Connections (name: spotify)."
        if not token.startswith("BQ"):
            return ("Spotify needs a valid OAuth 2.0 Bearer token (starts with 'BQ'). "
                    "Get one from https://developer.spotify.com/console/get-search-item/ or via "
                    "Client Credentials flow. Current token appears invalid.")
        limit = max(1, min(int(limit or 5), 20))
        kind = (kind or "track").lower()
        try:
            resp = httpx.get(
                f"{_API}/search",
                params={"q": query, "type": kind, "limit": limit},
                headers={"Authorization": f"Bearer {token}"},
                timeout=20,
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
