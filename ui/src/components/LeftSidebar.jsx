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

function greetingPart() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 18) return 'afternoon'
  return 'evening'
}

export default function LeftSidebar({
  coreState,
  activeTool,
  userName,
  activePage,
  onPage,
  requesting,
  micActive,
  speaking,
  voiceSupported,
  onCoreTap,
}) {
  return (
    <div className="column left">
      <div className="panel" style={{ alignItems: 'center', gap: 8, flex: '0 0 auto', minHeight: 0 }}>
        <AICore
          state={coreState}
          activeTool={activeTool}
          requesting={requesting}
          micActive={micActive}
          speaking={speaking}
          voiceSupported={voiceSupported}
          onTap={onCoreTap}
        />
        <h1 className="brand">NIRA</h1>
        <div className="sidebar-greeting">
          Good {greetingPart()}, <b>{userName || 'there'}</b>.
        </div>
        <div className="core-hint">
          {voiceSupported
            ? micActive
              ? 'Tap the core to stop'
              : speaking
              ? 'Tap the core to interrupt'
              : 'Tap the core to talk'
            : 'Voice not available in this browser'}
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
