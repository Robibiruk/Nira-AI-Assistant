"""Stack Overflow / Stack Exchange search tool (public API, no key required).

Uses the Stack Exchange 2.3 API (keyless, quota-limited). Good for concrete
programming Q&A.
"""
from __future__ import annotations

import httpx

from .base import Tool

_SO_URL = "https://api.stackexchange.com/2.3/search/advanced"


class StackOverflowSearchTool(Tool):
    name = "stackoverflow_search"
    description = (
        "Search Stack Overflow questions via the Stack Exchange API. Use when "
        "the user needs concrete programming answers or code solutions, e.g. "
        "'python asyncio timeout'."
    )
    parameters = {
        "query": {
            "type": "string",
            "description": "The search query, e.g. 'pandas groupby multiple columns'.",
        },
        "limit": {
            "type": "integer",
            "description": "Number of questions to return (default 5).",
        },
    }
    required = ["query"]

    def run(self, query: str, limit: int = 5) -> str:
        limit = max(1, min(int(limit or 5), 20))
        try:
            resp = httpx.get(
                _SO_URL,
                params={
                    "order": "desc",
                    "sort": "relevance",
                    "q": query,
                    "site": "stackoverflow",
                    "pagesize": limit,
                },
                timeout=20,
            )
            resp.raise_for_status()
            data = resp.json()
        except httpx.HTTPError as exc:
            return f"Stack Overflow request failed: {exc}"

        items = data.get("items", [])
        if not items:
            return f"No Stack Overflow questions found for '{query}'."

        lines = []
        for it in items:
            title = it.get("title", "")
            link = it.get("link", "")
            score = it.get("score", 0)
            answered = "✓" if it.get("is_answered") else "✗"
            lines.append(f"- {title} (score {score}, accepted {answered})\n  {link}")
        return f"Stack Overflow results for '{query}':\n" + "\n".join(lines)


stackoverflow_search_tool = StackOverflowSearchTool()
