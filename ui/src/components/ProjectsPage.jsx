import { useState } from 'react'
import { formatDate, formatShortDate } from '../utils'

const EMOJIS = ['🚀', '🎓', '💼', '💻', '🌍', '📖', '🏋', '🎨', '🔬', '📱', '🧠', '⭐']

// Projects = NIRA's workspace layer. Each project groups chats, memories,
// notes and research. Chats are the existing sessions tagged with a
// projectId; memories/notes/research live on the project doc.
export default function ProjectsPage({
  projects,
  sessions,
  activeProject,
  onCreate,
  onDelete,
  onOpenProject,
  onMoveSession,
  onResume,
  onNewChat,
}) {
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('🚀')
  const [description, setDescription] = useState('')
  const [confirmPid, setConfirmPid] = useState(null)

  const submit = (e) => {
    e.preventDefault()
    const n = name.trim()
    if (!n) return
    onCreate({ name: n, icon, description: description.trim() })
    setName(''); setIcon('🚀'); setDescription(''); setShowCreate(false)
  }

  // Filter sessions to the active project (or all if none selected).
  const visibleSessions = activeProject
    ? sessions.filter((s) => s.projectId === activeProject)
    : sessions

  const active = projects.find((p) => p.pid === activeProject)

  return (
    <div className="page">
      <div className="center-header">
        <h1 className="center-greeting">📁 Projects</h1>
        <p className="center-sub">
          Group your chats, memories and research into workspaces. Tag the current
          chat from the Project menu in Chat.
        </p>
      </div>

      <div className="session-actions">
        {activeProject && (
          <button className="btn-ghost" onClick={() => onOpenProject(null)}>← All projects</button>
        )}
        <button className="btn-primary" onClick={() => setShowCreate(true)}>＋ New project</button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="modal-backdrop">
          <form className="modal-card" onSubmit={submit}>
            <h2 className="modal-title">New project</h2>
            <input
              className="modal-input"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name (e.g. University)"
              aria-label="Project name"
            />
            <div className="emoji-picker">
              {EMOJIS.map((em) => (
                <button
                  type="button"
                  key={em}
                  className={`emoji-opt ${icon === em ? 'active' : ''}`}
                  onClick={() => setIcon(em)}
                >{em}</button>
              ))}
            </div>
            <input
              className="modal-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              aria-label="Description"
            />
            <button className="modal-btn" type="submit" disabled={!name.trim()}>Create</button>
            <button type="button" className="btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
          </form>
        </div>
      )}

      {/* Single-project detail view */}
      {active ? (
        <div className="project-detail">
          <div className="project-detail-head">
            <span className="project-detail-icon">{active.icon}</span>
            <div>
              <h2>{active.name}</h2>
              {active.description && <p className="project-desc">{active.description}</p>}
            </div>
            <button
              className="chip danger"
              title="Delete project"
              onClick={() => setConfirmPid(active.pid)}
            >🗑</button>
          </div>

          {confirmPid === active.pid && (
            <div className="session-del-pop">
              <span>Delete “{active.name}”? Chats stay, just unlinked.</span>
              <div className="session-del-pop-btns">
                <button className="chip danger" onClick={() => { onDelete(active.pid); setConfirmPid(null) }}>Delete</button>
                <button className="chip ghost" onClick={() => setConfirmPid(null)}>Cancel</button>
              </div>
            </div>
          )}

          <h3 className="project-section">💬 Conversations ({visibleSessions.length})</h3>
          <div className="session-list">
            {visibleSessions.length === 0 && <div className="empty">No conversations in this project yet. Open a chat and pick this project.</div>}
            {visibleSessions.map((s) => (
              <div className="session-card" key={s.sid}>
                <div className="session-main" onClick={() => onResume(s.sid)}>
                  <div className="session-title">{s.title || 'New chat'}</div>
                  <div className="session-meta">{formatDate(s.updated)}</div>
                </div>
              </div>
            ))}
          </div>

          <h3 className="project-section">🧠 Memories ({active.memories?.length || 0})</h3>
          <ul className="project-items">
            {(active.memories || []).map((m) => <li key={m.id}>{m.text}</li>)}
            {(active.memories || []).length === 0 && <li className="empty">No memories yet.</li>}
          </ul>

          <h3 className="project-section">📌 Notes ({active.notes?.length || 0})</h3>
          <ul className="project-items">
            {(active.notes || []).map((n) => <li key={n.id}>{n.text}</li>)}
            {(active.notes || []).length === 0 && <li className="empty">No notes yet.</li>}
          </ul>

          <h3 className="project-section">🔬 Research ({active.research?.length || 0})</h3>
          <ul className="project-items">
            {(active.research || []).map((r) => <li key={r.id}>{r.text}</li>)}
            {(active.research || []).length === 0 && <li className="empty">No research yet.</li>}
          </ul>
        </div>
      ) : (
        /* Project grid */
        <div className="project-grid">
          {projects.length === 0 && (
            <div className="empty">No projects yet. Create one to organize your work.</div>
          )}
          {projects.map((p) => {
            const chats = sessions.filter((s) => s.projectId === p.pid).length
            return (
              <button className="project-card" key={p.pid} onClick={() => onOpenProject(p.pid)}>
                <div className="project-card-icon">{p.icon}</div>
                <div className="project-card-name">{p.name}</div>
                <div className="project-card-stats">
                  <span>💬 {chats}</span>
                  <span>🧠 {p.memories?.length || 0}</span>
                  <span>🔬 {p.research?.length || 0}</span>
                </div>
                <div className="project-card-meta">
                  Updated {formatShortDate(p.updated)}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
