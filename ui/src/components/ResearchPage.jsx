import { useState } from 'react'

export default function ResearchPage({ onSend }) {
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(5)

  const run = () => {
    const text = q.trim()
    if (!text) return
    onSend(`/pubmed ${text}`)
    setQ('')
  }

  return (
    <div className="page">
      <div className="center-header">
        <h1 className="center-greeting">🔬 Research</h1>
        <p className="center-sub">
          Search medical and life-science literature on PubMed. NIRA summarizes the findings.
        </p>
      </div>

      <div className="search-bar">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run()}
          placeholder="Search PubMed (e.g. CRISPR gene therapy)…"
        />
        <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
          <option value={3}>3</option>
          <option value={5}>5</option>
          <option value={10}>10</option>
        </select>
        <button className="btn-primary" onClick={run}>🧬 Search</button>
      </div>
    </div>
  )
}
