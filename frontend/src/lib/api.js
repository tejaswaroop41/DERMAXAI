import axios from 'axios'

export const API_URL = import.meta.env.VITE_API_URL || '/api'
const api = axios.create({ baseURL: API_URL })

const getToken = () => localStorage.getItem('token')

export const apiPath = (path = '') => {
  if (!path) return '/'
  if (/^https?:\/\//i.test(path)) {
    const url = new URL(path)
    return apiPath(url.pathname)
  }
  const withoutApiPrefix = path.startsWith('/api/') ? path.slice(4) : path
  return withoutApiPrefix.startsWith('/') ? withoutApiPrefix : `/${withoutApiPrefix}`
}

export const getAuthenticatedBlobUrl = async (path) => {
  const response = await api.get(apiPath(path), { responseType: 'blob' })
  return URL.createObjectURL(response.data)
}

export const downloadAuthenticatedFile = async (path, filename = '') => {
  const blobUrl = await getAuthenticatedBlobUrl(path)
  const link = document.createElement('a')
  link.href = blobUrl
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  if (filename) link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
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
  unreadReviews: () => api.get('/diagnose/notifications'),
  markReviewsSeen: () => api.post('/diagnose/notifications/mark-seen'),
}

export const doctorApi = {
  queue:  () => api.get('/doctor/queue'),
  claim:  id => api.post(`/doctor/diagnoses/${id}/claim`),
  review: (id, data) => api.post(`/doctor/diagnoses/${id}/review`, data),
}

export const reportApi = {
  download: (path, filename) => downloadAuthenticatedFile(path, filename),
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
