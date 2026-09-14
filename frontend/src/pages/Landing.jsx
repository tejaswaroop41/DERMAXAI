import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  FileText,
  Microscope,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Activity,
} from 'lucide-react'

const capabilities = [
  {
    icon: Microscope,
    title: 'Multimodal analysis',
    body: 'Skin-image analysis is combined with symptom context and patient factors for a richer assessment.',
  },
  {
    icon: Activity,
    title: 'Uncertainty-aware AI',
    body: 'Confidence and uncertainty signals help surface ambiguous cases instead of hiding them.',
  },
  {
    icon: Stethoscope,
    title: 'Clinical review pathway',
    body: 'Cases that need attention can move into a structured clinician review workflow.',
  },
  {
    icon: FileText,
    title: 'Explainable results',
    body: 'Grad-CAM, probability breakdowns and generated reports make results easier to inspect.',
  },
]

const steps = [
  ['01', 'Capture', 'Upload a dermoscopic image and add optional symptom context.'],
  ['02', 'Analyze', 'DERMAXAI evaluates the image with its multimodal diagnostic pipeline.'],
  ['03', 'Review', 'Inspect confidence, explanations and clinician guidance where required.'],
]

export default function Landing() {
  return (
    <div className="min-h-screen bg-paper overflow-hidden">
      <nav className="landing-nav">
        <Link to="/" className="flex items-center gap-3">
          <div className="brand-mark">
            <Microscope size={17} strokeWidth={2.1} />
          </div>
          <div>
            <div className="font-serif font-semibold text-ink text-base tracking-tight">DERMAXAI</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted">Clinical intelligence</div>
          </div>
        </Link>
        <div className="hidden sm:flex items-center gap-2">
          <Link to="/login" className="btn-ghost text-sm py-2 px-4">Sign In</Link>
          <Link to="/register" className="btn-primary text-sm py-2.5 px-5 inline-flex items-center gap-2">
            Get Started <ArrowRight size={14} />
          </Link>
        </div>
      </nav>

      <main>
        <section className="landing-hero">
          <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
            <div className="hero-orb hero-orb-one" />
            <div className="hero-orb hero-orb-two" />
            <div className="hero-grid" />
          </div>

          <div className="relative max-w-7xl mx-auto px-6 lg:px-8 pt-28 pb-20 lg:pt-32 lg:pb-28">
            <div className="grid lg:grid-cols-[1.02fr_.98fr] gap-14 lg:gap-16 items-center">
              <div>
                <div className="eyebrow mb-5">
                  <span className="eyebrow-dot" /> AI-assisted dermatology
                </div>
                <h1 className="text-[2.9rem] sm:text-6xl lg:text-[4.55rem] font-serif font-semibold text-ink leading-[0.98] tracking-[-0.035em] max-w-3xl">
                  Turn a skin image into a clearer clinical picture.
                </h1>
                <p className="mt-7 text-base sm:text-lg text-muted leading-8 max-w-2xl">
                  DERMAXAI combines dermoscopic image analysis, patient context, uncertainty estimation and clinician review into one focused diagnostic workflow.
                </p>
                <div className="mt-9 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <Link to="/register" className="btn-primary py-3.5 px-6 inline-flex items-center justify-center gap-2 text-sm shadow-soft">
                    Start a diagnosis <ArrowRight size={15} />
                  </Link>
                  <Link to="/login" className="btn-ghost py-3.5 px-6 inline-flex items-center justify-center gap-2 text-sm">
                    Explore the app <ChevronRight size={15} />
                  </Link>
                </div>
                <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted">
                  <span className="inline-flex items-center gap-2"><CheckCircle2 size={14} className="text-teal-600" /> Confidence + uncertainty</span>
                  <span className="inline-flex items-center gap-2"><CheckCircle2 size={14} className="text-teal-600" /> Explainable Grad-CAM</span>
                  <span className="inline-flex items-center gap-2"><CheckCircle2 size={14} className="text-teal-600" /> Clinician review</span>
                </div>
              </div>

              <div className="relative lg:pl-5">
                <div className="hero-console">
                  <div className="flex items-center justify-between pb-4 border-b border-line">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.16em] text-muted">Diagnostic workspace</div>
                      <div className="text-sm font-semibold text-ink mt-1">Current assessment</div>
                    </div>
                    <span className="status-pill"><span /> Live analysis</span>
                  </div>

                  <div className="grid sm:grid-cols-[.95fr_1.05fr] gap-5 pt-5">
                    <div className="rounded-2xl overflow-hidden border border-line bg-[#eef3f1] min-h-56 relative">
                      <div className="scan-surface">
                        <div className="scan-disc" />
                        <div className="scan-ring scan-ring-one" />
                        <div className="scan-ring scan-ring-two" />
                        <div className="scan-crosshair" />
                      </div>
                      <div className="absolute left-3 bottom-3 rounded-lg bg-white/90 backdrop-blur px-2.5 py-1.5 border border-line text-[10px] text-muted">
                        Dermoscopic image
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="hero-result-card">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-[10px] uppercase tracking-[0.12em] text-muted">Top prediction</div>
                            <div className="font-serif text-xl font-semibold text-ink mt-1">Melanocytic Nevi</div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono text-xl font-semibold text-teal-700">92.4%</div>
                            <div className="text-[10px] text-muted">confidence</div>
                          </div>
                        </div>
                        <div className="confidence-bar mt-4"><div className="confidence-fill" style={{ width: '92.4%' }} /></div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="hero-mini-card">
                          <div className="text-[10px] uppercase tracking-[0.1em] text-muted">Uncertainty</div>
                          <div className="font-mono text-sm font-semibold text-ink mt-2">0.0831</div>
                          <div className="text-[10px] text-emerald-700 mt-1">Low</div>
                        </div>
                        <div className="hero-mini-card">
                          <div className="text-[10px] uppercase tracking-[0.1em] text-muted">Review state</div>
                          <div className="font-semibold text-sm text-ink mt-2">Routine</div>
                          <div className="text-[10px] text-muted mt-1">No escalation</div>
                        </div>
                      </div>

                      <div className="hero-trace-card">
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.1em] text-muted">
                          <ShieldCheck size={13} className="text-teal-600" /> Explanation trace
                        </div>
                        <div className="flex gap-1.5 mt-3 items-end">
                          {[.34, .52, .75, .9, .68, .47, .29, .58].map((h, i) => (
                            <span key={i} style={{ height: `${h * 34}px` }} />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="hero-float-card hero-float-a">
                  <Sparkles size={14} className="text-teal-700" />
                  <div><div className="text-xs font-semibold text-ink">Multimodal</div><div className="text-[10px] text-muted">Image + symptoms + context</div></div>
                </div>
                <div className="hero-float-card hero-float-b">
                  <Stethoscope size={14} className="text-slate-600" />
                  <div><div className="text-xs font-semibold text-ink">Human review</div><div className="text-[10px] text-muted">When a case needs attention</div></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-14 border-y border-line bg-white/60">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
              <div>
                <div className="eyebrow">Built around the workflow</div>
                <h2 className="section-title mt-3">One place for assessment, explanation and follow-up.</h2>
              </div>
              <p className="text-sm text-muted leading-6 max-w-md">Designed as a decision-support interface rather than a black-box prediction screen.</p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-10">
              {capabilities.map(({ icon: Icon, title, body }) => (
                <div key={title} className="feature-card group">
                  <div className="feature-icon"><Icon size={17} /></div>
                  <h3 className="font-serif text-lg font-semibold text-ink mt-5">{title}</h3>
                  <p className="text-sm text-muted leading-6 mt-2">{body}</p>
                  <div className="mt-5 text-xs text-teal-700 inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">Learn more <ArrowRight size={12} /></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 lg:py-24">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="grid lg:grid-cols-[.8fr_1.2fr] gap-12 lg:gap-20 items-start">
              <div>
                <div className="eyebrow">How it works</div>
                <h2 className="section-title mt-3">Three deliberate steps. No clutter.</h2>
                <p className="text-sm text-muted leading-7 mt-5 max-w-md">From image capture to explainable output, the interface keeps the important clinical signals visible without overwhelming the user.</p>
              </div>
              <div className="space-y-3">
                {steps.map(([number, title, body]) => (
                  <div key={number} className="workflow-row">
                    <div className="workflow-number">{number}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3"><h3 className="font-serif text-lg font-semibold text-ink">{title}</h3><ArrowRight size={14} className="text-teal-600" /></div>
                      <p className="text-sm text-muted leading-6 mt-1.5 max-w-2xl">{body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="cta-panel">
              <div>
                <div className="eyebrow text-white/70">Ready to explore</div>
                <h2 className="text-3xl sm:text-4xl font-serif font-semibold text-white mt-3 max-w-2xl">A calmer, clearer way to work with dermatology AI.</h2>
                <p className="text-sm text-white/70 leading-6 mt-4 max-w-xl">Start with a patient account, run a diagnosis and explore the complete clinical workflow.</p>
              </div>
              <Link to="/register" className="bg-white text-ink font-semibold rounded-lg px-6 py-3 inline-flex items-center justify-center gap-2 text-sm hover:bg-paper transition-colors flex-shrink-0">
                Create account <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="brand-mark small"><Microscope size={14} /></div>
            <div><div className="font-serif font-semibold text-sm text-ink">DERMAXAI</div><div className="text-[10px] text-muted">AI-assisted skin lesion decision support</div></div>
          </div>
          <div className="text-xs text-muted">Dr. AIT Major Project 2025–26</div>
        </div>
      </footer>
    </div>
  )
}
