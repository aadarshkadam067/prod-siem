import React from 'react'
import { useStore } from '../store'
import { getSystemStatus, getMetrics } from '../services/api'
import { usePolling } from '../hooks/usePolling'
import { Server, Database, Brain, Zap, Activity, CheckCircle, XCircle, AlertCircle, Cpu, HardDrive } from 'lucide-react'
import clsx from 'clsx'

// Defined outside the component — these never change at runtime
const SERVICES = [
  { key: 'backend',       label: 'FastAPI Backend',  icon: Server,   desc: 'Core API Server'    },
  { key: 'elasticsearch', label: 'Elasticsearch',    icon: Database, desc: 'Search & Analytics' },
  { key: 'redis',         label: 'Redis Queue',      icon: Zap,      desc: 'Message Queue'      },
  { key: 'thehive',       label: 'TheHive',          icon: Activity, desc: 'Case Management'    },
  { key: 'cortex',        label: 'Cortex',           icon: Cpu,      desc: 'Analysis Engine'    },
  { key: 'groq',          label: 'Groq AI (LLaMA)',  icon: Brain,    desc: 'AI Processing'      },
]

const StatusIcon = ({ online, degraded }) => {
  if (online && !degraded) return <CheckCircle size={16} className="text-emerald-400" />
  if (degraded) return <AlertCircle size={16} className="text-amber-400" />
  return <XCircle size={16} className="text-red-400" />
}

const StatusBadge = ({ status }) => {
  const styles = {
    online:   'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    green:    'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    yellow:   'bg-amber-500/15 text-amber-400 border-amber-500/30',
    degraded: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    offline:  'bg-red-500/15 text-red-400 border-red-500/30',
    red:      'bg-red-500/15 text-red-400 border-red-500/30',
    unknown:  'bg-gray-500/15 text-gray-400 border-gray-500/30',
  }
  return (
    <span className={clsx(
      'text-[10px] px-2.5 py-1 rounded-md font-mono border uppercase font-semibold',
      styles[status?.toLowerCase()] || styles.unknown
    )}>
      {status || 'unknown'}
    </span>
  )
}

export default function Metrics() {
  const { systemStatus, metrics, setSystemStatus, setMetrics, alerts, cases } = useStore()

  usePolling(async () => {
    try {
      const [s, m] = await Promise.allSettled([getSystemStatus(), getMetrics()])
      if (s.status === 'fulfilled') setSystemStatus(s.value.data)
      if (m.status === 'fulfilled') setMetrics(m.value.data)
    } catch {}
  }, 8000)

  const allOnline = SERVICES.every(s => systemStatus?.[s.key]?.online !== false)
  const onlineCount = SERVICES.filter(s => systemStatus?.[s.key]?.online !== false).length

  const analyzed = alerts.filter(a => a.ai_analysis).length
  const escalated = alerts.filter(a => a.ai_analysis?.decision === 'escalate').length
  const closedCases = cases.filter(c => c.status === 'closed').length
  const aiSuccessRate = analyzed > 0
    ? `${Math.round((analyzed / Math.max(alerts.length, 1)) * 100)}%`
    : '0%'

  const perfMetrics = [
    { label: 'Total Alerts',   value: metrics.total_alerts ?? alerts.length, color: 'text-mars-400',    icon: AlertCircle },
    { label: 'Total Cases',    value: metrics.total_cases ?? cases.length,   color: 'text-blue-400',    icon: HardDrive   },
    { label: 'AI Analyzed',    value: analyzed,                               color: 'text-purple-400',  icon: Brain       },
    { label: 'Cases Closed',   value: closedCases,                            color: 'text-emerald-400', icon: CheckCircle },
    { label: 'Escalated',      value: escalated,                              color: 'text-red-400',     icon: AlertCircle },
    { label: 'Pending Queue',  value: metrics.pending_queue ?? 0,             color: 'text-amber-400',   icon: Zap         },
    { label: 'Processing',     value: metrics.processing ?? 0,                color: 'text-cyan-400',    icon: Activity    },
    { label: 'AI Success Rate', value: aiSuccessRate,                         color: 'text-emerald-400', icon: CheckCircle },
  ]

  return (
    <div className="p-6 space-y-6 animate-slide-in" data-testid="metrics-page">
      {/* Status Banner */}
      <div className={clsx(
        'card-glow border-l-4 flex items-center gap-5',
        allOnline ? 'border-l-emerald-400' : 'border-l-amber-400'
      )}>
        <div className={clsx(
          'w-14 h-14 rounded-xl flex items-center justify-center',
          allOnline ? 'bg-emerald-500/15' : 'bg-amber-500/15'
        )}>
          {allOnline
            ? <CheckCircle size={28} className="text-emerald-400" />
            : <AlertCircle size={28} className="text-amber-400" />
          }
        </div>
        <div className="flex-1">
          <div className={clsx('font-semibold text-lg', allOnline ? 'text-emerald-400' : 'text-amber-400')}>
            {allOnline ? 'All Systems Operational' : `${onlineCount}/${SERVICES.length} Services Online`}
          </div>
          <div className="text-sm text-gray-500">
            Last checked: {new Date().toLocaleTimeString('en-US', { hour12: false })}
          </div>
        </div>
        <div className="text-right">
          <div className="text-4xl font-bold font-mono text-white">
            {onlineCount}<span className="text-gray-600 text-lg">/{SERVICES.length}</span>
          </div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">Services</div>
        </div>
      </div>

      {/* Service Grid */}
      <div className="grid grid-cols-3 gap-4">
        {SERVICES.map(({ key, label, icon: Icon, desc }) => {
          const s = systemStatus?.[key]
          const online = s?.online !== false
          return (
            <div key={key} className={clsx(
              'card-glow flex items-center gap-4 transition-all',
              online ? 'border-bg-border' : 'border-red-500/30'
            )}>
              <div className={clsx(
                'w-12 h-12 rounded-xl flex items-center justify-center',
                online ? 'bg-emerald-500/10' : 'bg-red-500/10'
              )}>
                <Icon size={22} className={online ? 'text-emerald-400' : 'text-red-400'} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white font-semibold truncate">{label}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">{desc}</div>
                <div className="mt-1.5">
                  <StatusBadge status={s?.status || (online ? 'online' : 'offline')} />
                </div>
              </div>
              <StatusIcon online={online} />
            </div>
          )
        })}
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-4 gap-4">
        {perfMetrics.map((m, i) => (
          <div key={i} className="card-glow text-center">
            <div className="w-10 h-10 rounded-lg mx-auto mb-3 flex items-center justify-center bg-bg-panel">
              <m.icon size={18} className={m.color} />
            </div>
            <div className={clsx('text-2xl font-bold font-mono mb-1', m.color)}>{m.value}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">{m.label}</div>
          </div>
        ))}
      </div>

      {systemStatus?.elasticsearch && (
        <div className="card-glow">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Database size={14} className="text-blue-400" />
            Elasticsearch Cluster
          </h3>
          <div className="grid grid-cols-3 gap-4">
            {[
              ['Cluster Status', systemStatus.elasticsearch.status || 'unknown'],
              ['Alerts Index', `${alerts.length} docs`],
              ['Cases Index', `${cases.length} docs`],
            ].map(([k, v]) => (
              <div key={k} className="bg-bg-panel/50 rounded-lg p-4 border border-bg-border/50">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{k}</div>
                <div className="text-white text-lg font-mono font-semibold">{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
