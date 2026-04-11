// frontend/src/pages/Dashboard.jsx
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { API_BASE_URL } from '../config'
import Navbar from '../components/Navbar'
import { Card, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'

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
    .xama-open-card { transition: border-color 0.15s, transform 0.15s, box-shadow 0.15s; }
    .xama-open-card:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(249,115,22,0.15); }
    .xama-collapse-btn { background: none; border: none; cursor: pointer; display: flex; align-items: center; gap: 8px; padding: 0; color: var(--color-xama-muted); font-size: 21px; font-weight: 600; letter-spacing: 0.04em; transition: color 0.15s; }
    .xama-collapse-btn:hover { color: var(--color-xama-text); }
    .xama-collapse-chevron { transition: transform 0.2s ease; display: inline-block; }
    .xama-row-item { display: flex; align-items: center; gap: 14px; padding: 16px 20px; border-radius: var(--radius-inner); background: var(--surface-1); border: 1px solid var(--color-xama-border); transition: border-color 0.15s, background 0.15s; cursor: default; }
    .xama-row-item:hover { border-color: rgba(249,115,22,0.25); background: rgba(249,115,22,0.03); }
    .xama-row-item-clickable { cursor: pointer; }
    .xama-row-item-clickable:hover { border-color: rgba(249,115,22,0.35); background: rgba(249,115,22,0.05); }
    .xama-section-fade { animation: xamaFadeIn 0.25s ease both; }
  `
  document.head.appendChild(s)
}

const fmt1 = (v) => v != null ? Number(v).toFixed(1) : '—'

function CollapseSection({ title, icon, count, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ marginBottom: '36px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: open ? '16px' : '0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>{icon}</span>
          <span style={{
            fontSize: '19px', fontWeight: 700, letterSpacing: '0.07em',
            color: 'var(--color-xama-muted)', textTransform: 'uppercase',
          }}>{title}</span>
          <span style={{
            fontSize: '16px', fontWeight: 700, padding: '2px 10px',
            borderRadius: '20px', background: 'var(--surface-3)',
            color: 'var(--color-xama-muted)', fontFamily: 'JetBrains Mono, monospace',
          }}>{count}</span>
        </div>
        <button className="xama-collapse-btn" onClick={() => setOpen(o => !o)}>
          {open ? 'Recolher' : 'Expandir'}
          <span className="xama-collapse-chevron" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', fontSize: '14px' }}>▼</span>
        </button>
      </div>
      {open && <div className="xama-section-fade">{children}</div>}
    </div>
  )
}

export default function Dashboard() {
  const { token } = useAuth()
  const navigate  = useNavigate()
  const H = { Authorization: `Bearer ${token}` }

  const [user,    setUser]    = useState(null)
  const [stages,  setStages]  = useState([])
  const [myLineups, setMyLineups] = useState({}) // { [stage_id]: lineup }
  const [loading, setLoading] = useState(true)

  // ── Usuário ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return
    fetch(`${API_BASE_URL}/auth/me`, { headers: H })
      .then(r => r.ok ? r.json() : null)
      .then(setUser)
      .catch(() => {})
  }, [token])

  // ── Stages ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API_BASE_URL}/stages/`)
      .then(r => r.json())
      .then(data => setStages(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // ── Meus lineups (para stages abertas) ────────────────────────────────────
  useEffect(() => {
    if (!token) return
    const openStages = stages.filter(s => s.lineup_status === 'open')
    openStages.forEach(s => {
      fetch(`${API_BASE_URL}/lineups/stage/${s.id}`, { headers: H })
        .then(r => r.ok ? r.json() : [])
        .then(lineups => {
          if (lineups.length > 0)
            setMyLineups(prev => ({ ...prev, [s.id]: lineups[0] }))
        })
        .catch(() => {})
    })
  }, [stages, token])

  // ── Derived ────────────────────────────────────────────────────────────────
  const openStages    = useMemo(() => stages.filter(s => s.lineup_status === 'open'),   [stages])
  const closedStages  = useMemo(() => stages.filter(s => s.lineup_status === 'closed'), [stages])
  const lockedStages  = useMemo(() => stages.filter(s => s.lineup_status === 'locked'), [stages])

  const displayName = user?.display_name || user?.username
    || (user?.email ? user.email.split('@')[0] : 'jogador')

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

        {/* Saudação */}
        <div style={{ marginBottom: '44px' }}>
          <h1 style={{
            fontSize: '42px', fontWeight: 800, color: '#fff',
            margin: '0 0 10px', letterSpacing: '-0.02em',
            fontFamily: 'Rajdhani, sans-serif', lineHeight: 1.1,
          }}>
            Olá, {displayName.toUpperCase()} 👋
          </h1>
          <p style={{ fontSize: '22px', color: 'var(--color-xama-muted)', margin: 0 }}>
            Bem-vindo ao XAMA Fantasy — aqui está o resumo do seu fantasy.
          </p>
        </div>

        {/* ── SEÇÃO 1 — LINEUP ABERTA ── */}
        {openStages.length > 0 && (
          <div style={{ marginBottom: '48px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
              <span style={{ fontSize: '20px' }}>⚡</span>
              <span style={{ fontSize: '19px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--color-xama-orange)', textTransform: 'uppercase' }}>
                Lineup Aberta
              </span>
              <span style={{
                fontSize: '16px', fontWeight: 700, padding: '2px 10px',
                borderRadius: '20px', background: 'rgba(249,115,22,0.15)',
                color: 'var(--color-xama-orange)', fontFamily: 'JetBrains Mono, monospace',
              }}>{openStages.length}</span>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${Math.min(openStages.length, 3)}, 1fr)`,
              gap: '16px',
            }}>
              {openStages.map(s => {
                const lineup    = myLineups[s.id]
                const hasLineup = !!lineup
                return (
                  <div key={s.id} className="xama-open-card" style={{
                    background: 'var(--surface-1)',
                    border: `1px solid ${hasLineup ? 'rgba(74,222,128,0.25)' : 'rgba(249,115,22,0.35)'}`,
                    borderRadius: 'var(--radius-card)',
                    padding: '28px 24px 24px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    position: 'relative', overflow: 'hidden',
                  }}>
                    <div style={{
                      position: 'absolute', top: 0, right: 0,
                      width: '200px', height: '200px',
                      background: hasLineup
                        ? 'radial-gradient(circle, rgba(74,222,128,0.06) 0%, transparent 70%)'
                        : 'radial-gradient(circle, rgba(249,115,22,0.08) 0%, transparent 70%)',
                      pointerEvents: 'none',
                    }} />

                    <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="xama-pulse" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-xama-orange)', display: 'inline-block' }} />
                        <span style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--color-xama-orange)', textTransform: 'uppercase' }}>ABERTA</span>
                      </span>
                      {s.lineup_close_at && (
                        <span style={{ fontSize: '13px', color: 'var(--color-xama-muted)' }}>
                          Fecha {new Date(s.lineup_close_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                        </span>
                      )}
                    </div>

                    <div style={{
                      fontSize: '30px', fontWeight: 700, color: 'var(--color-xama-text)',
                      lineHeight: 1.2, marginTop: '16px', marginBottom: '20px',
                      fontFamily: 'Rajdhani, sans-serif', letterSpacing: '-0.01em',
                      textAlign: 'center', width: '100%',
                    }}>{s.name}</div>

                    {hasLineup ? (
                      <div style={{ width: '100%' }}>
                        <div style={{
                          background: 'var(--surface-2)', borderRadius: 'var(--radius-inner)',
                          padding: '16px 18px', display: 'flex', flexDirection: 'column',
                          gap: '12px', marginBottom: '18px',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '19px', color: 'var(--color-xama-muted)' }}>Lineup</span>
                            <span style={{ fontSize: '19px', color: 'var(--color-xama-green)', fontWeight: 600 }}>✅ Montada</span>
                          </div>
                          {lineup.total_points != null && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '19px', color: 'var(--color-xama-muted)' }}>Pontos totais</span>
                              <span style={{ fontSize: '24px', color: 'var(--color-xama-orange)', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>
                                {fmt1(lineup.total_points)} pts
                              </span>
                            </div>
                          )}
                        </div>
                        <Button variant="primary" size="md" full onClick={() => navigate(`/tournament/${s.id}`)}>
                          VER TORNEIO
                        </Button>
                      </div>
                    ) : (
                      <div style={{ width: '100%' }}>
                        <p style={{ fontSize: '19px', color: 'var(--color-xama-muted)', margin: '0 0 18px', lineHeight: 1.5, textAlign: 'center' }}>
                          Lineup ainda não montada.
                        </p>
                        <Button variant="primary" size="md" full onClick={() => navigate(`/tournament/${s.id}`)}>
                          MONTAR LINEUP
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── SEÇÃO 2 — AGUARDANDO ABERTURA ── */}
        {closedStages.length > 0 && (
          <CollapseSection title="Aguardando Abertura" icon="📅" count={closedStages.length} defaultOpen={false}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {closedStages.map(s => (
                <div key={s.id} className="xama-row-item">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '22px', fontWeight: 600, color: 'var(--color-xama-text)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      fontFamily: 'Rajdhani, sans-serif',
                    }}>{s.name}</div>
                    <div style={{ fontSize: '16px', color: 'var(--color-xama-muted)', marginTop: '2px' }}>
                      {s.lineup_open_at
                        ? `Abre ${new Date(s.lineup_open_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`
                        : 'Lineup será liberada em breve'}
                    </div>
                  </div>
                  <span style={{ fontSize: '16px', color: 'var(--color-xama-muted)', fontWeight: 600 }}>⏳ EM BREVE</span>
                </div>
              ))}
            </div>
          </CollapseSection>
        )}

        {/* ── SEÇÃO 3 — RESULTADOS (locked) ── */}
        {lockedStages.length > 0 && (
          <CollapseSection title="Resultados" icon="📊" count={lockedStages.length} defaultOpen={false}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {lockedStages.map(s => (
                <div
                  key={s.id}
                  className="xama-row-item xama-row-item-clickable"
                  onClick={() => navigate(`/tournament/${s.id}`)}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '22px', fontWeight: 600, color: 'var(--color-xama-text)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      fontFamily: 'Rajdhani, sans-serif',
                    }}>{s.name}</div>
                    <div style={{ fontSize: '16px', color: 'var(--color-xama-muted)', marginTop: '2px', display: 'flex', gap: '12px' }}>
                      {(s.start_date || s.lineup_open_at) && (
                        <span>
                          {new Date(s.start_date || s.lineup_open_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                          {(s.end_date || s.lineup_close_at) && ` – ${new Date(s.end_date || s.lineup_close_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`}
                        </span>
                      )}
                      {s.days_count != null && <span>{s.days_count} dias</span>}
                      {s.matches_count != null && <span>{s.matches_count} partidas</span>}
                      {!(s.start_date || s.lineup_open_at) && !(s.days_count) && <span>Encerrado</span>}
                    </div>
                  </div>
                  <span style={{ color: 'var(--color-xama-muted)', fontSize: '20px' }}>›</span>
                </div>
              ))}
            </div>
          </CollapseSection>
        )}

        {/* Empty state */}
        {stages.length === 0 && (
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
