import React, { useState } from 'react'
import { useStore } from '../store'
import { triggerAI, ingestAlert } from '../services/api'
import { severityBadge, statusColor, fmtTime } from '../utils'
import { Brain, Eye, Plus, X, Shield, AlertTriangle, Radio, Filter } from 'lucide-react'
import clsx from 'clsx'

const SAMPLE = {
  source: 'firewall',
  event_type: 'brute_force',
  severity: 'HIGH',
  source_ip: '185.220.101.45',
  raw_log: '847 failed SSH logins in 3 minutes from Tor exit node'
}

function AlertModal({ alert, onClose }) {
  const { updateAlert } = useStore()
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const runAI = async () => {
    setLoading(true)
    try {
      await triggerAI(alert.id)
      setDone(true)
      updateAlert(alert.id, { status: 'analyzing' })
    } catch (e) {}
    setLoading(false)
  }

  const ai = alert.ai_analysis

  return (
    <div className="fixed inset-0 modal-backdrop z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-bg-card border border-bg-border rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-bg-border bg-gradient-to-r from-mars-900/20 to-transparent">
          <div className="flex items-center gap-3">
            <div className={clsx(
              'w-10 h-10 rounded-xl flex items-center justify-center',
              alert.severity === 'CRITICAL' ? 'bg-red-500/20' : 'bg-mars-700/20'
            )}>
              <AlertTriangle size={18} className={alert.severity === 'CRITICAL' ? 'text-red-400' : 'text-mars-500'} />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm font-mono">{alert.id}</h3>
              <p className="text-gray-500 text-xs mt-0.5">{alert.type || alert.event_type}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            data-testid="modal-close-btn"
            className="p-2 hover:bg-white/5 rounded-lg text-gray-500 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Alert Details Grid */}
          <div className="grid grid-cols-3 gap-3">
            {[
              ['Source IP', alert.source_ip || '—', 'font-mono text-mars-400'],
              ['Severity', <span className={severityBadge(alert.severity)}>{alert.severity}</span>],
              ['Status', <span className={clsx('font-mono font-medium', statusColor(alert.status))}>{alert.status}</span>],
              ['Timestamp', fmtTime(alert.timestamp), 'font-mono'],
              ['Source', alert.source, 'capitalize'],
              ['Type', alert.type || alert.event_type]
            ].map(([k, v, cls]) => (
              <div key={k} className="bg-bg-panel rounded-lg p-3 border border-bg-border/50">
                <div className="text-gray-500 text-[10px] uppercase tracking-wider mb-1.5">{k}</div>
                <div className={clsx('text-white text-sm', cls)}>{v}</div>
              </div>
            ))}
          </div>

          {/* Raw Log */}
          {alert.raw_log && (
            <div className="bg-bg-panel rounded-lg p-4 border border-bg-border/50">
              <div className="text-gray-500 text-[10px] uppercase tracking-wider mb-2">Raw Log</div>
              <pre className="text-gray-300 text-xs font-mono whitespace-pre-wrap break-all leading-relaxed terminal-text">
                {alert.raw_log}
              </pre>
            </div>
          )}

          {/* AI Analysis Section */}
          {ai ? (
            <div className="bg-gradient-to-br from-purple-500/10 to-mars-900/10 rounded-xl p-5 border border-purple-500/20">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Brain size={16} className="text-purple-400" />
                  <span className="text-sm text-purple-400 font-semibold">AI Analysis</span>
                  <span className="text-[10px] text-gray-500 font-mono">— {ai.analyzed_by}</span>
                </div>
                <span className={clsx(
                  'px-3 py-1 rounded-lg text-xs font-mono font-bold border',
                  ai.decision === 'escalate' 
                    ? 'bg-red-500/20 text-red-400 border-red-500/30' 
                    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                )}>
                  {ai.decision?.toUpperCase()}
                </span>
              </div>
              
              <p className="text-gray-300 text-sm leading-relaxed mb-4">{ai.investigation_notes}</p>
              
              {ai.mitre_techniques?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {ai.mitre_techniques.map(t => (
                    <span key={t} className="text-[10px] bg-purple-500/15 text-purple-400 border border-purple-500/25 px-2.5 py-1 rounded-md font-mono">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={runAI}
              disabled={loading || done}
              data-testid="trigger-ai-btn"
              className={clsx(
                'w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all',
                done 
                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                  : 'bg-gradient-to-r from-purple-600/20 to-mars-700/20 border border-purple-500/30 text-purple-400 hover:from-purple-600/30 hover:to-mars-700/30'
              )}
            >
              <Brain size={16} />
              {loading ? 'Analyzing...' : done ? 'Analysis Queued ✓' : 'Trigger AI Analysis'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Alerts() {
  const { alerts, addAlert } = useStore()
  const [selected, setSelected] = useState(null)
  const [filter, setFilter] = useState('ALL')
  const [injecting, setInjecting] = useState(false)

  const filtered = filter === 'ALL' ? alerts : alerts.filter(a => a.severity === filter)

  const inject = async () => {
    setInjecting(true)
    try {
      const r = await ingestAlert(SAMPLE)
      addAlert({ ...SAMPLE, id: r.data.alert_id, timestamp: new Date().toISOString(), status: 'new' })
    } catch (e) {}
    setInjecting(false)
  }

  const severityCounts = alerts.reduce((acc, a) => {
    acc[a.severity] = (acc[a.severity] || 0) + 1
    return acc
  }, {})

  return (
    <div className="p-6 animate-slide-in" data-testid="alerts-page">
      {/* Header Section */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-bg-card border border-bg-border rounded-xl p-1">
            {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                data-testid={`filter-${s.toLowerCase()}`}
                className={clsx(
                  'px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200',
                  filter === s
                    ? s === 'CRITICAL' 
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                      : 'bg-mars-700/20 text-mars-400 border border-mars-700/30'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                )}
              >
                {s}
                {s !== 'ALL' && severityCounts[s] > 0 && (
                  <span className="ml-1.5 text-[10px] opacity-70">({severityCounts[s]})</span>
                )}
              </button>
            ))}
          </div>
        </div>
        
        <button
          onClick={inject}
          disabled={injecting}
          data-testid="inject-alert-btn"
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={14} />
          {injecting ? 'Injecting...' : 'Inject Test Alert'}
        </button>
      </div>

      {/* Alerts Table */}
      <div className="card-glow overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-bg-border">
              {['', 'Timestamp', 'Source IP', 'Type', 'Severity', 'Status', 'Actions'].map(h => (
                <th key={h} className="table-header px-4 first:pl-5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="py-16 text-center">
                  <Shield size={40} className="text-gray-700 mx-auto mb-3" />
                  <div className="text-gray-500 text-sm">No alerts found</div>
                  <div className="text-gray-600 text-xs mt-1">Click "Inject Test Alert" to start</div>
                </td>
              </tr>
            )}
            {filtered.map((a, i) => (
              <tr 
                key={i} 
                className={clsx(
                  'table-row',
                  a.severity === 'CRITICAL' && 'bg-mars-900/5'
                )}
              >
                <td className="table-cell pl-5 w-8">
                  <div className={clsx(
                    'w-2 h-2 rounded-full',
                    a.severity === 'CRITICAL' && 'threat-critical animate-pulse',
                    a.severity === 'HIGH' && 'threat-high',
                    a.severity === 'MEDIUM' && 'threat-medium',
                    a.severity === 'LOW' && 'threat-low'
                  )} />
                </td>
                <td className="table-cell px-4 font-mono text-gray-400 text-xs">{fmtTime(a.timestamp)}</td>
                <td className="table-cell px-4 font-mono text-mars-400">{a.source_ip || '—'}</td>
                <td className="table-cell px-4 text-gray-300 max-w-[160px] truncate">{a.type || a.event_type || '—'}</td>
                <td className="table-cell px-4">
                  <span className={severityBadge(a.severity)}>{a.severity}</span>
                </td>
                <td className="table-cell px-4">
                  <span className={clsx('font-mono font-medium text-xs', statusColor(a.status))}>{a.status || 'new'}</span>
                </td>
                <td className="table-cell px-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelected(a)}
                      data-testid={`view-alert-${i}`}
                      className="p-2 hover:bg-white/5 rounded-lg text-gray-500 hover:text-white transition-colors"
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      onClick={async () => { await triggerAI(a.id).catch(() => {}) }}
                      data-testid={`ai-alert-${i}`}
                      className="p-2 hover:bg-purple-500/10 rounded-lg text-gray-500 hover:text-purple-400 transition-colors"
                    >
                      <Brain size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        <div className="mt-4 pt-4 px-5 pb-2 border-t border-bg-border flex items-center justify-between">
          <span className="text-xs text-gray-600 font-mono">
            Showing {filtered.length} of {alerts.length} alerts
          </span>
          {alerts.filter(a => a.status === 'new').length > 0 && (
            <span className="text-xs text-mars-500 font-mono flex items-center gap-1.5">
              <Radio size={10} className="animate-pulse" />
              {alerts.filter(a => a.status === 'new').length} new
            </span>
          )}
        </div>
      </div>

      {selected && <AlertModal alert={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
