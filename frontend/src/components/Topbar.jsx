import React, { useState, useEffect } from 'react'
import { Bell, RefreshCw, Terminal, Wifi, WifiOff, Shield, AlertCircle } from 'lucide-react'
import { useStore } from '../store'
import { getStats, getAlerts, getCases, getHealth, getActivity, getSystemStatus } from '../services/api'
import { usePolling } from '../hooks/usePolling'
import { useWebSocket } from '../hooks/useWebSocket'
import clsx from 'clsx'

const PAGE_TITLES = {
  dashboard: 'Operations Dashboard',
  alerts: 'Alert Management',
  cases: 'Case Management',
  ai: 'AI Decision Engine',
  ioc: 'IOC Intelligence',
  logs: 'Live Log Stream',
  reports: 'Incident Reports',
  timeline: 'Attack Timeline',
  activity: 'Activity Log',
  metrics: 'System Metrics'
}

// Only pages that need a distinct icon — rest fall back to Terminal
const PAGE_ICONS = {
  alerts: AlertCircle,
  cases: Shield,
}

export default function Topbar() {
  const {
    activeTab, setStats, setAlerts, setCases, setHealth,
    setActivity, setSystemStatus, newAlertFlash, wsConnected, alerts
  } = useStore()
  const [time, setTime] = useState(new Date())
  const [refreshing, setRefreshing] = useState(false)

  useWebSocket()

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const refresh = async () => {
    setRefreshing(true)
    try {
      const [s, a, c, h, act, sys] = await Promise.allSettled([
        getStats(),
        getAlerts({ limit: 100 }),
        getCases({ limit: 100 }),
        getHealth(),
        getActivity(100),
        getSystemStatus()
      ])
      if (s.status === 'fulfilled') setStats(s.value.data)
      if (a.status === 'fulfilled') setAlerts(a.value.data.alerts || [])
      if (c.status === 'fulfilled') setCases(c.value.data.cases || [])
      if (h.status === 'fulfilled') setHealth(h.value.data)
      if (act.status === 'fulfilled') setActivity(act.value.data.activity || [])
      if (sys.status === 'fulfilled') setSystemStatus(sys.value.data)
    } catch {}
    setTimeout(() => setRefreshing(false), 400)
  }

  usePolling(refresh, 15000)

  const PageIcon = PAGE_ICONS[activeTab] || Terminal
  const criticalCount = alerts.filter(a => a.severity === 'CRITICAL').length
  const highCount = alerts.filter(a => a.severity === 'HIGH').length
  const newCount = alerts.filter(a => a.status === 'new').length

  return (
    <header className={clsx(
      'h-16 bg-bg-panel/80 backdrop-blur-md border-b border-bg-border flex items-center justify-between px-6 sticky top-0 z-50 transition-all duration-300',
      newAlertFlash && 'border-b-mars-700/60 shadow-[0_2px_30px_rgba(139,0,0,0.15)]'
    )}>
      {/* Left: page title */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className={clsx(
            'w-8 h-8 rounded-lg flex items-center justify-center',
            'bg-gradient-to-br from-mars-700/30 to-mars-900/20 border border-mars-700/30'
          )}>
            <PageIcon size={14} className="text-mars-500" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white tracking-wide">{PAGE_TITLES[activeTab]}</h2>
            <span className="text-gray-500 text-[10px] font-mono uppercase tracking-wider">
              {time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </div>
        </div>

        {newAlertFlash && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-mars-700/20 border border-mars-700/40 rounded-lg animate-pulse">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse-fast" />
            <span className="text-xs font-mono text-red-400 font-semibold">NEW ALERT DETECTED</span>
          </div>
        )}
      </div>

      {/* Right: threat counts, time, ws status, controls */}
      <div className="flex items-center gap-4">
        {(criticalCount > 0 || highCount > 0) && (
          <div className="flex items-center gap-3 px-3 py-1.5 bg-bg-card border border-bg-border rounded-lg">
            <div className="flex items-center gap-2">
              {criticalCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="threat-indicator threat-critical animate-pulse" />
                  <span className="text-xs font-mono text-red-400 font-bold">{criticalCount}</span>
                </div>
              )}
              {highCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="threat-indicator threat-high" />
                  <span className="text-xs font-mono text-amber-400 font-bold">{highCount}</span>
                </div>
              )}
            </div>
            <span className="text-[10px] text-gray-500 font-mono uppercase">Active</span>
          </div>
        )}

        <div className="text-right">
          <div className="text-sm font-mono text-white tabular-nums tracking-wider">
            {time.toLocaleTimeString('en-US', { hour12: false })}
          </div>
          <div className="text-[9px] text-gray-500 font-mono uppercase">
            UTC{time.getTimezoneOffset() > 0 ? '-' : '+'}{Math.abs(time.getTimezoneOffset() / 60)}
          </div>
        </div>

        <div className={clsx(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all',
          wsConnected
            ? 'bg-emerald-500/10 border-emerald-500/30'
            : 'bg-red-500/10 border-red-500/30'
        )}>
          {wsConnected
            ? <Wifi size={14} className="text-emerald-400" />
            : <WifiOff size={14} className="text-red-400" />
          }
          <span className={clsx(
            'text-xs font-mono font-semibold tracking-wider',
            wsConnected ? 'text-emerald-400' : 'text-red-400'
          )}>
            {wsConnected ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>

        <button
          onClick={refresh}
          data-testid="refresh-btn"
          className={clsx(
            'p-2 rounded-lg border border-transparent transition-all duration-200',
            'hover:bg-white/5 hover:border-bg-border text-gray-400 hover:text-white'
          )}
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin text-mars-500' : ''} />
        </button>

        <button
          data-testid="notifications-btn"
          className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white relative transition-all"
        >
          <Bell size={16} />
          {newCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-mars-600 rounded-full animate-pulse" />
          )}
        </button>

        <div className="w-9 h-9 bg-gradient-to-br from-mars-700 to-mars-900 rounded-lg flex items-center justify-center text-xs font-bold text-white border border-mars-600/30 glow-red">
          SOC
        </div>
      </div>
    </header>
  )
}
