"""Tavily web search tool (API key from config/tool_keys.json).

Used for the 'Browser' feature. Returns concise, sourced search results.
"""
from __future__ import annotations

from .base import Tool
from ._keys import get_tool_key
from .search_web import web_search_fallback

_TAVILY_URL = "https://api.tavily.com/search"


class TavilySearchTool(Tool):
    name = "tavily_search"
    description = (
        "Search the web with Tavily and return concise, sourced results. "
        "Use for current info, news, or anything requiring a live web lookup. "
        "Requires a Tavily API key (saved in Settings → Tool Connections)."
    )
    parameters = {
        "query": {
            "type": "string",
            "description": "The search query.",
        },
        "search_depth": {
            "type": "string",
            "description": "basic or advanced (more thorough). Default basic.",
        },
    }
    required: list[str] = ["query"]

    def run(self, query: str, search_depth: str = "basic") -> str:
        api_key = get_tool_key("tavily")
        if not api_key:
            return (
                "Tavily API key not set. Add it in Settings → Tool Connections "
                "(name 'tavily'). Falling back to keyless web search."
            )
        try:
            import httpx
        except ImportError:
            return "httpx is required for Tavily search."
        try:
            with httpx.Client(timeout=20.0) as client:
                resp = client.post(
                    _TAVILY_URL,
                    json={
                        "api_key": api_key,
                        "query": query,
                        "search_depth": search_depth or "basic",
                        "max_results": 6,
                        "include_answer": True,
                    },
                )
            if resp.status_code in (401, 403):
                # Key rejected/disabled by Tavily — fall back instead of
                # surfacing a cryptic 403 to the user.
                return web_search_fallback(query, max_results=6)
            resp.raise_for_status()
            data = resp.json()
        except Exception as exc:  # noqa: BLE001
            return f"Tavily search failed: {exc}"

        answer = data.get("answer")
        results = data.get("results", []) or []
        lines = []
        if answer:
            lines.append(f"Answer: {answer}")
        for i, r in enumerate(results[:6], 1):
            title = r.get("title", "")
            url = r.get("url", "")
            content = (r.get("content") or "").strip()
            lines.append(f"{i}. {title}\n   {url}\n   {content}")
        return "\n\n".join(lines) if lines else "No results."


tavily_search_tool = TavilySearchTool()
