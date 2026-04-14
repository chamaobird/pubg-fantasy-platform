// frontend/src/pages/LandingPage.jsx
// XAMA Fantasy — Landing + Auth
// v4: Google OAuth via redirect (sem @react-oauth/google), msgs PT-BR, reenvio verificação

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { API_BASE_URL } from '../config'

if (!document.getElementById('xama-fonts')) {
  const link = document.createElement('link')
  link.id = 'xama-fonts'; link.rel = 'stylesheet'
  link.href = 'https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=JetBrains+Mono:wght@400;600&display=swap'
  document.head.appendChild(link)
}

// Traduz mensagens de erro comuns vindas do backend
function translateError(msg) {
  if (!msg) return 'Erro inesperado'
  const map = {
    'Email already registered': 'Email já cadastrado.',
    'Username already taken': 'Username já em uso.',
    'Invalid credentials': 'Email ou senha inválidos.',
    'Failed to fetch': 'Não foi possível conectar ao servidor. Tente novamente.',
  }
  for (const [en, pt] of Object.entries(map)) {
    if (msg.includes(en)) return pt
  }
  return msg
}

function parseError(err) {
  if (typeof err === 'string') return translateError(err)
  if (err?.message) {
    try {
      const parsed = JSON.parse(err.message)
      if (typeof parsed?.detail === 'string') return translateError(parsed.detail)
    } catch {}
    return translateError(err.message)
  }
  return 'Erro inesperado'
}

const labelStyle = {
  fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em',
  textTransform: 'uppercase', color: 'rgba(148,163,184,0.7)',
  display: 'block', marginBottom: '5px',
}

const btnStyle = (disabled) => ({
  marginTop: '4px', padding: '11px', borderRadius: '7px',
  fontSize: '13px', fontWeight: 700, letterSpacing: '0.1em',
  textTransform: 'uppercase', fontFamily: "'Rajdhani', sans-serif",
  cursor: disabled ? 'default' : 'pointer', border: 'none', width: '100%',
  background: disabled ? 'rgba(30,35,48,0.8)' : 'var(--color-xama-orange)',
  color: disabled ? '#475569' : '#fff',
  transition: 'all 0.15s',
})

const googleBtnStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
  width: '100%', padding: '10px 16px', borderRadius: '7px',
  background: 'rgba(255,255,255,0.04)',
  color: '#e2e8f0',
  fontSize: '12px', fontWeight: 600, letterSpacing: '0.03em',
  border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', transition: 'all 0.15s',
}

// ── Card principal de auth ────────────────────────────────────────────────────
function AuthCard({ redirectTo = '/dashboard' }) {
  const { setToken } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState('login') // 'login' | 'register' | 'forgot'

  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotMsg, setForgotMsg] = useState('')
  const [forgotError, setForgotError] = useState('')

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
  const [showResend, setShowResend] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMsg, setResendMsg] = useState('')

  function finish(token) {
    setToken(token, redirectTo)
    navigate(redirectTo, { replace: true })
  }

  // ── Login ──────────────────────────────────────────────────────────────────
  async function doLogin(e) {
    e.preventDefault()
    setLoginLoading(true); setLoginError('')
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
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

  // ── Register ───────────────────────────────────────────────────────────────
  async function doRegister(e) {
    e.preventDefault()
    setRegLoading(true); setRegError(''); setRegSuccess(''); setShowResend(false)
    try {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: regEmail, username: regUsername, password: regPassword }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        const msg = data?.detail || `HTTP ${res.status}`
        // BUG-02: se email já cadastrado, oferece reenvio de verificação
        if (msg.includes('already registered') || msg.includes('já cadastrado')) {
          setRegError('Email já cadastrado.')
          setShowResend(true)
          return
        }
        throw new Error(msg)
      }
      setRegSuccess('Conta criada! Verifique seu email para ativar o acesso.')
      setRegEmail(''); setRegUsername(''); setRegPassword('')
    } catch (err) { setRegError(parseError(err)) }
    finally { setRegLoading(false) }
  }

  // ── Reenvio de verificação ─────────────────────────────────────────────────
  async function doResend() {
    setResendLoading(true); setResendMsg('')
    try {
      const res = await fetch(`${API_BASE_URL}/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: regEmail, password: regPassword }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.detail || `HTTP ${res.status}`)
      setResendMsg('Email de verificação reenviado! Verifique sua caixa de entrada.')
      setShowResend(false)
    } catch (err) {
      setResendMsg(parseError(err))
    } finally { setResendLoading(false) }
  }

  // ── Forgot password ────────────────────────────────────────────────────────
  async function doForgot(e) {
    e.preventDefault()
    setForgotLoading(true); setForgotError(''); setForgotMsg('')
    try {
      const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.detail || `HTTP ${res.status}`)
      setForgotMsg('Se o email estiver cadastrado, você receberá as instruções em breve.')
    } catch (err) { setForgotError(parseError(err)) }
    finally { setForgotLoading(false) }
  }

  // ── Google OAuth ───────────────────────────────────────────────────────────
  function handleGoogleLogin() {
    window.location.href = `${API_BASE_URL}/auth/google`
  }

  return (
    <div style={{
      background: 'rgba(10,12,18,0.88)',
      border: '1px solid rgba(249,115,22,0.2)',
      borderRadius: '12px',
      overflow: 'hidden',
      backdropFilter: 'blur(12px)',
      boxShadow: '0 0 40px rgba(249,115,22,0.06), inset 0 1px 0 rgba(255,255,255,0.04)',
    }}>
      {/* Barra topo laranja */}
      <div style={{ height: '2px', background: 'linear-gradient(90deg, transparent, #f97316 40%, #fb923c 60%, transparent)' }} />
      <div style={{ padding: '24px 26px' }}>

        {/* Título do card */}
        {mode !== 'forgot' && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '17px', fontWeight: 700, color: '#f1f5f9', letterSpacing: '0.03em' }}>
              {mode === 'login' ? 'Entrar na plataforma' : 'Criar conta'}
            </div>
            <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
              {mode === 'login' ? 'Bem-vindo de volta' : 'Junte-se à arena'}
            </div>
          </div>
        )}

        {/* Google */}
        <div style={{ marginBottom: '16px' }}>
          <button onClick={handleGoogleLogin} style={googleBtnStyle}>
            <img
              src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
              width="16" height="16" alt="Google"
            />
            Continuar com Google
          </button>
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
          <span style={{ fontSize: '10px', color: '#374151', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.12em' }}>ou</span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
        </div>

        {/* Toggle entrar/cadastrar */}
        {mode !== 'forgot' && (
          <div style={{ display: 'flex', marginBottom: '16px', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '7px', overflow: 'hidden' }}>
            {['login', 'register'].map(m => (
              <button key={m} onClick={() => {
                setMode(m)
                setLoginError(''); setRegError(''); setRegSuccess('')
                setShowResend(false); setResendMsg('')
                setForgotMsg(''); setForgotError('')
              }}
                style={{ flex: 1, padding: '8px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', border: 'none', background: mode === m ? '#f97316' : 'transparent', color: mode === m ? '#fff' : '#475569', transition: 'all 0.15s' }}>
                {m === 'login' ? 'Entrar' : 'Cadastrar'}
              </button>
            ))}
          </div>
        )}

        {/* Login form */}
        {mode === 'login' && (
          <form onSubmit={doLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={labelStyle}>E-mail</label>
              <input className="xama-landing-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required style={{ fontSize: '15px' }} />
            </div>
            <div>
              <label style={labelStyle}>Senha</label>
              <input className="xama-landing-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required style={{ fontSize: '15px' }} />
            </div>
            {loginError && <div className="xama-msg-error">{loginError}</div>}
            <button type="submit" disabled={loginLoading} style={btnStyle(loginLoading)}>
              {loginLoading ? 'Entrando…' : 'Entrar →'}
            </button>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: '12px', color: 'var(--color-xama-muted)', margin: 0 }}>
                Não tem conta?{' '}
                <span onClick={() => setMode('register')} style={{ color: 'var(--color-xama-orange)', cursor: 'pointer', fontWeight: 700 }}>
                  Cadastre-se
                </span>
              </p>
              <span onClick={() => { setMode('forgot'); setForgotEmail(email); setForgotMsg(''); setForgotError('') }}
                style={{ fontSize: '12px', color: 'var(--color-xama-muted)', cursor: 'pointer', textDecoration: 'underline' }}>
                Esqueci minha senha
              </span>
            </div>
          </form>
        )}

        {/* Forgot password form */}
        {mode === 'forgot' && (
          <form onSubmit={doForgot} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ textAlign: 'center', marginBottom: '4px' }}>
              <div style={{ fontSize: '24px', marginBottom: '6px' }}>🔑</div>
              <p style={{ fontSize: '13px', color: 'var(--color-xama-muted)', margin: 0 }}>
                Digite seu email e enviaremos as instruções para redefinir sua senha.
              </p>
            </div>
            <div>
              <label style={labelStyle}>E-mail</label>
              <input className="xama-landing-input" type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} placeholder="seu@email.com" required style={{ fontSize: '15px' }} />
            </div>
            {forgotError && <div className="xama-msg-error">{forgotError}</div>}
            {forgotMsg && <div className="xama-msg-success">{forgotMsg}</div>}
            {!forgotMsg && (
              <button type="submit" disabled={forgotLoading} style={btnStyle(forgotLoading)}>
                {forgotLoading ? 'Enviando…' : 'Enviar instruções →'}
              </button>
            )}
            <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--color-xama-muted)', margin: 0 }}>
              <span onClick={() => setMode('login')} style={{ color: 'var(--color-xama-orange)', cursor: 'pointer', fontWeight: 700 }}>
                ← Voltar para o login
              </span>
            </p>
          </form>
        )}

        {/* Register form */}
        {mode === 'register' && (
          <form onSubmit={doRegister} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={labelStyle}>E-mail</label>
              <input className="xama-landing-input" type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} placeholder="seu@email.com" required style={{ fontSize: '15px' }} />
            </div>
            <div>
              <label style={labelStyle}>Username</label>
              <input className="xama-landing-input" type="text" value={regUsername} onChange={e => setRegUsername(e.target.value)} placeholder="seu_nick" required style={{ fontSize: '15px' }} />
            </div>
            <div>
              <label style={labelStyle}>Senha</label>
              <input className="xama-landing-input" type="password" value={regPassword} onChange={e => setRegPassword(e.target.value)} placeholder="••••••••" required style={{ fontSize: '15px' }} />
            </div>

            {/* BUG-01: erro em PT-BR + BUG-02: link de reenvio */}
            {regError && (
              <div className="xama-msg-error">
                {regError}
                {showResend && (
                  <span>
                    {' '}
                    <span
                      onClick={doResend}
                      style={{ color: 'var(--color-xama-orange)', cursor: resendLoading ? 'default' : 'pointer', fontWeight: 700, textDecoration: 'underline' }}
                    >
                      {resendLoading ? 'Reenviando…' : 'Reenviar verificação'}
                    </span>
                  </span>
                )}
              </div>
            )}
            {resendMsg && <div className="xama-msg-success">{resendMsg}</div>}
            {regSuccess && <div className="xama-msg-success">{regSuccess}</div>}

            <button type="submit" disabled={regLoading} style={btnStyle(regLoading)}>
              {regLoading ? 'Criando conta…' : 'Criar conta →'}
            </button>
            <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--color-xama-muted)', margin: 0 }}>
              Já tem conta?{' '}
              <span onClick={() => setMode('login')} style={{ color: 'var(--color-xama-orange)', cursor: 'pointer', fontWeight: 700 }}>
                Entrar
              </span>
            </p>
          </form>
        )}

      </div>
    </div>
  )
}

// ── Landing page wrapper ──────────────────────────────────────────────────────
export default function LandingPage({ redirectTo = '/dashboard' }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#08090d',
      display: 'flex', flexDirection: 'column',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Grade hexagonal de fundo */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        opacity: 0.045,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='52'%3E%3Cpolygon points='30,2 58,17 58,35 30,50 2,35 2,17' fill='none' stroke='%23f97316' stroke-width='1'/%3E%3C/svg%3E")`,
        backgroundSize: '60px 52px',
      }} />

      {/* Gradiente radial laranja */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: `
          radial-gradient(ellipse 65% 80% at 18% 55%, rgba(249,115,22,0.13) 0%, transparent 65%),
          radial-gradient(ellipse 35% 50% at 82% 45%, rgba(249,115,22,0.05) 0%, transparent 65%)
        `,
      }} />

      {/* Scan line animada */}
      <div style={{
        position: 'fixed', left: 0, right: 0, height: '1px', zIndex: 0, pointerEvents: 'none',
        background: 'linear-gradient(90deg, transparent, rgba(249,115,22,0.35), transparent)',
        animation: 'xama-scan 6s linear infinite',
      }} />

      <style>{`
        @keyframes xama-scan { 0%{top:0} 100%{top:100%} }
        .xama-landing-input {
          width: 100%; box-sizing: border-box;
          padding: 9px 12px;
          background: rgba(10,12,18,0.7);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 7px;
          color: #e2e8f0;
          font-size: 13px;
          font-family: 'JetBrains Mono', monospace;
          outline: none;
          transition: border-color 0.15s;
        }
        .xama-landing-input:focus { border-color: rgba(249,115,22,0.4); }
        .xama-landing-input::placeholder { color: #374151; }
        .xama-msg-error {
          font-size: 12px; color: #f87171;
          background: rgba(248,113,113,0.07);
          border: 1px solid rgba(248,113,113,0.15);
          border-radius: 6px; padding: 8px 12px;
        }
        .xama-msg-success {
          font-size: 12px; color: #4ade80;
          background: rgba(74,222,128,0.07);
          border: 1px solid rgba(74,222,128,0.15);
          border-radius: 6px; padding: 8px 12px;
        }
      `}</style>

      {/* Header */}
      <header style={{ position: 'relative', zIndex: 1, padding: '20px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '38px', height: '38px', fontSize: '18px', background: 'linear-gradient(135deg, rgba(249,115,22,0.25), rgba(249,115,22,0.04))', border: '1px solid rgba(249,115,22,0.35)', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🔥</div>
          <div>
            <div style={{ fontSize: '19px', fontWeight: 700, color: '#f1f5f9', letterSpacing: '0.08em' }}>XAMA</div>
            <div style={{ fontSize: '8px', color: '#f97316', letterSpacing: '0.22em', textTransform: 'uppercase', lineHeight: 1 }}>Fantasy League</div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main style={{ flex: 1, position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 24px' }}>
        <div style={{ width: '100%', maxWidth: '980px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', alignItems: 'center' }}>

          {/* Hero */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
              <div style={{ width: '20px', height: '1px', background: '#f97316' }} />
              <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.22em', color: '#f97316', textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace" }}>
                PUBG Esports Fantasy
              </span>
            </div>
            <h1 style={{ fontSize: 'clamp(32px, 4.5vw, 52px)', fontWeight: 700, color: '#f1f5f9', lineHeight: 1.05, letterSpacing: '-0.01em', marginBottom: '18px', margin: '0 0 18px' }}>
              Monte seu time.<br />
              <span style={{ color: '#f97316' }}>Domine</span> o ranking.
            </h1>
            <p style={{ fontSize: '14px', color: '#64748b', lineHeight: 1.65, marginBottom: '28px', maxWidth: '360px' }}>
              Escolha jogadores reais das competições globais de PUBG. Acompanhe stats ao vivo e suba no leaderboard.
            </p>
            {/* Stats */}
            <div style={{ display: 'flex', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '9px', overflow: 'hidden', width: 'fit-content' }}>
              {[
                { value: '262+', label: 'Jogadores' },
                { value: '9', label: 'Stages' },
                { value: '60', label: 'Partidas' },
              ].map(({ value, label }, i) => (
                <div key={label} style={{ padding: '10px 20px', borderRight: i < 2 ? '1px solid rgba(255,255,255,0.07)' : 'none' }}>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc', fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
                  <div style={{ fontSize: '9px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '1px' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Auth card */}
          <AuthCard redirectTo={redirectTo} />
        </div>
      </main>

      {/* Footer */}
      <footer style={{ position: 'relative', zIndex: 1, padding: '14px 32px', borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: '10px', color: '#1e2330', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em' }}>
          🔥 XAMA Fantasy League — dados reais do PUBG Esports
        </span>
      </footer>
    </div>
  )
}