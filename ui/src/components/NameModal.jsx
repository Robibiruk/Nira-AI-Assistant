import { useEffect, useState } from 'react'
import { speakNira } from '../hooks/useVoice'

export default function NameModal({ onSubmit }) {
  const [name, setName] = useState('')

  const submit = (e) => {
    e.preventDefault()
    const n = name.trim()
    if (n) onSubmit(n)
  }

  // Auto-speak greeting after the modal appears (first-time user) — NIRA voice.
  useEffect(() => {
    const t = setTimeout(() => {
      speakNira('Hello. I am NIRA. What should I call you?')
    }, 500)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="modal-backdrop">
      <form className="modal-card" onSubmit={submit}>
        <h2 className="modal-title">NIRA</h2>
        <p className="modal-sub">What should I call you?</p>
        <input
          className="modal-input"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          aria-label="Your name"
        />
        <button className="modal-btn" type="submit" disabled={!name.trim()}>
          Continue
        </button>
      </form>
    </div>
  )
}
