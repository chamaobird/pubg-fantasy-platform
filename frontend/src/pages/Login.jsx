import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import LoadingSpinner from '../components/LoadingSpinner'

export default function Login() {
  const { login, loading } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')

  const from = location.state?.from?.pathname || '/dashboard'

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.username || !form.password) {
      setError('Please fill in all fields.')
      return
    }
    const result = await login(form.username, form.password)
    if (result.success) {
      toast.success(`Welcome back, ${form.username}!`)
      navigate(from, { replace: true })
    } else {
      setError(result.error)
      toast.error(result.error)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-24 relative">
      {/* BG grid */}
      <div className="absolute inset-0 bg-grid-pattern bg-grid opacity-20" />

      <div className="relative w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex flex-col items-center gap-1 mb-6">
            <span className="font-display font-black uppercase text-white text-3xl tracking-wider">WARZONE</span>
            <span className="font-display font-light uppercase text-accent text-sm tracking-[0.4em]">FANTASY</span>
          </Link>
          <h1 className="font-display font-black uppercase text-4xl text-white tracking-wide">Sign In</h1>
          <p className="text-text-secondary font-body mt-2">Access your fantasy dashboard</p>
        </div>

        {/* Form card */}
        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block font-display font-bold uppercase text-xs tracking-widest text-text-secondary mb-2">
                Username
              </label>
              <input
                type="text"
                name="username"
                value={form.username}
                onChange={handleChange}
                placeholder="your_callsign"
                className="input-field"
                autoComplete="username"
                autoFocus
              />
            </div>

            <div>
              <label className="block font-display font-bold uppercase text-xs tracking-widest text-text-secondary mb-2">
                Password
              </label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="••••••••"
                className="input-field"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="border border-danger/40 bg-danger/10 px-4 py-3 text-danger font-body text-sm animate-fade-in">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full text-center text-base py-4 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span>Authenticating...</span>
                </>
              ) : (
                'Login'
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-border-color text-center">
            <p className="font-body text-text-secondary text-sm">
              No account?{' '}
              <Link to="/register" className="text-accent hover:text-white transition-colors font-semibold">
                Register free
              </Link>
            </p>
          </div>
        </div>

        {/* Back link */}
        <div className="text-center mt-4">
          <Link to="/" className="font-mono text-xs text-muted hover:text-accent transition-colors uppercase tracking-wider">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}
