import { useState } from 'react'
import ShapeGrid from './ShapeGrid'

function timeNow() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
const TOOL_META = {
  open_browser: { icon: '🌐', title: 'Browser', verb: 'Opened' },
  web: { icon: '🌐', title: 'Web', verb: 'Researched' },
  open_app: { icon: '⚙', title: 'App', verb: 'Opened' },
  get_weather: { icon: '🌤', title: 'Weather', verb: 'Checked' },
  web_search: { icon: '🔍', title: 'Web Search', verb: 'Searched' },
  tavily_search: { icon: '🧭', title: 'Web (Tavily)', verb: 'Searched' },
  wikipedia: { icon: '📚', title: 'Wikipedia', verb: 'Looked up' },
  translate: { icon: '🌐', title: 'Translate', verb: 'Translated' },
  spotify: { icon: '🎧', title: 'Spotify', verb: 'Searched' },
  news_search: { icon: '📰', title: 'News', verb: 'Searched' },
  reddit_search: { icon: '👽', title: 'Reddit', verb: 'Searched' },
  github_search: { icon: '🐙', title: 'GitHub', verb: 'Searched' },
  youtube_search: { icon: '▶', title: 'YouTube', verb: 'Searched' },
  arxiv_search: { icon: '📄', title: 'arXiv', verb: 'Searched' },
  pubmed_search: { icon: '🧬', title: 'PubMed', verb: 'Searched' },
  hackernews_search: { icon: '🟠', title: 'Hacker News', verb: 'Searched' },
  stackoverflow_search: { icon: '🥞', title: 'Stack Overflow', verb: 'Searched' },
  social_search: { icon: '💬', title: 'Social', verb: 'Searched' },
  calculate: { icon: '🧮', title: 'Calculator', verb: 'Computed' },
  take_screenshot: { icon: '📸', title: 'Screenshot', verb: 'Captured' },
  run_terminal_command: { icon: '🖥', title: 'Terminal', verb: 'Ran' },
  read_file: { icon: '📂', title: 'File', verb: 'Read' },
  write_file: { icon: '✎', title: 'File', verb: 'Wrote' },
  list_directory: { icon: '🗂', title: 'Directory', verb: 'Listed' },
}

function ToolCardRich({ tool, content }) {
  const meta = TOOL_META[tool] || { icon: '⚙', title: tool || 'Tool', verb: 'Ran' }
  // Best-effort parse: show the raw output as the "result" field.
  const result = typeof content === 'string' ? content.replace(/^```[\s\S]*?```/g, '').trim() : ''
  const [expanded, setExpanded] = useState(false)
  const isLong = result.length > 220
  const shown = !isLong || expanded ? result : result.slice(0, 220) + '…'
  return (
    <div className="tool-card-rich">
      <div className="tool-card-head">
        <span className="t-icon">{meta.icon}</span>
        <span className="t-title">{meta.title}</span>
        <span className="t-status"><span className="dot" /> Success</span>
      </div>
      <div className="tool-card-body">
        <div className="tool-field">
          <span className="f-label">{meta.verb}</span>
          <span className="f-value">{tool || '—'}</span>
        </div>
        {result && (
          <div className="tool-field">
            <span className="f-label">Result</span>
            <span className="f-value result-text">{shown}</span>
            {isLong && (
              <button
                type="button"
                className="btn-link"
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? 'Show less' : 'View results'}
              </button>
            )}
          </div>
        )}
      </div>
      <div className="tool-card-actions">
        {result && <button type="button" className="btn-ghost" onClick={() => navigator.clipboard?.writeText(result)}>Copy Result</button>}
      </div>
    </div>
  )
}

export default function Conversation({ messages, streaming }) {
  return (
    <div className="conversation">
      <div className="conversation-bg" aria-hidden="true">
        <ShapeGrid
          speed={0.5}
          squareSize={40}
          direction="diagonal"
          borderColor="rgba(73, 230, 255, 0.10)"
          hoverFillColor="rgba(73, 230, 255, 0.22)"
          shape="square"
          hoverTrailAmount={0}
        />
      </div>
      <div className="conversation-scroll">
      {messages.length === 0 && (
        <div className="conv-empty">
          NIRA is ready. Ask anything, open a tool, or tap the mic to talk.
        </div>
      )}
      {messages.map((m, i) => {
        if (m.role === 'tool') {
          return <ToolCardRich key={i} tool={m.tool} content={m.content} />
        }
        const isUser = m.role === 'user'
        return (
          <div key={i} className={`msg ${isUser ? 'msg-user' : 'msg-assistant'}`}>
            <div className="msg-head">
              {!isUser && <img className="ai-badge" src="/favicon-32.png" alt="NIRA" />}
              <span>{isUser ? 'You' : 'NIRA'}</span>
              <span>·</span>
              <span>{timeNow()}</span>
            </div>
            <div className="msg-body">
              {m.image && (
                <a href={m.image} target="_blank" rel="noreferrer">
                  <img className="msg-image" src={m.image} alt="screenshot" />
                </a>
              )}
              {m.content}
            </div>
          </div>
        )
      })}
      {streaming && (
        <div className="msg msg-assistant">
          <div className="msg-head">
            <img className="ai-badge" src="/favicon-32.png" alt="NIRA" />
            <span>NIRA</span>
          </div>
          <div className="typing">
            <span /><span /><span />
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
