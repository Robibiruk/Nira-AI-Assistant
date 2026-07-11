"""
The Assistant: JARVIS's brain.

Responsibilities:
  * Hold the conversation for a session.
  * Build the message list (system prompt + remembered prefs + history + user).
  * Call the AI client, executing any tool calls it requests in a loop.
  * Persist the exchange to memory.

The Assistant owns *orchestration*. It knows nothing about HTTP, OpenRouter's
wire format, or how each tool works — those live in their own modules.
"""
from __future__ import annotations

import json
from typing import Any, Iterator

from loguru import logger

from ai.provider import MultiProviderClient, ProviderError
from config import TEMPERATURE
from core import runtime
from core.memory import Memory
from core.prompts import SYSTEM_PROMPT
from core.router import execute, get_schemas

MAX_TOOL_STEPS = 5

# Map Quick-Action feature ids -> the tool the model should prefer.
_FEATURE_TOOLS = {
    "calculator": "calculate (exact math via Python — never compute by hand)",
    "translate": "translate (DeepL/Google — never translate by hand)",
    "weather": "get_weather",
    "wikipedia": "wikipedia",
    "youtube": "youtube_search",
    "spotify": "spotify",
    "google": "web_search",
    "github": "github_search",
    "arxiv": "arxiv_search",
    "pubmed": "pubmed_search",
    "reddit": "reddit_search",
    "x": "social_search",
    "browser": "tavily_search (live web search — use for current info/questions)",
    "screenshot": "take_screenshot",
}


def _enabled_feature_prompt() -> str:
    """Build a system hint listing user-enabled feature tools, if any."""
    import json
    from pathlib import Path

    p = Path(__file__).resolve().parent.parent / "config" / "features.json"
    try:
        data = json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}
    except (ValueError, OSError):
        return ""
    on = [_FEATURE_TOOLS[k] for k, v in data.items() if v and k in _FEATURE_TOOLS]
    if not on:
        return ""
    return (
        "The user has enabled these tools — strongly prefer calling them "
        "instead of answering from your own knowledge: " + "; ".join(on) + "."
    )


class Assistant:
    def __init__(self, session_id: str = "default") -> None:
        self.session_id = session_id
        self.memory = Memory()
        self.memory.ensure_session(session_id)
        self.client = MultiProviderClient(
            runtime.providers(), runtime.get_model(), TEMPERATURE
        )

    def _auto_title(self, user_text: str) -> str:
        """Derive a concise session title from the first user message."""
        t = user_text.strip().replace("\n", " ")
        return (t[:80] + "…") if len(t) > 80 else t or "New chat"

    def _build_messages(self, user_text: str) -> list[dict[str, Any]]:
        messages: list[dict[str, Any]] = [
            {"role": "system", "content": SYSTEM_PROMPT}
        ]
        enabled = _enabled_feature_prompt()
        if enabled:
            messages.append({"role": "system", "content": enabled})
        name = self.memory.get_pref("name")
        if name:
            messages.append(
                {"role": "system", "content": f"The user's name is {name}."}
            )
        messages.extend(self.memory.get_history(self.session_id))
        messages.append({"role": "user", "content": user_text})
        return messages

    def ask(self, user_text: str) -> str:
        try:
            self.memory.save_message(self.session_id, "user", user_text)
            # Auto-title the session from its first user message only.
            if len(self.memory.get_history(self.session_id, limit=1)) <= 1:
                self.memory.rename_session(self.session_id, self._auto_title(user_text))
            self.memory.touch_session(self.session_id)
            messages = self._build_messages(user_text)
            schemas = get_schemas()
            reply = ""
            for ev in self._run_loop_stream(messages, schemas):
                if ev.get("type") == "final":
                    reply = ev["content"]
            self.memory.save_message(self.session_id, "assistant", reply)

            # Lightweight preference memory: learn the user's name.
            lowered = user_text.lower()
            if lowered.startswith("my name is "):
                self.memory.set_pref("name", user_text.split("is ", 1)[1].strip())
            return reply or "(no response)"
        except ProviderError as exc:
            return f"[NIRA error] {exc}"
        except Exception:
            logger.exception("Assistant failure")
            return "Something went wrong while processing that request."

    def _model_call(
        self, messages: list[dict[str, Any]], schemas: list[dict], tried: set[str]
    ) -> dict[str, Any]:
        """One model call, with automatic provider rotation on limit errors.

        On a limit error (401/402/404/429) rotates to the next provider (and
        its first free model), emits a ``model_switch`` event, and retries.
        Re-raises if no fallback remains.
        """
        try:
            return self.client.chat(messages, tools=schemas)
        except ProviderError as exc:
            if not exc.is_limit:
                raise
            tried.add(self.client.model)
            candidate = runtime.rotate_provider(tried)
            if candidate is None:
                raise
            logger.warning(
                f"Model {self.client.model} hit a limit; switching to {candidate}"
            )
            self.client.model = candidate
            runtime.set_model(candidate)
            self._switch = {
                "type": "model_switch",
                "from": tried.copy(),
                "to": candidate,
            }
            return self.client.chat(messages, tools=schemas)

    def _run_loop_stream(
        self, messages: list[dict[str, Any]], schemas: list[dict]
    ) -> Iterator[dict[str, Any]]:
        """Yield state/tool events; stream reply text as it is produced.

        When the model does NOT request a tool (the common case), we stream
        its tokens via chat_stream() and emit incremental ``text`` events so
        the UI can speak sentence-by-sentence as words arrive — dramatically
        cutting perceived voice latency. When tool calls ARE requested, we
        fall back to the non-streaming chat() so tool parsing stays reliable.
        """
        tried: set[str] = set()
        for _ in range(MAX_TOOL_STEPS):
            self._switch = None
            try:
                # Tool-calling path: needs the full structured response, so
                # use the non-streaming call and parse tool_calls.
                result = self._model_call(messages, schemas, tried)
            except ProviderError as exc:
                yield {"type": "error", "message": str(exc)}
                return
            if self._switch:
                yield self._switch

            content = result["content"]
            tool_calls = result["tool_calls"]

            if not tool_calls:
                # No tools requested -> stream tokens for low-latency TTS.
                full: list[str] = []
                toolcall_seen = False
                for piece in self.client.chat_stream(messages, tools=schemas):
                    if isinstance(piece, dict) and piece.get("_toolcall"):
                        toolcall_seen = True
                        break
                    full.append(piece)
                    yield {"type": "text", "content": piece}
                if toolcall_seen:
                    # Model actually wanted a tool — re-run this step with the
                    # non-streaming call so tool_calls parse correctly.
                    result = self._model_call(messages, schemas, tried)
                    content = result["content"]
                    tool_calls = result["tool_calls"]
                else:
                    final_text = "".join(full).strip() or "(no response)"
                    yield {"type": "final", "content": final_text}
                    return

            assistant_msg: dict[str, Any] = {
                "role": "assistant",
                "content": content or None,
                "tool_calls": [
                    {
                        "id": tc.get("id"),
                        "type": "function",
                        "function": {
                            "name": tc["function"]["name"],
                            "arguments": tc["function"]["arguments"],
                        },
                    }
                    for tc in tool_calls
                ],
            }
            messages.append(assistant_msg)

            for tc in tool_calls:
                fn = tc["function"]
                name = fn["name"]
                try:
                    args = json.loads(fn.get("arguments") or "{}")
                except json.JSONDecodeError:
                    args = {}
                logger.info(f"Tool call: {name}({args})")
                yield {"type": "state", "state": "executing", "tool": name}
                output = execute(name, args)
                yield {"type": "tool_result", "tool": name, "output": output}
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tc.get("id"),
                        "content": output,
                    }
                )

        yield {
            "type": "final",
            "content": (
                "I reached the tool-call limit while working on that. "
                "Here is what I have so far."
            ),
        }

    def stream(self, user_text: str):
        """Yield SSE-ready event dicts as the assistant works.

        Events: meta, state (thinking|executing|speaking|idle|error),
        model_switch, tool_result, message, error.
        """
        try:
            self.memory.save_message(self.session_id, "user", user_text)
            # Auto-title the session from its first user message only.
            if len(self.memory.get_history(self.session_id, limit=1)) <= 1:
                self.memory.rename_session(self.session_id, self._auto_title(user_text))
            self.memory.touch_session(self.session_id)
            messages = self._build_messages(user_text)
            schemas = get_schemas()

            yield {
                "type": "meta",
                "model": self.client.model,
                "session": self.session_id,
            }
            yield {"type": "state", "state": "thinking"}

            final = ""
            speaking_started = False
            for ev in self._run_loop_stream(messages, schemas):
                if ev.get("type") == "final":
                    final = ev["content"]
                if ev.get("type") == "text" and not speaking_started:
                    # First token arrived — the user should hear speech soon.
                    speaking_started = True
                    yield {"type": "state", "state": "speaking"}
                yield ev

            if final:
                self.memory.save_message(self.session_id, "assistant", final)
                lowered = user_text.lower()
                if lowered.startswith("my name is "):
                    self.memory.set_pref(
                        "name", user_text.split("is ", 1)[1].strip()
                    )

            if not speaking_started:
                yield {"type": "state", "state": "speaking"}
            if final:
                yield {"type": "message", "content": final}
            yield {"type": "state", "state": "idle"}
        except ProviderError as exc:
            yield {"type": "error", "message": str(exc)}
            yield {"type": "state", "state": "error"}
        except Exception:
            logger.exception("Assistant stream failure")
            yield {
                "type": "error",
                "message": "Something went wrong while processing that request.",
            }
            yield {"type": "state", "state": "error"}
