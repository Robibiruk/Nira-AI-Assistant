"""
Configuration loader for JARVIS.

Reads ``config/settings.yaml`` and merges it over built-in defaults.
Secrets (the OpenRouter API key) can be overridden with the
``OPENROUTER_API_KEY`` environment variable so the key is never committed.
"""
from __future__ import annotations

import os
from pathlib import Path

import yaml

BASE_DIR = Path(__file__).resolve().parent


def _load_env_file(path: Path) -> None:
    """Minimal .env loader (no extra dependency).

    Reads KEY=VALUE pairs from a ``.env`` file next to this module and pushes
    them into ``os.environ`` *without* clobbering variables already set in the
    shell. Shell exports always win. Lines starting with ``#`` are ignored.
    """
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key, val = key.strip(), val.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = val
CONFIG_PATH = BASE_DIR / "config" / "settings.yaml"

_DEFAULTS: dict = {
    "openrouter": {"api_key": ""},
    "model": "",
    "voice": False,
    "memory": "sqlite",
    "temperature": 0.7,
    "tools": {"enabled": []},
}


def _deep_merge(base: dict, override: dict) -> dict:
    out = dict(base)
    for key, val in (override or {}).items():
        if isinstance(val, dict) and isinstance(out.get(key), dict):
            out[key] = _deep_merge(out[key], val)
        else:
            out[key] = val
    return out


def load_config(path: str | os.PathLike = CONFIG_PATH) -> dict:
    cfg = _deep_merge(_DEFAULTS, {})
    if Path(path).exists():
        with open(path, "r", encoding="utf-8") as fh:
            user_cfg = yaml.safe_load(fh) or {}
        cfg = _deep_merge(cfg, user_cfg)
    env_key = os.getenv("OPENROUTER_API_KEY")
    if env_key:
        cfg.setdefault("openrouter", {})["api_key"] = env_key
    return cfg


_load_env_file(BASE_DIR / ".env")

config = load_config()

OPENROUTER_API_KEY: str = config["openrouter"]["api_key"]
MODEL: str = config["model"]
TEMPERATURE: float = float(config["temperature"])
VOICE_ENABLED: bool = bool(config["voice"])
MEMORY_BACKEND: str = config["memory"]
ENABLED_TOOLS: set = set(config.get("tools", {}).get("enabled", []) or [])
