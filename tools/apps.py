"""App launcher tool: open desktop applications by name (Windows-focused)."""
from __future__ import annotations

import platform
import subprocess

from .base import Tool

# Friendly name -> executable/launch token resolved by the OS.
_ALIASES: dict[str, str] = {
    "vscode": "code",
    "vs code": "code",
    "code": "code",
    "calculator": "calc",
    "calc": "calc",
    "notepad": "notepad",
    "chrome": "chrome",
    "firefox": "firefox",
    "edge": "msedge",
    "explorer": "explorer",
    "terminal": "wt" if platform.system() == "Windows" else "gnome-terminal",
}


def _launch(name: str) -> str:
    target = _ALIASES.get(name.strip().lower(), name.strip())
    if platform.system() == "Windows":
        # `start` resolves from PATH and the App Paths registry; it returns
        # immediately, so we can't reliably detect a missing app here.
        subprocess.Popen(["cmd", "/c", "start", "", target])
        return f"Launched {name} (via {target})."
    try:
        subprocess.Popen([target])
        return f"Launched {name} (via {target})."
    except FileNotFoundError:
        return f"Could not find an app named '{name}'."


class AppLauncherTool(Tool):
    name = "open_app"
    description = (
        "Open a desktop application on the user's machine by name. "
        "Supports common apps like VS Code, Calculator, Notepad, Chrome, "
        "Firefox, Edge, File Explorer, and the terminal."
    )
    parameters = {
        "app": {
            "type": "string",
            "description": "Name of the app to open, e.g. 'vscode', 'calculator', 'chrome'.",
        }
    }
    required = ["app"]

    def run(self, app: str) -> str:
        return _launch(app)


app_tool = AppLauncherTool()
