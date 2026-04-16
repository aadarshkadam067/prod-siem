import React, { useState, useEffect, useRef } from 'react'
import { useStore } from '../store'
import { ingestAlert } from '../services/api'
import { Play, Square, Trash2, Terminal, Filter } from 'lucide-react'
import clsx from 'clsx'

const LOG_COLORS = { 
  ERROR: 'text-red-400', 
  WARN: 'text-amber-400', 
  INFO: 'text-blue-400', 
  DEBUG: 'text-gray-500', 
  CRITICAL: 'text-red-500' 
}

const LOG_BG = {
  ERROR: 'bg-red-500/5 border-l-2 border-red-500/50',
  WARN: 'bg-amber-500/5 border-l-2 border-amber-500/50',
  CRITICAL: 'bg-red-500/10 border-l-2 border-red-500'
}

const FAKE_LOGS = [
  { level: 'INFO', msg: '[CORRELATION] New event ingested: auth_fail from 185.220.101.45' },
  { level: 'WARN', msg: '[DETECTION] Brute force threshold exceeded: 50 failures in 5 min' },
  { level: 'INFO', msg: '[AI ENGINE] Processing alert ALERT-001 with Groq LLaMA 3.3' },
  { level: 'INFO', msg: '[AI ENGINE] Alert ALERT-001 → severity=HIGH decision=escalate' },
  { level: 'INFO', msg: '[EXECUTOR] Creating TheHive case for ALERT-001' },
  { level: 'WARN', msg: '[CORTEX] Analyzer AbuseIPDB_1_0 returned score: 87/100 MALICIOUS' },
  { level: 'INFO', msg: '[REPORT] PDF generated: reports/INCIDENT_ALERT-001.pdf' },
  { level: 'INFO', msg: '[EXECUTOR] Pipeline complete → status=escalated actions=[thehive,cortex,report]' },
  { level: 'INFO', msg: '[SIEM] Elasticsearch health: green, 3 indexes, 0 unassigned shards' },
  { level: 'DEBUG', msg: '[REDIS] Queue siem:alerts:pending: 0 items' },
  { level: 'ERROR', msg: '[MISP] Connection refused — service disabled' },
  { level: 'INFO', msg: '[AI ENGINE] Listening on queue: siem:alerts:pending' },
]

export default function Logs() {
  const { logs, addLog } = useStore()
  const [streaming, setStreaming] = useState(false)
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState('ALL')
  const bottomRef = useRef()
  const timerRef = useRef()

  const startStream = () => {
    setStreaming(true)
    let i = 0
    timerRef.current = setInterval(() => {
      const l = FAKE_LOGS[i % FAKE_LOGS.length]
      addLog({ time: new Date().toISOString(), level: l.level, msg: l.msg })
      i++
    }, 800)
  }

  const stopStream = () => {
    setStreaming(false)
    clearInterval(timerRef.current)
  }

  useEffect(() => () => clearInterval(timerRef.current), [])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [logs.length])

  const filtered = logs.filter(l =>
    (levelFilter === 'ALL' || l.level === levelFilter) &&
    (!search || l.msg.toLowerCase().includes(search.toLowerCase()))
  )

  const levelCounts = logs.reduce((acc, l) => {
    acc[l.level] = (acc[l.level] || 0) + 1
    return acc
  }, {})

  return (
    <div className="p-6 animate-slide-in flex flex-col h-[calc(100vh-8rem)]" data-testid="logs-page">
      {/* Header Controls */}
      <div className="flex items-center gap-4 mb-4">
        {/* Search */}
        <div className="flex-1 relative">
          <Terminal size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search logs..."
            data-testid="log-search"
            className="input-dark pl-10 font-mono text-xs"
          />
        </div>

        {/* Level Filters */}
        <div className="flex items-center gap-1 bg-bg-card border border-bg-border rounded-lg p-1">
          {['ALL', 'INFO', 'WARN', 'ERROR', 'DEBUG'].map(l => (
            <button
              key={l}
              onClick={() => setLevelFilter(l)}
              data-testid={`log-filter-${l.toLowerCase()}`}
              className={clsx(
                'px-3 py-1.5 rounded-md text-xs font-mono font-semibold transition-all',
                levelFilter === l
                  ? l === 'ERROR' ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : l === 'WARN' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-mars-700/20 text-mars-400 border border-mars-700/30'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
              )}
            >
              {l}
              {l !== 'ALL' && levelCounts[l] > 0 && (
                <span className="ml-1 opacity-60">({levelCounts[l]})</span>
              )}
            </button>
          ))}
        </div>

        {/* Stream Controls */}
        {!streaming ? (
          <button
            onClick={startStream}
            data-testid="start-stream-btn"
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-lg text-sm font-semibold hover:bg-emerald-500/25 transition-all"
          >
            <Play size={14} />
            Stream
          </button>
        ) : (
          <button
            onClick={stopStream}
            data-testid="stop-stream-btn"
            className="flex items-center gap-2 px-4 py-2 bg-red-500/15 border border-red-500/30 text-red-400 rounded-lg text-sm font-semibold hover:bg-red-500/25 transition-all"
          >
            <Square size={14} />
            Stop
          </button>
        )}

        <button
          onClick={() => useStore.setState({ logs: [] })}
          data-testid="clear-logs-btn"
          className="p-2 hover:bg-white/5 rounded-lg text-gray-500 hover:text-white transition-colors"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Terminal Window */}
      <div className="card-glow flex-1 overflow-hidden flex flex-col">
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-bg-border bg-bg-panel/50">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/60" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
            </div>
            <span className="text-[10px] text-gray-500 font-mono uppercase tracking-wider ml-2">
              SIEM Log Stream
            </span>
          </div>
          <div className="flex items-center gap-2">
            {streaming && (
              <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono">
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                STREAMING
              </span>
            )}
            <span className="text-[10px] text-gray-600 font-mono">
              {logs.length} entries
            </span>
          </div>
        </div>

        {/* Log Content */}
        <div className="flex-1 overflow-y-auto p-4 font-mono text-xs bg-[#0a0a0a]">
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-600">
              <Terminal size={32} className="mb-3 opacity-50" />
              <div className="text-sm">No logs yet</div>
              <div className="text-xs mt-1">Click Stream to start live feed</div>
            </div>
          )}
          {filtered.map((l, i) => (
            <div
              key={i}
              className={clsx(
                'flex gap-4 py-1.5 px-2 -mx-2 rounded transition-colors hover:bg-white/2',
                LOG_BG[l.level]
              )}
            >
              <span className="text-gray-600 shrink-0 tabular-nums w-20">
                {new Date(l.time).toLocaleTimeString('en-US', { hour12: false })}
              </span>
              <span className={clsx('w-16 shrink-0 font-semibold', LOG_COLORS[l.level] || 'text-gray-400')}>
                [{l.level}]
              </span>
              <span className={clsx(
                'flex-1 terminal-text',
                l.level === 'ERROR' || l.level === 'CRITICAL' ? 'text-red-300' 
                  : l.level === 'WARN' ? 'text-amber-300' 
                  : 'text-gray-400'
              )}>
                {l.msg}
              </span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  )
}
