import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Link } from 'react-router-dom'
import Layout from '../components/layout/Layout'
import { diagnoseApi, lesionApi, reportApi } from '../lib/api'
import toast from 'react-hot-toast'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Download,
  ImagePlus,
  Info,
  Microscope,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Upload,
} from 'lucide-react'

const CLASS_NAMES = { mel:'Melanoma', bcc:'Basal Cell Carcinoma', akiec:'Actinic Keratoses', bkl:'Benign Keratosis', nv:'Melanocytic Nevi', df:'Dermatofibroma', vasc:'Vascular Lesions' }
const CLASS_COLORS = { mel:'#B4413A', bcc:'#C17A3D', akiec:'#B08135', bkl:'#4F7A52', nv:'#3D6B94', df:'#6B5B95', vasc:'#3D8B94' }

function Section({ title, eyebrow, children, action }) {
  return <section className="glass p-5 sm:p-6">
    <div className="flex items-start justify-between gap-4 mb-5">
      <div><div className="text-[10px] uppercase tracking-[0.14em] text-muted">{eyebrow}</div><h2 className="section-card-title mt-1">{title}</h2></div>
      {action}
    </div>
    {children}
  </section>
}

export default function Diagnose() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [symptoms, setSymptoms] = useState('')
  const [age, setAge] = useState('')
  const [gender, setGender] = useState('')
  const [skinType, setSkinType] = useState('')
  const [sunExposure, setSunExposure] = useState('')
  const [lesions, setLesions] = useState([])
  const [lesionId, setLesionId] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [gradcam, setGradcam] = useState(null)
  const [showContext, setShowContext] = useState(true)

  useEffect(() => {
    lesionApi.list().then(r => setLesions(r.data || [])).catch(() => {})
  }, [])

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])
  useEffect(() => () => { if (gradcam) URL.revokeObjectURL(gradcam) }, [gradcam])

  const onDrop = useCallback(files => {
    const f = files[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setResult(null)
    if (gradcam) URL.revokeObjectURL(gradcam)
    setGradcam(null)
  }, [gradcam])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.bmp'] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
  })

  const submit = async () => {
    if (!file) { toast.error('Please upload a dermoscopic image'); return }
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('image', file)
      fd.append('symptoms', symptoms)
      if (age) fd.append('age', age)
      if (gender) fd.append('gender', gender)
      if (skinType) fd.append('skin_type', skinType)
      if (sunExposure) fd.append('sun_exposure', sunExposure)

      const { data } = await diagnoseApi.diagnose(fd)
      setResult(data)

      if (lesionId && data.diagnosis_id) {
        try {
          await lesionApi.attachDiagnosis(Number(lesionId), data.diagnosis_id)
          toast.success('Diagnosis added to lesion timeline')
        } catch {
          toast.error('Diagnosis completed, but lesion tracking could not be updated')
        }
      } else {
        toast.success('Diagnosis complete')
      }

      if (data.gradcam_url) {
        const url = await diagnoseApi.gradcam(data.gradcam_url)
        setGradcam(url)
      }
      if (data.decision?.is_malignant) toast.error('Malignant finding — clinical review advised', { duration: 6000 })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Diagnosis failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    if (preview) URL.revokeObjectURL(preview)
    if (gradcam) URL.revokeObjectURL(gradcam)
    setFile(null); setPreview(null); setResult(null); setGradcam(null)
    setSymptoms(''); setAge(''); setGender(''); setSkinType(''); setSunExposure('')
  }

  const probs = useMemo(() => result ? Object.entries(result.decision.class_probabilities).sort((a, b) => b[1] - a[1]) : [], [result])
  const selectedLesion = lesions.find(l => String(l.id) === String(lesionId))

  return (
    <Layout>
      <div className="page-pad max-w-7xl mx-auto">
        <div className="page-heading">
          <div>
            <div className="eyebrow"><Microscope size={13} /> Diagnostic workspace</div>
            <h1 className="page-title">New diagnosis</h1>
            <p className="page-subtitle">Upload a dermoscopic image, add clinical context and inspect the model's explanation before deciding what to do next.</p>
          </div>
          <Link to="/lesions" className="btn-ghost inline-flex items-center gap-2 text-xs"><Activity size={14} /> Lesion tracking</Link>
        </div>

        <div className="grid xl:grid-cols-[.88fr_1.12fr] gap-5 items-start">
          <div className="space-y-5">
            <Section title="Image" eyebrow="Primary input">
              <div {...getRootProps()} className="relative rounded-2xl border-2 border-dashed overflow-hidden cursor-pointer transition-colors"
                style={{ minHeight: preview ? 'auto' : 300, borderColor: isDragActive ? '#3D7068' : file ? '#B8C5C2' : '#DDE5E2', background: isDragActive ? '#EEF5F3' : '#FAFBFA' }}>
                <input {...getInputProps()} />
                {preview ? (
                  <div className="relative bg-[#F2F5F3]">
                    <img src={preview} alt="Selected dermoscopic image" className="w-full max-h-[460px] object-contain" />
                    <div className="absolute inset-x-3 top-3 flex justify-between items-start">
                      <div className="rounded-lg bg-white/90 border border-line px-2.5 py-1.5 text-[10px] text-muted">{file?.name}</div>
                      <button type="button" onClick={e => { e.stopPropagation(); reset() }} className="w-8 h-8 rounded-lg bg-white border border-line flex items-center justify-center text-muted hover:text-ink"><RotateCcw size={13} /></button>
                    </div>
                  </div>
                ) : (
                  <div className="min-h-[300px] flex flex-col items-center justify-center text-center px-8">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-white border border-[#DCEAE6] text-teal-700 shadow-sm"><ImagePlus size={22} /></div>
                    <div className="text-sm font-semibold text-ink mt-4">Drop a dermoscopic image here</div>
                    <div className="text-xs text-muted mt-1.5">or click to browse · JPG, PNG, BMP · up to 10 MB</div>
                  </div>
                )}
              </div>
            </Section>

            <Section title="Clinical context" eyebrow="Optional, but useful" action={<button onClick={() => setShowContext(v => !v)} className="text-xs text-teal-700 inline-flex items-center gap-1">{showContext ? 'Collapse' : 'Expand'} <ChevronDown size={13} style={{ transform: showContext ? 'rotate(180deg)' : 'none' }} /></button>}>
              {showContext && <div className="space-y-4">
                <div><label className="field-label">Symptoms / description</label><textarea className="input-glass resize-none" rows={4} placeholder="Itching, bleeding, recent growth, duration, color change…" value={symptoms} onChange={e => setSymptoms(e.target.value)} /></div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div><label className="field-label">Age</label><input type="number" min="1" max="120" className="input-glass" placeholder="Years" value={age} onChange={e => setAge(e.target.value)} /></div>
                  <div><label className="field-label">Gender</label><select className="input-glass" value={gender} onChange={e => setGender(e.target.value)}><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option></select></div>
                  <div><label className="field-label">Fitzpatrick skin type</label><select className="input-glass" value={skinType} onChange={e => setSkinType(e.target.value)}><option value="">Select</option>{['Type I','Type II','Type III','Type IV','Type V','Type VI'].map(s => <option key={s}>{s}</option>)}</select></div>
                  <div><label className="field-label">Sun exposure</label><select className="input-glass" value={sunExposure} onChange={e => setSunExposure(e.target.value)}><option value="">Select</option><option>Low</option><option>Moderate</option><option>High</option></select></div>
                </div>
                <div className="rounded-xl border border-line bg-paper p-3 flex gap-3 items-start"><Info size={15} className="text-teal-700 mt-0.5 flex-shrink-0" /><p className="text-xs text-muted leading-5">Context affects supporting risk signals. The image model remains the source of lesion class prediction.</p></div>
              </div>}
            </Section>

            <Section title="Longitudinal tracking" eyebrow="Optional">
              <div className="flex flex-col sm:flex-row gap-3">
                <select className="input-glass" value={lesionId} onChange={e => setLesionId(e.target.value)}>
                  <option value="">Don't attach to a lesion</option>
                  {lesions.map(l => <option key={l.id} value={l.id}>{l.name}{l.body_site ? ` · ${l.body_site}` : ''}</option>)}
                </select>
                <Link to="/lesions" className="btn-ghost whitespace-nowrap inline-flex items-center justify-center gap-2 text-xs"><PlusIcon /> Manage trackers</Link>
              </div>
              {selectedLesion && <p className="text-xs text-muted mt-2">This result will be added to <span className="text-ink font-medium">{selectedLesion.name}</span> after analysis.</p>}
              {!lesions.length && <p className="text-xs text-muted mt-2">No trackers yet. Create one from the Lesion tracking page.</p>}
            </Section>

            <button onClick={submit} disabled={loading || !file} className="btn-primary w-full py-3.5 inline-flex items-center justify-center gap-2 text-sm">
              {loading ? <><span className="loading-mark loading-mark-light" /> Analyzing image and context…</> : <><Sparkles size={16} /> Run diagnostic assessment</>}
            </button>
          </div>

          <div className="space-y-5 xl:sticky xl:top-5">
            {!result ? (
              <div className="glass p-8 min-h-[520px] flex items-center justify-center">
                <div className="max-w-sm text-center">
                  <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center bg-[#EEF5F3] border border-[#DCEAE6] text-teal-700"><ShieldCheck size={28} /></div>
                  <h2 className="font-serif text-2xl font-semibold text-ink mt-5">Your assessment will appear here</h2>
                  <p className="text-sm text-muted leading-6 mt-2">The result panel keeps the prediction, uncertainty, probabilities and explanation in one reviewable surface.</p>
                  <div className="mt-6 grid grid-cols-3 gap-2 text-xs text-muted"><div className="rounded-lg border border-line p-3">Prediction</div><div className="rounded-lg border border-line p-3">Uncertainty</div><div className="rounded-lg border border-line p-3">Grad-CAM</div></div>
                </div>
              </div>
            ) : (
              <>
                <Section title={result.decision.class_name} eyebrow={result.decision.is_malignant ? 'Clinical attention' : 'AI assessment'} action={result.decision.requires_review && <span className="badge-review">Review required</span>}>
                  <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
                    <div><div className="flex items-center gap-2 mb-2">{result.decision.is_malignant ? <AlertTriangle size={16} className="text-red-700" /> : <CheckCircle2 size={16} className="text-emerald-700" />}<span className="text-xs font-semibold uppercase tracking-wide" style={{ color: result.decision.is_malignant ? '#963530' : '#3F6242' }}>{result.decision.is_malignant ? 'Malignant signal' : 'Benign signal'}</span></div><div className="text-xs text-muted font-mono">{result.decision.predicted_class.toUpperCase()}</div></div>
                    <div className="text-left sm:text-right"><div className="font-mono text-4xl font-semibold" style={{ color: CLASS_COLORS[result.decision.predicted_class] || '#3D7068' }}>{(result.decision.fused_confidence * 100).toFixed(1)}%</div><div className="text-xs text-muted">fused confidence</div></div>
                  </div>
                  <div className="mt-5"><div className="flex justify-between text-xs text-muted mb-1.5"><span>Confidence</span><span className="font-mono">{(result.decision.fused_confidence * 100).toFixed(1)}%</span></div><div className="confidence-bar h-2"><div className="confidence-fill h-2" style={{ width: `${result.decision.fused_confidence * 100}%` }} /></div></div>
                  <div className="grid grid-cols-3 gap-2 mt-4">{Object.entries(result.decision.modality_weights).map(([key, value]) => <div key={key} className="rounded-xl bg-paper border border-line p-3"><div className="font-mono text-sm font-semibold text-teal-700">{(value * 100).toFixed(0)}%</div><div className="text-[10px] text-muted capitalize mt-1">{key}</div></div>)}</div>
                  {result.decision.is_malignant && <div className="mt-4 p-3 rounded-xl bg-[#FBEAE8] border border-[#EFCAC6] text-xs text-[#963530] flex gap-2"><AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />This is decision-support output, not a diagnosis. Seek qualified dermatology review for concerning findings.</div>}
                </Section>

                <Section title="Uncertainty" eyebrow="Model confidence boundary">
                  <div className="flex items-center justify-between gap-4"><div><div className="text-lg font-serif font-semibold text-ink">{result.uncertainty.confidence_level}</div><div className="text-xs text-muted mt-1">Composite uncertainty score</div></div><div className="font-mono text-xl font-semibold" style={{ color: result.uncertainty.requires_review ? '#8C6825' : '#3F6242' }}>{result.uncertainty.composite_uncertainty.toFixed(4)}</div></div>
                  <div className="confidence-bar mt-4"><div className="confidence-fill" style={{ width: `${Math.min(result.uncertainty.composite_uncertainty * 100, 100)}%`, background: result.uncertainty.requires_review ? '#B08135' : '#4F7A52' }} /></div>
                  {result.uncertainty.requires_review && <div className="text-xs text-[#8C6825] mt-3">This case crosses the application's review threshold and should be examined by a clinician.</div>}
                </Section>

                <Section title="Class probabilities" eyebrow="Full model distribution">
                  <div className="space-y-3">{probs.map(([cls, prob]) => <div key={cls}><div className="flex justify-between text-xs mb-1"><span className="text-muted">{CLASS_NAMES[cls] || cls}</span><span className="font-mono" style={{ color: CLASS_COLORS[cls] || '#5B6764' }}>{(prob * 100).toFixed(2)}%</span></div><div className="confidence-bar"><div className="confidence-fill" style={{ width: `${prob * 100}%`, background: CLASS_COLORS[cls] || '#3D7068' }} /></div></div>)}</div>
                </Section>

                {gradcam && <Section title="Grad-CAM explanation" eyebrow="Visual evidence"><img src={gradcam} alt="Grad-CAM explanation" className="w-full rounded-xl border border-line" /><p className="text-xs text-muted mt-3">Highlighted regions show where the model's gradient-based explanation concentrated. This is supporting evidence, not a clinical finding.</p></Section>}

                {result.abcd_features?.segmentation_ok && <Section title="ABCD features" eyebrow="Descriptive image analysis"><div className="grid grid-cols-2 gap-3">{[
                  ['Asymmetry', result.abcd_features.asymmetry, v => `${(v * 100).toFixed(1)}%`],
                  ['Border irregularity', result.abcd_features.border_irregularity, v => `${(v * 100).toFixed(1)}%`],
                  ['Color variation', result.abcd_features.color_variation, v => `${(v * 100).toFixed(1)}%`],
                  ['Diameter', result.abcd_features.diameter_px, v => `${v.toFixed(0)} px`],
                ].map(([label, value, fmt]) => <div key={label} className="rounded-xl bg-paper border border-line p-4"><div className="font-serif text-lg font-semibold text-ink">{value == null ? '—' : fmt(value)}</div><div className="text-xs text-muted mt-1">{label}</div></div>)}</div><p className="text-[10px] text-muted mt-3">Descriptive only — not used by the model's prediction.</p></Section>}

                <Section title="Recommendations" eyebrow="Decision support"><p className="text-sm text-muted leading-6">{result.recommendation.class_description}</p><ul className="mt-4 space-y-2">{result.recommendation.recommendations.map((r, i) => <li key={i} className="text-sm text-ink/85 flex gap-2"><span className="text-teal-700">•</span><span>{r}</span></li>)}</ul></Section>

                <div className="grid sm:grid-cols-2 gap-3"><button type="button" onClick={() => reportApi.download(result.report_url, `DERMAXAI_Report_${result.diagnosis_id}.pdf`)} disabled={!result.report_url} className="btn-primary inline-flex items-center justify-center gap-2 py-3 text-sm"><Download size={15} /> Download report</button><button type="button" onClick={reset} className="btn-ghost inline-flex items-center justify-center gap-2 py-3 text-sm"><RotateCcw size={15} /> New assessment</button></div>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}

function PlusIcon() { return <span className="text-base leading-none">+</span> }
