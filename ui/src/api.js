// Safe API helper: never throws "Unexpected end of JSON input".
// Returns { ok, status, data, text } even when the body is empty/non-JSON.

// Resolve the backend base URL:
//  - VITE_API_BASE (e.g. https://nira-backend.onrender.com) wins when set (prod/deploy).
//  - On localhost dev, hit the FastAPI backend directly at 127.0.0.1:8000.
//  - Otherwise (deployed SPA with no VITE_API_BASE), use same-origin so a
//    host rewrite/proxy can forward /chat, /sessions, etc. to the backend.
const API_BASE =
  import.meta.env.VITE_API_BASE ||
  (typeof location !== 'undefined' && location.hostname === 'localhost'
    ? 'http://127.0.0.1:8000'
    : '')

export function apiUrl(path) {
  if (!API_BASE) return path
  return API_BASE.replace(/\/+$/, '') + (path.startsWith('/') ? path : '/' + path)
}

export async function apiFetch(path, opts = {}) {
  let res
  try {
    res = await fetch(apiUrl(path), {
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      ...opts,
    })
  } catch (netErr) {
    return { ok: false, status: 0, data: null, text: netErr.message || 'network error' }
  }
  let text = ''
  try {
    text = await res.text()
  } catch {
    text = ''
  }
  let data = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = null // body wasn't JSON (e.g. HTML error / empty)
    }
  }
  return { ok: res.ok, status: res.status, data, text }
}

export function apiError(result, fallback = 'request failed') {
  if (result.data && (result.data.detail || result.data.error)) {
    return result.data.detail || result.data.error
  }
  if (result.status === 0) return result.text || 'cannot reach server'
  return `${fallback} (HTTP ${result.status})`
}
