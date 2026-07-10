"""PubMed search tool using NCBI E-utilities (no key required).

Flow: esearch to get PMIDs, then esummary to fetch titles/metadata. The
public E-utilities are rate-limited (~3 req/s without a key); for heavy use
set an ``NCBI_API_KEY``. Good for medical and biomedical research.
"""
from __future__ import annotations

import httpx
import os

from .base import Tool

_EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"


class PubmedSearchTool(Tool):
    name = "pubmed_search"
    description = (
        "Search PubMed biomedical literature via NCBI E-utilities. Use when "
        "the user asks about medical or life-science research, e.g. "
        "'covid vaccine efficacy studies'."
    )
    parameters = {
        "query": {
            "type": "string",
            "description": "The PubMed search query, e.g. 'CRISPR gene editing'.",
        },
        "max_results": {
            "type": "integer",
            "description": "Number of articles to return (default 5).",
        },
    }
    required = ["query"]

    def run(self, query: str, max_results: int = 5) -> str:
        max_results = max(1, min(int(max_results or 5), 20))
        ncbi_key = os.getenv("NCBI_API_KEY")
        try:
            es_params = {
                "db": "pubmed",
                "term": query,
                "retmode": "json",
                "retmax": max_results,
            }
            if ncbi_key:
                es_params["api_key"] = ncbi_key
            s = httpx.get(
                f"{_EUTILS}/esearch.fcgi",
                params=es_params,
                timeout=20,
            )
            s.raise_for_status()
            ids = s.json().get("esearchresult", {}).get("idlist", [])
            if not ids:
                return f"No PubMed articles found for '{query}'."
            sum_params = {"db": "pubmed", "id": ",".join(ids), "retmode": "json"}
            if ncbi_key:
                sum_params["api_key"] = ncbi_key
            u = httpx.get(
                f"{_EUTILS}/esummary.fcgi",
                params=sum_params,
                timeout=20,
            )
            u.raise_for_status()
            summary = u.json().get("result", {})
        except httpx.HTTPError as exc:
            return f"PubMed request failed: {exc}"

        lines = []
        for pid in ids:
            item = summary.get(pid, {})
            title = item.get("title", "")
            source = item.get("source", "")
            pubdate = item.get("pubdate", "")
            url = f"https://pubmed.ncbi.nlm.nih.gov/{pid}/"
            lines.append(f"- {title} ({source}, {pubdate})\n  {url}")
        return f"PubMed articles for '{query}':\n" + "\n".join(lines)


pubmed_search_tool = PubmedSearchTool()
