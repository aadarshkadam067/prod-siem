import React from 'react'
import { useStore } from '../store'
import { getReport } from '../services/api'
import { FileText, Download, Eye, Shield, Brain } from 'lucide-react'
import { severityBadge, fmtTime, statusColor } from '../utils'
import clsx from 'clsx'

export default function Reports() {
  const { cases, alerts } = useStore()

  const withReports = cases.filter(c => c.ai_analysis || c.report_path)
  const analyzedAlerts = alerts.filter(a => a.ai_analysis)

  return (
    <div className="p-6 space-y-6 animate-slide-in" data-testid="reports-page">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-5">
        <div className="card-glow text-center">
          <div className="w-12 h-12 rounded-xl bg-mars-700/10 mx-auto mb-3 flex items-center justify-center">
            <FileText size={24} className="text-mars-400" />
          </div>
          <div className="text-4xl font-bold font-mono text-mars-400">{withReports.length}</div>
          <div className="text-sm text-gray-500 mt-1">Case Reports</div>
        </div>
        <div className="card-glow text-center">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 mx-auto mb-3 flex items-center justify-center">
            <Brain size={24} className="text-purple-400" />
          </div>
          <div className="text-4xl font-bold font-mono text-purple-400">{analyzedAlerts.length}</div>
          <div className="text-sm text-gray-500 mt-1">AI Analyses</div>
        </div>
        <div className="card-glow text-center">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 mx-auto mb-3 flex items-center justify-center">
            <Shield size={24} className="text-emerald-400" />
          </div>
          <div className="text-4xl font-bold font-mono text-emerald-400">
            {cases.filter(c => c.status === 'closed').length}
          </div>
          <div className="text-sm text-gray-500 mt-1">Closed Cases</div>
        </div>
      </div>

      {/* Incident Reports Table */}
      <div className="card-glow overflow-hidden">
        <h3 className="text-sm font-semibold text-white mb-5 flex items-center gap-2 px-1">
          <FileText size={16} className="text-mars-400" />
          Incident Reports
        </h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-bg-border">
              {['Case ID', 'Title', 'Severity', 'Status', 'Created', 'Actions'].map(h => (
                <th key={h} className="table-header px-4 first:pl-5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {withReports.length === 0 && (
              <tr>
                <td colSpan={6} className="py-16 text-center">
                  <Shield size={48} className="text-gray-700 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No reports generated yet</p>
                  <p className="text-gray-600 text-xs mt-1">AI generates PDF reports for HIGH/CRITICAL alerts automatically</p>
                </td>
              </tr>
            )}
            {withReports.map((c, i) => (
              <tr key={i} className="table-row">
                <td className="table-cell px-4 pl-5 font-mono text-mars-400 font-semibold">{c.id}</td>
                <td className="table-cell px-4 text-gray-300 max-w-[220px] truncate">{c.title}</td>
                <td className="table-cell px-4">
                  <span className={severityBadge(c.severity)}>{c.severity}</span>
                </td>
                <td className="table-cell px-4">
                  <span className={clsx('font-mono font-medium text-xs', statusColor(c.status))}>{c.status}</span>
                </td>
                <td className="table-cell px-4 font-mono text-gray-500 text-xs">{fmtTime(c.created_at)}</td>
                <td className="table-cell px-4">
                  <div className="flex gap-2">
                    <a
                      href={getReport(c.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg text-xs font-medium hover:bg-blue-500/20 transition-all"
                    >
                      <Eye size={12} />
                      View
                    </a>
                    <a
                      href={getReport(c.id)}
                      download
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs font-medium hover:bg-emerald-500/20 transition-all"
                    >
                      <Download size={12} />
                      PDF
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* AI Analysis Log */}
      {analyzedAlerts.length > 0 && (
        <div className="card-glow">
          <h3 className="text-sm font-semibold text-white mb-5 flex items-center gap-2">
            <Brain size={16} className="text-purple-400" />
            AI Analysis Log
          </h3>
          <div className="space-y-3">
            {analyzedAlerts.slice(0, 10).map((a, i) => {
              const ai = a.ai_analysis
              return (
                <div key={i} className="bg-bg-panel/50 rounded-lg p-4 flex items-start gap-4 border border-bg-border/50 hover:border-purple-500/30 transition-all">
                  <span className={severityBadge(ai.severity || a.severity)}>{ai.severity || a.severity}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-gray-300 text-sm font-mono">{a.id}</span>
                      <span className={clsx(
                        'text-xs font-mono font-bold px-2 py-0.5 rounded',
                        ai.decision === 'escalate' ? 'text-red-400 bg-red-500/10' : 'text-emerald-400 bg-emerald-500/10'
                      )}>
                        → {ai.decision?.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-gray-500 text-xs truncate">{ai.investigation_notes?.slice(0, 150)}...</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-mono font-bold text-white">{ai.confidence}%</div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider">Confidence</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
