import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Check, Eye, EyeOff, Lock, Mail, Microscope, User } from 'lucide-react'
import { useAuth } from '../App'
import { authApi } from '../lib/api'
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

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-5 py-10">
      <Link to="/" className="flex items-center gap-2.5 mb-8">
        <span className="brand-mark"><Microscope size={16} /></span>
        <span className="font-semibold tracking-tight text-lg">{BRAND_SHORT}</span>
      </Link>

      <form onSubmit={submit} className="glass w-full max-w-md p-7 sm:p-8">
        <h1 className="text-2xl font-semibold text-ink">Create your account</h1>
        <p className="text-sm text-muted mt-1.5">Register as a patient to get started.</p>

        <div className="space-y-4 mt-6">
          <div>
            <label className="field-label">Full name</label>
            <div className="relative">
              <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input className="input-glass pl-9" placeholder="Jane Smith" required value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="field-label">Email</label>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input type="email" className="input-glass pl-9" placeholder="you@example.com" required autoComplete="email" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="field-label">Password</label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input type={show ? 'text' : 'password'} className="input-glass pl-9 pr-11" placeholder="Create a password" required minLength={8} maxLength={128} autoComplete="new-password" value={form.password} onChange={e => set('password', e.target.value)} />
              <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink">
                {show ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {checks.map(([label, valid]) => (
                <span key={label} className={`rounded-md border px-2 py-1 text-[11px] font-medium ${valid ? 'border-teal-100 bg-teal-50 text-teal-700' : 'border-line bg-paper text-muted'}`}>
                  <Check size={10} className="inline mr-1" />{label}
                </span>
              ))}
            </div>
          </div>

          {error && (
            <div role="alert" className="rounded-lg border border-[#EFCAC6] bg-[#FBEAE8] px-3.5 py-3 text-xs leading-5 text-[#8D3B35]">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? 'Creating account…' : 'Create patient account'}</button>
        </div>

        <div className="mt-6 pt-5 border-t border-line text-center">
          <p className="text-xs text-muted mb-2">Doctor accounts must be provisioned by an administrator.</p>
          <p className="text-sm text-muted">Already have an account? <Link to="/login" className="font-semibold text-teal-700 hover:text-teal-600">Sign in</Link></p>
        </div>
      </form>
    </div>
  )
}
