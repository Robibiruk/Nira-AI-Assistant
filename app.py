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
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from loguru import logger
from pydantic import BaseModel

from speech.tts import speak_onnx
from core import runtime
from core.assistant import Assistant
from core import router as tool_router

BASE_DIR = Path(__file__).resolve().parent

app = FastAPI(title="NIRA", version="0.3.1")

# CORS: allow the deployed Vercel frontend (and local dev) to call this API.
# Locked to known origins so we don't open the API to any site.
_ALLOWED_ORIGINS = [
    "https://nira-ai-assistant.vercel.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    # Conversation history is owned by the CLIENT (Firestore, per anonymous
    # Firebase UID) — the server no longer keeps a shared SQLite store. The
    # client sends the prior turns so the model has context, keeping memory
    # private to each device/user and resetting cleanly when Firestore is empty.
    history: list[dict] = []
    name: str = ""


class ChatResponse(BaseModel):
    reply: str


class ModelSelectRequest(BaseModel):
    model: str


class NameRequest(BaseModel):
    name: str
    session_id: str = "default"


class CustomProvider(BaseModel):
    name: str
    base_url: str
    api_key: str = ""
    models: list[str] = []


class CustomName(BaseModel):
    name: str


class ToolKey(BaseModel):
    """An external-tool API key (Google, GitHub, Spotify, ...)."""
    name: str
    api_key: str = ""
    extra: dict = {}


class FeatureState(BaseModel):
    """Enable/disable a Quick-Action feature (persisted locally)."""
    name: str
    enabled: bool = True


class ToolRunRequest(BaseModel):
    """Run a registered tool directly (no LLM involved)."""
    name: str
    arguments: dict = {}

def tool_keys_path() -> Path:
    return BASE_DIR / "config" / "tool_keys.json"


def _load_tool_keys() -> dict:
    p = tool_keys_path()
    if not p.exists():
        return {}
    try:
        return json.loads(p.read_text(encoding="utf-8")) or {}
    except (ValueError, OSError):
        return {}


def _save_tool_keys(d: dict) -> None:
    p = tool_keys_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(d, indent=2), encoding="utf-8")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/models")
def models(refresh: bool = False) -> dict:
    """List free, tool-capable models (scoped id/name/context_length) for the UI."""
    free = runtime.free_models(refresh=refresh)
    # De-duplicate by id — provider/model ids are already globally scoped as
    # "provider|model", so id alone is the correct uniqueness key. Jan's
    # /v1/models can otherwise return the same id with a differing provider
    # field, which a (provider, id) key would fail to collapse.
    seen = set()
    deduped = []
    for m in free:
        mid = m.get("id")
        if not mid or mid in seen:
            continue
        seen.add(mid)
        deduped.append(m)
    # Group by provider for a cleaner dropdown.
    providers = sorted({m.get("provider") for m in deduped if m.get("provider")})
    return {"current": runtime.get_model(), "models": deduped, "providers": providers}


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


@app.get("/providers")
def providers() -> dict:
    """Which LLM providers are configured (key present) + which are active."""
    from ai.providers import build_providers

    built = build_providers()
    configured = {p.name for p in built}
    return {
        "configured": sorted(configured),
        "active": [p.name for p in runtime.providers()],
    }


@app.get("/providers/custom")
def list_custom() -> dict:
    from ai.providers import _load_custom

    return {"custom": _load_custom()}


@app.post("/providers/custom")
def add_custom(req: "CustomProvider") -> dict:
    """Add (or replace) a custom/local OpenAI-compatible provider.

    Body: {name, base_url, api_key?, models?[]}. Persisted to
    config/custom_providers.json and loaded into the live runtime.
    """
    from ai.providers import _load_custom, save_custom

    name = (req.name or "").strip()
    base = (req.base_url or "").strip()
    if not name or not base:
        raise HTTPException(status_code=400, detail="name and base_url are required")
    items = _load_custom()
    items = [c for c in items if c.get("name") != name]
    items.append(
        {
            "name": name,
            "base_url": base,
            "api_key": (req.api_key or "").strip(),
            "models": [m.strip() for m in (req.models or []) if m.strip()],
        }
    )
    save_custom(items)
    runtime.rebuild_providers()
    return {"ok": True, "name": name, "active": [p.name for p in runtime.providers()]}


@app.delete("/providers/custom")
def delete_custom(req: "CustomName") -> dict:
    """Remove a custom provider by name."""
    from ai.providers import _load_custom, save_custom

    name = req.name or ""
    items = [c for c in _load_custom() if c.get("name") != name]
    save_custom(items)
    runtime.rebuild_providers()
    return {"ok": True, "removed": name}


@app.get("/tools/keys")
def list_tool_keys() -> dict:
    """List configured external-tool keys (values masked for safety)."""
    d = _load_tool_keys()
    out = {}
    for k, v in d.items():
        if isinstance(v, dict):
            has = bool((v.get("api_key") or "").strip())
            out[k] = {
                "configured": has,
                "extra": v.get("extra", {}),
            }
        else:
            out[k] = {"configured": bool(str(v).strip()), "extra": {}}
    return {"keys": out}


@app.post("/tools/keys")
def set_tool_key(req: "ToolKey") -> dict:
    """Save (or replace) an external-tool API key. Persisted to
    config/tool_keys.json (gitignored)."""
    name = req.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")
    d = _load_tool_keys()
    # Preserve extra fields for keys that need more than a single token.
    prev = d.get(name, {}) if isinstance(d.get(name), dict) else {}
    d[name] = {
        "api_key": (req.api_key or "").strip(),
        "extra": {**prev.get("extra", {}), **(req.extra or {})},
    }
    _save_tool_keys(d)
    return {"ok": True, "name": name, "configured": bool(d[name]["api_key"])}


@app.delete("/tools/keys")
def delete_tool_key(req: "CustomName") -> dict:
    """Remove an external-tool API key by name."""
    name = req.name.strip()
    d = _load_tool_keys()
    if name in d:
        del d[name]
        _save_tool_keys(d)
    return {"ok": True, "removed": name}


def features_path() -> Path:
    return BASE_DIR / "config" / "features.json"


def _load_features() -> dict:
    p = features_path()
    if not p.exists():
        return {}
    try:
        return json.loads(p.read_text(encoding="utf-8")) or {}
    except (ValueError, OSError):
        return {}


def _save_features(d: dict) -> None:
    p = features_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(d, indent=2), encoding="utf-8")


@app.get("/features")
def get_features() -> dict:
    """Return the set of enabled Quick-Action features."""
    return _load_features()


@app.post("/features")
def set_feature(req: "FeatureState") -> dict:
    """Enable/disable a Quick-Action feature (persisted locally)."""
    name = (req.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")
    d = _load_features()
    d[name] = bool(req.enabled)
    _save_features(d)
    return {"ok": True, "name": name, "enabled": d[name]}


# NOTE: chat sessions + message history are now owned by the CLIENT and
# stored in Firebase Firestore (per anonymous UID). The server no longer
# keeps a shared SQLite sessions table — these endpoints were removed so
# memory is private per user and resets when Firestore is empty.

@app.post("/tools/run")
def run_tool(req: "ToolRunRequest") -> dict:
    """Execute a registered tool DIRECTLY, without an LLM.

    This is the model-independent execution path: slash commands and the
    command menu call this so tasks still run even when the chosen model is
    down, rate-limited, or too weak to call tools itself.
    """
    name = (req.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="tool name is required")
    if name not in tool_router.REGISTRY:
        raise HTTPException(status_code=404, detail=f"unknown tool: {name}")
    result = tool_router.execute(name, req.arguments or {})
    return {"ok": True, "tool": name, "result": result}


@app.get("/status")
def status() -> dict:
    """Provider/model capability snapshot for diagnostics (no network)."""
    providers = runtime.providers()
    return {
        "model": runtime.get_model(),
        "providers": [p.name for p in providers],
        "free_model_count": len(runtime.free_models(refresh=False)),
    }


@app.get("/desktop")
def desktop() -> dict:
    """Live desktop snapshot: installed apps, open windows, running apps, and
    browser tabs.

    Uses the Windows system-enumeration tools (pywin32/psutil). Returns
    structured lists so the UI can render them and let NIRA act on them —
    a reliable "desktop awareness" view that doesn't depend on screen capture.
    """
    import platform as _platform

    from tools.windows import list_installed_apps, list_windows, list_open_apps, list_chrome_tabs

    plat = _platform.system().lower()
    if plat == "darwin":
        device = "macos"
    elif plat == "linux":
        device = "linux"
    elif plat == "windows":
        device = "windows"
    else:
        device = plat or "unknown"

    return {
        "ok": True,
        "platform": device,
        "installed": list_installed_apps(),
        "windows": list_windows(),
        "apps": list_open_apps(),
        "tabs": list_chrome_tabs(),
    }


class DeviceAppsRequest(BaseModel):
    device: str = "unknown"          # android | ios | windows | macos | linux | web
    apps: list = []                  # list of app names (or {name, ...} dicts)
    source: str = "client"           # how the list was obtained


@app.post("/device/apps")
def device_apps(req: DeviceAppsRequest) -> dict:
    """Receive an app list reported by any client device.

    The Windows desktop tools can only enumerate apps locally. To make
    "list apps / list installed apps" work on Android, iOS, and any
    non-Windows PC, the client reports what it can see (device type + app
    names) and the tools read from this shared store. No local enumeration
    required on the server.
    """
    from core.device_apps import report_apps

    report_apps(req.device, req.apps, req.source)
    return {"ok": True, "device": req.device, "count": len(req.apps or [])}


@app.get("/device/apps")
def device_apps_get() -> dict:
    """Return the latest device-reported app list (diagnostics)."""
    from core.device_apps import get_apps

    return {"ok": True, **get_apps()}


class DesktopActionRequest(BaseModel):
    action: str  # "focus" | "close"
    kind: str  # "window" | "tab"
    title: str = ""
    exe: str = ""
    query: str = ""


@app.post("/desktop/action")
def desktop_action(req: DesktopActionRequest) -> dict:
    """Focus, close, or open a window / tab / installed app."""
    from tools.windows import (
        focus_window,
        close_window,
        focus_browser_tab,
        close_browser_tab,
        open_installed_app,
    )

    a = (req.action or "").lower()
    k = (req.kind or "").lower()
    if k == "installed":
        if a == "open":
            msg = open_installed_app(req.title)
        else:
            raise HTTPException(status_code=400, detail="unknown action")
    elif k == "window":
        if a == "focus":
            msg = focus_window(req.title, req.exe)
        elif a == "close":
            msg = close_window(req.title, req.exe)
        else:
            raise HTTPException(status_code=400, detail="unknown action")
    elif k == "tab":
        q = req.query or req.title
        if a == "focus":
            msg = focus_browser_tab(q)
        elif a == "close":
            msg = close_browser_tab(q)
        else:
            raise HTTPException(status_code=400, detail="unknown action")
    else:
        raise HTTPException(status_code=400, detail="unknown kind")
    return {"ok": True, "message": msg}


@app.post("/prefs/name")
def set_name(req: NameRequest) -> dict:
    """Deprecated: name now lives in Firebase Firestore (anonymous UID).

    Kept as a no-op so old clients don't error; the UI persists the name to
    Firestore instead of the server.
    """
    name = (req.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")
    return {"ok": True, "name": name, "note": "persisted client-side (Firestore)"}


@app.post("/speak")
def speak(req: ChatRequest) -> "Response | dict":
    """Server-side TTS: return WAV audio for the given text.

    Uses Kokoro (natural) with a Piper fallback. Returns a WAV audio response
    when the model weights are present; otherwise a clear error so the client
    can fall back to browser speech synthesis instead of failing silently.
    """
    from fastapi.responses import Response

    if not req.message or not req.message.strip():
        raise HTTPException(status_code=400, detail="message is required")

    # Server-side TTS (large Kokoro/Piper model) was REMOVED to keep the
    # free-tier instance under its 512MB RAM ceiling (a 325MB model + Python
    # OOM-killed the process). NIRA's voice now runs CLIENT-SIDE via
    # ResponsiveVoice ("UK English Male"). This endpoint is kept for
    # compatibility but returns 404 so the client uses its own voice.
    return {
        "error": "Server TTS is disabled. NIRA speaks from the browser "
        "(ResponsiveVoice UK English Male).",
        "client_voice": True,
    }


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
    if not req.message or not req.message.strip():
        raise HTTPException(status_code=400, detail="message is required")
    assistant = Assistant(
        session_id=req.session_id, history=req.history, name=req.name
    )
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

    assistant = Assistant(
        session_id=req.session_id, history=req.history, name=req.name
    )
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


# Serve extracted app icons statically (generated at runtime into ui/public/icons).
_icons = BASE_DIR / "ui" / "public" / "icons"
if _icons.is_dir():
    app.mount("/icons", StaticFiles(directory=str(_icons)), name="icons")

# Serve the built React UI (run `npm run build` in ui/) if it is present.
_dist = BASE_DIR / "ui" / "dist"
if _dist.is_dir():
    app.mount("/", StaticFiles(directory=str(_dist), html=True), name="ui")
