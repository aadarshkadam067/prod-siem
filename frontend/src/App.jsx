import React from 'react'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import { useStore } from './store'
import Dashboard from './pages/Dashboard'
import Alerts from './pages/Alerts'
import Cases from './pages/Cases'
import AIPanel from './pages/AIPanel'
import IOCPanel from './pages/IOCPanel'
import Logs from './pages/Logs'
import Reports from './pages/Reports'
import Timeline from './pages/Timeline'
import ActivityLog from './pages/ActivityLog'
import Metrics from './pages/Metrics'

const PAGES = {
  dashboard: Dashboard,
  alerts: Alerts,
  cases: Cases,
  ai: AIPanel,
  ioc: IOCPanel,
  logs: Logs,
  reports: Reports,
  timeline: Timeline,
  activity: ActivityLog,
  metrics: Metrics
}

export default function App() {
  const { activeTab } = useStore()
  const Page = PAGES[activeTab] || Dashboard
  
  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      {/* Background grid pattern */}
      <div className="fixed inset-0 bg-grid opacity-30 pointer-events-none" />
      
      {/* Ambient glow at top */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-radial-glow pointer-events-none" />
      
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Topbar />
        <main className="flex-1 overflow-y-auto relative" data-testid="main-content">
          <Page />
        </main>
      </div>
    </div>
  )
}
