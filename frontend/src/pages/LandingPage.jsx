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

const googleBtnStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
  width: '100%', padding: '11px 16px', borderRadius: '8px',
  background: '#fff', color: '#1a1a1a',
  fontSize: '14px', fontWeight: 600, letterSpacing: '0.02em',
  fontFamily: "'Rajdhani', sans-serif",
  border: '1px solid #e2e8f0', cursor: 'pointer', transition: 'all 0.15s',
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
    <div style={{ background: 'var(--color-xama-surface)', border: '1px solid var(--color-xama-border)', borderRadius: '16px', overflow: 'hidden' }}>
      <div style={{ height: '2px', background: 'linear-gradient(90deg, var(--color-xama-orange), transparent 60%)' }} />
      <div style={{ padding: '32px' }}>

        {/* Google */}
        <div style={{ marginBottom: '20px' }}>
          <button onClick={handleGoogleLogin} style={googleBtnStyle}>
            <img
              src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
              width="18" height="18" alt="Google"
            />
            Continuar com Google
          </button>
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--color-xama-border)' }} />
          <span style={{ fontSize: '11px', color: 'var(--color-xama-muted)', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.1em' }}>OU</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--color-xama-border)' }} />
        </div>

        {/* Toggle — só mostra em login/register */}
        {mode !== 'forgot' && (
          <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: '#0a0c11', borderRadius: '8px', padding: '4px' }}>
            {['login', 'register'].map(m => (
              <button key={m} onClick={() => {
                setMode(m)
                setLoginError(''); setRegError(''); setRegSuccess('')
                setShowResend(false); setResendMsg('')
                setForgotMsg(''); setForgotError('')
              }}
                style={{ flex: 1, padding: '8px', borderRadius: '6px', fontSize: '13px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', fontFamily: "'Rajdhani', sans-serif", cursor: 'pointer', border: 'none', background: mode === m ? 'var(--color-xama-surface)' : 'none', color: mode === m ? 'var(--color-xama-orange)' : 'var(--color-xama-muted)', transition: 'all 0.15s' }}>
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
              <input className="dark-input" type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} placeholder="seu@email.com" required style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '15px' }} />
            </div>
            {forgotError && <div className="msg-error">{forgotError}</div>}
            {forgotMsg && <div className="msg-success">{forgotMsg}</div>}
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
              <input className="dark-input" type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} placeholder="seu@email.com" required style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '15px' }} />
            </div>
            <div>
              <label style={labelStyle}>Username</label>
              <input className="dark-input" type="text" value={regUsername} onChange={e => setRegUsername(e.target.value)} placeholder="seu_nick" required style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '15px' }} />
            </div>
            <div>
              <label style={labelStyle}>Senha</label>
              <input className="dark-input" type="password" value={regPassword} onChange={e => setRegPassword(e.target.value)} placeholder="••••••••" required style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '15px' }} />
            </div>

            {/* BUG-01: erro em PT-BR + BUG-02: link de reenvio */}
            {regError && (
              <div className="msg-error">
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
            {resendMsg && <div className="msg-success">{resendMsg}</div>}
            {regSuccess && <div className="msg-success">{regSuccess}</div>}

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
  )
}