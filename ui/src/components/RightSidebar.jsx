// Quick Actions are FEATURE TOGGLES. Tapping enables/disables a capability;
// when enabled, NIRA prefers that tool (e.g. Calculator -> numpy, Translate ->
// DeepL) instead of answering from the model itself.
import { useState } from 'react'
import LottieBox from './LottieBox'

const GEAR_LOTTIE = '/lottie/ol4LVUnk08.lottie'

const QUICK = [
  { id: 'calculator', label: 'Calculator', icon: '🧮', tool: 'calculate' },
  { id: 'translate', label: 'Translate', icon: '🌐', tool: 'translate' },
  { id: 'weather', label: 'Weather', icon: '🌤', tool: 'get_weather' },
  { id: 'wikipedia', label: 'Wikipedia', icon: '📚', tool: 'wikipedia' },
  { id: 'youtube', label: 'YouTube', icon: '▶️', tool: 'youtube_search' },
  { id: 'spotify', label: 'Spotify', icon: '🎧', tool: 'spotify' },
  { id: 'google', label: 'Google', icon: '🔎', tool: 'web_search' },
  { id: 'github', label: 'GitHub', icon: '🐙', tool: 'github_search' },
  { id: 'arxiv', label: 'arXiv', icon: '📄', tool: 'arxiv_search' },
  { id: 'pubmed', label: 'PubMed', icon: '🧬', tool: 'pubmed_search' },
  { id: 'reddit', label: 'Reddit', icon: '👽', tool: 'reddit_search' },
  { id: 'x', label: 'X', icon: '𝕏', tool: 'social_search' },
  { id: 'browser', label: 'Browser', icon: '🧭', tool: 'browser' },
  { id: 'screenshot', label: 'Screenshot', icon: '📸', tool: 'take_screenshot' },
  { id: 'calendar', label: 'Calendar', icon: '📅', tool: 'calendar' },
  { id: 'gmail', label: 'Gmail', icon: '✉️', tool: 'gmail' },
]

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function Indicator({ kind }) {
  const cls = kind === 'ok' ? 'ok' : kind === 'warn' ? 'warn' : kind === 'err' ? 'err' : 'ok'
  return <span className={`indicator ${cls}`} />
}

export default function RightSidebar({
  activity = [],
  status,
  coreState,
  models,
  currentModel,
  onSelectModel,
  onRefreshModels,
  onQuickAction,
  features = {},
  onToggleFeature,
  voiceOn,
  voiceSupported,
  onToggleVoice,
}) {
  const rows = [
    { k: 'Model', v: currentModel ? shortModel(currentModel) : '—', ind: 'ok' },
    { k: 'Latency', v: status?.latency || '—', ind: status?.latency ? 'ok' : 'warn' },
    { k: 'Memory', v: status?.memory || '—', ind: 'ok' },
    { k: 'Internet', v: 'Online', ind: 'ok' },
    { k: 'Tools Online', v: '12', ind: 'ok' },
    { k: 'API Usage', v: '3 / day', ind: 'warn' },
  ]

  const voiceLabel = !voiceSupported ? 'Unsupported' : voiceOn ? 'On' : 'Off'

  const enabledCount = QUICK.filter((q) => features[q.id]).length

  // Searchable model picker state.
  const [modelOpen, setModelOpen] = useState(false)
  const [modelQuery, setModelQuery] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const filteredModels = (models || []).filter((m) => {
    const name = (m.name || '').toLowerCase()
    const tokens = modelQuery.toLowerCase().trim().split(/\s+/).filter(Boolean)
    // Every typed word must appear as a substring (in any order/position).
    return tokens.every((t) => name.includes(t))
  })

  const doRefresh = async () => {
    if (!onRefreshModels) return
    setRefreshing(true)
    try { await onRefreshModels() } finally { setRefreshing(false) }
  }

  const chooseModel = (id) => {
    onSelectModel?.(id)
    setModelOpen(false)
    setModelQuery('')
  }

  return (
    <div className="column right">
      <div className="panel" style={{ flex: '1 1 auto', minHeight: 0 }}>
        <div className="panel-title">Activity Timeline</div>
        <div className="timeline">
          {activity.length === 0 && (
            <div style={{ color: 'var(--text-dim)', fontSize: 13, opacity: 0.7 }}>
              No activity yet. Try asking NIRA something.
            </div>
          )}
          {activity.map((a, i) => (
            <div className="tl-item" key={i}>
              <div className="tl-icon">{a.icon || '•'}</div>
              <div className="tl-body">
                <div className="tl-text">{a.text}</div>
                <div className="tl-time">{a.time || nowTime()}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel" style={{ flex: '0 0 auto' }}>
        <div className="panel-title">
          <span className="panel-title-row">
            <LottieBox src={GEAR_LOTTIE} className="gear-lottie" />
            System Status
          </span>
        </div>
        <div className="status-rows">
          <div className="status-row model-row">
            <span className="status-key">Model</span>
            <button
              className="model-select-btn"
              onClick={() => setModelOpen((v) => !v)}
              disabled={!models?.length}
              title="Search models"
            >
              <span className="model-current">{currentModel ? shortModel(currentModel) : 'loading…'}</span>
              <span className="model-caret">🔍</span>
            </button>
            <button
              className="model-refresh-btn"
              onClick={doRefresh}
              disabled={refreshing}
              title="Refresh models"
            >
              {refreshing ? '⟳…' : '⟳'}
            </button>
            {modelOpen && (
              <div className="model-pop">
                <input
                  className="model-search"
                  autoFocus
                  placeholder="Search models…"
                  value={modelQuery}
                  onChange={(e) => setModelQuery(e.target.value)}
                />
                <div className="model-list">
                  {filteredModels.length === 0 && (
                    <div className="model-empty">No matches</div>
                  )}
                  {filteredModels.map((m) => (
                    <button
                      key={m.id}
                      className={`model-opt ${m.id === currentModel ? 'active' : ''}`}
                      onClick={() => chooseModel(m.id)}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          {rows.slice(1).map((r) => (
            <div className="status-row" key={r.k}>
              <span className="status-key">{r.k}</span>
              <span className="status-val">
                {r.v}
                <Indicator kind={r.ind} />
              </span>
            </div>
          ))}
          <div className="status-row">
            <span className="status-key">Voice</span>
            <button
              className={`voice-toggle ${voiceOn ? 'on' : ''}`}
              onClick={onToggleVoice}
              disabled={!voiceSupported}
              title={voiceSupported ? 'Toggle voice chat' : 'Web Speech not supported in this browser'}
            >
              {voiceLabel}
            </button>
          </div>
        </div>
      </div>

      <div className="panel" style={{ flex: '0 0 auto' }}>
        <div className="panel-title">
          Features <span style={{ opacity: 0.6, fontWeight: 400, fontSize: 12 }}>· {enabledCount} on</span>
        </div>
        <div className="quick-hint">Tap to enable a tool. When on, NIRA uses it directly (e.g. Calculator → Python, Translate → DeepL).</div>
        <div className="quick-grid">
          {QUICK.map((q) => {
            const on = !!features[q.id]
            return (
              <button
                key={q.id}
                className={`quick-btn ${on ? 'on' : ''}`}
                title={`${q.label} — ${on ? 'enabled (tap to disable)' : 'disabled (tap to enable)'}`}
                aria-pressed={on}
                onClick={() => onToggleFeature?.(q)}
              >
                <span className="q-icon">{q.icon}</span>
                {q.label}
                <span className={`q-dot ${on ? 'on' : ''}`} />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function shortModel(id) {
  if (!id) return '—'
  const parts = id.split('|')
  return parts[parts.length - 1]
}
