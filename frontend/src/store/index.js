import { create } from 'zustand'

export const useStore = create((set, get) => ({
  alerts: [], cases: [], stats: {}, health: {}, logs: [],
  activity: [], systemStatus: {}, metrics: {},
  loading: { alerts: false, cases: false },
  selectedAlert: null, selectedCase: null, activeTab: 'dashboard',
  wsConnected: false, newAlertFlash: false,

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedAlert: (a) => set({ selectedAlert: a }),
  setSelectedCase: (c) => set({ selectedCase: c }),
  setAlerts: (alerts) => set({ alerts }),
  setCases:  (cases)  => set({ cases }),
  setStats:  (stats)  => set({ stats }),
  setHealth: (health) => set({ health }),
  setActivity: (activity) => set({ activity }),
  setSystemStatus: (systemStatus) => set({ systemStatus }),
  setMetrics: (metrics) => set({ metrics }),
  setWsConnected: (v) => set({ wsConnected: v }),

  addLog: (log) => set(s => ({ logs: [log, ...s.logs].slice(0, 300) })),
  addActivity: (entry) => set(s => ({ activity: [entry, ...s.activity].slice(0, 200) })),

  addAlert: (alert) => {
    set(s => ({ alerts: [alert, ...s.alerts], newAlertFlash: true }))
    setTimeout(() => set({ newAlertFlash: false }), 2000)
  },
  updateAlert: (id, updates) => set(s => ({
    alerts: s.alerts.map(a => a.id === id ? { ...a, ...updates } : a)
  })),
  updateCase: (id, updates) => set(s => ({
    cases: s.cases.map(c => c.id === id ? { ...c, ...updates } : c)
  })),
}))
