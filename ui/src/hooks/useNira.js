import { useCallback, useEffect, useRef, useState } from 'react'

// Tool catalogue shown in the side panel. `id` must match the tool name the
// backend reports in tool_result/executing events so the active highlight works.
const TOOLS = [
  { id: 'run_terminal_command', label: 'Terminal', icon: '🖥' },
  { id: 'read_file', label: 'Files', icon: '📂' },
  { id: 'write_file', label: 'Files', icon: '✎' },
  { id: 'list_directory', label: 'Files', icon: '🗂' },
  { id: 'open_browser', label: 'Browser', icon: '🌐' },
  { id: 'open_app', label: 'Apps', icon: '⚙' },
  { id: 'get_weather', label: 'Weather', icon: '🌤' },
  { id: 'web_search', label: 'Web', icon: '🔍' },
  { id: 'news_search', label: 'News', icon: '📰' },
  { id: 'reddit_search', label: 'Reddit', icon: '👽' },
  { id: 'github_search', label: 'GitHub', icon: '🐙' },
  { id: 'youtube_search', label: 'YouTube', icon: '▶' },
  { id: 'arxiv_search', label: 'arXiv', icon: '📄' },
  { id: 'pubmed_search', label: 'PubMed', icon: '🧬' },
  { id: 'hackernews_search', label: 'Hacker News', icon: '🟠' },
  { id: 'stackoverflow_search', label: 'Stack Overflow', icon: '🥞' },
  { id: 'social_search', label: 'Social', icon: '💬' },
]

export function useNira(sessionId = 'web', options = {}) {
  const { onModelSwitch, onReply } = options
  const [messages, setMessages] = useState([])
  const [coreState, setCoreState] = useState('idle')
  const [activeTool, setActiveTool] = useState(null)
  const [status, setStatus] = useState({
    model: 'free model',
    latency: null,
    memory: 'Active',
    voice: 'Off',
  })
  const [models, setModels] = useState([])
  const [currentModel, setCurrentModel] = useState('')

  const startRef = useRef(0)
  const onModelSwitchRef = useRef(onModelSwitch)
  const onReplyRef = useRef(onReply)
  onModelSwitchRef.current = onModelSwitch
  onReplyRef.current = onReply

  // Load the free model list + current selection on mount.
  useEffect(() => {
    fetch('/models')
      .then((r) => r.json())
      .then((d) => {
        setModels(d.models || [])
        if (d.current) setCurrentModel(d.current)
      })
      .catch(() => {})
  }, [])

  const selectModel = useCallback(async (id) => {
    try {
      const res = await fetch('/models/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: id }),
      })
      if (res.ok) {
        const d = await res.json()
        setCurrentModel(d.current)
        setStatus((s) => ({ ...s, model: d.current }))
      }
    } catch {
      /* ignore */
    }
  }, [])

  const greet = useCallback((name) => {
    setMessages([{ role: 'assistant', content: `Hello, ${name}! How can I help you today?` }])
  }, [])

  const sendMessage = useCallback(
    async (text) => {
      const content = text.trim()
      if (!content) return

      setMessages((m) => [...m, { role: 'user', content }])
      setCoreState('thinking')
      setActiveTool(null)
      startRef.current = performance.now()

      const handleEvent = (ev) => {
        switch (ev.type) {
          case 'meta':
            if (ev.model) {
              setCurrentModel(ev.model)
              setStatus((s) => ({ ...s, model: ev.model }))
            }
            break
          case 'model_switch':
            if (ev.to) {
              setCurrentModel(ev.to)
              setStatus((s) => ({ ...s, model: ev.to }))
              onModelSwitchRef.current?.(ev.to)
            }
            break
          case 'state':
            setCoreState(ev.state)
            if (ev.state === 'executing') setActiveTool(ev.tool || null)
            if (ev.state === 'idle' || ev.state === 'error') setActiveTool(null)
            if (ev.state === 'speaking') {
              const ms = Math.round(performance.now() - startRef.current)
              setStatus((s) => ({ ...s, latency: `${(ms / 1000).toFixed(1)} s` }))
            }
            break
          case 'tool_result':
            setMessages((m) => [
              ...m,
              { role: 'tool', tool: ev.tool, content: ev.output },
            ])
            break
          case 'message':
            setMessages((m) => [...m, { role: 'assistant', content: ev.content }])
            onReplyRef.current?.(ev.content)
            break
          case 'error':
            setCoreState('error')
            setMessages((m) => [
              ...m,
              { role: 'assistant', content: `[error] ${ev.message}` },
            ])
            break
          default:
            break
        }
      }

      try {
        const res = await fetch('/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: content, session_id: sessionId }),
        })
        if (!res.ok || !res.body) {
          setCoreState('error')
          setMessages((m) => [
            ...m,
            { role: 'assistant', content: `[error] request failed (${res.status})` },
          ])
          return
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const chunks = buffer.split('\n\n')
          buffer = chunks.pop()
          for (const chunk of chunks) {
            const line = chunk.trim()
            if (!line.startsWith('data:')) continue
            const data = line.slice(5).trim()
            if (!data) continue
            try {
              handleEvent(JSON.parse(data))
            } catch {
              /* ignore malformed frame */
            }
          }
        }
      } catch {
        setCoreState('error')
        setMessages((m) => [
          ...m,
          { role: 'assistant', content: '[error] connection failed' },
        ])
      }
    },
    [sessionId],
  )

  return {
    messages,
    coreState,
    activeTool,
    status,
    tools: TOOLS,
    models,
    currentModel,
    selectModel,
    greet,
    sendMessage,
  }
}
