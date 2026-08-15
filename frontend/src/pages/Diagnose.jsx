import { useState, useCallback, useEffect } from 'react'
import Layout from '../components/layout/Layout'
import { useDropzone } from 'react-dropzone'
import { diagnoseApi, reportApi } from '../lib/api'
import toast from 'react-hot-toast'
import { Upload, Microscope, AlertTriangle, CheckCircle, Download, RotateCcw, Info } from 'lucide-react'

const CLASS_NAMES  = { mel:'Melanoma', bcc:'Basal Cell Carcinoma', akiec:'Actinic Keratoses', bkl:'Benign Keratosis', nv:'Melanocytic Nevi', df:'Dermatofibroma', vasc:'Vascular Lesions' }
const CLASS_COLORS = { mel:'#B4413A', bcc:'#C17A3D', akiec:'#B08135', bkl:'#4F7A52', nv:'#3D6B94', df:'#6B5B95', vasc:'#3D8B94' }

export default function Diagnose() {
  const [file, setFile]         = useState(null)
  const [preview, setPreview]   = useState(null)
  const [symptoms, setSymptoms] = useState('')
  const [age, setAge]           = useState('')
  const [gender, setGender]     = useState('')
  const [skinType, setSkinType] = useState('')
  const [result, setResult]     = useState(null)
  const [loading, setLoading]   = useState(false)
  const [gradcam, setGradcam]   = useState(null)

  const onDrop = useCallback(files => {
    const f = files[0]; if (!f) return
    setFile(f); setPreview(URL.createObjectURL(f)); setResult(null); setGradcam(null)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': ['.jpg','.jpeg','.png','.bmp'] }, maxFiles: 1, maxSize: 10*1024*1024
  })

  const submit = async () => {
    if (!file) { toast.error('Please upload a dermoscopic image'); return }
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('image', file)
      fd.append('symptoms', symptoms)
      if (age)      fd.append('age', age)
      if (gender)   fd.append('gender', gender)
      if (skinType) fd.append('skin_type', skinType)

      const { data } = await diagnoseApi.diagnose(fd)
      setResult(data)

      if (data.gradcam_url) {
        const gradcamUrl = await diagnoseApi.gradcam(data.gradcam_url)
        setGradcam(gradcamUrl)
      }

      toast.success('Diagnosis complete!')
      if (data.decision.is_malignant) toast.error('Malignant lesion detected — clinical review advised', { duration: 6000 })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Diagnosis failed. Please try again.')
    } finally { setLoading(false) }
  }

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])
  useEffect(() => () => { if (gradcam) URL.revokeObjectURL(gradcam) }, [gradcam])

  const reset = () => {
    if (preview) URL.revokeObjectURL(preview)
    if (gradcam) URL.revokeObjectURL(gradcam)
    setFile(null); setPreview(null); setResult(null); setGradcam(null)
    setSymptoms(''); setAge(''); setGender(''); setSkinType('')
  }

  const probs = result ? Object.entries(result.decision.class_probabilities).sort((a,b) => b[1]-a[1]) : []

  return (
    <Layout>
      <div className="p-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-2xl font-serif font-semibold text-ink">New Diagnosis</h1>
          <p className="text-muted text-sm mt-1">Upload a dermoscopic image for AI-powered analysis</p>
        </div>
        <div className="grid grid-cols-2 gap-6">
          {/* LEFT — Input */}
          <div className="space-y-5">
            <div className="glass p-5">
              <div {...getRootProps()} className="relative cursor-pointer rounded-xl border-2 border-dashed transition-colors overflow-hidden"
                style={{ borderColor: isDragActive ? '#3D7068' : file ? '#B8C5C2' : '#E4E7E4',
                         background: isDragActive ? '#EEF4F3' : '#FAFBFA', minHeight: preview ? 'auto' : '200px' }}>
                <input {...getInputProps()} />
                {preview ? (
                  <div className="relative">
                    <img src={preview} alt="uploaded" className="w-full rounded-xl object-contain max-h-64" />
                    <div className="absolute top-2 right-2">
                      <button onClick={e => { e.stopPropagation(); reset() }}
                        className="w-7 h-7 rounded-full bg-white flex items-center justify-center border border-line hover:border-clinical-red transition-colors">
                        <RotateCcw size={12} className="text-muted" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-teal-50 border border-teal-100">
                      <Upload size={22} className="text-teal-500" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-ink">Drop dermoscopic image here</p>
                      <p className="text-xs text-muted mt-1">JPG, PNG, BMP · Max 10MB</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="glass p-5 space-y-4">
              <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
                <Info size={14} className="text-teal-500" /> Patient Context
                <span className="text-xs text-muted font-normal">(improves accuracy)</span>
              </h3>
              <div>
                <label className="text-xs text-muted mb-1.5 block">Symptoms / Description</label>
                <textarea className="input-glass resize-none" rows={3}
                  placeholder="Describe symptoms: size, duration, bleeding, itching, recent changes..."
                  value={symptoms} onChange={e => setSymptoms(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted mb-1.5 block">Age</label>
                  <input type="number" className="input-glass" placeholder="Years" min="1" max="120" value={age} onChange={e => setAge(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted mb-1.5 block">Gender</label>
                  <select className="input-glass" value={gender} onChange={e => setGender(e.target.value)}>
                    <option value="">Select</option>
                    {['Male','Female','Other'].map(g => <option key={g}>{g}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted mb-1.5 block">Skin Type (Fitzpatrick)</label>
                <select className="input-glass" value={skinType} onChange={e => setSkinType(e.target.value)}>
                  <option value="">Select skin type</option>
                  {['Type I','Type II','Type III','Type IV','Type V','Type VI'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <button onClick={submit} disabled={loading || !file} className="btn-primary w-full py-3.5 flex items-center justify-center gap-2 text-sm">
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Analyzing...</>
              ) : (
                <><Microscope size={16} /> Run Diagnosis</>
              )}
            </button>
          </div>

          {/* RIGHT — Results */}
          <div className="space-y-5">
            {!result ? (
              <div className="glass h-full flex items-center justify-center min-h-96">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4 bg-teal-50 border border-teal-100">
                    <Microscope size={28} className="text-teal-500/60" />
                  </div>
                  <p className="text-muted text-sm">Results will appear here</p>
                  <p className="text-muted/70 text-xs mt-1">Upload an image and click Run Diagnosis</p>
                </div>
              </div>
            ) : (
              <>
                <div className="glass p-5" style={{ borderColor: result.decision.is_malignant ? '#EFCAC6' : '#C9DBC9' }}>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        {result.decision.is_malignant ? <AlertTriangle size={16} style={{ color: '#B4413A' }} /> : <CheckCircle size={16} style={{ color: '#4F7A52' }} />}
                        <span className="text-xs font-medium" style={{ color: result.decision.is_malignant ? '#963530' : '#3F6242' }}>
                          {result.decision.is_malignant ? 'MALIGNANT' : 'BENIGN'}
                        </span>
                        {result.decision.requires_review && <span className="badge-review">Review Required</span>}
                      </div>
                      <h2 className="text-xl font-serif font-semibold text-ink">{result.decision.class_name}</h2>
                      <p className="text-xs text-muted font-mono mt-0.5">{result.decision.predicted_class.toUpperCase()}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-serif font-semibold" style={{ color: CLASS_COLORS[result.decision.predicted_class] || '#3D7068' }}>
                        {(result.decision.fused_confidence * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-muted">fused confidence</div>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg mb-3" style={{ background: result.uncertainty.requires_review ? '#FBF3E4' : '#F5F7F6' }}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-muted">Uncertainty ({result.uncertainty.confidence_level})</span>
                      <span className="font-mono" style={{ color: result.uncertainty.requires_review ? '#8C6825' : '#3F6242' }}>
                        {result.uncertainty.composite_uncertainty.toFixed(4)}
                      </span>
                    </div>
                    <div className="confidence-bar">
                      <div className="confidence-fill" style={{ width: `${result.uncertainty.composite_uncertainty * 100}%`,
                        background: result.uncertainty.requires_review ? '#B08135' : '#4F7A52' }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center mb-3">
                    {[
                      { label: 'Image', val: result.decision.modality_weights.image },
                      { label: 'Symptoms', val: result.decision.modality_weights.symptoms },
                      { label: 'Demographics', val: result.decision.modality_weights.demographics },
                    ].map(m => (
                      <div key={m.label} className="p-2 rounded-lg bg-paper border border-line">
                        <div className="text-sm font-semibold text-teal-500 font-mono">{(m.val*100).toFixed(0)}%</div>
                        <div className="text-xs text-muted">{m.label}</div>
                      </div>
                    ))}
                  </div>
                  {result.decision.is_malignant && (
                    <div className="p-3 rounded-lg text-xs flex gap-2" style={{ background: '#FBEAE8', border: '1px solid #EFCAC6', color: '#963530' }}>
                      <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                      <span>Malignant lesion detected. Please consult a qualified dermatologist immediately.</span>
                    </div>
                  )}
                </div>

                <div className="glass p-5">
                  <h3 className="text-sm font-semibold text-ink mb-4">Class Probabilities</h3>
                  <div className="space-y-2.5">
                    {probs.map(([cls, prob]) => (
                      <div key={cls}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted">{CLASS_NAMES[cls] || cls}</span>
                          <span className="font-mono" style={{ color: CLASS_COLORS[cls] || '#5B6764' }}>{(prob * 100).toFixed(2)}%</span>
                        </div>
                        <div className="confidence-bar">
                          <div className="confidence-fill" style={{ width: `${prob * 100}%`, background: CLASS_COLORS[cls] || '#3D7068' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {gradcam && (
                  <div className="glass p-5">
                    <h3 className="text-sm font-semibold text-ink mb-3">
                      Grad-CAM Explanation <span className="text-xs text-muted font-normal ml-2">Red = high importance</span>
                    </h3>
                    <img src={gradcam} alt="Grad-CAM" className="w-full rounded-xl border border-line" />
                  </div>
                )}

                {result.abcd_features?.segmentation_ok && (
                  <div className="glass p-5">
                    <h3 className="text-sm font-semibold text-ink mb-1">ABCD Dermoscopy Features</h3>
                    <p className="text-xs text-muted mb-4">Descriptive only — not used by the model's prediction</p>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: 'Asymmetry', val: result.abcd_features.asymmetry, fmt: v => (v*100).toFixed(1)+'%' },
                        { label: 'Border Irregularity', val: result.abcd_features.border_irregularity, fmt: v => (v*100).toFixed(1)+'%' },
                        { label: 'Color Variation', val: result.abcd_features.color_variation, fmt: v => v.toFixed(1) },
                        { label: 'Diameter', val: result.abcd_features.diameter_px, fmt: v => v.toFixed(0)+' px' },
                      ].map(m => (
                        <div key={m.label} className="p-3 rounded-lg bg-paper border border-line">
                          <div className="text-lg font-serif font-semibold text-ink">{m.val != null ? m.fmt(m.val) : '—'}</div>
                          <div className="text-xs text-muted mt-0.5">{m.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="glass p-5">
                  <h3 className="text-sm font-semibold text-ink mb-2">Recommendations</h3>
                  <p className="text-xs text-muted mb-3">{result.recommendation.class_description}</p>
                  <ul className="space-y-1.5">
                    {result.recommendation.recommendations.map((r,i) => (
                      <li key={i} className="text-xs text-ink/80 flex gap-2">
                        <span className="text-teal-500">•</span><span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex gap-3">
                  {result.report_url && (
                    <button type="button" onClick={() => reportApi.download(result.report_url)} className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2">
                      <Download size={14} /> Download PDF
                    </button>
                  )}
                  <button onClick={reset} className="btn-ghost flex-1 py-2.5 text-sm">New Diagnosis</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
