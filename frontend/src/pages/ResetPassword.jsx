import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Lock, Microscope } from 'lucide-react'
import { authApi } from '../lib/api'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = useMemo(() => searchParams.get('token') || '', [searchParams])
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const submit = async e => {
    e.preventDefault()
    if (!token) return toast.error('This reset link is missing its token.')
    if (password !== confirm) return toast.error('Passwords do not match')
    setLoading(true)
    try { await authApi.resetPassword(token, password); setDone(true) }
    catch (err) { toast.error(err.response?.data?.detail || 'This reset link is invalid or expired') }
    finally { setLoading(false) }
  }

  const checks = [
    ['8+ characters', password.length >= 8],
    ['Uppercase letter', /[A-Z]/.test(password)],
    ['Number', /\d/.test(password)],
  ]

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4 py-10">
      <div className="relative w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2.5 mb-8">
          <div className="brand-mark"><Microscope size={17} /></div>
          <span className="font-semibold tracking-tight text-lg text-ink">DERMAXAI</span>
        </Link>
        <div className="glass p-7 sm:p-8">
          <h1 className="text-2xl font-semibold text-ink">Set a new password</h1>
          <p className="text-sm text-muted mt-1.5 mb-6">Choose a new password for your account.</p>

          {done ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-xl mx-auto flex items-center justify-center bg-teal-50 border border-teal-100 text-teal-700"><CheckCircle2 size={24} /></div>
              <h2 className="font-serif text-xl font-semibold text-ink mt-4">Password updated</h2>
              <p className="text-sm text-muted leading-6 mt-2">Your password has been reset successfully. You can now sign in.</p>
              <button onClick={() => navigate('/login')} className="btn-primary mt-6 w-full">Go to sign in</button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <div>
                <label className="field-label">New password</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input type={show ? 'text' : 'password'} required minLength={8} maxLength={128} autoComplete="new-password" placeholder="Create a strong password" className="input-glass pl-9 pr-11" value={password} onChange={e => setPassword(e.target.value)} />
                  <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink">{show ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                </div>
              </div>

              <div>
                <label className="field-label">Confirm password</label>
                <input type={show ? 'text' : 'password'} required minLength={8} maxLength={128} autoComplete="new-password" placeholder="Repeat your password" className="input-glass" value={confirm} onChange={e => setConfirm(e.target.value)} />
              </div>

              <div className="grid grid-cols-3 gap-2">
                {checks.map(([label, valid]) => <div key={label} className={`rounded-lg border px-2 py-2 text-[10px] font-medium text-center ${valid ? 'border-[#D5E8E5] bg-[#F0F7F6] text-teal-800' : 'border-line bg-paper text-muted'}`}><CheckCircle2 size={11} className="mx-auto mb-1" />{label}</div>)}
              </div>

              <button type="submit" disabled={loading || !token} className="btn-primary w-full py-3">{loading ? 'Resetting…' : 'Reset password'}</button>
            </form>
          )}
        </div>
        <Link to="/login" className="flex items-center justify-center gap-1.5 text-xs text-muted mt-6 hover:text-ink"><ArrowLeft size={13} /> Back to sign in</Link>
      </div>
    </div>
  )
}
