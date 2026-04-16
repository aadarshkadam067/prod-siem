import React, { useMemo, useState } from 'react'
import { useStore } from '../store'
import { Zap, AlertTriangle, Brain, FolderOpen, CheckCircle, Search, Activity } from 'lucide-react'
import clsx from 'clsx'

const TYPE_CONFIG = {
  alert_created: { icon: AlertTriangle, color: 'text-mars-400',    bg: 'bg-mars-700/10',    label: 'Alert'  },
  ai_decision:   { icon: Brain,         color: 'text-purple-400',  bg: 'bg-purple-500/10',  label: 'AI'     },
  case_created:  { icon: FolderOpen,    color: 'text-blue-400',    bg: 'bg-blue-500/10',    label: 'Case'   },
  case_closed:   { icon: CheckCircle,   color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Closed' },
  ioc_enriched:  { icon: Search,        color: 'text-cyan-400',    bg: 'bg-cyan-500/10',    label: 'IOC'    },
  default:       { icon: Zap,           color: 'text-gray-400',    bg: 'bg-gray-500/10',    label: 'Event'  },
}

const SEV_COLOR = {
  critical: 'text-red-400',
  high:     'text-amber-400',
  medium:   'text-yellow-400',
  low:      'text-emerald-400',
  info:     'text-blue-400',
}

export default function ActivityLog() {
  const { activity, alerts, cases } = useStore()
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  // If the backend activity log is empty, derive events from alerts/cases in store.
  // This keeps the page useful before any real activity comes in over WS.
  const derived = useMemo(() => {
    const acts = [...activity]

    if (acts.length === 0) {
      alerts.forEach(a => {
        acts.push({
          id: `alert-${a.id}`,
          type: 'alert_created',
          message: `Alert created: ${a.event_type} from ${a.source_ip || 'unknown'} [${a.severity}]`,
          severity: a.severity?.toLowerCase(),
          timestamp: a.timestamp
        })
        if (a.ai_analysis) {
          acts.push({
            id: `ai-${a.id}`,
            type: 'ai_decision',
            message: `AI decision: ${a.ai_analysis.decision?.toUpperCase()} — ${a.id} (${a.ai_analysis.confidence}% confidence)`,
            severity: a.ai_analysis.severity?.toLowerCase(),
            timestamp: a.analyzed_at || a.timestamp
          })
        }
      })

      cases.forEach(c => {
        acts.push({
          id: `case-${c.id}`,
          type: 'case_created',
          message: `Case created: ${c.id} — ${c.title}`,
          severity: c.severity?.toLowerCase(),
          timestamp: c.created_at
        })
        if (c.status === 'closed') {
          acts.push({
            id: `closed-${c.id}`,
            type: 'case_closed',
            message: `Case closed: ${c.id} — ${c.close_reason || 'Resolved'}`,
            severity: 'low',
            timestamp: c.closed_at || c.updated_at
          })
        }
      })

      acts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    }

    return acts
  }, [activity, alerts, cases])

  const filtered = derived.filter(a => {
    if (filter !== 'all' && a.type !== filter) return false
    if (search && !a.message.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const counts = derived.reduce((acc, a) => {
    acc[a.type] = (acc[a.type] || 0) + 1
    return acc
  }, {})

  return (
    <div className="p-6 animate-slide-in" data-testid="activity-log-page">
      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {Object.entries(TYPE_CONFIG).filter(([k]) => k !== 'default').map(([type, cfg]) => (
          <button
            key={type}
            onClick={() => setFilter(filter === type ? 'all' : type)}
            data-testid={`activity-filter-${type}`}
            className={clsx(
              'card-glow text-center transition-all duration-200',
              filter === type && 'border-mars-700/50 bg-mars-900/10 scale-105'
            )}
          >
            <div className={clsx('w-10 h-10 rounded-lg mx-auto mb-2 flex items-center justify-center', cfg.bg)}>
              <cfg.icon size={18} className={cfg.color} />
            </div>
            <div className={clsx('text-2xl font-bold font-mono mb-0.5', cfg.color)}>{counts[type] || 0}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">{cfg.label}</div>
          </button>
        ))}
      </div>

      {/* Search + Clear */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search activity..."
            data-testid="activity-search"
            className="input-dark pl-10"
          />
        </div>
        <button
          onClick={() => { setFilter('all'); setSearch('') }}
          className="btn-secondary"
        >
          Clear Filters
        </button>
      </div>

      {/* Activity Timeline */}
      <div className="card-glow">
        <div className="relative">
          <div className="absolute left-5 top-0 bottom-0 w-px bg-gradient-to-b from-mars-700/30 via-bg-border to-transparent" />
          <div className="space-y-0">
            {filtered.length === 0 && (
              <div className="pl-12 py-16 text-center">
                <Activity size={40} className="text-gray-700 mx-auto mb-3" />
                <div className="text-gray-500 text-sm">No activity found</div>
                <div className="text-gray-600 text-xs mt-1">Try adjusting your filters</div>
              </div>
            )}
            {filtered.map((item, i) => {
              const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.default
              const Icon = cfg.icon
              const isLast = i === filtered.length - 1
              return (
                <div
                  key={item.id || i}
                  className={clsx(
                    'flex items-start gap-4 pl-12 py-4 relative transition-colors hover:bg-mars-900/5',
                    !isLast && 'border-b border-bg-border/30'
                  )}
                >
                  <div className={clsx('absolute left-3.5 w-4 h-4 rounded-full flex items-center justify-center -translate-x-0.5 mt-0.5', cfg.bg)}>
                    <div className={clsx('w-2 h-2 rounded-full', cfg.color.replace('text-', 'bg-'))} />
                  </div>

                  <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', cfg.bg)}>
                    <Icon size={14} className={cfg.color} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-gray-300 text-sm leading-relaxed">{item.message}</p>
                    {item.metadata && Object.keys(item.metadata).length > 0 && (
                      <div className="flex gap-3 mt-1.5 flex-wrap">
                        {Object.entries(item.metadata).slice(0, 3).map(([k, v]) => (
                          <span key={k} className="text-[10px] text-gray-600 font-mono bg-bg-panel px-2 py-0.5 rounded">
                            {k}: {String(v).slice(0, 30)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 text-right">
                    {item.severity && (
                      <div className={clsx('text-[10px] font-mono font-semibold mb-1', SEV_COLOR[item.severity] || 'text-gray-500')}>
                        {item.severity.toUpperCase()}
                      </div>
                    )}
                    <div className="text-[10px] text-gray-600 font-mono">
                      {item.timestamp ? new Date(item.timestamp).toLocaleTimeString('en-US', { hour12: false }) : ''}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
