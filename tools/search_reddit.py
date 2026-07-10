"""Reddit search tool using the public JSON API (no API key required).

Reddit's public ``search.json`` endpoint is rate-limited but keyless. A
descriptive User-Agent is required or requests get silently throttled.
"""
from __future__ import annotations

import httpx

from .base import Tool

_REDDIT_URL = "https://www.reddit.com/search.json"


class RedditSearchTool(Tool):
    name = "reddit_search"
    description = (
        "Search Reddit posts and discussions using the public JSON API. "
        "Use when the user wants community opinions, experiences, or "
        "discussions, e.g. 'what does Reddit think about Claude Code?'."
    )
    parameters = {
        "query": {
            "type": "string",
            "description": "The search query, e.g. 'best mechanical keyboard'.",
        },
        "limit": {
            "type": "integer",
            "description": "Number of posts to return (default 5, max 25).",
        },
    }
    required = ["query"]

    def run(self, query: str, limit: int = 5) -> str:
        limit = max(1, min(int(limit or 5), 25))
        try:
            resp = httpx.get(
                _REDDIT_URL,
                params={"q": query, "limit": limit, "sort": "relevance", "type": "link"},
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/124.0 Safari/537.36"
                    ),
                    "Accept": "application/json",
                },
                timeout=20,
                follow_redirects=True,
            )
            resp.raise_for_status()
            data = resp.json()
        except httpx.HTTPError as exc:
            return f"Reddit request failed: {exc}"

        posts = data.get("data", {}).get("children", [])
        if not posts:
            return f"No Reddit posts found for '{query}'."

        lines = []
        for p in posts:
            d = p.get("data", {})
            title = d.get("title", "")
            sub = d.get("subreddit", "")
            url = f"https://www.reddit.com{d.get('permalink', '')}"
            score = d.get("score", 0)
            comments = d.get("num_comments", 0)
            lines.append(
                f"- [{sub}] {title}\n  {url}\n  ↑ {score} · 💬 {comments} comments"
            )
        return f"Reddit discussions for '{query}':\n" + "\n".join(lines)


reddit_search_tool = RedditSearchTool()
