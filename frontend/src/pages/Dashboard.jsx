// frontend/src/pages/Dashboard.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { API_BASE_URL as API_BASE } from '../config'
import Navbar from '../components/Navbar'
import { Card, CardDivider, CardTitle, CardSub } from '../components/ui/Card'
import { Badge, StatusBadge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { SectionTitle } from '../components/ui/SectionTitle'
import { StatRow } from '../components/ui/StatRow'

if (!document.getElementById('xama-fonts')) {
  const link = document.createElement('link')
  link.id = 'xama-fonts'; link.rel = 'stylesheet'
  link.href = 'https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=JetBrains+Mono:wght@400;600&display=swap'
  document.head.appendChild(link)
}

if (!document.getElementById('xama-dash-anim')) {
  const s = document.createElement('style')
  s.id = 'xama-dash-anim'
  s.textContent = `
    @keyframes xamaPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
    @keyframes xamaFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    .xama-pulse { animation: xamaPulse 1.8s ease-in-out infinite; }
    .xama-card-hover { transition: border-color 0.15s, transform 0.15s, box-shadow 0.15s; }
    .xama-card-hover:hover { border-color: rgba(249,115,22,0.5) !important; transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
    .xama-open-card { transition: border-color 0.15s, transform 0.15s, box-shadow 0.15s; }
    .xama-open-card:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(249,115,22,0.15); }
    .xama-collapse-btn { background: none; border: none; cursor: pointer; display: flex; align-items: center; gap: 8px; padding: 0; color: var(--color-xama-muted); font-size: 13px; font-weight: 600; letter-spacing: 0.04em; transition: color 0.15s; }
    .xama-collapse-btn:hover { color: var(--color-xama-text); }
    .xama-collapse-chevron { transition: transform 0.2s ease; display: inline-block; }
    .xama-row-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: var(--radius-inner); background: var(--surface-1); border: 1px solid var(--color-xama-border); transition: border-color 0.15s, background 0.15s; cursor: default; }
    .xama-row-item:hover { border-color: rgba(249,115,22,0.25); background: rgba(249,115,22,0.03); }
    .xama-row-item-clickable { cursor: pointer; }
    .xama-row-item-clickable:hover { border-color: rgba(249,115,22,0.35); background: rgba(249,115,22,0.05); }
    .xama-section-fade { animation: xamaFadeIn 0.25s ease both; }
    .xama-logo-pill { width: 36px; height: 36px; border-radius: 8px; background: var(--surface-2); border: 1px solid var(--color-xama-border); display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; }
    .xama-logo-pill img { width: 28px; height: 28px; object-fit: contain; }
    .xama-logo-pill-lg { width: 48px; height: 48px; border-radius: 10px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; }
    .xama-logo-pill-lg img { width: 38px; height: 38px; object-fit: contain; }
  `
  document.head.appendChild(s)
}

// ─── Logo resolution ─────────────────────────────────────────────────────────
const LOGO_MAP = {
  PGS: '/logos/Tournaments/PGS.png',
  PAS: '/logos/Tournaments/PAS.png',
}

function resolveLogo(name = '') {
  const upper = name.toUpperCase()
  if (upper.includes('PGS')) return LOGO_MAP.PGS
  if (upper.includes('PAS')) return LOGO_MAP.PAS
  return null
}

function TournamentLogo({ name, size = 'sm' }) {
  const src = resolveLogo(name)
  const cls = size === 'lg' ? 'xama-logo-pill-lg' : 'xama-logo-pill'
  if (!src) return null
  return (
    <div className={cls}>
      <img src={src} alt="" draggable={false} />
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt1 = (v) => v != null ? Number(v).toFixed(1) : '—'

function CollapseSection({ title, icon, count, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ marginBottom: '36px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: open ? '16px' : '0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '15px' }}>{icon}</span>
          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--color-xama-muted)', textTransform: 'uppercase' }}>
            {title}
          </span>
          <span style={{
            fontSize: '10px', fontWeight: 700, padding: '2px 7px',
            borderRadius: '20px', background: 'var(--surface-3)',
            color: 'var(--color-xama-muted)', fontFamily: 'JetBrains Mono, monospace',
          }}>{count}</span>
        </div>
        <button className="xama-collapse-btn" onClick={() => setOpen(o => !o)}>
          {open ? 'Recolher' : 'Expandir'}
          <span className="xama-collapse-chevron" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', fontSize: '10px' }}>▼</span>
        </button>
      </div>
      {open && <div className="xama-section-fade">{children}</div>}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const { token } = useAuth()
  const navigate  = useNavigate()
  const H = { Authorization: `Bearer ${token}` }

  const [user,      setUser]      = useState(null)
  const [open,      setOpen]      = useState([])
  const [soon,      setSoon]      = useState([])
  const [finished,  setFinished]  = useState([])
  const [myLineups, setMyLineups] = useState({})
  const [rankings,  setRankings]  = useState({})
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    if (!token) return
    fetch(`${API_BASE}/users/me`, { headers: H })
      .then(r => r.ok ? r.json() : null)
      .then(setUser)
      .catch(() => {})
  }, [token])

  useEffect(() => {
    fetch(`${API_BASE}/tournaments/`)
      .then(r => r.json())
      .then(all => {
        setOpen(all.filter(t => t.status === 'active' && t.lineup_open))
        setSoon(all.filter(t => t.status === 'active' && !t.lineup_open))
        setFinished(all.filter(t => t.status === 'finished'))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!token || open.length === 0) return
    open.forEach(t => {
      fetch(`${API_BASE}/tournaments/${t.id}/lineups/me`, { headers: H })
        .then(r => r.ok ? r.json() : [])
        .then(lineups => {
          if (lineups.length > 0)
            setMyLineups(prev => ({ ...prev, [t.id]: lineups[0] }))
        })
        .catch(() => {})
    })
  }, [open, token])

  useEffect(() => {
    if (!user) return
    const all = [...open, ...finished]
    all.forEach(t => {
      fetch(`${API_BASE}/tournaments/${t.id}/rankings`)
        .then(r => r.json())
        .then(rank => {
          const entry = rank.find(e => e.user_id === user.id)
          if (entry) setRankings(prev => ({ ...prev, [t.id]: entry }))
        })
        .catch(() => {})
    })
  }, [user, open, finished])

  const displayName = user?.display_name || user?.username || 'jogador'
  const myFinished  = finished.filter(t => rankings[t.id])

  if (loading) return (
    <div className="xama-page">
      <Navbar />
      <div className="xama-loading" style={{ flex: 1 }}>Carregando dashboard...</div>
    </div>
  )

  return (
    <div className="xama-page">
      <Navbar />

      <div className="xama-container" style={{ flex: 1, paddingTop: '36px', paddingBottom: '64px' }}>

        {/* ── Saudação ── */}
        <div style={{ marginBottom: '40px' }}>
          <h1 style={{
            fontSize: 'var(--fs-page-title)', fontWeight: 800, color: '#fff',
            margin: '0 0 6px', letterSpacing: '-0.01em',
          }}>
            Olá, {displayName.toUpperCase()} 👋
          </h1>
          <p style={{ fontSize: 'var(--fs-body)', color: 'var(--color-xama-muted)', margin: 0 }}>
            Bem-vindo ao XAMA Fantasy — aqui está o resumo do seu fantasy.
          </p>
        </div>

        {/* ══════════════════════════════════════════════
            SEÇÃO 1 — LINEUP ABERTA (destaque máximo)
        ══════════════════════════════════════════════ */}
        {open.length > 0 && (
          <div style={{ marginBottom: '44px' }}>
            {/* Header da seção */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <span style={{ fontSize: '15px' }}>⚡</span>
              <span style={{
                fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em',
                color: 'var(--color-xama-orange)', textTransform: 'uppercase',
              }}>
                Lineup Aberta
              </span>
              <span style={{
                fontSize: '10px', fontWeight: 700, padding: '2px 7px',
                borderRadius: '20px', background: 'rgba(249,115,22,0.15)',
                color: 'var(--color-xama-orange)', fontFamily: 'JetBrains Mono, monospace',
              }}>{open.length}</span>
            </div>

            {/* Grid de cards destacados */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '16px',
            }}>
              {open.map(t => {
                const lineup    = myLineups[t.id]
                const rankEntry = rankings[t.id]
                const hasLineup = !!lineup
                return (
                  <div
                    key={t.id}
                    className="xama-open-card"
                    style={{
                      background: 'var(--surface-1)',
                      border: `1px solid ${hasLineup ? 'rgba(74,222,128,0.25)' : 'rgba(249,115,22,0.35)'}`,
                      borderRadius: 'var(--radius-card)',
                      padding: '20px',
                      display: 'flex',
                      flexDirection: 'column',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Glow de fundo sutil */}
                    <div style={{
                      position: 'absolute', top: 0, right: 0,
                      width: '120px', height: '120px',
                      background: hasLineup
                        ? 'radial-gradient(circle, rgba(74,222,128,0.06) 0%, transparent 70%)'
                        : 'radial-gradient(circle, rgba(249,115,22,0.08) 0%, transparent 70%)',
                      pointerEvents: 'none',
                    }} />

                    {/* Topo: badge + região + logo */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span
                            className="xama-pulse"
                            style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-xama-orange)', display: 'inline-block' }}
                          />
                          <span style={{
                            fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em',
                            color: 'var(--color-xama-orange)', textTransform: 'uppercase',
                          }}>ABERTA</span>
                        </span>
                        {t.region && (
                          <span style={{
                            fontSize: '10px', fontWeight: 600,
                            color: 'var(--color-xama-muted)',
                            background: 'var(--surface-3)',
                            padding: '2px 7px', borderRadius: '4px',
                          }}>{t.region}</span>
                        )}
                      </div>
                      <TournamentLogo name={t.name} size="sm" />
                    </div>

                    {/* Nome do torneio */}
                    <div style={{
                      fontSize: '15px', fontWeight: 700,
                      color: 'var(--color-xama-text)',
                      lineHeight: 1.3, marginBottom: '16px',
                    }}>{t.name}</div>

                    {/* Stats ou estado */}
                    {hasLineup ? (
                      <>
                        <div style={{
                          background: 'var(--surface-2)',
                          borderRadius: 'var(--radius-inner)',
                          padding: '12px 14px',
                          display: 'flex', flexDirection: 'column', gap: '8px',
                          marginBottom: '14px',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', color: 'var(--color-xama-muted)' }}>Lineup</span>
                            <span style={{ fontSize: '12px', color: 'var(--color-xama-green)', fontWeight: 600 }}>✅ Montada</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', color: 'var(--color-xama-muted)' }}>Pontos totais</span>
                            <span style={{ fontSize: '13px', color: 'var(--color-xama-orange)', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>
                              {fmt1(lineup.total_points)} pts
                            </span>
                          </div>
                          {rankEntry && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '12px', color: 'var(--color-xama-muted)' }}>Posição</span>
                              <span style={{ fontSize: '13px', color: 'var(--color-xama-text)', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>
                                #{rankEntry.position}
                              </span>
                            </div>
                          )}
                        </div>
                        <Button variant="primary" size="md" full onClick={() => navigate(`/tournament/${t.id}`)}>
                          VER TORNEIO
                        </Button>
                      </>
                    ) : (
                      <>
                        <p style={{ fontSize: '13px', color: 'var(--color-xama-muted)', margin: '0 0 14px', lineHeight: 1.5 }}>
                          Lineup ainda não montada.
                        </p>
                        <Button variant="primary" size="md" full onClick={() => navigate(`/tournament/${t.id}`)}>
                          MONTAR LINEUP
                        </Button>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════
            SEÇÃO 2 — AGUARDANDO ABERTURA (colapsável)
        ══════════════════════════════════════════════ */}
        {soon.length > 0 && (
          <CollapseSection title="Aguardando Abertura" icon="📅" count={soon.length} defaultOpen={false}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {soon.map(t => (
                <div key={t.id} className="xama-row-item">
                  <TournamentLogo name={t.name} size="sm" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-xama-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {t.name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-xama-muted)', marginTop: '2px' }}>
                      Lineup será liberada em breve
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    {t.region && (
                      <span style={{
                        fontSize: '10px', fontWeight: 600, color: 'var(--color-xama-muted)',
                        background: 'var(--surface-3)', padding: '2px 7px', borderRadius: '4px',
                      }}>{t.region}</span>
                    )}
                    <span style={{ fontSize: '11px', color: 'var(--color-xama-muted)', fontWeight: 600 }}>⏳ EM BREVE</span>
                  </div>
                </div>
              ))}
            </div>
          </CollapseSection>
        )}

        {/* ══════════════════════════════════════════════
            SEÇÃO 3 — MEUS RESULTADOS (colapsável)
        ══════════════════════════════════════════════ */}
        {myFinished.length > 0 && (
          <CollapseSection title="Meus Resultados" icon="📊" count={myFinished.length} defaultOpen={false}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {myFinished.map(t => {
                const rankEntry = rankings[t.id]
                return (
                  <div
                    key={t.id}
                    className="xama-row-item xama-row-item-clickable"
                    onClick={() => navigate(`/tournament/${t.id}`)}
                  >
                    <TournamentLogo name={t.name} size="sm" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-xama-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {t.name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-xama-muted)', marginTop: '2px' }}>
                        Encerrado
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
                      {t.region && (
                        <span style={{
                          fontSize: '10px', fontWeight: 600, color: 'var(--color-xama-muted)',
                          background: 'var(--surface-3)', padding: '2px 7px', borderRadius: '4px',
                        }}>{t.region}</span>
                      )}
                      <div style={{ textAlign: 'right' }}>
                        <div style={{
                          fontSize: '13px', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace',
                          color: 'var(--color-xama-gold)',
                        }}>{fmt1(rankEntry.total_points)} pts</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-xama-muted)' }}>
                          #{rankEntry.position}
                        </div>
                      </div>
                      <span style={{ color: 'var(--color-xama-muted)', fontSize: '12px' }}>›</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </CollapseSection>
        )}

        {/* ── Empty state ── */}
        {open.length === 0 && soon.length === 0 && myFinished.length === 0 && (
          <Card variant="ghost" style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎮</div>
            <CardTitle>Nenhum torneio ativo no momento</CardTitle>
            <p style={{ color: 'var(--color-xama-muted)', marginTop: '8px' }}>
              Em breve novos torneios estarão disponíveis. Fique ligado!
            </p>
          </Card>
        )}

      </div>
    </div>
  )
}
