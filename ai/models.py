"""OpenRouter model identifiers (free tier).

Only a small curated set is listed; any OpenRouter model id works in
``config/settings.yaml``. Free models come and go, so treat these as examples
and re-verify with ``GET https://openrouter.ai/api/v1/models`` (filter
``pricing.prompt == 0`` and ``tools`` in ``supported_parameters``).
"""
from __future__ import annotations

# Free models verified to support OpenAI-compatible tool calling (2026-07).
FREE_MODELS: dict[str, str] = {
    "llama-3.3-70b": "meta-llama/llama-3.3-70b-instruct:free",
    "gemma-4-31b": "google/gemma-4-31b-it:free",
    "gpt-oss-120b": "openai/gpt-oss-120b:free",
    "qwen3-coder": "qwen/qwen3-coder:free",
    "laguna-m1": "poolside/laguna-m.1:free",
}

DEFAULT_MODEL = "poolside/laguna-m.1:free"
