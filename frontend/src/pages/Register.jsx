import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import LoadingSpinner from '../components/LoadingSpinner'

export default function Register() {
  const { register, login, loading } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' })
  const [errors, setErrors] = useState({})

  const validate = () => {
    const e = {}
    if (!form.username || form.username.length < 3) e.username = 'Username must be at least 3 characters.'
    if (!form.email || !form.email.includes('@')) e.email = 'Valid email required.'
    if (!form.password || form.password.length < 6) e.password = 'Password must be at least 6 characters.'
    if (form.password !== form.confirm) e.confirm = 'Passwords do not match.'
    return e
  }

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setErrors(prev => ({ ...prev, [e.target.name]: '' }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }

    const result = await register(form.username, form.email, form.password)
    if (result.success) {
      toast.success('Account created! Logging you in...')
      // Auto-login after register
      const loginResult = await login(form.username, form.password)
      if (loginResult.success) {
        navigate('/dashboard')
      } else {
        navigate('/login')
      }
    } else {
      toast.error(result.error)
      setErrors({ general: result.error })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-24 relative">
      <div className="absolute inset-0 bg-grid-pattern bg-grid opacity-20" />

      <div className="relative w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex flex-col items-center gap-1 mb-6">
            <span className="font-display font-black uppercase text-white text-3xl tracking-wider">WARZONE</span>
            <span className="font-display font-light uppercase text-accent text-sm tracking-[0.4em]">FANTASY</span>
          </Link>
          <h1 className="font-display font-black uppercase text-4xl text-white tracking-wide">Register</h1>
          <p className="text-text-secondary font-body mt-2">Join the transparent fantasy league</p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block font-display font-bold uppercase text-xs tracking-widest text-text-secondary mb-2">
                Username / Callsign
              </label>
              <input
                type="text"
                name="username"
                value={form.username}
                onChange={handleChange}
                placeholder="your_callsign"
                className={`input-field ${errors.username ? 'border-danger' : ''}`}
                autoComplete="username"
                autoFocus
              />
              {errors.username && <p className="text-danger text-xs mt-1 font-body">{errors.username}</p>}
            </div>

            <div>
              <label className="block font-display font-bold uppercase text-xs tracking-widest text-text-secondary mb-2">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className={`input-field ${errors.email ? 'border-danger' : ''}`}
                autoComplete="email"
              />
              {errors.email && <p className="text-danger text-xs mt-1 font-body">{errors.email}</p>}
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
                placeholder="Min 6 characters"
                className={`input-field ${errors.password ? 'border-danger' : ''}`}
                autoComplete="new-password"
              />
              {errors.password && <p className="text-danger text-xs mt-1 font-body">{errors.password}</p>}
            </div>

            <div>
              <label className="block font-display font-bold uppercase text-xs tracking-widest text-text-secondary mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                name="confirm"
                value={form.confirm}
                onChange={handleChange}
                placeholder="Repeat password"
                className={`input-field ${errors.confirm ? 'border-danger' : ''}`}
                autoComplete="new-password"
              />
              {errors.confirm && <p className="text-danger text-xs mt-1 font-body">{errors.confirm}</p>}
            </div>

            {errors.general && (
              <div className="border border-danger/40 bg-danger/10 px-4 py-3 text-danger font-body text-sm animate-fade-in">
                {errors.general}
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
                  <span>Creating account...</span>
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-border-color text-center">
            <p className="font-body text-text-secondary text-sm">
              Already have an account?{' '}
              <Link to="/login" className="text-accent hover:text-white transition-colors font-semibold">
                Sign in
              </Link>
            </p>
          </div>
        </div>

        <div className="text-center mt-4">
          <Link to="/" className="font-mono text-xs text-muted hover:text-accent transition-colors uppercase tracking-wider">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}
