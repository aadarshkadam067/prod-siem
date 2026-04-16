import React, { useMemo } from 'react'
import { useStore } from '../store'
import { AlertTriangle, Shield, Brain, Activity, TrendingUp, Zap, Target, Radio } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { fmtAgo, severityBadge } from '../utils'
import clsx from 'clsx'

const COLORS = { 
  CRITICAL: '#dc2626', 
  HIGH: '#f59e0b', 
  MEDIUM: '#eab308', 
  LOW: '#10b981', 
  INFORMATIONAL: '#3b82f6' 
}

const ThreatGauge = ({ value, max, label, color, icon: Icon }) => {
  const percentage = max > 0 ? Math.min(100, (value / max) * 100) : 0
  
  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon size={14} className={color} />
          <span className="text-xs text-gray-400 font-medium">{label}</span>
        </div>
        <span className={clsx('text-lg font-bold font-mono', color)}>{value}</span>
      </div>
      <div className="h-2 bg-bg-border rounded-full overflow-hidden">
        <div 
          className="h-full rounded-full transition-all duration-1000 ease-out gauge-fill"
          style={{ 
            width: `${percentage}%`,
            background: `linear-gradient(90deg, ${color.replace('text-', '')} 0%, ${color.replace('text-', '')}80 100%)`,
            boxShadow: `0 0 10px ${color.replace('text-', '')}40`
          }}
        />
      </div>
    </div>
  )
}

const MetricCard = ({ icon: Icon, label, value, sub, color, glow, trend }) => (
  <div className={clsx('card-glow relative group', glow)}>
    {/* Scan line effect */}
    <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
      <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-mars-700/50 to-transparent animate-scan-line" />
    </div>
    
    <div className="flex items-start justify-between mb-4">
      <div className={clsx(
        'w-11 h-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110',
        color
      )}>
        <Icon size={20} className="text-white" />
      </div>
      <div className="flex items-center gap-1 text-xs">
        <TrendingUp size={12} className={trend > 0 ? 'text-red-400' : 'text-emerald-400'} />
        <span className={trend > 0 ? 'text-red-400' : 'text-emerald-400'}>
          {trend > 0 ? '+' : ''}{trend || 0}%
        </span>
      </div>
    </div>
    <div className="text-4xl font-bold text-white font-mono tabular-nums mb-1 tracking-tight">
      {value ?? '—'}
    </div>
    <div className="text-sm text-gray-400 font-medium">{label}</div>
    {sub && <div className="text-xs text-gray-600 mt-1 font-mono">{sub}</div>}
  </div>
)

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-bg-card/95 backdrop-blur-sm border border-bg-border rounded-lg p-3 text-xs shadow-2xl">
      <div className="text-gray-400 mb-2 font-mono text-[10px] uppercase tracking-wider">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mb-1" style={{ color: p.color }}>
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="font-mono">{p.name}: <strong>{p.value}</strong></span>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const { alerts, cases, stats } = useStore()

  const metrics = useMemo(() => {
    const bySev = alerts.reduce((a, x) => { a[x.severity] = (a[x.severity] || 0) + 1; return a }, {})
    const openCases = cases.filter(c => !['closed', 'false_positive'].includes(c.status)).length
    const aiDecisions = alerts.filter(a => a.ai_analysis).length
    return {
      total: alerts.length,
      critical: bySev.CRITICAL || 0,
      high: bySev.HIGH || 0,
      medium: bySev.MEDIUM || 0,
      open: openCases,
      ai: aiDecisions
    }
  }, [alerts, cases])

  const timelineData = useMemo(() => {
    const now = new Date()
    const buckets = Array.from({ length: 12 }, (_, i) => {
      const t = new Date(now - (11 - i) * 2 * 3600000)
      return {
        time: t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
        ts: t.getTime(),
        critical: 0, high: 0, medium: 0, low: 0
      }
    })

    alerts.forEach(a => {
      const alertTime = new Date(a.timestamp).getTime()
      let closest = 0
      let minDiff = Infinity
      buckets.forEach((b, i) => {
        const diff = Math.abs(b.ts - alertTime)
        if (diff < minDiff) { minDiff = diff; closest = i }
      })
      const s = (a.severity || '').toLowerCase()
      if (buckets[closest][s] !== undefined) buckets[closest][s]++
    })

    return buckets.map(({ time, critical, high, medium, low }) => ({ time, critical, high, medium, low }))
  }, [alerts])

  const typeData = useMemo(() => {
    const types = alerts.reduce((a, x) => {
      const t = x.type || x.event_type || 'unknown'
      a[t] = (a[t] || 0) + 1
      return a
    }, {})
    return Object.entries(types)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }))
  }, [alerts])

  const sevData = useMemo(() => {
    const counts = alerts.reduce((a, x) => {
      a[x.severity] = (a[x.severity] || 0) + 1
      return a
    }, {})
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value, fill: COLORS[name] || '#6b7280' }))
      .sort((a, b) => b.value - a.value)
  }, [alerts])

  const recentAlerts = alerts.slice(0, 8)

  return (
    <div className="p-6 space-y-6 animate-slide-in" data-testid="dashboard-page">
      {/* Threat Level Banner */}
      {metrics.critical > 0 && (
        <div className="card-critical flex items-center gap-4 animate-pulse-slow">
          <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
            <AlertTriangle size={24} className="text-red-400" />
          </div>
          <div className="flex-1">
            <div className="text-red-400 font-semibold text-sm flex items-center gap-2">
              <Radio size={12} className="animate-pulse" />
              ELEVATED THREAT LEVEL
            </div>
            <div className="text-gray-400 text-xs mt-0.5">
              {metrics.critical} critical alert{metrics.critical !== 1 && 's'} requiring immediate attention
            </div>
          </div>
          <button className="btn-primary" data-testid="view-critical-btn">
            View Critical Alerts
          </button>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-4 gap-5">
        <MetricCard 
          icon={AlertTriangle} 
          label="Total Alerts" 
          value={metrics.total}
          sub={`+${stats.pending_ai || 0} queued`}
          color="bg-gradient-to-br from-mars-700 to-mars-900"
          glow="shadow-glow-red"
          trend={12}
        />
        <MetricCard 
          icon={Zap} 
          label="Critical / High" 
          value={metrics.critical + metrics.high}
          sub="requiring action"
          color="bg-gradient-to-br from-amber-600 to-red-700"
          glow="shadow-glow-amber"
          trend={8}
        />
        <MetricCard 
          icon={Shield} 
          label="Open Cases" 
          value={metrics.open}
          sub={`${cases.length} total`}
          color="bg-gradient-to-br from-blue-600 to-blue-800"
          glow="shadow-glow-blue"
          trend={-5}
        />
        <MetricCard 
          icon={Brain} 
          label="AI Decisions" 
          value={metrics.ai}
          sub="autonomous actions"
          color="bg-gradient-to-br from-purple-600 to-purple-800"
          glow="shadow-glow-purple"
          trend={15}
        />
      </div>

      {/* Threat Gauges */}
      <div className="card-glow">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Target size={14} className="text-mars-500" />
            Threat Distribution
          </h3>
          <span className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">Real-time</span>
        </div>
        <div className="grid grid-cols-4 gap-6">
          <ThreatGauge value={metrics.critical} max={alerts.length || 1} label="Critical" color="text-red-500" icon={AlertTriangle} />
          <ThreatGauge value={metrics.high} max={alerts.length || 1} label="High" color="text-amber-500" icon={Zap} />
          <ThreatGauge value={metrics.medium} max={alerts.length || 1} label="Medium" color="text-yellow-500" icon={Activity} />
          <ThreatGauge value={alerts.length - metrics.critical - metrics.high - metrics.medium} max={alerts.length || 1} label="Low / Info" color="text-emerald-500" icon={Shield} />
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-3 gap-5">
        <div className="card-glow col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Alert Timeline</h3>
            <span className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">Last 24h</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={timelineData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="gc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#dc2626" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gh" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gm" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#eab308" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#eab308" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} interval={2} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="critical" stroke="#dc2626" fill="url(#gc)" strokeWidth={2} name="Critical" />
              <Area type="monotone" dataKey="high" stroke="#f59e0b" fill="url(#gh)" strokeWidth={2} name="High" />
              <Area type="monotone" dataKey="medium" stroke="#eab308" fill="url(#gm)" strokeWidth={1.5} name="Medium" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card-glow">
          <h3 className="text-sm font-semibold text-white mb-4">By Severity</h3>
          {sevData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={130}>
                <PieChart>
                  <Pie 
                    data={sevData} 
                    cx="50%" 
                    cy="50%" 
                    innerRadius={38} 
                    outerRadius={55} 
                    dataKey="value" 
                    paddingAngle={4}
                    stroke="none"
                  >
                    {sevData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2.5 mt-3">
                {sevData.map((d, i) => (
                  <div key={i} className="flex items-center justify-between group">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ background: d.fill }} />
                      <span className="text-xs text-gray-400 group-hover:text-white transition-colors">{d.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-20 h-1.5 bg-bg-border rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, (d.value / alerts.length) * 100)}%`,
                            background: d.fill
                          }}
                        />
                      </div>
                      <span className="text-xs font-mono text-gray-300 w-6 text-right font-semibold">{d.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-600 text-xs">No data</div>
          )}
        </div>
      </div>

      {/* Attack Types + Recent Alerts */}
      <div className="grid grid-cols-5 gap-5">
        <div className="card-glow col-span-2">
          <h3 className="text-sm font-semibold text-white mb-4">Attack Types</h3>
          {typeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={typeData} layout="vertical" margin={{ top: 0, right: 10, bottom: 0, left: 0 }}>
                <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" tick={{ fill: '#9ca3af', fontSize: 9 }} axisLine={false} tickLine={false} width={100} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {typeData.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? '#dc2626' : i === 1 ? '#f59e0b' : '#8b0000'} fillOpacity={1 - i * 0.1} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-600 text-xs">No data</div>
          )}
        </div>

        <div className="card-glow col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Recent Alerts</h3>
            <span className="text-[10px] text-mars-500 font-mono uppercase tracking-wider flex items-center gap-1">
              <Radio size={8} className="animate-pulse" /> Live
            </span>
          </div>
          <div className="space-y-2">
            {recentAlerts.length === 0 && (
              <div className="text-gray-600 text-xs text-center py-10">No alerts — inject logs to populate</div>
            )}
            {recentAlerts.map((a, i) => (
              <div 
                key={i} 
                className={clsx(
                  'flex items-center justify-between py-2.5 px-3 rounded-lg border transition-all hover:bg-mars-900/10',
                  a.severity === 'CRITICAL' ? 'border-mars-700/30 bg-mars-900/5' : 'border-bg-border/50'
                )}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={clsx(
                    'w-2 h-2 rounded-full shrink-0',
                    a.severity === 'CRITICAL' && 'threat-critical animate-pulse',
                    a.severity === 'HIGH' && 'threat-high',
                    a.severity === 'MEDIUM' && 'threat-medium',
                    a.severity === 'LOW' && 'threat-low'
                  )} />
                  <span className={severityBadge(a.severity)}>{a.severity}</span>
                  <span className="text-gray-300 text-xs truncate">{a.type || a.event_type}</span>
                </div>
                <div className="flex items-center gap-4 shrink-0 ml-2">
                  <span className="text-gray-500 text-xs font-mono">{a.source_ip || '—'}</span>
                  <span className="text-gray-600 text-[10px] font-mono w-16 text-right">{fmtAgo(a.timestamp)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
