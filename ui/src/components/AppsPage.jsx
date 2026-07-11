import { useEffect, useRef, useState, useCallback } from 'react'
import { apiFetch, apiError } from '../api'

const PERM_KEY = 'nira.apps.permission'
const STORE_LINKS = {
  windows: { label: 'Microsoft Store', url: 'https://apps.microsoft.com/' },
  macos: { label: 'Mac App Store', url: 'https://apps.apple.com/us/genre/mac/id39' },
  linux: { label: 'Flathub', url: 'https://flathub.org/' },
  android: { label: 'Google Play', url: 'https://play.google.com/store/apps' },
  ios: { label: 'App Store', url: 'https://apps.apple.com/' },
}

function monogram(name) {
  return (name || '?').trim().charAt(0).toUpperCase() || '?'
}

export default function AppsPage({ onSend }) {
  const [granted, setGranted] = useState(() => localStorage.getItem(PERM_KEY) === '1')
  const [data, setData] = useState({ installed: [], windows: [], apps: [], tabs: [], platform: 'windows' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('installed') // installed | windows | tabs
  const [busy, setBusy] = useState('') // title being acted on
  const timerRef = useRef(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    const res = await apiFetch('/desktop')
    setLoading(false)
    if (!res.ok || !res.data) {
      setError(apiError(res, 'failed to read desktop'))
      return
    }
    setData({
      installed: res.data.installed || [],
      windows: res.data.windows || [],
      apps: res.data.apps || [],
      tabs: res.data.tabs || [],
      platform: res.data.platform || 'windows',
    })
  }, [])

  useEffect(() => {
    if (granted) {
      refresh()
      // Auto-refresh every 8s while the page is open.
      timerRef.current = setInterval(refresh, 8000)
    }
    return () => clearInterval(timerRef.current)
  }, [granted, refresh, tab])

  if (!granted) {
    return (
      <div className="page">
        <div className="center-header">
          <h1 className="center-greeting">📦 Apps</h1>
          <p className="center-sub">See your installed and open apps, and jump straight to them.</p>
        </div>
        <div className="perm-card">
          <div className="perm-icon">🔐</div>
          <h3>This needs access to your device</h3>
          <p>
            NIRA can list your installed apps, open windows, and browser tabs, and switch
            to or close them for you. Nothing leaves your machine — it's all local.
          </p>
          <div className="perm-actions">
            <button className="btn-primary" onClick={() => { localStorage.setItem(PERM_KEY, '1'); setGranted(true) }}>
              Allow access
            </button>
            <button className="btn-ghost" onClick={() => (window.history.length > 1 ? window.history.back() : null)}>
              Not now
            </button>
          </div>
        </div>
      </div>
    )
  }

  const store = STORE_LINKS[data.platform] || STORE_LINKS.windows

  const launch = async (name) => {
    setBusy(name)
    const res = await apiFetch('/desktop/action', {
      method: 'POST',
      body: JSON.stringify({ action: 'open', kind: 'installed', title: name }),
    })
    setBusy('')
    if (res.ok && res.data) {
      // brief feedback, then refresh (an open app may now appear in Opened)
      refresh()
    } else {
      setError(apiError(res, 'failed to launch'))
    }
  }

  const act = async (action, kind, item) => {
    const title = item.title || item.name || ''
    setBusy(title + action)
    const res = await apiFetch('/desktop/action', {
      method: 'POST',
      body: JSON.stringify({ action, kind, title, query: title, exe: item.exe || '' }),
    })
    setBusy('')
    if (res.ok && res.data) {
      // brief feedback, then refresh the list
      refresh()
    } else {
      setError(apiError(res, 'action failed'))
    }
  }

  const renderInstalled = () => (
    <div className="app-grid">
      {data.installed.length === 0 ? (
        <div className="empty">No installed apps detected (Windows-only).</div>
      ) : (
        data.installed.map((a, i) => (
          <button key={i} className="app-tile" onClick={() => launch(a.name)} disabled={busy === a.name}>
            {a.icon ? (
              <img className="app-icon" src={a.icon} alt="" />
            ) : (
              <img
                className="app-icon"
                width="94"
                height="94"
                src="https://img.icons8.com/3d-fluency/94/application.png"
                alt="application"
              />
            )}
            <span className="app-name">{a.name}</span>
          </button>
        ))
      )}
    </div>
  )

  const renderOpen = () => (
    <div className="desktop-list">
      {data.windows.length === 0 ? (
        <div className="empty">No open windows.</div>
      ) : (
        data.windows.map((w, i) => (
          <div key={i} className="desktop-row">
            <button className="desktop-row-main" onClick={() => act('focus', 'window', w)} title="Jump to this window">
              <span className="desktop-row-title">{w.title}</span>
              {w.exe && <span className="desktop-row-sub">{w.exe}</span>}
            </button>
            <button className="row-close" title="Close window" onClick={() => act('close', 'window', w)} disabled={busy === (w.title + 'close')}>✕</button>
          </div>
        ))
      )}
    </div>
  )

  const renderTabs = () => (
    <div className="desktop-list">
      {data.tabs.length === 0 ? (
        <div className="empty">No browser tabs detected (open Chrome/Edge/Brave, or not on Windows).</div>
      ) : (
        data.tabs.map((t, i) => (
          <div key={i} className="desktop-row">
            <button className="desktop-row-main" onClick={() => act('focus', 'tab', t)} title="Jump to this tab">
              <span className="desktop-row-title">{t.title}</span>
              {t.source && <span className="desktop-row-sub">{t.source}</span>}
            </button>
            <button className="row-close" title="Close tab" onClick={() => act('close', 'tab', t)} disabled={busy === (t.title + 'close')}>✕</button>
          </div>
        ))
      )}
    </div>
  )

  return (
    <div className="page">
      <div className="center-header">
        <h1 className="center-greeting">📦 Apps</h1>
        <p className="center-sub">
          Installed and open apps on your device. Tap to launch or jump to one; ✕ closes it.
        </p>
      </div>

      <div className="screen-controls">
        <button className={`btn-ghost ${tab === 'installed' ? 'active' : ''}`} onClick={() => setTab('installed')}>
          Installed ({data.installed.length})
        </button>
        <button className={`btn-ghost ${tab === 'windows' ? 'active' : ''}`} onClick={() => setTab('windows')}>
          Opened ({data.windows.length})
        </button>
        <button className={`btn-ghost ${tab === 'tabs' ? 'active' : ''}`} onClick={() => setTab('tabs')}>
          Browser ({data.tabs.length})
        </button>
        <a className="store-link" href={store.url} target="_blank" rel="noreferrer" title={store.label}>
          <span className="store-emoji">🛒</span> {store.label}
        </a>
        <button className="btn-primary" onClick={refresh} disabled={loading}>
          {loading ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </div>

      {error && <div className="error-box">{error}</div>}

      {tab === 'installed' && renderInstalled()}
      {tab === 'windows' && renderOpen()}
      {tab === 'tabs' && renderTabs()}
    </div>
  )
}
