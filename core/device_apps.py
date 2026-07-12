"""Device-agnostic app/context store.

The desktop (pywin32) tools only work on Windows. To make "list apps /
list installed apps" work on ANY device (Android, iOS, Linux, macOS, or a
remote backend), the client reports what it can see via ``POST /device/apps``
and the tools read from this shared store. On Windows the pywin32 path still
wins when available; otherwise we fall back to whatever the device reported.
"""
from __future__ import annotations

import threading
import time
from typing import Optional

_lock = threading.Lock()
_state: dict = {"device": "unknown", "apps": [], "source": "none", "updated_at": 0.0}


def report_apps(device: str, apps: list, source: str = "client") -> None:
    """Store the latest app list reported by a client device."""
    global _state
    with _lock:
        _state = {
            "device": device or "unknown",
            "apps": list(apps or []),
            "source": source or "client",
            "updated_at": time.time(),
        }


def get_apps() -> dict:
    """Return the latest reported app list (copy)."""
    with _lock:
        return dict(_state)


def has_apps() -> bool:
    with _lock:
        return bool(_state.get("apps"))
