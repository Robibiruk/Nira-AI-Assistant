import { useEffect, useRef, useState } from 'react'
import LeftSidebar from './components/LeftSidebar'
import MenuToggle from './components/MenuToggle'
import RightSidebar from './components/RightSidebar'
import Conversation from './components/Conversation'
import ChatInput from './components/ChatInput'
import SettingsPanel from './components/SettingsPanel'
import NameModal from './components/NameModal'
import MemoryPage from './components/MemoryPage'
import AppsPage from './components/AppsPage'
import BrowserPage from './components/BrowserPage'
import ResearchPage from './components/ResearchPage'
import AboutPage from './components/AboutPage'
import LoadingScreen from './components/LoadingScreen'
import GreetingOverlay from './components/GreetingOverlay'
import { useNira } from './hooks/useNira'
import { useVoice, speakNira, stopSpeech, enqueueNira } from './hooks/useVoice'
import { apiFetch, apiUrl } from './api'
import { reportDeviceApps } from './device'

const NAME_KEY = 'nira_name'

function activityFrom(messages) {
  const out = []
  for (const m of messages) {
    if (m.role === 'tool') {
      out.push({ icon: '⚙', text: `Ran ${m.tool || 'tool'}` })
    } else if (m.role === 'user') {
      out.push({ icon: '💬', text: 'You said something' })
    } else if (m.role === 'assistant') {
      out.push({ icon: '◆', text: 'NIRA replied' })
    }
  }
  return out.slice(-12).reverse()
}

export default function App() {
  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) || '')
  const [showNameModal, setShowNameModal] = useState(
    () => !localStorage.getItem(NAME_KEY),
  )
  const [toast, setToast] = useState('')
  const [voiceOn, setVoiceOn] = useState(false)
  const [activePage, setActivePage] = useState('chat')
  const [navOpen, setNavOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [providersInfo, setProvidersInfo] = useState({ configured: [], active: [] })
  const [custom, setCustom] = useState([])
  const [toolKeys, setToolKeys] = useState({})
  const [features, setFeatures] = useState({})
  const [sessionId, setSessionIdState] = useState(() => `web-${Date.now()}`)
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showGreeting, setShowGreeting] = useState(false)

  // Boot sequence: show NIRA loading screen, then immediately switch to the welcome
  // greeting (which is a full-screen fixed overlay, so it covers the app — no gap).
  useEffect(() => {
    const hideLoading = setTimeout(() => setLoading(false), 1400)
    const showWelcome = setTimeout(() => setShowGreeting(true), 1400)
    // Report device type + any client-visible apps so "list apps" works on
    // every platform (Android / iOS / PC), not just Windows.
    reportDeviceApps()
    return () => { clearTimeout(hideLoading); clearTimeout(showWelcome) }
  }, [])

  const refreshProviders = () => {
    apiFetch('/providers').then((r) => r.ok && setProvidersInfo(r.data || {}))
    apiFetch('/providers/custom').then((r) => r.ok && setCustom((r.data && r.data.custom) || []))
  }
  const refreshToolKeys = () => {
    apiFetch('/tools/keys').then((r) => r.ok && setToolKeys((r.data && r.data.keys) || {}))
  }

  // Load saved chat sessions (with auto titles) for the Memory page.
  const refreshSessions = () => {
    apiFetch('/sessions').then((r) => r.ok && setSessions((r.data && r.data.sessions) || []))
  }

  // Start a fresh session: new id, empty transcript.
  const handleNewChat = () => {
    const id = `web-${Date.now()}`
    setSessionIdState(id)
    nira.setSessionId(id)
    nira.loadMessages([])
    setActivePage('chat')
  }

  // Resume a past session: load its messages into the transcript.
  const handleResume = (sid) => {
    apiFetch(`/sessions/${sid}`).then((r) => {
      if (!r.ok) return
      setSessionIdState(sid)
      nira.setSessionId(sid)
      nira.loadMessages(r.data.messages || [])
      setActivePage('chat')
    })
  }

  const handleRename = (sid, title) => {
    if (!title || !title.trim()) return
    apiFetch('/sessions/rename', {
      method: 'POST',
      body: JSON.stringify({ sid, title: title.trim() }),
    }).then(() => refreshSessions())
  }

  const handleDelete = (sid) => {
    apiFetch('/sessions/delete', {
      method: 'POST',
      body: JSON.stringify({ sid }),
    }).then(() => refreshSessions())
  }

  // Load persisted feature toggles once on mount.
  useEffect(() => {
    apiFetch('/features').then((r) => r.ok && setFeatures((r.data || {})))
  }, [])

  const toggleFeature = (q) => {
    const next = !features[q.id]
    setFeatures((f) => ({ ...f, [q.id]: next }))
    apiFetch('/features', {
      method: 'POST',
      body: JSON.stringify({ name: q.id, enabled: next }),
    })
    setToast(`${q.label} ${next ? 'enabled' : 'disabled'}`)
    setTimeout(() => setToast(''), 1600)
  }

  useEffect(() => {
    if (activePage === 'settings') { refreshProviders(); refreshToolKeys() }
    if (['memory', 'apps', 'browser', 'research'].includes(activePage)) refreshSessions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePage])

  const voiceOnRef = useRef(voiceOn)
  voiceOnRef.current = voiceOn

  const nira = useNira('web', {
    onModelSwitch: (to) => {
      setToast(`Switched to ${to} (limit reached)`)
      setTimeout(() => setToast(''), 3500)
    },
    onReply: (text) => {
      // Final transcript received — flush any remaining buffered speech so the
      // last (possibly punctuation-less) sentence is spoken.
      enqueueNira('', { stream: true, flush: true })
    },
    onText: (chunk) => {
      if (voiceOnRef.current) enqueueNira(chunk, { stream: true })
    },
  })

  const { messages, coreState, activeTool, status, tools, models, currentModel, selectModel, greet, sendMessage } = nira

  const { supported: voiceSupported, micActive, startMic, stopMic, speak } = useVoice({
    enabled: voiceOn,
    onTranscript: (t) => {
      stopMic()
      sendMessage(t)
    },
  })
  const speakRef = useRef(speak)
  speakRef.current = speak

  // Greet on load if we already know the name.
  const greetedRef = useRef(false)
  useEffect(() => {
    if (name && !greetedRef.current) {
      greet(name)
      greetedRef.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleVoice = () => setVoiceOn((v) => !v)

  const handleName = (n) => {
    localStorage.setItem(NAME_KEY, n)
    setName(n)
    setShowNameModal(false)
    fetch(apiUrl('/prefs/name'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: n, session_id: 'web' }),
    }).catch(() => {})
    greet(n)
    speakNira(`Hello, ${n}. How can I help you today?`)
  }

  const handleQuickAction = (q) => {
    const preset = q.prompt || ''
    const input = window.prompt(`${q.label}: describe what you want`, preset)
    if (input === null) return // cancelled
    sendWrapped(input.trim() || preset)
  }

  const handleUseTool = (toolId, params) => {
    const toolInfo = tools.find((t) => t.id === toolId)
    const label = toolInfo?.label || toolId
    const keys = Object.keys(params || {})
    if (keys.length === 0) {
      sendMessage(`Use ${label}`)
    } else if (keys.length === 1) {
      sendMessage(`${label}: ${params[keys[0]]}`)
    } else {
      const parts = keys.map((k) => `${k}=${params[k]}`)
      sendMessage(`${label} with ${parts.join(', ')}`)
    }
  }

  // Wrap sendMessage to flag streaming state. Slash commands bypass the LLM
  // and run tools directly via /tools/run.
  const [requesting, setRequesting] = useState(false)
  const sendWrapped = (text) => {
    if (text && text.trim().startsWith('/')) {
      setStreaming(true)
      nira.runSlashCommand(text).finally(() => {
        setTimeout(() => { setStreaming(false); setRequesting(false) }, 800)
      })
      return
    }
    setStreaming(true)
    setRequesting(true)
    sendMessage(text)
    setTimeout(() => { setStreaming(false); setRequesting(false) }, 1600)
  }

  // Close any open drawer (clicking the scrim).
  const closeDrawers = () => {
    setNavOpen(false)
    setActivityOpen(false)
  }

  const onCoreTap = () => {
    if (micActive) { stopMic(); return }
    if (voiceOn) { stopSpeech(); return } // interrupt speech
    if (voiceSupported) startMic()
  }

  const busy = coreState === 'thinking' || coreState === 'executing'
  const effectiveState = micActive && coreState === 'idle' ? 'listening' : coreState
  const activity = activityFrom(messages)

  const greetingPart = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'morning'
    if (h < 18) return 'afternoon'
    return 'evening'
  })()

  return (
    <div className={`app ${navOpen ? 'nav-open' : ''} ${activityOpen ? 'activity-open' : ''} ${activePage === 'about' ? 'app-no-right app-about' : ''}`}>
      <LoadingScreen visible={loading} />
      {showGreeting && (
        <GreetingOverlay name={name} onDone={() => setShowGreeting(false)} />
      )}
      {/* Tablet: ⚙ gear only (top-right). Mobile: ☰ (left) + ⚙ gear (right). */}
      <div className="topbar">
        <MenuToggle open={navOpen} onClick={() => { setActivityOpen(false); setNavOpen((v) => !v) }} />
        <div className="brand-sm">NIRA</div>
        <button className="icon-btn settings-toggle" title="Models & settings" onClick={() => { setNavOpen(false); setActivityOpen((v) => !v) }}>⚙</button>
      </div>

      {showNameModal && <NameModal onSubmit={handleName} />}
      {toast && <div className="toast">{toast}</div>}
      <div className="scrim" onClick={closeDrawers} />

      <LeftSidebar
        coreState={effectiveState}
        activeTool={activeTool}
        userName={name}
        activePage={activePage}
        onPage={(p) => { setNavOpen(false); setActivePage(p) }}
        requesting={requesting}
        speaking={voiceOn}
        voiceSupported={voiceSupported}
        micActive={micActive}
        onCoreTap={onCoreTap}
        onNewChat={handleNewChat}
      />

      <div className="column center">
        {activePage === 'settings' ? (
          <SettingsPanel
            providers={providersInfo}
            custom={custom}
            toolKeys={toolKeys}
            onAdd={refreshProviders}
            onRemove={refreshProviders}
            onToolKey={refreshToolKeys}
          />
        ) : activePage === 'memory' ? (
          <MemoryPage
            sessions={sessions}
            onResume={handleResume}
            onRename={handleRename}
            onDelete={handleDelete}
            onNewChat={handleNewChat}
          />
        ) : activePage === 'apps' ? (
          <AppsPage onSend={sendWrapped} />
        ) : activePage === 'browser' ? (
          <BrowserPage onSend={sendWrapped} />
        ) : activePage === 'research' ? (
          <ResearchPage onSend={sendWrapped} />
        ) : activePage === 'about' ? (
          <AboutPage onSend={(text) => { setActivePage('chat'); sendWrapped(text) }} />
        ) : (
          <>
            <div className="center-header">
              <h1 className="center-greeting">
                Good {greetingPart}, <span className="accent">{name || 'there'}</span>.
              </h1>
              <p className="center-sub">How can I help today?</p>
            </div>
            <Conversation messages={messages} streaming={streaming} />
            <ChatInput
              onSend={sendWrapped}
              disabled={busy}
              micActive={micActive}
              voiceSupported={voiceSupported}
              onToggleMic={() => (micActive ? stopMic() : startMic())}
            />
          </>
        )}
      </div>

      {activePage !== 'about' && (
        <RightSidebar
          activity={activity}
          status={status}
          coreState={coreState}
          models={models}
          currentModel={currentModel}
          onSelectModel={selectModel}
          onQuickAction={handleQuickAction}
          features={features}
          onToggleFeature={toggleFeature}
          voiceOn={voiceOn}
          voiceSupported={voiceSupported}
          onToggleVoice={toggleVoice}
        />
      )}

    </div>
  )
}
