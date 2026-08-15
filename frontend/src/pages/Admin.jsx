import { useEffect, useState } from 'react'
import Layout from '../components/layout/Layout'
import { adminApi } from '../lib/api'
import { Shield, Users, Activity, AlertTriangle, BarChart2 } from 'lucide-react'

export default function Admin() {
  const [stats, setStats]   = useState(null)
  const [users, setUsers]   = useState([])
  const [tab, setTab]       = useState('overview')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([adminApi.stats(), adminApi.users()])
      .then(([s, u]) => { setStats(s.data); setUsers(u.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <Layout>
      <div className="p-8">
        <div className="mb-8 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#6B5B9514', border: '1px solid #6B5B9530' }}>
            <Shield size={16} style={{ color: '#6B5B95' }} />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-semibold text-ink">Admin Panel</h1>
            <p className="text-muted text-sm">System overview and management</p>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          {['overview','users','model'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors"
              style={{
                background: tab === t ? '#F1EEF7' : 'transparent',
                border: `1px solid ${tab === t ? '#C9BFDE' : '#E4E7E4'}`,
                color: tab === t ? '#4A3D6B' : '#5B6764'
              }}>{t}</button>
          ))}
        </div>

        {loading ? (
          <div className="glass p-12 text-center text-muted">Loading...</div>
        ) : tab === 'overview' ? (
          <div className="space-y-5">
            <div className="grid grid-cols-4 gap-4">
              {[
                { icon: Users,         label: 'Total Users',      value: stats?.total_users,      color: '#3D7068' },
                { icon: Activity,      label: 'Total Diagnoses',  value: stats?.total_diagnoses,  color: '#4F7A52' },
                { icon: AlertTriangle, label: 'Malignant Found',  value: stats?.malignant_count,  color: '#B4413A' },
                { icon: BarChart2,     label: 'Needs Review',     value: stats?.review_required,  color: '#B08135' },
              ].map(({ icon: Icon, label, value, color }) => (
                <div key={label} className="card-stat">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
                    style={{ background: color+'14', border: `1px solid ${color}30` }}>
                    <Icon size={15} style={{ color }} />
                  </div>
                  <div className="text-2xl font-serif font-semibold text-ink">{value ?? 0}</div>
                  <div className="text-xs text-muted mt-0.5">{label}</div>
                </div>
              ))}
            </div>

            {stats?.class_distribution && Object.keys(stats.class_distribution).length > 0 && (
              <div className="glass p-6">
                <h3 className="text-sm font-semibold text-ink mb-4">Class Distribution</h3>
                <div className="space-y-3">
                  {Object.entries(stats.class_distribution).sort((a,b)=>b[1]-a[1]).map(([cls,count]) => {
                    const total = Object.values(stats.class_distribution).reduce((a,b)=>a+b,0)
                    const pct   = total ? (count/total*100).toFixed(1) : 0
                    return (
                      <div key={cls}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted uppercase font-mono">{cls}</span>
                          <span className="text-muted">{count} ({pct}%)</span>
                        </div>
                        <div className="confidence-bar">
                          <div className="confidence-fill" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

        ) : tab === 'users' ? (
          <div className="glass overflow-hidden">
            <div className="grid text-xs text-muted px-5 py-3 border-b border-line"
              style={{ gridTemplateColumns: '1fr 2fr 1fr 1fr' }}>
              <span>Name</span><span>Email</span><span>Role</span><span>Joined</span>
            </div>
            {users.map(u => (
              <div key={u.id} className="grid items-center px-5 py-3 border-b border-line hover:bg-paper transition-colors"
                style={{ gridTemplateColumns: '1fr 2fr 1fr 1fr' }}>
                <span className="text-sm text-ink font-medium">{u.name}</span>
                <span className="text-sm text-muted">{u.email}</span>
                <span className="text-xs text-teal-500 capitalize font-mono">{u.role}</span>
                <span className="text-xs text-muted">{new Date(u.created_at).toLocaleDateString()}</span>
              </div>
            ))}
            {users.length === 0 && (
              <div className="p-8 text-center text-muted text-sm">No users yet</div>
            )}
          </div>

        ) : (
          <div className="glass p-6 space-y-4">
            <h3 className="text-sm font-semibold text-ink mb-2">Model Information</h3>
            {stats?.model_info && Object.entries(stats.model_info).map(([k,v]) => (
              <div key={k} className="flex justify-between items-center py-2 border-b border-line">
                <span className="text-xs text-muted capitalize">{k.replace(/_/g,' ')}</span>
                <span className="text-xs text-ink font-mono text-right max-w-xs">{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
