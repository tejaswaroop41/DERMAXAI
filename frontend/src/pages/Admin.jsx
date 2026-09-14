import { useEffect, useMemo, useState } from 'react'
import Layout from '../components/layout/Layout'
import { adminApi } from '../lib/api'
import { useAuth } from '../App'
import toast from 'react-hot-toast'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  Shield,
  Users,
  UserCog,
} from 'lucide-react'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const COLORS = { mel: '#B4413A', bcc: '#C17A3D', akiec: '#B08135', bkl: '#4F7A52', nv: '#3D6B94', df: '#6B5B95', vasc: '#3D8B94' }
const NAMES = { mel: 'Melanoma', bcc: 'Basal Cell Carcinoma', akiec: 'Actinic Keratoses', bkl: 'Benign Keratosis', nv: 'Melanocytic Nevi', df: 'Dermatofibroma', vasc: 'Vascular Lesions' }

function Metric({ icon: Icon, label, value, note, tone = 'teal' }) {
  const styles = {
    teal: ['#3D7068', '#EEF5F3'], red: ['#B4413A', '#FBEAE8'], amber: ['#B08135', '#FBF3E4'], purple: ['#6B5B95', '#F1EEF7']
  }
  const [color, bg] = styles[tone]
  return (
    <div className="card-stat">
      <div className="flex items-center justify-between gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: bg, color }}><Icon size={16} /></div>
        <span className="text-[10px] uppercase tracking-[0.12em] text-muted">System</span>
      </div>
      <div className="text-2xl font-serif font-semibold text-ink mt-4">{value ?? 0}</div>
      <div className="text-xs font-medium text-muted mt-1">{label}</div>
      {note && <div className="text-[10px] text-muted/80 mt-1">{note}</div>}
    </div>
  )
}

export default function Admin() {
  const { user: currentUser } = useAuth()
  const [stats, setStats] = useState(null)
  const [performance, setPerformance] = useState(null)
  const [users, setUsers] = useState([])
  const [tab, setTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [promoting, setPromoting] = useState(null)
  const [togglingActive, setTogglingActive] = useState(null)
  const [search, setSearch] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const [s, p, u] = await Promise.all([adminApi.stats(), adminApi.performance(), adminApi.users()])
      setStats(s.data); setPerformance(p.data); setUsers(u.data)
    } catch {
      toast.error('Unable to load administration data')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const filteredUsers = useMemo(() => users.filter(user => {
    const q = search.trim().toLowerCase()
    return !q || user.name?.toLowerCase().includes(q) || user.email?.toLowerCase().includes(q) || user.role?.toLowerCase().includes(q)
  }), [users, search])

  const promoteToDoctor = async (user) => {
    if (user.role !== 'patient') return
    setPromoting(user.id)
    try { await adminApi.promote(user.id); toast.success(`${user.name} is now a doctor`); await load() }
    catch (err) { toast.error(err.response?.data?.detail || 'Unable to promote user') }
    finally { setPromoting(null) }
  }

  const toggleActive = async (user) => {
    setTogglingActive(user.id)
    try {
      if (user.is_active) { await adminApi.deactivate(user.id); toast.success(`${user.name} has been deactivated`) }
      else { await adminApi.reactivate(user.id); toast.success(`${user.name} has been reactivated`) }
      await load()
    } catch (err) { toast.error(err.response?.data?.detail || 'Unable to update user status') }
    finally { setTogglingActive(null) }
  }

  const classData = Object.entries(performance?.class_distribution || {})
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ key, name: NAMES[key] || key.toUpperCase(), count }))

  return (
    <Layout>
      <div className="page-pad max-w-7xl mx-auto">
        <div className="page-heading">
          <div>
            <div className="eyebrow"><Shield size={13} /> Administration</div>
            <h1 className="page-title">System control centre</h1>
            <p className="page-subtitle">Monitor users, diagnostic activity and review behaviour without exposing unsupported accuracy claims.</p>
          </div>
          <div className="status-pill"><span /> Local system</div>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {[
            ['overview', 'Overview', Activity], ['performance', 'Model & review', BarChart3], ['users', 'Users', Users],
          ].map(([key, label, Icon]) => (
            <button key={key} onClick={() => setTab(key)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap border transition-colors"
              style={{ background: tab === key ? '#F1F5F3' : 'transparent', borderColor: tab === key ? '#B8C9C4' : '#E4E7E4', color: tab === key ? '#254742' : '#5B6764' }}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {loading ? <div className="glass p-12 text-center text-muted">Loading administration workspace…</div> : (
          <>
            {tab === 'overview' && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                  <Metric icon={Users} label="Total users" value={stats?.total_users} note={`${stats?.patients || 0} patients · ${stats?.doctors || 0} doctors`} />
                  <Metric icon={Activity} label="Total diagnoses" value={stats?.total_diagnoses} tone="purple" note={`${((performance?.review_rate || 0) * 100).toFixed(1)}% sent for review`} />
                  <Metric icon={AlertTriangle} label="Malignant findings" value={performance?.malignant_count} tone="red" note={`${((performance?.malignant_rate || 0) * 100).toFixed(1)}% of diagnoses`} />
                  <Metric icon={Clock3} label="Average uncertainty" value={performance?.average_uncertainty?.toFixed(4) ?? '—'} tone="amber" note="Across stored diagnoses" />
                </div>
                <div className="grid lg:grid-cols-[1.2fr_.8fr] gap-5">
                  <div className="glass p-6">
                    <div className="flex items-start justify-between gap-4 mb-5"><div><h2 className="section-card-title">Diagnosis mix</h2><p className="text-xs text-muted mt-1">Predicted class distribution across stored cases.</p></div><BarChart3 size={18} className="text-teal-600" /></div>
                    {classData.length ? (
                      <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={classData} margin={{ left: 0, right: 10, bottom: 30 }}><XAxis dataKey="key" tick={{ fill: '#7A8581', fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fill: '#7A8581', fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: '#fff', border: '1px solid #DDE5E2', borderRadius: 10, fontSize: 12 }} /><Bar dataKey="count" radius={[5,5,0,0]}>{classData.map(item => <Cell key={item.key} fill={COLORS[item.key] || '#3D7068'} />)}</Bar></BarChart></ResponsiveContainer></div>
                    ) : <div className="rounded-xl border border-dashed border-line bg-paper p-12 text-center text-sm text-muted">No diagnosis data yet.</div>}
                  </div>
                  <div className="glass p-6">
                    <h2 className="section-card-title">Review operations</h2>
                    <div className="space-y-4 mt-5">
                      <div className="metric-row"><span>Cases requiring review</span><strong>{performance?.review_required ?? 0}</strong></div>
                      <div className="metric-row"><span>Completed reviews</span><strong>{performance?.reviewed_count ?? 0}</strong></div>
                      <div className="metric-row"><span>Revised by doctor</span><strong>{performance?.revised_count ?? 0}</strong></div>
                      <div className="metric-row"><span>Revision rate</span><strong>{((performance?.revision_rate || 0) * 100).toFixed(1)}%</strong></div>
                      <div className="metric-row"><span>Avg. review turnaround</span><strong>{performance?.average_review_turnaround_hours == null ? '—' : `${performance.average_review_turnaround_hours} h`}</strong></div>
                    </div>
                    <div className="mt-5 p-3 rounded-xl bg-paper border border-line text-xs text-muted leading-5">{performance?.note}</div>
                  </div>
                </div>
              </div>
            )}

            {tab === 'performance' && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                  <Metric icon={CheckCircle2} label="Reviewed cases" value={performance?.reviewed_count} note="Completed doctor reviews" tone="teal" />
                  <Metric icon={Activity} label="Review rate" value={`${((performance?.review_rate || 0) * 100).toFixed(1)}%`} note="AI-flagged / all cases" tone="amber" />
                  <Metric icon={UserCog} label="Revision rate" value={`${((performance?.revision_rate || 0) * 100).toFixed(1)}%`} note="Reviewed cases marked revised" tone="purple" />
                  <Metric icon={Clock3} label="Avg. turnaround" value={performance?.average_review_turnaround_hours == null ? '—' : `${performance.average_review_turnaround_hours}h`} note="Claim to submitted verdict" />
                </div>
                <div className="glass p-6">
                  <h2 className="section-card-title">Model configuration</h2>
                  <div className="grid sm:grid-cols-2 gap-x-8 mt-4">
                    {Object.entries(performance?.model_info || {}).map(([k, v]) => <div key={k} className="metric-row"><span className="capitalize">{k.replaceAll('_',' ')}</span><strong>{Array.isArray(v) ? v.join(', ') : v}</strong></div>)}
                  </div>
                </div>
              </div>
            )}

            {tab === 'users' && (
              <div className="glass overflow-hidden">
                <div className="p-5 border-b border-line flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between"><div><h2 className="section-card-title">User directory</h2><p className="text-xs text-muted mt-1">{filteredUsers.length} visible accounts</p></div><input className="input-glass sm:max-w-xs" placeholder="Search name, email or role…" value={search} onChange={e => setSearch(e.target.value)} /></div>
                <div className="hidden lg:grid text-[10px] uppercase tracking-[0.12em] text-muted px-5 py-3 border-b border-line" style={{ gridTemplateColumns: '1.2fr 2fr .8fr .9fr 1fr 1.5fr' }}><span>Name</span><span>Email</span><span>Role</span><span>Status</span><span>Joined</span><span>Actions</span></div>
                {filteredUsers.map(user => <div key={user.id} className="px-5 py-4 border-b border-line hover:bg-paper transition-colors lg:grid lg:items-center" style={{ gridTemplateColumns: '1.2fr 2fr .8fr .9fr 1fr 1.5fr' }}><div><div className="text-sm font-medium text-ink">{user.name}</div><div className="text-xs text-muted lg:hidden mt-1">{user.email}</div></div><span className="hidden lg:block text-sm text-muted truncate pr-3">{user.email}</span><span className="text-xs text-teal-700 capitalize font-mono mt-2 lg:mt-0 block">{user.role}</span><span className={`text-xs font-mono block mt-1 lg:mt-0 ${user.is_active ? 'text-teal-600' : 'text-red-600'}`}>{user.is_active ? 'Active' : 'Deactivated'}</span><span className="text-xs text-muted block mt-1 lg:mt-0">{new Date(user.created_at).toLocaleDateString()}</span><div className="flex flex-wrap gap-2 mt-3 lg:mt-0">{user.role === 'patient' && <button aria-label="Promote to doctor" disabled={promoting === user.id} onClick={() => promoteToDoctor(user)} className="btn-ghost text-xs py-1.5 px-2.5">{promoting === user.id ? 'Promoting…' : 'Promote to doctor'}</button>}{user.role !== 'admin' && user.id !== currentUser?.id && <button disabled={togglingActive === user.id} onClick={() => toggleActive(user)} className="btn-ghost text-xs py-1.5 px-2.5">{togglingActive === user.id ? 'Updating…' : user.is_active ? 'Deactivate' : 'Reactivate'}</button>}</div></div>)}
                {filteredUsers.length === 0 && <div className="p-12 text-center text-sm text-muted">No users match this search.</div>}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
