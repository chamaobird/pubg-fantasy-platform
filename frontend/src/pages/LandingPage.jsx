// frontend/src/pages/LandingPage.jsx
// XAMA Fantasy — Landing + Auth
// v3: Google login exige escolha de username para novos usuários

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { API_BASE_URL } from '../config'
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google'

const GOOGLE_CLIENT_ID = '697343070083-p1aunrkhcnjrq8qafqc1iice7g6in262.apps.googleusercontent.com'

if (!document.getElementById('xama-fonts')) {
  const link = document.createElement('link')
  link.id = 'xama-fonts'; link.rel = 'stylesheet'
  link.href = 'https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=JetBrains+Mono:wght@400;600&display=swap'
  document.head.appendChild(link)
}

function parseError(err) {
  if (typeof err === 'string') return err
  if (err?.message) return err.message
  return 'Erro inesperado'
}

const labelStyle = {
  fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em',
  textTransform: 'uppercase', color: 'var(--color-xama-muted)',
  display: 'block', marginBottom: '6px',
}

const btnStyle = (disabled) => ({
  marginTop: '4px', padding: '12px', borderRadius: '8px',
  fontSize: '15px', fontWeight: 700, letterSpacing: '0.06em',
  textTransform: 'uppercase', fontFamily: "'Rajdhani', sans-serif",
  cursor: disabled ? 'default' : 'pointer', border: 'none', width: '100%',
  background: disabled ? '#1a1f2e' : 'var(--color-xama-orange)',
  color: disabled ? 'var(--color-xama-muted)' : '#0d0f14',
  transition: 'all 0.15s',
})

// ── Tela de escolha de username (novos usuários Google) ───────────────────────
function ChooseUsernameForm({ tempEmail, onSuccess }) {
  const [username, setUsername] = useState('')
  const [available, setAvailable] = useState(null)
  const [checking, setChecking] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (username.length < 3) { setAvailable(null); return }
    setChecking(true)
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/users/check-username/${encodeURIComponent(username)}`)
        const data = await r.json()
        setAvailable(data.available)
      } catch { setAvailable(null) }
      finally { setChecking(false) }
    }, 500)
    return () => clearTimeout(timer)
  }, [username])

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const r = await fetch(`${API_BASE_URL}/users/complete-google-signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ temp_email: tempEmail, username }),
      })
      const data = await r.json().catch(() => null)
      if (!r.ok) throw new Error(data?.detail || `HTTP ${r.status}`)
      if (!data?.access_token) throw new Error('Sem token na resposta')
      onSuccess(data.access_token)
    } catch (err) { setError(parseError(err)) }
    finally { setLoading(false) }
  }

  const usernameOk = available === true && username.length >= 3

  return (
    <div style={{ background: 'var(--color-xama-surface)', border: '1px solid var(--color-xama-border)', borderRadius: '16px', overflow: 'hidden' }}>
      <div style={{ height: '2px', background: 'linear-gradient(90deg, var(--color-xama-orange), transparent 60%)' }} />
      <div style={{ padding: '32px' }}>
        <div style={{ marginBottom: '24px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎮</div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--color-xama-text)', textTransform: 'uppercase', margin: 0 }}>
            Escolha seu username
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--color-xama-muted)', marginTop: '6px' }}>
            Este nome aparecerá no leaderboard. Você só escolhe uma vez.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Username</label>
            <div style={{ position: 'relative' }}>
              <input
                className="dark-input"
                type="text"
                value={username}
                onChange={e => {
                  setUsername(e.target.value.replace(/[^a-zA-Z0-9_\-]/g, ''))
                  setAvailable(null); setError('')
                }}
                placeholder="seu_nick"
                required minLength={3} maxLength={50}
                style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '15px', paddingRight: '36px' }}
              />
              {username.length >= 3 && (
                <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px' }}>
                  {checking ? '⏳' : available === true ? '✅' : available === false ? '❌' : ''}
                </span>
              )}
            </div>
            {username.length >= 3 && !checking && available !== null && (
              <p style={{ fontSize: '11px', marginTop: '4px', color: available ? '#34d399' : '#ef4444' }}>
                {available ? '✓ Username disponível' : '✗ Username já em uso'}
              </p>
            )}
            {username.length > 0 && username.length < 3 && (
              <p style={{ fontSize: '11px', marginTop: '4px', color: 'var(--color-xama-muted)' }}>Mínimo 3 caracteres</p>
            )}
            <p style={{ fontSize: '10px', marginTop: '4px', color: '#2a3046' }}>Letras, números, _ e - · Máx. 50 chars</p>
          </div>

          {error && <div className="msg-error">{error}</div>}

          <button type="submit" disabled={loading || !usernameOk} style={btnStyle(loading || !usernameOk)}>
            {loading ? 'Criando conta…' : 'Entrar no XAMA →'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Card principal de auth ────────────────────────────────────────────────────
function AuthCard({ redirectTo = '/tournaments' }) {
  const { setToken } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState('login') // 'login' | 'register' | 'choose-username'
  const [pendingEmail, setPendingEmail] = useState('')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState('')

  const [regEmail, setRegEmail] = useState('')
  const [regUsername, setRegUsername] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regLoading, setRegLoading] = useState(false)
  const [regError, setRegError] = useState('')
  const [regSuccess, setRegSuccess] = useState('')

  const [googleError, setGoogleError] = useState('')

  function finish(token) {
    setToken(token, redirectTo)
    navigate(redirectTo, { replace: true })
  }

  async function doLogin(e) {
    e.preventDefault()
    setLoginLoading(true); setLoginError('')
    try {
      const res = await fetch(`${API_BASE_URL}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.detail || `HTTP ${res.status}`)
      if (!data?.access_token) throw new Error('Sem token na resposta')
      finish(data.access_token)
    } catch (err) { setLoginError(parseError(err)) }
    finally { setLoginLoading(false) }
  }

  async function doRegister(e) {
    e.preventDefault()
    setRegLoading(true); setRegError(''); setRegSuccess('')
    try {
      const res = await fetch(`${API_BASE_URL}/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: regEmail, username: regUsername, password: regPassword }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.detail || `HTTP ${res.status}`)
      setRegSuccess('Conta criada! Fazendo login…')
      const loginRes = await fetch(`${API_BASE_URL}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: regEmail, password: regPassword }),
      })
      const loginData = await loginRes.json().catch(() => null)
      if (loginRes.ok && loginData?.access_token) finish(loginData.access_token)
      else setMode('login')
    } catch (err) { setRegError(parseError(err)) }
    finally { setRegLoading(false) }
  }

  async function handleGoogleSuccess(credentialResponse) {
    setGoogleError('')
    try {
      const res = await fetch(`${API_BASE_URL}/users/google-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: credentialResponse.credential }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.detail || `HTTP ${res.status}`)
      if (data.requires_username) {
        setPendingEmail(data.temp_email)
        setMode('choose-username')
        return
      }
      if (!data.access_token) throw new Error('Sem token na resposta')
      finish(data.access_token)
    } catch (err) { setGoogleError(parseError(err)) }
  }

  if (mode === 'choose-username') {
    return <ChooseUsernameForm tempEmail={pendingEmail} onSuccess={finish} />
  }

  return (
    <div style={{ background: 'var(--color-xama-surface)', border: '1px solid var(--color-xama-border)', borderRadius: '16px', overflow: 'hidden' }}>
      <div style={{ height: '2px', background: 'linear-gradient(90deg, var(--color-xama-orange), transparent 60%)' }} />
      <div style={{ padding: '32px' }}>

        {/* Google */}
        <div style={{ marginBottom: '20px' }}>
          <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => setGoogleError('Erro ao autenticar com Google')}
            theme="filled_black" shape="rectangular" width="100%" text="continue_with" locale="pt-BR" />
          {googleError && <div className="msg-error" style={{ marginTop: '8px' }}>{googleError}</div>}
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--color-xama-border)' }} />
          <span style={{ fontSize: '11px', color: 'var(--color-xama-muted)', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.1em' }}>OU</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--color-xama-border)' }} />
        </div>

        {/* Toggle */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: '#0a0c11', borderRadius: '8px', padding: '4px' }}>
          {['login', 'register'].map(m => (
            <button key={m} onClick={() => { setMode(m); setLoginError(''); setRegError(''); setRegSuccess(''); setGoogleError('') }}
              style={{ flex: 1, padding: '8px', borderRadius: '6px', fontSize: '13px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', fontFamily: "'Rajdhani', sans-serif", cursor: 'pointer', border: 'none', background: mode === m ? 'var(--color-xama-surface)' : 'none', color: mode === m ? 'var(--color-xama-orange)' : 'var(--color-xama-muted)', transition: 'all 0.15s' }}>
              {m === 'login' ? 'Entrar' : 'Cadastrar'}
            </button>
          ))}
        </div>

        {/* Login form */}
        {mode === 'login' && (
          <form onSubmit={doLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={labelStyle}>E-mail</label>
              <input className="dark-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '15px' }} />
            </div>
            <div>
              <label style={labelStyle}>Senha</label>
              <input className="dark-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '15px' }} />
            </div>
            {loginError && <div className="msg-error">{loginError}</div>}
            <button type="submit" disabled={loginLoading} style={btnStyle(loginLoading)}>
              {loginLoading ? 'Entrando…' : 'Entrar →'}
            </button>
          </form>
        )}

        {/* Register form */}
        {mode === 'register' && (
          <form onSubmit={doRegister} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              { label: 'E-mail', value: regEmail, set: setRegEmail, type: 'email', placeholder: 'seu@email.com' },
              { label: 'Username', value: regUsername, set: setRegUsername, type: 'text', placeholder: 'seu_nick' },
              { label: 'Senha', value: regPassword, set: setRegPassword, type: 'password', placeholder: '••••••••' },
            ].map(({ label, value, set, type, placeholder }) => (
              <div key={label}>
                <label style={labelStyle}>{label}</label>
                <input className="dark-input" type={type} value={value} onChange={e => set(e.target.value)} placeholder={placeholder} required style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '15px' }} />
              </div>
            ))}
            {regError && <div className="msg-error">{regError}</div>}
            {regSuccess && <div className="msg-success">{regSuccess}</div>}
            <button type="submit" disabled={regLoading} style={btnStyle(regLoading)}>
              {regLoading ? 'Criando conta…' : 'Criar conta →'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

// ── Landing page wrapper ──────────────────────────────────────────────────────
export default function LandingPage({ redirectTo = '/tournaments' }) {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div style={{ minHeight: '100vh', background: 'var(--color-xama-black)', fontFamily: "'Rajdhani', sans-serif", display: 'flex', flexDirection: 'column' }}>
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, background: 'radial-gradient(ellipse 80% 50% at 20% 40%, rgba(249,115,22,0.06) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 80% 70%, rgba(59,130,246,0.04) 0%, transparent 60%)' }} />
        <header style={{ position: 'relative', zIndex: 1, padding: '24px 32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', fontSize: '20px', background: 'linear-gradient(135deg, rgba(249,115,22,0.3), rgba(249,115,22,0.05))', border: '1px solid rgba(249,115,22,0.4)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🔥</div>
            <div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-xama-text)', letterSpacing: '0.06em' }}>XAMA</div>
              <div style={{ fontSize: '9px', color: 'var(--color-xama-orange)', letterSpacing: '0.18em', textTransform: 'uppercase', lineHeight: 1 }}>Fantasy League</div>
            </div>
          </div>
        </header>
        <main style={{ flex: 1, position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
          <div style={{ width: '100%', maxWidth: '960px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '64px', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', color: 'var(--color-xama-orange)', textTransform: 'uppercase', marginBottom: '16px', fontFamily: "'JetBrains Mono', monospace" }}>PUBG Esports Fantasy</div>
              <h1 style={{ fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 700, color: 'var(--color-xama-text)', lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: '20px' }}>
                Monte seu time.<br /><span style={{ color: 'var(--color-xama-orange)' }}>Domine</span> o ranking.
              </h1>
              <p style={{ fontSize: '16px', color: 'var(--color-xama-muted)', lineHeight: 1.6, marginBottom: '32px', maxWidth: '380px' }}>
                Escolha jogadores reais do PAS e competições globais de PUBG. Acompanhe stats ao vivo e suba no leaderboard.
              </p>
              <div style={{ display: 'flex', gap: '32px' }}>
                {[{ value: '262+', label: 'Jogadores' }, { value: '5', label: 'Torneios' }, { value: '31', label: 'Partidas' }].map(({ value, label }) => (
                  <div key={label}>
                    <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-xama-text)', fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-xama-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
            <AuthCard redirectTo={redirectTo} />
          </div>
        </main>
        <footer style={{ position: 'relative', zIndex: 1, padding: '16px 32px', borderTop: '1px solid var(--color-xama-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '11px', color: '#2a3046', fontFamily: "'JetBrains Mono', monospace" }}>🔥 XAMA Fantasy League — dados reais do PUBG Esports</span>
        </footer>
      </div>
    </GoogleOAuthProvider>
  )
}
