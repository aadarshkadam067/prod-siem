import { useEffect, useRef } from 'react'
import { useStore } from '../store'

export function useWebSocket() {
  const { addAlert, updateCase, addActivity, setWsConnected, addLog } = useStore()
  const wsRef = useRef(null)
  const reconnectRef = useRef(null)

  const connect = () => {
    try {
      const ws = new WebSocket('ws://localhost:8000/ws')
      wsRef.current = ws

      ws.onopen = () => {
        setWsConnected(true)
        addLog({ time: new Date().toISOString(), level: 'INFO', msg: '[WS] Connected to SOC SIEM backend' })
        if (reconnectRef.current) clearTimeout(reconnectRef.current)
      }

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.event === 'new_alert' && msg.data) {
            addAlert(msg.data)
            addActivity({
              id: `ws-${Date.now()}`,
              type: 'alert_created',
              message: `New ${msg.data.severity} alert: ${msg.data.type} from ${msg.data.source_ip || 'unknown'}`,
              severity: msg.data.severity?.toLowerCase(),
              timestamp: new Date().toISOString()
            })
            addLog({ time: new Date().toISOString(), level: 'WARN',
              msg: `[WS] New alert: ${msg.data.type} [${msg.data.severity}] from ${msg.data.source_ip}` })
          }
          if (msg.event === 'case_updated' && msg.data) {
            updateCase(msg.data.id, msg.data)
          }
          if (msg.event === 'ai_decision' && msg.data) {
            addActivity({
              id: `ai-${Date.now()}`,
              type: 'ai_decision',
              message: `AI decision: ${msg.data.decision?.toUpperCase()} for ${msg.data.alert_id}`,
              severity: msg.data.severity?.toLowerCase(),
              timestamp: new Date().toISOString()
            })
          }
        } catch {}
      }

      ws.onclose = () => {
        setWsConnected(false)
        reconnectRef.current = setTimeout(connect, 5000)
      }

      ws.onerror = () => {
        ws.close()
      }
    } catch {}
  }

  useEffect(() => {
    connect()
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
      if (wsRef.current) wsRef.current.close()
    }
  }, [])

  return wsRef
}
