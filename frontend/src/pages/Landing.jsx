import { Link } from 'react-router-dom'
import { BRAND_SHORT } from '../lib/brand'
import { ArrowRight, Microscope, ShieldCheck, Stethoscope } from 'lucide-react'

const highlights = [
  {
    icon: Microscope,
    title: 'AI image analysis',
    body: 'Analyze a dermoscopic image with confidence and uncertainty signals.',
    tone: 'bg-[#EEF5F3] border-[#DCEAE6] text-teal-700',
  },
  {
    icon: ShieldCheck,
    title: 'Explainable output',
    body: 'Review class probabilities and Grad-CAM evidence alongside the result.',
    tone: 'bg-[#F3F7F5] border-line text-teal-700',
  },
  {
    icon: Stethoscope,
    title: 'Clinician review',
    body: 'Cases that need attention can move into a structured doctor workflow.',
    tone: 'bg-[#F3F7F5] border-line text-teal-700',
  },
]

export default function Landing() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <nav className="border-b border-line bg-white/90 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="brand-mark">
              <Microscope size={17} strokeWidth={2.1} />
            </div>
            <div>
              <div className="font-serif font-semibold tracking-tight">{BRAND_SHORT}</div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted">Multimodal healthcare</div>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Link to="/login" className="btn-ghost text-sm py-2 px-4">Sign in</Link>
            <Link to="/register" className="btn-primary text-sm py-2.5 px-5 inline-flex items-center gap-2">
              Get started <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </nav>

      <main>
        <section className="relative overflow-hidden bg-[linear-gradient(180deg,#F4F8F7_0%,#FCFBFA_72%)]">
          <div className="max-w-6xl mx-auto px-6 lg:px-8 py-14 sm:py-18 lg:py-20">
            <div className="grid lg:grid-cols-[1.05fr_.95fr] gap-10 lg:gap-14 items-center">
              <div className="relative z-10">
                <div className="eyebrow mb-4">
                  <span className="eyebrow-dot" /> AI-assisted skin lesion screening
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-[3.7rem] font-serif font-semibold leading-[1.02] tracking-[-0.035em] max-w-xl">
                  Multimodal skin lesion decision support.
                </h1>
                <p className="mt-5 text-base text-muted leading-7 max-w-lg">
                  Analyze a dermoscopic image, review uncertainty and move cases to clinician oversight.
                </p>
                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                  <Link to="/register" className="btn-primary inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm">
                    Start a diagnosis <ArrowRight size={15} />
                  </Link>
                  <Link to="/login" className="btn-ghost inline-flex items-center justify-center px-6 py-3.5 text-sm">
                    Sign in
                  </Link>
                </div>
              </div>

              <div className="relative z-10 glass p-5 sm:p-6 lg:p-7 bg-white/95 shadow-[0_24px_60px_rgba(35,64,59,0.10)]">
                <div className="flex items-center justify-between pb-4 border-b border-line">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted">Diagnostic preview</div>
                    <div className="text-sm font-semibold mt-1">Example assessment</div>
                  </div>
                  <span className="status-pill"><span /> Ready</span>
                </div>

                <div className="grid sm:grid-cols-[.9fr_1.1fr] gap-5 pt-5">
                  <div className="rounded-xl overflow-hidden border border-[#DCEAE6] bg-[#EEF3F1] min-h-64 relative">
                    <div className="scan-surface" />
                    <div className="absolute inset-x-0 top-4 flex justify-center">
                      <span className="rounded-full border border-white/60 bg-white/65 px-2.5 py-1 text-[9px] font-semibold text-slate-600 backdrop-blur-sm">
                        EXAMPLE MODEL VIEW
                      </span>
                    </div>
                    <div className="absolute left-3 bottom-3 text-[10px] text-slate-600 bg-white/90 border border-white/80 rounded-md px-2 py-1">
                      Dermoscopic image
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-xl border border-[#DCEAE6] p-4 bg-[#F5F9F7]">
                      <div className="text-[10px] uppercase tracking-[0.12em] text-teal-700/80">Model output</div>
                      <div className="mt-2">
                        <div className="font-serif text-xl font-semibold">Example result</div>
                        <div className="text-[10px] text-muted mt-1">Illustrative interface only</div>
                      </div>
                      <div className="mt-4 rounded-lg border border-dashed border-[#DCEAE6] px-3 py-2 text-[10px] text-muted">
                        Live assessments show model probabilities and uncertainty.
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-line p-4 bg-paper">
                        <div className="text-[10px] uppercase tracking-[0.1em] text-muted">Uncertainty</div>
                        <div className="font-mono text-sm font-semibold mt-2">Per assessment</div>
                      </div>
                      <div className="rounded-xl border border-line p-4 bg-paper">
                        <div className="text-[10px] uppercase tracking-[0.1em] text-muted">Review</div>
                        <div className="text-sm font-semibold mt-2">When indicated</div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-line bg-[#F5F8F7] p-4">
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.1em] text-muted">
                        <ShieldCheck size={13} className="text-teal-600" /> Explainability
                      </div>
                      <p className="text-xs text-muted leading-5 mt-2">
                        Probabilities and Grad-CAM evidence support review of the result.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-line bg-white">
          <div className="max-w-6xl mx-auto px-6 lg:px-8 py-11 lg:py-12">
            <div>
              <div className="eyebrow">Core workflow</div>
              <h2 className="text-2xl sm:text-3xl font-serif font-semibold mt-2">Three things in one place.</h2>
            </div>

            <div className="grid md:grid-cols-3 gap-4 mt-8">
              {highlights.map(({ icon: Icon, title, body, tone }) => (
                <div key={title} className="glass p-5">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${tone}`}>
                    <Icon size={17} />
                  </div>
                  <h3 className="font-serif text-lg font-semibold mt-4">{title}</h3>
                  <p className="text-sm text-muted leading-6 mt-2">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-6 lg:px-8 py-12 lg:py-14">
          <div className="glass p-6 sm:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6 bg-[#F3F7F5] border-[#DCEAE6]">
            <div>
              <div className="eyebrow">Ready to begin?</div>
              <h2 className="text-2xl sm:text-3xl font-serif font-semibold mt-2">Create your patient account.</h2>
              <p className="text-sm text-muted mt-2 max-w-xl leading-6">Start the full DERMAXAI assessment workflow.</p>
            </div>
            <Link to="/register" className="btn-primary inline-flex items-center justify-center gap-2 px-6 py-3 flex-shrink-0">
              Create account <ArrowRight size={15} />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-white">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 py-7 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="brand-mark small"><Microscope size={14} /></div>
            <div>
              <div className="font-serif font-semibold text-sm">{BRAND_SHORT}</div>
              <div className="text-[10px] text-muted">Multimodal healthcare assistant</div>
            </div>
          </div>
          <div className="text-xs text-muted">Dr. AIT Major Project 2025–26</div>
        </div>
      </footer>
    </div>
  )
}
