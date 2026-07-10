import { useState } from 'react'

export default function ChatInput({ onSend, disabled, micActive, voiceSupported, onToggleMic }) {
  const [text, setText] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (!text.trim()) return
    onSend(text)
    setText('')
  }

  return (
    <form className="chat-input" onSubmit={submit}>
      <button
        type="button"
        className="icon-btn"
        title="Attach"
        aria-label="Attach file"
        onClick={() => {}}
      >
        📎
      </button>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Ask me anything…"
        disabled={disabled}
        aria-label="Message NIRA"
      />
      {voiceSupported && (
        <button
          type="button"
          className={`icon-btn ${micActive ? 'active' : ''}`}
          onClick={onToggleMic}
          disabled={disabled}
          title={micActive ? 'Stop listening' : 'Speak'}
          aria-label="Toggle microphone"
        >
          🎙
        </button>
      )}
      <button type="submit" className="send-btn" disabled={disabled || !text.trim()} aria-label="Send">
        ➤
      </button>
    </form>
  )
}
