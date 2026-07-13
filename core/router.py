"""
Tool Manager (router).

Single registry of every available tool. The assistant asks this module for
the JSON schemas to send to the model, and calls ``execute`` when the model
requests a tool. Tool enable/disable is driven by ``config.settings.yaml``.
"""
from __future__ import annotations

from config import ENABLED_TOOLS

# ---- File tools ----
from tools.files import file_tools

# ---- Single tools ----
from tools.apps import app_tool
from tools.browser import browser_tool
from tools.calculator import calculator_tool
from tools.terminal import terminal_tool
from tools.windows import (
    apps_tool,
    tabs_tool,
    windows_tool,
    installed_apps_tool,
    focus_window_tool,
    close_window_tool,
    focus_tab_tool,
    close_tab_tool,
    device_apps_tool,
)
from tools.weather import weather_tool
from tools.translate import translate_tool
from tools.wikipedia import wikipedia_tool
from tools.spotify import spotify_tool
from tools.screenshot import screenshot_tool
from tools.gmail import gmail_tool
from tools.google_account import google_tool

# ---- Search tools ----
from tools.search_arxiv import arxiv_search_tool
from tools.search_github import github_search_tool
from tools.search_hackernews import hackernews_search_tool
from tools.search_news import news_search_tool
from tools.search_pubmed import pubmed_search_tool
from tools.search_reddit import reddit_search_tool
from tools.search_stackoverflow import stackoverflow_search_tool
from tools.search_social import social_search_tool
from tools.search_web import web_search_tool
from tools.search_youtube import youtube_search_tool
from tools.tavily_search import tavily_search_tool
from tools.browse import browse_tool

ALL_TOOLS = [
    # Core system tools
    browser_tool,
    browse_tool,
    terminal_tool,
    *file_tools,
    app_tool,
    calculator_tool,
    weather_tool,
    translate_tool,
    wikipedia_tool,
    spotify_tool,
    gmail_tool,
    google_tool,
    screenshot_tool,
    # Windows system
    windows_tool,
    apps_tool,
    tabs_tool,
    installed_apps_tool,
    focus_window_tool,
    close_window_tool,
    focus_tab_tool,
    close_tab_tool,
    device_apps_tool,
    # Search ecosystem
    web_search_tool,
    news_search_tool,
    reddit_search_tool,
    github_search_tool,
    youtube_search_tool,
    arxiv_search_tool,
    pubmed_search_tool,
    hackernews_search_tool,
    stackoverflow_search_tool,
    social_search_tool,
    tavily_search_tool,
]
REGISTRY = {tool.name: tool for tool in ALL_TOOLS}


def get_schemas() -> list[dict]:
    """JSON schemas for every enabled tool, for the OpenRouter request."""
    if ENABLED_TOOLS:
        return [t.schema() for t in ALL_TOOLS if t.name in ENABLED_TOOLS]
    return [t.schema() for t in ALL_TOOLS]


def execute(name: str, arguments: dict | None) -> str:
    """Run a tool by name and return its textual output."""
    tool = REGISTRY.get(name)
    if tool is None:
        return f"Unknown tool: {name}"
    if ENABLED_TOOLS and name not in ENABLED_TOOLS:
        return f"Tool disabled: {name}"
    try:
        return tool.run(**(arguments or {}))
    except Exception as exc:  # never let a tool crash the assistant
        from loguru import logger

        logger.exception("Tool execution failed")
        return f"Tool error: {exc}"
