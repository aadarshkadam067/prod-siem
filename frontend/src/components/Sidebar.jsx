import React, { useState } from 'react'
import { useStore } from '../store'
import { 
  Shield, LayoutDashboard, AlertTriangle, FolderOpen, Brain,
  Search, FileText, Activity, GitBranch, BarChart3, Zap,
  ChevronLeft, ChevronRight, Radio
} from 'lucide-react'
import clsx from 'clsx'

const nav = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'alerts', label: 'Alerts', icon: AlertTriangle, badge: true },
  { id: 'cases', label: 'Cases', icon: FolderOpen },
  { id: 'ai', label: 'AI Engine', icon: Brain },
  { id: 'timeline', label: 'Timeline', icon: GitBranch },
  { id: 'ioc', label: 'IOC Intel', icon: Search },
  { id: 'activity', label: 'Activity Log', icon: Zap },
  { id: 'metrics', label: 'Metrics', icon: BarChart3 },
  { id: 'logs', label: 'Live Logs', icon: Activity },
  { id: 'reports', label: 'Reports', icon: FileText },
]

export default function Sidebar() {
  const { activeTab, setActiveTab, health, systemStatus, alerts } = useStore()
  const [collapsed, setCollapsed] = useState(false)
  const isOnline = health?.status === 'healthy'
  const newAlerts = alerts.filter(a => a.status === 'new').length
  const criticalAlerts = alerts.filter(a => a.severity === 'CRITICAL').length

  return (
    <aside className={clsx(
      'bg-bg-panel border-r border-bg-border flex flex-col h-screen sticky top-0 shrink-0 transition-all duration-300 relative',
      collapsed ? 'w-[68px]' : 'w-60'
    )}>
      {/* Ambient glow effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-mars-900/20 via-transparent to-transparent pointer-events-none" />
      
      {/* Logo Section */}
      <div className={clsx(
        'p-4 border-b border-bg-border relative',
        collapsed ? 'px-3' : 'p-5'
      )}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-mars-700 to-mars-900 rounded-xl flex items-center justify-center shadow-lg glow-red relative">
            <Shield size={20} className="text-white" />
            {criticalAlerts > 0 && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse-fast" />
            )}
          </div>
          {!collapsed && (
            <div className="animate-fade-in">
              <div className="text-sm font-bold text-white tracking-wide font-display">PROD SIEM</div>
              <div className="text-[10px] text-mars-500 font-mono uppercase tracking-[0.2em] flex items-center gap-1.5">
                <Radio size={8} className="animate-pulse" />
                AI-POWERED
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className={clsx(
        'flex-1 overflow-y-auto relative',
        collapsed ? 'p-2' : 'p-3'
      )}>
        <div className="space-y-1">
          {nav.map(({ id, label, icon: Icon, badge }) => {
            const isActive = activeTab === id
            const showBadge = badge && newAlerts > 0
            
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                data-testid={`nav-${id}`}
                className={clsx(
                  'w-full flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-200 group relative',
                  collapsed ? 'p-2.5 justify-center' : 'px-3 py-2.5',
                  isActive
                    ? 'bg-gradient-to-r from-mars-700/20 to-mars-800/10 text-white border border-mars-700/30'
                    : 'text-gray-500 hover:text-gray-200 hover:bg-white/5'
                )}
              >
                {/* Active indicator */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-mars-600 rounded-r-full" />
                )}
                
                <Icon 
                  size={collapsed ? 18 : 16} 
                  className={clsx(
                    'transition-colors shrink-0',
                    isActive ? 'text-mars-500' : 'group-hover:text-mars-400'
                  )} 
                />
                
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left">{label}</span>
                    {showBadge && (
                      <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-mars-700/40 text-red-400 border border-mars-600/50 rounded-full animate-pulse">
                        {newAlerts}
                      </span>
                    )}
                  </>
                )}

                {/* Tooltip for collapsed state */}
                {collapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-bg-card border border-bg-border rounded-md text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                    {label}
                    {showBadge && <span className="ml-2 text-red-400">({newAlerts})</span>}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </nav>

      {/* System Status Panel */}
      <div className={clsx(
        'border-t border-bg-border',
        collapsed ? 'p-2' : 'p-3'
      )}>
        {!collapsed && (
          <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2 font-semibold">System Status</div>
        )}
        <div className={clsx('space-y-1.5', collapsed && 'flex flex-col items-center')}>
          {['backend', 'elasticsearch', 'groq'].map(svc => {
            const s = systemStatus?.[svc]
            const online = s?.online !== false
            return (
              <div 
                key={svc} 
                className={clsx(
                  'flex items-center',
                  collapsed ? 'justify-center' : 'justify-between'
                )}
              >
                {!collapsed && (
                  <span className="text-[10px] text-gray-500 font-mono uppercase">{svc}</span>
                )}
                <div className={clsx(
                  'w-2 h-2 rounded-full transition-all',
                  online ? 'status-online' : 'status-offline'
                )} />
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer */}
      <div className={clsx(
        'border-t border-bg-border',
        collapsed ? 'p-2' : 'p-3'
      )}>
        <div className={clsx(
          'flex items-center',
          collapsed ? 'justify-center' : 'gap-2'
        )}>
          <div className={clsx(
            'w-2.5 h-2.5 rounded-full',
            isOnline ? 'status-online' : 'status-offline'
          )} />
          {!collapsed && (
            <div>
              <span className="text-[10px] text-gray-400 font-mono">
                {isOnline ? 'SYSTEMS ONLINE' : 'OFFLINE'}
              </span>
              <div className="text-[9px] text-gray-600 font-mono">v2.0.0 — Groq LLaMA 3.3</div>
            </div>
          )}
        </div>
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        data-testid="sidebar-toggle"
        className={clsx(
          'absolute -right-3 top-20 w-6 h-6 bg-bg-card border border-bg-border rounded-full',
          'flex items-center justify-center text-gray-500 hover:text-white hover:border-mars-700/50',
          'transition-all duration-200 z-10'
        )}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>
    </aside>
  )
}
