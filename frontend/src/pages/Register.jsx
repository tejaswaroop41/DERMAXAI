import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { authApi } from '../lib/api'
import toast from 'react-hot-toast'
import { Microscope, User, Mail, Lock } from 'lucide-react'

export default function Register() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'patient' })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.password) { toast.error('Please fill all fields'); return }
    setLoading(true)
    try {
      const { data } = await authApi.register(form)
      login(data.user, data.access_token)
      toast.success('Account created! Welcome to DERMAXAI.')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Registration failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 bg-teal-500">
            <Microscope size={20} className="text-white" />
          </div>
          <h1 className="text-xl font-serif font-semibold text-ink">Create account</h1>
          <p className="text-muted text-sm mt-1">Get started with DERMAXAI</p>
        </div>

        <form onSubmit={submit} className="glass p-7 space-y-5">
          <div>
            <label className="text-xs text-muted mb-1.5 block font-medium">Full Name</label>
            <div className="relative">
              <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input className="input-glass pl-9" placeholder="Jane Smith" required
                value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted mb-1.5 block font-medium">Email</label>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input type="email" className="input-glass pl-9" placeholder="you@example.com" required
                value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted mb-1.5 block font-medium">Password</label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input type="password" className="input-glass pl-9" placeholder="At least 8 characters" required
                minLength={8} maxLength={128} autoComplete="new-password"
                value={form.password} onChange={e => set('password', e.target.value)} />
            </div>
            <p className="text-[11px] text-muted mt-1">Use at least 8 characters, including an uppercase letter and a number.</p>
          </div>

          <div className="rounded-lg border border-line bg-paper/60 px-3 py-2.5">
            <p className="text-xs text-muted leading-relaxed">
              New accounts are created as <span className="font-medium text-ink">patients</span>.
              Doctor accounts must be provisioned by an administrator after registration.
            </p>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-3">
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
          <p className="text-center text-sm text-muted">
            Already have an account?{' '}
            <Link to="/login" className="text-teal-500 hover:text-teal-600 font-medium">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
