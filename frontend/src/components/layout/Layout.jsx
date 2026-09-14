import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../App'
import { diagnoseApi } from '../../lib/api'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard,
  Microscope,
  History,
  User,
  Shield,
  LogOut,
  ClipboardCheck,
  Menu,
  X,
  Bell,
  ChevronRight,
} from 'lucide-react'

const PATIENT_NAV = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/diagnose', icon: Microscope, label: 'Diagnose' },
  { path: '/history', icon: History, label: 'History' },
  { path: '/profile', icon: User, label: 'Profile' },
]

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [unread, setUnread] = useState(0)
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = () => {
    setMobileOpen(false)
    logout()
    navigate('/')
  }

  const nav = user?.role === 'patient' ? PATIENT_NAV : []
  const isPatient = user?.role === 'patient'
  const isDoctor = user?.role === 'doctor'
  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    setMobileOpen(false)
    if (isPatient) {
      diagnoseApi.unreadReviews().then(r => setUnread(r.data.unread_reviews)).catch(() => {})
    }
  }, [location.pathname, isPatient])

  const renderNav = () => (
    <>
      {nav.map(({ path, icon: Icon, label }) => {
        const active = location.pathname === path
        return (
          <Link
            key={path}
            to={path}
            className="group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all"
            style={{
              background: active ? '#EEF4F3' : 'transparent',
              color: active ? '#254742' : '#5B6764',
              fontWeight: active ? 600 : 500,
            }}
          >
            <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: active ? '#DCEBE7' : 'transparent' }}>
              <Icon size={15} strokeWidth={active ? 2.25 : 1.8} />
            </span>
            <span className="flex-1">{label}</span>
            {path === '/history' && unread > 0 && (
              <span className="min-w-5 h-5 px-1.5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: '#B4413A', color: '#FFFFFF' }}>
                {unread}
              </span>
            )}
            <ChevronRight size={13} className="opacity-0 -translate-x-1 group-hover:opacity-60 group-hover:translate-x-0 transition-all" />
          </Link>
        )
      })}

      {isDoctor && (
        <Link
          to="/doctor"
          className="group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all"
          style={{
            background: location.pathname === '/doctor' ? '#EEF4F3' : 'transparent',
            color: location.pathname === '/doctor' ? '#254742' : '#5B6764',
            fontWeight: location.pathname === '/doctor' ? 600 : 500,
          }}
        >
          <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: location.pathname === '/doctor' ? '#DCEBE7' : 'transparent' }}>
            <ClipboardCheck size={15} />
          </span>
          <span className="flex-1">Review Queue</span>
          <ChevronRight size={13} className="opacity-0 -translate-x-1 group-hover:opacity-60 group-hover:translate-x-0 transition-all" />
        </Link>
      )}

      {isAdmin && (
        <Link
          to="/admin"
          className="group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all"
          style={{
            background: location.pathname === '/admin' ? '#EEF4F3' : 'transparent',
            color: location.pathname === '/admin' ? '#254742' : '#5B6764',
            fontWeight: location.pathname === '/admin' ? 600 : 500,
          }}
        >
          <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: location.pathname === '/admin' ? '#DCEBE7' : 'transparent' }}>
            <Shield size={15} />
          </span>
          <span className="flex-1">Admin</span>
          <ChevronRight size={13} className="opacity-0 -translate-x-1 group-hover:opacity-60 group-hover:translate-x-0 transition-all" />
        </Link>
      )}
    </>
  )

  return (
    <div className="flex min-h-screen bg-paper">
      <aside className="app-sidebar flex-col fixed left-0 top-0 bottom-0 bg-white border-r border-line z-40 hidden lg:flex">
        <div className="px-5 py-5 border-b border-line">
          <Link to={isAdmin ? '/admin' : isDoctor ? '/dashboard' : '/dashboard'} className="flex items-center gap-3">
            <div className="brand-mark"><Microscope size={16} /></div>
            <div>
              <div className="font-serif font-semibold text-ink text-base">DERMAXAI</div>
              <div className="text-[9px] uppercase tracking-[0.16em] text-muted mt-0.5">Clinical intelligence</div>
            </div>
          </Link>
        </div>

        <div className="px-5 pt-6 pb-2">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted/70">Workspace</div>
        </div>
        <nav className="flex-1 px-3 space-y-1">{renderNav()}</nav>

        <div className="mx-4 mb-4 rounded-2xl p-3.5 bg-[#F3F7F5] border border-[#DEE9E5]">
          <div className="flex items-center gap-2 mb-2">
            <Bell size={13} className="text-teal-700" />
            <span className="text-[10px] uppercase tracking-[0.12em] font-bold text-teal-800">Clinical workspace</span>
          </div>
          <p className="text-[11px] leading-5 text-muted">Review uncertainty signals and supporting evidence before making decisions.</p>
        </div>

        <div className="px-4 py-4 border-t border-line">
          <div className="flex items-center gap-3 mb-3 px-1">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold text-white bg-teal-500 shadow-sm">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-ink truncate">{user?.name}</div>
              <div className="text-xs text-muted capitalize mt-0.5">{user?.role}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-muted hover:text-red-700 hover:bg-red-50 transition-colors">
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>

      <header className="app-mobile-header fixed top-0 left-0 right-0 h-16 bg-white/95 backdrop-blur border-b border-line z-50 items-center justify-between px-4">
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <div className="brand-mark small"><Microscope size={14} /></div>
          <span className="font-serif font-semibold text-ink">DERMAXAI</span>
        </Link>
        <button onClick={() => setMobileOpen(true)} className="w-9 h-9 rounded-lg border border-line flex items-center justify-center text-muted">
          <Menu size={18} />
        </button>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-[2px] lg:hidden" onClick={() => setMobileOpen(false)}>
          <aside className="absolute right-0 top-0 bottom-0 w-[300px] bg-white shadow-2xl p-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-1 pb-4 border-b border-line">
              <div className="flex items-center gap-2.5"><div className="brand-mark small"><Microscope size={14} /></div><span className="font-serif font-semibold text-ink">DERMAXAI</span></div>
              <button onClick={() => setMobileOpen(false)} className="w-8 h-8 rounded-lg border border-line flex items-center justify-center text-muted"><X size={17} /></button>
            </div>
            <div className="py-5 space-y-1">{renderNav()}</div>
            <div className="absolute left-4 right-4 bottom-4 pt-4 border-t border-line">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold text-white bg-teal-500">{user?.name?.[0]?.toUpperCase() || 'U'}</div>
                <div><div className="text-sm font-medium text-ink">{user?.name}</div><div className="text-xs text-muted capitalize">{user?.role}</div></div>
              </div>
              <button onClick={handleLogout} className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm text-muted hover:text-red-700 hover:bg-red-50"><LogOut size={14} /> Sign out</button>
            </div>
          </aside>
        </div>
      )}

      <main className="app-main flex-1 min-h-screen pt-0 lg:pt-0 max-lg:pt-16">{children}</main>
    </div>
  )
}
