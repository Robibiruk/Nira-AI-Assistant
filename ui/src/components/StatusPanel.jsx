export default function StatusPanel({
  status,
  coreState,
  models,
  currentModel,
  onSelectModel,
  voiceOn,
  voiceSupported,
  onToggleVoice,
}) {
  const voiceLabel = !voiceSupported ? 'Unsupported' : voiceOn ? 'On' : 'Off'

  const rows = [
    ['Latency', status.latency || '—'],
    ['Memory', status.memory],
    ['Core', coreState],
  ]

  return (
    <div className="panel status-panel">
      <div className="panel-title">System Status</div>

      <div className="status-row model-row">
        <span className="status-key">Model</span>
        <select
          className="model-select"
          value={currentModel}
          onChange={(e) => onSelectModel(e.target.value)}
          disabled={!models.length}
          aria-label="Select model"
        >
          {!models.length && <option value={currentModel || ''}>loading…</option>}
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      {rows.map(([k, v]) => (
        <div className="status-row" key={k}>
          <span className="status-key">{k}</span>
          <span className="status-val">{v}</span>
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
  )
}
