"""Runtime state for the model "brain" (multi-provider aware).

The configured model is only the *starting* choice. This module:
  * holds the currently-active scoped model id (``"provider|model"``),
  * caches the union of free, tool-capable models across all configured
    providers, and
  * lets the assistant auto-rotate across *providers* when one is rate-limited.

Kept deliberately tiny and process-local — no DB, no threads.
"""
from __future__ import annotations

import threading

from config import MODEL
from ai import provider as provider_mod

_lock = threading.Lock()
_current_model: str = MODEL
_free_cache: list[dict] = []
_providers: list = []


def set_providers(providers: list) -> None:
    """Called once at startup with the configured Provider list."""
    global _providers
    with _lock:
        _providers = providers


def rebuild_providers() -> None:
    """Re-read provider config (env + custom JSON) and swap the list.

    Used when the user adds/removes a custom/local provider from the
    Settings UI, so the change takes effect without a restart.
    """
    from ai.providers import build_providers

    new = build_providers()
    set_providers(new)
    # Drop the free-model cache so the next /models call re-fetches.
    global _free_cache
    with _lock:
        _free_cache = []
    return new


def providers() -> list:
    """Return the configured provider list (may be empty before startup init)."""
    with _lock:
        return _providers


def get_model() -> str:
    with _lock:
        return _current_model


def set_model(model: str) -> str:
    global _current_model
    with _lock:
        _current_model = model
        return _current_model


def _fetch_free() -> list[dict]:
    """Free, tool-capable models across every configured provider."""
    out: list[dict] = []
    for p in _providers:
        if p.name == "openrouter" and p.api_key and p.api_key != "YOUR_KEY_HERE":
            for m in provider_mod.list_free_openrouter_models():
                out.append({**m, "provider": "openrouter", "id": f"openrouter|{m['id']}"})
        elif p.models:
            for mid in p.models:
                out.append(
                    {
                        "id": f"{p.name}|{mid}",
                        "name": f"{mid} ({p.name})",
                        "context_length": None,
                        "provider": p.name,
                    }
                )
    out.sort(key=lambda x: (x.get("name") or "").lower())
    return out


def free_models(refresh: bool = False) -> list[dict]:
    global _free_cache
    with _lock:
        if refresh or not _free_cache:
            fetched = _fetch_free()
            if fetched:
                _free_cache = fetched
        return _free_cache


def next_free_model(exclude: set[str]) -> str | None:
    """Pick a free, scoped model id not in ``exclude`` (for auto-fallback)."""
    for m in free_models():
        if m.get("id") not in exclude:
            return m["id"]
    return None


def rotate_provider(exclude_scoped: set[str]) -> str | None:
    """Rotate to the next provider and return its first scoped model id."""
    if not _providers:
        return None
    out = None
    for _ in range(max(1, len(_providers))):
        out = next_free_model(exclude_scoped)
        if out:
            return out
    return out
