import { useState } from 'react'
import ToolFormModal from './ToolFormModal'

export default function ToolList({ tools, activeTool, onUseTool }) {
  const [openTool, setOpenTool] = useState(null)

  const handleUse = (toolId, params) => {
    onUseTool?.(toolId, params)
    setOpenTool(null)
  }

  const activeToolObj = tools.find((t) => t.id === activeTool)

  return (
    <div className="panel tools-panel">
      <div className="panel-title">Tools</div>
      <div className="tool-grid">
        {tools.map((tl) => (
          <button
            key={tl.label + tl.id}
            className={`tool-card ${activeTool === tl.id ? 'active' : ''}`}
            onClick={() => {
              if (tl.id === 'list_windows' || tl.id === 'list_apps' || tl.id === 'list_tabs') {
                // No-arg tools: run immediately.
                onUseTool?.(tl.id, {})
              } else {
                setOpenTool(tl)
              }
            }}
            title={tl.id === activeToolObj?.id ? 'Currently executing' : `Use ${tl.label}`}
          >
            <span className="tool-icon">{tl.icon}</span>
            <span className="tool-name">{tl.label}</span>
          </button>
        ))}
      </div>
      {openTool && (
        <ToolFormModal
          tool={openTool}
          onSubmit={(p) => handleUse(openTool.id, p)}
          onCancel={() => setOpenTool(null)}
        />
      )}
    </div>
  )
}
