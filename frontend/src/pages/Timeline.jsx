import React, { useMemo, useState } from 'react'
import { useStore } from '../store'
import { ChevronRight, AlertTriangle, Shield, Target, GitBranch } from 'lucide-react'
import { severityBadge, fmtTime } from '../utils'
import clsx from 'clsx'

const PHASES = [
  { id: 'Initial Access', color: '#f97316', icon: '🎯', mitre: ['T1566', 'T1078', 'T1190'] },
  { id: 'Execution', color: '#ef4444', icon: '⚡', mitre: ['T1059', 'T1203', 'T1204'] },
  { id: 'Persistence', color: '#a855f7', icon: '🔗', mitre: ['T1547', 'T1053', 'T1136'] },
  { id: 'Privilege Escalation', color: '#ec4899', icon: '⬆', mitre: ['T1068', 'T1548'] },
  { id: 'Defense Evasion', color: '#6366f1', icon: '🛡', mitre: ['T1027', 'T1055', 'T1562'] },
  { id: 'Credential Access', color: '#f43f5e', icon: '🔑', mitre: ['T1003', 'T1110', 'T1555'] },
  { id: 'Discovery', color: '#eab308', icon: '🔍', mitre: ['T1087', 'T1083', 'T1046'] },
  { id: 'Lateral Movement', color: '#f97316', icon: '➡', mitre: ['T1021', 'T1534'] },
  { id: 'Collection', color: '#06b6d4', icon: '📦', mitre: ['T1074', 'T1560'] },
  { id: 'Exfiltration', color: '#10b981', icon: '📤', mitre: ['T1041', 'T1048'] },
  { id: 'Command and Control', color: '#84cc16', icon: '📡', mitre: ['T1071', 'T1095'] },
  { id: 'Impact', color: '#ef4444', icon: '💥', mitre: ['T1486', 'T1490'] },
]

export default function Timeline() {
  const { alerts } = useStore()
  const [selectedPhase, setSelectedPhase] = useState(null)

  const phaseMap = useMemo(() => {
    const map = {}
    PHASES.forEach(p => { map[p.id] = [] })

    alerts.forEach(a => {
      const phase = a.ai_analysis?.attack_phase || a.metadata?.attack_phase
      if (phase && map[phase]) {
        map[phase].push(a)
      }
      const et = (a.event_type || a.type || '').toLowerCase()
      if (et.includes('lateral') && map['Lateral Movement']) map['Lateral Movement'].push(a)
      else if ((et.includes('exfil') || et.includes('upload')) && map['Exfiltration']) map['Exfiltration'].push(a)
      else if ((et.includes('cred') || et.includes('dump')) && map['Credential Access']) map['Credential Access'].push(a)
      else if ((et.includes('brute') || et.includes('auth_fail')) && map['Initial Access']) map['Initial Access'].push(a)
      else if ((et.includes('persist') || et.includes('schedule') || et.includes('registry')) && map['Persistence']) map['Persistence'].push(a)
      else if ((et.includes('powershell') || et.includes('exec')) && map['Execution']) map['Execution'].push(a)
      else if ((et.includes('c2') || et.includes('beacon')) && map['Command and Control']) map['Command and Control'].push(a)
    })

    Object.keys(map).forEach(k => {
      map[k] = [...new Map(map[k].map(a => [a.id, a])).values()]
    })
    return map
  }, [alerts])

  const activePhases = PHASES.filter(p => phaseMap[p.id]?.length > 0)
  const selectedAlerts = selectedPhase ? phaseMap[selectedPhase] : []
  const selectedPhaseInfo = PHASES.find(p => p.id === selectedPhase)

  return (
    <div className="p-6 animate-slide-in" data-testid="timeline-page">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
          <GitBranch size={18} className="text-mars-500" />
          Kill Chain Visualization
        </h3>
        <p className="text-sm text-gray-500">MITRE ATT&CK phases detected across all analyzed alerts. Click a phase to drill down.</p>
      </div>

      {/* Kill Chain Flow */}
      <div className="card-glow mb-6 overflow-x-auto">
        <div className="flex items-center gap-0 min-w-max pb-2">
          {PHASES.map((phase, i) => {
            const count = phaseMap[phase.id]?.length || 0
            const active = count > 0
            const selected = selectedPhase === phase.id
            return (
              <React.Fragment key={phase.id}>
                <button
                  onClick={() => setSelectedPhase(selected ? null : phase.id)}
                  data-testid={`phase-${phase.id.toLowerCase().replace(/\s+/g, '-')}`}
                  className={clsx(
                    'flex flex-col items-center p-3 rounded-xl transition-all duration-300 min-w-[100px]',
                    active && 'cursor-pointer hover:scale-105',
                    selected && 'scale-105',
                    !active && 'opacity-30 cursor-default'
                  )}
                  style={{
                    background: selected ? `${phase.color}20` : active ? `${phase.color}10` : 'transparent',
                    border: `1px solid ${selected ? phase.color + '60' : active ? phase.color + '30' : '#252525'}`,
                    boxShadow: selected ? `0 0 20px ${phase.color}30` : 'none'
                  }}
                  disabled={!active}
                >
                  <span className="text-xl mb-1">{phase.icon}</span>
                  <div className="text-[10px] text-center leading-tight mb-2 font-medium"
                    style={{ color: active ? phase.color : '#6b7280' }}>
                    {phase.id}
                  </div>
                  {active && (
                    <span className="text-xs font-bold font-mono px-2.5 py-1 rounded-full"
                      style={{ background: `${phase.color}25`, color: phase.color }}>
                      {count}
                    </span>
                  )}
                </button>
                {i < PHASES.length - 1 && (
                  <ChevronRight size={14} className={clsx(
                    'mx-1 shrink-0 transition-colors',
                    (phaseMap[phase.id]?.length > 0 || phaseMap[PHASES[i + 1]?.id]?.length > 0)
                      ? 'text-gray-500' : 'text-gray-700'
                  )} />
                )}
              </React.Fragment>
            )
          })}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="card-glow text-center">
          <div className="text-3xl font-bold font-mono text-mars-400">{activePhases.length}</div>
          <div className="text-xs text-gray-500 mt-1">Phases Detected</div>
        </div>
        <div className="card-glow text-center">
          <div className="text-3xl font-bold font-mono text-red-400">
            {alerts.filter(a => ['CRITICAL', 'HIGH'].includes(a.severity?.toUpperCase())).length}
          </div>
          <div className="text-xs text-gray-500 mt-1">Critical/High Alerts</div>
        </div>
        <div className="card-glow text-center">
          <div className="text-3xl font-bold font-mono text-purple-400">
            {[...new Set(alerts.flatMap(a => a.ai_analysis?.mitre_techniques || []))].length}
          </div>
          <div className="text-xs text-gray-500 mt-1">MITRE Techniques</div>
        </div>
        <div className="card-glow text-center">
          <div className="text-3xl font-bold font-mono text-blue-400">
            {[...new Set(alerts.map(a => a.source_ip).filter(Boolean))].length}
          </div>
          <div className="text-xs text-gray-500 mt-1">Unique Source IPs</div>
        </div>
      </div>

      {/* Drill-down Panel */}
      {selectedPhase && (
        <div className="card-glow border-l-4 animate-slide-in mb-6" style={{ borderLeftColor: selectedPhaseInfo?.color }}>
          <div className="flex items-center gap-4 mb-5">
            <span className="text-2xl">{selectedPhaseInfo?.icon}</span>
            <div>
              <h3 className="text-sm font-semibold text-white">{selectedPhase}</h3>
              <p className="text-xs text-gray-500">{selectedAlerts.length} event(s) detected</p>
            </div>
            <div className="ml-auto flex gap-2 flex-wrap">
              {selectedPhaseInfo?.mitre.map(t => (
                <span key={t} className="text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2.5 py-1 rounded-md font-mono">
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            {selectedAlerts.map((a, i) => (
              <div key={i} className="bg-bg-panel/50 rounded-lg p-4 flex items-start gap-4 border border-bg-border/50">
                <span className={severityBadge(a.severity)}>{a.severity}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-gray-300 text-sm font-mono mb-1">{a.id} — {a.type || a.event_type}</div>
                  <p className="text-gray-500 text-xs truncate">{a.raw_log}</p>
                </div>
                <div className="text-gray-600 text-xs font-mono shrink-0">{fmtTime(a.timestamp)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vertical Timeline */}
      {!selectedPhase && (
        <div className="card-glow">
          <h3 className="text-sm font-semibold text-white mb-5">All Detected Events — Chronological</h3>
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-px bg-gradient-to-b from-mars-700/50 via-bg-border to-bg-border" />
            <div className="space-y-3 pl-10">
              {alerts.slice(0, 20).map((a, i) => (
                <div key={i} className="relative animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
                  <div className="absolute -left-6 w-3 h-3 rounded-full mt-1.5 border-2 border-bg-card"
                    style={{ 
                      background: a.severity === 'CRITICAL' ? '#ef4444' : a.severity === 'HIGH' ? '#f97316' : a.severity === 'MEDIUM' ? '#eab308' : '#22c55e',
                      boxShadow: a.severity === 'CRITICAL' ? '0 0 10px #ef444480' : 'none'
                    }} />
                  <div className="flex items-start gap-3">
                    <div className="flex-1 bg-bg-panel/50 rounded-lg p-3 border border-bg-border/50 hover:border-mars-700/30 transition-all">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={severityBadge(a.severity)}>{a.severity}</span>
                        <span className="text-gray-300 text-xs">{a.type || a.event_type}</span>
                        <span className="ml-auto text-gray-600 text-[10px] font-mono">{fmtTime(a.timestamp)}</span>
                      </div>
                      <p className="text-gray-500 text-xs truncate">{a.raw_log}</p>
                    </div>
                  </div>
                </div>
              ))}
              {alerts.length === 0 && (
                <div className="text-gray-600 text-sm text-center py-10">
                  <Target size={32} className="mx-auto mb-3 opacity-50" />
                  No events — inject logs to see timeline
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
