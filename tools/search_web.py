"""General web search tool.

Primary backend: Tavily (clean, LLM-ready results) when ``TAVILY_API_KEY`` is
set. When no key is configured, falls back to keyless sources (Wikipedia
open search + DuckDuckGo HTML) so web search still returns live results
without any API key. Reddit search is separate (see search_reddit.py) and is
already keyless.
"""
from __future__ import annotations

import os
import re
from html import unescape
from urllib.parse import quote_plus

import httpx

from .base import Tool

_TAVILY_URL = "https://api.tavily.com/search"


def _tavily_key() -> str | None:
    return os.getenv("TAVILY_API_KEY")


def _tavily_search(query: str, max_results: int) -> str | None:
    key = _tavily_key()
    if not key:
        return None
    try:
        resp = httpx.post(
            _TAVILY_URL,
            json={
                "api_key": key,
                "query": query,
                "topic": "general",
                "max_results": int(max_results or 5),
                "search_depth": "basic",
                "include_answer": True,
            },
            headers={"Authorization": f"Bearer {key}"},
            timeout=20,
        )
        resp.raise_for_status()
        data = resp.json()
    except httpx.HTTPError as exc:
        return f"Tavily request failed: {exc}"

    answer = data.get("answer")
    results = data.get("results", [])
    if not results and not answer:
        return f"No web results for '{query}'."

    lines = []
    if answer:
        lines.append(f"Summary: {answer}\n")
    for r in results:
        title = r.get("title", "")
        url = r.get("url", "")
        content = (r.get("content") or "").strip()
        lines.append(f"- {title}\n  {url}\n  {content}")
    return f"Web results for '{query}':\n" + "\n".join(lines)


def _wikipedia_search(query: str, max_results: int) -> list[str]:
    """Keyless: Wikipedia opensearch → article extracts."""
    try:
        resp = httpx.get(
            "https://en.wikipedia.org/w/api.php",
            params={
                "action": "query",
                "format": "json",
                "prop": "extracts",
                "exintro": "1",
                "explaintext": "1",
                "redirects": "1",
                "titles": query,
            },
            headers={"User-Agent": "NIRA/0.3 (+https://github.com/nira)"},
            timeout=20,
        )
        resp.raise_for_status()
        pages = resp.json().get("query", {}).get("pages", {})
        lines = []
        for _, p in pages.items():
            title = p.get("title", "")
            extract = (p.get("extract") or "").strip().replace("\n", " ")
            if title and extract:
                lines.append(f"- {title}\n  https://en.wikipedia.org/wiki/{quote_plus(title)}\n  {extract[:280]}")
            if len(lines) >= max_results:
                break
        return lines
    except httpx.HTTPError:
        return []


def _duckduckgo_search(query: str, max_results: int) -> list[str]:
    """Keyless: DuckDuckGo HTML results page, parsed for title/snippet/url."""
    try:
        resp = httpx.get(
            "https://html.duckduckgo.com/html/",
            params={"q": query},
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0 Safari/537.36"
                ),
                "Accept": "text/html",
            },
            timeout=20,
            follow_redirects=True,
        )
        resp.raise_for_status()
        html = resp.text
    except httpx.HTTPError:
        return []

    # Each result block: <a class="result__a" href="...">TITLE</a> ...
    # <a class="result__snippet">SNIPPET</a>
    results = re.findall(
        r'class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>.*?'
        r'class="result__snippet"[^>]*>(.*?)</a>',
        html,
        re.DOTALL,
    )
    lines = []
    for url, title, snippet in results:
        title = unescape(re.sub(r"<[^>]+>", "", title)).strip()
        snippet = unescape(re.sub(r"<[^>]+>", "", snippet)).strip()
        if title:
            lines.append(f"- {title}\n  {url}\n  {snippet[:240]}")
        if len(lines) >= max_results:
            break
    return lines


def web_search_fallback(query: str, max_results: int = 5) -> str:
    """Keyless web search: Wikipedia first, DuckDuckGo as backup."""
    lines = _wikipedia_search(query, max_results)
    if len(lines) < max_results:
        lines += _duckduckgo_search(query, max_results - len(lines))
    if not lines:
        return f"No web results for '{query}'."
    return f"Web results for '{query}':\n" + "\n".join(lines[:max_results])


def tavily_search(query: str, topic: str = "general", max_results: int = 5) -> str:
    """Run a web search. Uses Tavily when a key is set, else keyless fallback."""
    if topic == "news":
        max_results = max_results
    tavily = _tavily_search(query, max_results)
    if tavily is not None:
        return tavily
    return web_search_fallback(query, max_results)


class WebSearchTool(Tool):
    name = "web_search"
    description = (
        "Search the web for general information. Returns structured results "
        "(title, URL, snippet) plus a short summary. Works with or without an "
        "API key (uses Tavily when TAVILY_API_KEY is set, otherwise Wikipedia + "
        "DuckDuckGo). Use for factual lookups, articles, reference material, and "
        "websites."
    )
    parameters = {
        "query": {
            "type": "string",
            "description": "The search query, e.g. 'best python ide 2026'.",
        },
        "max_results": {
            "type": "integer",
            "description": "Maximum number of results to return (default 5).",
        },
    }
    required = ["query"]

    def run(self, query: str, max_results: int = 5) -> str:
        return tavily_search(query, topic="general", max_results=max_results)


web_search_tool = WebSearchTool()
