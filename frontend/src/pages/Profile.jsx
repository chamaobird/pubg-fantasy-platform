// frontend/src/pages/Profile.jsx
// XAMA Fantasy — Perfil do usuário
// v2: display_name + Twitch + Krafton ID + Discord

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { API_BASE_URL } from '../config'

const S = {
  label: {
    display: 'block', fontSize: '11px', fontWeight: 700,
    letterSpacing: '0.1em', textTransform: 'uppercase',
    color: 'var(--color-xama-muted)', marginBottom: '6px',
  },
  hint: { fontSize: '11px', color: 'var(--color-xama-muted)', marginTop: '4px' },
  input: {
    width: '100%', background: '#0a0c11',
    border: '1px solid var(--color-xama-border)', borderRadius: '8px',
    padding: '10px 14px', fontSize: '14px', fontWeight: 600,
    color: 'var(--color-xama-text)', fontFamily: "'Rajdhani', sans-serif",
    outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
  },
}

function Field({ label, value, onChange, placeholder, hint, prefix }) {
  return (
    <div>
      <label style={S.label}>{label}</label>
      <div style={{ position: 'relative' }}>
        {prefix && (
          <span style={{
            position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
            fontSize: '13px', color: 'var(--color-xama-muted)', fontFamily: "'JetBrains Mono', monospace",
            pointerEvents: 'none',
          }}>{prefix}</span>
        )}
        <input
          style={{ ...S.input, paddingLeft: prefix ? '28px' : '14px' }}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={100}
          onFocus={e => { e.target.style.borderColor = 'var(--color-xama-orange)' }}
          onBlur={e => { e.target.style.borderColor = 'var(--color-xama-border)' }}
        />
      </div>
      {hint && <p style={S.hint}>{hint}</p>}
    </div>
  )
}

function InfoRow({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
      <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-xama-muted)', minWidth: '90px' }}>{label}</span>
      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-xama-text)', fontFamily: mono ? "'JetBrains Mono', monospace" : "'Rajdhani', sans-serif" }}>{value || '—'}</span>
    </div>
  )
}

export default function Profile() {
  const { token, logout } = useAuth()
  const navigate = useNavigate()

  const [user, setUser] = useState(null)
  const [fields, setFields] = useState({ display_name: '', twitch_username: '', krafton_id: '', discord_username: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) { navigate('/'); return }
    fetch(`${API_BASE_URL}/users/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (r.status === 401) { logout(); navigate('/'); return null } return r.json() })
      .then(data => {
        if (!data) return
        setUser(data)
        setFields({
          display_name: data.display_name || '',
          twitch_username: data.twitch_username || '',
          krafton_id: data.krafton_id || '',
          discord_username: data.discord_username || '',
        })
        setLoading(false)
      })
      .catch(e => { setError('Erro ao carregar perfil: ' + e.message); setLoading(false) })
  }, [token]) // eslint-disable-line

  const set = field => val => setFields(f => ({ ...f, [field]: val }))

  const handleSave = async () => {
    setSaving(true); setError(''); setSuccess(false)
    try {
      const r = await fetch(`${API_BASE_URL}/users/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(fields),
      })
      if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b.detail || `HTTP ${r.status}`) }
      const updated = await r.json()
      setUser(updated)
      setFields({
        display_name: updated.display_name || '',
        twitch_username: updated.twitch_username || '',
        krafton_id: updated.krafton_id || '',
        discord_username: updated.discord_username || '',
      })
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (e) { setError('Erro ao salvar: ' + e.message) }
    finally { setSaving(false) }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--color-xama-black)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Rajdhani', sans-serif", color: 'var(--color-xama-muted)', fontSize: '14px' }}>
      Carregando perfil…
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-xama-black)', fontFamily: "'Rajdhani', sans-serif", display: 'flex', flexDirection: 'column' }}>

      {/* Navbar */}
      <header style={{ background: 'var(--color-xama-surface)', borderBottom: '1px solid var(--color-xama-border)', flexShrink: 0 }}>
        <div style={{ height: '2px', background: 'linear-gradient(90deg, var(--color-xama-orange), transparent 50%)' }} />
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', height: '56px', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => navigate('/tournaments')}>
            <div style={{ width: '30px', height: '30px', fontSize: '15px', background: 'linear-gradient(135deg, rgba(249,115,22,0.25), rgba(249,115,22,0.05))', border: '1px solid rgba(249,115,22,0.3)', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🔥</div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-xama-text)', letterSpacing: '0.06em', lineHeight: 1 }}>XAMA</div>
              <div style={{ fontSize: '8px', color: 'var(--color-xama-orange)', letterSpacing: '0.14em', textTransform: 'uppercase', lineHeight: 1 }}>Fantasy</div>
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: '1px solid var(--color-xama-border)', borderRadius: '6px', padding: '5px 12px', fontSize: '11px', fontWeight: 600, color: 'var(--color-xama-muted)', cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif" }}>← Voltar</button>
          <button onClick={logout} style={{ background: 'none', border: '1px solid var(--color-xama-border)', borderRadius: '6px', padding: '5px 12px', fontSize: '11px', fontWeight: 600, color: 'var(--color-xama-muted)', cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif" }}>Sair</button>
        </div>
      </header>

      {/* Conteúdo */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '48px 24px' }}>
        <div style={{ width: '100%', maxWidth: '520px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Título */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <span style={{ fontSize: '24px' }}>👤</span>
              <h1 style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '0.04em', color: 'var(--color-xama-text)', textTransform: 'uppercase', margin: 0 }}>Meu Perfil</h1>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--color-xama-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Personalize como você aparece na plataforma</p>
          </div>

          {/* Card — Info fixa */}
          <div style={{ background: 'var(--color-xama-surface)', border: '1px solid var(--color-xama-border)', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ height: '2px', background: 'linear-gradient(90deg, var(--color-xama-orange), transparent 60%)' }} />
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-xama-muted)', margin: 0 }}>Conta</p>
              <InfoRow label="Username" value={`@${user?.username}`} mono />
              <InfoRow label="Email" value={user?.email} />
            </div>
          </div>

          {/* Card — Campos editáveis */}
          <div style={{ background: 'var(--color-xama-surface)', border: '1px solid var(--color-xama-border)', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ height: '2px', background: 'linear-gradient(90deg, var(--color-xama-orange), transparent 60%)' }} />
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-xama-muted)', margin: 0 }}>Identidade no Leaderboard</p>

              <Field
                label="Nome de exibição"
                value={fields.display_name}
                onChange={set('display_name')}
                placeholder={user?.username}
                hint="Aparece no leaderboard. Deixe vazio para usar o username."
              />

              <div style={{ height: '1px', background: 'var(--color-xama-border)' }} />
              <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-xama-muted)', margin: 0 }}>Redes Sociais / IDs</p>

              <Field
                label="Twitch"
                value={fields.twitch_username}
                onChange={set('twitch_username')}
                placeholder="seu_canal"
                hint="Seu username no Twitch (sem o @)"
                prefix="twitch.tv/"
              />

              <Field
                label="Krafton ID"
                value={fields.krafton_id}
                onChange={set('krafton_id')}
                placeholder="SeuNick#1234"
                hint="ID da sua conta Krafton / PUBG"
              />

              <Field
                label="Discord"
                value={fields.discord_username}
                onChange={set('discord_username')}
                placeholder="seunick"
                hint="Seu username no Discord (sem o @)"
                prefix="@"
              />

              {/* Feedback */}
              {error && (
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', padding: '10px 14px', fontSize: '13px', color: '#ef4444' }}>{error}</div>
              )}
              {success && (
                <div style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: '6px', padding: '10px 14px', fontSize: '13px', color: '#34d399' }}>✓ Perfil salvo com sucesso!</div>
              )}

              <button
                onClick={handleSave}
                disabled={saving}
                style={{ padding: '11px', background: saving ? 'rgba(249,115,22,0.4)' : 'var(--color-xama-orange)', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: "'Rajdhani', sans-serif" }}
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
