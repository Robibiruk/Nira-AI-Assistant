import { useCallback, useEffect, useRef, useState } from 'react'

// Free, in-browser speech: SpeechRecognition (STT) + speechSynthesis (TTS).
// No API key, no downloads — uses the browser's built-in engines (Chrome/Edge).
// The model never does voice; this layer translates audio <-> text around it.

// Shared: render text with the server-side NIRA voice (nira-voice ONNX
// model at /speak) and play it. Used by the greeting flows AND useVoice.speak
// so EVERY spoken line uses NIRA — never the browser's default voice.
export async function speakNira(text) {
  if (typeof window === 'undefined') return
  const clean = String(text).replace(/[*`_#]/g, '').trim()
  if (!clean) return
  try {
    const res = await fetch('/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: clean }),
    })
    const ct = res.headers.get('content-type') || ''
    if (res.ok && ct.includes('audio')) {
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audio.onended = () => URL.revokeObjectURL(url)
      audio.onerror = () => URL.revokeObjectURL(url)
      await audio.play()
      return true
    }
  } catch {
    /* fall through */
  }
  return false
}

function getRecognitionCtor() {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

export function useVoice({ enabled = false, onTranscript } = {}) {
  const [supported, setSupported] = useState(false)
  const [micActive, setMicActive] = useState(false)
  const recRef = useRef(null)

  // Keep latest callbacks/flags without re-creating the recognizer.
  const transcriptCb = useRef(onTranscript)
  transcriptCb.current = onTranscript
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  useEffect(() => {
    const Ctor = getRecognitionCtor()
    if (!Ctor) return
    setSupported(true)
    const rec = new Ctor()
    rec.continuous = false
    rec.interimResults = false
    rec.lang = 'en-US'
    rec.onresult = (e) => {
      const text = e.results?.[0]?.[0]?.transcript || ''
      if (text) transcriptCb.current?.(text)
    }
    rec.onend = () => setMicActive(false)
    rec.onerror = () => setMicActive(false)
    recRef.current = rec
    return () => {
      try {
        rec.abort?.()
      } catch {
        /* ignore */
      }
    }
  }, [])

  const startMic = useCallback(() => {
    const rec = recRef.current
    if (!rec) return
    try {
      rec.start()
      setMicActive(true)
    } catch {
      /* already started */
    }
  }, [])

  const stopMic = useCallback(() => {
    try {
      recRef.current?.stop()
    } catch {
      /* ignore */
    }
    setMicActive(false)
  }, [])

  const speak = useCallback(async (text) => {
    if (!enabledRef.current || typeof window === 'undefined') return
    await speakNira(text)
  }, [])

  return { supported, micActive, startMic, stopMic, speak }
}
