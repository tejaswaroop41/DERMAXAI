import { useEffect, useMemo, useState } from 'react'
import Layout from '../components/layout/Layout'
import { diagnoseApi, lesionApi, reportApi } from '../lib/api'
import toast from 'react-hot-toast'
import {
  Activity,
  ArrowRight,
  CalendarDays,
  ClipboardPlus,
  MapPin,
  Plus,
  ShieldCheck,
  Trash2,
  TrendingUp,
} from 'lucide-react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const CLASS_NAMES = {
  mel: 'Melanoma',
  bcc: 'Basal Cell Carcinoma',
  akiec: 'Actinic Keratoses',
  bkl: 'Benign Keratosis',
  nv: 'Melanocytic Nevi',
  df: 'Dermatofibroma',
  vasc: 'Vascular Lesions',
}

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function MiniMetric({ label, value, tone = 'neutral' }) {
  const tones = {
    neutral: 'text-ink', teal: 'text-teal-700', red: 'text-clinical-red', amber: 'text-clinical-amber'
  }
  return (
    <div className="rounded-xl border border-line bg-paper p-4">
      <div className="text-[10px] uppercase tracking-[0.12em] text-muted">{label}</div>
      <div className={`mt-2 font-serif text-xl font-semibold ${tones[tone]}`}>{value}</div>
    </div>
  )
}

export default function Lesions() {
  const [lesions, setLesions] = useState([])
  const [unassigned, setUnassigned] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [bodySite, setBodySite] = useState('')
  const [notes, setNotes] = useState('')
  const [selectedDiagnosis, setSelectedDiagnosis] = useState('')

  const load = async (preferredId = null) => {
    setLoading(true)
    try {
      const [lesionResponse, unassignedResponse] = await Promise.all([
        lesionApi.list(),
        diagnoseApi.unassigned(),
      ])
      const next = lesionResponse.data || []
      setLesions(next)
      setUnassigned(unassignedResponse.data || [])
      const nextId = preferredId ?? selectedId ?? next[0]?.id ?? null
      setSelectedId(nextId)
      if (nextId) {
        setDetailLoading(true)
        const detailResponse = await lesionApi.get(nextId)
        setDetail(detailResponse.data)
      } else {
        setDetail(null)
      }
    } catch {
      toast.error('Unable to load lesion tracking data')
    } finally {
      setLoading(false)
      setDetailLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const chartData = useMemo(() => (
    (detail?.diagnoses || []).map((d, index) => ({
      sequence: index + 1,
      date: formatDate(d.created_at),
      confidence: Number((d.fused_confidence || 0) * 100),
      uncertainty: Number((d.composite_uncertainty || 0) * 100),
    }))
  ), [detail])

  const create = async () => {
    if (!name.trim()) {
      toast.error('Give the lesion a name')
      return
    }
    setSaving(true)
    try {
      const { data } = await lesionApi.create({ name, body_site: bodySite, notes })
      toast.success('Lesion tracking started')
      setName(''); setBodySite(''); setNotes(''); setShowCreate(false)
      await load(data.id)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Unable to create lesion')
    } finally {
      setSaving(false)
    }
  }

  const choose = async (id) => {
    setSelectedId(id)
    setDetailLoading(true)
    try {
      const { data } = await lesionApi.get(id)
      setDetail(data)
      setSelectedDiagnosis('')
    } catch {
      toast.error('Unable to open lesion history')
    } finally {
      setDetailLoading(false)
    }
  }

  const attach = async () => {
    if (!selectedDiagnosis || !detail) return
    try {
      await lesionApi.attachDiagnosis(detail.id, Number(selectedDiagnosis))
      toast.success('Diagnosis added to lesion timeline')
      await load(detail.id)
      setSelectedDiagnosis('')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Unable to attach diagnosis')
    }
  }

  const remove = async () => {
    if (!detail) return
    if (!window.confirm(`Stop tracking “${detail.name}”? Existing diagnoses will remain.`)) return
    try {
      await lesionApi.remove(detail.id)
      toast.success('Lesion tracking removed')
      await load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Unable to remove lesion')
    }
  }

  const latest = detail?.diagnoses?.[detail.diagnoses.length - 1]
  const first = detail?.diagnoses?.[0]
  const confidenceDelta = latest && first ? (latest.fused_confidence - first.fused_confidence) * 100 : null

  return (
    <Layout>
      <div className="page-pad max-w-7xl mx-auto">
        <div className="page-heading">
          <div>
            <div className="eyebrow"><Activity size={13} /> Longitudinal monitoring</div>
            <h1 className="page-title">Lesion tracking</h1>
            <p className="page-subtitle">Group repeat diagnoses by lesion and review how confidence and uncertainty change over time.</p>
          </div>
          <button className="btn-primary inline-flex items-center gap-2" onClick={() => setShowCreate(v => !v)}>
            <Plus size={15} /> Track a lesion
          </button>
        </div>

        {showCreate && (
          <div className="glass p-5 mb-6">
            <div className="grid md:grid-cols-3 gap-3">
              <input className="input-glass" placeholder="Lesion name (e.g. Left cheek mole)" value={name} onChange={e => setName(e.target.value)} />
              <input className="input-glass" placeholder="Body site (optional)" value={bodySite} onChange={e => setBodySite(e.target.value)} />
              <button className="btn-primary" disabled={saving} onClick={create}>{saving ? 'Creating…' : 'Create tracker'}</button>
            </div>
            <textarea className="input-glass mt-3 resize-none" rows={2} placeholder="Notes for this lesion (optional)" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        )}

        {loading ? (
          <div className="glass p-12 text-center text-muted">Loading lesion timeline…</div>
        ) : lesions.length === 0 ? (
          <div className="glass p-12 text-center">
            <div className="feature-icon mx-auto"><ClipboardPlus size={18} /></div>
            <h2 className="font-serif text-2xl font-semibold mt-4">Start longitudinal monitoring</h2>
            <p className="text-sm text-muted max-w-md mx-auto mt-2">Create a tracker for a lesion you want to monitor. You can attach diagnoses from your history to build a timeline.</p>
            <button className="btn-primary mt-5" onClick={() => setShowCreate(true)}>Create first tracker</button>
          </div>
        ) : (
          <div className="grid lg:grid-cols-[290px_1fr] gap-5">
            <aside className="space-y-3">
              {lesions.map(lesion => (
                <button key={lesion.id} onClick={() => choose(lesion.id)} className={`w-full text-left lesion-list-card ${selectedId === lesion.id ? 'is-selected' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-ink truncate">{lesion.name}</div>
                      <div className="text-xs text-muted mt-1 flex items-center gap-1"><MapPin size={11} /> {lesion.body_site || 'Site not recorded'}</div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-1 rounded-full bg-paper border border-line">{lesion.diagnosis_count}</span>
                  </div>
                  {lesion.latest && <div className="mt-3 text-xs text-muted">Last scan {formatDate(lesion.latest.created_at)}</div>}
                </button>
              ))}
            </aside>

            <section className="space-y-5">
              {detailLoading ? (
                <div className="glass p-12 text-center text-muted">Opening lesion timeline…</div>
              ) : detail ? (
                <>
                  <div className="glass p-6">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5">
                      <div>
                        <div className="eyebrow"><ShieldCheck size={13} /> Tracked lesion</div>
                        <h2 className="text-3xl font-serif font-semibold text-ink mt-2">{detail.name}</h2>
                        <div className="flex flex-wrap gap-4 text-xs text-muted mt-3">
                          <span className="inline-flex items-center gap-1"><MapPin size={12} /> {detail.body_site || 'Site not recorded'}</span>
                          <span className="inline-flex items-center gap-1"><CalendarDays size={12} /> Started {formatDate(detail.created_at)}</span>
                        </div>
                        {detail.notes && <p className="text-sm text-muted leading-6 mt-4 max-w-2xl">{detail.notes}</p>}
                      </div>
                      <button className="btn-ghost text-xs inline-flex items-center gap-2" onClick={remove}><Trash2 size={13} /> Stop tracking</button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
                      <MiniMetric label="Observations" value={detail.diagnosis_count} tone="teal" />
                      <MiniMetric label="Latest class" value={latest ? (CLASS_NAMES[latest.predicted_class] || latest.predicted_class) : '—'} />
                      <MiniMetric label="Latest confidence" value={latest ? `${(latest.fused_confidence * 100).toFixed(1)}%` : '—'} tone="teal" />
                      <MiniMetric label="Confidence change" value={confidenceDelta == null ? '—' : `${confidenceDelta >= 0 ? '+' : ''}${confidenceDelta.toFixed(1)} pts`} tone={confidenceDelta != null && confidenceDelta < 0 ? 'amber' : 'teal'} />
                    </div>
                  </div>

                  <div className="glass p-6">
                    <div className="flex items-center justify-between gap-4 mb-5">
                      <div>
                        <h3 className="section-card-title">Trend over time</h3>
                        <p className="text-xs text-muted mt-1">Confidence and uncertainty are monitoring signals, not a diagnosis of lesion change.</p>
                      </div>
                      <TrendingUp size={18} className="text-teal-600" />
                    </div>
                    {chartData.length >= 2 ? (
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E7ECEA" vertical={false} />
                            <XAxis dataKey="date" tick={{ fill: '#7A8581', fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: '#7A8581', fontSize: 10 }} axisLine={false} tickLine={false} unit="%" domain={[0, 100]} />
                            <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #DDE5E2', borderRadius: 10, fontSize: 12 }} />
                            <Line type="monotone" dataKey="confidence" name="Confidence" stroke="#3D7068" strokeWidth={2.5} dot={{ r: 3, fill: '#3D7068' }} activeDot={{ r: 5 }} />
                            <Line type="monotone" dataKey="uncertainty" name="Uncertainty" stroke="#B08135" strokeWidth={2} dot={{ r: 3, fill: '#B08135' }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-line bg-paper p-10 text-center">
                        <p className="text-sm text-ink">Attach at least two diagnoses to see a trend.</p>
                        <p className="text-xs text-muted mt-1">The timeline will grow as repeat assessments are linked.</p>
                      </div>
                    )}
                  </div>

                  <div className="glass p-6">
                    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-5">
                      <div>
                        <h3 className="section-card-title">Add an observation</h3>
                        <p className="text-xs text-muted mt-1">Attach an existing diagnosis that belongs to this lesion.</p>
                      </div>
                      <div className="flex gap-2 w-full md:w-auto">
                        <select className="input-glass text-sm min-w-0 md:min-w-72" value={selectedDiagnosis} onChange={e => setSelectedDiagnosis(e.target.value)}>
                          <option value="">Select an unassigned diagnosis</option>
                          {unassigned.map(d => <option key={d.id} value={d.id}>#{d.id} · {CLASS_NAMES[d.predicted_class] || d.predicted_class} · {formatDate(d.created_at)}</option>)}
                        </select>
                        <button className="btn-primary whitespace-nowrap inline-flex items-center gap-2" disabled={!selectedDiagnosis} onClick={attach}><ArrowRight size={14} /> Attach</button>
                      </div>
                    </div>
                    {detail.diagnoses.length > 0 ? (
                      <div className="space-y-2">
                        {detail.diagnoses.slice().reverse().map(d => (
                          <div key={d.id} className="timeline-row">
                            <div className="timeline-dot" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm text-ink">{CLASS_NAMES[d.predicted_class] || d.predicted_class}</span>
                                {d.is_malignant && <span className="badge-malignant">Malignant</span>}
                                {d.requires_review && <span className="badge-review">Review</span>}
                              </div>
                              <div className="text-xs text-muted mt-1">{formatDate(d.created_at)} · {(d.fused_confidence * 100).toFixed(1)}% confidence · {d.composite_uncertainty?.toFixed(3)} uncertainty</div>
                            </div>
                            {d.report_url && <button className="text-xs text-teal-700" onClick={() => reportApi.download(d.report_url, `DERMAXAI_Lesion_${detail.id}_Diagnosis_${d.id}.pdf`)}>PDF</button>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-line bg-paper p-8 text-center text-sm text-muted">No observations attached yet.</div>
                    )}
                  </div>
                </>
              ) : null}
            </section>
          </div>
        )}
      </div>
    </Layout>
  )
}