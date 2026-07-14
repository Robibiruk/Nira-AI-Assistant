import LottieBox from './LottieBox'

const SIDEBAR_LOTTIE = '/lottie/Zif7GWYROj.lottie'

// Robot mark for the sidebar core (default + hover variants from Favicon/).
const CORE_ICON = '/favicon-96.png'
const CORE_ICON_HOVER = '/favicon-70.png'

const NAV = [
  { id: 'chat', label: 'Chat', icon: '💬' },
  { id: 'memory', label: 'Memory', icon: '🧠' },
  { id: 'projects', label: 'Projects', icon: '📁' },
  { id: 'browser', label: 'Web', icon: '🌐' },
  { id: 'research', label: 'Research', icon: '🔬' },
  { id: 'about', label: 'About', icon: 'ℹ' },
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
  onNewChat,
}) {
  return (
    <div className="column left">
      <div className="panel" style={{ alignItems: 'center', gap: 8, flex: '0 0 auto', minHeight: 0 }}>
        <button
          className="sidebar-core"
          title={voiceSupported ? (micActive ? 'Tap to stop' : speaking ? 'Tap to interrupt' : 'Tap to talk') : 'Voice not available in this browser'}
          onClick={onCoreTap}
        >
          <img className="sidebar-core-icon" src={CORE_ICON} alt="NIRA" />
          <img className="sidebar-core-icon sidebar-core-icon-hover" src={CORE_ICON_HOVER} alt="NIRA" />
        </button>
        <h1 className="brand">NIRA</h1>
        <LottieBox src={SIDEBAR_LOTTIE} className="sidebar-lottie" />
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
        <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Navigation
          <button className="nav-new" title="Start a new chat" onClick={onNewChat}>＋</button>
        </div>
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
          <button
            className="nav-item nav-download"
            title="Download the Nira Android app (APK)"
            onClick={() => {
              const a = document.createElement('a')
              a.href = '/assets/Nira.apk'
              a.download = 'Nira.apk'
              a.rel = 'noopener'
              document.body.appendChild(a)
              a.click()
              a.remove()
            }}
          >
            <span className="nav-icon">📲</span>
            Download app
          </button>
        </nav>
      </div>
    </div>
  )
}
