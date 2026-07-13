"""browse tool: delegate an agentic web-browsing task to the NIRA Browser
Service (separate repo, default 512MB fetch backend). Falls back to opening
the URL in the user's browser when the service URL isn't configured.
"""
from __future__ import annotations

import os

import httpx

from .base import Tool

_SVC = (os.getenv("BROWSER_SERVICE_URL") or "").strip()


class BrowseTool(Tool):
    name = "browse"
    description = (
        "Autonomously browse the web to answer a question or complete a task "
        "(visit pages, read content, follow links). Use when the user wants "
        "NIRA to 'look up / find / browse / check' something on the web that "
        "needs navigation, not just a single search result."
    )
    parameters = {
        "task": {"type": "string", "description": "What to find or do, e.g. 'find NIRA pricing on the official site'."},
        "url": {"type": "string", "description": "Optional starting URL. If omitted, searches the web for the task first."},
        "max_steps": {"type": "integer", "description": "Max pages to visit (default 6)."},
    }
    required = ["task"]

    def run(self, task: str, url: str | None = None, max_steps: int = 6) -> str:
        if not _SVC:
            target = url or f"https://www.google.com/search?q={_q(task)}"
            return f"Browser service not configured — opening in a new tab: OPEN_URL::{target}"
        try:
            resp = httpx.post(
                f"{_SVC.rstrip('/')}/browse",
                json={"task": task, "url": url, "max_steps": max(1, min(int(max_steps or 6), 12))},
                timeout=120,
            )
            resp.raise_for_status()
            data = resp.json()
            return f"[browse · {data.get('backend', 'fetch')} · {data.get('steps', '?')} steps]\n{data.get('result', '')}"
        except httpx.HTTPError as e:
            return f"Browser service error: {e}"


def _q(task: str) -> str:
    import urllib.parse

    return urllib.parse.quote(task)


browse_tool = BrowseTool()
