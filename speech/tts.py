"""Speech layer facade.

Supports:
  * Kokoro-82M ONNX TTS (`kokoro-voice`) — natural, "alive" voice (primary).
  * Piper ONNX TTS (`nira-voice`) — robotic fallback if Kokoro is missing.
  * Browser Web Speech API — last-resort client fallback (Chrome/Edge).

The Assistant never does voice; this layer translates audio <-> text.
"""
from __future__ import annotations

from pathlib import Path

# Primary: Kokoro (natural voice).
try:
    from . import tts_kokoro as _kokoro
except ImportError:
    _kokoro = None

# Fallback: Piper (nira-voice).
try:
    from .tts_onnx import speak as _onnx_speak, SAMPLE_RATE as ONNX_SAMPLE_RATE
except ImportError:
    _onnx_speak = None
    ONNX_SAMPLE_RATE = 22050


def speak_onnx(text: str, scales: list[float] | None = None) -> bytes | None:
    """Server-side TTS: return WAV bytes. Kokoro first, Piper fallback.

    Returns None only if no engine can produce audio.
    """
    # Prefer Kokoro for the natural voice.
    if _kokoro is not None and _kokoro.available():
        wav = _kokoro.speak(text)
        if wav:
            return wav
    # Fallback to Piper.
    if _onnx_speak is not None:
        return _onnx_speak(text, scales)
    return None


def speak_browser(text: str) -> None:
    """Client-side TTS: speak via browser speechSynthesis.

    This is called from the frontend JavaScript, not from Python.
    """
    # This function is a placeholder to document the interface.
    # Real implementation lives in ui/src/hooks/useVoice.js
    pass
