import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Eye, EyeOff, Lock, Microscope } from 'lucide-react'
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
    if (!token) {
      toast.error('This reset link is missing its token.')
      return
    }
    if (password !== confirm) {
      toast.error('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      await authApi.resetPassword(token, password)
      setDone(true)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'This reset link is invalid or expired')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 bg-teal-500">
            <Microscope size={20} className="text-white" />
          </div>
          <h1 className="text-xl font-serif font-semibold text-ink">Set a new password</h1>
          <p className="text-muted text-sm mt-1">Choose a new password for your DERMAXAI account.</p>
        </div>

        <div className="glass p-7">
          {done ? (
            <div className="text-center space-y-4">
              <p className="text-sm text-muted">Your password has been reset successfully. You can now sign in.</p>
              <button onClick={() => navigate('/login')} className="btn-primary px-5 py-2.5">Go to Sign In</button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <div>
                <label className="text-xs text-muted mb-1.5 block font-medium">New password</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    type={show ? 'text' : 'password'}
                    required
                    minLength={8}
                    maxLength={128}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className="input-glass pl-9 pr-10"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                  <button type="button" onClick={() => setShow(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink">
                    {show ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted mb-1.5 block font-medium">Confirm password</label>
                <input
                  type={show ? 'text' : 'password'}
                  required
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="input-glass"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted">Use at least 8 characters and meet the same password-strength rules used during registration.</p>
              <button type="submit" disabled={loading || !token} className="btn-primary w-full py-3">
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          )}
        </div>

        <Link to="/login" className="flex items-center justify-center gap-1.5 text-xs text-muted mt-6 hover:text-ink">
          <ArrowLeft size={13} /> Back to Sign In
        </Link>
      </div>
    </div>
  )
}
