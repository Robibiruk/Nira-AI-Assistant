import { useState } from 'react'

export default function ToolFormModal({ tool, onSubmit, onCancel }) {
  const [args, setArgs] = useState({})

  const handleChange = (key, value) => {
    setArgs((a) => ({ ...a, [key]: value }))
  }

  const submit = (e) => {
    e.preventDefault()
    onSubmit(args)
  }

  // Build inputs from the tool's parameters.
  const params = tool.parameters || {}
  const required = tool.required || []

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">
          {tool.icon} {tool.label}
        </h2>
        <form onSubmit={submit}>
          {Object.entries(params).map(([key, schema]) => (
            <div className="modal-field" key={key}>
              <label className="modal-label">
                {key}
                {required.includes(key) && <span className="required-star">*</span>}
              </label>
              <input
                type="text"
                value={args[key] || ''}
                onChange={(e) => handleChange(key, e.target.value)}
                placeholder={schema.description || key}
                aria-label={schema.description || key}
              />
            </div>
          ))}
          <div className="modal-actions">
            <button className="modal-btn secondary" type="button" onClick={onCancel}>
              Cancel
            </button>
            <button
              className="modal-btn"
              type="submit"
              disabled={required.some((k) => !args[k] || !args[k].trim())}
            >
              Run
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
