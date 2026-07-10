"""ONNX-based TTS using the nira-high model (Piper-compatible).

Pipeline:
  text → phonemize (via phoneme_id_map from nira-high.onnx.json) →
  ONNX inference → float32 audio tensor → WAV bytes.

The ONNX model expects:
  input:        [batch, phonemes]    int64  (phoneme ids)
  input_lengths: [batch]             int64  (length of each sequence)
  scales:        [3]                  float (pitch, rate, volume?)

Output:
  output:        [batch, 1, 1, N]    float  (audio samples)

Sample rate is typically 22050 Hz (Piper default).
"""
from __future__ import annotations

import json
import struct
from pathlib import Path

import numpy as np

# Model paths (relative to this module or absolute override via NIRA_VOICE_DIR).
MODEL_DIR = Path(__file__).resolve().parent.parent / "nira-voice"
ONNX_PATH = MODEL_DIR / "nira-high.onnx"
JSON_PATH = MODEL_DIR / "nira-high.onnx.json"

# Default audio params for Piper models.
SAMPLE_RATE = 22050
BPS = 32  # bits per sample (float32)

# Global ONNX runtime session (lazy-loaded).
_session = None
_tokenizer = None


def _ensure_loaded():
    global _session, _tokenizer
    if _session is not None:
        return
    import onnxruntime as ort

    if not ONNX_PATH.exists():
        raise FileNotFoundError(
            f"ONNX model not found at {ONNX_PATH}. "
            "Place nira-high.onnx and nira-high.onnx.json in nira-voice/."
        )
    _session = ort.InferenceSession(str(ONNX_PATH))
    with open(JSON_PATH, "r", encoding="utf-8") as f:
        _tokenizer = json.load(f)


_phonemizer = None


def _get_phonemizer():
    global _phonemizer
    if _phonemizer is None:
        from piper.phonemize_espeak import EspeakPhonemizer
        _phonemizer = EspeakPhonemizer()
    return _phonemizer


def text_to_phonemes(text: str) -> list[int]:
    """Convert text to Piper phoneme ids.

    Piper voices are trained on eSpeak-NG IPA phonemes, NOT raw spelling. We
    phonemize with the model's configured eSpeak voice, then encode using the
    Piper convention: BOS(^) + pad(_) between every phoneme + EOS($), with each
    id separated by the pad token.
    """
    _ensure_loaded()
    pim = _tokenizer["phoneme_id_map"]
    voice = (_tokenizer.get("espeak", {}) or {}).get("voice", "en-us")

    # BOS / pad / EOS ids (Piper defaults; read from map when available).
    pad = pim.get("_", [0])[0]
    bos = pim.get("^", [1])[0]
    eos = pim.get("$", [2])[0]

    phonemizer = _get_phonemizer()
    try:
        sentences = phonemizer.phonemize(voice, text)
    except Exception:
        sentences = phonemizer.phonemize("en-us", text)

    ids: list[int] = [bos, pad]
    for sentence in sentences:
        for phoneme in sentence:
            entry = pim.get(phoneme)
            if entry is None:
                continue
            for pid in (entry if isinstance(entry, list) else [entry]):
                ids.append(pid)
                ids.append(pad)
    ids.append(eos)
    return ids


def _infer(phoneme_ids: list[int], scales: list[float] | None = None) -> np.ndarray:
    """Run ONNX inference and return the audio numpy array."""
    _ensure_loaded()
    if not phoneme_ids:
        return np.zeros((0,), dtype=np.float32)

    # Shape: [batch, phonemes]
    input_tensor = np.array([phoneme_ids], dtype=np.int64)
    input_lengths = np.array([len(phoneme_ids)], dtype=np.int64)
    if scales is None:
        # Use the model's own inference params from the JSON config when present
        # (noise_scale, length_scale, noise_w) — Piper's [noise, length, noise_w]
        # scale order. Falls back to neutral defaults.
        _ensure_loaded()
        inf = (_tokenizer or {}).get("inference", {}) if _tokenizer else {}
        scales = [
            float(inf.get("noise_scale", 0.667)),
            float(inf.get("length_scale", 1.0)),
            float(inf.get("noise_w", 0.8)),
        ]
    scales_tensor = np.array(scales, dtype=np.float32)

    outputs = _session.run(
        None,
        {
            "input": input_tensor,
            "input_lengths": input_lengths,
            "scales": scales_tensor,
        },
    )
    audio = outputs[0]  # [batch, 1, 1, N] → squeeze to [N]
    return audio.squeeze().astype(np.float32)


def _wav_header(n_samples: int, n_channels: int = 1, sample_rate: int = SAMPLE_RATE, bits_per_sample: int = 16) -> bytes:
    """Build a standard 16-bit PCM WAV header (WAVE_FORMAT_PCM).

    16-bit PCM is universally decodable by browser <audio>/Audio(), unlike
    32-bit float WAVE_FORMAT_EXTENSIBLE which many browsers reject (silent
    playback failure).
    """
    byte_rate = sample_rate * n_channels * (bits_per_sample // 8)
    block_align = n_channels * (bits_per_sample // 8)
    data_size = n_samples * block_align

    header = b"RIFF"
    header += struct.pack("<I", 36 + data_size)  # RIFF chunk size
    header += b"WAVE"
    # fmt chunk (16 bytes, PCM)
    header += b"fmt "
    header += struct.pack("<I", 16)      # subchunk size
    header += struct.pack("<H", 1)       # audio format = PCM
    header += struct.pack("<H", n_channels)
    header += struct.pack("<I", sample_rate)
    header += struct.pack("<I", byte_rate)
    header += struct.pack("<H", block_align)
    header += struct.pack("<H", bits_per_sample)
    # data chunk
    header += b"data"
    header += struct.pack("<I", data_size)
    return header


def _to_pcm16(audio: np.ndarray) -> bytes:
    """Convert float32 [-1,1] audio to little-endian 16-bit PCM bytes."""
    if audio.size == 0:
        return b""
    a = np.clip(audio, -1.0, 1.0)
    return (a * 32767.0).astype("<i2").tobytes()


def text_to_wav_bytes(text: str, scales: list[float] | None = None) -> bytes:
    """Convert text to 16-bit PCM WAV bytes (22050 Hz, mono) — browser-safe."""
    phoneme_ids = text_to_phonemes(text)
    audio = _infer(phoneme_ids, scales)
    pcm = _to_pcm16(audio)
    header = _wav_header(len(audio))
    return header + pcm


def text_to_wav_file(text: str, path: str | Path, scales: list[float] | None = None) -> None:
    """Write text to a WAV file."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(text_to_wav_bytes(text, scales))


def speak(text: str, scales: list[float] | None = None) -> bytes | None:
    """Return WAV bytes for text (serve as audio response).

    This is the main entry point for the server endpoint.
    """
    try:
        return text_to_wav_bytes(text, scales)
    except Exception:
        return None
