// Safe API helper: never throws "Unexpected end of JSON input".
// Returns { ok, status, data, text } even when the body is empty/non-JSON.
export async function apiFetch(path, opts = {}) {
  let res
  try {
    res = await fetch(path, {
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
