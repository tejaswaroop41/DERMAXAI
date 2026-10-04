import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth, homeForRole } from '../App'
import { authApi } from '../lib/api'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Lock, Mail, Microscope, ShieldCheck, Sparkles } from 'lucide-react'
import { BRAND_SHORT } from '../lib/brand'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async e => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await authApi.login(form)
      login(data.user, data.access_token)
      toast.success(`Welcome back, ${data.user.name}!`)
      navigate(homeForRole(data.user.role))
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Login failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-[#eff6f3] relative overflow-hidden">
      <div className="absolute inset-0 hero-grid" />
      <div className="absolute -top-32 -right-24 w-[430px] h-[430px] rounded-full bg-teal-100/70 blur-3xl" />
      <div className="absolute -bottom-40 -left-32 w-[380px] h-[380px] rounded-full bg-emerald-100/60 blur-3xl" />

      <div className="relative min-h-screen grid lg:grid-cols-[1.05fr_.95fr]">
        <div className="hidden lg:flex flex-col justify-between px-12 xl:px-20 py-12">
          <Link to="/" className="inline-flex items-center gap-3 w-fit">
            <div className="brand-mark"><Microscope size={17} /></div>
            <div>
              <div className="font-serif font-semibold text-lg text-ink">{BRAND_SHORT}</div>
              <div className="text-[9px] uppercase tracking-[0.16em] text-muted">Clinical decision support</div>
            </div>
          </Link>

          <div className="max-w-lg">
            <div className="eyebrow"><Sparkles size={12} /> Secure clinical workspace</div>
            <h1 className="text-5xl xl:text-6xl font-serif font-semibold leading-[1.02] tracking-tight text-ink mt-4">
              Bring image, context and clinical review together.
            </h1>
            <p className="text-muted leading-7 mt-6 max-w-md">
              Access the DERMAXAI workflow for AI-assisted skin lesion assessment, uncertainty signals and clinician oversight.
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              <span className="status-pill"><ShieldCheck size={12} /> Explainable output</span>
              <span className="status-pill"><Microscope size={12} /> Image analysis</span>
              <span className="status-pill"><Lock size={12} /> Protected access</span>
            </div>
          </div>

          <p className="text-xs text-muted max-w-md leading-5">
            DERMAXAI is a decision-support system. Assessment results should be reviewed by qualified healthcare professionals.
          </p>
        </div>

        <div className="flex items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-md">
            <div className="lg:hidden flex items-center gap-3 mb-8">
              <div className="brand-mark"><Microscope size={17} /></div>
              <div>
                <div className="font-serif font-semibold text-lg">{BRAND_SHORT}</div>
                <div className="text-[9px] uppercase tracking-[0.16em] text-muted">Clinical decision support</div>
              </div>
            </div>

            <div className="glass p-7 sm:p-9">
              <div className="mb-7">
                <div className="eyebrow">Welcome back</div>
                <h1 className="text-3xl font-serif font-semibold text-ink mt-2">Sign in to your workspace</h1>
                <p className="text-sm text-muted mt-2">Use your registered account to continue.</p>
              </div>

              <form onSubmit={submit} className="space-y-5">
                <div>
                  <label className="field-label">Email</label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input type="email" required autoComplete="email" placeholder="you@example.com" className="input-glass pl-9"
                      value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="field-label !mb-0">Password</label>
                    <Link to="/forgot-password" className="text-xs font-semibold text-teal-700 hover:text-teal-800">Forgot password?</Link>
                  </div>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input type={show ? 'text' : 'password'} required autoComplete="current-password" placeholder="••••••••" className="input-glass pl-9 pr-11"
                      value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
                    <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink">
                      {show ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>

              <div className="mt-7 pt-6 border-t border-line text-center">
                <p className="text-sm text-muted">New to DERMAXAI? <Link to="/register" className="font-semibold text-teal-700 hover:text-teal-800">Create an account</Link></p>
              </div>
            </div>

            <Link to="/" className="flex items-center justify-center text-xs text-muted mt-6 hover:text-ink">← Back to home</Link>
          </div>
        </div>
      </div>
    </div>
  )
}