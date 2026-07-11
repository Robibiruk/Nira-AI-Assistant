import { useCallback, useEffect, useRef, useState } from 'react'

// Shared: render text with the server-side NIRA voice (nira-voice ONNX
// model at /speak) and play it. Used by the greeting flows AND useVoice.speak
// so EVERY spoken line uses NIRA — never the browser's default voice.
//
// Only ONE line plays at a time. We track the in-flight server Audio element
// and the browser speech instance, and stop whichever is current before
// starting a new one. To keep latency low, callers stream replies
// sentence-by-sentence via enqueueNira(), which plays them back-to-back
// (no overlap, no per-sentence rebuild) instead of waiting for the whole
// reply to be generated before the first sound.

let _currentAudio = null
let _currentUtterance = null

// Sequential speech queue: streamed sentences play one after another.
let _speechQueue = []
let _speechPlaying = false

function _stopCurrentSpeech() {
  if (_currentAudio) {
    try {
      _currentAudio.pause()
      _currentAudio.onended = null
      _currentAudio.onerror = null
      URL.revokeObjectURL(_currentAudio.src)
    } catch {
      /* ignore */
    }
    _currentAudio = null
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel()
    } catch {
      /* ignore */
    }
  }
  _currentUtterance = null
}

// Cache of pre-fetched audio blobs, keyed by sentence text, so the next
// sentence is already synthesized and ready to play the instant the current
// one ends (removes the inter-sentence round-trip gap).
let _audioCache = new Map()

// Serialized /speak chain. Kokoro runs on a single worker; firing two /speak
// requests at once overloads it and one request fails — and the browser-TTS
// fallback's speechSynthesis.cancel() then KILLS the in-flight utterance,
// dropping words. Serializing every /speak call avoids that entirely.
let _speakChain = Promise.resolve()

function _fetchSpeechBlob(text) {
  _speakChain = _speakChain
    .then(() =>
      fetch('/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      }).then((res) => {
        const ct = res.headers.get('content-type') || ''
        if (!res.ok || !ct.includes('audio')) throw new Error('no audio')
        return res.blob()
      }),
    )
    .catch((e) => {
      // Surface as a thrown value so the caller can fall back to browser TTS
      // for THIS sentence only — without cancelling anything already playing.
      throw e
    })
  return _speakChain
}

function _playBlob(blob) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    _currentAudio = audio
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      if (_currentAudio === audio) {
        URL.revokeObjectURL(url)
        _currentAudio = null
      }
      resolve()
    }
    audio.onended = finish
    audio.onerror = finish
    audio.play().catch(finish)
  })
}

function _playBrowserTTS(text) {
  return new Promise((resolve) => {
    try {
      if (typeof window.speechSynthesis === 'undefined') return resolve()
      // NOTE: do NOT call speechSynthesis.cancel() here — that would abort the
      // currently-playing server utterance and drop words. Speak independently.
      const u = new SpeechSynthesisUtterance(text)
      _currentUtterance = u
      u.rate = 1.02
      u.pitch = 1.0
      u.volume = 1.0
      const voices = window.speechSynthesis.getVoices?.() || []
      const en = voices.find((v) => /en[-_]/i.test(v.lang)) || voices[0]
      if (en) u.voice = en
      u.onend = resolve
      u.onerror = resolve
      _currentUtterance = u
      window.speechSynthesis.speak(u)
    } catch {
      resolve()
    }
  })
}

// Play one sentence: use a pre-fetched blob if available, otherwise fetch it
// (through the serialized chain so we never overload the TTS worker).
function _playText(text) {
  const cached = _audioCache.get(text)
  if (cached) {
    _audioCache.delete(text)
    return _playBlob(cached)
  }
  return _fetchSpeechBlob(text)
    .then((blob) => _playBlob(blob))
    .catch(() => _playBrowserTTS(text))
}

function _advanceQueue() {
  if (_speechPlaying) return
  const next = _speechQueue.shift()
  if (next === undefined) return
  _speechPlaying = true
  // Pre-synthesize the NEXT sentence in parallel (while this one plays) so the
  // hand-off is instant. It runs through the serialized chain but the chain is
  // idle during playback, so there is no overlap with the playing request.
  const upcoming = _speechQueue[0]
  if (upcoming && !_audioCache.has(upcoming)) {
    _fetchSpeechBlob(upcoming)
      .then((blob) => _audioCache.set(upcoming, blob))
      .catch(() => {})
  }
  _playText(next).finally(() => {
    _speechPlaying = false
    _advanceQueue()
  })
}

// Buffer for streamed replies: we accumulate tokens and only hand COMPLETE
// sentences to the TTS queue. Speaking per-word (each token -> /speak ->
// Kokoro synth) produces an audible pause after every word; speaking whole
// sentences keeps NIRA's delivery natural.
let _streamBuffer = ''

// Peel complete sentences (ending in . ! ? optionally followed by whitespace)
// off the front of _streamBuffer; leave any trailing partial in the buffer.
function _drainSentences() {
  const out = []
  const re = /^[\s]*([\s\S]*?[.!?])([\s]+|$)/
  let buf = _streamBuffer
  for (;;) {
    const m = re.exec(buf)
    if (!m) break
    out.push(m[1].trim())
    buf = buf.slice(m[0].length)
  }
  _streamBuffer = buf
  return out
}

// Queue text to be spoken after the current speech finishes.
//  - stream:false  -> speak the whole text as one unit (greetings, final msg).
//  - stream:true   -> accumulate into the streaming buffer and flush any
//                     COMPLETE sentences to the queue (low latency, natural
//                     flow). Pass flush:true at end-of-stream to speak the
//                     remaining partial sentence.
export function enqueueNira(text, { stream = false, flush = false } = {}) {
  if (stream) {
    if (text) _streamBuffer += String(text)
    const ready = _drainSentences()
    for (const s of ready) {
      const c = s.replace(/[*`_#]/g, '').trim()
      if (c) _speechQueue.push(c)
    }
    if (flush) {
      const rem = _streamBuffer.replace(/[*`_#]/g, '').trim()
      _streamBuffer = ''
      if (rem) _speechQueue.push(rem)
    }
  } else {
    const c = String(text).replace(/[*`_#]/g, '').trim()
    if (c) _speechQueue.push(c)
  }
  _advanceQueue()
}

export async function speakNira(text) {
  if (typeof window === 'undefined') return false
  enqueueNira(text, { stream: false })
  return true
}

// Hard-stop any in-flight speech (server audio + browser TTS). Used when the
// user taps the core to interrupt Nira mid-sentence.
export function stopSpeech() {
  _speechQueue = []
  _streamBuffer = ''
  _audioCache.clear()
  // Drop any in-flight /speak requests so a new reply isn't blocked by a
  // stale chain still waiting on a cancelled sentence.
  _speakChain = Promise.resolve()
  _stopCurrentSpeech()
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

  const speak = useCallback(
    async (text) => {
      if (!enabledRef.current || typeof window === 'undefined') return
      enqueueNira(text, { stream: true })
    },
    [],
  )

  return { supported, micActive, startMic, stopMic, speak }
}
