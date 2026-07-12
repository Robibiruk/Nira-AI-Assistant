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
    """Return the api_key for a tool, or '' if not configured.

    Priority (env WINS): the host environment variable ``<NAME>_API_KEY``
    (e.g. TAVILY_API_KEY on Render) is checked FIRST. This lets deploy-time
    secrets work automatically without any manual Settings setup. The
    config/tool_keys.json file (set via the UI) is used only as a fallback,
    because on ephemeral hosts (Render free tier) that file is wiped on every
    redeploy and would otherwise override a perfectly good env var.
    """
    import os

    env_key = (os.getenv(f"{name.upper()}_API_KEY") or "").strip()
    if env_key:
        return env_key
    try:
        if not _KEYS_PATH.exists():
            return ""
        data = json.loads(_KEYS_PATH.read_text(encoding="utf-8")) or {}
    except (ValueError, OSError):
        data = {}
    entry = data.get(name)
    if isinstance(entry, dict):
        return (entry.get("api_key") or "").strip()
    return str(entry or "").strip()


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
