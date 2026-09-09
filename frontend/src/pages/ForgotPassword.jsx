import { useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Mail, Microscope } from 'lucide-react'
import { authApi } from '../lib/api'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const submit = async e => {
    e.preventDefault()
    setLoading(true)
    try {
      await authApi.forgotPassword(email.trim())
      setSubmitted(true)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Unable to process the request')
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
          <h1 className="text-xl font-serif font-semibold text-ink">Forgot password?</h1>
          <p className="text-muted text-sm mt-1">We'll send a secure reset link if the account exists.</p>
        </div>

        <div className="glass p-7">
          {submitted ? (
            <div className="text-center space-y-4">
              <div className="mx-auto w-11 h-11 rounded-full bg-teal-500/10 flex items-center justify-center">
                <Mail size={19} className="text-teal-500" />
              </div>
              <p className="text-sm text-muted">
                If that email is registered, a password reset link has been sent. Check your inbox and spam folder.
              </p>
              <Link to="/login" className="btn-primary inline-flex px-5 py-2.5">Back to Sign In</Link>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <div>
                <label className="text-xs text-muted mb-1.5 block font-medium">Email</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="input-glass pl-9"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                {loading ? 'Sending...' : 'Send Reset Link'}
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
