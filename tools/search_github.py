"""GitHub search tool using the public REST API (no key required).

Unauthenticated requests are limited to 60/hr; set a ``GITHUB_TOKEN``
environment variable to raise the limit to 5000/hr. Supports repository
search and code search.
"""
from __future__ import annotations

import os

import httpx

from .base import Tool
from core.oauth_store import get_access_token

_GH_API = "https://api.github.com"


def _headers() -> dict:
    headers = {"Accept": "application/vnd.github+json"}
    # 1) User-connected OAuth token (per-user, 5000/hr).
    tok = get_access_token("github")
    if tok:
        headers["Authorization"] = f"Bearer {tok}"
    # 2) Server env fallback (GITHUB_TOKEN in render.yaml).
    elif (env_tok := (os.getenv("GITHUB_TOKEN") or "").strip()):
        headers["Authorization"] = f"Bearer {env_tok}"
    return headers


class GitHubSearchTool(Tool):
    name = "github_search"
    description = (
        "Search GitHub repositories and code via the public REST API. Use "
        "when the user wants code examples, libraries, or projects, e.g. "
        "'find Flask authentication examples'."
    )
    parameters = {
        "query": {
            "type": "string",
            "description": "The GitHub search query, e.g. 'flask auth' or 'language:python websocket'.",
        },
        "kind": {
            "type": "string",
            "description": "What to search: 'repositories' (default) or 'code'.",
        },
        "limit": {
            "type": "integer",
            "description": "Number of results to return (default 5).",
        },
    }
    required = ["query"]

    def run(self, query: str, kind: str = "repositories", limit: int = 5) -> str:
        limit = max(1, min(int(limit or 5), 20))
        kind = (kind or "repositories").lower()
        try:
            if kind == "code":
                resp = httpx.get(
                    f"{_GH_API}/search/code",
                    params={"q": query, "per_page": limit},
                    headers=_headers(),
                    timeout=20,
                )
            else:
                resp = httpx.get(
                    f"{_GH_API}/search/repositories",
                    params={"q": query, "per_page": limit, "sort": "stars", "order": "desc"},
                    headers=_headers(),
                    timeout=20,
                )
            resp.raise_for_status()
            data = resp.json()
        except httpx.HTTPError as exc:
            return f"GitHub request failed: {exc}"

        items = data.get("items", [])
        if not items:
            return f"No GitHub {kind} found for '{query}'."

        lines = []
        if kind == "code":
            for it in items:
                repo = it.get("repository", {}).get("full_name", "")
                path = it.get("path", "")
                url = it.get("html_url", "")
                lines.append(f"- {repo} » {path}\n  {url}")
        else:
            for it in items:
                name = it.get("full_name", "")
                desc = (it.get("description") or "").strip()
                url = it.get("html_url", "")
                stars = it.get("stargazers_count", 0)
                lines.append(f"- {name} ★{stars}\n  {url}\n  {desc}")
        return f"GitHub {kind} for '{query}':\n" + "\n".join(lines)


github_search_tool = GitHubSearchTool()
