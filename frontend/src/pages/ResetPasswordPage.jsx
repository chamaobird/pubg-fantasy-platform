// frontend/src/pages/ResetPasswordPage.jsx
// Tela de redefinicao de senha via token do email

import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { API_BASE_URL } from '../config'
import { DashIcon } from '../components/DashIcon'

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
    <div className="xm-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div className="xm-card xm-card--glass" style={{ width: '100%', maxWidth: '420px', borderRadius: '16px', overflow: 'hidden' }}>
        <div style={{ height: '2px', background: 'linear-gradient(90deg, var(--xm-orange), transparent 60%)' }} />
        <div style={{ padding: '32px' }}>

          {/* Header */}
          <div style={{ marginBottom: '24px', textAlign: 'center' }}>
            <div style={{ marginBottom: '8px', color: 'var(--xm-muted)' }}>
              <DashIcon name="lock" size={32} />
            </div>
            <h2 style={{
              fontSize: '22px', fontWeight: 700, letterSpacing: '0.04em',
              color: 'var(--xm-text)', textTransform: 'uppercase', margin: 0,
            }}>
              Nova senha
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--xm-muted)', marginTop: '6px' }}>
              Digite e confirme sua nova senha abaixo.
            </p>
          </div>

          {success ? (
            <p className="xm-msg xm-msg--ok" style={{ textAlign: 'center' }}>
              Senha atualizada com sucesso!<br />
              <span style={{ fontSize: '13px', fontWeight: 400 }}>
                Redirecionando para o login...
              </span>
            </p>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="xm-label">Nova senha</label>
                <input
                  className="xm-input"
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
                <label className="xm-label">Confirmar senha</label>
                <input
                  className="xm-input"
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
                <p className="xm-msg xm-msg--err">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !token}
                className="xm-btn xm-btn--primary xm-btn--full"
                style={{ marginTop: '4px' }}
              >
                {loading ? 'Salvando…' : 'Salvar nova senha →'}
              </button>

              <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--xm-muted)', margin: 0 }}>
                <span
                  onClick={() => navigate('/')}
                  style={{ color: 'var(--xm-orange)', cursor: 'pointer', fontWeight: 700 }}
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
