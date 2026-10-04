import { useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, CheckCircle2, Mail, Microscope, ShieldCheck } from 'lucide-react'
import { authApi } from '../lib/api'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const submit = async e => {
    e.preventDefault()
    setLoading(true)
    try { await authApi.forgotPassword(email.trim()); setSubmitted(true) }
    catch (err) { toast.error(err.response?.data?.detail || 'Unable to process the request') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-[#eff6f3] relative overflow-hidden flex items-center justify-center px-4 py-10">
      <div className="absolute inset-0 hero-grid" />
      <div className="absolute -top-24 -right-20 w-[390px] h-[390px] rounded-full bg-teal-100/70 blur-3xl" />
      <div className="relative w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-3 mb-8">
          <div className="brand-mark"><Microscope size={17} /></div>
          <div className="text-left"><div className="font-serif font-semibold text-lg text-ink">DERMAXAI</div><div className="text-[9px] uppercase tracking-[0.16em] text-muted">Clinical decision support</div></div>
        </Link>
        <div className="glass p-7 sm:p-9">
          <div className="eyebrow"><ShieldCheck size={12} /> Account recovery</div>
          <h1 className="text-3xl font-serif font-semibold text-ink mt-2">Reset your password</h1>
          <p className="text-sm text-muted mt-2 mb-7">We’ll send a secure reset link if the account exists.</p>
          {submitted ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center bg-[#eef7f4] border border-[#d7e8e3] text-teal-700"><CheckCircle2 size={24} /></div>
              <h2 className="font-serif text-xl font-semibold text-ink mt-4">Check your inbox</h2>
              <p className="text-sm text-muted leading-6 mt-2">If that email is registered, a password reset link has been sent. Check spam as well.</p>
              <Link to="/login" className="btn-primary mt-6 w-full">Back to sign in</Link>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <div>
                <label className="field-label">Email</label>
                <div className="relative"><Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input type="email" required autoComplete="email" placeholder="you@example.com" className="input-glass pl-9" value={email} onChange={e => setEmail(e.target.value)} /></div>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? 'Sending…' : 'Send reset link'}</button>
            </form>
          )}
        </div>
        <Link to="/login" className="flex items-center justify-center gap-1.5 text-xs text-muted mt-6 hover:text-ink"><ArrowLeft size={13} /> Back to sign in</Link>
      </div>
    </div>
  )
}