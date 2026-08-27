import { useEffect, useState, useMemo } from 'react'
import Layout from '../components/layout/Layout'
import { doctorApi, diagnoseApi, reportApi } from '../lib/api'
import { AlertTriangle, Download, Image as ImageIcon, CheckCircle2, XCircle, RotateCcw, Search } from 'lucide-react'
import toast from 'react-hot-toast'

const VERDICTS = [
  { value: 'confirmed', label: 'Confirmed', icon: CheckCircle2, color: '#B4413A' },
  { value: 'revised', label: 'Revised', icon: RotateCcw, color: '#B08135' },
  { value: 'dismissed', label: 'Dismissed', icon: XCircle, color: '#4F7A52' },
]

function VerdictBadge({ verdict }) {
  const v = VERDICTS.find(x => x.value === verdict)
  if (!v) return null
  const Icon = v.icon
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
      style={{ background: v.color + '14', border: `1px solid ${v.color}35`, color: v.color }}>
      <Icon size={12} /> {v.label}
    </span>
  )
}

function CaseCard({ item, onClaim, onReview, readOnly, claimedByOther }) {
  const [gradcamUrl, setGradcamUrl] = useState(null)
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [verdict, setVerdict] = useState('confirmed')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    let blobUrl = null

    if (item.gradcam_url) {
      diagnoseApi.gradcam(item.gradcam_url)
        .then(url => {
          if (cancelled) {
            URL.revokeObjectURL(url)
            return
          }
          blobUrl = url
          setGradcamUrl(url)
        })
        .catch(() => {})
    }

    return () => {
      cancelled = true
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [item.gradcam_url])

  const handleSubmitReview = async () => {
    setSubmitting(true)
    try {
      await onReview(item.id, { verdict, notes })
      setShowReviewForm(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="glass p-5">
      <div className="flex gap-4">
        {gradcamUrl ? (
          <img src={gradcamUrl} alt="Grad-CAM" className="w-24 h-24 rounded-lg object-cover flex-shrink-0 border border-line" />
        ) : (
          <div className="w-24 h-24 rounded-lg flex items-center justify-center flex-shrink-0 bg-paper border border-line">
            <ImageIcon size={20} className="text-line" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-sm font-semibold text-ink">{item.class_name}</span>
            {item.is_malignant && <span className="badge-malignant">Malignant</span>}
            {item.urgency_escalated && <span className="badge-review">Urgent</span>}
            {claimedByOther && item.review?.doctor_name && (
              <span className="text-xs text-muted">— claimed by {item.review.doctor_name}</span>
            )}
          </div>
          <div className="text-xs text-muted mb-1">
            Patient: <span className="text-ink/80">{item.patient_name}</span> · #{item.id} ·{' '}
            {new Date(item.created_at).toLocaleDateString()}
          </div>
          {item.symptoms && (
            <div className="text-xs text-muted italic mb-2">"{item.symptoms}"</div>
          )}
          <div className="flex items-center gap-4 text-xs font-mono text-muted mb-3">
            <span>Confidence: <span className="text-teal-500">{(item.fused_confidence * 100).toFixed(1)}%</span></span>
            <span>Uncertainty: <span style={{ color: '#B08135' }}>{item.composite_uncertainty?.toFixed(3)}</span></span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {item.report_url && (
              <button type="button" onClick={() => reportApi.download(item.report_url, `report_${item.id}.pdf`)}
                className="text-xs text-teal-500 hover:text-teal-600 flex items-center gap-1">
                <Download size={11} /> Report
              </button>
            )}

            {!readOnly && !item.review && (
              <button onClick={() => onClaim(item.id)} className="btn-primary text-xs px-3 py-1.5">
                Claim this case
              </button>
            )}

            {!readOnly && item.review?.status === 'claimed' && !showReviewForm && (
              <button onClick={() => setShowReviewForm(true)} className="btn-primary text-xs px-3 py-1.5">
                Submit verdict
              </button>
            )}

            {item.review?.status === 'completed' && <VerdictBadge verdict={item.review.verdict} />}
          </div>

          {showReviewForm && (
            <div className="mt-4 p-4 rounded-lg space-y-3 bg-paper border border-line">
              <div className="flex gap-2">
                {VERDICTS.map(v => (
                  <button key={v.value} type="button" onClick={() => setVerdict(v.value)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-colors"
                    style={{
                      background: verdict === v.value ? v.color + '14' : 'transparent',
                      border: `1px solid ${verdict === v.value ? v.color + '45' : '#E4E7E4'}`,
                      color: verdict === v.value ? v.color : '#5B6764',
                    }}>
                    <v.icon size={13} /> {v.label}
                  </button>
                ))}
              </div>
              <textarea className="input-glass text-sm w-full" rows={3}
                placeholder="Clinical notes (optional)..." value={notes}
                onChange={e => setNotes(e.target.value)} />
              <div className="flex gap-2">
                <button onClick={handleSubmitReview} disabled={submitting} className="btn-primary text-xs px-4 py-2">
                  {submitting ? 'Submitting...' : 'Submit review'}
                </button>
                <button onClick={() => setShowReviewForm(false)} className="btn-ghost text-xs px-4 py-2">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Doctor() {
  const [queue, setQueue] = useState({ unclaimed: [], claimed_by_me: [], claimed_by_others: [] })
  const [tab, setTab] = useState('unclaimed')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [malignantOnly, setMalignantOnly] = useState(false)

  const load = () => {
    setLoading(true)
    doctorApi.queue().then(r => setQueue(r.data)).catch(() => toast.error('Failed to load queue')).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleClaim = async (id) => {
    try {
      await doctorApi.claim(id)
      toast.success('Case claimed')
      load()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to claim case')
    }
  }

  const handleReview = async (id, data) => {
    try {
      await doctorApi.review(id, data)
      toast.success('Review submitted')
      load()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to submit review')
      throw e
    }
  }

  const applyFilters = (items) => items.filter(item => {
    const matchSearch = !search || item.patient_name?.toLowerCase().includes(search.toLowerCase()) ||
                        item.class_name?.toLowerCase().includes(search.toLowerCase())
    const matchMalignant = !malignantOnly || item.is_malignant
    return matchSearch && matchMalignant
  })

  const tabs = useMemo(() => [
    { key: 'unclaimed', label: 'Unclaimed', items: applyFilters(queue.unclaimed), rawCount: queue.unclaimed.length },
    { key: 'mine',      label: 'Claimed by me', items: applyFilters(queue.claimed_by_me), rawCount: queue.claimed_by_me.length },
    { key: 'others',    label: 'Claimed by others', items: applyFilters(queue.claimed_by_others), rawCount: null },
  ], [queue, search, malignantOnly])
  const active = tabs.find(t => t.key === tab)

  return (
    <Layout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-serif font-semibold text-ink">Review Queue</h1>
          <p className="text-muted text-sm mt-1">AI-flagged and routine cases available for clinical review</p>
        </div>

        {!loading && queue.unclaimed.filter(c => c.requires_review).length > 0 && (
          <div className="glass p-4 mb-6 flex items-center gap-3" style={{ borderColor: '#EFCAC6' }}>
            <AlertTriangle size={16} style={{ color: '#B4413A' }} className="flex-shrink-0" />
            <span className="text-sm text-ink/80">
              <span style={{ color: '#B4413A' }} className="font-semibold">{queue.unclaimed.filter(c => c.requires_review).length}</span> AI-flagged
              case{queue.unclaimed.filter(c => c.requires_review).length !== 1 ? 's' : ''} awaiting review
            </span>
          </div>
        )}

        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input className="input-glass pl-9 py-2 text-sm" placeholder="Search patient or diagnosis..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button onClick={() => setMalignantOnly(m => !m)}
            className="px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
            style={{
              background: malignantOnly ? '#FBEAE8' : 'transparent',
              border: `1px solid ${malignantOnly ? '#EFCAC6' : '#E4E7E4'}`,
              color: malignantOnly ? '#963530' : '#5B6764',
            }}>
            <AlertTriangle size={12} /> Malignant only
          </button>

          <div className="flex gap-2 ml-auto">
            {tabs.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                style={{
                  background: tab === t.key ? '#EEF4F3' : 'transparent',
                  border: `1px solid ${tab === t.key ? '#B8C5C2' : '#E4E7E4'}`,
                  color: tab === t.key ? '#254742' : '#5B6764',
                }}>
                {t.label}
                {t.rawCount !== null && t.rawCount > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: '#FBEAE8', color: '#963530' }}>
                    {t.rawCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="glass p-12 text-center text-muted">Loading...</div>
        ) : active.items.length === 0 ? (
          <div className="glass p-12 text-center text-muted text-sm">
            {search || malignantOnly ? 'No cases match your filters.' :
             tab === 'unclaimed' ? 'No cases waiting — nice work.' : 'Nothing here yet.'}
          </div>
        ) : (
          <div className="space-y-4">
            {active.items.map(item => (
              <CaseCard key={item.id} item={item}
                onClaim={handleClaim} onReview={handleReview}
                readOnly={tab === 'others'} claimedByOther={tab === 'others'} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
