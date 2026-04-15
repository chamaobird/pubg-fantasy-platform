// frontend/src/pages/SetupUsername.jsx
// Força usuários Google (sem username) a escolherem um apelido antes de entrar no app

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { API_BASE_URL } from '../config'

const MIN = 3
const MAX = 18
const VALID_RE = /^[a-zA-Z0-9_\-.]+$/

export default function SetupUsername() {
  const { token } = useAuth()
  const navigate  = useNavigate()

  const [value,   setValue]   = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const validate = (v) => {
    if (v.length < MIN) return `Mínimo ${MIN} caracteres`
    if (v.length > MAX) return `Máximo ${MAX} caracteres`
    if (!VALID_RE.test(v)) return 'Apenas letras, números, _, - e .'
    return ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const err = validate(value.trim())
    if (err) { setError(err); return }

    setLoading(true); setError('')
    try {
      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ username: value.trim() }),
      })
      if (res.status === 409) { setError('Este username já está em uso.'); return }
      if (!res.ok) { setError('Erro ao salvar. Tente novamente.'); return }
      navigate('/dashboard', { replace: true })
    } catch {
      setError('Falha de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const validationMsg = value ? validate(value.trim()) : ''

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--color-xama-black)',
      padding: '24px',
    }}>
      <div style={{
        width: '100%', maxWidth: '400px',
        background: 'var(--color-xama-surface)',
        border: '1px solid var(--color-xama-border)',
        borderRadius: '16px',
        overflow: 'hidden',
      }}>
        {/* Topo dourado */}
        <div style={{ height: '3px', background: 'linear-gradient(90deg, var(--color-xama-gold) 0%, transparent 60%)' }} />

        <div style={{ padding: '32px 28px' }}>
          {/* Cabeçalho */}
          <div style={{ marginBottom: '28px' }}>
            <p style={{
              fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em',
              color: 'var(--color-xama-orange)', textTransform: 'uppercase',
              fontFamily: "'JetBrains Mono', monospace", marginBottom: '8px',
            }}>
              XAMA Fantasy
            </p>
            <h1 style={{
              fontSize: '24px', fontWeight: 800, letterSpacing: '-0.01em',
              color: 'var(--color-xama-text)', marginBottom: '8px',
            }}>
              Escolha seu username
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--color-xama-muted)', lineHeight: 1.5 }}>
              Seu username é como você aparece no leaderboard.
              Escolha com cuidado — pode ser alterado depois no perfil.
            </p>
          </div>

          {/* Formulário */}
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <input
                type="text"
                value={value}
                onChange={e => { setValue(e.target.value); setError('') }}
                placeholder="ex: sniper_br"
                maxLength={MAX}
                autoFocus
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: '#0d0f14',
                  border: `1px solid ${error ? 'var(--color-xama-red)' : value && !validationMsg ? 'rgba(240,192,64,0.4)' : 'var(--color-xama-border)'}`,
                  borderRadius: '8px',
                  color: 'var(--color-xama-text)',
                  padding: '11px 14px',
                  fontSize: '15px',
                  fontFamily: "'JetBrains Mono', monospace",
                  outline: 'none',
                  transition: 'border-color 0.15s',
                }}
              />
              {/* Feedback inline */}
              <div style={{
                marginTop: '6px', fontSize: '11px', minHeight: '16px',
                fontFamily: "'JetBrains Mono', monospace",
                color: error ? 'var(--color-xama-red)'
                  : value && !validationMsg ? 'var(--color-xama-gold)'
                  : 'var(--color-xama-muted)',
              }}>
                {error || (value && !validationMsg ? '✓ Username disponível para tentar' : `${MIN}–${MAX} caracteres · letras, números, _ - .`)}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !!validationMsg || !value.trim()}
              style={{
                width: '100%',
                background: loading || !!validationMsg || !value.trim()
                  ? 'rgba(240,192,64,0.08)'
                  : 'rgba(240,192,64,0.15)',
                border: `1px solid ${loading || !!validationMsg || !value.trim() ? 'var(--color-xama-border)' : 'rgba(240,192,64,0.5)'}`,
                borderRadius: '8px',
                color: loading || !!validationMsg || !value.trim() ? 'var(--color-xama-muted)' : '#f0c040',
                padding: '12px',
                fontSize: '14px', fontWeight: 700, letterSpacing: '0.04em',
                cursor: loading || !!validationMsg || !value.trim() ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
              }}>
              {loading ? 'Salvando…' : 'Confirmar username'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
