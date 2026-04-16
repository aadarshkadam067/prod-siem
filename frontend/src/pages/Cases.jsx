import React, { useState } from 'react'
import { useStore } from '../store'
import { addCaseNote, closeCase } from '../services/api'
import { statusColor, severityBadge, fmtTime } from '../utils'
import { X, MessageSquare, CheckCircle, Brain, FolderOpen, Shield, ExternalLink } from 'lucide-react'
import clsx from 'clsx'

function CaseModal({ c, onClose }) {
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [closing, setClosing] = useState(false)

  const submitNote = async () => {
    if (!note.trim()) return
    setSubmitting(true)
    try { await addCaseNote(c.id, { note, author: 'analyst' }) } catch (e) {}
    setNote('')
    setSubmitting(false)
  }

  const close = async () => {
    setClosing(true)
    try { await closeCase(c.id, { reason: 'Manually closed by analyst' }) } catch (e) {}
    setClosing(false)
    onClose()
  }

  const ai = c.ai_analysis

  return (
    <div className="fixed inset-0 modal-backdrop z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-bg-card border border-bg-border rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-bg-border bg-gradient-to-r from-blue-500/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <FolderOpen size={18} className="text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm font-mono">{c.id}</h3>
              <p className="text-gray-500 text-xs mt-0.5 truncate max-w-md">{c.title}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg text-gray-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Case Details Grid */}
          <div className="grid grid-cols-3 gap-3">
            {[
              ['Status', <span className={clsx('font-mono font-semibold', statusColor(c.status))}>{c.status}</span>],
              ['Severity', <span className={severityBadge(c.severity)}>{c.severity}</span>],
              ['Assigned', c.assigned_to || 'AI-Engine'],
              ['Created', fmtTime(c.created_at), 'font-mono'],
              ['Source IP', c.source_ip || '—', 'font-mono text-mars-400'],
              ['Alert ID', c.alert_id || '—', 'font-mono']
            ].map(([k, v, cls], i) => (
              <div key={i} className="bg-bg-panel rounded-lg p-3 border border-bg-border/50">
                <div className="text-gray-500 text-[10px] uppercase tracking-wider mb-1.5">{k}</div>
                <div className={clsx('text-white text-sm', cls)}>{v}</div>
              </div>
            ))}
          </div>

          {/* MITRE ATT&CK */}
          {c.mitre_techniques?.length > 0 && (
            <div className="bg-bg-panel rounded-lg p-4 border border-bg-border/50">
              <div className="text-gray-500 text-[10px] uppercase tracking-wider mb-3">MITRE ATT&CK Techniques</div>
              <div className="flex flex-wrap gap-2">
                {c.mitre_techniques.map(t => (
                  <span key={t} className="text-[10px] bg-purple-500/15 text-purple-400 border border-purple-500/25 px-2.5 py-1 rounded-md font-mono">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* AI Analysis */}
          {ai && (
            <div className="bg-gradient-to-br from-purple-500/10 to-mars-900/10 rounded-xl p-5 border border-purple-500/20">
              <div className="flex items-center gap-2 mb-3">
                <Brain size={14} className="text-purple-400" />
                <span className="text-xs text-purple-400 font-semibold">AI Investigation Notes</span>
              </div>
              <p className="text-gray-300 text-sm leading-relaxed">{ai.investigation_notes}</p>
            </div>
          )}

          {/* Notes Timeline */}
          {c.notes?.length > 0 && (
            <div className="space-y-3">
              <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Investigation Timeline</div>
              {c.notes.map((n, i) => (
                <div key={i} className="bg-bg-panel rounded-lg p-3 border border-bg-border/50 flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-400">
                    {n.author?.charAt(0).toUpperCase() || 'A'}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                      <span className="font-mono font-semibold">{n.author}</span>
                      <span className="font-mono">{fmtTime(n.time)}</span>
                    </div>
                    <p className="text-gray-300 text-sm">{n.note}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Add investigation note..."
              className="input-dark flex-1 text-sm"
              onKeyDown={e => e.key === 'Enter' && submitNote()}
            />
            <button
              onClick={submitNote}
              disabled={submitting || !note.trim()}
              className="px-4 py-2.5 bg-blue-500/15 border border-blue-500/30 text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-500/25 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              <MessageSquare size={14} />
              {submitting ? '...' : 'Add Note'}
            </button>
            <button
              onClick={close}
              disabled={closing || c.status === 'closed'}
              className="px-4 py-2.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-lg text-sm font-medium hover:bg-emerald-500/25 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              <CheckCircle size={14} />
              {closing ? '...' : 'Close Case'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Cases() {
  const { cases } = useStore()
  const [selected, setSelected] = useState(null)
  const [filter, setFilter] = useState('all')
  const filtered = filter === 'all' ? cases : cases.filter(c => c.status === filter)

  const statusCounts = cases.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1
    return acc
  }, {})

  return (
    <div className="p-6 animate-slide-in" data-testid="cases-page">
      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 mb-6 bg-bg-card border border-bg-border rounded-xl p-1 w-fit">
        {['all', 'new', 'investigating', 'escalated', 'closed'].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            data-testid={`case-filter-${s}`}
            className={clsx(
              'px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200',
              filter === s
                ? s === 'escalated' 
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-mars-700/20 text-mars-400 border border-mars-700/30'
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
            )}
          >
            {s.toUpperCase()}
            {statusCounts[s] > 0 && (
              <span className="ml-1.5 text-[10px] opacity-70">({statusCounts[s]})</span>
            )}
          </button>
        ))}
      </div>

      {/* Cases Table */}
      <div className="card-glow overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-bg-border">
              {['Case ID', 'Title', 'Severity', 'Status', 'Assigned', 'Created', 'Actions'].map(h => (
                <th key={h} className="table-header px-4 first:pl-5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="py-16 text-center">
                  <Shield size={40} className="text-gray-700 mx-auto mb-3" />
                  <div className="text-gray-500 text-sm">No cases found</div>
                  <div className="text-gray-600 text-xs mt-1">Trigger AI analysis on an alert to create cases</div>
                </td>
              </tr>
            )}
            {filtered.map((c, i) => (
              <tr key={i} className="table-row">
                <td className="table-cell px-4 pl-5 font-mono text-mars-400 font-semibold">{c.id}</td>
                <td className="table-cell px-4 text-gray-300 max-w-[220px] truncate">{c.title}</td>
                <td className="table-cell px-4">
                  <span className={severityBadge(c.severity)}>{c.severity}</span>
                </td>
                <td className="table-cell px-4">
                  <span className={clsx('font-mono font-medium text-xs', statusColor(c.status))}>{c.status}</span>
                </td>
                <td className="table-cell px-4 text-gray-500 font-mono text-xs">{(c.assigned_to || 'AI').slice(0, 12)}</td>
                <td className="table-cell px-4 font-mono text-gray-500 text-xs">{fmtTime(c.created_at)}</td>
                <td className="table-cell px-4">
                  <button
                    onClick={() => setSelected(c)}
                    data-testid={`view-case-${i}`}
                    className="p-2 hover:bg-white/5 rounded-lg text-gray-500 hover:text-white transition-colors"
                  >
                    <ExternalLink size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        <div className="mt-4 pt-4 px-5 pb-2 border-t border-bg-border">
          <span className="text-xs text-gray-600 font-mono">
            Showing {filtered.length} of {cases.length} cases
          </span>
        </div>
      </div>

      {selected && <CaseModal c={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
