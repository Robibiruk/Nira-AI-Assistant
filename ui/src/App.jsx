import { useEffect, useRef, useState } from 'react'
import LeftSidebar from './components/LeftSidebar'
import RightSidebar from './components/RightSidebar'
import Conversation from './components/Conversation'
import ChatInput from './components/ChatInput'
import NameModal from './components/NameModal'
import { useNira } from './hooks/useNira'
import { useVoice, speakNira } from './hooks/useVoice'

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
  const [streaming, setStreaming] = useState(false)

  const voiceOnRef = useRef(voiceOn)
  voiceOnRef.current = voiceOn

  const { messages, coreState, activeTool, status, tools, models, currentModel, selectModel, greet, sendMessage } =
    useNira('web', {
      onModelSwitch: (to) => {
        setToast(`Switched to ${to} (limit reached)`)
        setTimeout(() => setToast(''), 3500)
      },
      onReply: (text) => {
        if (voiceOnRef.current) speakRef.current(text)
      },
    })

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
    fetch('/prefs/name', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: n, session_id: 'web' }),
    }).catch(() => {})
    greet(n)
    speakNira(`Hello, ${n}. How can I help you today?`)
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

  // Wrap sendMessage to flag streaming state.
  const sendWrapped = (text) => {
    setStreaming(true)
    sendMessage(text)
    // Clear streaming shortly after; the hook appends the reply.
    setTimeout(() => setStreaming(false), 1200)
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
    <div className="app">
      {showNameModal && <NameModal onSubmit={handleName} />}
      {toast && <div className="toast">{toast}</div>}

      <LeftSidebar
        coreState={effectiveState}
        activeTool={activeTool}
        userName={name}
        activePage={activePage}
        onPage={setActivePage}
        voiceOn={voiceOn}
        voiceSupported={voiceSupported}
        micActive={micActive}
        onToggleVoice={toggleVoice}
        onInterrupt={() => stopMic()}
      />

      <div className="column center">
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
      </div>

      <RightSidebar
        activity={activity}
        status={status}
        coreState={coreState}
        models={models}
        currentModel={currentModel}
        onSelectModel={selectModel}
      />
    </div>
  )
}
