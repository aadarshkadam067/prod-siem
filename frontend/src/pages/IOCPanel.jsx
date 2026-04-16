import React, { useMemo } from 'react'
import { useStore } from '../store'
import { Globe, Hash, Link2, Shield, AlertTriangle, Search } from 'lucide-react'
import clsx from 'clsx'

export default function IOCPanel() {
  const { alerts, cases } = useStore()

  const iocs = useMemo(() => {
    const ips = new Map(), domains = new Map(), hashes = new Map(), urls = new Map()

    const extract = (ai) => {
      if (!ai?.iocs) return
      ai.iocs.ips?.forEach(x => ips.set(x, { value: x, malicious: true, source: ai.analyzed_by || 'AI' }))
      ai.iocs.domains?.forEach(x => domains.set(x, { value: x, source: ai.analyzed_by || 'AI' }))
      ai.iocs.hashes?.forEach(x => hashes.set(x, { value: x, source: ai.analyzed_by || 'AI' }))
      ai.iocs.urls?.forEach(x => urls.set(x, { value: x, source: ai.analyzed_by || 'AI' }))
    }

    alerts.forEach(a => extract(a.ai_analysis))
    cases.forEach(c => extract(c.ai_analysis))

    alerts.forEach(a => {
      if (a.source_ip && a.severity && ['HIGH', 'CRITICAL'].includes(a.severity.toUpperCase())) {
        if (!ips.has(a.source_ip)) {
          ips.set(a.source_ip, { value: a.source_ip, malicious: true, source: a.source || 'detection' })
        }
      }
    })

    return {
      ips: [...ips.values()],
      domains: [...domains.values()],
      hashes: [...hashes.values()],
      urls: [...urls.values()]
    }
  }, [alerts, cases])

  const Section = ({ icon: Icon, title, items, color, bgColor }) => (
    <div className="card-glow">
      <div className="flex items-center gap-2 mb-4">
        <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center', bgColor)}>
          <Icon size={16} className={color} />
        </div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <span className="ml-auto text-xs font-mono text-gray-500 bg-bg-panel px-2 py-0.5 rounded-full">
          {items.length}
        </span>
      </div>
      <div className="space-y-2 max-h-72 overflow-y-auto">
        {items.length === 0 && (
          <div className="text-gray-600 text-xs text-center py-8">
            <Search size={20} className="mx-auto mb-2 opacity-50" />
            No IOCs extracted yet
          </div>
        )}
        {items.map((item, i) => (
          <div key={i} className="flex items-center justify-between bg-bg-panel/50 rounded-lg px-3 py-2.5 border border-bg-border/50 group hover:border-mars-700/30 transition-all">
            <span className={clsx('text-xs font-mono truncate flex-1 mr-3', color)}>{item.value}</span>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] text-gray-600 font-mono">{item.source}</span>
              {item.malicious ? (
                <span className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded font-mono font-semibold">
                  MALICIOUS
                </span>
              ) : (
                <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded font-mono font-semibold">
                  SUSPICIOUS
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  const total = iocs.ips.length + iocs.domains.length + iocs.hashes.length + iocs.urls.length

  return (
    <div className="p-6 space-y-6 animate-slide-in" data-testid="ioc-panel-page">
      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          ['IP Addresses', iocs.ips.length, 'text-mars-400', 'bg-mars-700/10', Globe],
          ['Domains', iocs.domains.length, 'text-blue-400', 'bg-blue-500/10', Link2],
          ['File Hashes', iocs.hashes.length, 'text-purple-400', 'bg-purple-500/10', Hash],
          ['URLs', iocs.urls.length, 'text-red-400', 'bg-red-500/10', Link2],
        ].map(([l, v, c, bg, Icon]) => (
          <div key={l} className={clsx('card-glow text-center border', bg)}>
            <div className={clsx('w-10 h-10 rounded-lg mx-auto mb-3 flex items-center justify-center', bg)}>
              <Icon size={18} className={c} />
            </div>
            <div className={clsx('text-3xl font-bold font-mono', c)}>{v}</div>
            <div className="text-xs text-gray-500 mt-1">{l}</div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {total === 0 && (
        <div className="card-glow text-center py-16">
          <Shield size={48} className="text-gray-700 mx-auto mb-4" />
          <p className="text-gray-400 text-lg mb-2">No IOCs Extracted Yet</p>
          <p className="text-gray-600 text-sm">Run AI analysis on HIGH/CRITICAL alerts to extract IOCs automatically</p>
        </div>
      )}

      {/* IOC Sections */}
      {total > 0 && (
        <div className="grid grid-cols-2 gap-5">
          <Section icon={Globe} title="Malicious IP Addresses" items={iocs.ips} color="text-mars-400" bgColor="bg-mars-700/10" />
          <Section icon={Link2} title="Suspicious Domains" items={iocs.domains} color="text-blue-400" bgColor="bg-blue-500/10" />
          <Section icon={Hash} title="File Hashes" items={iocs.hashes} color="text-purple-400" bgColor="bg-purple-500/10" />
          <Section icon={Link2} title="Malicious URLs" items={iocs.urls} color="text-red-400" bgColor="bg-red-500/10" />
        </div>
      )}
    </div>
  )
}
