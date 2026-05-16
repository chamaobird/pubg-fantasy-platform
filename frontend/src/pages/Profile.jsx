import React from 'react'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { API_BASE_URL as API_BASE } from '../config'
import Navbar from '../components/Navbar'

export default function Profile() {
  const { token, logout } = useAuth()
  const navigate = useNavigate()
  const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const [user, setUser] = useState(null)
  const [username, setUsername] = useState('')
  const [usernameMsg, setUsernameMsg] = useState(null)
  const [savingUser, setSavingUser] = useState(false)
  const [history, setHistory] = useState([])
  const [achievements, setAchievements] = useState([])
  const [allAchievements, setAllAchievements] = useState([])

  useEffect(() => {
    fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        if (r.status === 401) { window.dispatchEvent(new Event('auth:session-expired')); return null }
        return r.ok ? r.json() : null
      })
      .then(d => {
        if (!d) return
        setUser(d)
        setUsername(d.username || '')
        Promise.all([
          fetch(`${API_BASE}/profile/${d.id}/history`).then(r => r.ok ? r.json() : []),
          fetch(`${API_BASE}/achievements/me`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : []),
          fetch(`${API_BASE}/achievements/definitions`).then(r => r.ok ? r.json() : []),
        ]).then(([hist, ach, defs]) => {
          setHistory(Array.isArray(hist) ? hist : [])
          setAchievements(Array.isArray(ach) ? ach : [])
          setAllAchievements(Array.isArray(defs) ? defs : [])
        }).catch(() => {})
      })
      .catch(() => {})
  }, [token])

  useEffect(() => {
    if (!user) return
    if (username === (user.username || '')) { setUsernameMsg(null); return }
    if (username.length === 0) { setUsernameMsg(null); return }
    if (username.length < 3) {
      setUsernameMsg({ type: 'err', text: 'Minimo 3 caracteres' })
      return
    }
    setUsernameMsg(null)
  }, [username, user])

  async function saveUsername(e) {
    e.preventDefault()
    setSavingUser(true); setUsernameMsg(null)
    try {
      const r = await fetch(`${API_BASE}/auth/me`, {
        method: 'PATCH', headers: H,
        body: JSON.stringify({ username })
      })
      const d = await r.json()
      if (!r.ok) {
        const msg = d?.detail || 'Erro ao salvar'
        if (msg.includes('already taken') || msg.includes('ja em uso') || msg.includes('já em uso')) {
          setUsernameMsg({ type: 'err', text: 'Username ja em uso. Escolha outro.' })
        } else {
          setUsernameMsg({ type: 'err', text: msg })
        }
        return
      }
      setUser(d)
      setUsername(d.username || '')
      setUsernameMsg({ type: 'ok', text: 'Username atualizado!' })
    } catch (err) {
      setUsernameMsg({ type: 'err', text: err.message })
    } finally { setSavingUser(false) }
  }

  const usernameChanged = user && username !== (user.username || '')
  const usernameValid = username.length >= 3
  const canSave = usernameChanged && usernameValid && !savingUser && usernameMsg?.type !== 'err'
  const isGoogle = user ? !user.has_password : false

  const ACCOUNTS = [
    { label: 'Google', linked: isGoogle, soon: false },
    { label: 'Twitch', linked: false, soon: true },
    { label: 'Discord', linked: false, soon: true },
    { label: 'Krafton ID', linked: false, soon: true },
  ]

  return (
    <div className="xm-page">
      <Navbar />
      <div className="xm-page__container xm-page__container--sm">

        <header className="xm-profile-hero">
          <div className="xm-avatar">
            {(user?.username || '?').slice(0, 2)}
          </div>
          <div className="xm-profile-hero__body">
            <h1 className="xm-profile-hero__name">
              {user?.username || 'Carregando...'}
              {isGoogle && <span className="xm-pill xm-pill--linked">Google</span>}
            </h1>
            <div className="xm-profile-hero__meta">
              <span>{user?.email}</span>
              {achievements.length > 0 && <span>{achievements.length} conquistas</span>}
            </div>
          </div>
        </header>

        <section className="xm-card xm-card--glass">
          <h2 className="xm-card__title">Identidade</h2>
          <form onSubmit={saveUsername}>
            <div className="xm-field">
              <label className="xm-label" htmlFor="username">Username</label>
              <input
                id="username"
                className="xm-input"
                value={username}
                onChange={e => { setUsername(e.target.value.replace(/[^a-zA-Z0-9_-]/g, '')); setUsernameMsg(null) }}
                maxLength={50}
                placeholder="seu_nick"
              />
              {usernameMsg && (
                <p className={`xm-msg xm-msg--${usernameMsg.type === 'ok' ? 'ok' : 'err'}`}>
                  {usernameMsg.text}
                </p>
              )}
              <p className="xm-field__hint">Aparece no leaderboard. Letras, números, _ e -</p>
            </div>

            <div className="xm-field">
              <label className="xm-label" htmlFor="email">E-mail</label>
              <input id="email" className="xm-input" value={user?.email || ''} readOnly />
              {isGoogle && (
                <p className="xm-field__hint">Conta vinculada ao Google — email gerenciado pelo Google</p>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
              <button type="submit" className="xm-btn xm-btn--primary xm-btn--lg" disabled={!canSave}>
                {savingUser ? 'Salvando...' : 'Salvar Username'}
              </button>
            </div>
          </form>
        </section>

        <section className="xm-card xm-card--glass">
          <h2 className="xm-card__title">Contas Vinculadas</h2>
          {ACCOUNTS.map(({ label, linked, soon }) => (
            <div key={label} className="xm-row">
              <span className="xm-row__title">{label}</span>
              {linked ? (
                <span className="xm-pill xm-pill--linked">Vinculado</span>
              ) : soon ? (
                <span className="xm-pill xm-pill--soon">Em breve</span>
              ) : (
                <button className="xm-btn xm-btn--primary xm-btn--sm">Vincular</button>
              )}
            </div>
          ))}
        </section>

        <section className="xm-card xm-card--glass">
          <h2 className="xm-card__title">Conquistas</h2>
          {allAchievements.length === 0 ? (
            <p className="xm-empty__body">Carregando...</p>
          ) : (
            <div className="xm-achievement-grid">
              {allAchievements.map(def => {
                const unlocked = achievements.find(a => a.key === def.key)
                return (
                  <div
                    key={def.key}
                    className={`xm-achievement ${unlocked ? 'xm-achievement--unlocked' : ''}`}
                  >
                    <span className="xm-achievement__icon">{def.icon}</span>
                    <span className="xm-achievement__name">{def.name}</span>
                    {unlocked && (
                      <span className="xm-achievement__date">
                        {new Date(unlocked.unlocked_at).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          {achievements.length > 0 && (
            <p className="xm-field__hint" style={{ marginTop: 14 }}>
              {achievements.length} de {allAchievements.length} conquistadas
            </p>
          )}
        </section>

        {history.length > 0 && (
          <section className="xm-card xm-card--glass">
            <h2 className="xm-card__title">Histórico de Temporadas</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {history.map(entry => (
                <div key={entry.stage_id} className="xm-row" style={{ borderBottom: 'none', padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--xm-border)', borderRadius: 8 }}>
                  <div className="xm-row__main">
                    <div className="xm-row__title">{entry.championship_name}</div>
                    <div className="xm-row__meta">
                      {entry.stage_name} · {entry.days_played} {entry.days_played === 1 ? 'dia' : 'dias'}
                    </div>
                  </div>
                  <div className="xm-row__right">
                    {entry.rank ? (
                      <span className={`xm-pill ${entry.rank <= 3 ? 'xm-pill--rank-gold' : 'xm-pill--soon'}`}>
                        #{entry.rank}
                      </span>
                    ) : (
                      <span className="xm-stat__hint">—</span>
                    )}
                    <span className="xm-stat__hint" style={{ marginLeft: 4 }}>
                      {entry.total_points.toFixed(2)} pts
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <div style={{ textAlign: 'center', marginTop: 8, paddingBottom: 40 }}>
          <button
            className="xm-btn xm-btn--danger xm-btn--lg"
            onClick={() => { logout(); navigate('/') }}
          >
            Sair da Conta
          </button>
        </div>

      </div>
    </div>
  )
}
