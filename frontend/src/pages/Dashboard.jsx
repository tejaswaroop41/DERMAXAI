import { useEffect, useState } from 'react'
import Layout from '../components/layout/Layout'
import { useAuth } from '../App'
import { diagnoseApi, doctorApi, reportApi } from '../lib/api'
import { Link } from 'react-router-dom'
import { Microscope, AlertTriangle, Clock, ChevronRight, TrendingUp, ClipboardCheck, Stethoscope, Bell } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const CLASS_COLORS = { mel:'#B4413A', bcc:'#C17A3D', akiec:'#B08135', bkl:'#4F7A52', nv:'#3D6B94', df:'#6B5B95', vasc:'#3D8B94' }
const CLASS_NAMES  = { mel:'Melanoma', bcc:'Basal Cell Carcinoma', akiec:'Actinic Keratoses', bkl:'Benign Keratosis', nv:'Melanocytic Nevi', df:'Dermatofibroma', vasc:'Vascular Lesions' }

function PatientDashboard({ user }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    diagnoseApi.history().then(r => setHistory(r.data)).catch(() => {}).finally(() => setLoading(false))
    diagnoseApi.unreadReviews().then(r => setUnread(r.data.unread_reviews)).catch(() => {})
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
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-serif font-semibold text-ink">
          Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'}, {user?.name?.split(' ')[0]}
        </h1>
        <p className="text-muted text-sm mt-1">Here's your diagnostic overview</p>
      </div>

      {unread > 0 && (
        <Link to="/history" className="glass p-4 mb-6 flex items-center gap-3 hover:border-teal-400/40 transition-colors" style={{ borderColor: '#B8C5C2', background: '#EEF4F3' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#3D7068' }}>
            <Bell size={15} className="text-white" />
          </div>
          <span className="text-sm text-ink flex-1">
            <span className="font-semibold">{unread}</span> diagnosis{unread !== 1 ? 'es' : ''} reviewed by a doctor since your last visit
          </span>
          <ChevronRight size={16} className="text-teal-500" />
        </Link>
      )}

      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { icon: Microscope,    label: 'Total Diagnoses', value: total,         color: '#3D7068', sub: 'all time' },
          { icon: AlertTriangle, label: 'Malignant',       value: malignant,     color: '#B4413A', sub: `${total ? ((malignant/total)*100).toFixed(0) : 0}% of total` },
          { icon: Clock,         label: 'Needs Review',    value: review,        color: '#B08135', sub: 'uncertain cases' },
          { icon: TrendingUp,    label: 'Avg Confidence',  value: `${avgConf}%`, color: '#4F7A52', sub: 'fused (CMCA)' },
        ].map(({ icon: Icon, label, value, color, sub }) => (
          <div key={label} className="card-stat">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
              style={{ background: color + '14', border: `1px solid ${color}30` }}>
              <Icon size={16} style={{ color }} />
            </div>
            <div className="text-3xl font-serif font-semibold text-ink mb-1">{value}</div>
            <div className="text-xs font-medium text-muted">{label}</div>
            <div className="text-xs text-muted/70 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 glass p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-serif font-semibold text-ink">Recent Diagnoses</h2>
            <Link to="/history" className="text-xs text-teal-500 hover:text-teal-600 flex items-center gap-1">
              View all <ChevronRight size={12} />
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-14 rounded-lg animate-pulse bg-line/40" />)}</div>
          ) : recent.length === 0 ? (
            <div className="text-center py-12">
              <Microscope size={28} className="mx-auto text-line mb-3" />
              <p className="text-muted text-sm">No diagnoses yet</p>
              <Link to="/diagnose" className="btn-primary text-sm py-2 px-4 mt-4 inline-block">Start your first diagnosis</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {recent.map(d => (
                <div key={d.id} className="flex items-center gap-4 p-3 rounded-lg border border-line hover:border-teal-400/40 transition-colors">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: (CLASS_COLORS[d.predicted_class] || '#5B6764') + '14' }}>
                    <div className="w-3 h-3 rounded-full" style={{ background: CLASS_COLORS[d.predicted_class] || '#5B6764' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-ink">{CLASS_NAMES[d.predicted_class] || d.predicted_class}</span>
                      {d.is_malignant ? <span className="badge-malignant">Malignant</span> : <span className="badge-benign">Benign</span>}
                      {d.requires_review && <span className="badge-review">Review</span>}
                    </div>
                    <div className="text-xs text-muted mt-0.5">
                      {new Date(d.created_at).toLocaleDateString()} · {(d.fused_confidence * 100).toFixed(1)}% confidence
                    </div>
                  </div>
                  {d.report_url && (
                    <button
                      type="button"
                      onClick={() => reportApi.download(d.report_url, `DERMAXAI_Report_${d.id}.pdf`)}
                      className="text-xs text-teal-500 hover:text-teal-600 flex-shrink-0"
                    >
                      PDF
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="glass p-6">
          <h2 className="font-serif font-semibold text-ink mb-5">Class Distribution</h2>
          {classDist.length === 0 ? (
            <div className="text-center py-12 text-muted text-sm">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={classDist} layout="vertical" margin={{ left: 0, right: 10 }}>
                <XAxis type="number" tick={{ fill: '#9CA6A3', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#5B6764', fontSize: 10 }} axisLine={false} tickLine={false} width={45} />
                <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E4E7E4', borderRadius: '8px', fontSize: '12px' }} cursor={{ fill: '#F5F7F6' }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {classDist.map(entry => <Cell key={entry.cls} fill={CLASS_COLORS[entry.cls] || '#5B6764'} />)}
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
  )
}

function DoctorDashboard({ user }) {
  const [queue, setQueue] = useState({ unclaimed: [], claimed_by_me: [], claimed_by_others: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    doctorApi.queue().then(r => setQueue(r.data)).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const unclaimedCount = queue.unclaimed.length
  const myCount         = queue.claimed_by_me.length
  const completedByMe   = queue.claimed_by_me.filter(c => c.review?.status === 'completed').length
  const urgentCount     = queue.unclaimed.filter(c => c.urgency_escalated).length

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-serif font-semibold text-ink">
          Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'}, Dr. {user?.name?.split(' ')[0]}
        </h1>
        <p className="text-muted text-sm mt-1">Cases awaiting clinical review</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { icon: ClipboardCheck, label: 'Unclaimed cases', value: unclaimedCount, color: '#B08135', sub: 'in shared queue' },
          { icon: AlertTriangle,  label: 'Urgent',          value: urgentCount,    color: '#B4413A', sub: 'escalated by AI' },
          { icon: Stethoscope,    label: 'Claimed by you',  value: myCount,        color: '#3D7068', sub: 'in progress or done' },
          { icon: TrendingUp,     label: 'Reviewed by you', value: completedByMe,  color: '#4F7A52', sub: 'verdicts submitted' },
        ].map(({ icon: Icon, label, value, color, sub }) => (
          <div key={label} className="card-stat">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
              style={{ background: color + '14', border: `1px solid ${color}30` }}>
              <Icon size={16} style={{ color }} />
            </div>
            <div className="text-3xl font-serif font-semibold text-ink mb-1">{value}</div>
            <div className="text-xs font-medium text-muted">{label}</div>
            <div className="text-xs text-muted/70 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      <div className="glass p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-serif font-semibold text-ink">Awaiting review</h2>
          <Link to="/doctor" className="text-xs text-teal-500 hover:text-teal-600 flex items-center gap-1">
            Open queue <ChevronRight size={12} />
          </Link>
        </div>
        {loading ? (
          <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-14 rounded-lg animate-pulse bg-line/40" />)}</div>
        ) : unclaimedCount === 0 ? (
          <div className="text-center py-12">
            <ClipboardCheck size={28} className="mx-auto text-line mb-3" />
            <p className="text-muted text-sm">No cases waiting — nice work.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {queue.unclaimed.slice(0, 5).map(c => (
              <div key={c.id} className="flex items-center gap-4 p-3 rounded-lg border border-line hover:border-teal-400/40 transition-colors">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: (CLASS_COLORS[c.predicted_class] || '#5B6764') + '14' }}>
                  <div className="w-3 h-3 rounded-full" style={{ background: CLASS_COLORS[c.predicted_class] || '#5B6764' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-ink">{c.class_name}</span>
                    {c.is_malignant && <span className="badge-malignant">Malignant</span>}
                    {c.urgency_escalated && <span className="badge-review">Urgent</span>}
                  </div>
                  <div className="text-xs text-muted mt-0.5">
                    {c.patient_name} · {(c.fused_confidence * 100).toFixed(1)}% confidence
                  </div>
                </div>
                <Link to="/doctor" className="text-xs text-teal-500 hover:text-teal-600 flex-shrink-0">Review</Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  return (
    <Layout>
      {user?.role === 'doctor' ? <DoctorDashboard user={user} /> : <PatientDashboard user={user} />}
    </Layout>
  )
}
