// Local-first persistence. Memory MUST work even if Firebase auth/rules
// aren't perfectly configured, so we keep an authoritative copy in
// localStorage and mirror to Firestore when available (see firebase.js).
// Every write goes to localStorage first; Firebase is best-effort sync.

const NKEY = 'nira_name'
const SKEY = 'nira_sessions_v1'
const PKEY = 'nira_projects_v1'

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}
function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* quota / private mode — ignore, Firebase may still work */
  }
}

// ---- Name ------------------------------------------------------------------
export function lsGetName() {
  return localStorage.getItem(NKEY) || ''
}
export function lsSetName(n) {
  if (n) localStorage.setItem(NKEY, n)
  else localStorage.removeItem(NKEY)
}

// ---- Sessions (chats) ------------------------------------------------------
export function lsGetSessions() {
  return readJSON(SKEY, {})
}
export function lsGetSession(sid) {
  return lsGetSessions()[sid] || null
}
// Alias used by App (kept for readability at call sites).
export const lsGetSessionsSafe = lsGetSession
export function lsSaveSession(sid, title, messages, projectId) {
  const all = lsGetSessions()
  all[sid] = {
    sid,
    title: title || 'New chat',
    updated: Date.now(),
    messages: messages || [],
    projectId: projectId !== undefined ? projectId : (all[sid]?.projectId || null),
  }
  writeJSON(SKEY, all)
  return all[sid]
}
export function lsSetSessionProject(sid, projectId) {
  const all = lsGetSessions()
  if (all[sid]) {
    all[sid].projectId = projectId
    writeJSON(SKEY, all)
  }
}
export function lsDeleteSession(sid) {
  const all = lsGetSessions()
  delete all[sid]
  writeJSON(SKEY, all)
}
export function lsListSessions() {
  return Object.values(lsGetSessions()).sort((a, b) => (b.updated || 0) - (a.updated || 0))
}

// ---- Projects --------------------------------------------------------------
export function lsGetProjects() {
  return readJSON(PKEY, {})
}
export function lsSaveProject(p) {
  const all = lsGetProjects()
  all[p.pid] = { ...p, updated: Date.now() }
  writeJSON(PKEY, all)
  return all[p.pid]
}
export function lsDeleteProject(pid) {
  const all = lsGetProjects()
  delete all[pid]
  writeJSON(PKEY, all)
  // Detach its sessions (keep the chat, just remove the project link).
  const sessions = lsGetSessions()
  for (const sid of Object.keys(sessions)) {
    if (sessions[sid].projectId === pid) sessions[sid].projectId = null
  }
  writeJSON(SKEY, sessions)
}
export function lsListProjects() {
  return Object.values(lsGetProjects()).sort((a, b) => (b.updated || 0) - (a.updated || 0))
}
