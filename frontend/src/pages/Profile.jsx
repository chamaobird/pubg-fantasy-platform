// frontend/src/pages/Profile.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { API_BASE_URL as API_BASE } from '../config'

if (!document.getElementById('xama-fonts')) {
  const link = document.createElement('link')
  link.id = 'xama-fonts'; link.rel = 'stylesheet'
  link.href = 'https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=JetBrains+Mono:wght@400;600&display=swap'
  document.head.appendChild(link)
}

const labelStyle = {
  fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em',
  textTransform: 'uppercase', color: 'var(--color-xama-muted)',
  display: 'block', marginBottom: '6px',
}
const inputStyle = {
  width: '100%', padding: '10px 14px', borderRadius: '7px',
  background: '#0a0c11', border: '1px solid var(--color-xama-border, #1e2330)',
  color: 'var(--color-xama-text, #dce1ea)', fontSize: '15px',
  fontFamily: "'Rajdhani', sans-serif", outline: 'none', boxSizing: 'border-box',
}
const inputReadonly = { ...inputStyle, color: 'var(--color-xama-muted)', cursor: 'default' }
const btnPrimary = (disabled) => ({
  padding: '10px 24px', borderRadius: '7px', border: 'none',
  background: disabled ? '#1a1f2e' : 'var(--color-xama-orange, #f97316)',
  color: disabled ? 'var(--color-xama-muted)' : '#fff',
  fontFamily: "'Rajdhani', sans-serif", fontWeight: 700,
  fontSize: '13px', letterSpacing: '0.06em', textTransform: 'uppercase',
  cursor: disabled ? 'default' : 'pointer', transition: 'all 0.15s',
})
const card = {
  background: '#13161d',
  border: '1px solid var(--color-xama-border, #1e2330)',
  borderRadius: '12px', padding: '24px', marginBottom: '16px',
}
const sectionTitle = {
  fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em',
  textTransform: 'uppercase', color: 'var(--color-xama-muted)',
  marginBottom: '18px',
}

export default function Profile() {
  const { token, logout } = useAuth()
  const navigate = useNavigate()
  const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const [user, setUser] = useState(null)

  // Username
  const [username, setUsername]     = useState('')
  const [usernameMsg, setUsernameMsg] = useState(null) // { type: 'ok'|'err', text }
  const [checkingUser, setChecking] = useState(false)
  const [savingUser, setSavingUser] = useState(false)

  // Senha
  const [isGoogleAccount, setIsGoogle] = useState(false)
  const [currPwd, setCurrPwd]   = useState('')
  const [newPwd, setNewPwd]     = useState('')
  const [pwdMsg, setPwdMsg]     = useState(null)
  const [savingPwd, setSavingPwd] = useState(false)

  useEffect(() => {
    fetch(`${API_BASE}/users/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return
        setUser(d)
        setUsername(d.username || '')
        // Conta Google: hashed_password tem 64 chars (secrets.token_hex(32))
        setIsGoogle(!d.has_password)
      })
      .catch(() => {})
  }, [token])

  // Verifica disponibilidade do username com debounce
  useEffect(() => {
    if (!user || username === user.username) { setUsernameMsg(null); return }
    if (username.length < 3) { setUsernameMsg({ type: 'err', text: 'Mínimo 3 caracteres' }); return }
    setChecking(true)
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`${API_BASE}/users/check-username/${encodeURIComponent(username)}`)
        const d = await r.json()
        setUsernameMsg(d.available
          ? { type: 'ok', text: '✓ Disponível' }
          : { type: 'err', text: '✗ Já em uso' }
        )
      } catch { setUsernameMsg(null) }
      finally { setChecking(false) }
    }, 500)
    return () => clearTimeout(t)
  }, [username, user])

  async function saveUsername(e) {
    e.preventDefault()
    setSavingUser(true); setUsernameMsg(null)
    try {
      const r = await fetch(`${API_BASE}/users/me`, {
        method: 'PATCH', headers: H,
        body: JSON.stringify({ username }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.detail || `HTTP ${r.status}`)
      setUser(d)
      setUsernameMsg({ type: 'ok', text: '✓ Username atualizado!' })
    } catch (err) {
      setUsernameMsg({ type: 'err', text: err.message })
    } finally { setSavingUser(false) }
  }

  async function savePassword(e) {
    e.preventDefault()
    setSavingPwd(true); setPwdMsg(null)
    try {
      const r = await fetch(`${API_BASE}/users/me/change-password`, {
        method: 'POST', headers: H,
        body: JSON.stringify({ current_password: currPwd, new_password: newPwd }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.detail || `HTTP ${r.status}`)
      setPwdMsg({ type: 'ok', text: '✓ Senha alterada com sucesso!' })
      setCurrPwd(''); setNewPwd('')
    } catch (err) {
      setPwdMsg({ type: 'err', text: err.message })
    } finally { setSavingPwd(false) }
  }

  const usernameChanged = user && username !== user.username
  const usernameOk = usernameChanged && usernameMsg?.type === 'ok' && username.length >= 3

  const S = {
    page: {
      minHeight: '100vh', background: 'var(--color-xama-bg, #0d0f14)',
      color: 'var(--color-xama-text, #dce1ea)', fontFamily: "'Rajdhani', sans-serif",
      padding: '40px 24px',
    },
    inner: { maxWidth: '560px', margin: '0 auto' },
    header: { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' },
    title: { fontSize: '24px', fontWeight: 700, color: '#fff', letterSpacing: '0.04em' },
    sub: { fontSize: '13px', color: 'var(--color-xama-muted)', marginTop: '2px' },
    backBtn: {
      padding: '7px 14px', borderRadius: '7px', border: '1px solid var(--color-xama-border)',
      background: 'transparent', color: 'var(--color-xama-muted)',
      fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: '13px',
      cursor: 'pointer', marginBottom: '24px',
    },
    msg: (type) => ({
      fontSize: '12px', marginTop: '6px',
      color: type === 'ok' ? '#4ade80' : '#f87171',
    }),
    vinculadoTag: {
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      fontSize: '12px', padding: '4px 10px', borderRadius: '20px',
      background: '#14532d', color: '#4ade80', fontWeight: 600,
    },
    futureTag: {
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      fontSize: '12px', padding: '4px 10px', borderRadius: '20px',
      background: '#1a1f2e', color: 'var(--color-xama-muted)', fontWeight: 600,
    },
    linkedRow: {
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '12px 0', borderBottom: '1px solid var(--color-xama-border)',
    },
    linkedLabel: { fontSize: '14px', fontWeight: 600, color: 'var(--color-xama-text)' },
  }

  return (
    <div style={S.page}>
      <div style={S.inner}>

        {/* Voltar */}
        <button style={S.backBtn} onClick={() => navigate('/dashboard')}>
          ← Voltar ao Dashboard
        </button>

        {/* Título */}
        <div style={S.header}>
          <div>
            <div style={S.title}>👤 Meu Perfil</div>
            <div style={S.sub}>Gerencie suas informações de conta</div>
          </div>
        </div>

        {/* ── Identidade ── */}
        <div style={card}>
          <div style={sectionTitle}>Identidade</div>
          <form onSubmit={saveUsername} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={labelStyle}>Username</label>
              <input
                style={inputStyle}
                value={username}
                onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9_\-]/g, ''))}
                maxLength={50}
              />
              {checkingUser && <div style={S.msg('ok')}>Verificando...</div>}
              {usernameMsg && <div style={S.msg(usernameMsg.type)}>{usernameMsg.text}</div>}
              <div style={{ fontSize: '11px', color: '#2a3046', marginTop: '4px' }}>
                Aparece no leaderboard · Letras, números, _ e -
              </div>
            </div>
            <div>
              <label style={labelStyle}>E-mail</label>
              <input style={inputReadonly} value={user?.email || ''} readOnly />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                disabled={savingUser || !usernameOk}
                style={btnPrimary(savingUser || !usernameOk)}
              >
                {savingUser ? 'Salvando...' : 'Salvar Username'}
              </button>
            </div>
          </form>
        </div>

        {/* ── Segurança ── */}
        {!isGoogleAccount && (
          <div style={card}>
            <div style={sectionTitle}>Segurança</div>
            <form onSubmit={savePassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Senha Atual</label>
                <input style={inputStyle} type="password" value={currPwd}
                  onChange={e => setCurrPwd(e.target.value)} required />
              </div>
              <div>
                <label style={labelStyle}>Nova Senha</label>
                <input style={inputStyle} type="password" value={newPwd}
                  onChange={e => setNewPwd(e.target.value)} required minLength={6} />
              </div>
              {pwdMsg && <div style={S.msg(pwdMsg.type)}>{pwdMsg.text}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" disabled={savingPwd || !currPwd || !newPwd}
                  style={btnPrimary(savingPwd || !currPwd || !newPwd)}>
                  {savingPwd ? 'Salvando...' : 'Alterar Senha'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Contas Vinculadas ── */}
        <div style={card}>
          <div style={sectionTitle}>Contas Vinculadas</div>
          {[
            { label: '🔵 Google', linked: isGoogleAccount },
            { label: '🟣 Twitch', linked: false, soon: true },
            { label: '🔵 Discord', linked: false, soon: true },
            { label: '⚫ Krafton ID', linked: false, soon: true },
          ].map(({ label, linked, soon }) => (
            <div key={label} style={S.linkedRow}>
              <span style={S.linkedLabel}>{label}</span>
              {linked
                ? <span style={S.vinculadoTag}>✓ Vinculado</span>
                : soon
                  ? <span style={S.futureTag}>Em breve</span>
                  : <button style={btnPrimary(false)}>Vincular</button>
              }
            </div>
          ))}
        </div>

        {/* ── Sair ── */}
        <div style={{ textAlign: 'center', marginTop: '8px' }}>
          <button
            style={{ ...btnPrimary(false), background: 'transparent', color: '#f87171', border: '1px solid #f8717133' }}
            onClick={() => { logout(); navigate('/') }}
          >
            Sair da Conta
          </button>
        </div>

      </div>
    </div>
  )
}
