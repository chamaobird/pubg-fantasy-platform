// frontend/src/pages/Dashboard.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { API_BASE_URL as API_BASE } from '../config'

if (!document.getElementById('xama-fonts')) {
  const link = document.createElement('link')
  link.id = 'xama-fonts'; link.rel = 'stylesheet'
  link.href = 'https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=JetBrains+Mono:wght@400;600&display=swap'
  document.head.appendChild(link)
}

const fmt2 = (v) => v != null ? Number(v).toFixed(2) : '—'

// ── Pulse animation ────────────────────────────────────────────────
if (!document.getElementById('xama-dash-style')) {
  const s = document.createElement('style')
  s.id = 'xama-dash-style'
  s.textContent = `
    @keyframes xamaPulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.4; }
    }
    .xama-pulse { animation: xamaPulse 1.8s ease-in-out infinite; }
    .xama-quick-btn:hover { border-color: var(--color-xama-orange) !important; color: var(--color-xama-orange) !important; }
    .xama-card:hover { border-color: var(--color-xama-orange) !important; transform: translateY(-2px); }
    .xama-card { transition: border-color 0.15s, transform 0.15s; }
  `
  document.head.appendChild(s)
}

export default function Dashboard() {
  const { token } = useAuth()
  const navigate  = useNavigate()
  const H = { Authorization: `Bearer ${token}` }

  const [user,        setUser]        = useState(null)
  const [open,        setOpen]        = useState([])   // lineup_open=true
  const [soon,        setSoon]        = useState([])   // active, lineup_open=false
  const [finished,    setFinished]    = useState([])   // status=finished, com participação
  const [myLineups,   setMyLineups]   = useState({})   // { tid: lineup }
  const [rankings,    setRankings]    = useState({})   // { tid: rankEntry }
  const [loading,     setLoading]     = useState(true)

  // 1. Usuário
  useEffect(() => {
    if (!token) return
    fetch(`${API_BASE}/users/me`, { headers: H })
      .then(r => r.ok ? r.json() : null)
      .then(setUser)
      .catch(() => {})
  }, [token])

  // 2. Torneios
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

  // 3. Lineups dos torneios abertos
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

  // 4. Rankings (abertos + finalizados)
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

  // Finalizados onde o user participou
  const myFinished = finished.filter(t => rankings[t.id])

  // ── Estilos base ───────────────────────────────────────────────
  const S = {
    page: {
      minHeight: '100vh',
      background: 'var(--color-xama-bg, #0d0f14)',
      color: 'var(--color-xama-text, #dce1ea)',
      fontFamily: "'Rajdhani', sans-serif",
      padding: '32px 24px',
      maxWidth: '1000px',
      margin: '0 auto',
    },
    greeting: { fontSize: '28px', fontWeight: 700, color: '#fff', marginBottom: '4px' },
    sub: { fontSize: '14px', color: 'var(--color-xama-muted, #6b7280)', marginBottom: '20px' },

    // Quick links bar
    quickBar: {
      display: 'flex', gap: '8px', flexWrap: 'wrap',
      padding: '12px 0 24px',
      borderBottom: '1px solid var(--color-xama-border, #1e2330)',
      marginBottom: '32px',
    },
    quickBtn: {
      padding: '7px 14px',
      background: '#13161d',
      border: '1px solid var(--color-xama-border, #1e2330)',
      borderRadius: '8px',
      color: 'var(--color-xama-text, #dce1ea)',
      fontFamily: "'Rajdhani', sans-serif",
      fontWeight: 600, fontSize: '13px',
      cursor: 'pointer',
    },

    sectionTitle: {
      fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em',
      textTransform: 'uppercase', color: 'var(--color-xama-muted, #6b7280)',
      marginBottom: '14px', marginTop: '32px',
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
      gap: '16px',
    },

    // Card aberto (destaque laranja)
    cardOpen: {
      background: '#13161d',
      border: '1px solid rgba(249,115,22,0.35)',
      borderRadius: '12px',
      padding: '22px',
      boxShadow: '0 0 20px rgba(249,115,22,0.06)',
    },
    // Card em breve (discreto, tracejado)
    cardSoon: {
      background: '#0f1117',
      border: '1px dashed var(--color-xama-border, #1e2330)',
      borderRadius: '12px',
      padding: '18px',
      opacity: 0.75,
    },
    // Card finalizado
    cardDone: {
      background: '#13161d',
      border: '1px solid var(--color-xama-border, #1e2330)',
      borderRadius: '12px',
      padding: '20px',
    },

    badge: (type) => {
      const map = {
        open:   { bg: '#431407', color: '#fb923c' },
        soon:   { bg: '#1a1f2e', color: '#6b7280' },
        done:   { bg: '#1a1f2e', color: '#6b7280' },
      }
      const { bg, color } = map[type] || map.done
      return {
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em',
        textTransform: 'uppercase', padding: '3px 8px',
        borderRadius: '4px', background: bg, color,
        marginBottom: '10px',
      }
    },
    cardTitle: { fontSize: '15px', fontWeight: 700, color: '#fff', marginBottom: '3px', lineHeight: 1.3 },
    cardRegion: { fontSize: '12px', color: 'var(--color-xama-muted, #6b7280)', marginBottom: '14px' },
    divider: { borderTop: '1px solid var(--color-xama-border, #1e2330)', margin: '12px 0' },
    stat: { display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '7px' },
    statLabel: { color: 'var(--color-xama-muted, #6b7280)' },
    statValue: { fontWeight: 700, color: '#fff' },
    orange: { color: 'var(--color-xama-orange, #f97316)', fontWeight: 700 },

    btnPrimary: {
      marginTop: '14px', width: '100%', padding: '9px',
      background: 'var(--color-xama-orange, #f97316)',
      color: '#fff', border: 'none', borderRadius: '7px',
      fontFamily: "'Rajdhani', sans-serif", fontWeight: 700,
      fontSize: '13px', letterSpacing: '0.06em', cursor: 'pointer',
    },
    btnOutline: {
      marginTop: '8px', width: '100%', padding: '9px',
      background: 'transparent',
      color: 'var(--color-xama-muted, #6b7280)',
      border: '1px solid var(--color-xama-border, #1e2330)',
      borderRadius: '7px', fontFamily: "'Rajdhani', sans-serif",
      fontWeight: 700, fontSize: '13px', letterSpacing: '0.06em', cursor: 'pointer',
    },
    emptyState: {
      fontSize: '13px', color: 'var(--color-xama-muted, #6b7280)',
      background: '#0f1117',
      border: '1px dashed var(--color-xama-border, #1e2330)',
      borderRadius: '10px', padding: '20px', textAlign: 'center',
    },
  }

  if (loading) return (
    <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <span style={{ color: 'var(--color-xama-muted)', fontSize: '14px' }}>Carregando dashboard...</span>
    </div>
  )

  return (
    <div style={S.page}>

      {/* ── Saudação ── */}
      <div style={S.greeting}>Olá, {displayName.toUpperCase()} 👋</div>
      <div style={S.sub}>Bem-vindo ao XAMA Fantasy. Aqui está o resumo do seu fantasy.</div>

      {/* ── Quick Links ── */}
      <div style={S.quickBar}>
        <button className="xama-quick-btn" style={S.quickBtn} onClick={() => navigate('/tournaments')}>
          🏅 Todos os Torneios
        </button>
        <button className="xama-quick-btn" style={S.quickBtn} onClick={() => navigate('/profile')}>
          👤 Meu Perfil
        </button>
      </div>

      {/* ══════════════════════════════════════════════
          SEÇÃO 1 — LINEUP ABERTA
      ══════════════════════════════════════════════ */}
      {open.length > 0 && (
        <>
          <div style={S.sectionTitle}>⚡ Lineup Aberta</div>
          <div style={S.grid}>
            {open.map(t => {
              const lineup    = myLineups[t.id]
              const rankEntry = rankings[t.id]
              return (
                <div key={t.id} className="xama-card" style={S.cardOpen}>
                  <div style={S.badge('open')}>
                    <span className="xama-pulse">●</span> ABERTA
                  </div>
                  <div style={S.cardTitle}>{t.name}</div>
                  <div style={S.cardRegion}>{t.region}</div>

                  {lineup ? (
                    <>
                      <div style={S.divider} />
                      <div style={S.stat}>
                        <span style={S.statLabel}>Minha lineup</span>
                        <span style={S.statValue}>{lineup.name}</span>
                      </div>
                      <div style={S.stat}>
                        <span style={S.statLabel}>Pontos totais</span>
                        <span style={S.orange}>{fmt2(lineup.total_points)} pts</span>
                      </div>
                      {rankEntry && (
                        <div style={S.stat}>
                          <span style={S.statLabel}>Posição</span>
                          <span style={S.statValue}>#{rankEntry.position}</span>
                        </div>
                      )}
                      <button style={S.btnPrimary} onClick={() => navigate(`/tournament/${t.id}`)}>
                        VER TORNEIO
                      </button>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: '13px', color: 'var(--color-xama-muted)', marginBottom: '4px' }}>
                        Lineup ainda não montada.
                      </div>
                      <button style={S.btnPrimary} onClick={() => navigate(`/tournament/${t.id}`)}>
                        MONTAR LINEUP
                      </button>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════
          SEÇÃO 2 — EM BREVE
      ══════════════════════════════════════════════ */}
      {soon.length > 0 && (
        <>
          <div style={S.sectionTitle}>📅 Aguardando Abertura</div>
          <div style={S.grid}>
            {soon.map(t => (
              <div key={t.id} style={S.cardSoon}>
                <div style={S.badge('soon')}>⏳ EM BREVE</div>
                <div style={S.cardTitle}>{t.name}</div>
                <div style={S.cardRegion}>{t.region}</div>
                <div style={{ fontSize: '12px', color: 'var(--color-xama-muted)', marginTop: '4px' }}>
                  Lineup será liberada quando os participantes forem confirmados.
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════
          SEÇÃO 3 — FINALIZADOS (só com participação)
      ══════════════════════════════════════════════ */}
      {myFinished.length > 0 && (
        <>
          <div style={S.sectionTitle}>📊 Meus Resultados</div>
          <div style={S.grid}>
            {myFinished.map(t => {
              const rankEntry = rankings[t.id]
              return (
                <div key={t.id} className="xama-card" style={S.cardDone}>
                  <div style={S.badge('done')}>FINALIZADO</div>
                  <div style={S.cardTitle}>{t.name}</div>
                  <div style={S.cardRegion}>{t.region}</div>
                  <div style={S.divider} />
                  <div style={S.stat}>
                    <span style={S.statLabel}>Posição final</span>
                    <span style={S.statValue}>#{rankEntry.position}</span>
                  </div>
                  <div style={S.stat}>
                    <span style={S.statLabel}>Pontos totais</span>
                    <span style={S.orange}>{fmt2(rankEntry.total_points)} pts</span>
                  </div>
                  <button style={S.btnOutline} onClick={() => navigate(`/tournament/${t.id}`)}>
                    VER STATS
                  </button>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Empty state se não tem nada */}
      {open.length === 0 && soon.length === 0 && (
        <div style={{ ...S.emptyState, marginTop: '32px' }}>
          Nenhum torneio ativo no momento. Fique de olho nas próximas edições!
        </div>
      )}

    </div>
  )
}
