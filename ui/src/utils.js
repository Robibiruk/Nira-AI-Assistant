// Defensive date formatting. Firestore serverTimestamp() returns a
// Timestamp object (not a number), localStorage stores Date.now() as a
// number, and some fields may be null. This handles all of them so we
// never render "Invalid Date".
export function formatDate(value) {
  if (!value) return '—'
  let d
  // Firestore Timestamp (from serverTimestamp()) has a toDate() method.
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    try { d = value.toDate() } catch { return '—' }
  } else if (typeof value === 'number') {
    d = new Date(value)
  } else if (typeof value === 'string') {
    d = new Date(value)
  } else {
    d = new Date(value)
  }
  if (!d || isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// Short date (used on project cards / summaries).
export function formatShortDate(value) {
  if (!value) return '—'
  let d
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    try { d = value.toDate() } catch { return '—' }
  } else if (typeof value === 'number') {
    d = new Date(value)
  } else if (typeof value === 'string') {
    d = new Date(value)
  } else {
    d = new Date(value)
  }
  if (!d || isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
