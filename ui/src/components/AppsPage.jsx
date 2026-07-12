import { useEffect, useState } from 'react'
import { detectDevice } from '../device'

// A web browser CANNOT enumerate a user's installed apps (no such API exists,
// with or without permission — it's a hard privacy boundary). What we *can*
// do reliably is detect the OS and offer curated, well-known apps with real
// deep-links + store links. On the Windows/Mac DESKTOP build, the backend can
// enumerate real installed apps (handled separately below).
const STORE = {
  windows: { label: 'Microsoft Store', url: 'https://apps.microsoft.com/' },
  macos: { label: 'Mac App Store', url: 'https://apps.apple.com/us/genre/mac/id39' },
  linux: { label: 'Flathub', url: 'https://flathub.org/' },
  android: { label: 'Google Play', url: 'https://play.google.com/store/apps' },
  ios: { label: 'App Store', url: 'https://apps.apple.com/' },
}

// Curated popular apps with real launch links. `icon` is an emoji so it works
// everywhere with no asset fetching; `open` is what NIRA taps/opens.
const POPULAR = [
  { name: 'WhatsApp', icon: '💬', open: 'https://web.whatsapp.com', web: true },
  { name: 'YouTube', icon: '▶️', open: 'https://youtube.com', web: true },
  { name: 'Gmail', icon: '✉️', open: 'https://mail.google.com', web: true },
  { name: 'Spotify', icon: '🎧', open: 'https://open.spotify.com', web: true },
  { name: 'Telegram', icon: '✈️', open: 'https://web.telegram.org', web: true },
  { name: 'X (Twitter)', icon: '𝕏', open: 'https://x.com', web: true },
  { name: 'Google Maps', icon: '🗺️', open: 'https://maps.google.com', web: true },
  { name: 'Netflix', icon: '🎬', open: 'https://netflix.com', web: true },
  { name: 'ChatGPT', icon: '🤖', open: 'https://chat.openai.com', web: true },
  { name: 'Calendar', icon: '📅', open: 'https://calendar.google.com', web: true },
  { name: 'Calculator', icon: '🧮', open: null, action: 'calculator' },
  { name: 'Clock', icon: '⏰', open: null, action: 'clock' },
]

const OS_LABEL = {
  windows: 'Windows',
  macos: 'macOS',
  linux: 'Linux',
  android: 'Android',
  ios: 'iPhone / iPad',
}

export default function AppsPage({ onSend }) {
  const [device, setDevice] = useState(detectDevice())
  const [tab, setTab] = useState('popular') // popular | installed
  const [installed, setInstalled] = useState([])
  const [loading, setLoading] = useState(false)

  // On a Windows/Mac DESKTOP build the backend CAN enumerate real apps.
  useEffect(() => {
    let alive = true
    if (device === 'windows') {
      setLoading(true)
      fetch('/desktop')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (alive && d) setInstalled(d.installed || [])
        })
        .catch(() => {})
        .finally(() => alive && setLoading(false))
    }
    return () => { alive = false }
  }, [device])

  const store = STORE[device] || STORE.windows

  const open = (app) => {
    if (app.action && onSend) {
      onSend(app.action)
      return
    }
    if (app.open) window.open(app.open, '_blank', 'noopener')
  }

  return (
    <div className="page">
      <div className="center-header">
        <h1 className="center-greeting">📦 Apps</h1>
        <p className="center-sub">
          You're on <b>{OS_LABEL[device] || 'this device'}</b>. Tap an app to open it.
        </p>
      </div>

      <div className="screen-controls">
        <button className={`btn-ghost ${tab === 'popular' ? 'active' : ''}`} onClick={() => setTab('popular')}>
          Popular
        </button>
        {device === 'windows' && (
          <button className={`btn-ghost ${tab === 'installed' ? 'active' : ''}`} onClick={() => setTab('installed')}>
            Installed ({installed.length})
          </button>
        )}
        <a className="store-link" href={store.url} target="_blank" rel="noreferrer" title={store.label}>
          <span className="store-emoji">🛒</span> {store.label}
        </a>
      </div>

      {tab === 'popular' && (
        <>
          <p className="app-note">
            Browsers can't read the apps installed on your device (privacy protection),
            so here are quick links to the most-used apps. On the Windows/Mac desktop app,
            your real installed apps show under <b>Installed</b>.
          </p>
          <div className="app-grid">
            {POPULAR.map((a) => (
              <button key={a.name} className="app-tile" onClick={() => open(a)}>
                <span className="app-emoji">{a.icon}</span>
                <span className="app-name">{a.name}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {tab === 'installed' && (
        <div className="app-grid">
          {loading && <div className="empty">Reading your installed apps…</div>}
          {!loading && installed.length === 0 && (
            <div className="empty">No installed apps detected on this machine.</div>
          )}
          {installed.map((a, i) => (
            <button key={i} className="app-tile" onClick={() => open({ open: null, action: a.name })}>
              <span className="app-emoji">🗔</span>
              <span className="app-name">{a.name || a}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
