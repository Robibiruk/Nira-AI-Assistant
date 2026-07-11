import { useState, useRef, useEffect } from 'react'
import { SLASH_COMMANDS } from '../slash'

export default function ChatInput({ onSend, disabled, micActive, voiceSupported, onToggleMic }) {
  const [text, setText] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef(null)

  // Show the command menu when text starts with '/', and filter as the user types.
  const showMenu = text.startsWith('/')
  const q = text.slice(1).toLowerCase()
  const matches = showMenu
    ? SLASH_COMMANDS.filter((c) => c.cmd.includes(q.split(' ')[0]))
    : []

  useEffect(() => {
    setActive(0)
  }, [text])

  const submit = (e) => {
    e.preventDefault()
    if (!text.trim()) return
    onSend(text)
    setText('')
    setMenuOpen(false)
  }

  const pick = (cmd) => {
    // Insert the command and keep focus so the user can type the argument.
    setText(`/${cmd} `)
    setMenuOpen(false)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const onKeyDown = (e) => {
    if (showMenu && matches.length) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActive((a) => (a + 1) % matches.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActive((a) => (a - 1 + matches.length) % matches.length)
        return
      }
      if (e.key === 'Tab') {
        e.preventDefault()
        pick(matches[active].cmd)
        return
      }
    }
  }

  return (
    <div className="chat-input-wrap">
      {showMenu && matches.length > 0 && (
        <div className="cmd-menu">
          {matches.map((c, i) => (
            <button
              key={c.cmd}
              type="button"
              className={`cmd-item ${i === active ? 'active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(c.cmd)}
            >
              <span className="cmd-icon">{c.icon}</span>
              <span className="cmd-text">
                <span className="cmd-name">/{c.cmd}</span>
                <span className="cmd-label">{c.label}</span>
              </span>
              <span className="cmd-hint">{c.hint}</span>
            </button>
          ))}
        </div>
      )}

      <form className="chat-input" onSubmit={submit}>
        <button
          type="button"
          className="icon-btn plus-btn"
          title="Commands"
          aria-label="Show commands"
          onClick={() => {
            setMenuOpen((v) => !v)
            setText((t) => (t.startsWith('/') ? t : '/'))
            setTimeout(() => inputRef.current?.focus(), 0)
          }}
        >
          +
        </button>
        {menuOpen && !showMenu && (
          <div className="cmd-menu inline">
            {SLASH_COMMANDS.map((c) => (
              <button
                key={c.cmd}
                type="button"
                className="cmd-item"
                onClick={() => {
                  pick(c.cmd)
                  setMenuOpen(false)
                }}
              >
                <span className="cmd-icon">{c.icon}</span>
                <span className="cmd-text">
                  <span className="cmd-name">/{c.cmd}</span>
                  <span className="cmd-label">{c.label}</span>
                </span>
              </button>
            ))}
          </div>
        )}
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask me anything, or type / for commands…"
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
    </div>
  )
}
