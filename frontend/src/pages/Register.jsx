import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { authApi } from '../lib/api'
import toast from 'react-hot-toast'
import { Check, Eye, EyeOff, Lock, Mail, Microscope, User, UserRoundPlus } from 'lucide-react'
import { BRAND_SHORT } from '../lib/brand'

const getRegistrationError = err => {
  const detail = err.response?.data?.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  if (Array.isArray(detail)) {
    const messages = detail
      .map(item => typeof item?.msg === 'string' ? item.msg : '')
      .filter(Boolean)
    if (messages.length) return messages.join('. ')
  }
  return 'Registration failed'
}

export default function Register() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'patient' })
  const set = (k, v) => {
    setError('')
    setForm(p => ({ ...p, [k]: v }))
  }

  const checks = [
    ['8+ characters', form.password.length >= 8],
    ['Uppercase letter', /[A-Z]/.test(form.password)],
    ['Number', /\d/.test(form.password)],
  ]

  const submit = async e => {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      const message = 'Please fill all fields'
      setError(message)
      toast.error(message)
      return
    }

    if (!checks.every(([, valid]) => valid)) {
      const message = 'Password needs 8+ characters, 1 uppercase letter and 1 number.'
      setError(message)
      toast.error(message)
      return
    }

    setError('')
    setLoading(true)
    try {
      const { data } = await authApi.register(form)
      login(data.user, data.access_token)
      toast.success(`Account created! Welcome to ${BRAND_SHORT}.`)
      navigate('/dashboard')
    } catch (err) {
      const message = getRegistrationError(err)
      setError(message)
      toast.error(message)
    } finally { setLoading(false) }
  }

  const checks = [
    ['8+ characters', form.password.length >= 8],
    ['Uppercase letter', /[A-Z]/.test(form.password)],
    ['Number', /\d/.test(form.password)],
  ]

  return (
    <div className="min-h-screen bg-[#eff6f3] relative overflow-hidden py-6 px-4 sm:px-6">
      <div className="absolute inset-0 hero-grid" />
      <div className="absolute -top-24 -left-16 w-[380px] h-[380px] rounded-full bg-teal-100/70 blur-3xl" />
      <div className="absolute -bottom-36 -right-20 w-[420px] h-[420px] rounded-full bg-emerald-100/60 blur-3xl" />

      <div className="relative max-w-5xl mx-auto min-h-[calc(100vh-3rem)] grid lg:grid-cols-[.8fr_1.2fr] gap-8 items-center">
        <div className="hidden lg:block">
          <Link to="/" className="inline-flex items-center gap-3 mb-12">
            <div className="brand-mark"><Microscope size={17} /></div>
            <div>
              <div className="font-serif font-semibold text-lg">{BRAND_SHORT}</div>
              <div className="text-[9px] uppercase tracking-[0.16em] text-muted">Clinical decision support</div>
            </div>
          </Link>
          <div className="eyebrow"><UserRoundPlus size={12} /> Patient onboarding</div>
          <h1 className="text-4xl xl:text-5xl font-serif font-semibold leading-[1.04] tracking-tight mt-4 max-w-md">A clearer place to understand every assessment.</h1>
          <p className="text-muted leading-7 mt-6 max-w-md">Your assessments, reports and lesion tracking stay together in one workspace.</p>
          
        </div>

        <div className="w-full max-w-lg mx-auto">
          <div className="lg:hidden flex items-center gap-3 mb-7">
            <div className="brand-mark"><Microscope size={17} /></div>
            <div><div className="font-serif font-semibold text-lg">{BRAND_SHORT}</div><div className="text-[9px] uppercase tracking-[0.16em] text-muted">Clinical decision support</div></div>
          </div>

          <form onSubmit={submit} className="glass p-6 sm:p-8">
            <div className="mb-6"><div className="eyebrow">Create your account</div><h1 className="text-3xl font-serif font-semibold text-ink mt-2">Start with your patient profile</h1><p className="text-sm text-muted mt-2">You can complete optional clinical details later.</p></div>

            <div className="space-y-4">
              <div><label className="field-label">Full name</label><div className="relative"><User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input className="input-glass pl-9" placeholder="Jane Smith" required value={form.name} onChange={e => set('name', e.target.value)} /></div></div>
              <div><label className="field-label">Email</label><div className="relative"><Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input type="email" className="input-glass pl-9" placeholder="you@example.com" required autoComplete="email" value={form.email} onChange={e => set('email', e.target.value)} /></div></div>
              <div>
                <label className="field-label">Password</label>
                <div className="relative"><Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input type={show ? 'text' : 'password'} className="input-glass pl-9 pr-11" placeholder="Create a strong password" required minLength={8} maxLength={128} autoComplete="new-password" value={form.password} onChange={e => set('password', e.target.value)} /><button type="button" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink">{show ? <EyeOff size={15} /> : <Eye size={15} />}</button></div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {checks.map(([label, valid]) => (
                    <span key={label} className={`rounded-full border px-2.5 py-1 text-[10px] font-medium ${valid ? 'border-[#cfe2db] bg-[#eff7f4] text-teal-800' : 'border-line bg-paper text-muted'}`}>
                      <Check size={10} className="inline mr-1" />{label}
                    </span>
                  ))}
                </div>
              </div>

              {error && (
                <div role="alert" className="rounded-xl border border-[#efcfca] bg-[#fff6f4] px-3.5 py-3 text-xs leading-5 text-[#8d3b35]">
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-primary w-full py-3">{loading ? 'Creating account…' : 'Create patient account'}</button>
            </div>

            <div className="mt-6 pt-5 border-t border-line text-center"><p className="text-sm text-muted">Already have an account? <Link to="/login" className="font-semibold text-teal-700 hover:text-teal-800">Sign in</Link></p></div>
          </form>
        </div>
      </div>
    </div>
  )
}