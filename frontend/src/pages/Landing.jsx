import { Link } from 'react-router-dom'
import { BRAND_NAME, BRAND_SHORT } from '../lib/brand'
import { ArrowRight, CheckCircle2, Microscope, ShieldCheck, Stethoscope } from 'lucide-react'

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
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted">Multimodal healthcare assistant</div>
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
          

          <div className="max-w-6xl mx-auto px-6 lg:px-8 py-16 sm:py-20 lg:py-24">
            <div className="grid lg:grid-cols-[1.05fr_.95fr] gap-12 lg:gap-16 items-center">
              <div className="relative z-10">
                <div className="eyebrow mb-5">
                  <span className="eyebrow-dot" /> AI-assisted skin lesion screening
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-[4rem] font-serif font-semibold leading-[1.02] tracking-[-0.035em] max-w-2xl">
                  {BRAND_NAME}
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
                  <span className="inline-flex items-center gap-2"><CheckCircle2 size={14} className="text-teal-600" /> Grad-CAM explanation</span>
                  <span className="inline-flex items-center gap-2"><CheckCircle2 size={14} className="text-teal-600" /> Clinician review</span>
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
                      <span className="rounded-full border border-white/60 bg-white/65 px-2.5 py-1 text-[9px] font-semibold text-slate-600 backdrop-blur-sm">EXAMPLE MODEL VIEW</span>
                    </div>
                    <div className="absolute left-3 bottom-3 text-[10px] text-slate-600 bg-white/90 border border-white/80 rounded-md px-2 py-1">
                      Dermoscopic image
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-xl border border-[#DCEAE6] p-4 bg-[#F5F9F7]">
                      <div className="text-[10px] uppercase tracking-[0.12em] text-teal-700/80">Top prediction</div>
                      <div className="flex items-end justify-between gap-3 mt-2">
                        <div>
                          <div className="font-serif text-xl font-semibold">Example model output</div>
                          <div className="text-[10px] text-muted mt-1">Illustrative result — not a measured performance claim</div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-sm font-semibold text-teal-700">Illustrative interface</div>
                          <div className="text-[10px] text-muted">sample layout only</div>
                        </div>
                      </div>
                      <div className="mt-4 rounded-lg border border-dashed border-[#DCEAE6] px-3 py-2 text-[10px] text-muted">Live assessments display model-generated probabilities and uncertainty after analysis.</div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-line p-4 bg-paper">
                        <div className="text-[10px] uppercase tracking-[0.1em] text-muted">Uncertainty</div>
                        <div className="font-mono text-sm font-semibold mt-2">Model output</div>
                        <div className="text-[10px] text-teal-700 mt-1">Calculated per assessment</div>
                      </div>
                      <div className="rounded-xl border border-line p-4 bg-paper">
                        <div className="text-[10px] uppercase tracking-[0.1em] text-muted">Review</div>
                        <div className="text-sm font-semibold mt-2">Set per assessment</div>
                        <div className="text-[10px] text-muted mt-1">Calculated from the result</div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-line bg-[#F5F8F7] p-4">
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.1em] text-muted">
                        <ShieldCheck size={13} className="text-teal-600" /> Explainability
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
          <div className="glass p-6 sm:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6 bg-[#F3F7F5] border-[#DCEAE6]">
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
              <div className="font-serif font-semibold text-sm">{BRAND_SHORT}</div>
              <div className="text-[10px] text-muted">Multimodal healthcare assistant with skin specialisation</div>
            </div>
          </div>
          <div className="text-xs text-muted">Dr. AIT Major Project 2025–26</div>
        </div>
      </footer>
    </div>
  )
}
