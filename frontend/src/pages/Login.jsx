import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Lock, Mail, Microscope } from 'lucide-react'
import { useAuth, homeForRole } from '../App'
import { authApi } from '../lib/api'
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
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-5 py-10">
      <Link to="/" className="flex items-center gap-2.5 mb-8">
        <span className="brand-mark"><Microscope size={16} /></span>
        <span className="font-semibold tracking-tight text-lg">{BRAND_SHORT}</span>
      </Link>

      <div className="glass w-full max-w-md p-7 sm:p-8">
        <h1 className="text-2xl font-semibold text-ink">Sign in</h1>
        <p className="text-sm text-muted mt-1.5">Enter your account details to continue.</p>

        <form onSubmit={submit} className="space-y-5 mt-6">
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
              <Link to="/forgot-password" className="text-xs font-semibold text-teal-700 hover:text-teal-600">Forgot password?</Link>
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

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-sm text-muted text-center mt-6 pt-5 border-t border-line">
          New to {BRAND_SHORT}? <Link to="/register" className="font-semibold text-teal-700 hover:text-teal-600">Create an account</Link>
        </p>
      </div>
    </div>
  )
}
