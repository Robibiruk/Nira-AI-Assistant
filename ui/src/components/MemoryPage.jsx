export default function MemoryPage({ sessions, onResume, onRename, onDelete, onNewChat }) {
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
            <div className="session-main" onClick={() => onResume(s.sid)}>
              <div className="session-title">{s.title || 'New chat'}</div>
              <div className="session-meta">
                {new Date(s.updated).toLocaleString()}
              </div>
            </div>
            <div className="session-btns">
              <button className="chip" title="Open this session" onClick={() => onResume(s.sid)}>↺ Resume</button>
              <button className="chip ghost" title="Rename" onClick={() => onRename(s.sid, s.title)}>✎</button>
              <button className="chip danger" title="Delete" onClick={() => onDelete(s.sid)}>🗑</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
