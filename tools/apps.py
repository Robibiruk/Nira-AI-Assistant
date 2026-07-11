"""App launcher tool: open desktop applications by name (Windows-focused)."""
from __future__ import annotations

import os
import platform
import subprocess

from .base import Tool

# Friendly name -> launch target resolved by the OS.
# Values may be a plain executable (on PATH / App Paths) OR a URI scheme
# (e.g. ms-settings:) that os.startfile / ShellExecute understands.
_ALIASES: dict[str, str] = {
    # UWP / shell apps (must use URI schemes, not `start <name>`)
    "settings": "ms-settings:",
    "ms-settings": "ms-settings:",
    "windows settings": "ms-settings:",
    "control panel": "ms-settings:",
    "photos": "ms-photos:",
    "camera": "microsoft.windows.camera:",
    "store": "ms-windows-store:",
    "microsoft store": "ms-windows-store:",
    "mail": "mailto:",
    "calculator": "calc",
    "calc": "calc",
    "notepad": "notepad",
    "paint": "mspaint",
    "explorer": "explorer",
    "file explorer": "explorer",
    "vscode": "code",
    "vs code": "code",
    "code": "code",
    "chrome": "chrome",
    "firefox": "firefox",
    "edge": "msedge",
    "terminal": "wt" if platform.system() == "Windows" else "gnome-terminal",
    "cmd": "cmd",
    "command prompt": "cmd",
    "powershell": "powershell",
}


def _launch(name: str) -> str:
    target = _ALIASES.get(name.strip().lower(), name.strip())
    if platform.system() == "Windows":
        # os.startfile uses ShellExecute, which resolves both executables on
        # PATH/App-Paths AND URI schemes (ms-settings:, etc.). This is far more
        # reliable than `start`, which only looks for a runnable file and
        # throws "Windows cannot find 'X'" for things like "settings".
        try:
            os.startfile(target)
            return f"Launched {name} (via {target})."
        except Exception as exc:  # noqa: BLE001
            # Last resort: shell start (handles quoted paths/URIs).
            try:
                subprocess.Popen(["cmd", "/c", "start", "", target], shell=True)
                return f"Launched {name} (via {target})."
            except Exception:
                return f"Could not open '{name}' ({exc})."
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
        "Firefox, Edge, File Explorer, and Settings."
    )
    parameters = {
        "app": {
            "type": "string",
            "description": "Name of the app to open, e.g. 'vscode', 'calculator', 'settings'.",
        }
    }
    required = ["app"]

    def run(self, app: str) -> str:
        return _launch(app)


app_tool = AppLauncherTool()
