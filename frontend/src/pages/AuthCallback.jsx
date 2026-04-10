// frontend/src/pages/AuthCallback.jsx
// Recebe o token JWT após o redirect do Google OAuth
// Rota: /auth/callback?token=...

import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../App'

export default function AuthCallback() {
  const [searchParams] = useSearchParams()
  const { setToken } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const token = searchParams.get('token')
    if (token) {
      setToken(token)
      navigate('/dashboard', { replace: true })
    } else {
      // Sem token — algo deu errado, volta para landing com erro
      navigate('/?error=oauth', { replace: true })
    }
  }, [])

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
