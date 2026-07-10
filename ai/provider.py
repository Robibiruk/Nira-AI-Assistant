"""Unified, multi-provider LLM client with automatic fallback on rate limits.

Each provider exposes an OpenAI-compatible ``/v1/chat/completions`` endpoint and
is keyed independently (OpenRouter, Groq, Together, DeepSeek, Mistral, GitHub
Models, …). When one provider returns a limit error (429) or is exhausted, the
client rotates to the next configured provider — so a single OpenRouter daily
cap no longer takes NIRA offline.

Model ids are namespaced as ``"provider|model"`` (e.g. ``"groq|llama-3.3-70b-
versatile"``) so the UI and runtime can address any model on any provider.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx

from loguru import logger

# Status codes that mean "this provider/quota is exhausted — try another".
LIMIT_STATUS = {401, 402, 404, 429}

OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models"


def list_free_openrouter_models(timeout: float = 20.0) -> list[dict[str, Any]]:
    """Free, tool-capable OpenRouter models (id/name/context_length). No key needed."""
    try:
        with httpx.Client(timeout=timeout) as client:
            resp = client.get(OPENROUTER_MODELS_URL, headers={"User-Agent": "NIRA"})
        resp.raise_for_status()
        data = resp.json().get("data", [])
    except (httpx.HTTPError, ValueError):
        return []

    out: list[dict[str, Any]] = []
    for m in data:
        pricing = m.get("pricing", {}) or {}
        try:
            prompt_free = float(pricing.get("prompt", "1")) == 0.0
        except (TypeError, ValueError):
            prompt_free = False
        if not prompt_free:
            continue
        if "tools" not in (m.get("supported_parameters") or []):
            continue
        out.append(
            {
                "id": m.get("id"),
                "name": m.get("name", m.get("id")),
                "context_length": m.get("context_length"),
            }
        )
    out.sort(key=lambda x: (x["name"] or "").lower())
    return out


class ProviderError(RuntimeError):
    """Raised when no configured provider can fulfil a request."""

    def __init__(self, message: str, status_code: int | None = None, provider: str | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.provider = provider

    @property
    def is_limit(self) -> bool:
        return self.status_code in LIMIT_STATUS


@dataclass
class Provider:
    name: str
    base_url: str
    api_key: str
    models: list[str] | None = None  # None => discovered lazily (OpenRouter)
    referer: str = "https://github.com/nira"

    def headers(self) -> dict[str, str]:
        h = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        if self.name == "openrouter":
            h["HTTP-Referer"] = self.referer
            h["X-Title"] = "NIRA"
        return h


class MultiProviderClient:
    """Tries providers in order, rotating on limit errors."""

    def __init__(self, providers: list[Provider], model: str = "", temperature: float = 0.7, timeout: float = 60.0) -> None:
        self.providers = providers
        self.temperature = temperature
        self.timeout = timeout
        self._idx = 0
        self.model = model or self._default_model()

    def _default_model(self) -> str:
        if not self.providers:
            return ""
        p = self.providers[0]
        mid = self._first_model(p)
        return f"{p.name}|{mid}" if mid else ""

    def _first_model(self, p: Provider) -> str:
        if p.models:
            return p.models[0]
        # OpenRouter-style lazy discovery is skipped here (network) — its free
        # models are fetched on demand via runtime.free_models(refresh=True)
        # when the UI requests /models?refresh=1.
        return ""

    def _resolve(self, scoped: str) -> tuple[Provider, str]:
        name, _, mid = scoped.partition("|")
        for p in self.providers:
            if p.name == name:
                return p, mid
        # Fall back to the current provider pointer.
        p = self.providers[self._idx] if self.providers else None
        if p is None:
            raise ProviderError("No LLM providers configured.")
        return p, scoped

    def next(self) -> str | None:
        """Rotate to the next provider and return its first model id."""
        if not self.providers:
            return None
        self._idx = (self._idx + 1) % len(self.providers)
        p = self.providers[self._idx]
        mid = self._first_model(p)
        self.model = f"{p.name}|{mid}" if mid else ""
        return self.model or None

    @property
    def provider_name(self) -> str:
        name, _, _ = self.model.partition("|")
        return name

    def chat(self, messages: list[dict[str, Any]], tools: list[dict] | None = None) -> dict[str, Any]:
        if not self.providers:
            raise ProviderError(
                "No LLM providers configured. Set at least one provider API "
                "key (e.g. OPENROUTER_API_KEY) in your .env file."
            )
        p, mid = self._resolve(self.model)
        payload: dict[str, Any] = {
            "model": mid,
            "messages": messages,
            "temperature": self.temperature,
        }
        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = "auto"

        url = p.base_url.rstrip("/") + "/chat/completions"
        try:
            with httpx.Client(timeout=self.timeout) as client:
                resp = client.post(url, json=payload, headers=p.headers())
        except httpx.HTTPError as exc:
            raise ProviderError(f"Network error ({p.name}): {exc}", provider=p.name) from exc

        if resp.status_code != 200:
            raise ProviderError(
                f"{p.name} {resp.status_code}: {resp.text[:300]}",
                status_code=resp.status_code,
                provider=p.name,
            )

        data = resp.json()
        msg = data["choices"][0]["message"]
        return {
            "content": msg.get("content") or "",
            "tool_calls": msg.get("tool_calls") or [],
        }
