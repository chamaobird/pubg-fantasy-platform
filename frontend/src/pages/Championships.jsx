// frontend/src/pages/Championships.jsx
// XAMA Fantasy — Listagem de championships com stages aninhadas
// Consome: GET /championships/?include_inactive=true
// Navega para: /tournament/:stageId (TournamentHub)

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { API_BASE_URL } from '../config'

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS = {
  open:     { bg: 'rgba(74,222,128,0.1)',  border: 'rgba(74,222,128,0.3)',  color: '#4ade80', label: 'ABERTO' },
  locked:   { bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.3)', color: '#6b7280', label: 'ENCERRADO' },
  closed:   { bg: 'rgba(249,115,22,0.1)',  border: 'rgba(249,115,22,0.3)',  color: '#f97316', label: 'EM BREVE' },
}

function statusStyle(lineup_status) {
  return STATUS[lineup_status] || STATUS.closed
}

// ── Tournament Logo ───────────────────────────────────────────────────────────

const LOGO_CANDIDATES = {
  PGS: ['/logos/Tournaments/PGS.webp', '/logos/Tournaments/PGS.png'],
  PAS: ['/logos/Tournaments/PAS.png'],
}

function ChampLogo({ name = '', size = 48 }) {
  const upper = name.toUpperCase()
  const key = upper.includes('PGS') || upper.includes('PGC') || upper.includes('PUBG') || upper.includes('GLOBAL SERIES') ? 'PGS'
    : upper.includes('PAS') ? 'PAS'
    : null
  const candidates = key ? LOGO_CANDIDATES[key] : []
  const [idx, setIdx] = useState(0)
  const [failed, setFailed] = useState(false)

  const fallbackEmoji = upper.includes('PGS') || upper.includes('PGC') ? '🏆' : '🥇'

  if (!key || failed || candidates.length === 0) {
    return (
      <span style={{ fontSize: size * 0.7, lineHeight: 1 }}>{fallbackEmoji}</span>
    )
  }

  return (
    <div style={{
      width: size, height: size, borderRadius: 10, flexShrink: 0,
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    }}>
      <img
        src={candidates[idx]}
        alt=""
        draggable={false}
        style={{ width: size * 0.78, height: size * 0.78, objectFit: 'contain' }}
        onError={() => idx + 1 < candidates.length ? setIdx(i => i + 1) : setFailed(true)}
      />
    </div>
  )
}

// ── StageRow ──────────────────────────────────────────────────────────────────

function StageRow({ stage, navigate }) {
  const st = statusStyle(stage.lineup_status)
  const isOpen = stage.lineup_status === 'open'

  return (
    <div
      onClick={() => navigate(`/tournament/${stage.id}`)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px',
        background: isOpen ? 'rgba(74,222,128,0.03)' : 'rgba(255,255,255,0.01)',
        border: `1px solid ${isOpen ? 'rgba(74,222,128,0.15)' : 'var(--color-xama-border)'}`,
        borderRadius: 8, cursor: 'pointer',
        transition: 'border-color 0.15s, background 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = isOpen ? 'rgba(74,222,128,0.4)' : 'rgba(249,115,22,0.3)'
        e.currentTarget.style.background = isOpen ? 'rgba(74,222,128,0.06)' : 'rgba(249,115,22,0.04)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = isOpen ? 'rgba(74,222,128,0.15)' : 'var(--color-xama-border)'
        e.currentTarget.style.background = isOpen ? 'rgba(74,222,128,0.03)' : 'rgba(255,255,255,0.01)'
      }}
    >
      <span style={{
        fontSize: 15, fontWeight: 600,
        color: 'var(--color-xama-text)',
        fontFamily: "'Rajdhani', sans-serif",
      }}>
        {stage.name}
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {stage.short_name && (
          <span style={{
            fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
            fontFamily: "'JetBrains Mono', monospace",
            color: 'var(--color-xama-muted)',
          }}>
            {stage.short_name}
          </span>
        )}
        <span style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
          padding: '3px 8px', borderRadius: 4,
          background: st.bg, border: `1px solid ${st.border}`, color: st.color,
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {st.label}
        </span>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-xama-orange)' }}>→</span>
      </div>
    </div>
  )
}

// ── ChampionshipCard ──────────────────────────────────────────────────────────

function ChampionshipCard({ championship, navigate }) {
  const hasOpen = championship.stages.some(s => s.lineup_status === 'open')
  const allLocked = championship.stages.every(s => s.lineup_status === 'locked')

  // Ordena: open primeiro, depois por id decrescente (mais recente primeiro)
  const stageOrder = { open: 0, closed: 1, locked: 2 }
  const sortedStages = [...championship.stages].sort((a, b) => {
    const statusDiff = (stageOrder[a.lineup_status] ?? 3) - (stageOrder[b.lineup_status] ?? 3)
    if (statusDiff !== 0) return statusDiff
    return b.id - a.id  // mais recente primeiro dentro do mesmo status
  })

  return (
    <div style={{
      background: 'var(--color-xama-surface)',
      border: `1px solid ${hasOpen ? 'rgba(74,222,128,0.2)' : 'var(--color-xama-border)'}`,
      borderRadius: 12, overflow: 'hidden',
      position: 'relative',
    }}>
      {hasOpen && (
        <div style={{ height: 2, background: 'linear-gradient(90deg, #4ade80, transparent 60%)' }} />
      )}

      {/* Header */}
      <div style={{ padding: '20px 20px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <ChampLogo name={championship.name} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 22, fontWeight: 700, color: 'var(--color-xama-text)',
            fontFamily: "'Rajdhani', sans-serif", lineHeight: 1.2,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {championship.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-xama-muted)', marginTop: 3 }}>
            {championship.stages.length} stage{championship.stages.length !== 1 ? 's' : ''}
            {hasOpen && (
              <span style={{ marginLeft: 8, color: '#4ade80', fontWeight: 700 }}>• lineup aberto</span>
            )}
            {allLocked && (
              <span style={{ marginLeft: 8, color: '#6b7280' }}>• encerrado</span>
            )}
          </div>
        </div>
      </div>

      {/* Stages */}
      {sortedStages.length > 0 ? (
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sortedStages.map(stage => (
            <StageRow key={stage.id} stage={stage} navigate={navigate} />
          ))}
        </div>
      ) : (
        <div style={{ padding: '0 16px 16px', color: 'var(--color-xama-muted)', fontSize: 13, fontStyle: 'italic' }}>
          Nenhuma stage cadastrada.
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Championships() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const [championships, setChampionships] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`${API_BASE_URL}/championships/?include_inactive=true`)
      .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then(data => { setChampionships(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => { setError('Erro ao carregar campeonatos'); setLoading(false) })
  }, [])

  // Separa ativos (alguma stage não locked) de encerrados (todas locked ou sem stages)
  const active   = championships.filter(c => c.stages.some(s => s.lineup_status !== 'locked'))
  const finished = championships.filter(c => c.stages.length === 0 || c.stages.every(s => s.lineup_status === 'locked'))

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-xama-black)', fontFamily: "'Rajdhani', sans-serif" }}>
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse 70% 40% at 50% 0%, rgba(249,115,22,0.04) 0%, transparent 60%)',
      }} />

      {/* Navbar */}
      <header style={{ position: 'relative', zIndex: 1, background: 'var(--color-xama-surface)', borderBottom: '1px solid var(--color-xama-border)' }}>
        <div style={{ height: 2, background: 'linear-gradient(90deg, var(--color-xama-orange), transparent 50%)' }} />
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', gap: 16, height: 70 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => navigate('/dashboard')}>
            <div style={{
              width: 40, height: 40, fontSize: 20,
              background: 'linear-gradient(135deg, rgba(249,115,22,0.25), rgba(249,115,22,0.05))',
              border: '1px solid rgba(249,115,22,0.3)', borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>🔥</div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-xama-text)', letterSpacing: '0.06em', lineHeight: 1 }}>XAMA</div>
              <div style={{ fontSize: 11, color: 'var(--color-xama-orange)', letterSpacing: '0.16em', textTransform: 'uppercase', lineHeight: 1 }}>Fantasy</div>
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <nav style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {[
              { label: 'Dashboard',    path: '/dashboard'      },
              { label: 'Campeonatos',  path: '/championships'  },
              { label: '👤 Perfil',   path: '/profile'        },
            ].map(({ label, path }) => {
              const isHere = path === '/championships'
              return (
                <button key={path} onClick={() => navigate(path)} style={{
                  background: isHere ? 'rgba(249,115,22,0.1)' : 'none',
                  border: isHere ? '1px solid rgba(249,115,22,0.3)' : 'none',
                  borderRadius: 6, padding: '8px 16px',
                  fontSize: 17, fontWeight: isHere ? 700 : 600,
                  color: isHere ? 'var(--color-xama-orange)' : 'var(--color-xama-muted)',
                  cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif",
                  letterSpacing: '0.04em',
                }}>
                  {label}
                </button>
              )
            })}
            <button onClick={logout} style={{
              background: 'none', border: '1px solid var(--color-xama-border)',
              borderRadius: 6, padding: '8px 18px', fontSize: 16, fontWeight: 600,
              color: 'var(--color-xama-muted)', cursor: 'pointer',
              fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.06em',
            }}>Sair</button>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main style={{ position: 'relative', zIndex: 1, maxWidth: 1000, margin: '0 auto', padding: '48px 24px' }}>
        <div style={{ marginBottom: 36 }}>
          <div style={{
            fontSize: 13, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase',
            color: 'var(--color-xama-orange)', fontFamily: "'JetBrains Mono', monospace", marginBottom: 6,
          }}>
            XAMA Fantasy
          </div>
          <h1 style={{ fontSize: 42, fontWeight: 700, color: 'var(--color-xama-text)', margin: 0, fontFamily: "'Rajdhani', sans-serif", letterSpacing: '-0.01em' }}>
            Campeonatos
          </h1>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: 80, color: 'var(--color-xama-muted)', fontSize: 18 }}>
            Carregando campeonatos…
          </div>
        )}
        {error && <div className="msg-error">{error}</div>}

        {!loading && !error && (
          <>
            {/* Ativos */}
            {active.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 48 }}>
                {active.map(c => (
                  <ChampionshipCard key={c.id} championship={c} navigate={navigate} />
                ))}
              </div>
            ) : (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--color-xama-muted)', fontSize: 18 }}>
                Nenhum campeonato ativo no momento.
              </div>
            )}

            {/* Encerrados — colapsável */}
            {finished.length > 0 && (
              <div>
                <button
                  onClick={() => setShowInactive(v => !v)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '0 0 16px 0', width: '100%',
                  }}
                >
                  <div style={{ flex: 1, height: 1, background: 'var(--color-xama-border)' }} />
                  <span style={{
                    fontSize: 13, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase',
                    color: 'var(--color-xama-muted)', fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap',
                  }}>
                    {showInactive ? '▲' : '▼'} &nbsp;Encerrados ({finished.length})
                  </span>
                  <div style={{ flex: 1, height: 1, background: 'var(--color-xama-border)' }} />
                </button>

                {showInactive && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: 0.65 }}>
                    {finished.map(c => (
                      <ChampionshipCard key={c.id} championship={c} navigate={navigate} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
