import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Microscope, ShieldCheck, Stethoscope } from 'lucide-react'

const highlights = [
  {
    icon: Microscope,
    title: 'AI image analysis',
    body: 'Analyze a dermoscopic image with confidence and uncertainty signals.',
    tone: 'bg-teal-50 border-teal-100 text-teal-700',
  },
  {
    icon: ShieldCheck,
    title: 'Explainable output',
    body: 'Review class probabilities and Grad-CAM evidence alongside the result.',
    tone: 'bg-violet-50 border-violet-100 text-violet-700',
  },
  {
    icon: Stethoscope,
    title: 'Clinician review',
    body: 'Cases that need attention can move into a structured doctor workflow.',
    tone: 'bg-amber-50 border-amber-100 text-amber-700',
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
              <div className="font-serif font-semibold tracking-tight">DERMAXAI</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted">Clinical intelligence</div>
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
        <section className="relative overflow-hidden bg-[radial-gradient(circle_at_82%_20%,rgba(196,181,253,0.20),transparent_28%),radial-gradient(circle_at_15%_45%,rgba(45,212,191,0.10),transparent_25%),linear-gradient(180deg,#F7FAF9_0%,#FCFBFA_72%)]">
          <div className="absolute -top-24 right-[-90px] w-80 h-80 rounded-full bg-violet-200/20 blur-3xl pointer-events-none" />
          <div className="absolute bottom-[-140px] left-[-80px] w-96 h-96 rounded-full bg-amber-200/15 blur-3xl pointer-events-none" />

          <div className="max-w-6xl mx-auto px-6 lg:px-8 py-16 sm:py-20 lg:py-24">
            <div className="grid lg:grid-cols-[1.05fr_.95fr] gap-12 lg:gap-16 items-center">
              <div className="relative z-10">
                <div className="eyebrow mb-5">
                  <span className="eyebrow-dot" /> AI-assisted dermatology
                </div>
                <h1 className="text-5xl sm:text-6xl lg:text-[4.35rem] font-serif font-semibold leading-[0.98] tracking-[-0.035em] max-w-2xl">
                  A clearer way to assess skin lesions.
                </h1>
                <p className="mt-6 text-base sm:text-lg text-muted leading-8 max-w-xl">
                  DERMAXAI combines dermoscopic image analysis, patient context, uncertainty estimation and clinician review in one focused workflow.
                </p>
                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                  <Link to="/register" className="btn-primary inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm">
                    Start a diagnosis <ArrowRight size={15} />
                  </Link>
                  <Link to="/login" className="btn-ghost inline-flex items-center justify-center px-6 py-3.5 text-sm">
                    Sign in
                  </Link>
                </div>
                <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted">
                  <span className="inline-flex items-center gap-2"><CheckCircle2 size={14} className="text-teal-600" /> Confidence + uncertainty</span>
                  <span className="inline-flex items-center gap-2"><CheckCircle2 size={14} className="text-violet-600" /> Grad-CAM explanation</span>
                  <span className="inline-flex items-center gap-2"><CheckCircle2 size={14} className="text-amber-600" /> Clinician review</span>
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
                  <div className="rounded-xl overflow-hidden border border-emerald-100 bg-[#eef3f1] min-h-64 relative">
                    <div className="scan-surface" />
                    <div className="absolute inset-x-0 top-4 flex justify-center">
                      <span className="rounded-full border border-white/60 bg-white/65 px-2.5 py-1 text-[9px] font-semibold text-slate-600 backdrop-blur-sm">LIVE MODEL VIEW</span>
                    </div>
                    <div className="absolute left-3 bottom-3 text-[10px] text-slate-600 bg-white/90 border border-white/80 rounded-md px-2 py-1">
                      Dermoscopic image
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-xl border border-teal-100 p-4 bg-gradient-to-br from-teal-50 to-white">
                      <div className="text-[10px] uppercase tracking-[0.12em] text-teal-700/80">Top prediction</div>
                      <div className="flex items-end justify-between gap-3 mt-2">
                        <div>
                          <div className="font-serif text-xl font-semibold">Melanocytic Nevi</div>
                          <div className="text-[10px] text-muted mt-1">NV · example result</div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-xl font-semibold text-teal-700">92.4%</div>
                          <div className="text-[10px] text-muted">confidence</div>
                        </div>
                      </div>
                      <div className="confidence-bar mt-4"><div className="confidence-fill" style={{ width: '92.4%' }} /></div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-amber-100 p-4 bg-amber-50/70">
                        <div className="text-[10px] uppercase tracking-[0.1em] text-amber-800/75">Uncertainty</div>
                        <div className="font-mono text-sm font-semibold mt-2">0.0831</div>
                        <div className="text-[10px] text-emerald-700 mt-1">Low</div>
                      </div>
                      <div className="rounded-xl border border-violet-100 p-4 bg-violet-50/65">
                        <div className="text-[10px] uppercase tracking-[0.1em] text-violet-800/75">Review</div>
                        <div className="text-sm font-semibold mt-2">Routine</div>
                        <div className="text-[10px] text-muted mt-1">No escalation</div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-4">
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.1em] text-sky-800/75">
                        <ShieldCheck size={13} className="text-sky-600" /> Explainability
                      </div>
                      <p className="text-xs text-muted leading-5 mt-2">Confidence, class probabilities and Grad-CAM can be reviewed before acting on a result.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-line bg-white">
          <div className="max-w-6xl mx-auto px-6 lg:px-8 py-12 lg:py-14">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <div>
                <div className="eyebrow">Built for the workflow</div>
                <h2 className="text-2xl sm:text-3xl font-serif font-semibold mt-2">Focused tools, clear clinical signals.</h2>
              </div>
              <p className="text-sm text-muted max-w-md leading-6">Decision support first: useful AI output, visible uncertainty, and a clear path to clinician review.</p>
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

        <section className="max-w-6xl mx-auto px-6 lg:px-8 py-14 lg:py-16">
          <div className="glass p-6 sm:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6 bg-gradient-to-r from-teal-50 via-white to-violet-50 border-teal-100/70">
            <div>
              <div className="eyebrow">Start when you're ready</div>
              <h2 className="text-2xl sm:text-3xl font-serif font-semibold mt-2">Run your first assessment.</h2>
              <p className="text-sm text-muted mt-2 max-w-xl leading-6">Create an account and explore the complete DERMAXAI diagnostic workflow.</p>
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
              <div className="font-serif font-semibold text-sm">DERMAXAI</div>
              <div className="text-[10px] text-muted">AI-assisted skin lesion decision support</div>
            </div>
          </div>
          <div className="text-xs text-muted">Dr. AIT Major Project 2025–26</div>
        </div>
      </footer>
    </div>
  )
}
