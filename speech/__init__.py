"""Speech layer (STT/TTS).

Browser-based:
  - STT: uses the Web Speech API (SpeechRecognition)
  - TTS: uses the Web Speech API (speechSynthesis)
  These are zero-install, Chrome/Edge only, client-side.

Server-based (optional):
  - TTS: ONNX `nira-voice` model via /speak endpoint
  - Needs onnxruntime + model files in nira-voice/
"""
