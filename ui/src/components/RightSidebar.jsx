const QUICK = [
  { id: 'screenshot', label: 'Screenshot', icon: '📸' },
  { id: 'code', label: 'Code', icon: '⟨⟩' },
  { id: 'notes', label: 'Notes', icon: '📝' },
  { id: 'calculator', label: 'Calculator', icon: '🧮' },
  { id: 'translate', label: 'Translate', icon: '🌐' },
  { id: 'weather', label: 'Weather', icon: '🌤' },
  { id: 'github', label: 'GitHub', icon: '🐙' },
  { id: 'clipboard', label: 'Clipboard', icon: '📋' },
  { id: 'camera', label: 'Camera', icon: '📷' },
  { id: 'email', label: 'Email', icon: '✉' },
  { id: 'calendar', label: 'Calendar', icon: '📅' },
  { id: 'chat', label: 'Chat', icon: '💬' },
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
}) {
  const voiceOn = status?.voice && status.voice !== 'Off'
  const rows = [
    { k: 'Model', v: currentModel ? shortModel(currentModel) : '—', ind: 'ok' },
    { k: 'Latency', v: status?.latency || '—', ind: status?.latency ? 'ok' : 'warn' },
    { k: 'Memory', v: status?.memory || '—', ind: 'ok' },
    { k: 'Voice', v: status?.voice || 'Off', ind: voiceOn ? 'ok' : 'warn' },
    { k: 'Internet', v: 'Online', ind: 'ok' },
    { k: 'Tools Online', v: '12', ind: 'ok' },
    { k: 'API Usage', v: '3 / day', ind: 'warn' },
  ]

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
        <div className="panel-title">System Status</div>
        <div className="status-rows">
          <div className="status-row">
            <span className="status-key">Model</span>
            <select
              className="model-select"
              value={currentModel}
              onChange={(e) => onSelectModel?.(e.target.value)}
              disabled={!models?.length}
              aria-label="Select model"
            >
              {!models?.length && <option value={currentModel || ''}>loading…</option>}
              {models?.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
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
        </div>
      </div>

      <div className="panel" style={{ flex: '0 0 auto' }}>
        <div className="panel-title">Quick Actions</div>
        <div className="quick-grid">
          {QUICK.map((q) => (
            <button key={q.id} className="quick-btn" title={q.label}>
              <span className="q-icon">{q.icon}</span>
              {q.label}
            </button>
          ))}
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
