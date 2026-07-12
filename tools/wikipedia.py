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
        # Wikipedia blocks requests with no User-Agent (returns 403 on servers),
        # which is why lookups failed from the deployed backend.
        headers = {"Accept": "application/json", "User-Agent": "NIRA/1.0 (assistant)"}
        try:
            resp = httpx.get(
                f"{_API}/{q.replace(' ', '_')}",
                timeout=20,
                headers=headers,
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
                params={"action": "opensearch", "search": q, "limit": 3, "format": "json"},
                timeout=20,
                headers=headers,
            )
            try:
                s_data = s.json()
            except ValueError:
                return f"No Wikipedia article found for '{q}'."
            # opensearch shape: [query, [titles], [descriptions], [urls]]
            if len(s_data) > 3 and s_data[3]:
                title = (s_data[1][0] if s_data[1] else "")
                snippet = (s_data[2][0] if s_data[2] else "")
                url = (s_data[3][0] if s_data[3] else "")
                text = f"Wikipedia: {title}"
                if snippet:
                    text += f" — {snippet}"
                if url:
                    text += f"\n   {url}"
                return text
            return f"No Wikipedia article found for '{q}'."
        except httpx.HTTPError as exc:
            return f"Wikipedia request failed: {exc}"


wikipedia_tool = WikipediaTool()
