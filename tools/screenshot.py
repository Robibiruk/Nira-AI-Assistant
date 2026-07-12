"""Screenshot tool: capture the screen (best effort, local only).

Uses mss (pure-Python, cross-platform) when available; falls back to
platform-specific commands. Saves to config/../screenshots and returns the
path. On a headless server this may fail — the rest of NIRA keeps working.
"""
from __future__ import annotations

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
        # Try mss first (pure-Python, cross-platform, no system deps needed).
        try:
            from mss import mss  # type: ignore

            with mss() as sct:
                sct.shot(mon=-1, output=str(out))
            return f"Screenshot saved to {out}"
        except Exception as exc:  # noqa: BLE001
            err = str(exc).strip()
            # Headless server (Render): no display. Hand the capture to the
            # FRONTEND, which uses the browser Screen Capture API on the user's
            # own machine (keyless). The sentinel is turned into a capture_screen
            # event; the plain text is what the user sees.
            if "No module named" in err:
                return (
                    "Screenshot needs the 'mss' package (listed in "
                    "requirements.txt). CAPTURE_SCREEN::"
                )
            return "Capturing your screen — pick a window or screen to share. CAPTURE_SCREEN::"


screenshot_tool = ScreenshotTool()
