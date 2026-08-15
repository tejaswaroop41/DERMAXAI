import { useEffect, useState } from 'react'
import Layout from '../components/layout/Layout'
import { diagnoseApi, reportApi } from '../lib/api'
import { Search, Download, Stethoscope, CheckCircle2, RotateCcw, XCircle, ChevronDown } from 'lucide-react'

const CLASS_NAMES  = { mel:'Melanoma', bcc:'Basal Cell Carcinoma', akiec:'Actinic Keratoses', bkl:'Benign Keratosis', nv:'Melanocytic Nevi', df:'Dermatofibroma', vasc:'Vascular Lesions' }
const CLASS_COLORS = { mel:'#B4413A', bcc:'#C17A3D', akiec:'#B08135', bkl:'#4F7A52', nv:'#3D6B94', df:'#6B5B95', vasc:'#3D8B94' }
const VERDICT_STYLE = {
  confirmed: { label: 'Confirmed', color: '#B4413A', bg: '#FBEAE8', border: '#EFCAC6', icon: CheckCircle2 },
  revised:   { label: 'Revised',   color: '#B08135', bg: '#FBF3E4', border: '#E9D3A4', icon: RotateCcw },
  dismissed: { label: 'Cleared',   color: '#4F7A52', bg: '#EDF3ED', border: '#C9DBC9', icon: XCircle },
}

function DoctorNoteCallout({ review }) {
  const [open, setOpen] = useState(true)
  const style = VERDICT_STYLE[review.verdict] || VERDICT_STYLE.confirmed
  const Icon = style.icon

  return (
    <div className="mx-5 mb-3 rounded-xl overflow-hidden" style={{ background: style.bg, border: `1px solid ${style.border}` }}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#FFFFFF', border: `1px solid ${style.border}` }}>
            <Stethoscope size={14} style={{ color: style.color }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-ink">{review.doctor_name}</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: '#FFFFFF', color: style.color }}>
                <Icon size={11} /> {style.label}
              </span>
            </div>
            <div className="text-xs text-muted mt-0.5">
              {review.reviewed_at && `Reviewed ${new Date(review.reviewed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
            </div>
          </div>
        </div>
        {review.notes && <ChevronDown size={16} className="text-muted flex-shrink-0 transition-transform" style={{ transform: open ? 'rotate(180deg)' : 'none' }} />}
      </button>
      {open && review.notes && (
        <div className="px-4 pb-4 pt-0">
          <div className="ml-11 p-3 rounded-lg bg-white text-sm text-ink leading-relaxed" style={{ border: `1px solid ${style.border}` }}>
            {review.notes}
          </div>
        </div>
      )}
    </div>
  )
}

export default function History() {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [filter, setFilter]   = useState('all')

  useEffect(() => {
    diagnoseApi.history().then(r => setHistory(r.data)).catch(() => {}).finally(() => setLoading(false))
    diagnoseApi.markReviewsSeen().catch(() => {})
  }, [])

  const filtered = history.filter(d => {
    const matchSearch = !search || CLASS_NAMES[d.predicted_class]?.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || (filter === 'malignant' && d.is_malignant) ||
                        (filter === 'benign' && !d.is_malignant) || (filter === 'review' && d.requires_review)
    return matchSearch && matchFilter
  })

  return (
    <Layout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-serif font-semibold text-ink">Diagnosis History</h1>
          <p className="text-muted text-sm mt-1">{history.length} total diagnoses</p>
        </div>
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input className="input-glass pl-9 py-2 text-sm" placeholder="Search diagnoses..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2">
            {['all','malignant','benign','review'].map(f => (
              <button key={f} onClick={() => setFilter(f)} className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors"
                style={{ background: filter === f ? '#EEF4F3' : 'transparent',
                         border: `1px solid ${filter === f ? '#B8C5C2' : '#E4E7E4'}`,
                         color: filter === f ? '#254742' : '#5B6764' }}>{f}</button>
            ))}
          </div>
        </div>
        <div className="glass overflow-hidden">
          <div className="grid text-xs text-muted px-5 py-3 border-b border-line" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 80px' }}>
            <span>Diagnosis</span><span>Confidence</span><span>Uncertainty</span><span>Risk</span><span>Date</span><span>Report</span>
          </div>
          {loading ? (
            <div className="p-8 text-center text-muted text-sm">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted text-sm">No diagnoses found</div>
          ) : (
            filtered.map(d => (
              <div key={d.id} className="border-b border-line last:border-b-0">
                <div className="grid items-center px-5 py-3.5 hover:bg-paper transition-colors" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 80px' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CLASS_COLORS[d.predicted_class] || '#5B6764' }} />
                    <div>
                      <div className="text-sm font-medium text-ink">{CLASS_NAMES[d.predicted_class] || d.predicted_class}</div>
                      <div className="text-xs text-muted font-mono">#{d.id}</div>
                    </div>
                  </div>
                  <div className="text-sm font-mono" style={{ color: CLASS_COLORS[d.predicted_class] || '#3D7068' }}>{(d.fused_confidence * 100).toFixed(1)}%</div>
                  <div className="text-sm font-mono text-muted">{d.composite_uncertainty?.toFixed(3)}</div>
                  <div className="flex flex-col gap-1 items-start">
                    {d.is_malignant ? <span className="badge-malignant">Malignant</span> : <span className="badge-benign">Benign</span>}
                    {d.doctor_review?.status === 'claimed' && (
                      <span className="text-xs text-muted">Under review</span>
                    )}
                  </div>
                  <div className="text-xs text-muted">{new Date(d.created_at).toLocaleDateString()}</div>
                  <div>
                    {d.report_url && <button type="button" onClick={() => reportApi.download(d.report_url)} className="text-xs text-teal-500 hover:text-teal-600 flex items-center gap-1"><Download size={11} /> PDF</button>}
                  </div>
                </div>
                {d.doctor_review?.status === 'completed' && <DoctorNoteCallout review={d.doctor_review} />}
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  )
}
