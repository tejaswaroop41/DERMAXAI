import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || '/api'
const api = axios.create({ baseURL: API_URL })

const getToken = () => localStorage.getItem('token')

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