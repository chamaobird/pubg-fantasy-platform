// frontend/src/pages/AuthCallback.jsx
// Recebe o token JWT após o redirect do Google OAuth
// Rota: /auth/callback?token=...
// Se o usuário não tem username, redireciona para /setup-username

import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../App'
import { API_BASE_URL } from '../config'

export default function AuthCallback() {
  const [searchParams] = useSearchParams()
  const { setToken } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      navigate('/?error=oauth', { replace: true })
      return
    }

    setToken(token)

    // Verifica se o usuário já tem username; se não, força setup
    fetch(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(user => {
        if (user && !user.username) {
          navigate('/setup-username', { replace: true })
        } else {
          navigate('/dashboard', { replace: true })
        }
      })
      .catch(() => navigate('/dashboard', { replace: true }))
  }, []) // eslint-disable-line

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--color-xama-black)', fontFamily: "'Rajdhani', sans-serif",
      color: 'var(--color-xama-muted)', fontSize: '16px', letterSpacing: '0.05em'
    }}>
      Autenticando…
    </div>
  )
}
