import React, { useState } from 'react'
import { useStore } from '../store'
import { triggerAI } from '../services/api'
import { Brain, Zap, CheckCircle, AlertTriangle, ChevronRight, Target, Shield, Clock, Cpu } from 'lucide-react'
import { fmtAgo, severityBadge } from '../utils'
import clsx from 'clsx'

function AIDecisionCard({ alert }) {
  const ai = alert.ai_analysis
  const [expanded, setExpanded] = useState(false)
  if (!ai) return null

  const isEscalate = ai.decision === 'escalate'

  return (
    <div className={clsx(
      'card-glow border transition-all duration-300 group',
      isEscalate ? 'border-red-500/30 hover:border-red-500/50' : 'border-emerald-500/30 hover:border-emerald-500/50'
    )}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={clsx(
            'w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110',
            isEscalate ? 'bg-red-500/15' : 'bg-emerald-500/15'
          )}>
            {isEscalate
              ? <AlertTriangle size={18} className="text-red-400" />
              : <CheckCircle size={18} className="text-emerald-400" />
            }
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={severityBadge(ai.severity || alert.severity)}>{ai.severity || alert.severity}</span>
              <span className={clsx(
                'text-xs font-mono font-bold tracking-wider px-2 py-0.5 rounded',
                isEscalate ? 'text-red-400 bg-red-500/10' : 'text-emerald-400 bg-emerald-500/10'
              )}>
                {ai.decision?.toUpperCase()}
              </span>
            </div>
            <div className="text-gray-500 text-xs font-mono mt-1">{alert.id}</div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Confidence Gauge */}
          <div className="text-right">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Confidence</div>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-bg-border rounded-full overflow-hidden">
                <div
                  className={clsx(
                    'h-full rounded-full transition-all duration-1000',
                    (ai.confidence || 0) > 80 ? 'bg-emerald-400' 
                      : (ai.confidence || 0) > 50 ? 'bg-amber-400' 
                      : 'bg-red-400'
                  )}
                  style={{ width: `${ai.confidence || 0}%` }}
                />
              </div>
              <span className="text-xs font-mono text-white font-bold w-10">{ai.confidence || 0}%</span>
            </div>
          </div>
          
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-2 hover:bg-white/5 rounded-lg text-gray-500 hover:text-white transition-colors"
          >
            <ChevronRight size={16} className={clsx('transition-transform duration-200', expanded && 'rotate-90')} />
          </button>
        </div>
      </div>

      {/* AI Reasoning */}
      <div className="bg-bg-panel/50 rounded-lg p-4 mb-4 border border-bg-border/50">
        <div className="flex items-center gap-2 mb-2">
          <Brain size={12} className="text-purple-400" />
          <span className="text-[10px] text-purple-400 font-semibold uppercase tracking-wider">AI Reasoning</span>
          <span className="ml-auto text-[10px] text-gray-600 font-mono">{ai.analyzed_by}</span>
        </div>
        <p className="text-gray-300 text-sm leading-relaxed">{ai.investigation_notes}</p>
      </div>

      {/* Tags Row */}
      <div className="flex items-center gap-2 flex-wrap">
        {ai.attack_phase && (
          <div className="flex items-center gap-1.5 bg-mars-700/20 rounded-lg px-3 py-1.5 border border-mars-700/30">
            <Target size={12} className="text-mars-400" />
            <span className="text-xs text-gray-300">{ai.attack_phase}</span>
          </div>
        )}
        {ai.mitre_techniques?.slice(0, 4).map(t => (
          <span key={t} className="text-[10px] bg-purple-500/15 text-purple-400 border border-purple-500/25 px-2.5 py-1 rounded-md font-mono">
            {t}
          </span>
        ))}
      </div>

      {/* Actions Taken */}
      {ai.actions?.length > 0 && (
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className="text-[10px] text-gray-600 uppercase tracking-wider">Actions:</span>
          {ai.actions.map(a => (
            <span key={a} className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded font-mono">
              {a}
            </span>
          ))}
        </div>
      )}

      {/* Expanded Details */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-bg-border space-y-4 animate-slide-in">
          {ai.iocs && Object.values(ai.iocs).some(v => v?.length > 0) && (
            <div>
              <div className="text-[10px] text-gray-500 mb-2 font-semibold uppercase tracking-wider">Extracted IOCs</div>
              <div className="space-y-1">
                {Object.entries(ai.iocs).map(([type, vals]) =>
                  vals?.map(v => (
                    <div key={v} className="flex items-center gap-3 bg-bg-panel/50 rounded px-3 py-2">
                      <span className="text-[10px] text-gray-600 w-16 font-mono uppercase">{type}</span>
                      <span className="text-xs text-mars-400 font-mono">{v}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
          
          {ai.recommended_containment?.length > 0 && (
            <div>
              <div className="text-[10px] text-gray-500 mb-2 font-semibold uppercase tracking-wider">Recommended Containment</div>
              {ai.recommended_containment.map((c, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-gray-400 mb-2">
                  <Shield size={12} className="text-mars-500 mt-0.5 shrink-0" />
                  {c}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function AIPanel() {
  const { alerts } = useStore()
  const analyzed = alerts.filter(a => a.ai_analysis)
  const pending = alerts.filter(a => !a.ai_analysis && ['HIGH', 'CRITICAL'].includes((a.severity || '').toUpperCase()))
  const [running, setRunning] = useState({})

  const run = async (id) => {
    setRunning(r => ({ ...r, [id]: true }))
    try { await triggerAI(id) } catch {}
    setTimeout(() => setRunning(r => ({ ...r, [id]: false })), 4000)
  }

  const escalated = analyzed.filter(a => a.ai_analysis?.decision === 'escalate').length
  const closed = analyzed.filter(a => a.ai_analysis?.decision === 'close').length
  const avgConf = analyzed.length
    ? Math.round(analyzed.reduce((s, a) => s + (a.ai_analysis?.confidence || 0), 0) / analyzed.length)
    : 0

  return (
    <div className="p-6 space-y-6 animate-slide-in" data-testid="ai-panel-page">
      {/* AI Engine Status Banner */}
      <div className="card-glow flex items-center gap-4 bg-gradient-to-r from-purple-500/10 to-mars-900/10 border-purple-500/20">
        <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
          <Cpu size={24} className="text-purple-400" />
        </div>
        <div className="flex-1">
          <div className="text-purple-400 font-semibold text-sm flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            AI Engine Active
          </div>
          <div className="text-gray-400 text-xs mt-0.5">
            Groq LLaMA 3.3 — Processing {pending.length} pending alert{pending.length !== 1 && 's'}
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold font-mono text-white">{avgConf}%</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">Avg Confidence</div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Analyzed', value: analyzed.length, color: 'text-purple-400', bg: 'bg-purple-500/10', icon: Brain },
          { label: 'Escalated', value: escalated, color: 'text-red-400', bg: 'bg-red-500/10', icon: AlertTriangle },
          { label: 'Auto-Closed', value: closed, color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: CheckCircle },
          { label: 'Avg Confidence', value: `${avgConf}%`, color: 'text-blue-400', bg: 'bg-blue-500/10', icon: Target },
        ].map((s, i) => (
          <div key={i} className="card-glow">
            <div className="flex items-center justify-between mb-3">
              <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center', s.bg)}>
                <s.icon size={16} className={s.color} />
              </div>
            </div>
            <div className={clsx('text-3xl font-bold font-mono mb-1', s.color)}>{s.value}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Pending Queue */}
        <div className="card-glow">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Zap size={14} className="text-mars-500" />
            Pending Analysis
            <span className="ml-auto text-xs font-mono text-gray-500 bg-bg-panel px-2 py-0.5 rounded-full">{pending.length}</span>
          </h3>
          <div className="space-y-2">
            {pending.length === 0 && (
              <div className="text-gray-600 text-xs text-center py-8">
                <Brain size={24} className="mx-auto mb-2 opacity-50" />
                No pending alerts
              </div>
            )}
            {pending.slice(0, 6).map((a, i) => (
              <div key={i} className="flex items-center justify-between bg-bg-panel/50 rounded-lg p-3 border border-bg-border/50">
                <div>
                  <span className={severityBadge(a.severity)}>{a.severity}</span>
                  <div className="text-gray-500 text-xs font-mono mt-1.5">
                    {a.source_ip} · {fmtAgo(a.timestamp)}
                  </div>
                </div>
                <button
                  onClick={() => run(a.id)}
                  disabled={running[a.id]}
                  data-testid={`run-ai-${i}`}
                  className="px-3 py-1.5 bg-purple-500/15 border border-purple-500/30 text-purple-400 rounded-lg text-xs font-medium hover:bg-purple-500/25 disabled:opacity-50 flex items-center gap-1.5 transition-all"
                >
                  <Brain size={12} />
                  {running[a.id] ? '...' : 'Analyze'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* AI Decision Cards */}
        <div className="col-span-2 space-y-4 max-h-[70vh] overflow-y-auto">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2 sticky top-0 bg-bg py-2 z-10">
            <CheckCircle size={14} className="text-emerald-400" />
            AI Decisions
            <span className="ml-auto text-xs font-mono text-gray-500 bg-bg-panel px-2 py-0.5 rounded-full">{analyzed.length}</span>
          </h3>
          {analyzed.length === 0 && (
            <div className="card-glow text-center py-12">
              <Brain size={40} className="text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No AI analyses yet</p>
              <p className="text-gray-600 text-xs mt-1">Click Analyze on pending alerts to start</p>
            </div>
          )}
          {analyzed.map((a, i) => <AIDecisionCard key={i} alert={a} />)}
        </div>
      </div>
    </div>
  )
}
