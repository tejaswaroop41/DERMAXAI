import { useState, useCallback } from 'react'
import Layout from '../components/layout/Layout'
import { useDropzone } from 'react-dropzone'
import { diagnoseApi } from '../lib/api'
import toast from 'react-hot-toast'
import { Upload, Microscope, AlertTriangle, CheckCircle, Download, RotateCcw, Info } from 'lucide-react'

const CLASS_NAMES  = { mel:'Melanoma', bcc:'Basal Cell Carcinoma', akiec:'Actinic Keratoses', bkl:'Benign Keratosis', nv:'Melanocytic Nevi', df:'Dermatofibroma', vasc:'Vascular Lesions' }
const CLASS_COLORS = { mel:'#ef4444', bcc:'#f97316', akiec:'#eab308', bkl:'#22c55e', nv:'#3b82f6', df:'#8b5cf6', vasc:'#06b6d4' }

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
  const [scanning, setScanning] = useState(false)

  const onDrop = useCallback(files => {
    const f = files[0]; if (!f) return
    setFile(f); setPreview(URL.createObjectURL(f)); setResult(null); setGradcam(null)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': ['.jpg','.jpeg','.png'] }, maxFiles: 1, maxSize: 10*1024*1024
  })

  const submit = async () => {
    if (!file) { toast.error('Please upload a dermoscopic image'); return }
    setLoading(true); setScanning(true)
    try {
      const fd = new FormData()
      fd.append('image', file)
      fd.append('symptoms', symptoms)
      if (age)      fd.append('age', age)
      if (gender)   fd.append('gender', gender)
      if (skinType) fd.append('skin_type', skinType)

      const { data } = await diagnoseApi.diagnose(fd)

setResult(data)

// Build Grad-CAM URL that works in both development and production
const API_BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : ''

if (data.gradcam_url) {
  setGradcam(`${API_BASE}${data.gradcam_url}`)
}

toast.success('Diagnosis complete!')
      if (data.decision.is_malignant) toast.error('⚠ Malignant lesion detected — clinical review advised', { duration: 6000 })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Diagnosis failed. Please try again.')
    } finally { setLoading(false); setScanning(false) }
  }

  const reset = () => {
    setFile(null); setPreview(null); setResult(null); setGradcam(null)
    setSymptoms(''); setAge(''); setGender(''); setSkinType('')
  }

  const probs = result ? Object.entries(result.decision.class_probabilities).sort((a,b) => b[1]-a[1]) : []

  return (
    <Layout>
      <div className="p-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">New Diagnosis</h1>
          <p className="text-slate-500 text-sm mt-1">Upload a dermoscopic image for AI-powered multimodal analysis</p>
        </div>
        <div className="grid grid-cols-2 gap-6">
          {/* LEFT — Input */}
          <div className="space-y-5">
            <div className="glass p-5">
              <div {...getRootProps()} className="relative cursor-pointer rounded-xl border-2 border-dashed transition-all duration-200 overflow-hidden"
                style={{ borderColor: isDragActive ? '#0ea5e9' : file ? 'rgba(14,165,233,0.3)' : 'rgba(148,163,184,0.15)',
                         background: isDragActive ? 'rgba(14,165,233,0.05)' : 'rgba(15,23,42,0.4)', minHeight: preview ? 'auto' : '200px' }}>
                <input {...getInputProps()} />
                {preview ? (
                  <div className="relative">
                    <img src={preview} alt="uploaded" className="w-full rounded-xl object-contain max-h-64" />
                    {scanning && <div className="absolute inset-0 rounded-xl overflow-hidden"><div className="scan-line" /></div>}
                    <div className="absolute top-2 right-2">
                      <button onClick={e => { e.stopPropagation(); reset() }}
                        className="w-7 h-7 rounded-full bg-black/60 flex items-center justify-center hover:bg-red-500/60 transition-colors">
                        <RotateCcw size={12} className="text-white" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.15)' }}>
                      <Upload size={22} className="text-sky-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-slate-300">Drop dermoscopic image here</p>
                      <p className="text-xs text-slate-600 mt-1">JPG, PNG · Max 10MB</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="glass p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Info size={14} className="text-sky-400" /> Patient Context
                <span className="text-xs text-slate-600 font-normal">(improves accuracy via CMCA)</span>
              </h3>
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Symptoms / Description</label>
                <textarea className="input-glass resize-none" rows={3}
                  placeholder="Describe symptoms: size, duration, bleeding, itching, recent changes..."
                  value={symptoms} onChange={e => setSymptoms(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Age</label>
                  <input type="number" className="input-glass" placeholder="Years" min="1" max="120" value={age} onChange={e => setAge(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Gender</label>
                  <select className="input-glass" value={gender} onChange={e => setGender(e.target.value)}>
                    <option value="">Select</option>
                    {['Male','Female','Other'].map(g => <option key={g}>{g}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Skin Type (Fitzpatrick)</label>
                <select className="input-glass" value={skinType} onChange={e => setSkinType(e.target.value)}>
                  <option value="">Select skin type</option>
                  {['Type I','Type II','Type III','Type IV','Type V','Type VI'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <button onClick={submit} disabled={loading || !file} className="btn-primary w-full py-3.5 flex items-center justify-center gap-2 text-sm">
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Analysing with DERMAXAI v6...</>
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
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.1)' }}>
                    <Microscope size={28} className="text-slate-600" />
                  </div>
                  <p className="text-slate-600 text-sm">Results will appear here</p>
                  <p className="text-slate-700 text-xs mt-1">Upload an image and click Run Diagnosis</p>
                </div>
              </div>
            ) : (
              <>
                <div className="glass p-5" style={{ border: `1px solid ${result.decision.is_malignant ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.25)'}` }}>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        {result.decision.is_malignant ? <AlertTriangle size={16} className="text-red-400" /> : <CheckCircle size={16} className="text-green-400" />}
                        <span className="text-xs font-medium" style={{ color: result.decision.is_malignant ? '#fca5a5' : '#86efac' }}>
                          {result.decision.is_malignant ? 'MALIGNANT' : 'BENIGN'}
                        </span>
                        {result.decision.requires_review && <span className="badge-review">Review Required</span>}
                      </div>
                      <h2 className="text-xl font-bold text-white">{result.decision.class_name}</h2>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">{result.decision.predicted_class.toUpperCase()}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold font-mono" style={{ color: CLASS_COLORS[result.decision.predicted_class] || '#0ea5e9' }}>
                        {(result.decision.fused_confidence * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-slate-500">fused confidence</div>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl mb-3" style={{ background: result.uncertainty.requires_review ? 'rgba(234,179,8,0.08)' : 'rgba(15,23,42,0.4)' }}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-slate-400">MCUE Uncertainty ({result.uncertainty.confidence_level})</span>
                      <span className="font-mono" style={{ color: result.uncertainty.requires_review ? '#fde047' : '#86efac' }}>
                        {result.uncertainty.composite_uncertainty.toFixed(4)}
                      </span>
                    </div>
                    <div className="confidence-bar">
                      <div className="confidence-fill" style={{ width: `${result.uncertainty.composite_uncertainty * 100}%`,
                        background: result.uncertainty.requires_review ? 'linear-gradient(90deg,#eab308,#fde047)' : 'linear-gradient(90deg,#22c55e,#86efac)' }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center mb-3">
                    {[
                      { label: 'Image', val: result.decision.modality_weights.image },
                      { label: 'Symptoms', val: result.decision.modality_weights.symptoms },
                      { label: 'Demographics', val: result.decision.modality_weights.demographics },
                    ].map(m => (
                      <div key={m.label} className="p-2 rounded-lg" style={{ background: 'rgba(15,23,42,0.4)' }}>
                        <div className="text-sm font-bold text-sky-400 font-mono">{(m.val*100).toFixed(0)}%</div>
                        <div className="text-xs text-slate-500">{m.label}</div>
                      </div>
                    ))}
                  </div>
                  {result.decision.is_malignant && (
                    <div className="p-3 rounded-xl text-xs text-red-300 flex gap-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                      <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                      <span>Malignant lesion detected. Please consult a qualified dermatologist immediately.</span>
                    </div>
                  )}
                </div>

                <div className="glass p-5">
                  <h3 className="text-sm font-semibold text-white mb-4">Class Probabilities</h3>
                  <div className="space-y-2.5">
                    {probs.map(([cls, prob]) => (
                      <div key={cls}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-400">{CLASS_NAMES[cls] || cls}</span>
                          <span className="font-mono" style={{ color: CLASS_COLORS[cls] || '#94a3b8' }}>{(prob * 100).toFixed(2)}%</span>
                        </div>
                        <div className="confidence-bar">
                          <div className="confidence-fill" style={{ width: `${prob * 100}%`, background: `linear-gradient(90deg, ${CLASS_COLORS[cls] || '#0ea5e9'}99, ${CLASS_COLORS[cls] || '#0ea5e9'})` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {gradcam && (
                  <div className="glass p-5">
                    <h3 className="text-sm font-semibold text-white mb-3">
                      Grad-CAM Explanation <span className="text-xs text-slate-500 font-normal ml-2">Red = high importance</span>
                    </h3>
                    <img src={gradcam} alt="Grad-CAM" className="w-full rounded-xl" />
                  </div>
                )}

                <div className="glass p-5">
                  <h3 className="text-sm font-semibold text-white mb-2">Recommendations</h3>
                  <p className="text-xs text-slate-500 mb-3">{result.recommendation.class_description}</p>
                  <ul className="space-y-1.5">
                    {result.recommendation.recommendations.map((r,i) => (
                      <li key={i} className="text-xs text-slate-300 flex gap-2">
                        <span className="text-sky-400">•</span><span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex gap-3">
                  {result.report_url && (
                    <a href={result.report_url} target="_blank" rel="noreferrer" className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2">
                      <Download size={14} /> Download PDF
                    </a>
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
