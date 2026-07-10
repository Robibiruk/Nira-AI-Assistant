"""Social search placeholder (X / LinkedIn).

Official, general-purpose scraping APIs are heavily restricted:
  * X (Twitter): official API exists but is paywalled / rate-limited.
  * LinkedIn: API is for approved partners only; general scraping violates ToS.

Rather than ship a fragile scraper that breaks ToS, this tool explains the
limitation and routes the user to a working alternative (web/Reddit search).
"""
from __future__ import annotations

from .base import Tool


class SocialSearchTool(Tool):
    name = "social_search"
    description = (
        "Search social platforms. Note: X/Twitter and LinkedIn do not offer "
        "open, ToS-compliant search APIs; this tool explains the limitation "
        "and suggests using web_search or reddit_search instead. Use only "
        "when the user explicitly asks about social-media content."
    )
    parameters = {
        "query": {
            "type": "string",
            "description": "The topic to look up on social platforms.",
        },
        "platform": {
            "type": "string",
            "description": "Which platform: 'twitter' / 'x' or 'linkedin'.",
        },
    }
    required = ["query"]

    def run(self, query: str, platform: str = "") -> str:
        plat = (platform or "social").lower()
        note = (
            f"Direct search on '{plat}' is not available: "
            "X/Twitter's API is paywalled and LinkedIn's is partner-only, "
            "so automated scraping would violate their Terms of Service."
        )
        alt = (
            "Try instead:\n"
            f"  - web_search('{query}') for general web coverage\n"
            f"  - reddit_search('{query}') for community discussion\n"
            f"  - hackernews_search('{query}') for tech opinion"
        )
        return f"{note}\n{alt}"


social_search_tool = SocialSearchTool()
