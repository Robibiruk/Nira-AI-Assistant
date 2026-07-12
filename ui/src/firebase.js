// Firebase (web) — anonymous auth + Firestore for NIRA's private memory.
//
// The user wanted to "reset the primitive SQLite database" and keep memory
// local-to-device with NO visible sign-in. Firebase Anonymous Auth gives us
// a stable per-browser UID with zero login UI; Firestore stores the chat
// history + name keyed by that UID. Each device/visitor gets its own data,
// nothing is shared server-side, and a fresh/anonymous account = empty memory.
import { initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth'
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore'

// Config. The web apiKey is public by design (Firebase security comes from
// Security Rules + anonymous auth, not key secrecy), but we still load it
// from a Vite env var so the literal isn't hardcoded in source. Set
// VITE_FIREBASE_API_KEY in ui/.env (and in Vercel's env settings).
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: 'nira-ai-assistant.firebaseapp.com',
  projectId: 'nira-ai-assistant',
  storageBucket: 'nira-ai-assistant.firebasestorage.app',
  messagingSenderId: '26053388051',
  appId: '1:26053388051:web:c2948e7aaf9fe80bd5dce6',
  measurementId: 'G-0D4ZLQEKTD',
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

// Sign in anonymously (no UI). Resolves with the UID, or rejects on error
// (e.g. anonymous auth not enabled in the console).
export function signInAnon() {
  return signInAnonymously(auth).then((c) => c.user.uid)
}

// Resolve the current UID (await ready() first). Returns '' if signed out.
export function uid() {
  return auth.currentUser?.uid || ''
}

// One-time promise that resolves once auth state is known.
export function authReady() {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (u) => {
      unsub()
      resolve(u?.uid || '')
    })
  })
}

// ---- Firestore data model ---------------------------------------------------
//   users/{uid}/profile  -> { name, updated }
//   users/{uid}/sessions/{sid} -> { title, updated, messages: [...] }
// Messages are embedded in the session doc for simplicity (small chats).
// ---------------------------------------------------------------------------

const userRef = (id) => doc(db, 'users', id)

export async function saveName(name) {
  const id = uid()
  if (!id) return
  await setDoc(userRef(id), { name, updated: serverTimestamp() }, { merge: true })
}

export async function loadName() {
  const id = uid()
  if (!id) return ''
  const snap = await getDoc(userRef(id))
  return snap.exists() ? snap.data().name || '' : ''
}

const sessionRef = (id, sid) => doc(db, 'users', id, 'sessions', sid)

export async function saveSession(sid, title, messages) {
  const id = uid()
  if (!id) return
  await setDoc(
    sessionRef(id, sid),
    { title: title || 'New chat', updated: serverTimestamp(), messages },
    { merge: true },
  )
}

export async function loadSession(sid) {
  const id = uid()
  if (!id) return { title: 'New chat', messages: [] }
  const snap = await getDoc(sessionRef(id, sid))
  return snap.exists()
    ? { title: snap.data().title || 'New chat', messages: snap.data().messages || [] }
    : { title: 'New chat', messages: [] }
}

export async function listSessions() {
  const id = uid()
  if (!id) return []
  const q = query(collection(db, 'users', id, 'sessions'), orderBy('updated', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => {
    const data = d.data()
    return { sid: d.id, title: data.title || 'New chat', updated: data.updated || null }
  })
}

export async function deleteSessionFs(sid) {
  const id = uid()
  if (!id) return
  await deleteDoc(sessionRef(id, sid))
}
