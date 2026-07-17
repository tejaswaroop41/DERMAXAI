import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useState, createContext, useContext } from 'react'
import './index.css'

import Login      from './pages/Login'
import Register   from './pages/Register'
import Dashboard  from './pages/Dashboard'
import Diagnose   from './pages/Diagnose'
import History    from './pages/History'
import Profile    from './pages/Profile'
import Admin      from './pages/Admin'
import Landing    from './pages/Landing'

export const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')) } catch { return null }
  })
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
  return <AuthCtx.Provider value={{ user, login, logout }}>{children}</AuthCtx.Provider>
}

function Protected({ children, adminOnly = false }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && user.role !== 'admin') return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
        <div className="bg-mesh" />
        <Toaster position="top-right" toastOptions={{
          style: { background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(14,165,233,0.3)',
                   color: '#e2e8f0', fontFamily: 'Syne, sans-serif', borderRadius: '12px' }
        }} />
        <Routes>
          <Route path="/"          element={<Landing />} />
          <Route path="/login"     element={<Login />} />
          <Route path="/register"  element={<Register />} />
          <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
          <Route path="/diagnose"  element={<Protected><Diagnose /></Protected>} />
          <Route path="/history"   element={<Protected><History /></Protected>} />
          <Route path="/profile"   element={<Protected><Profile /></Protected>} />
          <Route path="/admin"     element={<Protected adminOnly><Admin /></Protected>} />
          <Route path="*"          element={<Navigate to="/" replace />} />
        </Routes>
    </AuthProvider>
  )
}
