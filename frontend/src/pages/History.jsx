import { useEffect, useState } from 'react'
import Layout from '../components/layout/Layout'
import { diagnoseApi, reportApi } from '../lib/api'
import { Search, Download } from 'lucide-react'

const CLASS_NAMES  = { mel:'Melanoma', bcc:'Basal Cell Carcinoma', akiec:'Actinic Keratoses', bkl:'Benign Keratosis', nv:'Melanocytic Nevi', df:'Dermatofibroma', vasc:'Vascular Lesions' }
const CLASS_COLORS = { mel:'#ef4444', bcc:'#f97316', akiec:'#eab308', bkl:'#22c55e', nv:'#3b82f6', df:'#8b5cf6', vasc:'#06b6d4' }

export default function History() {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [filter, setFilter]   = useState('all')

  useEffect(() => {
    diagnoseApi.history().then(r => setHistory(r.data)).catch(() => {}).finally(() => setLoading(false))
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
          <h1 className="text-2xl font-bold text-white">Diagnosis History</h1>
          <p className="text-slate-500 text-sm mt-1">{history.length} total diagnoses</p>
        </div>
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input className="input-glass pl-9 py-2 text-sm" placeholder="Search diagnoses..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2">
            {['all','malignant','benign','review'].map(f => (
              <button key={f} onClick={() => setFilter(f)} className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all"
                style={{ background: filter === f ? 'rgba(14,165,233,0.12)' : 'transparent',
                         border: `1px solid ${filter === f ? 'rgba(14,165,233,0.3)' : 'rgba(148,163,184,0.1)'}`,
                         color: filter === f ? '#38bdf8' : '#64748b' }}>{f}</button>
            ))}
          </div>
        </div>
        <div className="glass overflow-hidden">
          <div className="grid text-xs text-slate-500 px-5 py-3 border-b border-white/5" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 80px' }}>
            <span>Diagnosis</span><span>Confidence</span><span>Uncertainty</span><span>Risk</span><span>Date</span><span>Report</span>
          </div>
          {loading ? (
            <div className="p-8 text-center text-slate-600 text-sm">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-600 text-sm">No diagnoses found</div>
          ) : (
            filtered.map(d => (
              <div key={d.id} className="grid items-center px-5 py-3.5 border-b border-white/5 hover:bg-white/5 transition-colors" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 80px' }}>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CLASS_COLORS[d.predicted_class] || '#64748b' }} />
                  <div>
                    <div className="text-sm font-medium text-white">{CLASS_NAMES[d.predicted_class] || d.predicted_class}</div>
                    <div className="text-xs text-slate-600 font-mono">#{d.id}</div>
                  </div>
                </div>
                <div className="text-sm font-mono" style={{ color: CLASS_COLORS[d.predicted_class] || '#0ea5e9' }}>{(d.fused_confidence * 100).toFixed(1)}%</div>
                <div className="text-sm font-mono text-slate-400">{d.composite_uncertainty?.toFixed(3)}</div>
                <div>{d.is_malignant ? <span className="badge-malignant">Malignant</span> : <span className="badge-benign">Benign</span>}</div>
                <div className="text-xs text-slate-500">{new Date(d.created_at).toLocaleDateString()}</div>
                <div>
                  {d.report_url && <button type="button" onClick={() => reportApi.open(d.report_url)} className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1"><Download size={11} /> PDF</button>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  )
}
