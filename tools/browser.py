"""Browser tool: open the user's web browser (optionally at a URL)."""
from __future__ import annotations

import webbrowser

from .base import Tool


def _controller() -> webbrowser.BaseBrowser:
    try:
        return webbrowser.get("chrome")
    except webbrowser.Error:
        return webbrowser.get()


class OpenBrowserTool(Tool):
    name = "open_browser"
    description = (
        "Open a web browser on the user's machine. Optionally open a specific URL. "
        "Use when the user wants to browse the web, open a website, or launch Chrome."
    )
    parameters = {
        "url": {
            "type": "string",
            "description": "The URL to open. If omitted, opens the default start page.",
        }
    }
    required: list[str] = []

    def run(self, url: str | None = None) -> str:
        target = url or "https://www.google.com"
        _controller().open(target)
        return f"Opened browser at {target}"


browser_tool = OpenBrowserTool()
