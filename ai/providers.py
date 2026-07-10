"""Build the LLM provider list from configuration/env secrets.

Providers are tried in the order they appear here. Add a provider simply by
setting its API key in your ``.env`` (or environment). No key → provider is
skipped, so JARVIS runs with whatever you configure.

Supported providers (all OpenAI-compatible ``/v1/chat/completions``):
  * OpenRouter  — OPENROUTER_API_KEY  (free tier, huge model catalogue; its
                  free, tool-capable models are discovered automatically)
  * Groq        — GROQ_API_KEY        (fast, free Llama/Mixtral)
  * Together    — TOGETHER_API_KEY    (free-ish Llama/Qwen/Mixtral)
  * DeepSeek    — DEEPSEEK_API_KEY    (cheap, strong reasoning)
  * Mistral     — MISTRAL_API_KEY     (free Mistral/Ministral tier)
  * GitHub      — GITHUB_TOKEN        (free models via GitHub Marketplace)
"""
from __future__ import annotations

import os

from ai.provider import Provider


def build_providers() -> list[Provider]:
    providers: list[Provider] = []

    def add(name: str, base_url: str, key: str | None, models: list[str] | None = None):
        if key and key.strip() and key != "YOUR_KEY_HERE":
            providers.append(Provider(name=name, base_url=base_url, api_key=key.strip(), models=models))

    openrouter_key = os.getenv("OPENROUTER_API_KEY")
    add(
        "openrouter",
        "https://openrouter.ai/api/v1",
        openrouter_key,
        models=None,  # discovered lazily
    )
    add(
        "groq",
        "https://api.groq.com/openai/v1",
        os.getenv("GROQ_API_KEY"),
        models=[
            "llama-3.3-70b-versatile",
            "llama-3.1-8b-instant",
            "llama3-70b-8192",
        ],
    )
    add(
        "together",
        "https://api.together.xyz/v1",
        os.getenv("TOGETHER_API_KEY"),
        models=[
            "meta-llama/Llama-3.3-70B-Instruct-Turbo",
            "meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo",
            "Qwen/Qwen2.5-72B-Instruct-Turbo",
        ],
    )
    add(
        "deepseek",
        "https://api.deepseek.com/v1",
        os.getenv("DEEPSEEK_API_KEY"),
        models=["deepseek-chat"],
    )
    add(
        "mistral",
        "https://api.mistral.ai/v1",
        os.getenv("MISTRAL_API_KEY"),
        models=["mistral-small-latest", "open-mistral-7b"],
    )
    add(
        "github",
        "https://models.inference.ai.azure.com",
        os.getenv("GITHUB_TOKEN"),
        models=[
            "gpt-4o-mini",
            "Meta-Llama-3.3-70B-Instruct",
            "DeepSeek-V3-0324",
        ],
    )

    return providers
