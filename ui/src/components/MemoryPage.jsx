import { useState } from 'react'

export default function MemoryPage({ sessions, onResume, onRename, onDelete, onNewChat }) {
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState('')
  const [confirmId, setConfirmId] = useState(null)

  const startEdit = (s) => {
    setEditingId(s.sid)
    setDraft(s.title || 'New chat')
  }
  const commitEdit = () => {
    const name = draft.trim()
    if (name && editingId) onRename(editingId, name)
    setEditingId(null)
    setDraft('')
  }
  const cancelEdit = () => {
    setEditingId(null)
    setDraft('')
  }

  return (
    <div className="page">
      <div className="center-header">
        <h1 className="center-greeting">💾 Memory</h1>
        <p className="center-sub">
          Every chat is saved as a session and auto-titled from your first question.
        </p>
      </div>

      <div className="session-actions">
        <button className="btn-primary" onClick={onNewChat}>＋ New chat</button>
      </div>

      <div className="session-list">
        {sessions.length === 0 && (
          <div className="empty">No saved sessions yet. Start a conversation!</div>
        )}
        {sessions.map((s) => (
          <div className="session-card" key={s.sid}>
            <div className="session-main" onClick={() => editingId !== s.sid && onResume(s.sid)}>
              {editingId === s.sid ? (
                <input
                  className="session-title-input"
                  value={draft}
                  autoFocus
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdit()
                    if (e.key === 'Escape') cancelEdit()
                  }}
                  onBlur={commitEdit}
                />
              ) : (
                <>
                  <div className="session-title">{s.title || 'New chat'}</div>
                  <div className="session-meta">
                    {new Date(s.updated).toLocaleString()}
                  </div>
                </>
              )}
            </div>

            <div className="session-btns">
              {editingId === s.sid ? (
                <>
                  <button className="chip" title="Save" onClick={commitEdit}>💾</button>
                  <button className="chip ghost" title="Cancel" onClick={cancelEdit}>✕</button>
                </>
              ) : (
                <>
                  <button className="chip" title="Open this session" onClick={() => onResume(s.sid)}>↺ Resume</button>
                  <button className="chip ghost" title="Rename" onClick={() => startEdit(s)}>✎</button>
                  <div className="session-del">
                    <button className="chip danger" title="Delete" onClick={() => setConfirmId(s.sid)}>🗑</button>
                    {confirmId === s.sid && (
                      <div className="session-del-pop">
                        <span>Delete this session?</span>
                        <div className="session-del-pop-btns">
                          <button className="chip danger" onClick={() => { onDelete(s.sid); setConfirmId(null) }}>Delete</button>
                          <button className="chip ghost" onClick={() => setConfirmId(null)}>Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
