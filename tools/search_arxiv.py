"""arXiv search tool using the public Atom API (no key required).

arXiv exposes an open query API returning Atom XML. We parse it with the
standard library so there is no extra dependency. Great for research papers.
"""
from __future__ import annotations

import urllib.parse
import xml.etree.ElementTree as ET

import httpx

from .base import Tool

_ARXIV_URL = "http://export.arxiv.org/api/query"
_NS = {"atom": "http://www.w3.org/2005/Atom"}


class ArxivSearchTool(Tool):
    name = "arxiv_search"
    description = (
        "Search arXiv preprints (physics, math, CS, ML, etc.) via the public "
        "API. Use when the user wants academic or research papers, e.g. "
        "'attention mechanism survey'."
    )
    parameters = {
        "query": {
            "type": "string",
            "description": "The search query, e.g. 'diffusion models'.",
        },
        "max_results": {
            "type": "integer",
            "description": "Number of papers to return (default 5).",
        },
    }
    required = ["query"]

    def run(self, query: str, max_results: int = 5) -> str:
        max_results = max(1, min(int(max_results or 5), 20))
        try:
            resp = httpx.get(
                _ARXIV_URL,
                params={
                    "search_query": f"all:{query}",
                    "start": 0,
                    "max_results": max_results,
                    "sortBy": "relevance",
                },
                timeout=25,
                follow_redirects=True,
            )
            resp.raise_for_status()
            root = ET.fromstring(resp.text)
        except (httpx.HTTPError, ET.ParseError) as exc:
            return f"arXiv request failed: {exc}"

        entries = root.findall("atom:entry", _NS)
        if not entries:
            return f"No arXiv papers found for '{query}'."

        lines = []
        for e in entries:
            title = " ".join((e.findtext("atom:title", "", _NS) or "").split())
            summary = " ".join((e.findtext("atom:summary", "", _NS) or "").split())
            link = ""
            for l in e.findall("atom:link", _NS):
                if l.get("rel") == "alternate":
                    link = l.get("href", "")
            authors = ", ".join(
                a.findtext("atom:name", "", _NS) for a in e.findall("atom:author", _NS)
            )
            lines.append(f"- {title} ({authors})\n  {link}\n  {summary[:240]}")
        return f"arXiv papers for '{query}':\n" + "\n".join(lines)


arxiv_search_tool = ArxivSearchTool()
