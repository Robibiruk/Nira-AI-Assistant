"""Hacker News search tool using the Algolia HN API (no key required).

Excellent for programming news and startup/tech discussions. The Algolia
HN API is public and keyless.
"""
from __future__ import annotations

import httpx

from .base import Tool

_HN_URL = "http://hn.algolia.com/api/v1/search"


class HackerNewsSearchTool(Tool):
    name = "hackernews_search"
    description = (
        "Search Hacker News stories via the public Algolia API. Use when the "
        "user wants programming news, startup discussion, or tech opinions, "
        "e.g. 'rust vs go 2026'."
    )
    parameters = {
        "query": {
            "type": "string",
            "description": "The search query, e.g. 'LLM agents'.",
        },
        "limit": {
            "type": "integer",
            "description": "Number of stories to return (default 5).",
        },
    }
    required = ["query"]

    def run(self, query: str, limit: int = 5) -> str:
        limit = max(1, min(int(limit or 5), 20))
        try:
            resp = httpx.get(
                _HN_URL,
                params={"query": query, "tags": "story", "hitsPerPage": limit},
                timeout=20,
                follow_redirects=True,
            )
            resp.raise_for_status()
            data = resp.json()
        except httpx.HTTPError as exc:
            return f"Hacker News request failed: {exc}"

        hits = data.get("hits", [])
        if not hits:
            return f"No Hacker News stories found for '{query}'."

        lines = []
        for h in hits:
            title = h.get("title") or h.get("story_title") or "(untitled)"
            url = h.get("url") or f"https://news.ycombinator.com/item?id={h.get('objectID','')}"
            points = h.get("points", 0)
            comments = h.get("num_comments", 0)
            lines.append(f"- {title}\n  {url}\n  ↑ {points} · 💬 {comments}")
        return f"Hacker News stories for '{query}':\n" + "\n".join(lines)


hackernews_search_tool = HackerNewsSearchTool()
