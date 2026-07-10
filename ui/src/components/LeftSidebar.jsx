import AICore from './AICore'

const NAV = [
  { id: 'chat', label: 'Chat', icon: '💬' },
  { id: 'tools', label: 'Tools', icon: '⚙' },
  { id: 'memory', label: 'Memory', icon: '🧠' },
  { id: 'files', label: 'Files', icon: '📂' },
  { id: 'browser', label: 'Browser', icon: '🌐' },
  { id: 'research', label: 'Research', icon: '🔬' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
]

function Waveform({ active }) {
  const bars = [10, 22, 14, 28, 18, 32, 12, 24, 16, 30, 14, 20]
  return (
    <div className={`waveform ${active ? '' : 'idle'}`}>
      {bars.map((h, i) => (
        <span key={i} style={{ height: `${h}px`, animationDelay: `${i * 0.08}s` }} />
      ))}
    </div>
  )
}

export default function LeftSidebar({
  coreState,
  activeTool,
  userName,
  activePage,
  onPage,
  voiceOn,
  voiceSupported,
  micActive,
  onToggleVoice,
  onInterrupt,
}) {
  return (
    <div className="column left">
      <div className="panel" style={{ alignItems: 'center', gap: 8, flex: '0 0 auto' }}>
        <AICore state={coreState} activeTool={activeTool} />
        <h1 className="brand">NIRA</h1>
        <div className="sidebar-state">
          {coreState === 'executing'
            ? `Executing · ${activeTool || ''}`
            : coreState === 'listening'
            ? 'Listening…'
            : coreState === 'speaking'
            ? 'Speaking'
            : coreState === 'thinking'
            ? 'Thinking'
            : coreState === 'searching'
            ? 'Searching'
            : coreState === 'error'
            ? 'Error'
            : 'Idle'}
        </div>
        <div className="sidebar-greeting">
          Good {greetingPart()}, <b>{userName || 'there'}</b>.
        </div>
      </div>

      <div className="panel" style={{ flex: '1 1 auto', minHeight: 0 }}>
        <div className="panel-title">Navigation</div>
        <nav className="nav">
          {NAV.map((n) => (
            <button
              key={n.id}
              className={`nav-item ${activePage === n.id ? 'active' : ''}`}
              onClick={() => onPage?.(n.id)}
            >
              <span className="nav-icon">{n.icon}</span>
              {n.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="panel voice-card" style={{ flex: '0 0 auto' }}>
        <div className="panel-title" style={{ width: '100%' }}>Voice Mode</div>
        <Waveform active={voiceOn || micActive} />
        <button
          className={`mic-btn ${micActive ? 'active' : ''}`}
          onClick={onToggleVoice}
          disabled={!voiceSupported}
          title={micActive ? 'Stop listening' : 'Start voice'}
        >
          {micActive ? '■' : '🎙'}
        </button>
        <button className="interrupt-btn" onClick={onInterrupt} disabled={!voiceOn && !micActive}>
          Tap to interrupt
        </button>
      </div>

      <div className="user-card">
        <div className="avatar">{(userName || 'U').slice(0, 1).toUpperCase()}</div>
        <div className="user-meta">
          <div className="user-name">{userName || 'Guest'}</div>
          <div className="user-sub">Free plan</div>
        </div>
        <button className="user-menu" title="Settings" onClick={() => onPage?.('settings')}>⋮</button>
      </div>
    </div>
  )
}

function greetingPart() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 18) return 'afternoon'
  return 'evening'
}
