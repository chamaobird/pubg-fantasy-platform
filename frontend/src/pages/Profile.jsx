// frontend/src/pages/Profile.jsx
// XAMA Fantasy — Página de perfil básica
// Permite ao usuário definir/atualizar o display_name

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { API_BASE_URL } from '../config'

export default function Profile() {
  const { token, logout } = useAuth()
  const navigate = useNavigate()

  const [user, setUser] = useState(null)
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  // ── Carrega dados do usuário logado ─────────────────────────────────────
  useEffect(() => {
    if (!token) { navigate('/'); return }
    fetch(`${API_BASE_URL}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (r.status === 401) { logout(); navigate('/'); return null }
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data) => {
        if (!data) return
        setUser(data)
        setDisplayName(data.display_name || '')
        setLoading(false)
      })
      .catch((e) => {
        setError('Erro ao carregar perfil: ' + e.message)
        setLoading(false)
      })
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Salva display_name ───────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSuccess(false)
    try {
      const r = await fetch(`${API_BASE_URL}/users/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ display_name: displayName }),
      })
      if (!r.ok) {
        const body = await r.json().catch(() => ({}))
        throw new Error(body.detail || `HTTP ${r.status}`)
      }
      const updated = await r.json()
      setUser(updated)
      setDisplayName(updated.display_name || '')
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (e) {
      setError('Erro ao salvar: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  // ──────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--color-xama-black)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'Rajdhani', sans-serif",
          color: 'var(--color-xama-muted)',
          fontSize: '14px',
        }}
      >
        Carregando perfil…
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--color-xama-black)',
        fontFamily: "'Rajdhani', sans-serif",
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── Navbar mínima ───────────────────────────────────────────────── */}
      <header
        style={{
          background: 'var(--color-xama-surface)',
          borderBottom: '1px solid var(--color-xama-border)',
          flexShrink: 0,
        }}
      >
        <div style={{ height: '2px', background: 'linear-gradient(90deg, var(--color-xama-orange), transparent 50%)' }} />
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            height: '56px',
            gap: '16px',
          }}
        >
          {/* Logo */}
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
            onClick={() => navigate('/tournaments')}
          >
            <div
              style={{
                width: '30px', height: '30px', fontSize: '15px',
                background: 'linear-gradient(135deg, rgba(249,115,22,0.25), rgba(249,115,22,0.05))',
                border: '1px solid rgba(249,115,22,0.3)', borderRadius: '7px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >🔥</div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-xama-text)', letterSpacing: '0.06em', lineHeight: 1 }}>XAMA</div>
              <div style={{ fontSize: '8px', color: 'var(--color-xama-orange)', letterSpacing: '0.14em', textTransform: 'uppercase', lineHeight: 1 }}>Fantasy</div>
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'none', border: '1px solid var(--color-xama-border)', borderRadius: '6px',
              padding: '5px 12px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em',
              color: 'var(--color-xama-muted)', cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif",
            }}
          >
            ← Voltar
          </button>
          <button
            onClick={logout}
            style={{
              background: 'none', border: '1px solid var(--color-xama-border)', borderRadius: '6px',
              padding: '5px 12px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em',
              color: 'var(--color-xama-muted)', cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif",
            }}
          >
            Sair
          </button>
        </div>
      </header>

      {/* ── Conteúdo ────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '48px 24px' }}>
        <div style={{ width: '100%', maxWidth: '480px' }}>

          {/* Título */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <span style={{ fontSize: '24px' }}>👤</span>
              <h1
                style={{
                  fontSize: '26px', fontWeight: 800, letterSpacing: '0.04em',
                  color: 'var(--color-xama-text)', textTransform: 'uppercase', margin: 0,
                }}
              >
                Meu Perfil
              </h1>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--color-xama-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Personalize como você aparece no leaderboard
            </p>
          </div>

          {/* Card */}
          <div
            style={{
              background: 'var(--color-xama-surface)',
              border: '1px solid var(--color-xama-border)',
              borderRadius: '12px',
              overflow: 'hidden',
            }}
          >
            {/* accent line */}
            <div style={{ height: '2px', background: 'linear-gradient(90deg, var(--color-xama-orange), transparent 60%)' }} />

            <div style={{ padding: '24px' }}>
              {/* Info fixa */}
              <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <InfoRow label="Username" value={`@${user?.username}`} mono />
                <InfoRow label="Email" value={user?.email} />
              </div>

              <div
                style={{
                  height: '1px',
                  background: 'var(--color-xama-border)',
                  marginBottom: '24px',
                }}
              />

              {/* Display Name */}
              <div style={{ marginBottom: '20px' }}>
                <label
                  style={{
                    display: 'block', fontSize: '11px', fontWeight: 700,
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    color: 'var(--color-xama-muted)', marginBottom: '8px',
                  }}
                >
                  Nome de exibição
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={`Ex: ${user?.username}`}
                  maxLength={100}
                  style={{
                    width: '100%',
                    background: '#0a0c11',
                    border: '1px solid var(--color-xama-border)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: 'var(--color-xama-text)',
                    fontFamily: "'Rajdhani', sans-serif",
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--color-xama-orange)' }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--color-xama-border)' }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
                />
                <p style={{ fontSize: '11px', color: 'var(--color-xama-muted)', marginTop: '6px' }}>
                  Este nome aparecerá no leaderboard no lugar do seu username.
                  Deixe vazio para usar o username.
                </p>
              </div>

              {/* Feedback */}
              {error && (
                <div
                  style={{
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: '6px',
                    padding: '10px 14px',
                    fontSize: '13px',
                    color: '#ef4444',
                    marginBottom: '16px',
                  }}
                >
                  {error}
                </div>
              )}
              {success && (
                <div
                  style={{
                    background: 'rgba(52,211,153,0.08)',
                    border: '1px solid rgba(52,211,153,0.3)',
                    borderRadius: '6px',
                    padding: '10px 14px',
                    fontSize: '13px',
                    color: '#34d399',
                    marginBottom: '16px',
                  }}
                >
                  ✓ Perfil salvo com sucesso!
                </div>
              )}

              {/* Botão salvar */}
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  width: '100%',
                  padding: '11px',
                  background: saving ? 'rgba(249,115,22,0.4)' : 'var(--color-xama-orange)',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#fff',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontFamily: "'Rajdhani', sans-serif",
                  transition: 'opacity 0.15s',
                }}
              >
                {saving ? 'Salvando…' : 'Salvar Perfil'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Sub-componente ─────────────────────────────────────────────────────────
function InfoRow({ label, value, mono = false }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
      <span
        style={{
          fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: 'var(--color-xama-muted)',
          minWidth: '80px',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: '14px', fontWeight: 600,
          color: 'var(--color-xama-text)',
          fontFamily: mono ? "'JetBrains Mono', monospace" : "'Rajdhani', sans-serif",
        }}
      >
        {value || '—'}
      </span>
    </div>
  )
}
