"""Google account tool: show the connected Google user's email/profile.

Backs the /google slash command. Uses the connected Google OAuth token
(Settings -> Tool Connections -> Google) to read userinfo. No API key needed.
"""
from __future__ import annotations

import httpx

from core.oauth_store import get_access_token
from .base import Tool

_USERINFO = "https://www.googleapis.com/oauth2/v2/userinfo"


class GoogleAccountTool(Tool):
    name = "google"
    description = (
        "Show the connected Google account email and profile (name, picture). "
        "Requires Google to be connected in Settings -> Tool Connections. Use "
        "when the user asks 'what is my Google email' or wants account info."
    )
    parameters: dict = {}
    required: list[str] = []

    def run(self) -> str:
        tok = get_access_token("google")
        if not tok:
            return (
                "No connected Google account. Go to Settings -> Tool Connections "
                "and Connect Google, then try /google."
            )
        try:
            resp = httpx.get(_USERINFO, headers={"Authorization": f"Bearer {tok}"}, timeout=20)
            if resp.status_code == 403:
                return (
                    "Google returned 403 — the token lacks the userinfo scope or "
                    "access was revoked. Re-connect Google in Settings (disconnect, "
                    "then Connect) and approve email/profile access."
                )
            resp.raise_for_status()
            d = resp.json()
            email = d.get("email", "")
            verified = d.get("verified_email")
            name = d.get("name", "")
            pic = d.get("picture", "")
            out = f"Connected Google account:\n  Email: {email}"
            if verified is not None:
                out += f"\n  Verified: {verified}"
            if name:
                out += f"\n  Name: {name}"
            if pic:
                out += f"\n  Picture: {pic}"
            return out
        except httpx.HTTPError as exc:
            return f"Google request failed: {exc}"


google_tool = GoogleAccountTool()
