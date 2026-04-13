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
    .xama-row-item { display: flex; align-items: center; gap: 14px; padding: 14px 20px; border-radius: var(--radius-inner); background: var(--surface-1); border: 1px solid var(--color-xama-border); transition: border-color 0.15s, background 0.15s; cursor: default; }
    .xama-row-item:hover { border-color: rgba(249,115,22,0.25); background: rgba(249,115,22,0.03); }
    .xama-row-item-clickable { cursor: pointer; }
    .xama-row-item-clickable:hover { border-color: rgba(249,115,22,0.35); background: rgba(249,115,22,0.05); }
    .xama-section-fade { animation: xamaFadeIn 0.25s ease both; }
  `
  document.head.appendChild(s)
}

const fmt1 = (v) => v != null ? Number(v).toFixed(1) : '—'

// ── Helpers de data ──────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

// ── ChampLogo — logo do campeonato para cada row de stage ────────────────────

const LOGO_CANDIDATES = {
  PGS: ['/logos/Tournaments/PGS.webp', '/logos/Tournaments/PGS.png'],
  PAS: ['/logos/Tournaments/PAS.png'],
}

function StageChampLogo({ champName = '', size = 28 }) {
  const upper = (champName || '').toUpperCase()
  const key = upper.includes('PAS') ? 'PAS'
    : (upper.includes('PGS') || upper.includes('GLOBAL SERIES') || upper.includes('PGC')) ? 'PGS'
    : null
  const candidates = key ? LOGO_CANDIDATES[key] : []
  const [idx, setIdx] = useState(0)
  const [failed, setFailed] = useState(false)

  if (!key || failed || candidates.length === 0) {
    return <span style={{ fontSize: size * 0.75 }}>{upper.includes('PAS') ? '🥇' : '🏆'}</span>
  }

  return (
    <img
      src={candidates[idx]}
      alt=""
      draggable={false}
      onError={() => idx + 1 < candidates.length ? setIdx(i => i + 1) : setFailed(true)}
      style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }}
    />
  )
}

// ── CollapseSection ──────────────────────────────────────────────────────────

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

// ── StageRow — item usado nas seções Aguardando e Resultados ─────────────────

function StageRow({ stage, onClick, champName }) {
  const dateStr = (() => {
    const open = stage.lineup_open_at || stage.start_date
    const close = stage.lineup_close_at || stage.end_date
    if (open && close) return `${fmtDate(open)} – ${fmtDate(close)}`
    if (open) return fmtDate(open)
    return null
  })()

  return (
    <div
      className={onClick ? 'xama-row-item xama-row-item-clickable' : 'xama-row-item'}
      onClick={onClick}
    >
      {/* Logo do campeonato */}
      <div style={{ flexShrink: 0, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <StageChampLogo champName={champName} size={28} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '22px', fontWeight: 600, color: 'var(--color-xama-text)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          fontFamily: 'Rajdhani, sans-serif',
        }}>{stage.name}</div>
        <div style={{ fontSize: '13px', color: 'var(--color-xama-muted)', marginTop: '2px', display: 'flex', gap: '10px', alignItems: 'center' }}>
          {dateStr && (
            <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{dateStr}</span>
          )}
          {!dateStr && <span>Lineup será liberada em breve</span>}
          {stage.days_count != null && <span>{stage.days_count} dias</span>}
          {stage.matches_count != null && <span>{stage.matches_count} partidas</span>}
        </div>
      </div>

      {/* Badge de status */}
      {onClick ? (
        <span style={{ color: 'var(--color-xama-muted)', fontSize: '20px', flexShrink: 0 }}>›</span>
      ) : (
        <span style={{
          fontSize: '13px', fontWeight: 700, letterSpacing: '0.08em',
          padding: '3px 10px', borderRadius: 4, flexShrink: 0,
          background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)',
          color: 'var(--color-xama-orange)', fontFamily: 'JetBrains Mono, monospace',
        }}>⏳ EM BREVE</span>
      )}
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { token } = useAuth()
  const navigate  = useNavigate()
  const H = { Authorization: `Bearer ${token}` }

  const [user,      setUser]      = useState(null)
  const [stages,    setStages]    = useState([])
  // Mapa stageId → championship { id, name }
  const [champMap,  setChampMap]  = useState({})
  const [myLineups, setMyLineups] = useState({})
  const [loading,   setLoading]   = useState(true)

  // ── Usuário ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return
    fetch(`${API_BASE_URL}/auth/me`, { headers: H })
      .then(r => r.ok ? r.json() : null)
      .then(setUser)
      .catch(() => {})
  }, [token])

  // ── Stages + Championships ─────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE_URL}/stages/`).then(r => r.json()),
      fetch(`${API_BASE_URL}/championships/?include_inactive=true`).then(r => r.json()),
    ])
      .then(([stagesData, champsData]) => {
        setStages(Array.isArray(stagesData) ? stagesData : [])
        // Montar mapa stageId → championship
        const map = {}
        if (Array.isArray(champsData)) {
          champsData.forEach(c => {
            if (Array.isArray(c.stages)) {
              c.stages.forEach(s => { map[s.id] = { id: c.id, name: c.name } })
            }
          })
        }
        setChampMap(map)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // ── Meus lineups (stages abertas) ──────────────────────────────────────────
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
  // Ordena por data de abertura, do mais próximo/recente para o mais distante.
  // Dentro das seções, usamos mesma lógica: a partida mais cedo fica no topo.
  const sortByDate = (arr) => [...arr].sort((a, b) => {
    const da = new Date(a.lineup_open_at || a.start_date || '9999').getTime()
    const db = new Date(b.lineup_open_at || b.start_date || '9999').getTime()
    return da - db  // cronológico: menor data primeiro (mais próximo no topo)
  })

  const openStages   = useMemo(() => sortByDate(stages.filter(s => s.lineup_status === 'open')),   [stages])
  const closedStages = useMemo(() => sortByDate(stages.filter(s => s.lineup_status === 'closed')), [stages])
  const lockedStages = useMemo(() => sortByDate(stages.filter(s => s.lineup_status === 'locked')), [stages])

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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {openStages.map(s => {
                const lineup    = myLineups[s.id]
                const hasLineup = !!lineup
                const champ     = champMap[s.id]
                const dateStr   = (() => {
                  const open  = s.lineup_open_at || s.start_date
                  const close = s.lineup_close_at || s.end_date
                  if (open && close) return `${fmtDate(open)} – ${fmtDate(close)}`
                  if (open) return fmtDate(open)
                  return null
                })()
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
                      {dateStr && (
                        <span style={{ fontSize: '13px', color: 'var(--color-xama-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                          {dateStr}
                        </span>
                      )}
                    </div>

                    {/* Logo + nome do campeonato acima do nome da stage */}
                    {champ && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', width: '100%', justifyContent: 'center' }}>
                        <StageChampLogo champName={champ.name} size={22} />
                        <span style={{ fontSize: '11px', color: 'var(--color-xama-muted)', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.06em' }}>
                          {champ.name}
                        </span>
                      </div>
                    )}

                    <div style={{
                      fontSize: '30px', fontWeight: 700, color: 'var(--color-xama-text)',
                      lineHeight: 1.2, marginBottom: '20px',
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
          <CollapseSection title="Aguardando Abertura" icon="📅" count={closedStages.length} defaultOpen={true}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {closedStages.map(s => (
                <StageRow
                  key={s.id}
                  stage={s}
                  champName={champMap[s.id]?.name}
                  onClick={null}
                />
              ))}
            </div>
          </CollapseSection>
        )}

        {/* ── SEÇÃO 3 — RESULTADOS (locked) ── */}
        {lockedStages.length > 0 && (
          <CollapseSection title="Resultados" icon="📊" count={lockedStages.length} defaultOpen={false}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {lockedStages.map(s => (
                <StageRow
                  key={s.id}
                  stage={s}
                  champName={champMap[s.id]?.name}
                  onClick={() => navigate(`/tournament/${s.id}`)}
                />
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
