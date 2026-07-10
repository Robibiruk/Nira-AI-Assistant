"""
OpenRouter client.

The only job of this module: send messages (+ optional tool schemas) to
OpenRouter and return the model's reply. It is OpenAI-compatible
(``/v1/chat/completions``), so the rest of NIRA never learns which model
is behind it.

Tool calling is left to the caller (``core/assistant.py``): this client
returns whatever the model produced, including ``tool_calls`` if any.
"""
from __future__ import annotations

import json
from typing import Any

import httpx

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models"

# Status codes that mean "this model/quota is exhausted — try another model".
LIMIT_STATUS = {402, 404, 429}


class OpenRouterError(RuntimeError):
    """Raised when OpenRouter cannot fulfil a request."""

    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code

    @property
    def is_limit(self) -> bool:
        """True when the error suggests switching to a different free model."""
        return self.status_code in LIMIT_STATUS


def list_free_models(timeout: float = 20.0) -> list[dict[str, Any]]:
    """Return free, tool-capable models currently offered by OpenRouter.

    Each item: {"id", "name", "context_length"}. No API key required.
    Sorted by name. Returns [] on any network/parse error (caller decides).
    """
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


class OpenRouterClient:
    def __init__(
        self,
        api_key: str,
        model: str,
        temperature: float = 0.7,
        timeout: float = 60.0,
    ) -> None:
        # Key is validated lazily in chat() so construction never fails.
        self.api_key = api_key or ""
        self.model = model
        self.temperature = temperature
        self.timeout = timeout

    def _ensure_key(self) -> None:
        if not self.api_key or self.api_key.strip() == "" or self.api_key == "YOUR_KEY_HERE":
            raise OpenRouterError(
                "OpenRouter API key not configured. Set the OPENROUTER_API_KEY "
                "environment variable or set openrouter.api_key in config/settings.yaml."
            )

    def chat(
        self, messages: list[dict[str, Any]], tools: list[dict[str, Any]] | None = None
    ) -> dict[str, Any]:
        """Return ``{"content": str, "tool_calls": list}`` from the model."""
        self._ensure_key()

        payload: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": self.temperature,
        }
        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = "auto"

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/nira",
            "X-Title": "NIRA",
        }

        try:
            with httpx.Client(timeout=self.timeout) as client:
                resp = client.post(OPENROUTER_URL, json=payload, headers=headers)
        except httpx.HTTPError as exc:
            raise OpenRouterError(f"Network error contacting OpenRouter: {exc}") from exc

        if resp.status_code != 200:
            raise OpenRouterError(
                f"OpenRouter {resp.status_code}: {resp.text[:300]}",
                status_code=resp.status_code,
            )

        data = resp.json()
        msg = data["choices"][0]["message"]
        content = msg.get("content") or ""
        tool_calls = msg.get("tool_calls") or []
        return {"content": content, "tool_calls": tool_calls}
