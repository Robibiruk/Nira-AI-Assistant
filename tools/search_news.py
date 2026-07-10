"""News search tool backed by Tavily (topic=news).

Reuses the shared Tavily client from ``search_web``. Best for recent
events, current affairs, and time-sensitive queries.
"""
from __future__ import annotations

from .base import Tool
from .search_web import tavily_search


class NewsSearchTool(Tool):
    name = "news_search"
    description = (
        "Search recent news articles using Tavily's news index. Use this "
        "when the user asks for current events, breaking news, or anything "
        "time-sensitive. Returns headlines, URLs, and snippets."
    )
    parameters = {
        "query": {
            "type": "string",
            "description": "The news topic to search for, e.g. 'AI funding rounds'.",
        },
        "max_results": {
            "type": "integer",
            "description": "Maximum number of stories to return (default 5).",
        },
    }
    required = ["query"]

    def run(self, query: str, max_results: int = 5) -> str:
        return tavily_search(query, topic="news", max_results=max_results)


news_search_tool = NewsSearchTool()
