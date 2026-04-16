import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:8000',
  timeout: 15000,
})

api.interceptors.response.use(
  r => r,
  err => Promise.reject(err)
)

export const getHealth = () => api.get('/health')
export const getStats = () => api.get('/api/v1/stats')
export const getMetrics = () => api.get('/api/v1/metrics')
export const getSystemStatus = () => api.get('/api/v1/system/status')
export const getActivity = (n = 100) => api.get(`/api/v1/activity?limit=${n}`)

export const getAlerts = (params = {}) => api.get('/api/v1/alerts', { params })
export const ingestAlert = (data) => api.post('/api/v1/alerts/ingest', data)
export const triggerAI = (id) => api.post(`/api/v1/ai/analyze/${id}`)

export const getCases = (params = {}) => api.get('/api/v1/cases', { params })
export const getCase = (id) => api.get(`/api/v1/cases/${id}`)
export const addCaseNote = (id, data) => api.post(`/api/v1/cases/${id}/notes`, data)
export const closeCase = (id, data) => api.post(`/api/v1/cases/${id}/close`, data)
export const getCaseIOCs = (id) => api.get(`/api/v1/cases/${id}/iocs`)
export const getReport = (id) => `http://localhost:8000/api/v1/cases/${id}/report`

export default api
