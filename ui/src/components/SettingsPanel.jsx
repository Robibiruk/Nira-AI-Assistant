import { useEffect, useState } from 'react'

const KNOWN = [
  { name: 'ollama', base_url: 'http://localhost:11434/v1', hint: 'Local Ollama' },
  { name: 'lmstudio', base_url: 'http://localhost:1234/v1', hint: 'Local LM Studio' },
  { name: 'gemini', base_url: 'https://generativelanguage.googleapis.com/v1beta/openai/', hint: 'Google Gemini (OpenAI-compat)' },
  { name: 'openai', base_url: 'https://api.openai.com/v1', hint: 'OpenAI' },
  { name: 'zen', base_url: 'https://api.openai.com/v1', hint: 'zen (OpenAI-compat)' },
]

export default function SettingsPanel({ providers, custom, onAdd, onRemove }) {
  const [form, setForm] = useState({ name: '', base_url: '', api_key: '', models: '' })
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setMsg('')
    try {
      const res = await fetch('/providers/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          base_url: form.base_url.trim(),
          api_key: form.api_key.trim(),
          models: form.models.split(',').map((s) => s.trim()).filter(Boolean),
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.detail || 'failed')
      setMsg(`Added "${d.name}". Active: ${d.active.join(', ')}`)
      setForm({ name: '', base_url: '', api_key: '', models: '' })
      onAdd?.()
    } catch (err) {
      setMsg('Error: ' + err.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (name) => {
    setMsg('')
    try {
      await fetch('/providers/custom', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      setMsg(`Removed "${name}"`)
      onRemove?.()
    } catch {
      setMsg('Remove failed')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '6px 4px', overflowY: 'auto' }}>
      <div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, margin: '0 0 4px' }}>Settings</h2>
        <p style={{ color: 'var(--text-dim)', margin: 0, fontSize: 13 }}>
          Manage AI providers. Only free / configured models appear in the model picker.
        </p>
      </div>

      <div className="panel" style={{ flex: '0 0 auto' }}>
        <div className="panel-title">Provider Status</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {providers?.configured?.length ? (
            providers.configured.map((p) => (
              <span key={p} className="tool-tag" style={{ padding: '4px 10px', borderRadius: 10 }}>
                {p}
              </span>
            ))
          ) : (
            <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>No providers configured.</span>
          )}
        </div>
      </div>

      <div className="panel" style={{ flex: '0 0 auto' }}>
        <div className="panel-title">Custom / Local Models</div>
        {custom?.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {custom.map((c) => (
              <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid var(--hairline-soft)', borderRadius: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{c.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>{c.base_url}</div>
                </div>
                <button className="btn-ghost" onClick={() => remove(c.name)}>Remove</button>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: '0 0 12px' }}>None yet — add one below.</p>
        )}

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {KNOWN.map((k) => (
              <button
                type="button"
                key={k.name}
                className="btn-ghost"
                onClick={() => setForm((f) => ({ ...f, name: k.name, base_url: k.base_url }))}
                title={k.hint}
              >
                + {k.name}
              </button>
            ))}
          </div>
          <input
            className="modal-input"
            placeholder="Provider name (e.g. ollama, gemini)"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <input
            className="modal-input"
            placeholder="Base URL (e.g. http://localhost:11434/v1)"
            value={form.base_url}
            onChange={(e) => setForm((f) => ({ ...f, base_url: e.target.value }))}
          />
          <input
            className="modal-input"
            placeholder="API key (leave blank for local)"
            value={form.api_key}
            onChange={(e) => setForm((f) => ({ ...f, api_key: e.target.value }))}
          />
          <input
            className="modal-input"
            placeholder="Models, comma-separated (e.g. llama3, gpt-4o-mini)"
            value={form.models}
            onChange={(e) => setForm((f) => ({ ...f, models: e.target.value }))}
          />
          <button type="submit" className="modal-btn" disabled={busy || !form.name || !form.base_url}>
            {busy ? 'Saving…' : 'Add Provider'}
          </button>
        </form>
        {msg && <p style={{ fontSize: 12.5, color: 'var(--glow)', margin: '8px 0 0' }}>{msg}</p>}
      </div>
    </div>
  )
}
