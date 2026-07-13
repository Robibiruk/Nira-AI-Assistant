"""web tool: Smart Research — read/summarize/extract/compare web pages via the
NIRA Browser Service (separate repo, default 512MB fetch backend). No Chromium
in the cloud. Interactive automation (login, clicks, forms, checkout) is NOT
supported in the deployed version and falls back to opening the URL in the
user's own browser.
"""
from __future__ import annotations

import os

import httpx

from .base import Tool

_SVC = (os.getenv("BROWSER_SERVICE_URL") or "").strip()


class WebTool(Tool):
    name = "web"
    description = (
        "Web / Smart Research. Read a webpage, summarize an article, extract "
        "text/headings, or research a topic by following links and comparing "
        "sources. Use for 'summarize this page', 'research X', 'extract "
        "headings from this URL', 'compare these products'. Limitations: "
        "interactive browser automation (logging in, clicking, filling forms, "
        "checkout) is available only in the desktop edition — for those tasks "
        "NIRA opens the page in your browser instead."
    )
    parameters = {
        "task": {"type": "string", "description": "What to find or do, e.g. 'summarize this article' or 'research React 19'."},
        "url": {"type": "string", "description": "Optional starting URL. If omitted, searches the web for the task first."},
        "max_steps": {"type": "integer", "description": "Max pages to visit (default 6)."},
    }
    required = ["task"]

    def run(self, task: str, url: str | None = None, max_steps: int = 6) -> str:
        if not _SVC:
            target = url or f"https://www.google.com/search?q={_q(task)}"
            return f"Web research is not configured on this instance — opening in your browser instead: OPEN_URL::{target}"
        try:
            resp = httpx.post(
                f"{_SVC.rstrip('/')}/browse",
                json={"task": task, "url": url, "max_steps": max(1, min(int(max_steps or 6), 12))},
                timeout=120,
            )
            resp.raise_for_status()
            data = resp.json()
            return f"[web · {data.get('backend', 'fetch')} · {data.get('steps', '?')} steps]\n{data.get('result', '')}"
        except httpx.HTTPError as e:
            return f"Web service error: {e}"


def _q(task: str) -> str:
    import urllib.parse

    return urllib.parse.quote(task)


web_tool = WebTool()
