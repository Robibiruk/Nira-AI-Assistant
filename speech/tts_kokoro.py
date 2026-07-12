"""Kokoro-82M ONNX TTS — a far more natural, "alive" voice than Piper.

Local, CPU-friendly, no API key. Produces 24 kHz audio which we encode as
browser-safe 16-bit PCM WAV. Default voice is a British male (bm_george) to
match the JARVIS butler persona.

Model files (place in kokoro-voice/):
  * kokoro-v1.0.onnx  (~325 MB)
  * voices-v1.0.bin   (~28 MB)
Download from:
  https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0
"""
from __future__ import annotations

import io
import os
import struct
import wave
from pathlib import Path
import threading

import numpy as np

MODEL_DIR = Path(__file__).resolve().parent.parent / "kokoro-voice"
ONNX_PATH = MODEL_DIR / "kokoro-v1.0.onnx"
VOICES_PATH = MODEL_DIR / "voices-v1.0.bin"

# JARVIS persona: British male. Override via JARVIS_KOKORO_VOICE.
DEFAULT_VOICE = os.environ.get("JARVIS_KOKORO_VOICE", "bm_george")
DEFAULT_LANG = os.environ.get("JARVIS_KOKORO_LANG", "en-gb")
DEFAULT_SPEED = float(os.environ.get("JARVIS_KOKORO_SPEED", "1.0"))

# Guard the lazy load so concurrent /speak requests can't instantiate the
# 325MB Kokoro model twice (that second copy is what blows the 512MB
# Render free-tier ceiling and triggers an OOM kill).
_load_lock = threading.Lock()
_kokoro = None


def available() -> bool:
    return ONNX_PATH.exists() and VOICES_PATH.exists()


def _ensure_loaded():
    global _kokoro
    if _kokoro is not None:
        return
    if not available():
        raise FileNotFoundError(
            f"Kokoro model files not found in {MODEL_DIR}. "
            "Expected kokoro-v1.0.onnx and voices-v1.0.bin."
        )
    # Serialize model construction; only the first caller builds it.
    with _load_lock:
        if _kokoro is not None:
            return
        from kokoro_onnx import Kokoro

        # Cap ONNX threads so a single session uses less working RAM —
        # important on the 512MB Render free tier.
        try:
            import onnxruntime as ort

            so = ort.SessionOptions()
            so.intra_op_num_threads = 2
            so.inter_op_num_threads = 1
            _kokoro = Kokoro(str(ONNX_PATH), str(VOICES_PATH), session_options=so)
        except TypeError:
            # Older kokoro_onnx doesn't accept session_options; load plain.
            _kokoro = Kokoro(str(ONNX_PATH), str(VOICES_PATH))


def _pcm16_wav(samples: np.ndarray, sample_rate: int) -> bytes:
    """Encode float32 [-1,1] mono samples as 16-bit PCM WAV bytes."""
    if samples.size == 0:
        samples = np.zeros((1,), dtype=np.float32)
    pcm = (np.clip(samples, -1.0, 1.0) * 32767.0).astype("<i2").tobytes()
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        w.writeframes(pcm)
    return buf.getvalue()


def text_to_wav_bytes(text: str, voice: str | None = None,
                      speed: float | None = None, lang: str | None = None) -> bytes:
    """Convert text to browser-safe 16-bit PCM WAV bytes via Kokoro."""
    _ensure_loaded()
    samples, sr = _kokoro.create(
        text,
        voice=voice or DEFAULT_VOICE,
        speed=speed if speed is not None else DEFAULT_SPEED,
        lang=lang or DEFAULT_LANG,
    )
    return _pcm16_wav(np.asarray(samples, dtype=np.float32), sr)


def speak(text: str, voice: str | None = None, speed: float | None = None,
          lang: str | None = None) -> bytes | None:
    """Return WAV bytes, or None if Kokoro/model unavailable."""
    clean = (text or "").strip()
    if not clean:
        return None
    try:
        return text_to_wav_bytes(clean, voice=voice, speed=speed, lang=lang)
    except Exception:
        return None
