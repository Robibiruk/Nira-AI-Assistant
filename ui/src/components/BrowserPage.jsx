import { useState } from 'react'

export default function BrowserPage({ onSend }) {
  const [q, setQ] = useState('')
  const [depth, setDepth] = useState('basic')

  const run = () => {
    const text = q.trim()
    if (!text) return
    onSend(`/browse ${text}`)
    setQ('')
  }

  return (
    <div className="page">
      <div className="center-header">
        <h1 className="center-greeting">🌐 Browser</h1>
        <p className="center-sub">
          Live web search powered by Tavily. Ask anything current — news, facts, sites.
        </p>
      </div>

      <div className="search-bar">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run()}
          placeholder="Search the web…"
        />
        <select value={depth} onChange={(e) => setDepth(e.target.value)}>
          <option value="basic">Basic</option>
          <option value="advanced">Advanced</option>
        </select>
        <button className="btn-primary" onClick={run}>🔎 Search</button>
      </div>
    </div>
  )
}
