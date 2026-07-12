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
import {
  authReady,
  signInAnon,
  loadName,
  saveName,
  listSessions,
  saveSession,
  deleteSessionFs,
} from './firebase'

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

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
  const [name, setName] = useState('')
  const [showNameModal, setShowNameModal] = useState(false)
  const [authReadyState, setAuthReadyState] = useState(false)
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
  const [sessionId, setSessionIdState] = useState(() => `web-${uuid()}`)
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showGreeting, setShowGreeting] = useState(false)

  // Boot: loading screen -> greeting; sign in anonymously + load saved name.
  useEffect(() => {
    const hideLoading = setTimeout(() => setLoading(false), 1400)
    const showWelcome = setTimeout(() => setShowGreeting(true), 1400)
    reportDeviceApps()
    authReady()
      .then((uid) => {
        if (!uid) return signInAnon() // first visit -> anonymous account
        return uid
      })
      .then(() => loadName())
      .then((saved) => {
        setAuthReadyState(true)
        if (saved) {
          setName(saved)
          setShowNameModal(false)
        } else {
          setShowNameModal(true)
        }
      })
      .catch(() => {
        // Firebase unavailable (offline / not configured) — degrade to a
        // local-only name prompt without crashing the app.
        setAuthReadyState(true)
        setShowNameModal(true)
      })
    return () => { clearTimeout(hideLoading); clearTimeout(showWelcome) }
  }, [])

  const refreshProviders = () => {
    apiFetch('/providers').then((r) => r.ok && setProvidersInfo(r.data || {}))
    apiFetch('/providers/custom').then((r) => r.ok && setCustom((r.data && r.data.custom) || []))
  }
  const refreshToolKeys = () => {
    apiFetch('/tools/keys').then((r) => r.ok && setToolKeys((r.data && r.data.keys) || {}))
  }

  // Load saved chat sessions for THIS anonymous user (Firestore).
  const refreshSessions = () => {
    listSessions().then(setSessions).catch(() => {})
  }

  // Persist the current transcript to Firestore (called after each reply).
  const persist = () => {
    const msgs = messagesRef.current
    if (!msgs.length) return
    const title = (msgs.find((m) => m.role === 'user')?.content || 'New chat')
      .slice(0, 80)
    saveSession(sessionId, title, msgs).catch(() => {})
  }

  const handleNewChat = () => {
    const id = `web-${uuid()}`
    setSessionIdState(id)
    nira.setSessionId(id)
    nira.loadMessages([])
    setActivePage('chat')
  }

  // Resume a past session: load its messages from Firestore.
  const handleResume = (sid) => {
    setSessionIdState(sid)
    nira.setSessionId(sid)
    loadSessionSafe(sid)
    setActivePage('chat')
  }

  const loadSessionSafe = (sid) => {
    import('./firebase').then((m) =>
      m.loadSession(sid).then((s) => nira.loadMessages(s.messages || [])).catch(() => {}),
    )
  }

  const handleRename = (sid, title) => {
    // Firestore session titles are derived on save; rename is a no-op here
    // but we keep the call harmless. (Lightweight: re-save with new title.)
    const existing = sessions.find((s) => s.sid === sid)
    if (existing) saveSession(sid, title || existing.title, []).catch(() => {})
    refreshSessions()
  }

  const handleDelete = (sid) => {
    deleteSessionFs(sid).then(() => {
      if (sid === sessionId) handleNewChat()
      refreshSessions()
    }).catch(() => {})
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

  const nira = useNira(sessionId, {
    onModelSwitch: (to) => {
      setToast(`Switched to ${to} (limit reached)`)
      setTimeout(() => setToast(''), 3500)
    },
    onReply: (text) => {
      // Final transcript received — flush any remaining buffered speech so the
      // last (possibly punctuation-less) sentence is spoken.
      enqueueNira('', { stream: true, flush: true })
      persist()
    },
    onText: (chunk) => {
      if (voiceOnRef.current) enqueueNira(chunk, { stream: true })
    },
  })

  const { messages, coreState, activeTool, status, tools, models, currentModel, selectModel, greet, sendMessage } = nira
  const messagesRef = useRef(messages)
  messagesRef.current = messages

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
    setName(n)
    setShowNameModal(false)
    // Anonymous sign-up + save name to Firestore (no visible login).
    signInAnon()
      .then(() => saveName(n))
      .catch(() => {})
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
