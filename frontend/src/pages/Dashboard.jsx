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

export default function Dashboard() {
  const { token } = useAuth()
  const navigate = useNavigate()

  const [user, setUser]                   = useState(null)
  const [activeTournaments, setActive]    = useState([])
  const [finishedTournaments, setFinished] = useState([])
  const [myLineups, setMyLineups]         = useState({})   // { [tournament_id]: lineup }
  const [rankings, setRankings]           = useState({})   // { [tournament_id]: position }
  const [loading, setLoading]             = useState(true)

  const H = { Authorization: `Bearer ${token}` }

  // 1. Carrega usuário
  useEffect(() => {
    if (!token) return
    fetch(`${API_BASE}/users/me`, { headers: H })
      .then(r => r.ok ? r.json() : null)
      .then(d => setUser(d))
      .catch(() => {})
  }, [token])

  // 2. Carrega torneios
  useEffect(() => {
    fetch(`${API_BASE}/tournaments/`)
      .then(r => r.json())
      .then(all => {
        setActive(all.filter(t => t.status === 'active'))
        setFinished(all.filter(t => t.status === 'finished').slice(0, 3))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // 3. Para cada torneio ativo, carrega lineup + ranking do usuário
  useEffect(() => {
    if (!token || activeTournaments.length === 0) return
    activeTournaments.forEach(t => {
      // Lineup
      fetch(`${API_BASE}/tournaments/${t.id}/lineups/me`, { headers: H })
        .then(r => r.ok ? r.json() : [])
        .then(lineups => {
          if (lineups.length > 0)
            setMyLineups(prev => ({ ...prev, [t.id]: lineups[0] }))
        })
        .catch(() => {})
      // Ranking
      fetch(`${API_BASE}/tournaments/${t.id}/rankings`)
        .then(r => r.json())
        .then(rank => {
          if (user) {
            const entry = rank.find(e => e.user_id === user.id)
            if (entry) setRankings(prev => ({ ...prev, [t.id]: entry }))
          }
        })
        .catch(() => {})
    })
  }, [activeTournaments, user])

  // Mesma busca para torneios finalizados
  useEffect(() => {
    if (!token || finishedTournaments.length === 0 || !user) return
    finishedTournaments.forEach(t => {
      fetch(`${API_BASE}/tournaments/${t.id}/rankings`)
        .then(r => r.json())
        .then(rank => {
          const entry = rank.find(e => e.user_id === user.id)
          if (entry) setRankings(prev => ({ ...prev, [t.id]: entry }))
        })
        .catch(() => {})
    })
  }, [finishedTournaments, user])

  const displayName = user?.display_name || user?.username || 'jogador'

  // ── Estilos ────────────────────────────────────────────────────
  const S = {
    page: {
      minHeight: '100vh',
      background: 'var(--color-xama-bg, #0d0f14)',
      color: 'var(--color-xama-text, #dce1ea)',
      fontFamily: "'Rajdhani', sans-serif",
      padding: '32px 24px',
      maxWidth: '960px',
      margin: '0 auto',
    },
    greeting: {
      fontSize: '28px',
      fontWeight: 700,
      marginBottom: '8px',
      color: '#fff',
    },
    sub: {
      fontSize: '14px',
      color: 'var(--color-xama-muted, #6b7280)',
      marginBottom: '32px',
    },
    sectionTitle: {
      fontSize: '11px',
      fontWeight: 700,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: 'var(--color-xama-muted, #6b7280)',
      marginBottom: '12px',
      marginTop: '32px',
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      gap: '16px',
    },
    card: {
      background: '#13161d',
      border: '1px solid var(--color-xama-border, #1e2330)',
      borderRadius: '10px',
      padding: '20px',
      cursor: 'pointer',
      transition: 'border-color 0.15s, transform 0.1s',
    },
    cardHover: {
      borderColor: 'var(--color-xama-orange, #f97316)',
    },
    badge: (color) => ({
      display: 'inline-block',
      fontSize: '10px',
      fontWeight: 700,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      padding: '2px 8px',
      borderRadius: '4px',
      background: color === 'green' ? '#14532d' : color === 'gray' ? '#1e2330' : '#431407',
      color: color === 'green' ? '#4ade80' : color === 'gray' ? '#6b7280' : '#fb923c',
      marginBottom: '10px',
    }),
    cardTitle: {
      fontSize: '16px',
      fontWeight: 700,
      color: '#fff',
      marginBottom: '4px',
    },
    cardSub: {
      fontSize: '13px',
      color: 'var(--color-xama-muted, #6b7280)',
      marginBottom: '14px',
    },
    divider: {
      borderTop: '1px solid var(--color-xama-border, #1e2330)',
      margin: '12px 0',
    },
    stat: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: '13px',
      marginBottom: '6px',
    },
    statLabel: { color: 'var(--color-xama-muted, #6b7280)' },
    statValue: { fontWeight: 700, color: '#fff' },
    orange: { color: 'var(--color-xama-orange, #f97316)', fontWeight: 700 },
    btn: {
      marginTop: '14px',
      width: '100%',
      padding: '8px',
      background: 'var(--color-xama-orange, #f97316)',
      color: '#fff',
      border: 'none',
      borderRadius: '6px',
      fontFamily: "'Rajdhani', sans-serif",
      fontWeight: 700,
      fontSize: '13px',
      letterSpacing: '0.06em',
      cursor: 'pointer',
    },
    btnOutline: {
      marginTop: '14px',
      width: '100%',
      padding: '8px',
      background: 'transparent',
      color: 'var(--color-xama-muted, #6b7280)',
      border: '1px solid var(--color-xama-border, #1e2330)',
      borderRadius: '6px',
      fontFamily: "'Rajdhani', sans-serif",
      fontWeight: 700,
      fontSize: '13px',
      letterSpacing: '0.06em',
      cursor: 'pointer',
    },
    emptyCard: {
      background: '#13161d',
      border: '1px dashed var(--color-xama-border, #1e2330)',
      borderRadius: '10px',
      padding: '24px 20px',
      textAlign: 'center',
      color: 'var(--color-xama-muted, #6b7280)',
      fontSize: '13px',
    },
    quickLinks: {
      display: 'flex',
      gap: '10px',
      flexWrap: 'wrap',
      marginTop: '32px',
    },
    quickBtn: {
      padding: '8px 16px',
      background: '#13161d',
      border: '1px solid var(--color-xama-border, #1e2330)',
      borderRadius: '8px',
      color: 'var(--color-xama-text, #dce1ea)',
      fontFamily: "'Rajdhani', sans-serif",
      fontWeight: 600,
      fontSize: '13px',
      cursor: 'pointer',
      transition: 'border-color 0.15s',
    },
  }

  const [hoveredCard, setHoveredCard] = useState(null)

  if (loading) {
    return (
      <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <span style={{ color: 'var(--color-xama-muted)', fontSize: '14px' }}>Carregando dashboard...</span>
      </div>
    )
  }

  return (
    <div style={S.page}>

      {/* ── Saudação ── */}
      <div style={S.greeting}>Olá, {displayName} 👋</div>
      <div style={S.sub}>Bem-vindo ao XAMA Fantasy. Aqui está o resumo do seu fantasy.</div>

      {/* ── Torneios Ativos ── */}
      <div style={S.sectionTitle}>🏆 Torneios Ativos</div>
      <div style={S.grid}>
        {activeTournaments.length === 0 && (
          <div style={S.emptyCard}>Nenhum torneio ativo no momento.</div>
        )}
        {activeTournaments.map(t => {
          const lineup = myLineups[t.id]
          const rankEntry = rankings[t.id]
          return (
            <div
              key={t.id}
              style={{ ...S.card, ...(hoveredCard === t.id ? S.cardHover : {}) }}
              onMouseEnter={() => setHoveredCard(t.id)}
              onMouseLeave={() => setHoveredCard(null)}
            >
              <div style={S.badge('orange')}>● ATIVO</div>
              <div style={S.cardTitle}>{t.name}</div>
              <div style={S.cardSub}>{t.region}</div>
              <div style={S.divider} />
              {lineup ? (
                <>
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
                  <button style={S.btn} onClick={() => navigate(`/tournament/${t.id}`)}>
                    VER TORNEIO
                  </button>
                </>
              ) : (
                <>
                  <div style={{ ...S.emptyCard, border: 'none', padding: '4px 0 10px' }}>
                    Você ainda não tem lineup neste torneio.
                  </div>
                  <button style={S.btn} onClick={() => navigate(`/tournament/${t.id}`)}>
                    MONTAR LINEUP
                  </button>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Histórico ── */}
      {finishedTournaments.length > 0 && (
        <>
          <div style={S.sectionTitle}>📊 Histórico</div>
          <div style={S.grid}>
            {finishedTournaments.map(t => {
              const rankEntry = rankings[t.id]
              return (
                <div
                  key={t.id}
                  style={{ ...S.card, ...(hoveredCard === `f-${t.id}` ? S.cardHover : {}) }}
                  onMouseEnter={() => setHoveredCard(`f-${t.id}`)}
                  onMouseLeave={() => setHoveredCard(null)}
                >
                  <div style={S.badge('gray')}>FINALIZADO</div>
                  <div style={S.cardTitle}>{t.name}</div>
                  <div style={S.cardSub}>{t.region}</div>
                  <div style={S.divider} />
                  {rankEntry ? (
                    <>
                      <div style={S.stat}>
                        <span style={S.statLabel}>Posição final</span>
                        <span style={S.statValue}>#{rankEntry.position}</span>
                      </div>
                      <div style={S.stat}>
                        <span style={S.statLabel}>Pontos totais</span>
                        <span style={S.orange}>{fmt2(rankEntry.total_points)} pts</span>
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: '13px', color: 'var(--color-xama-muted)' }}>
                      Sem participação registrada.
                    </div>
                  )}
                  <button style={S.btnOutline} onClick={() => navigate(`/tournament/${t.id}`)}>
                    VER STATS
                  </button>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── Quick Links ── */}
      <div style={S.sectionTitle}>⚡ Acesso Rápido</div>
      <div style={S.quickLinks}>
        <button style={S.quickBtn} onClick={() => navigate('/tournaments')}>
          🏅 Todos os Torneios
        </button>
        <button style={S.quickBtn} onClick={() => navigate('/profile')}>
          👤 Meu Perfil
        </button>
      </div>

    </div>
  )
}
