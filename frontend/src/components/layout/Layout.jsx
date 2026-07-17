import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../App'
import { LayoutDashboard, Microscope, History, User, Shield, LogOut, Zap, ChevronRight } from 'lucide-react'

const nav = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/diagnose',  icon: Microscope,      label: 'Diagnose' },
  { path: '/history',   icon: History,         label: 'History' },
  { path: '/profile',   icon: User,            label: 'Profile' },
]

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const handleLogout = () => { logout(); navigate('/') }

  return (
    <div className="flex min-h-screen relative z-10">
      <aside className="w-64 flex flex-col fixed left-0 top-0 bottom-0 z-20"
        style={{ background: 'rgba(8, 12, 28, 0.95)', borderRight: '1px solid rgba(14,165,233,0.12)', backdropFilter: 'blur(20px)' }}>
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', boxShadow: '0 0 20px rgba(14,165,233,0.4)' }}>
              <Zap size={18} className="text-white" />
            </div>
            <div>
              <div className="font-bold text-white text-sm tracking-wider">DERMAXAI</div>
              <div className="text-xs text-sky-400/60 font-mono">v6.0</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {nav.map(({ path, icon: Icon, label }) => {
            const active = location.pathname === path
            return (
              <Link key={path} to={path}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200"
                style={{ background: active ? 'rgba(14,165,233,0.12)' : 'transparent',
                         border: active ? '1px solid rgba(14,165,233,0.25)' : '1px solid transparent',
                         color: active ? '#38bdf8' : '#64748b' }}>
                <Icon size={17} /><span className="text-sm font-medium">{label}</span>
                {active && <ChevronRight size={14} className="ml-auto" />}
              </Link>
            )
          })}
          {user?.role === 'admin' && (
            <Link to="/admin" className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200"
              style={{ background: location.pathname === '/admin' ? 'rgba(139,92,246,0.12)' : 'transparent',
                       color: location.pathname === '/admin' ? '#a78bfa' : '#64748b' }}>
              <Shield size={17} /><span className="text-sm font-medium">Admin</span>
            </Link>
          )}
        </nav>
        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #0ea5e9, #7c3aed)' }}>
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">{user?.name}</div>
              <div className="text-xs text-slate-500 capitalize">{user?.role}</div>
            </div>
          </div>
          <button onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-red-400 hover:bg-red-400/5 transition-all">
            <LogOut size={15} />Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 ml-64 min-h-screen">{children}</main>
    </div>
  )
}
