import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../App'
import { diagnoseApi } from '../../lib/api'
import { useEffect, useState } from 'react'
import { LayoutDashboard, Microscope, History, User, Shield, LogOut, ClipboardCheck } from 'lucide-react'

const PATIENT_NAV = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/diagnose',  icon: Microscope,      label: 'Diagnose' },
  { path: '/history',   icon: History,         label: 'History' },
  { path: '/profile',   icon: User,            label: 'Profile' },
]

const DOCTOR_NAV = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
]

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const handleLogout = () => { logout(); navigate('/') }
  const [unread, setUnread] = useState(0)

  const nav = user?.role === 'doctor' ? DOCTOR_NAV
    : user?.role === 'admin' ? []
    : PATIENT_NAV

  useEffect(() => {
    if (user?.role === 'patient') {
      diagnoseApi.unreadReviews().then(r => setUnread(r.data.unread_reviews)).catch(() => {})
    }
  }, [user, location.pathname])

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 flex flex-col fixed left-0 top-0 bottom-0 bg-white border-r border-line">
        <div className="px-6 py-5 border-b border-line">
          <div className="font-serif font-semibold text-ink text-lg">DERMAXAI</div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {nav.map(({ path, icon: Icon, label }) => {
            const active = location.pathname === path
            return (
              <Link key={path} to={path}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors"
                style={{
                  background: active ? '#EEF4F3' : 'transparent',
                  color: active ? '#254742' : '#5B6764',
                  fontWeight: active ? 600 : 500,
                }}>
                <Icon size={16} strokeWidth={active ? 2.25 : 1.75} />
                <span className="flex-1">{label}</span>
                {path === '/history' && unread > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ background: '#B4413A', color: '#FFFFFF' }}>
                    {unread}
                  </span>
                )}
              </Link>
            )
          })}

          {user?.role === 'doctor' && (
            <Link to="/doctor"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors"
              style={{
                background: location.pathname === '/doctor' ? '#EEF4F3' : 'transparent',
                color: location.pathname === '/doctor' ? '#254742' : '#5B6764',
                fontWeight: location.pathname === '/doctor' ? 600 : 500,
              }}>
              <ClipboardCheck size={16} strokeWidth={location.pathname === '/doctor' ? 2.25 : 1.75} />
              Review Queue
            </Link>
          )}

          {user?.role === 'admin' && (
            <Link to="/admin"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors"
              style={{
                background: location.pathname === '/admin' ? '#EEF4F3' : 'transparent',
                color: location.pathname === '/admin' ? '#254742' : '#5B6764',
                fontWeight: location.pathname === '/admin' ? 600 : 500,
              }}>
              <Shield size={16} strokeWidth={location.pathname === '/admin' ? 2.25 : 1.75} />
              Admin
            </Link>
          )}
        </nav>

        <div className="px-4 py-4 border-t border-line">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white bg-teal-500">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-ink truncate">{user?.name}</div>
              <div className="text-xs text-muted capitalize">{user?.role}</div>
            </div>
          </div>
          <button onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-muted hover:text-clinical-red hover:bg-clinical-red-bg transition-colors">
            <LogOut size={15} />Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 ml-60 min-h-screen">{children}</main>
    </div>
  )
}
