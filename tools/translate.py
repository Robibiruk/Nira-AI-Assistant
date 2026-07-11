"""Translate tool: DeepL (preferred) with a Google fallback.

Reads the DeepL key from config/tool_keys.json (saved via Settings → Tool
Connections). Falls back to Google Translate (same key store) when DeepL is
unavailable. The model should call this instead of translating by hand.
"""
from __future__ import annotations

import httpx

from ._keys import get_tool_key
from .base import Tool

_DEEPL_URL = "https://api-free.deepl.com/v2/translate"
_GOOGLE_URL = "https://translation.googleapis.com/language/translate/v2"


class TranslateTool(Tool):
    name = "translate"
    description = (
        "Translate text between languages using DeepL (or Google Translate). "
        "Use when the user wants text translated. Never translate by hand — "
        "call this tool. Input can be 'text|target_lang' or a JSON-ish string."
    )
    parameters = {
        "text": {"type": "string", "description": "The text to translate."},
        "target": {
            "type": "string",
            "description": "Target language code, e.g. 'ES', 'FR', 'AM' (Amharic). Default 'EN'.",
        },
        "source": {
            "type": "string",
            "description": "Optional source language code. Leave blank for auto-detect.",
        },
    }
    required = ["text"]

    def run(self, text: str, target: str = "EN", source: str = "") -> str:
        text = (text or "").strip()
        if not text:
            return "Nothing to translate."
        target = (target or "EN").strip().upper()

        key = get_tool_key("deepl")
        if key:
            try:
                params = {"auth_key": key, "text": text, "target_lang": target}
                if source:
                    params["source_lang"] = source.strip().upper()
                resp = httpx.post(_DEEPL_URL, data=params, timeout=20)
                resp.raise_for_status()
                out = resp.json()
                translations = out.get("translations") or []
                if translations:
                    return translations[0].get("text", "")
            except httpx.HTTPError:
                pass  # fall through to Google

        gkey = get_tool_key("google") or get_tool_key("translate")
        if gkey:
            try:
                resp = httpx.post(
                    _GOOGLE_URL,
                    params={"key": gkey},
                    json={
                        "q": text,
                        "target": target.lower(),
                        "format": "text",
                        **({"source": source.lower()} if source else {}),
                    },
                    timeout=20,
                )
                resp.raise_for_status()
                out = resp.json()
                res = out.get("data", {}).get("translations", [])
                if res:
                    return res[0].get("translatedText", "")
            except httpx.HTTPError as exc:
                return f"Translation failed (network): {exc}"

        return (
            "Translation needs a DeepL or Google key. Add one in Settings → "
            "Tool Connections (name: deepl or google)."
        )


translate_tool = TranslateTool()
