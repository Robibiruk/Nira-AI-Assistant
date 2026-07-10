"""
FastAPI entry point for NIRA.

Run with:
    uvicorn app:app --reload

Endpoints:
    GET  /health          -> {"status": "ok"}
    POST /chat            -> {"reply": "..."}             (non-streaming)
    POST /chat/stream     -> SSE stream of state + reply  (for the UI)
    /                    -> the built React UI, if ui/dist exists
"""
from __future__ import annotations

import asyncio
import json
import threading
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from loguru import logger
from pydantic import BaseModel

from speech.tts import speak_onnx
from core import runtime
from core.assistant import Assistant
from core.memory import Memory

BASE_DIR = Path(__file__).resolve().parent

app = FastAPI(title="NIRA", version="0.3.1")


@app.on_event("startup")
def _init_providers() -> None:
    """Build the LLM provider list from env keys and seed the active model."""
    from ai.providers import build_providers
    from ai.provider import MultiProviderClient

    providers = build_providers()
    runtime.set_providers(providers)
    # Seed the active model only if it isn't already a valid scoped id
    # ("provider|model"). Empty/free-style ids get replaced by the first
    # provider's first model so multi-provider fallback always has a start.
    current = runtime.get_model()
    if not current or "|" not in current:
        client = MultiProviderClient(providers, current, 0.7)
        if client.model:
            runtime.set_model(client.model)


class ChatRequest(BaseModel):
    message: str
    session_id: str = "default"


class ChatResponse(BaseModel):
    reply: str


class ModelSelectRequest(BaseModel):
    model: str


class NameRequest(BaseModel):
    name: str
    session_id: str = "default"


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/models")
def models(refresh: bool = False) -> dict:
    """List free, tool-capable models (scoped id/name/context_length) for the UI."""
    free = runtime.free_models(refresh=refresh)
    # Group by provider for a cleaner dropdown.
    providers = sorted({m.get("provider") for m in free if m.get("provider")})
    return {"current": runtime.get_model(), "models": free, "providers": providers}


@app.post("/models/select")
def select_model(req: ModelSelectRequest) -> dict:
    """Switch the active model at runtime. Must be a known free model id."""
    free_ids = {m["id"] for m in runtime.free_models(refresh=False)}
    if req.model not in free_ids:
        raise HTTPException(
            status_code=400,
            detail=f"Model '{req.model}' is not a known free model.",
        )
    runtime.set_model(req.model)
    return {"current": runtime.get_model()}


@app.get("/status")
def status() -> dict:
    """Provider/model capability snapshot for diagnostics (no network)."""
    providers = runtime.providers()
    return {
        "model": runtime.get_model(),
        "providers": [p.name for p in providers],
        "free_model_count": len(runtime.free_models(refresh=False)),
    }


@app.post("/prefs/name")
def set_name(req: NameRequest) -> dict:
    """Persist the user's name so the assistant can greet them personally."""
    name = req.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")
    Memory().set_pref("name", name)
    return {"ok": True, "name": name}


@app.post("/speak")
def speak(req: ChatRequest) -> "FileResponse | dict":
    """Server-side TTS: return WAV audio for the given text.

    Uses the nira-voice ONNX model if available. Returns 404 if the
    model is not installed or TTS failed.
    """
    from fastapi.responses import FileResponse, Response

    wav = speak_onnx(req.message)
    if wav is None:
        return {"error": "TTS not available (install onnxruntime + model files)"}
    return Response(content=wav, media_type="audio/wav")


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
    if not req.message or not req.message.strip():
        raise HTTPException(status_code=400, detail="message is required")
    assistant = Assistant(session_id=req.session_id)
    reply = assistant.ask(req.message)
    return ChatResponse(reply=reply)


@app.post("/chat/stream")
async def chat_stream(req: ChatRequest):
    """Server-Sent Events stream of assistant state + final reply.

    Emits events: meta, state(thinking|executing|speaking|idle|error),
    tool_result, message, error. The React UI uses these to drive the
    AI-core ring so it reflects what the assistant is actually doing.
    """
    if not req.message or not req.message.strip():
        raise HTTPException(status_code=400, detail="message is required")

    assistant = Assistant(session_id=req.session_id)
    loop = asyncio.get_running_loop()
    event_q: "asyncio.Queue" = asyncio.Queue()

    def worker() -> None:
        try:
            for ev in assistant.stream(req.message):
                asyncio.run_coroutine_threadsafe(event_q.put(ev), loop)
        except Exception:  # noqa: BLE001 - never kill the stream silently
            logger.exception("stream worker failed")
        finally:
            asyncio.run_coroutine_threadsafe(event_q.put(None), loop)

    # Run the (blocking, sync) assistant in a thread so the event loop stays free.
    threading.Thread(target=worker, daemon=True).start()

    async def event_source():
        while True:
            ev = await event_q.get()
            if ev is None:
                break
            yield f"data: {json.dumps(ev)}\n\n"

    return StreamingResponse(event_source(), media_type="text/event-stream")


# Serve the built React UI (run `npm run build` in ui/) if it is present.
_dist = BASE_DIR / "ui" / "dist"
if _dist.is_dir():
    app.mount("/", StaticFiles(directory=str(_dist), html=True), name="ui")
