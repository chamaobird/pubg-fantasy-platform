// frontend/src/pages/ResetPasswordPage.jsx
// Tela de redefinicao de senha via token do email

import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { API_BASE_URL } from '../config'

if (!document.getElementById('xama-fonts')) {
  const link = document.createElement('link')
  link.id = 'xama-fonts'; link.rel = 'stylesheet'
  link.href = 'https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=JetBrains+Mono:wght@400;600&display=swap'
  document.head.appendChild(link)
}

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!token) {
      setError('Link invalido. Solicite um novo link de recuperacao.')
    }
  }, [token])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('As senhas nao conferem.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: password }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.detail || `HTTP ${res.status}`)
      setSuccess(true)
      setTimeout(() => navigate('/'), 3000)
    } catch (err) {
      setError(err.message || 'Erro inesperado. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--color-xama-black)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
    }}>
      <div style={{
        width: '100%', maxWidth: '420px',
        background: 'var(--color-xama-surface)',
        border: '1px solid var(--color-xama-border)',
        borderRadius: '16px', overflow: 'hidden',
      }}>
        <div style={{ height: '2px', background: 'linear-gradient(90deg, var(--color-xama-orange), transparent 60%)' }} />
        <div style={{ padding: '32px' }}>

          {/* Header */}
          <div style={{ marginBottom: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔑</div>
            <h2 style={{
              fontSize: '22px', fontWeight: 700, letterSpacing: '0.04em',
              color: 'var(--color-xama-text)', textTransform: 'uppercase', margin: 0,
            }}>
              Nova senha
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--color-xama-muted)', marginTop: '6px' }}>
              Digite e confirme sua nova senha abaixo.
            </p>
          </div>

          {success ? (
            <div style={{
              textAlign: 'center', padding: '24px',
              color: 'var(--color-xama-green)', fontSize: '15px', fontWeight: 600,
            }}>
              ✅ Senha atualizada com sucesso!<br />
              <span style={{ fontSize: '13px', color: 'var(--color-xama-muted)', fontWeight: 400 }}>
                Redirecionando para o login...
              </span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{
                  fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em',
                  textTransform: 'uppercase', color: 'var(--color-xama-muted)',
                  display: 'block', marginBottom: '6px',
                }}>Nova senha</label>
                <input
                  className="dark-input"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  disabled={!token}
                  style={{ fontSize: '15px' }}
                />
              </div>
              <div>
                <label style={{
                  fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em',
                  textTransform: 'uppercase', color: 'var(--color-xama-muted)',
                  display: 'block', marginBottom: '6px',
                }}>Confirmar senha</label>
                <input
                  className="dark-input"
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  disabled={!token}
                  style={{ fontSize: '15px' }}
                />
              </div>

              {error && (
                <div className="msg-error">{error}</div>
              )}

              <button
                type="submit"
                disabled={loading || !token}
                style={{
                  marginTop: '4px', padding: '12px', borderRadius: '8px',
                  fontSize: '15px', fontWeight: 700, letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  cursor: loading || !token ? 'default' : 'pointer',
                  border: 'none', width: '100%',
                  background: loading || !token ? '#1a1f2e' : 'var(--color-xama-orange)',
                  color: loading || !token ? 'var(--color-xama-muted)' : 'var(--color-xama-black)',
                  transition: 'all 0.15s',
                }}
              >
                {loading ? 'Salvando…' : 'Salvar nova senha →'}
              </button>

              <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--color-xama-muted)', margin: 0 }}>
                <span
                  onClick={() => navigate('/')}
                  style={{ color: 'var(--color-xama-orange)', cursor: 'pointer', fontWeight: 700 }}
                >
                  Voltar para o login
                </span>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
