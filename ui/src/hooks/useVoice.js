import { useCallback, useEffect, useRef, useState } from 'react'

// NIRA's voice is produced CLIENT-SIDE (no large server model, so the
// backend never OOMs on cold start). We use the BROWSER'S Web Speech API
// (keyless, no external script, no console errors) with an explicit
// en-GB / male English voice when available.
//
// Only ONE line plays at a time. We track the in-flight engine and stop it
// before starting a new one. Sentences are synthesised sequentially so a
// streamed reply flows naturally without a robot pause after every word.

let _currentUtterance = null

// Sequential speech queue: streamed sentences play one after another.
let _speechQueue = []
let _speechPlaying = false

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
      u.pitch = 0.9
      const voices = window.speechSynthesis.getVoices?.() || []
      const enGB = voices.find((v) => /^en[-_]GB/i.test(v.lang))
      const enMale = voices.find((v) => /^en/i.test(v.lang) && /male|daniel|george|arthur|fred/i.test(v.name))
      const en = enMale || enGB || voices.find((v) => /^en[-_]/i.test(v.lang)) || voices[0]
      if (en) u.voice = en
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
