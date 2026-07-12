import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch, apiUrl } from '../api'
import { SLASH_COMMANDS, parseSlash } from '../slash'
import { loadName } from '../firebase'

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
  const { onModelSwitch, onReply, onText } = options
  const [messages, setMessages] = useState([])
  const messagesRef = useRef(messages)
  // Keep a live ref of messages so the streaming POST can read history
  // without stale closure issues.
  messagesRef.current = messages
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

  // Session id is mutable so resuming a past session doesn't recreate the hook.
  const sessionIdRef = useRef(sessionId)
  const startRef = useRef(0)
  const onModelSwitchRef = useRef(onModelSwitch)
  const onReplyRef = useRef(onReply)
  const onTextRef = useRef(onText)
  onModelSwitchRef.current = onModelSwitch
  onReplyRef.current = onReply
  onTextRef.current = onText

  const setSessionId = useCallback((id) => {
    sessionIdRef.current = id
  }, [])

  // Load the free model list + current selection on mount.
  useEffect(() => {
    apiFetch('/models').then((r) => {
      if (!r.ok || !r.data) return
      // De-duplicate by id (defense-in-depth against backend repeats).
      const seen = new Set()
      const unique = (r.data.models || []).filter((m) => {
        if (!m || !m.id || seen.has(m.id)) return false
        seen.add(m.id)
        return true
      })
      setModels(unique)
      if (r.data.current) setCurrentModel(r.data.current)
    })
  }, [])

  const selectModel = useCallback(async (id) => {
    try {
      const r = await apiFetch('/models/select', {
        method: 'POST',
        body: JSON.stringify({ model: id }),
      })
      if (r.ok && r.data) {
        setCurrentModel(r.data.current)
        setStatus((s) => ({ ...s, model: r.data.current }))
      }
    } catch {
      /* ignore */
    }
  }, [])

  const greet = useCallback((name) => {
    setMessages([{ role: 'assistant', content: `Hello, ${name}! How can I help you today?` }])
  }, [])

  // Replace current messages with a saved session's history (for resume).
  const loadMessages = useCallback((msgs) => {
    setMessages(msgs || [])
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
          case 'text':
            // Incremental token chunk — append to the streaming assistant
            // message and hand it to the voice layer for sentence TTS.
            setMessages((m) => {
              const copy = m.slice()
              const last = copy[copy.length - 1]
              if (last && last.role === 'assistant' && last.streaming) {
                copy[copy.length - 1] = {
                  ...last,
                  content: (last.content || '') + ev.content,
                }
              } else {
                copy.push({ role: 'assistant', content: ev.content, streaming: true })
              }
              return copy
            })
            onTextRef.current?.(ev.content)
            break
          case 'tool_result':
            setMessages((m) => [
              ...m,
              { role: 'tool', tool: ev.tool, content: ev.output },
            ])
            break
          case 'message':
            // Final full message (also covers non-streaming replies).
            setMessages((m) => {
              const copy = m.slice()
              const last = copy[copy.length - 1]
              if (last && last.role === 'assistant' && last.streaming) {
                copy[copy.length - 1] = {
                  ...last,
                  content: ev.content,
                  streaming: false,
                }
              } else {
                copy.push({ role: 'assistant', content: ev.content })
              }
              return copy
            })
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
        }
      }

      try {
        // Send the client-owned history + name so the (SQLite-free) server
        // has context. History = prior turns; the new user message is added
        // by the server. Name lets it greet personally.
        const history = messagesRef.current.map((m) => ({
          role: m.role,
          content: m.content,
        }))
        let name = ''
        try {
          name = (await loadName()) || ''
        } catch {
          name = ''
        }
        const res = await fetch(apiUrl('/chat/stream'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: content,
            session_id: sessionIdRef.current,
            history,
            name,
          }),
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

  // Slash command runner — model-independent. Calls POST /tools/run directly.
  const runSlashCommand = useCallback(async (text) => {
    const content = text.trim()
    const parsed = parseSlash(content)
    if (!parsed) return false
    if (parsed.unknown) {
      setMessages((m) => [
        ...m,
        { role: 'user', content },
        { role: 'assistant', content: `Unknown command: /${parsed.unknown}. Type / to see available commands.` },
      ])
      return true
    }
    if (parsed.command === 'help') {
      const list = SLASH_COMMANDS.map((c) => `• /${c.cmd} — ${c.label}`).join('\n')
      setMessages((m) => [
        ...m,
        { role: 'user', content },
        { role: 'assistant', content: `Available commands:\n${list}` },
      ])
      return true
    }

    const { def, rest } = parsed
    if (!def || typeof def.arg !== 'function') {
      setMessages((m) => [
        ...m,
        { role: 'user', content },
        { role: 'assistant', content: `Unknown command. Type / to see available commands.` },
      ])
      return true
    }
    const args = def.arg(rest || '')
    setMessages((m) => [...m, { role: 'user', content }])
    setCoreState('executing')
    setActiveTool(def.tool)
    try {
      const r = await apiFetch('/tools/run', {
        method: 'POST',
        body: JSON.stringify({ name: def.tool, arguments: args }),
      })
      const result = r.ok && r.data ? r.data.result : `Error: ${r.status || 'request failed'}`
      setMessages((m) => [...m, { role: 'tool', tool: def.tool, content: result }])
    } catch (e) {
      setMessages((m) => [...m, { role: 'tool', tool: def.tool, content: `Error: ${e.message}` }])
    } finally {
      setActiveTool(null)
      setCoreState('idle')
    }
    return true
  }, [])

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
    runSlashCommand,
    setSessionId,
    loadMessages,
  }
}
