import { useEffect, useState } from 'react'
import Layout from '../components/layout/Layout'
import { diagnoseApi, reportApi } from '../lib/api'
import { Link } from 'react-router-dom'
import { Search, Download, Stethoscope, CheckCircle2, RotateCcw, XCircle, ChevronDown, Activity } from 'lucide-react'

const CLASS_NAMES = { mel:'Melanoma', bcc:'Basal Cell Carcinoma', akiec:'Actinic Keratoses', bkl:'Benign Keratosis', nv:'Melanocytic Nevi', df:'Dermatofibroma', vasc:'Vascular Lesions' }
const CLASS_COLORS = { mel:'#B4413A', bcc:'#C17A3D', akiec:'#B08135', bkl:'#4F7A52', nv:'#3D6B94', df:'#6B5B95', vasc:'#3D8B94' }
const VERDICT_STYLE = {
  confirmed: { label: 'Confirmed', color: '#B4413A', bg: '#FBEAE8', border: '#EFCAC6', icon: CheckCircle2 },
  revised: { label: 'Revised', color: '#B08135', bg: '#FBF3E4', border: '#E9D3A4', icon: RotateCcw },
  dismissed: { label: 'Cleared', color: '#4F7A52', bg: '#EDF3ED', border: '#C9DBC9', icon: XCircle },
}

function DoctorNoteCallout({ review }) {
  const [open, setOpen] = useState(true)
  const style = VERDICT_STYLE[review.verdict] || VERDICT_STYLE.confirmed
  const Icon = style.icon
  return (
    <div className="mx-4 md:mx-5 mb-3 rounded-xl overflow-hidden" style={{ background: style.bg, border: `1px solid ${style.border}` }}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-white" style={{ border: `1px solid ${style.border}` }}><Stethoscope size={14} style={{ color: style.color }} /></div>
          <div><div className="flex items-center gap-2 flex-wrap"><span className="text-sm font-semibold text-ink">{review.doctor_name}</span><span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-white" style={{ color: style.color }}><Icon size={11} /> {style.label}</span></div><div className="text-xs text-muted mt-0.5">{review.reviewed_at && `Reviewed ${new Date(review.reviewed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}</div></div>
        </div>
        {review.notes && <ChevronDown size={16} className="text-muted flex-shrink-0 transition-transform" style={{ transform: open ? 'rotate(180deg)' : 'none' }} />}
      </button>
      {open && review.notes && <div className="px-4 pb-4"><div className="ml-11 p-3 rounded-lg bg-white text-sm text-ink leading-relaxed" style={{ border: `1px solid ${style.border}` }}>{review.notes}</div></div>}
    </div>
  )
}

export default function History() {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    diagnoseApi.history().then(r => setHistory(r.data)).catch(() => {}).finally(() => setLoading(false))
    diagnoseApi.markReviewsSeen().catch(() => {})
  }, [])

  const filtered = history.filter(d => {
    const matchSearch = !search || CLASS_NAMES[d.predicted_class]?.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || (filter === 'malignant' && d.is_malignant) || (filter === 'benign' && !d.is_malignant) || (filter === 'review' && d.requires_review)
    return matchSearch && matchFilter
  })

  return (
    <Layout>
      <div className="page-pad max-w-7xl mx-auto">
        <div className="page-heading">
          <div>
            <div className="eyebrow"><Activity size={13} /> Your clinical record</div>
            <h1 className="page-title">Diagnosis history</h1>
            <p className="page-subtitle">Review previous assessments, doctor feedback and generated reports in one place.</p>
          </div>
          <Link to="/lesions" className="btn-ghost inline-flex items-center gap-2 text-sm"><Activity size={14} /> Track lesions</Link>
        </div>

        <div className="glass p-4 mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#EEF5F3] border border-[#DCEAE6] text-teal-700 flex items-center justify-center"><Activity size={16} /></div>
          <div className="flex-1"><div className="text-sm font-semibold text-ink">Monitor repeat observations</div><div className="text-xs text-muted mt-0.5">Create a lesion tracker to compare confidence and uncertainty across future scans.</div></div>
          <Link to="/lesions" className="text-xs font-semibold text-teal-700">Open tracking →</Link>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-sm"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input className="input-glass pl-9 py-2.5 text-sm" placeholder="Search diagnoses…" value={search} onChange={e => setSearch(e.target.value)} /></div>
          <div className="flex gap-2 overflow-x-auto pb-1">{['all','malignant','benign','review'].map(f => <button key={f} onClick={() => setFilter(f)} className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize border whitespace-nowrap" style={{ background: filter === f ? '#EEF4F3' : 'transparent', borderColor: filter === f ? '#B8C5C2' : '#E4E7E4', color: filter === f ? '#254742' : '#5B6764' }}>{f}</button>)}</div>
        </div>

        <div className="glass overflow-hidden">
          <div className="hidden md:grid text-[10px] uppercase tracking-[0.12em] text-muted px-5 py-3 border-b border-line" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 80px' }}><span>Diagnosis</span><span>Confidence</span><span>Uncertainty</span><span>Risk</span><span>Date</span><span>Report</span></div>
          {loading ? <div className="p-10 text-center text-sm text-muted">Loading history…</div> : filtered.length === 0 ? <div className="p-12 text-center text-sm text-muted">No diagnoses found.</div> : filtered.map(d => (
            <div key={d.id} className="border-b border-line last:border-b-0">
              <div className="px-5 py-4 md:grid md:items-center md:py-3.5" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 80px' }}>
                <div className="flex items-start gap-3"><div className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: CLASS_COLORS[d.predicted_class] || '#5B6764' }} /><div><div className="text-sm font-medium text-ink">{CLASS_NAMES[d.predicted_class] || d.predicted_class}</div><div className="text-xs text-muted font-mono mt-0.5">Diagnosis #{d.id}</div></div></div>
                <div className="mt-3 md:mt-0"><div className="text-[10px] text-muted uppercase tracking-wide md:hidden">Confidence</div><div className="text-sm font-mono text-teal-700">{(d.fused_confidence * 100).toFixed(1)}%</div></div>
                <div className="mt-3 md:mt-0"><div className="text-[10px] text-muted uppercase tracking-wide md:hidden">Uncertainty</div><div className="text-sm font-mono text-muted">{d.composite_uncertainty?.toFixed(3)}</div></div>
                <div className="mt-3 md:mt-0"><div className="text-[10px] text-muted uppercase tracking-wide md:hidden">Risk</div>{d.is_malignant ? <span className="badge-malignant">Malignant</span> : <span className="badge-benign">Benign</span>}{d.doctor_review?.status === 'claimed' && <div className="text-[10px] text-muted mt-1">Under review</div>}</div>
                <div className="mt-3 md:mt-0 text-xs text-muted">{new Date(d.created_at).toLocaleDateString()}</div>
                <div className="mt-3 md:mt-0">{d.report_url && <button type="button" onClick={() => reportApi.download(d.report_url, `DERMAXAI_Report_${d.id}.pdf`)} className="text-xs text-teal-700 inline-flex items-center gap-1"><Download size={11} /> PDF</button>}</div>
              </div>
              {d.doctor_review?.status === 'completed' && <DoctorNoteCallout review={d.doctor_review} />}
            </div>
          ))}
        </div>
      </div>
    </Layout>
  )
}
