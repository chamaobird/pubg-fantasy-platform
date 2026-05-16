// frontend/src/pages/AuthCallback.jsx
// Conclui o login Google OAuth via troca de código opaco por JWT
// Rota: /auth/callback?code=<opaque>  (nunca ?token=JWT)
// Se o usuário não tem username, redireciona para /setup-username

import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../App'
import { API_BASE_URL } from '../config'
import { track } from '../lib/analytics'

async function exchangeCode(code, attempt = 1) {
  const res = await fetch(`${API_BASE_URL}/auth/exchange-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  })
  if (res.ok) return res.json()
  // Retry automático 1 vez em caso de erro de rede (não em 400)
  if (res.status !== 400 && attempt < 2) {
    await new Promise(r => setTimeout(r, 800))
    return exchangeCode(code, attempt + 1)
  }
  throw Object.assign(new Error('exchange failed'), { status: res.status })
}

export default function AuthCallback() {
  const [searchParams] = useSearchParams()
  const { setToken } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState(false)

  useEffect(() => {
    const code = searchParams.get('code')
    if (!code) {
      navigate('/?error=oauth', { replace: true })
      return
    }

    exchangeCode(code)
      .then(({ access_token }) => {
        track('login_completed', { method: 'google' })
        setToken(access_token)

        // Verifica se o usuário já tem username; se não, força setup
        return fetch(`${API_BASE_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${access_token}` },
        })
          .then(r => r.ok ? r.json() : null)
          .then(user => {
            if (user && !user.username) {
              navigate('/setup-username', { replace: true })
            } else {
              navigate('/dashboard', { replace: true })
            }
          })
      })
      .catch(() => setError(true))
  }, []) // eslint-disable-line

  if (error) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--xm-bg)', fontFamily: "'Rajdhani', sans-serif",
        color: 'var(--xm-muted)', fontSize: '16px', letterSpacing: '0.05em',
        gap: '16px',
      }}>
        <span>Falha na autenticação. O link pode ter expirado.</span>
        <button
          onClick={() => navigate('/', { replace: true })}
          style={{
            padding: '8px 20px', borderRadius: '6px', cursor: 'pointer',
            background: 'var(--xm-orange)', color: 'var(--xm-bg)',
            border: 'none', fontFamily: "'Rajdhani', sans-serif",
            fontSize: '14px', fontWeight: 700, letterSpacing: '0.05em',
          }}
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--xm-bg)', fontFamily: "'Rajdhani', sans-serif",
      color: 'var(--xm-muted)', fontSize: '16px', letterSpacing: '0.05em'
    }}>
      Autenticando…
    </div>
  )
}
