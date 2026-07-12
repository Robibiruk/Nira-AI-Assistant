"""Browser tool: open the user's web browser (optionally at a URL)."""
from __future__ import annotations

import webbrowser

from .base import Tool


def _controller() -> "webbrowser.BaseBrowser | None":
    # On a headless server (Render, CI) no browser is installed, so
    # `webbrowser.get(...)` raises "could not locate runnable browser".
    # Return None instead of crashing so the tool degrades gracefully.
    try:
        try:
            return webbrowser.get("chrome")
        except webbrowser.Error:
            return webbrowser.get()
    except webbrowser.Error:
        return None


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
        ctrl = _controller()
        if ctrl is None:
            return (
                "A web browser is not available in this environment (no runnable "
                f"browser found). To open it yourself, visit: {target}"
            )
        ctrl.open(target)
        return f"Opened browser at {target}"


browser_tool = OpenBrowserTool()
