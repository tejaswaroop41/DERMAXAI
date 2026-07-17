import { Link } from 'react-router-dom'
import { Zap, Shield, Brain, ChevronRight, Microscope, Activity, FileText } from 'lucide-react'

const features = [
  { icon: Brain,      title: 'EfficientNetV2-S + SE + CBAM', desc: 'Squeeze-excitation and dual attention for lesion-focused analysis' },
  { icon: Shield,     title: 'ACWF-FL Loss',                 desc: 'Adaptive class weighting + focal loss for class-imbalanced dermoscopy' },
  { icon: Activity,   title: 'MCUE Uncertainty',             desc: 'Aleatory + epistemic + fusion uncertainty for clinical review flagging' },
  { icon: Microscope, title: 'CMCA Multimodal Fusion',       desc: 'Confidence-weighted fusion of image, symptom, and demographic data' },
  { icon: FileText,   title: 'PDF Clinical Reports',         desc: 'Auto-generated structured reports with Grad-CAM and recommendations' },
  { icon: Zap,        title: '8-crop TTA + SWA',             desc: 'Test-time augmentation ensemble with stochastic weight averaging' },
]

const classes = [
  { code: 'MEL',   name: 'Melanoma',             type: 'Malignant', color: '#ef4444' },
  { code: 'BCC',   name: 'Basal Cell Carcinoma',  type: 'Malignant', color: '#f97316' },
  { code: 'AKIEC', name: 'Actinic Keratoses',      type: 'Malignant', color: '#eab308' },
  { code: 'BKL',   name: 'Benign Keratosis',       type: 'Benign',    color: '#22c55e' },
  { code: 'NV',    name: 'Melanocytic Nevi',       type: 'Benign',    color: '#3b82f6' },
  { code: 'DF',    name: 'Dermatofibroma',         type: 'Benign',    color: '#8b5cf6' },
  { code: 'VASC',  name: 'Vascular Lesions',       type: 'Benign',    color: '#06b6d4' },
]

export default function Landing() {
  return (
    <div className="relative z-10 min-h-screen">
      <nav className="fixed top-0 left-0 right-0 z-50 px-8 py-4 flex items-center justify-between"
        style={{ background: 'rgba(2,8,23,0.8)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(14,165,233,0.08)' }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', boxShadow: '0 0 16px rgba(14,165,233,0.5)' }}>
            <Zap size={16} className="text-white" />
          </div>
          <span className="font-bold text-white tracking-wider text-sm">DERMAXAI</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="btn-ghost text-sm py-2 px-4">Sign In</Link>
          <Link to="/register" className="btn-primary text-sm py-2 px-4">Get Started</Link>
        </div>
      </nav>

      <section className="pt-32 pb-20 px-8 text-center max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 text-xs font-mono text-sky-400"
          style={{ background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.2)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
          DERMAXAI v6 — EfficientNetV2-S + SE + CBAM + ACWF-FL + MCUE + CMCA
        </div>
        <h1 className="text-6xl font-bold text-white leading-tight mb-6">
          AI-Powered{' '}
          <span style={{ background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Skin Lesion
          </span><br />Diagnosis
        </h1>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Multimodal diagnostic assistant combining dermoscopic image analysis, symptom NLP,
          demographic risk assessment, and calibrated uncertainty estimation.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link to="/register" className="btn-primary flex items-center gap-2 py-3 px-6">
            Start Diagnosis <ChevronRight size={16} />
          </Link>
          <Link to="/login" className="btn-ghost py-3 px-6">Sign In</Link>
        </div>
        <div className="grid grid-cols-4 gap-4 mt-16 max-w-2xl mx-auto">
          {[{ val: '10,015', label: 'Training Images' }, { val: '7', label: 'Lesion Classes' },
            { val: '8-crop', label: 'TTA Inference' }, { val: 'CMCA', label: 'Multimodal Fusion' }
          ].map(({ val, label }) => (
            <div key={label} className="glass-light p-4 text-center">
              <div className="text-2xl font-bold text-sky-400 font-mono">{val}</div>
              <div className="text-xs text-slate-500 mt-1">{label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="py-16 px-8 max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-white text-center mb-3">7 Detectable Classes</h2>
        <p className="text-slate-500 text-center mb-10 text-sm">ISIC 2018 benchmark dataset</p>
        <div className="grid grid-cols-7 gap-3">
          {classes.map(c => (
            <div key={c.code} className="glass-light p-3 text-center hover:scale-105 transition-transform">
              <div className="w-8 h-8 rounded-full mx-auto mb-2" style={{ background: c.color + '25', border: `2px solid ${c.color}40` }} />
              <div className="text-xs font-bold font-mono" style={{ color: c.color }}>{c.code}</div>
              <div className="text-xs text-slate-500 mt-1 leading-tight">{c.name}</div>
              <div className="text-xs mt-1.5 rounded-full px-1.5 py-0.5 inline-block"
                style={{ background: c.type === 'Malignant' ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                         color: c.type === 'Malignant' ? '#fca5a5' : '#86efac', fontSize: '9px' }}>
                {c.type}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="py-16 px-8 max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-white text-center mb-10">Novel Contributions</h2>
        <div className="grid grid-cols-3 gap-5">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="glass p-5 hover:border-sky-500/30 transition-all duration-300">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                style={{ background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.2)' }}>
                <Icon size={18} className="text-sky-400" />
              </div>
              <h3 className="font-bold text-white mb-2 text-sm">{title}</h3>
              <p className="text-slate-500 text-xs leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-20 px-8 text-center">
        <div className="glass max-w-2xl mx-auto p-10" style={{ border: '1px solid rgba(14,165,233,0.2)' }}>
          <h2 className="text-3xl font-bold text-white mb-4">Ready to diagnose?</h2>
          <p className="text-slate-400 mb-8 text-sm">Create a free account and upload your first dermoscopic image.</p>
          <Link to="/register" className="btn-primary inline-flex items-center gap-2">
            Get Started Free <ChevronRight size={16} />
          </Link>
        </div>
      </section>

      <footer className="py-8 text-center text-xs text-slate-600 border-t border-white/5">
        DERMAXAI v6 — Dr. AIT Major Project 2025-26 · ACWF-FL + SAM + SWA + CMCA + MCUE
      </footer>
    </div>
  )
}
