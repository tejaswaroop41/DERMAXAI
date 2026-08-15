import { Link } from 'react-router-dom'
import { Microscope, ChevronRight } from 'lucide-react'

export default function Landing() {
  return (
    <div className="min-h-screen bg-paper">
      <nav className="fixed top-0 left-0 right-0 z-50 px-8 py-4 flex items-center justify-between bg-white border-b border-line">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-teal-500">
            <Microscope size={15} className="text-white" />
          </div>
          <span className="font-serif font-semibold text-ink text-base">DERMAXAI</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="btn-ghost text-sm py-2 px-4">Sign In</Link>
          <Link to="/register" className="btn-primary text-sm py-2 px-4">Get Started</Link>
        </div>
      </nav>

      <section className="pt-40 pb-32 px-8 text-center max-w-2xl mx-auto">
        <h1 className="text-5xl font-serif font-semibold text-ink leading-tight mb-6">
          AI-assisted skin lesion diagnosis
        </h1>
        <p className="text-base text-muted max-w-xl mx-auto mb-10 leading-relaxed">
          Upload a dermoscopic image and get a diagnostic assessment with confidence
          scoring, uncertainty flagging, and a clinician review pathway when needed.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link to="/register" className="btn-primary flex items-center gap-2 py-3 px-6">
            Start Diagnosis <ChevronRight size={16} />
          </Link>
          <Link to="/login" className="btn-ghost py-3 px-6">Sign In</Link>
        </div>
      </section>

      <footer className="py-8 text-center text-xs text-muted border-t border-line">
        DERMAXAI — Dr. AIT Major Project 2025-26
      </footer>
    </div>
  )
}
