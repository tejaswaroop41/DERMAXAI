import { lazy, Suspense, useState, createContext, useContext, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import './index.css'
import { authApi } from './lib/api'

const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Diagnose = lazy(() => import('./pages/Diagnose'))
const History = lazy(() => import('./pages/History'))
const Profile = lazy(() => import('./pages/Profile'))
const Admin = lazy(() => import('./pages/Admin'))
const Doctor = lazy(() => import('./pages/Doctor'))
const Landing = lazy(() => import('./pages/Landing'))
const Lesions = lazy(() => import('./pages/Lesions'))

export const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')) } catch { return null }
  })
  const [initializing, setInitializing] = useState(true)

  const login = (userData, token) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      setInitializing(false)
      return
    }
    authApi.me()
      .then(({ data }) => {
        localStorage.setItem('user', JSON.stringify(data))
        setUser(data)
      })
      .catch(err => {
        const status = err.response?.status
        if (status === 401 || status === 403) logout()
      })
      .finally(() => setInitializing(false))
  }, [])

  return (
    <AuthCtx.Provider value={{ user, login, logout, initializing }}>
      {children}
    </AuthCtx.Provider>
  )
}

export function homeForRole(role) {
  if (role === 'admin') return '/admin'
  if (role === 'doctor') return '/doctor'
  return '/dashboard'
}

function Protected({ children, roles }) {
  const { user, initializing } = useAuth()
  const location = useLocation()

  if (initializing) {
    return <div className="min-h-screen flex items-center justify-center bg-paper text-muted">Loading…</div>
  }
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={homeForRole(user.role)} replace />
  }
  return children
}

function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-paper">
      <div className="loading-shell">
        <div className="loading-mark" />
        <span>Loading workspace…</span>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" toastOptions={{
        style: {
          background: '#FFFFFF', border: '1px solid #DDE5E2',
          color: '#1C2321', fontFamily: 'IBM Plex Sans, sans-serif', borderRadius: '12px'
        }
      }} />
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/dashboard" element={<Protected roles={['patient', 'doctor']}><Dashboard /></Protected>} />
          <Route path="/diagnose" element={<Protected roles={['patient']}><Diagnose /></Protected>} />
          <Route path="/history" element={<Protected roles={['patient']}><History /></Protected>} />
          <Route path="/lesions" element={<Protected roles={['patient']}><Lesions /></Protected>} />
          <Route path="/profile" element={<Protected roles={['patient']}><Profile /></Protected>} />
          <Route path="/admin" element={<Protected roles={['admin']}><Admin /></Protected>} />
          <Route path="/doctor" element={<Protected roles={['doctor']}><Doctor /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  )
}
