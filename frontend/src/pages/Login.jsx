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

  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')

  const from = location.state?.from?.pathname || '/dashboard'

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.email || !form.password) {
      setError('Please fill in all fields.')
      return
    }
    const result = await login(form.email, form.password)
    if (result.success) {
      toast.success(`Welcome back!`)
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
        <div className="text-center mb-8">
          <div className="font-display text-3xl text-white tracking-wider">WARZONE</div>
          <div className="font-display text-sm text-accent tracking-widest">FANTASY</div>
        </div>
        <div className="bg-card border border-border-color rounded-2xl p-8">
          <h1 className="font-display text-2xl text-white text-center mb-2">SIGN IN</h1>
          <p className="text-text-secondary text-center text-sm mb-8">Access your fantasy dashboard</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-mono text-xs text-text-secondary uppercase tracking-widest mb-2">Email</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="your@email.com"
                className="w-full bg-bg border border-border-color rounded-lg px-4 py-3 text-white placeholder-text-secondary focus:outline-none focus:border-accent transition-colors"
              />
            </div>
            <div>
              <label className="block font-mono text-xs text-text-secondary uppercase tracking-widest mb-2">Password</label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="••••••••"
                className="w-full bg-bg border border-border-color rounded-lg px-4 py-3 text-white placeholder-text-secondary focus:outline-none focus:border-accent transition-colors"
              />
            </div>
            {error && <p className="text-danger text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent text-bg font-display text-sm tracking-widest py-3 rounded-lg hover:bg-accent-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <LoadingSpinner size="sm" /> : 'LOGIN'}
            </button>
          </form>
          <p className="text-center text-text-secondary text-sm mt-6">
            No account? <Link to="/register" className="text-accent hover:text-accent-dark transition-colors">Register free</Link>
          </p>
        </div>
        <div className="text-center mt-6">
          <Link to="/" className="text-text-secondary text-sm hover:text-white transition-colors">← BACK TO HOME</Link>
        </div>
      </div>
    </div>
  )
}