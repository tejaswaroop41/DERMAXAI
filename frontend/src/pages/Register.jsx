import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { authApi } from '../lib/api'
import toast from 'react-hot-toast'
import { Zap, User, Mail, Lock, Calendar } from 'lucide-react'

const SKIN_TYPES = ['Type I (Very Fair)', 'Type II (Fair)', 'Type III (Medium)', 'Type IV (Olive)', 'Type V (Brown)', 'Type VI (Dark)']

export default function Register() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', age: '', gender: '', skin_type: '', role: 'patient' })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const submit = async () => {
    setLoading(true)
    try {
      const { data } = await authApi.register({ ...form, age: form.age ? parseInt(form.age) : null })
      login(data.user, data.access_token)
      toast.success('Account created! Welcome to DERMAXAI.')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Registration failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative z-10 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', boxShadow: '0 0 40px rgba(14,165,233,0.4)' }}>
            <Zap size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Create account</h1>
          <p className="text-slate-500 text-sm mt-1">Step {step} of 2</p>
          <div className="flex gap-2 justify-center mt-4">
            {[1,2].map(s => <div key={s} className="h-1 w-16 rounded-full transition-all duration-300"
              style={{ background: s <= step ? '#0ea5e9' : 'rgba(148,163,184,0.2)' }} />)}
          </div>
        </div>
        <div className="glass p-8" style={{ border: '1px solid rgba(14,165,233,0.15)' }}>
          {step === 1 ? (
            <div className="space-y-5">
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block font-medium">Full Name</label>
                <div className="relative">
                  <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input className="input-glass pl-9" placeholder="Dr. Jane Smith" required
                    value={form.name} onChange={e => set('name', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block font-medium">Email</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input type="email" className="input-glass pl-9" placeholder="you@example.com" required
                    value={form.email} onChange={e => set('email', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block font-medium">Password</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input type="password" className="input-glass pl-9" placeholder="Min 8 characters" required
                    value={form.password} onChange={e => set('password', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block font-medium">Account Type</label>
                <div className="grid grid-cols-2 gap-3">
                  {['patient','doctor'].map(role => (
                    <button key={role} type="button" onClick={() => set('role', role)}
                      className="py-2.5 rounded-xl text-sm font-medium capitalize transition-all border"
                      style={{ background: form.role === role ? 'rgba(14,165,233,0.12)' : 'transparent',
                               borderColor: form.role === role ? 'rgba(14,165,233,0.4)' : 'rgba(148,163,184,0.15)',
                               color: form.role === role ? '#38bdf8' : '#64748b' }}>
                      {role}
                    </button>
                  ))}
                </div>
              </div>
              <button type="button" onClick={() => {
                if (!form.name || !form.email || !form.password) { toast.error('Please fill all fields'); return }
                setStep(2)
              }} className="btn-primary w-full py-3">Continue →</button>
            </div>
          ) : (
            <div className="space-y-5">
              <p className="text-xs text-slate-500">Patient profile — helps improve diagnostic accuracy</p>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block font-medium">Age</label>
                <div className="relative">
                  <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input type="number" className="input-glass pl-9" placeholder="e.g. 35" min="1" max="120"
                    value={form.age} onChange={e => set('age', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block font-medium">Gender</label>
                <div className="grid grid-cols-3 gap-2">
                  {['Male','Female','Other'].map(g => (
                    <button key={g} type="button" onClick={() => set('gender', g)}
                      className="py-2 rounded-xl text-xs font-medium transition-all border"
                      style={{ background: form.gender === g ? 'rgba(14,165,233,0.12)' : 'transparent',
                               borderColor: form.gender === g ? 'rgba(14,165,233,0.4)' : 'rgba(148,163,184,0.15)',
                               color: form.gender === g ? '#38bdf8' : '#64748b' }}>{g}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block font-medium">Fitzpatrick Skin Type</label>
                <select className="input-glass" value={form.skin_type} onChange={e => set('skin_type', e.target.value)}>
                  <option value="">Select skin type</option>
                  {SKIN_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(1)} className="btn-ghost flex-1 py-3">← Back</button>
                <button type="button" onClick={submit} disabled={loading} className="btn-primary flex-1 py-3">
                  {loading ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </div>
          )}
          <p className="text-center text-sm text-slate-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-sky-400 hover:text-sky-300 font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
