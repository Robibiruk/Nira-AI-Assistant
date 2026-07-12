// Per-DEVICE chat sessions, stored in localStorage (not the server).
//
// Why: the previous build used a single hardcoded session id ("web") for
// every visitor, so all devices shared ONE chat history on the server. The
// user wants memory to be LOCAL to each device with no sign-in — so we
// mint a device-specific UUID here and key the server's history by it. Each
// browser/device gets its own isolated memory; nothing is shared and
// nothing requires a login. Firebase/MongoDB would be *remote + shared*,
// which is the opposite of the requirement.

const SID_KEY = 'nira.device.session'
const LIST_KEY = 'nira.sessions'

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// The active session id for THIS device. Persisted so reloads keep history.
export function getDeviceSessionId() {
  let id = localStorage.getItem(SID_KEY)
  if (!id) {
    id = `web-${uuid()}`
    localStorage.setItem(SID_KEY, id)
  }
  return id
}

export function listSessions() {
  try {
    return JSON.parse(localStorage.getItem(LIST_KEY) || '[]')
  } catch {
    return []
  }
}

function saveList(list) {
  localStorage.setItem(LIST_KEY, JSON.stringify(list.slice(0, 50)))
}

export function upsertSession(sid, title) {
  const list = listSessions().filter((s) => s.sid !== sid)
  list.unshift({ sid, title: title || 'New chat', updated: Date.now() })
  saveList(list)
}

export function renameSession(sid, title) {
  const list = listSessions().map((s) =>
    s.sid === sid ? { ...s, title: title || s.title } : s,
  )
  saveList(list)
}

export function deleteSession(sid) {
  saveList(listSessions().filter((s) => s.sid !== sid))
}
