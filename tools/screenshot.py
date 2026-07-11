"""Screenshot tool: capture the screen (best effort, local only).

Uses mss (pure-Python, cross-platform) when available; falls back to
platform-specific commands. Saves to config/../screenshots and returns the
path. On a headless server this may fail — the rest of NIRA keeps working.
"""
from __future__ import annotations

import os
import subprocess
import time
from pathlib import Path

from .base import Tool

_OUT = Path(__file__).resolve().parent.parent / "screenshots"
_OUT.mkdir(parents=True, exist_ok=True)


class ScreenshotTool(Tool):
    name = "take_screenshot"
    description = (
        "Capture the current screen and save it to a file. Local only. Use "
        "when the user asks to take a screenshot. Returns the saved path."
    )
    parameters = {
        "note": {"type": "string", "description": "Optional label to include in the filename."},
    }
    required = []

    def run(self, note: str = "") -> str:
        stamp = time.strftime("%Y%m%d-%H%M%S")
        safe = "".join(c for c in (note or "") if c.isalnum() or c in "-_")[:24]
        fname = f"shot-{stamp}{('-' + safe) if safe else ''}.png"
        out = _OUT / fname
        # Try mss first (no system deps on most platforms).
        try:
            from mss import mss  # type: ignore

            with mss() as sct:
                sct.shot(mon=-1, output=str(out))
            return f"Screenshot saved to {out}"
        except Exception:
            pass
        # Platform fallbacks.
        try:
            if os.name == "nt":
                out = _OUT / fname
                subprocess.run(
                    ["powershell", "-NoProfile",
                     f"Add-Type -AssemblyName System.Windows.Forms; "
                     f"[System.Windows.Forms.SendKeys]::SendWait('{{PrtSc}}')"],
                    check=False, timeout=15,
                )
                return "PrintScreen sent (clipboard). Save path capture not available here."
            if os.uname().sysname == "Darwin":
                subprocess.run(["screencapture", str(out)], check=False, timeout=15)
                return f"Screenshot saved to {out}"
        except Exception as exc:  # noqa: BLE001
            return f"Screenshot unavailable on this system: {exc}"
        return "Screenshot not supported in this environment (install 'mss')."


screenshot_tool = ScreenshotTool()
