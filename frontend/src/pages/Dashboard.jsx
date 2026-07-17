import { useEffect, useState } from 'react'
import Layout from '../components/layout/Layout'
import { useAuth } from '../App'
import { diagnoseApi } from '../lib/api'
import { Link } from 'react-router-dom'
import { Microscope, AlertTriangle, Clock, ChevronRight, TrendingUp } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const CLASS_COLORS = { mel:'#ef4444', bcc:'#f97316', akiec:'#eab308', bkl:'#22c55e', nv:'#3b82f6', df:'#8b5cf6', vasc:'#06b6d4' }
const CLASS_NAMES  = { mel:'Melanoma', bcc:'Basal Cell Carcinoma', akiec:'Actinic Keratoses', bkl:'Benign Keratosis', nv:'Melanocytic Nevi', df:'Dermatofibroma', vasc:'Vascular Lesions' }

export default function Dashboard() {
  const { user } = useAuth()
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    diagnoseApi.history().then(r => setHistory(r.data)).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const total     = history.length
  const malignant = history.filter(d => d.is_malignant).length
  const review    = history.filter(d => d.requires_review).length
  const avgConf   = total ? (history.reduce((s, d) => s + d.fused_confidence, 0) / total * 100).toFixed(1) : 0

  const classDist = Object.entries(
    history.reduce((acc, d) => { acc[d.predicted_class] = (acc[d.predicted_class] || 0) + 1; return acc }, {})
  ).map(([cls, count]) => ({ cls, count, name: cls.toUpperCase() }))

  const recent = history.slice(0, 5)

  return (
    <Layout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">
            Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'}, <span className="text-sky-400">{user?.name?.split(' ')[0]}</span>
          </h1>
          <p className="text-slate-500 text-sm mt-1">Here's your diagnostic overview</p>
        </div>
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { icon: Microscope,    label: 'Total Diagnoses', value: total,         color: '#0ea5e9', sub: 'all time' },
            { icon: AlertTriangle, label: 'Malignant',       value: malignant,     color: '#ef4444', sub: `${total ? ((malignant/total)*100).toFixed(0) : 0}% of total` },
            { icon: Clock,         label: 'Needs Review',    value: review,        color: '#eab308', sub: 'uncertain cases' },
            { icon: TrendingUp,    label: 'Avg Confidence',  value: `${avgConf}%`, color: '#22c55e', sub: 'fused (CMCA)' },
          ].map(({ icon: Icon, label, value, color, sub }) => (
            <div key={label} className="card-stat">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                style={{ background: color + '15', border: `1px solid ${color}25` }}>
                <Icon size={16} style={{ color }} />
              </div>
              <div className="text-3xl font-bold text-white font-mono mb-1">{value}</div>
              <div className="text-xs font-medium text-slate-400">{label}</div>
              <div className="text-xs text-slate-600 mt-0.5">{sub}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 glass p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-white">Recent Diagnoses</h2>
              <Link to="/history" className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1">
                View all <ChevronRight size={12} />
              </Link>
            </div>
            {loading ? (
              <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: 'rgba(148,163,184,0.05)' }} />)}</div>
            ) : recent.length === 0 ? (
              <div className="text-center py-12">
                <Microscope size={32} className="mx-auto text-slate-700 mb-3" />
                <p className="text-slate-500 text-sm">No diagnoses yet</p>
                <Link to="/diagnose" className="btn-primary text-sm py-2 px-4 mt-4 inline-block">Start your first diagnosis</Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recent.map(d => (
                  <div key={d.id} className="flex items-center gap-4 p-3 rounded-xl transition-all hover:bg-white/5" style={{ border: '1px solid rgba(148,163,184,0.06)' }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: (CLASS_COLORS[d.predicted_class] || '#64748b') + '20' }}>
                      <div className="w-3 h-3 rounded-full" style={{ background: CLASS_COLORS[d.predicted_class] || '#64748b' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{CLASS_NAMES[d.predicted_class] || d.predicted_class}</span>
                        {d.is_malignant ? <span className="badge-malignant">Malignant</span> : <span className="badge-benign">Benign</span>}
                        {d.requires_review && <span className="badge-review">Review</span>}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {new Date(d.created_at).toLocaleDateString()} · {(d.fused_confidence * 100).toFixed(1)}% confidence
                      </div>
                    </div>
                    {d.report_url && <a href={d.report_url} target="_blank" rel="noreferrer" className="text-xs text-sky-400 hover:text-sky-300 flex-shrink-0">PDF</a>}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="glass p-6">
            <h2 className="font-bold text-white mb-5">Class Distribution</h2>
            {classDist.length === 0 ? (
              <div className="text-center py-12 text-slate-600 text-sm">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={classDist} layout="vertical" margin={{ left: 0, right: 10 }}>
                  <XAxis type="number" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} width={45} />
                  <Tooltip contentStyle={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(14,165,233,0.2)', borderRadius: '8px', fontSize: '12px' }} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {classDist.map(entry => <Cell key={entry.cls} fill={CLASS_COLORS[entry.cls] || '#64748b'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
            <Link to="/diagnose" className="btn-primary w-full text-center mt-4 py-2.5 text-sm flex items-center justify-center gap-2">
              <Microscope size={14} /> New Diagnosis
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  )
}
