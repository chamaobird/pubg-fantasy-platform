// frontend/src/pages/LandingPage.jsx
// XAMA Fantasy — Landing + Auth
// v5: design refresh — HUD, sticky header, sliding toggle, premium auth card

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { API_BASE_URL } from '../config'

// ── Traduz erros do backend para PT-BR ───────────────────────────────────────
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

// ── Auth Card ────────────────────────────────────────────────────────────────
function AuthCard({ redirectTo = '/dashboard', sessionExpiredMsg = '' }) {
  const { setToken, clearSessionMsg } = useAuth()
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
    if (clearSessionMsg) clearSessionMsg()
    setToken(token, redirectTo)
    navigate(redirectTo, { replace: true })
  }

  function switchMode(m) {
    setMode(m)
    setLoginError(''); setRegError(''); setRegSuccess('')
    setShowResend(false); setResendMsg('')
    setForgotMsg(''); setForgotError('')
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

  const isRegister = mode === 'register'
  const isForgot = mode === 'forgot'

  return (
    <aside className="lp-auth-wrap">
      <div className="lp-auth">
        <div className="lp-auth-accent" />
        <div className="lp-auth-corner" />

        {sessionExpiredMsg && (
          <div className="lp-msg lp-msg--error" style={{ marginBottom: '18px' }}>
            🔒 {sessionExpiredMsg}
          </div>
        )}

        {!isForgot && (
          <div className="lp-auth-head">
            <div className="lp-auth-title">{isRegister ? 'Cadastrar' : 'Entrar'}</div>
            <div className="lp-auth-tag">PT-BR</div>
          </div>
        )}

        {/* Toggle login / cadastrar */}
        {!isForgot && (
          <div className={`lp-toggle${isRegister ? ' is-register' : ''}`}>
            <div className="lp-toggle-thumb" />
            <button type="button" className={!isRegister ? 'is-active' : ''} onClick={() => switchMode('login')}>
              Entrar
            </button>
            <button type="button" className={isRegister ? 'is-active' : ''} onClick={() => switchMode('register')}>
              Cadastrar
            </button>
          </div>
        )}

        {/* Google OAuth */}
        {!isForgot && (
          <button type="button" className="lp-oauth" onClick={handleGoogleLogin}>
            <svg viewBox="0 0 48 48" aria-hidden="true" width="16" height="16">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.5 29.5 4.5 24 4.5 12.7 4.5 3.5 13.7 3.5 25S12.7 45.5 24 45.5 44.5 36.3 44.5 25c0-1.5-.2-3-.4-4.5z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.5 29.5 4.5 24 4.5 16.3 4.5 9.7 8.6 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 45.5c5.4 0 10.3-2 14-5.3l-6.5-5.5C29.5 36.2 26.9 37 24 37c-5.3 0-9.7-3.4-11.3-8L6.2 33.7C9.6 39.9 16.3 45.5 24 45.5z"/>
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.7l6.5 5.5c-.5.4 7-5.1 7-14.2 0-1.5-.2-3-.4-4.5z"/>
            </svg>
            Continuar com Google
          </button>
        )}

        {/* Divisor "ou" */}
        {!isForgot && (
          <div className="lp-or">
            <span className="lp-or-line" />
            <span className="lp-or-text">ou</span>
            <span className="lp-or-line" />
          </div>
        )}

        {/* ── Login form ── */}
        {mode === 'login' && (
          <form onSubmit={doLogin} autoComplete="off" noValidate>
            <div className="lp-field">
              <label htmlFor="lp-email">E-mail</label>
              <div className="lp-input-wrap">
                <input className="lp-input" id="lp-email" type="email" value={email}
                  onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required />
              </div>
            </div>
            <div className="lp-field">
              <label htmlFor="lp-password">Senha</label>
              <div className="lp-input-wrap">
                <input className="lp-input" id="lp-password" type="password" value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
              </div>
            </div>
            <button type="button" className="lp-forgot"
              onClick={() => { setMode('forgot'); setForgotEmail(email); setForgotMsg(''); setForgotError('') }}>
              Esqueci minha senha
            </button>
            {loginError && <div className="lp-msg lp-msg--error" style={{ marginBottom: '12px' }}>{loginError}</div>}
            <button type="submit" disabled={loginLoading} className="lp-submit">
              <span>{loginLoading ? 'Entrando…' : 'Entrar'}</span>
              <span className="lp-submit-arrow">→</span>
            </button>
            <div className="lp-aux">
              Não tem conta?{' '}
              <span className="lp-aux-link" onClick={() => switchMode('register')}>Cadastre-se</span>
            </div>
          </form>
        )}

        {/* ── Register form ── */}
        {mode === 'register' && (
          <form onSubmit={doRegister} autoComplete="off" noValidate>
            <div className="lp-field">
              <label htmlFor="lp-reg-email">E-mail</label>
              <div className="lp-input-wrap">
                <input className="lp-input" id="lp-reg-email" type="email" value={regEmail}
                  onChange={e => setRegEmail(e.target.value)} placeholder="seu@email.com" required />
              </div>
            </div>
            <div className="lp-field">
              <label htmlFor="lp-reg-username">Username</label>
              <div className="lp-input-wrap">
                <input className="lp-input" id="lp-reg-username" type="text" value={regUsername}
                  onChange={e => setRegUsername(e.target.value)} placeholder="seu_nick" required />
              </div>
            </div>
            <div className="lp-field">
              <label htmlFor="lp-reg-password">Senha</label>
              <div className="lp-input-wrap">
                <input className="lp-input" id="lp-reg-password" type="password" value={regPassword}
                  onChange={e => setRegPassword(e.target.value)} placeholder="••••••••" required />
              </div>
            </div>
            {regError && (
              <div className="lp-msg lp-msg--error" style={{ marginBottom: '12px' }}>
                {regError}
                {showResend && (
                  <span>
                    {' '}
                    <span className="lp-aux-link"
                      onClick={doResend}
                      style={{ cursor: resendLoading ? 'default' : 'pointer', textDecoration: 'underline' }}>
                      {resendLoading ? 'Reenviando…' : 'Reenviar verificação'}
                    </span>
                  </span>
                )}
              </div>
            )}
            {resendMsg && <div className="lp-msg lp-msg--success" style={{ marginBottom: '12px' }}>{resendMsg}</div>}
            {regSuccess && <div className="lp-msg lp-msg--success" style={{ marginBottom: '12px' }}>{regSuccess}</div>}
            <button type="submit" disabled={regLoading} className="lp-submit">
              <span>{regLoading ? 'Criando conta…' : 'Criar conta'}</span>
              <span className="lp-submit-arrow">→</span>
            </button>
            <div className="lp-aux">
              Já tem conta?{' '}
              <span className="lp-aux-link" onClick={() => switchMode('login')}>Entre aqui</span>
            </div>
          </form>
        )}

        {/* ── Forgot password form ── */}
        {mode === 'forgot' && (
          <form onSubmit={doForgot} autoComplete="off" noValidate>
            <div className="lp-auth-head" style={{ marginBottom: '18px' }}>
              <div className="lp-auth-title">Recuperar senha</div>
              <div className="lp-auth-tag">PT-BR</div>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--xm-muted, #6b7280)', marginBottom: '18px', lineHeight: 1.55 }}>
              Digite seu email e enviaremos as instruções para redefinir sua senha.
            </p>
            <div className="lp-field">
              <label htmlFor="lp-forgot-email">E-mail</label>
              <div className="lp-input-wrap">
                <input className="lp-input" id="lp-forgot-email" type="email" value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)} placeholder="seu@email.com" required />
              </div>
            </div>
            {forgotError && <div className="lp-msg lp-msg--error" style={{ marginBottom: '12px' }}>{forgotError}</div>}
            {forgotMsg && <div className="lp-msg lp-msg--success" style={{ marginBottom: '12px' }}>{forgotMsg}</div>}
            {!forgotMsg && (
              <button type="submit" disabled={forgotLoading} className="lp-submit">
                <span>{forgotLoading ? 'Enviando…' : 'Enviar instruções'}</span>
                <span className="lp-submit-arrow">→</span>
              </button>
            )}
            <div className="lp-aux" style={{ marginTop: '16px' }}>
              <span className="lp-aux-link" onClick={() => switchMode('login')}>← Voltar para o login</span>
            </div>
          </form>
        )}
      </div>
    </aside>
  )
}

// ── Landing Page ─────────────────────────────────────────────────────────────
export default function LandingPage({ redirectTo = '/dashboard' }) {
  const { sessionExpiredMsg } = useAuth()

  return (
    <div className="lp-page-root">
      {/* ── Estilos scoped ── */}
      <style>{`
        /* ── Tokens de design (espelham xm-* do design system) ── */
        .lp-page-root {
          --lp-orange:       #f97316;
          --lp-orange-hover: #fb923c;
          --lp-gold:         #f0c040;
          --lp-green:        #4ade80;
          --lp-text-white:   #ffffff;
          --lp-text-bright:  #f1f5f9;
          --lp-text:         #dce1ea;
          --lp-muted:        #6b7280;
          --lp-muted-soft:   #4b5563;
          --lp-muted-deep:   #374151;
          --lp-border:       #1e2330;
          --lp-bg:           #08090d;
          --lp-surface-1:    #12151c;
          --lp-ease:         cubic-bezier(0.4, 0, 0.2, 1);
          --lp-dur:          0.15s;
          --lp-font-display: 'Rajdhani', 'Segoe UI', sans-serif;
          --lp-font-body:    'Inter', 'Segoe UI', system-ui, sans-serif;
          --lp-font-mono:    'JetBrains Mono', 'Share Tech Mono', monospace;
        }

        /* ── Page shell ── */
        .lp-page-root {
          min-height: 100vh;
          background: var(--lp-bg);
          display: grid;
          grid-template-rows: auto 1fr auto;
          position: relative;
          overflow-x: hidden;
        }

        /* ── Atmosfera ── */
        .lp-atmosphere {
          position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden;
        }
        .lp-hex {
          position: absolute; inset: 0;
          opacity: 0.05;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='60' height='52'><polygon points='30,2 58,17 58,35 30,50 2,35 2,17' fill='none' stroke='%23f97316' stroke-width='1'/></svg>");
          background-size: 60px 52px;
        }
        .lp-radial {
          position: absolute; inset: 0;
          background:
            radial-gradient(ellipse 70% 80% at 22% 50%, rgba(249,115,22,0.14) 0%, transparent 65%),
            radial-gradient(ellipse 35% 50% at 82% 45%, rgba(249,115,22,0.05) 0%, transparent 65%),
            radial-gradient(ellipse 90% 50% at 50% 100%, rgba(0,0,0,0.6) 0%, transparent 60%);
        }
        .lp-hud {
          position: absolute;
          left: -60px; top: 18%;
          width: 720px; height: 620px;
          opacity: 0.18;
          pointer-events: none;
        }
        .lp-hud svg { width: 100%; height: 100%; display: block; }
        @keyframes lp-scan {
          0%   { transform: translateY(-2px); opacity: 0; }
          5%   { opacity: 1; }
          95%  { opacity: 1; }
          100% { transform: translateY(100vh); opacity: 0; }
        }
        .lp-scan {
          position: fixed; left: 0; right: 0; top: 0; height: 1px; z-index: 1;
          pointer-events: none;
          background: linear-gradient(90deg, transparent, rgba(249,115,22,0.45), transparent);
          animation: lp-scan 8s linear infinite;
        }

        /* ── Header ── */
        .lp-header {
          position: sticky; top: 0; z-index: 50;
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          background: rgba(8,9,13,0.78);
          border-bottom: 1px solid var(--lp-border);
          position: relative;
        }
        .lp-header::after {
          content: "";
          position: absolute; left: 0; right: 0; bottom: -1px; height: 1px;
          background: linear-gradient(90deg, var(--lp-orange) 0%, rgba(249,115,22,0.4) 18%, transparent 50%);
        }
        .lp-header-inner {
          max-width: 1200px; margin: 0 auto;
          padding: 14px 32px;
          display: flex; align-items: center; justify-content: space-between; gap: 24px;
        }
        .lp-logo {
          display: flex; align-items: center; gap: 12px;
          text-decoration: none;
        }
        .lp-logo-mark {
          width: 38px; height: 38px; border-radius: 9px;
          position: relative;
          background: linear-gradient(140deg, rgba(249,115,22,0.32) 0%, rgba(249,115,22,0.08) 60%, rgba(13,15,20,0.8) 100%);
          border: 1px solid rgba(249,115,22,0.45);
          display: flex; align-items: center; justify-content: center;
          font-size: 19px; line-height: 1; overflow: hidden;
          box-shadow: 0 0 18px rgba(249,115,22,0.20), inset 0 1px 0 rgba(255,255,255,0.08);
        }
        .lp-logo-mark::before {
          content: "";
          position: absolute; inset: 0;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='12'><polygon points='7,1 13,4 13,8 7,11 1,8 1,4' fill='none' stroke='%23f97316' stroke-width='0.5'/></svg>");
          background-size: 14px 12px;
          opacity: 0.18;
        }
        .lp-logo-mark span { position: relative; filter: drop-shadow(0 0 6px rgba(249,115,22,0.5)); }
        .lp-logo-text { display: flex; flex-direction: column; line-height: 1; gap: 4px; }
        .lp-logo-name {
          font-family: var(--lp-font-display); font-weight: 700; font-size: 19px;
          color: var(--lp-text-white); letter-spacing: 0.08em;
        }
        .lp-logo-tag {
          font-family: var(--lp-font-mono); font-weight: 700; font-size: 9px;
          color: var(--lp-orange); letter-spacing: 0.22em; text-transform: uppercase;
        }
        .lp-status {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 6px 12px 6px 10px; border-radius: 999px;
          background: rgba(74,222,128,0.06); border: 1px solid rgba(74,222,128,0.22);
          font-family: var(--lp-font-mono); font-size: 10px; font-weight: 700;
          color: var(--lp-text-bright); letter-spacing: 0.14em; text-transform: uppercase;
        }
        .lp-status-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: var(--lp-green); position: relative;
          box-shadow: 0 0 10px rgba(74,222,128,0.7);
        }
        .lp-status-dot::after {
          content: "";
          position: absolute; inset: -4px; border-radius: 50%;
          border: 1px solid var(--lp-green); opacity: 0.4;
          animation: lp-pulse 1.8s ease-out infinite;
        }
        @keyframes lp-pulse {
          0%   { transform: scale(0.6); opacity: 0.6; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        .lp-status-live { color: var(--lp-green); }
        .lp-status-sep  { color: var(--lp-muted-soft); margin: 0 2px; }

        /* ── Main / Grid ── */
        .lp-main {
          position: relative; z-index: 2;
          display: flex; align-items: center; justify-content: center;
          padding: 64px 32px 80px;
          min-height: calc(100vh - 68px - 56px);
        }
        .lp-grid {
          width: 100%; max-width: 980px;
          display: grid; grid-template-columns: 1fr 420px;
          gap: 60px; align-items: center; position: relative;
        }

        /* ── Hero ── */
        .lp-hero { position: relative; z-index: 2; }
        @keyframes lp-fadeup {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .lp-eyebrow {
          display: inline-flex; align-items: center; gap: 12px;
          margin-bottom: 28px;
          animation: lp-fadeup 0.7s var(--lp-ease) both;
        }
        .lp-eyebrow-line {
          width: 28px; height: 1px;
          background: var(--lp-orange);
          box-shadow: 0 0 8px rgba(249,115,22,0.6);
        }
        .lp-eyebrow-text {
          font-family: var(--lp-font-mono); font-size: 10px; font-weight: 700;
          color: var(--lp-orange); letter-spacing: 0.22em; text-transform: uppercase;
        }
        .lp-h1 {
          font-family: var(--lp-font-display); font-weight: 700;
          font-size: clamp(38px, 6vw, 64px);
          line-height: 0.95; letter-spacing: -0.02em;
          color: var(--lp-text-white);
          margin: 0 0 24px; text-wrap: balance;
          animation: lp-fadeup 0.7s var(--lp-ease) 0.1s both;
        }
        .lp-h1-line { display: block; }
        .lp-h1-line + .lp-h1-line { margin-top: 4px; }
        .lp-h1-muted { color: var(--lp-text-bright); }
        .lp-h1 em {
          font-style: normal; color: var(--lp-orange);
          text-shadow: 0 0 32px rgba(249,115,22,0.45);
        }
        .lp-sub {
          font-family: var(--lp-font-body); font-size: 16px; line-height: 1.6;
          color: var(--lp-muted); max-width: 460px; margin: 0 0 36px;
          animation: lp-fadeup 0.7s var(--lp-ease) 0.2s both;
        }
        .lp-stats {
          display: flex; flex-wrap: wrap; gap: 10px;
          animation: lp-fadeup 0.7s var(--lp-ease) 0.3s both;
        }
        .lp-stat {
          display: inline-flex; align-items: center; gap: 10px;
          padding: 9px 14px 9px 11px;
          background: rgba(18,21,28,0.7); border: 1px solid var(--lp-border);
          border-radius: 999px; backdrop-filter: blur(6px);
          transition: all var(--lp-dur) var(--lp-ease);
        }
        .lp-stat:hover {
          border-color: rgba(249,115,22,0.35);
          background: rgba(18,21,28,0.9);
        }
        .lp-stat-icon {
          width: 18px; height: 18px; display: flex; align-items: center; justify-content: center;
          color: var(--lp-orange); flex-shrink: 0;
        }
        .lp-stat-icon svg { width: 100%; height: 100%; stroke-width: 1.5; }
        .lp-stat-num {
          font-family: var(--lp-font-mono); font-size: 14px; font-weight: 700;
          color: var(--lp-gold); font-variant-numeric: tabular-nums; letter-spacing: 0.02em;
        }
        .lp-stat-label {
          font-family: var(--lp-font-mono); font-size: 10px; font-weight: 600;
          color: var(--lp-muted); letter-spacing: 0.12em; text-transform: uppercase;
        }

        /* ── Auth Card ── */
        .lp-auth-wrap { position: relative; z-index: 2; animation: lp-fadeup 0.7s var(--lp-ease) 0.15s both; }
        .lp-auth {
          position: relative;
          background: rgba(10,12,18,0.82);
          backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px);
          border: 1px solid rgba(249,115,22,0.18); border-radius: 16px;
          padding: 30px 28px 26px;
          box-shadow:
            0 24px 60px rgba(0,0,0,0.45),
            0 0 60px rgba(249,115,22,0.06),
            inset 0 1px 0 rgba(255,255,255,0.05);
          overflow: hidden;
        }
        .lp-auth::before {
          content: ""; position: absolute; inset: 1px; border-radius: 15px;
          border: 1px solid rgba(255,255,255,0.03); pointer-events: none;
        }
        .lp-auth-accent {
          position: absolute; top: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg,
            transparent 0%,
            rgba(249,115,22,0.4) 25%,
            #f97316 50%, #fb923c 60%,
            rgba(249,115,22,0.4) 75%,
            transparent 100%);
          border-radius: 16px 16px 0 0;
        }
        .lp-auth-accent::after {
          content: "";
          position: absolute; top: -8px; left: 0; right: 0; height: 24px;
          background: radial-gradient(ellipse 50% 100% at 50% 0%, rgba(249,115,22,0.4) 0%, transparent 70%);
          filter: blur(6px);
        }
        .lp-auth-corner {
          position: absolute; top: 0; left: 0;
          width: 80px; height: 1px;
          background: linear-gradient(90deg, rgba(255,255,255,0.18), transparent);
        }
        .lp-auth-head {
          display: flex; align-items: baseline; justify-content: space-between;
          margin-bottom: 22px;
        }
        .lp-auth-title {
          font-family: var(--lp-font-display); font-weight: 700; font-size: 18px;
          color: var(--lp-text-white); letter-spacing: 0.04em; text-transform: uppercase;
        }
        .lp-auth-tag {
          font-family: var(--lp-font-mono); font-size: 9px;
          color: var(--lp-orange); letter-spacing: 0.22em; text-transform: uppercase; font-weight: 700;
        }

        /* Toggle com thumb deslizante */
        .lp-toggle {
          display: grid; grid-template-columns: 1fr 1fr;
          background: rgba(10,12,18,0.6); border: 1px solid var(--lp-border);
          border-radius: 9px; padding: 4px; margin-bottom: 22px;
          position: relative;
        }
        .lp-toggle-thumb {
          position: absolute; top: 4px; bottom: 4px;
          width: calc(50% - 4px);
          background: linear-gradient(180deg, #f97316 0%, #e5650c 100%);
          border-radius: 6px;
          box-shadow: 0 2px 8px rgba(249,115,22,0.35), inset 0 1px 0 rgba(255,255,255,0.18);
          transition: transform 0.32s cubic-bezier(0.65,0.05,0.36,1);
          z-index: 0;
        }
        .lp-toggle.is-register .lp-toggle-thumb { transform: translateX(100%); }
        .lp-toggle button {
          position: relative; z-index: 1; background: transparent; border: none;
          font-family: var(--lp-font-display); font-weight: 700; font-size: 12px;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--lp-muted); padding: 9px 0; cursor: pointer;
          transition: color 0.2s ease;
        }
        .lp-toggle button.is-active { color: #fff; }

        /* Google OAuth */
        .lp-oauth {
          width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px;
          padding: 11px 14px;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px; color: var(--lp-text-bright);
          font-family: var(--lp-font-body); font-weight: 500; font-size: 13px;
          cursor: pointer; transition: all var(--lp-dur) var(--lp-ease);
        }
        .lp-oauth:hover {
          background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.14);
          transform: translateY(-1px);
        }
        .lp-oauth:active { transform: translateY(0); }

        /* Divisor "ou" */
        .lp-or {
          display: flex; align-items: center; gap: 14px; margin: 18px 0;
        }
        .lp-or-line {
          flex: 1; height: 1px;
          background: linear-gradient(90deg, transparent, var(--lp-border) 30%, var(--lp-border) 70%, transparent);
        }
        .lp-or-text {
          font-family: var(--lp-font-mono); font-size: 9px; font-weight: 700;
          color: var(--lp-muted-soft); letter-spacing: 0.22em; text-transform: uppercase;
        }

        /* Fields */
        .lp-field { margin-bottom: 14px; }
        .lp-field label {
          display: block; font-family: var(--lp-font-mono); font-size: 10px; font-weight: 700;
          color: var(--lp-muted); letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: 7px;
        }
        .lp-input-wrap { position: relative; }
        .lp-input {
          width: 100%; padding: 11px 13px;
          background: rgba(10,12,18,0.7); border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px; color: var(--lp-text-bright);
          font-family: var(--lp-font-mono); font-size: 13px;
          outline: none; transition: all var(--lp-dur) var(--lp-ease);
        }
        .lp-input::placeholder { color: var(--lp-muted-deep); }
        .lp-input:focus {
          border-color: rgba(249,115,22,0.55);
          background: rgba(10,12,18,0.9);
          box-shadow: 0 0 0 3px rgba(249,115,22,0.12), 0 0 18px rgba(249,115,22,0.18);
        }

        /* Forgot link */
        .lp-forgot {
          display: block; text-align: right; margin: -4px 0 18px;
          font-family: var(--lp-font-mono); font-size: 10px;
          color: var(--lp-muted); letter-spacing: 0.08em; text-transform: uppercase;
          background: none; border: none; cursor: pointer; padding: 0;
          transition: color var(--lp-dur);
        }
        .lp-forgot:hover { color: var(--lp-orange); }

        /* Submit */
        .lp-submit {
          width: 100%; padding: 13px 20px;
          background: linear-gradient(180deg, #f97316 0%, #e5650c 100%);
          border: none; border-radius: 8px; color: #fff;
          font-family: var(--lp-font-display); font-weight: 700; font-size: 13px;
          letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 10px;
          transition: transform var(--lp-dur) var(--lp-ease), box-shadow var(--lp-dur) var(--lp-ease), background var(--lp-dur);
          box-shadow: 0 4px 14px rgba(249,115,22,0.32), inset 0 1px 0 rgba(255,255,255,0.18);
        }
        .lp-submit:disabled {
          background: rgba(30,35,48,0.8); color: #475569; cursor: default;
          box-shadow: none; transform: none;
        }
        .lp-submit:not(:disabled):hover {
          background: linear-gradient(180deg, #fb923c 0%, #f97316 100%);
          transform: translateY(-1px) scale(1.01);
          box-shadow: 0 6px 22px rgba(249,115,22,0.45), inset 0 1px 0 rgba(255,255,255,0.22);
        }
        .lp-submit:not(:disabled):active { transform: translateY(0) scale(0.99); }
        .lp-submit-arrow { transition: transform 0.2s var(--lp-ease); }
        .lp-submit:not(:disabled):hover .lp-submit-arrow { transform: translateX(3px); }

        /* Aux text */
        .lp-aux {
          margin-top: 16px; text-align: center;
          font-family: var(--lp-font-body); font-size: 12px; color: var(--lp-muted);
        }
        .lp-aux-link {
          color: var(--lp-orange); text-decoration: none; font-weight: 600;
          cursor: pointer; transition: color var(--lp-dur);
        }
        .lp-aux-link:hover { color: var(--lp-orange-hover); }

        /* Messages */
        .lp-msg {
          font-size: 12px; border-radius: 6px; padding: 8px 12px;
        }
        .lp-msg--error {
          color: #f87171;
          background: rgba(248,113,113,0.07);
          border: 1px solid rgba(248,113,113,0.15);
        }
        .lp-msg--success {
          color: #4ade80;
          background: rgba(74,222,128,0.07);
          border: 1px solid rgba(74,222,128,0.15);
        }

        /* ── Footer ── */
        .lp-footer {
          position: relative; z-index: 2;
          padding: 18px 32px;
          border-top: 1px solid var(--lp-border);
          background: rgba(8,9,13,0.6);
          backdrop-filter: blur(8px);
        }
        .lp-footer-inner {
          max-width: 1200px; margin: 0 auto; text-align: center;
          font-family: var(--lp-font-mono); font-size: 10px;
          color: var(--lp-muted-soft); letter-spacing: 0.16em; text-transform: uppercase;
        }
        .lp-footer-inner .lp-flame { color: var(--lp-orange); margin-right: 6px; }

        /* ── Responsive ── */
        @media (max-width: 880px) {
          .lp-grid {
            grid-template-columns: 1fr;
            gap: 40px; max-width: 480px;
          }
          .lp-hud { display: none; }
          .lp-main { padding: 40px 20px 56px; min-height: 0; }
        }
        @media (max-width: 640px) {
          .lp-header-inner { padding: 12px 20px; gap: 12px; }
          .lp-logo-tag { display: none; }
          .lp-status { font-size: 9px; padding: 5px 10px 5px 8px; }
          .lp-h1 { font-size: clamp(34px, 9vw, 44px); }
          .lp-sub { font-size: 15px; }
          .lp-stats { gap: 8px; }
          .lp-stat { padding: 7px 12px 7px 10px; }
          .lp-auth { padding: 24px 20px 22px; }
          .lp-eyebrow { margin-bottom: 22px; }
        }
        @media (max-width: 420px) {
          .lp-status-meta { display: none; }
        }
      `}</style>

      {/* ── Atmosfera ── */}
      <div className="lp-atmosphere" aria-hidden="true">
        <div className="lp-hex" />
        <div className="lp-radial" />
        {/* HUD decorativo — geométrico atrás do hero */}
        <div className="lp-hud">
          <svg viewBox="0 0 720 620" fill="none" stroke="#f97316" strokeWidth="1">
            <polygon points="360,80 600,310 360,540 120,310" strokeOpacity="0.35"/>
            <polygon points="360,160 520,310 360,460 200,310" strokeOpacity="0.25"/>
            <circle cx="360" cy="310" r="8" strokeOpacity="0.7" fill="#f97316" fillOpacity="0.4"/>
            <circle cx="360" cy="310" r="22" strokeOpacity="0.5"/>
            <circle cx="360" cy="310" r="80" strokeOpacity="0.18" strokeDasharray="3 5"/>
            <line x1="360" y1="200" x2="360" y2="240" strokeOpacity="0.6"/>
            <line x1="360" y1="380" x2="360" y2="420" strokeOpacity="0.6"/>
            <line x1="250" y1="310" x2="290" y2="310" strokeOpacity="0.6"/>
            <line x1="430" y1="310" x2="470" y2="310" strokeOpacity="0.6"/>
            <polyline points="40,200 40,140 100,140" strokeOpacity="0.5"/>
            <polyline points="680,420 680,480 620,480" strokeOpacity="0.5"/>
            <polyline points="40,420 40,480 100,480" strokeOpacity="0.3"/>
            <polyline points="680,200 680,140 620,140" strokeOpacity="0.3"/>
            <line x1="360" y1="80" x2="360" y2="60" strokeOpacity="0.6"/>
            <line x1="600" y1="310" x2="620" y2="310" strokeOpacity="0.6"/>
            <line x1="360" y1="540" x2="360" y2="560" strokeOpacity="0.6"/>
            <line x1="120" y1="310" x2="100" y2="310" strokeOpacity="0.6"/>
            <text x="384" y="318" fill="#f97316" fillOpacity="0.55" stroke="none"
              fontFamily="JetBrains Mono, monospace" fontSize="9" letterSpacing="2">PAS · 2025</text>
          </svg>
        </div>
      </div>
      <div className="lp-scan" aria-hidden="true" />

      {/* ── Header ── */}
      <header className="lp-header">
        <div className="lp-header-inner">
          <a className="lp-logo" href="/">
            <div className="lp-logo-mark"><span>🔥</span></div>
            <div className="lp-logo-text">
              <div className="lp-logo-name">XAMA</div>
              <div className="lp-logo-tag">Fantasy League</div>
            </div>
          </a>
          <div className="lp-status">
            <span className="lp-status-dot" />
            <span className="lp-status-live">LIVE</span>
            <span className="lp-status-sep lp-status-meta">—</span>
            <span className="lp-status-meta">PAS 2025</span>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="lp-main">
        <div className="lp-grid">

          {/* Hero */}
          <section className="lp-hero">
            <div className="lp-eyebrow">
              <span className="lp-eyebrow-line" />
              <span className="lp-eyebrow-text">PUBG Esports Fantasy</span>
            </div>

            <h1 className="lp-h1">
              <span className="lp-h1-line lp-h1-muted">Monte seu time.</span>
              <span className="lp-h1-line"><em>Domine</em> o ranking.</span>
            </h1>

            <p className="lp-sub">
              Escolha jogadores reais das competições globais de PUBG. Acompanhe stats ao vivo e suba no leaderboard.
            </p>

            <div className="lp-stats">
              {/* Jogadores */}
              <div className="lp-stat">
                <span className="lp-stat-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                </span>
                <span className="lp-stat-num">262+</span>
                <span className="lp-stat-label">Jogadores</span>
              </div>
              {/* Stages */}
              <div className="lp-stat">
                <span className="lp-stat-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/>
                    <line x1="12" y1="22" x2="12" y2="15.5"/>
                    <polyline points="22 8.5 12 15.5 2 8.5"/>
                    <line x1="2" y1="15.5" x2="12" y2="9"/>
                    <line x1="22" y1="15.5" x2="12" y2="9"/>
                  </svg>
                </span>
                <span className="lp-stat-num">9</span>
                <span className="lp-stat-label">Stages</span>
              </div>
              {/* Partidas */}
              <div className="lp-stat">
                <span className="lp-stat-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <circle cx="12" cy="12" r="6"/>
                    <circle cx="12" cy="12" r="2" fill="currentColor"/>
                  </svg>
                </span>
                <span className="lp-stat-num">60</span>
                <span className="lp-stat-label">Partidas</span>
              </div>
            </div>
          </section>

          {/* Auth Card */}
          <AuthCard redirectTo={redirectTo} sessionExpiredMsg={sessionExpiredMsg} />
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <span className="lp-flame">🔥</span>
          XAMA Fantasy League — dados reais do PUBG Esports
        </div>
      </footer>
    </div>
  )
}
