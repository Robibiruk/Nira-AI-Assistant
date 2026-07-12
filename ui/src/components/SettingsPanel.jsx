import { useEffect, useState } from 'react'
import { apiFetch, apiError } from '../api'

const KNOWN = [
  { name: 'ollama', base_url: 'http://localhost:11434/v1', hint: 'Local Ollama' },
  { name: 'lmstudio', base_url: 'http://localhost:1234/v1', hint: 'Local LM Studio' },
  { name: 'gemini', base_url: 'https://generativelanguage.googleapis.com/v1beta/openai/', hint: 'Google Gemini (OpenAI-compat)' },
  { name: 'openai', base_url: 'https://api.openai.com/v1', hint: 'OpenAI' },
  { name: 'zen', base_url: 'https://api.openai.com/v1', hint: 'zen (OpenAI-compat)' },
]

// Services that support OAuth in the backend. Key-based / no-auth services
// keep the manual key-input below and are not listed here.
const OAUTH_SERVICES = [
  { id: 'github', label: 'GitHub', desc: 'Repos, issues, user (per-user token)' },
  { id: 'spotify', label: 'Spotify', desc: 'Music search + now playing' },
  { id: 'google', label: 'Google', desc: 'Email, Calendar, Drive (per-user)' },
  { id: 'reddit', label: 'Reddit', desc: 'Identity / reading' },
  { id: 'x', label: 'X', desc: 'Posts, user read (PKCE)' },
]

const KEY_SERVICES = [
  { id: 'google', label: 'Google', hint: 'Google (Search, YouTube, Calendar, Gmail)' },
  { id: 'translate', label: 'Translate', hint: 'Translate service (DeepL / Google Translate)' },
  { id: 'wikipedia', label: 'Wikipedia', hint: 'Wikipedia (no auth needed)' },
  { id: 'reddit', label: 'Reddit', hint: 'Reddit (OAuth coming soon — key for now)' },
  { id: 'x', label: 'X.com', hint: 'X.com (Twitter) (OAuth coming soon — key for now)' },
  { id: 'youtube', label: 'YouTube', hint: 'YouTube Data API' },
  { id: 'email', label: 'Email', hint: 'Email (SMTP)' },
  { id: 'clipboard', label: 'Clipboard', hint: 'Clipboard (local, no key)' },
]

export default function SettingsPanel({ providers, custom, toolKeys = {}, onAdd, onRemove, onToolKey }) {
  const [form, setForm] = useState({ name: '', base_url: '', api_key: '', models: '' })
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [toolForm, setToolForm] = useState({ name: '', api_key: '' })
  const [toolMsg, setToolMsg] = useState('')
  const [toolBusy, setToolBusy] = useState(false)
  // OAuth connection state per service.
  const [oauth, setOauth] = useState({})
  const [oauthBusy, setOauthBusy] = useState('')

  const refreshOAuth = async () => {
    try {
      const r = await apiFetch('/auth/status')
      if (r.ok && r.data) setOauth(r.data.connected || {})
    } catch { /* ignore — UI falls back to disconnected */ }
  }

  useEffect(() => { refreshOAuth() }, [])

  // Show a success toast if we returned from an OAuth callback (?connected=github)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const svc = params.get('connected')
    if (svc) {
      setMsg(`Connected to ${svc}.`)
      window.history.replaceState({}, '', window.location.pathname + window.location.hash)
      refreshOAuth()
    }
  }, [])

  const connectOAuth = (id) => {
    setOauthBusy(id)
    // Full-page navigation to the provider login (then back via callback).
    const base = import.meta.env.VITE_API_BASE && import.meta.env.VITE_API_BASE.replace(/\/+$/, '')
    const url = base ? `${base}/auth/${id}/login` : `/auth/${id}/login`
    window.location.href = url
  }

  const disconnectOAuth = async (id) => {
    setOauthBusy(id)
    try {
      const r = await apiFetch(`/auth/${id}/disconnect`, { method: 'POST' })
      if (!r.ok) throw new Error(apiError(r, 'disconnect failed'))
      setOauth((o) => ({ ...o, [id]: false }))
    } catch (err) {
      setMsg('Error: ' + err.message)
    } finally {
      setOauthBusy('')
    }
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
          Connect services with OAuth (per-user, encrypted), or paste a key for key-based tools.
        </p>

        {/* OAuth services: Connect / Disconnect */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {OAUTH_SERVICES.map((s) => {
            const connected = !!oauth[s.id]
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid var(--hairline-soft)', borderRadius: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{s.label}</div>
                  <div style={{ fontSize: 11.5, color: connected ? 'var(--glow)' : 'var(--text-dim)' }}>
                    {connected ? 'Connected' : 'Not connected'}
                    <span style={{ color: 'var(--text-dim)' }}> · {s.desc}</span>
                  </div>
                </div>
                {connected ? (
                  <button className="btn-ghost" disabled={oauthBusy === s.id} onClick={() => disconnectOAuth(s.id)}>
                    {oauthBusy === s.id ? '…' : 'Disconnect'}
                  </button>
                ) : (
                  <button className="modal-btn" style={{ padding: '6px 14px' }} disabled={oauthBusy === s.id} onClick={() => connectOAuth(s.id)}>
                    {oauthBusy === s.id ? 'Redirecting…' : 'Connect'}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Key-based services: keep the manual key input */}
        <div style={{ fontSize: 12, color: 'var(--text-dim)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Key-based tools
        </div>
        {Object.keys(toolKeys).length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {Object.entries(toolKeys).map(([name, info]) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid var(--hairline-soft)', borderRadius: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{name}</div>
                  <div style={{ fontSize: 11.5, color: info.configured ? 'var(--glow)' : 'var(--text-dim)' }}>
                    {info.configured ? 'Configured' : 'Not configured'}
                  </div>
                </div>
                <button className="btn-ghost" onClick={() => removeTool(name)}>Remove</button>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={submitTool} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {KEY_SERVICES.map((k) => (
              <button
                type="button"
                key={k.id}
                className="btn-ghost"
                onClick={() => setToolForm((f) => ({ ...f, name: k.id }))}
                title={k.hint}
              >
                + {k.id}
              </button>
            ))}
          </div>
          <input
            className="modal-input"
            placeholder="Tool name (e.g. google, youtube)"
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
