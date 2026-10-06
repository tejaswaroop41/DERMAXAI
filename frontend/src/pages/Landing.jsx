import { Link } from 'react-router-dom'
import { ArrowRight, Microscope, ShieldCheck, Stethoscope } from 'lucide-react'
import { BRAND_SHORT } from '../lib/brand'

const features = [
  { icon: Microscope, title: 'Image analysis', body: 'Classify dermoscopic images with calibrated confidence and uncertainty estimates.' },
  { icon: ShieldCheck, title: 'Explainable results', body: 'Review class probabilities and Grad-CAM heatmaps alongside every prediction.' },
  { icon: Stethoscope, title: 'Clinician review', body: 'Escalate flagged cases to a structured doctor review workflow.' },
]

export default function Landing() {
  return (
    <div className="min-h-screen bg-white text-ink">
      <header className="border-b border-line">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="brand-mark"><Microscope size={16} /></span>
            <span className="font-semibold tracking-tight">{BRAND_SHORT}</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/login" className="btn-ghost">Sign in</Link>
            <Link to="/register" className="btn-primary">Get started</Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden bg-paper border-b border-line">
          <div className="hero-grid" />
          <div className="relative max-w-6xl mx-auto px-6 py-20 lg:py-28 grid lg:grid-cols-[1.1fr_.9fr] gap-12 items-center">
            <div>
              <h1 className="text-4xl sm:text-5xl font-semibold leading-[1.1] tracking-tight max-w-xl">
                Skin lesion screening with clinical oversight.
              </h1>
              <p className="mt-5 text-base text-muted leading-7 max-w-lg">
                Upload a dermoscopic image, review the model's confidence and explanation, and route cases to a clinician when needed.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link to="/register" className="btn-primary px-6">Create an account <ArrowRight size={15} /></Link>
                <Link to="/login" className="btn-ghost px-6">Sign in</Link>
              </div>
            </div>

            <div className="glass p-5 shadow-raised">
              <div className="relative rounded-lg overflow-hidden border border-line aspect-[4/3]">
                <div className="scan-surface" />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                {['Prediction', 'Uncertainty', 'Grad-CAM'].map(label => (
                  <div key={label} className="rounded-lg border border-line bg-paper py-2.5 text-xs font-medium text-muted">{label}</div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-6 py-16">
          <div className="grid md:grid-cols-3 gap-5">
            {features.map(({ icon: Icon, title, body }) => (
              <div key={title} className="glass p-6">
                <div className="feature-icon"><Icon size={17} /></div>
                <h3 className="text-base font-semibold mt-4">{title}</h3>
                <p className="text-sm text-muted leading-6 mt-2">{body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row gap-2 sm:items-center justify-between text-xs text-muted">
          <span className="font-medium text-ink">{BRAND_SHORT}</span>
          <span>Clinical decision support. Results must be reviewed by a qualified professional.</span>
        </div>
      </footer>
    </div>
  )
}
