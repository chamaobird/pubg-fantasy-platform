// frontend/src/pages/AuthVerified.jsx
import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'

export default function AuthVerified() {
  const navigate = useNavigate()

  useEffect(() => {
    const t = setTimeout(() => navigate('/'), 4000)
    return () => clearTimeout(t)
  }, [navigate])

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0c11',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Rajdhani', sans-serif",
    }}>
      <div style={{
        textAlign: 'center', padding: '48px 40px',
        background: '#0f1219', border: '1px solid rgba(74,222,128,0.2)',
        borderRadius: '16px', maxWidth: '400px',
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#4ade80', marginBottom: '8px' }}>
          Email confirmado!
        </h1>
        <p style={{ fontSize: '15px', color: '#94a3b8', marginBottom: '24px' }}>
          Sua conta está ativa. Redirecionando para o login...
        </p>
        <button
          onClick={() => navigate('/')}
          style={{
            padding: '10px 28px', background: '#f97316', color: '#000',
            border: 'none', borderRadius: '6px', fontWeight: 700,
            fontSize: '15px', cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif",
          }}>
          Ir para o login
        </button>
      </div>
    </div>
  )
}