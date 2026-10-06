import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Activity, ClipboardCheck, History, LayoutDashboard, LogOut, Menu, Microscope, Shield, User, X } from 'lucide-react'
import { useAuth } from '../../App'
import { diagnoseApi } from '../../lib/api'
import { BRAND_SHORT } from '../../lib/brand'

const PATIENT_NAV = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Overview' },
  { path: '/diagnose', icon: Microscope, label: 'New diagnosis' },
  { path: '/history', icon: History, label: 'History' },
  { path: '/lesions', icon: Activity, label: 'Lesion tracking' },
  { path: '/profile', icon: User, label: 'Profile' },
]

const DOCTOR_NAV = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Overview' },
  { path: '/doctor', icon: ClipboardCheck, label: 'Review queue' },
]

const ADMIN_NAV = [{ path: '/admin', icon: Shield, label: 'Administration' }]

function Brand({ small = false }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className={`brand-mark ${small ? 'small' : ''}`}><Microscope size={small ? 14 : 16} /></span>
      <span className="font-semibold tracking-tight text-ink">{BRAND_SHORT}</span>
    </span>
  )
}

function UserBlock({ user, onLogout }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-2 px-1">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white bg-teal-500">
          {user?.name?.[0]?.toUpperCase() || 'U'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-ink truncate">{user?.name}</div>
          <div className="text-xs text-muted capitalize">{user?.role}</div>
        </div>
      </div>
      <button onClick={onLogout} className="flex items-center gap-2 w-full px-2.5 py-2 rounded-lg text-sm text-muted hover:text-red-700 hover:bg-red-50 transition-colors">
        <LogOut size={14} /> Sign out
      </button>
    </div>
  )
}

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [unread, setUnread] = useState(0)
  const [mobileOpen, setMobileOpen] = useState(false)

  const isPatient = user?.role === 'patient'
  const isDoctor = user?.role === 'doctor'
  const isAdmin = user?.role === 'admin'
  const nav = isPatient ? PATIENT_NAV : isDoctor ? DOCTOR_NAV : isAdmin ? ADMIN_NAV : []

  const handleLogout = () => {
    setMobileOpen(false)
    logout()
    navigate('/')
  }

  useEffect(() => {
    setMobileOpen(false)
    if (isPatient) {
      diagnoseApi.unreadReviews().then(r => setUnread(r.data.unread_reviews)).catch(() => {})
    }
  }, [location.pathname, isPatient])

  const renderNav = () => nav.map(({ path, icon: Icon, label }) => {
    const active = location.pathname === path
    return (
      <Link key={path} to={path} className="app-nav-link"
        style={{ background: active ? '#F0F7F6' : 'transparent', color: active ? '#0B524D' : '#5A6968', fontWeight: active ? 600 : 500 }}>
        <span className="app-nav-icon" style={{ background: active ? '#D5E8E5' : 'transparent' }}>
          <Icon size={15} strokeWidth={active ? 2.2 : 1.8} />
        </span>
        <span className="flex-1">{label}</span>
        {path === '/history' && unread > 0 && <span className="nav-count">{unread}</span>}
      </Link>
    )
  })

  return (
    <div className="flex min-h-screen bg-paper">
      <aside className="app-sidebar flex-col fixed left-0 top-0 bottom-0 z-40 hidden lg:flex">
        <div className="px-5 h-16 flex items-center border-b border-line">
          <Link to="/dashboard"><Brand /></Link>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">{renderNav()}</nav>
        <div className="p-4 border-t border-line">
          <UserBlock user={user} onLogout={handleLogout} />
        </div>
      </aside>

      <header className="app-mobile-header fixed top-0 left-0 right-0 h-14 bg-white border-b border-line z-50 items-center justify-between px-4">
        <Link to="/dashboard"><Brand small /></Link>
        <button onClick={() => setMobileOpen(true)} className="w-9 h-9 rounded-lg border border-line flex items-center justify-center text-muted" aria-label="Open menu">
          <Menu size={18} />
        </button>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-[60] bg-black/25 lg:hidden" onClick={() => setMobileOpen(false)}>
          <aside className="absolute right-0 top-0 bottom-0 w-[288px] bg-white shadow-xl p-4 flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-4 border-b border-line">
              <Brand small />
              <button onClick={() => setMobileOpen(false)} className="w-8 h-8 rounded-lg border border-line flex items-center justify-center text-muted" aria-label="Close menu">
                <X size={17} />
              </button>
            </div>
            <div className="py-4 space-y-0.5 flex-1">{renderNav()}</div>
            <div className="pt-4 border-t border-line">
              <UserBlock user={user} onLogout={handleLogout} />
            </div>
          </aside>
        </div>
      )}

      <main className="app-main flex-1 min-h-screen max-lg:pt-14">{children}</main>
    </div>
  )
}
