export const severityColor = (s) => ({
  CRITICAL: 'text-red-400', HIGH: 'text-orange-400',
  MEDIUM: 'text-yellow-400', LOW: 'text-green-400', INFORMATIONAL: 'text-blue-400'
}[s?.toUpperCase()] || 'text-gray-400')

export const severityBadge = (s) => ({
  CRITICAL: 'badge-critical', HIGH: 'badge-high',
  MEDIUM: 'badge-medium', LOW: 'badge-low', INFORMATIONAL: 'badge-info'
}[s?.toUpperCase()] || 'badge-info')

export const statusColor = (s) => ({
  new: 'text-blue-400', open: 'text-blue-400', investigating: 'text-yellow-400',
  escalated: 'text-orange-400', closed: 'text-green-400', false_positive: 'text-gray-400'
}[s?.toLowerCase()] || 'text-gray-400')

export const fmtTime = (ts) => {
  if (!ts) return '—'
  try { return new Date(ts).toLocaleString('en-US', { month:'short', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12: false }) }
  catch { return ts }
}

export const fmtAgo = (ts) => {
  if (!ts) return ''
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h/24)}d ago`
}
