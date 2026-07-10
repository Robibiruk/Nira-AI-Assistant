"""YouTube search tool using the YouTube Data API v3 (requires an API key).

The YouTube Data API requires a ``YOUTUBE_API_KEY`` (Google Cloud project +
YouTube Data v3 enabled). Without it the tool returns a clear instruction
rather than crashing — the rest of JARVIS keeps working.
"""
from __future__ import annotations

import os

import httpx

from .base import Tool

_YT_URL = "https://www.googleapis.com/youtube/v3/search"


class YouTubeSearchTool(Tool):
    name = "youtube_search"
    description = (
        "Search YouTube videos using the YouTube Data API v3. Use when the "
        "user wants video tutorials or talks, e.g. 'find LangGraph "
        "tutorials'. Requires a YOUTUBE_API_KEY environment variable."
    )
    parameters = {
        "query": {
            "type": "string",
            "description": "The video search query, e.g. 'intro to transformers'.",
        },
        "max_results": {
            "type": "integer",
            "description": "Number of videos to return (default 5).",
        },
    }
    required = ["query"]

    def run(self, query: str, max_results: int = 5) -> str:
        key = os.getenv("YOUTUBE_API_KEY")
        if not key:
            return (
                "YouTube search requires a YOUTUBE_API_KEY environment "
                "variable (Google Cloud project + YouTube Data API v3). "
                "Get one at https://console.cloud.google.com."
            )
        max_results = max(1, min(int(max_results or 5), 20))
        try:
            resp = httpx.get(
                _YT_URL,
                params={
                    "part": "snippet",
                    "q": query,
                    "type": "video",
                    "maxResults": max_results,
                    "key": key,
                },
                timeout=20,
            )
            resp.raise_for_status()
            data = resp.json()
        except httpx.HTTPError as exc:
            return f"YouTube request failed: {exc}"

        items = data.get("items", [])
        if not items:
            return f"No YouTube videos found for '{query}'."

        lines = []
        for it in items:
            snip = it.get("snippet", {})
            vid = it.get("id", {}).get("videoId", "")
            title = snip.get("title", "")
            chan = snip.get("channelTitle", "")
            url = f"https://www.youtube.com/watch?v={vid}" if vid else ""
            lines.append(f"- {title} ({chan})\n  {url}")
        return f"YouTube results for '{query}':\n" + "\n".join(lines)


youtube_search_tool = YouTubeSearchTool()
