import React from 'react'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { API_BASE_URL as API_BASE } from '../config'
import Navbar from '../components/Navbar'

if (!document.getElementById('xama-fonts')) {
  const link = document.createElement('link')
  link.id = 'xama-fonts'
  link.rel = 'stylesheet'
  link.href = 'https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=JetBrains+Mono:wght@400;600&display=swap'
  document.head.appendChild(link)
}

const LS = {
  fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em',
  textTransform: 'uppercase', color: 'var(--color-xama-muted)',
  display: 'block', marginBottom: '6px',
}
const IS = {
  width: '100%', padding: '10px 14px', borderRadius: '7px',
  background: '#0a0c11', border: '1px solid var(--color-xama-border, #1e2330)',
  color: 'var(--color-xama-text, #dce1ea)', fontSize: '15px',
  fontFamily: "'Rajdhani', sans-serif", outline: 'none', boxSizing: 'border-box',
}
const IR = { ...IS, color: 'var(--color-xama-muted)', cursor: 'default' }
const CS = {
  background: '#13161d', border: '1px solid var(--color-xama-border, #1e2330)',
  borderRadius: '12px', padding: '24px', marginBottom: '16px',
}
const ST = {
  fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em',
  textTransform: 'uppercase', color: 'var(--color-xama-muted)', marginBottom: '18px',
}
const btnOrange = (disabled) => ({
  padding: '10px 24px', borderRadius: '7px', border: 'none',
  background: disabled ? '#1a1f2e' : 'var(--color-xama-orange, #f97316)',
  color: disabled ? 'var(--color-xama-muted)' : '#fff',
  fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '13px',
  letterSpacing: '0.06em', textTransform: 'uppercase',
  cursor: disabled ? 'default' : 'pointer', transition: 'all 0.15s',
})
const msgS = (type) => ({ fontSize: '12px', marginTop: '6px', color: type === 'ok' ? '#4ade80' : '#f87171' })

export default function Profile() {
  const { token, logout } = useAuth()
  const navigate = useNavigate()
  const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const [user,            setUser]       = useState(null)
  const [username,        setUsername]   = useState('')
  const [usernameMsg,     setUsernameMsg]= useState(null)
  const [savingUser,      setSavingUser] = useState(false)
  const [isGoogle,        setIsGoogle]  = useState(false)

  useEffect(() => {
    fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return
        setUser(d)
        setUsername(d.username || '')
        setIsGoogle(!d.has_password)
      })
      .catch(() => {})
  }, [token])

  useEffect(() => {
    if (!user || username === user.username) { setUsernameMsg(null); return }
    if (username.length < 3) { setUsernameMsg({ type: 'err', text: 'Minimo 3 caracteres' }); return }
    setUsernameMsg({ type: 'ok', text: 'Disponivel' })
  }, [username, user])

  async function saveUsername(e) {
    e.preventDefault()
    setSavingUser(true); setUsernameMsg(null)
    try {
      const r = await fetch(`${API_BASE}/auth/me`, { method: 'PATCH', headers: H, body: JSON.stringify({ username }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.detail || 'Erro ao salvar')
      setUser(d)
      setUsernameMsg({ type: 'ok', text: 'Username atualizado!' })
    } catch (err) { setUsernameMsg({ type: 'err', text: err.message }) }
    finally { setSavingUser(false) }
  }

  const usernameChanged = user && username !== user.username
  const usernameOk = usernameChanged && usernameMsg?.type === 'ok' && username.length >= 3

  const LabelEl = ({ text }) => React.createElement('label', { style: LS }, text)

  return (
    <div style={{ background: 'var(--color-xama-bg, #0d0f14)', color: 'var(--color-xama-text, #dce1ea)', fontFamily: "'Rajdhani', sans-serif", minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '32px 24px' }}>

        <div style={{ fontSize: '24px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>Meu Perfil</div>
        <div style={{ fontSize: '13px', color: 'var(--color-xama-muted)', marginBottom: '32px' }}>Gerencie suas informacoes de conta</div>

        <div style={CS}>
          <div style={ST}>Identidade</div>
          <form onSubmit={saveUsername} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <LabelEl text="Username" />
              <input style={IS} value={username} onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))} maxLength={50} />
              {usernameMsg && <div style={msgS(usernameMsg.type)}>{usernameMsg.text}</div>}
              <div style={{ fontSize: '11px', color: '#2a3046', marginTop: '4px' }}>Aparece no leaderboard. Letras, numeros, _ e -</div>
            </div>
            <div>
              <LabelEl text="E-mail" />
              <input style={IR} value={user?.email || ''} readOnly />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" disabled={savingUser || !usernameOk} style={btnOrange(savingUser || !usernameOk)}>
                {savingUser ? 'Salvando...' : 'Salvar Username'}
              </button>
            </div>
          </form>
        </div>

        <div style={CS}>
          <div style={ST}>Contas Vinculadas</div>
          {[
            { label: 'Google', linked: isGoogle, soon: false },
            { label: 'Twitch', linked: false, soon: true },
            { label: 'Discord', linked: false, soon: true },
            { label: 'Krafton ID', linked: false, soon: true },
          ].map(({ label, linked, soon }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--color-xama-border)' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-xama-text)' }}>{label}</span>
              {linked
                ? <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '20px', background: '#14532d', color: '#4ade80', fontWeight: 600 }}>Vinculado</span>
                : soon
                  ? <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '20px', background: '#1a1f2e', color: 'var(--color-xama-muted)', fontWeight: 600 }}>Em breve</span>
                  : <button style={btnOrange(false)}>Vincular</button>
              }
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: '8px', paddingBottom: '40px' }}>
          <button onClick={() => { logout(); navigate('/') }}
            style={{ padding: '10px 24px', borderRadius: '7px', background: 'transparent', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)', fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '13px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
            Sair da Conta
          </button>
        </div>

      </div>
    </div>
  )
}