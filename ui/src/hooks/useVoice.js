import { useCallback, useEffect, useRef, useState } from 'react'

// NIRA's voice is produced CLIENT-SIDE (no large server model, so the
// backend never OOMs on cold start). We use the BROWSER'S Web Speech API
// (keyless, no external script, no console errors) and ALWAYS select a
// MALE BRITISH voice (en-GB male preferred) so the assistant sounds like
// a man with a British accent. Selection is deterministic and cached.
//
// Only ONE line plays at a time. We track the in-flight engine and stop it
// before starting a new one. Sentences are synthesised sequentially so a
// streamed reply flows naturally without a robot pause after every word.

let _currentUtterance = null

// Sequential speech queue: streamed sentences play one after another.
let _speechQueue = []
let _speechPlaying = false

// Voices load asynchronously in most browsers; cache them once available so
// we can pick a STABLE MALE BRITISH voice every time (the browser default is
// frequently female). Selection is deterministic — it never changes on its
// own as long as the same voice names exist on the system.
let _voices = []
function _refreshVoices() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  try {
    _voices = window.speechSynthesis.getVoices() || []
  } catch {
    _voices = []
  }
}
if (typeof window !== 'undefined' && window.speechSynthesis) {
  _refreshVoices()
  try {
    window.speechSynthesis.onvoiceschanged = _refreshVoices
  } catch {
    /* ignore */
  }
}

// NIRA's voice: prefer en-GB MALE, then any English MALE, then en-GB
// (British accent), then any English. Male is prioritised so the assistant
// always sounds like a man; British is preferred for the accent.
function _pickVoice() {
  const vs =
    _voices.length
      ? _voices
      : typeof window !== 'undefined' && window.speechSynthesis
        ? window.speechSynthesis.getVoices() || []
        : []
  if (!vs.length) return null
  const maleKW =
    /male|daniel|george|arthur|fred|ryan|will|harry|james|oliver|lee|guy|russell|geoff|brian|english\s*male/i
  const enGB = vs.filter((v) => v.lang && /^en[-_]gb/i.test(v.lang))
  const enMale = vs.filter((v) => /^en/i.test(v.lang || '') && maleKW.test(v.name || ''))
  return (
    enGB.find((v) => maleKW.test(v.name || '')) || // en-GB male (ideal)
    enMale.find((v) => /^en[-_]gb/i.test(v.lang || '')) || // en-GB male (alt)
    enMale[0] || // any male English
    enGB[0] || // British accent (en-GB)
    vs.find((v) => /^en/i.test(v.lang || '')) || // any English
    vs[0]
  )
}

function _stopCurrentSpeech() {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    try { window.speechSynthesis.cancel() } catch { /* ignore */ }
  }
  _currentUtterance = null
}

function _playBrowserTTS(text) {
  return new Promise((resolve) => {
    try {
      if (typeof window.speechSynthesis === 'undefined') return resolve(false)
      const u = new SpeechSynthesisUtterance(text)
      _currentUtterance = u
      u.rate = 1.0
      u.pitch = 0.8 // lower pitch -> male timbre
      const v = _pickVoice()
      if (v) u.voice = v
      u.onend = () => resolve(true)
      u.onerror = () => resolve(false)
      window.speechSynthesis.speak(u)
    } catch {
      resolve(false)
    }
  })
}

// Play one sentence via the browser TTS.
function _playText(text) {
  return _playBrowserTTS(text)
}

function _advanceQueue() {
  if (_speechPlaying) return
  const next = _speechQueue.shift()
  if (next === undefined) return
  _speechPlaying = true
  _playText(next).finally(() => {
    _speechPlaying = false
    _advanceQueue()
  })
}

// Buffer for streamed replies: accumulate tokens and hand COMPLETE sentences
// to the TTS queue. Speaking per-word produces an audible pause after every
// word; speaking whole sentences keeps NIRA's delivery natural.
let _streamBuffer = ''

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
//  - stream:false -> speak the whole text as one unit (greetings, final msg).
//  - stream:true  -> accumulate into the streaming buffer and flush COMPLETE
//                     sentences to the queue (low latency, natural flow).
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

// Hard-stop any in-flight speech. Used when the user taps the core to
// interrupt Nira mid-sentence.
export function stopSpeech() {
  _speechQueue = []
  _streamBuffer = ''
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
      try { rec.abort?.() } catch { /* ignore */ }
    }
  }, [])

  const startMic = useCallback(() => {
    const rec = recRef.current
    if (!rec) return
    try {
      rec.start()
      setMicActive(true)
    } catch { /* already started */ }
  }, [])

  const stopMic = useCallback(() => {
    try { recRef.current?.stop() } catch { /* ignore */ }
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
