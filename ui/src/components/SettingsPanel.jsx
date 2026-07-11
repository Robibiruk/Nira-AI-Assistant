import { useEffect, useState } from 'react'
import { apiFetch, apiError } from '../api'

const KNOWN = [
  { name: 'ollama', base_url: 'http://localhost:11434/v1', hint: 'Local Ollama' },
  { name: 'lmstudio', base_url: 'http://localhost:1234/v1', hint: 'Local LM Studio' },
  { name: 'gemini', base_url: 'https://generativelanguage.googleapis.com/v1beta/openai/', hint: 'Google Gemini (OpenAI-compat)' },
  { name: 'openai', base_url: 'https://api.openai.com/v1', hint: 'OpenAI' },
  { name: 'zen', base_url: 'https://api.openai.com/v1', hint: 'zen (OpenAI-compat)' },
]

export default function SettingsPanel({ providers, custom, toolKeys = {}, onAdd, onRemove, onToolKey }) {
  const [form, setForm] = useState({ name: '', base_url: '', api_key: '', models: '' })
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [toolForm, setToolForm] = useState({ name: '', api_key: '' })
  const [toolMsg, setToolMsg] = useState('')
  const [toolBusy, setToolBusy] = useState(false)

  const TOOL_HINTS = {
    google: 'Google (Search, YouTube, Calendar, Gmail)',
    github: 'GitHub (repos, issues, user)',
    translate: 'Translate service (DeepL / Google Translate)',
    wikipedia: 'Wikipedia',
    reddit: 'Reddit',
    x: 'X.com (Twitter)',
    youtube: 'YouTube Data API',
    spotify: 'Spotify OAuth Bearer token (starts with BQ)',
    email: 'Email (SMTP)',
    clipboard: 'Clipboard (local, no key)',
  }

  const submitTool = async (e) => {
    e.preventDefault()
    setToolBusy(true)
    setToolMsg('')
    try {
      const r = await apiFetch('/tools/keys', {
        method: 'POST',
        body: JSON.stringify({ name: toolForm.name.trim(), api_key: toolForm.api_key.trim() }),
      })
      if (!r.ok) throw new Error(apiError(r, 'save failed'))
      setToolMsg(`Saved "${r.data.name}".`)
      setToolForm({ name: '', api_key: '' })
      onToolKey?.()
    } catch (err) {
      setToolMsg('Error: ' + err.message)
    } finally {
      setToolBusy(false)
    }
  }

  const removeTool = async (name) => {
    setToolMsg('')
    try {
      const r = await apiFetch('/tools/keys', {
        method: 'DELETE',
        body: JSON.stringify({ name }),
      })
      if (!r.ok) throw new Error(apiError(r, 'remove failed'))
      setToolMsg(`Removed "${name}"`)
      onToolKey?.()
    } catch (err) {
      setToolMsg('Error: ' + err.message)
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setMsg('')
    try {
      const r = await apiFetch('/providers/custom', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          base_url: form.base_url.trim(),
          api_key: form.api_key.trim(),
          models: form.models.split(',').map((s) => s.trim()).filter(Boolean),
        }),
      })
      if (!r.ok) throw new Error(apiError(r, 'add failed'))
      setMsg(`Added "${r.data.name}". Active: ${r.data.active.join(', ')}`)
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
      const r = await apiFetch('/providers/custom', {
        method: 'DELETE',
        body: JSON.stringify({ name }),
      })
      if (!r.ok) throw new Error(apiError(r, 'remove failed'))
      setMsg(`Removed "${name}"`)
      onRemove?.()
    } catch (err) {
      setMsg('Error: ' + err.message)
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

      <div className="panel" style={{ flex: '0 0 auto' }}>
        <div className="panel-title">Tool Connections</div>
        <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: '0 0 12px' }}>
          Connect external tools (Google, GitHub, Translate, YouTube, Spotify, …). Keys are stored locally in
          config/tool_keys.json and never committed.
        </p>
        {Object.keys(toolKeys).length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {Object.entries(toolKeys).map(([name, info]) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid var(--hairline-soft)', borderRadius: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{name}</div>
                  <div style={{ fontSize: 11.5, color: info.configured ? 'var(--glow)' : 'var(--text-dim)' }}>
                    {info.configured ? 'Connected' : 'Not configured'}
                  </div>
                </div>
                <button className="btn-ghost" onClick={() => removeTool(name)}>Remove</button>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={submitTool} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {Object.entries(TOOL_HINTS).map(([id, hint]) => (
              <button
                type="button"
                key={id}
                className="btn-ghost"
                onClick={() => setToolForm((f) => ({ ...f, name: id }))}
                title={hint}
              >
                + {id}
              </button>
            ))}
          </div>
          <input
            className="modal-input"
            placeholder="Tool name (e.g. google, github, youtube)"
            value={toolForm.name}
            onChange={(e) => setToolForm((f) => ({ ...f, name: e.target.value }))}
          />
          <input
            className="modal-input"
            placeholder="API key (leave blank for local tools)"
            value={toolForm.api_key}
            onChange={(e) => setToolForm((f) => ({ ...f, api_key: e.target.value }))}
          />
          <button type="submit" className="modal-btn" disabled={toolBusy || !toolForm.name}>
            {toolBusy ? 'Saving…' : 'Save Connection'}
          </button>
        </form>
        {toolMsg && <p style={{ fontSize: 12.5, color: 'var(--glow)', margin: '8px 0 0' }}>{toolMsg}</p>}
      </div>
    </div>
  )
}
