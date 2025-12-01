// Simple time helpers for countdown displays across views.

// Convert an ISO/date string to a timestamp, returns null if invalid.
export function toMs(value) {
  const ts = new Date(value).getTime()
  return Number.isNaN(ts) ? null : ts
}

// Format a remaining duration in a short "Xd Yh Zm" form.
export function formatDuration(ms) {
  const abs = Math.max(0, Math.trunc(ms))
  const minutesTotal = Math.floor(abs / 60000)
  const days = Math.floor(minutesTotal / (60 * 24))
  const hours = Math.floor((minutesTotal % (60 * 24)) / 60)
  const minutes = minutesTotal % 60
  const parts = []
  if (days) parts.push(`${days}d`)
  if (days || hours) parts.push(`${hours}h`)
  parts.push(`${minutes}m`)
  return parts.join(' ')
}

// Build a countdown object given a target timestamp and current time.
export function countdownTo(targetMs, nowMs = Date.now()) {
  if (targetMs === null || targetMs === undefined) return null
  const diff = targetMs - nowMs
  return {
    raw: diff,
    isPast: diff < 0,
    text: formatDuration(Math.abs(diff)),
  }
}

// Display-friendly date string helper.
export function formatDateTime(value) {
  if (!value) return 'TBD'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
}
