"""Gmail tool: list recent emails via the connected Google OAuth token.

Token comes from the Google "Connect" flow (Settings -> Tool Connections ->
Google), which requests the Gmail + userinfo scopes. No API key needed.
"""
from __future__ import annotations

import httpx

from core.oauth_store import get_access_token
from .base import Tool

_GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me"


def _headers() -> dict | None:
    tok = get_access_token("google")
    if not tok:
        return None
    return {"Authorization": f"Bearer {tok}"}


class GmailTool(Tool):
    name = "gmail"
    description = (
        "List the user's recent Gmail messages (subject, from, date, snippet). "
        "Requires the Google account to be connected in Settings -> Tool "
        "Connections. Use when the user asks to check, read, or summarize email."
    )
    parameters = {
        "limit": {"type": "integer", "description": "Number of emails to show (default 5)."},
        "query": {
            "type": "string",
            "description": "Optional Gmail search query, e.g. 'is:unread' or 'from:boss'.",
        },
    }
    required: list[str] = []

    def run(self, limit: int = 5, query: str = "") -> str:
        hdrs = _headers()
        if not hdrs:
            return (
                "Gmail needs a connected Google account. Go to Settings -> Tool "
                "Connections and Connect Google (grant Gmail access). Then try /email."
            )
        limit = max(1, min(int(limit or 5), 10))
        params = {"maxResults": limit}
        if query:
            params["q"] = query
        try:
            ls = httpx.get(f"{_GMAIL}/messages", params=params, headers=hdrs, timeout=20)
            if ls.status_code == 403:
                return (
                    "Gmail returned 403 — the connected Google account didn't grant "
                    "the Gmail scope, or access was revoked. Re-connect Google in "
                    "Settings (disconnect, then Connect) and approve Gmail access."
                )
            ls.raise_for_status()
            ids = [m["id"] for m in ls.json().get("messages", [])]
            if not ids:
                return "No Gmail messages found" + (f" for '{query}'." if query else ".")
            lines = []
            for mid in ids:
                msg = httpx.get(
                    f"{_GMAIL}/messages/{mid}",
                    params={"format": "metadata", "metadataHeaders": ["Subject", "From", "Date"]},
                    headers=hdrs,
                    timeout=20,
                )
                if msg.status_code != 200:
                    continue
                m = msg.json()
                head = {h["name"]: h["value"] for h in m.get("payload", {}).get("headers", [])}
                subj = head.get("Subject", "(no subject)")
                frm = head.get("From", "")
                date = head.get("Date", "")
                snip = (m.get("snippet") or "").replace("\n", " ")
                lines.append(f"- {subj}\n  From: {frm}\n  {date}\n  {snip}")
            return "Recent Gmail:\n" + "\n".join(lines)
        except httpx.HTTPError as exc:
            return f"Gmail request failed: {exc}"


gmail_tool = GmailTool()
