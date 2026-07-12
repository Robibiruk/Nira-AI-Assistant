"""Shared helper for reading external-tool keys from config/tool_keys.json.

The UI saves user-provided API keys (Google, DeepL, Spotify, GitHub, …) to
config/tool_keys.json via the /tools/keys endpoint. Tools read them here
instead of environment variables so the same key works everywhere.
"""
from __future__ import annotations

import json
from pathlib import Path

_BASE = Path(__file__).resolve().parent.parent  # Nira root
_KEYS_PATH = _BASE / "config" / "tool_keys.json"


def get_tool_key(name: str) -> str:
    """Return the stored api_key for a tool, or '' if not configured.

    Checks config/tool_keys.json first, then falls back to the environment
    variable ``<NAME>_API_KEY`` (e.g. TAVILY_API_KEY). This lets a key
    set in the host's env (Render / Vercel / .env) work without manually
    saving it in Settings.
    """
    try:
        if not _KEYS_PATH.exists():
            return ""
        data = json.loads(_KEYS_PATH.read_text(encoding="utf-8")) or {}
    except (ValueError, OSError):
        data = {}
    entry = data.get(name)
    if isinstance(entry, dict):
        key = (entry.get("api_key") or "").strip()
    else:
        key = str(entry or "").strip()
    if key:
        return key
    # Fallback to the conventional environment variable.
    import os

    return (os.getenv(f"{name.upper()}_API_KEY") or "").strip()


def get_tool_extra(name: str) -> dict:
    try:
        if not _KEYS_PATH.exists():
            return {}
        data = json.loads(_KEYS_PATH.read_text(encoding="utf-8")) or {}
    except (ValueError, OSError):
        return {}
    entry = data.get(name)
    if isinstance(entry, dict):
        return entry.get("extra", {}) or {}
    return {}
