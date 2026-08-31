import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth, homeForRole } from '../App'
import { authApi } from '../lib/api'
import toast from 'react-hot-toast'
import { Microscope, Eye, EyeOff, Mail, Lock } from 'lucide-react'

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
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 bg-teal-500">
            <Microscope size={20} className="text-white" />
          </div>
          <h1 className="text-xl font-serif font-semibold text-ink">Welcome back</h1>
          <p className="text-muted text-sm mt-1">Sign in to DERMAXAI</p>
        </div>
        <div className="glass p-7">
          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="text-xs text-muted mb-1.5 block font-medium">Email</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input type="email" required placeholder="you@example.com" className="input-glass pl-9"
                  value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted mb-1.5 block font-medium">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input type={show ? 'text' : 'password'} required placeholder="••••••••" className="input-glass pl-9 pr-10"
                  value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
                <button type="button" onClick={() => setShow(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink">
                  {show ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
          <p className="text-center text-sm text-muted mt-6">
            No account?{' '}
            <Link to="/register" className="text-teal-500 hover:text-teal-600 font-medium">Create one</Link>
          </p>
        </div>
        <Link to="/" className="block text-center text-xs text-muted mt-6 hover:text-ink">← Back to home</Link>
      </div>
    </div>
  )
}
