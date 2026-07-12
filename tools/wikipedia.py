"""Wikipedia tool: free, no API key required (REST summary + search)."""
from __future__ import annotations

import httpx

from .base import Tool

_API = "https://en.wikipedia.org/api/rest_v1/page/summary"


class WikipediaTool(Tool):
    name = "wikipedia"
    description = (
        "Look up a concise summary of any topic from Wikipedia. Free, no key "
        "required. Use when the user asks for factual background on a subject."
    )
    parameters = {
        "query": {"type": "string", "description": "The topic to look up, e.g. 'Photosynthesis'."},
    }
    required = ["query"]

    def run(self, query: str) -> str:
        q = (query or "").strip()
        if not q:
            return "No query provided."
        try:
            resp = httpx.get(
                f"{_API}/{q.replace(' ', '_')}",
                timeout=20,
                headers={"Accept": "application/json"},
            )
            if resp.status_code == 200:
                try:
                    data = resp.json()
                except ValueError:
                    data = {}
                if data.get("extract"):
                    return f"{data.get('title')}: {data.get('extract', '')}"
            # Fall back to open search if the exact title missed or returned
            # non-JSON (Wikipedia returns HTML on 404, which .json() can't parse).
            s = httpx.get(
                "https://en.wikipedia.org/w/api.php",
                params={"action": "opensearch", "search": q, "limit": 1, "format": "json"},
                timeout=20,
            )
            try:
                s_data = s.json()
            except ValueError:
                return f"No Wikipedia article found for '{q}'."
            if len(s_data) > 3 and s_data[3]:
                return f"Wikipedia: {s_data[2][0] if s_data[2] else ''} {s_data[3][0]}"
            return f"No Wikipedia article found for '{q}'."
        except httpx.HTTPError as exc:
            return f"Wikipedia request failed: {exc}"


wikipedia_tool = WikipediaTool()
