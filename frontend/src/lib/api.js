import axios from 'axios'

export const API_URL = import.meta.env.VITE_API_URL || '/api'
const api = axios.create({ baseURL: API_URL })

const getToken = () => localStorage.getItem('token')

export const apiUrl = (path = '') => {
  if (!path) return API_URL
  if (/^https?:\/\//i.test(path)) return path
  const base = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL
  const suffix = path.startsWith('/api/') ? path.slice(4) : path.startsWith('/') ? path : `/${path}`
  return `${base}${suffix}`
}

export const getAuthenticatedBlobUrl = async (path) => {
  const response = await api.get(apiUrl(path), { responseType: 'blob' })
  return URL.createObjectURL(response.data)
}

export const openAuthenticatedFile = async (path) => {
  const blobUrl = await getAuthenticatedBlobUrl(path)
  window.open(blobUrl, '_blank', 'noopener,noreferrer')
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
}

api.interceptors.request.use(cfg => {
  const token = getToken()
  if (token) {
    cfg.headers = cfg.headers || {}
    cfg.headers.Authorization = `Bearer ${token}`
  }
  return cfg
})

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      // avoid clearing during login/register failure responses
      const url = err.config?.url || ''
      const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/register')
      if (!isAuthEndpoint) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        delete api.defaults.headers.common.Authorization
        window.location.assign('/login')
      }
    }
    return Promise.reject(err)
  }
)

export const setAuthToken = (token)  => {
  if (token) {
    localStorage.setItem('token', token)
    api.defaults.headers.common.Authorization = `Bearer ${token}`
  } else {
    localStorage.removeItem('token')
    delete api.defaults.headers.common.Authorization
  }
}

export default api

export const authApi = {
  login:    d => api.post('/auth/login', d),
  register: d => api.post('/auth/register', d),
  me:       () => api.get('/auth/me'),
}

export const diagnoseApi = {
  diagnose: fd => api.post('/diagnose', fd, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  history: () => api.get('/diagnose/history'),
  gradcam: path => getAuthenticatedBlobUrl(path),
}

export const reportApi = {
  open: path => openAuthenticatedFile(path),
}

export const patientApi = {
  getProfile:    () => api.get('/patients/profile'),
  updateProfile: d => api.put('/patients/profile', d),
}

export const adminApi = {
  stats:     () => api.get('/admin/stats'),
  users:     () => api.get('/admin/users'),
  diagnoses: () => api.get('/admin/diagnoses'),
}
