import { useEffect, useMemo, useState } from 'react'
import Layout from '../components/layout/Layout'
import { useAuth } from '../App'
import { diagnoseApi, doctorApi, reportApi } from '../lib/api'
import { Link } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bell,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Microscope,
  ShieldCheck,
  Stethoscope,
  TrendingUp,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const CLASS_COLORS = { mel: '#B4413A', bcc: '#C17A3D', akiec: '#B08135', bkl: '#4F7A52', nv: '#3D6B94', df: '#6B5B95', vasc: '#3D8B94' }
const CLASS_NAMES = {
  mel: 'Melanoma',
  bcc: 'Basal Cell Carcinoma',
  akiec: 'Actinic Keratoses',
  bkl: 'Benign Keratosis',
  nv: 'Melanocytic Nevi',
  df: 'Dermatofibroma',
  vasc: 'Vascular Lesions',
}
const CLINICAL_CONCERN_CLASSES = ['akiec', 'bcc', 'mel']

function clinicalCategory(diagnosis) {
  if (diagnosis.is_malignant) return 'malignant'
  if (diagnosis.clinical_concern ?? (CLINICAL_CONCERN_CLASSES.includes(diagnosis.predicted_class) || diagnosis.requires_review)) return 'concern'
  return 'non-malignant'
}

function ClinicalBadge({ diagnosis }) {
  const category = clinicalCategory(diagnosis)
  if (category === 'malignant') return <span className="badge-malignant">Malignant</span>
  if (category === 'concern') return <span className="badge-review">Clinical concern</span>
  return <span className="badge-benign">Non-malignant</span>
}

function StatCard({ icon: Icon, label, value, detail, tone = 'teal' }) {
  const tones = {
    teal: { icon: '#3D7068', bg: '#EEF4F3' },
    red: { icon: '#B4413A', bg: '#FBEAE8' },
    amber: { icon: '#A97824', bg: '#FBF3E4' },
    green: { icon: '#4F7A52', bg: '#EDF3ED' },
  }
  const current = tones[tone] || tones.teal

  return (
    <div className="card-stat group">
      <div className="flex items-start justify-between gap-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center border" style={{ background: current.bg, borderColor: `${current.icon}25` }}>
          <Icon size={17} style={{ color: current.icon }} />
        </div>
        <ArrowUpRight size={15} className="text-line group-hover:text-teal-600 transition-colors" />
      </div>
      <div className="mt-5 text-3xl font-serif font-semibold text-ink">{value}</div>
      <div className="mt-1 text-sm font-medium text-ink">{label}</div>
      <div className="mt-1 text-xs text-muted">{detail}</div>
    </div>
  )
}

function SectionHeader({ eyebrow, title, action, to }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-5">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h2 className="section-title text-2xl mt-1">{title}</h2>
      </div>
      {action && to && (
        <Link to={to} className="hidden sm:inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-800">
          {action} <ChevronRight size={13} />
        </Link>
      )}
    </div>
  )
}

function PatientDashboard({ user }) {
  const [history, setHistory] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    diagnoseApi.history().then(r => setHistory(r.data)).catch(() => {}).finally(() => setLoading(false))
    diagnoseApi.summary().then(r => setSummary(r.data)).catch(() => {})
    diagnoseApi.unreadReviews().then(r => setUnread(r.data.unread_reviews)).catch(() => {})
  }, [])

  const total = summary?.total_diagnoses ?? history.length
  const malignant = summary?.malignant_count ?? history.filter(d => clinicalCategory(d) === 'malignant').length
  const clinicalConcern = summary?.clinical_concern_count ?? history.filter(d => clinicalCategory(d) === 'concern').length
  const review = summary?.review_required ?? history.filter(d => d.requires_review).length
  const avgConf = summary
    ? (summary.average_confidence * 100).toFixed(1)
    : total
      ? (history.reduce((s, d) => s + d.fused_confidence, 0) / total * 100).toFixed(1)
      : '0.0'

  const classDist = useMemo(() => {
    const source = summary?.class_distribution || history.reduce((acc, d) => {
      acc[d.predicted_class] = (acc[d.predicted_class] || 0) + 1
      return acc
    }, {})
    return Object.entries(source).map(([cls, count]) => ({ cls, count, name: cls.toUpperCase() }))
  }, [summary, history])

  const recent = history.slice(0, 5)
  const firstName = user?.name?.trim()?.split(/\s+/)[0] || 'there'
  const greeting = new Date().getHours() < 12 ? 'Good morning' : 'Good afternoon'

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-8 lg:py-10">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-8">
          <div>
            <div className="eyebrow">Patient workspace</div>
            <h1 className="text-3xl lg:text-4xl font-serif font-semibold text-ink mt-2 tracking-tight">
              {greeting}, {firstName}.
            </h1>
            <p className="text-muted text-sm mt-2 max-w-xl leading-6">
              Your diagnostic activity, review status and recent assessments in one place.
            </p>
          </div>
          <Link to="/diagnose" className="btn-primary inline-flex items-center justify-center gap-2 py-3 px-5 text-sm shadow-soft">
            <Microscope size={15} /> New diagnosis <ArrowUpRight size={14} />
          </Link>
        </div>

        {unread > 0 && (
          <Link to="/history" className="mb-6 flex items-center gap-3 rounded-xl border p-4 hover:border-[#B8C5C2] transition-colors" style={{ background: '#EEF4F3', borderColor: '#D7E4E1' }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#3D7068' }}>
              <Bell size={16} className="text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-ink">New clinical review available</div>
              <div className="text-xs text-muted mt-0.5">{unread} diagnosis{unread !== 1 ? 'es have' : ' has'} been reviewed since your last visit.</div>
            </div>
            <ChevronRight size={17} className="text-teal-700" />
          </Link>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-10">
          <StatCard icon={Microscope} label="Total diagnoses" value={total} detail="All recorded assessments" />
          <StatCard icon={AlertTriangle} label="Malignant flags" value={malignant} detail={total ? `${((malignant / total) * 100).toFixed(0)}% of your assessments` : 'No malignant flags'} tone="red" />
          <StatCard icon={ShieldCheck} label="Clinical concern" value={clinicalConcern} detail="Malignant or review-concerning cases" tone="amber" />
          <StatCard icon={Clock3} label="Needs review" value={review} detail="Cases marked for attention" tone="amber" />
          <StatCard icon={TrendingUp} label="Average confidence" value={`${avgConf}%`} detail="Image-class confidence" tone="green" />
        </div>

        <div className="grid lg:grid-cols-[1.55fr_.95fr] gap-6">
          <section className="glass p-5 sm:p-6">
            <SectionHeader eyebrow="Your activity" title="Recent diagnoses" action="View history" to="/history" />
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-16 rounded-xl bg-line/40 animate-pulse" />)}
              </div>
            ) : recent.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line bg-paper/80 px-6 py-14 text-center">
                <div className="w-11 h-11 rounded-xl mx-auto flex items-center justify-center bg-white border border-line">
                  <Microscope size={18} className="text-teal-600" />
                </div>
                <h3 className="text-sm font-semibold text-ink mt-4">No diagnoses yet</h3>
                <p className="text-xs text-muted mt-1">Your first assessment will appear here.</p>
                <Link to="/diagnose" className="btn-primary text-xs py-2.5 px-4 mt-4 inline-flex items-center gap-2">
                  Start diagnosis <ArrowUpRight size={13} />
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {recent.map(d => {
                  const classColor = CLASS_COLORS[d.predicted_class] || '#5B6764'
                  return (
                    <div key={d.id} className="group flex items-center gap-3 sm:gap-4 p-3 rounded-xl border border-line hover:border-[#B8C5C2] hover:bg-paper transition-all">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${classColor}12`, border: `1px solid ${classColor}25` }}>
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: classColor }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-ink truncate">{CLASS_NAMES[d.predicted_class] || d.predicted_class}</span>
                          <ClinicalBadge diagnosis={d} />
                          {d.requires_review && <span className="badge-review">Review</span>}
                        </div>
                        <div className="text-xs text-muted mt-1">
                          {new Date(d.created_at).toLocaleDateString()} <span className="mx-1">·</span> {(d.fused_confidence * 100).toFixed(1)}% confidence
                        </div>
                      </div>
                      {d.report_url && (
                        <button type="button" onClick={() => reportApi.download(d.report_url, `DERMAXAI_Report_${d.id}.pdf`)} className="text-xs font-medium text-teal-700 hover:text-teal-800 px-2 py-1 rounded-md hover:bg-[#EEF4F3] transition-colors">
                          PDF
                        </button>
                      )}
                      <ChevronRight size={15} className="text-line group-hover:text-teal-600 transition-colors" />
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section className="glass p-5 sm:p-6">
            <SectionHeader eyebrow="Model output" title="Class distribution" />
            {classDist.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line bg-paper p-8 text-center text-xs text-muted">Complete a diagnosis to populate this view.</div>
            ) : (
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={classDist} layout="vertical" margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                  <XAxis type="number" allowDecimals={false} tick={{ fill: '#89928F', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#5B6764', fontSize: 10 }} axisLine={false} tickLine={false} width={48} />
                  <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E4E7E4', borderRadius: '10px', fontSize: '12px', boxShadow: '0 8px 24px rgba(28,35,33,.08)' }} cursor={{ fill: '#F5F7F6' }} />
                  <Bar dataKey="count" radius={[0, 5, 5, 0]}>
                    {classDist.map(entry => <Cell key={entry.cls} fill={CLASS_COLORS[entry.cls] || '#5B6764'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
            <div className="mt-3 pt-4 border-t border-line flex items-center justify-between gap-4">
              <div className="text-xs text-muted flex items-center gap-2"><ShieldCheck size={14} className="text-teal-700" /> Explainable decision support</div>
              <Link to="/diagnose" className="text-xs font-semibold text-teal-700 hover:text-teal-800 inline-flex items-center gap-1">New scan <ArrowUpRight size={12} /></Link>
            </div>
          </section>
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
  const myCount = queue.claimed_by_me.length
  const completedByMe = queue.claimed_by_me.filter(c => c.review?.status === 'completed').length
  const urgentCount = queue.unclaimed.filter(c => c.urgency_escalated).length
  const firstName = user?.name?.trim()?.split(/\s+/)[0] || 'Doctor'
  const greeting = new Date().getHours() < 12 ? 'Good morning' : 'Good afternoon'

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-8 lg:py-10">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-8">
          <div>
            <div className="eyebrow">Clinical workspace</div>
            <h1 className="text-3xl lg:text-4xl font-serif font-semibold text-ink mt-2 tracking-tight">
              {greeting}, Dr. {firstName}.
            </h1>
            <p className="text-muted text-sm mt-2 max-w-xl leading-6">Prioritise escalated cases, review the shared queue and keep patient follow-up moving.</p>
          </div>
          <Link to="/doctor" className="btn-primary inline-flex items-center justify-center gap-2 py-3 px-5 text-sm">
            <ClipboardCheck size={15} /> Open review queue <ArrowUpRight size={14} />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-10">
          <StatCard icon={ClipboardCheck} label="Unclaimed cases" value={unclaimedCount} detail="Waiting in shared queue" tone="amber" />
          <StatCard icon={AlertTriangle} label="Urgent" value={urgentCount} detail="Escalated by the AI workflow" tone="red" />
          <StatCard icon={Stethoscope} label="Claimed by you" value={myCount} detail="In progress or completed" />
          <StatCard icon={CheckCircle2} label="Reviewed by you" value={completedByMe} detail="Completed clinical verdicts" tone="green" />
        </div>

        <section className="glass p-5 sm:p-6">
          <SectionHeader eyebrow="Shared queue" title="Awaiting review" action="Open full queue" to="/doctor" />
          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl bg-line/40 animate-pulse" />)}</div>
          ) : unclaimedCount === 0 ? (
            <div className="rounded-xl border border-dashed border-line bg-paper/80 px-6 py-14 text-center">
              <div className="w-11 h-11 rounded-xl mx-auto flex items-center justify-center bg-white border border-line">
                <ClipboardCheck size={18} className="text-teal-600" />
              </div>
              <h3 className="text-sm font-semibold text-ink mt-4">Queue is clear</h3>
              <p className="text-xs text-muted mt-1">There are no unclaimed cases waiting for review.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {queue.unclaimed.slice(0, 6).map(c => {
                const classColor = CLASS_COLORS[c.predicted_class] || '#5B6764'
                return (
                  <div key={c.id} className="flex items-center gap-3 sm:gap-4 p-3 rounded-xl border border-line hover:border-[#B8C5C2] hover:bg-paper transition-all">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${classColor}12`, border: `1px solid ${classColor}25` }}>
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: classColor }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-ink truncate">{c.class_name}</span>
                        <ClinicalBadge diagnosis={c} />
                        {c.urgency_escalated && <span className="badge-review">Urgent</span>}
                      </div>
                      <div className="text-xs text-muted mt-1">{c.patient_name} <span className="mx-1">·</span> {(c.fused_confidence * 100).toFixed(1)}% confidence</div>
                    </div>
                    <Link to="/doctor" className="text-xs font-semibold text-teal-700 hover:text-teal-800 inline-flex items-center gap-1">
                      Review <ChevronRight size={13} />
                    </Link>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <div className="mt-6 grid md:grid-cols-3 gap-4">
          <div className="glass-light p-5">
            <div className="flex items-center gap-2 text-xs font-semibold text-ink"><Activity size={14} className="text-teal-700" /> AI triage</div>
            <p className="text-xs text-muted leading-5 mt-2">Urgency flags help surface cases that may need faster clinical attention.</p>
          </div>
          <div className="glass-light p-5">
            <div className="flex items-center gap-2 text-xs font-semibold text-ink"><ShieldCheck size={14} className="text-teal-700" /> Human oversight</div>
            <p className="text-xs text-muted leading-5 mt-2">Clinical review remains the final decision layer for escalated assessments.</p>
          </div>
          <div className="glass-light p-5">
            <div className="flex items-center gap-2 text-xs font-semibold text-ink"><TrendingUp size={14} className="text-teal-700" /> Review throughput</div>
            <p className="text-xs text-muted leading-5 mt-2">Track your claimed and completed workload from the review queue.</p>
          </div>
        </div>
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