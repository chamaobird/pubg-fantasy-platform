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
    .xama-pulse { animation: xamaPulse 1.8s ease-in-out infinite; }
    .xama-card-hover { transition: border-color 0.15s, transform 0.15s; }
    .xama-card-hover:hover { border-color: rgba(249,115,22,0.5) !important; transform: translateY(-2px); }
  `
  document.head.appendChild(s)
}

const fmt1 = (v) => v != null ? Number(v).toFixed(1) : '—'

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

        {/* ── SEÇÃO 1: Lineup Aberta ── */}
        {open.length > 0 && (
          <>
            <SectionTitle icon="⚡">Lineup Aberta</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-gap)', marginBottom: '8px' }}>
              {open.map(t => {
                const lineup    = myLineups[t.id]
                const rankEntry = rankings[t.id]
                return (
                  <Card key={t.id} variant="highlight" className="xama-card-hover" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <Badge preset="open" dot>
                        <span className="xama-pulse" style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'currentColor', display: 'inline-block', marginRight: '5px' }} />
                        ABERTA
                      </Badge>
                      {t.region && <span style={{ fontSize: '11px', color: 'var(--color-xama-muted)', fontWeight: 600 }}>{t.region}</span>}
                    </div>

                    <CardTitle style={{ marginBottom: '4px' }}>{t.name}</CardTitle>

                    {lineup ? (
                      <>
                        <CardDivider style={{ margin: '14px 0 10px' }} />
                        <StatRow label="Minha lineup" value="✅ Lineup montada" color="green" />
                        <StatRow label="Pontos totais" value={`${fmt1(lineup.total_points)} pts`} color="orange" />
                        {rankEntry && <StatRow label="Posição" value={`#${rankEntry.position}`} />}
                        <Button variant="primary" size="md" full style={{ marginTop: '16px' }} onClick={() => navigate(`/tournament/${t.id}`)}>
                          VER TORNEIO
                        </Button>
                      </>
                    ) : (
                      <>
                        <p style={{ fontSize: 'var(--fs-table)', color: 'var(--color-xama-muted)', margin: '12px 0 0' }}>
                          Lineup ainda não montada.
                        </p>
                        <Button variant="primary" size="md" full style={{ marginTop: '14px' }} onClick={() => navigate(`/tournament/${t.id}`)}>
                          MONTAR LINEUP
                        </Button>
                      </>
                    )}
                  </Card>
                )
              })}
            </div>
          </>
        )}

        {/* ── SEÇÃO 2: Aguardando Abertura ── */}
        {soon.length > 0 && (
          <>
            <SectionTitle icon="📅">Aguardando Abertura</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-gap)', marginBottom: '8px' }}>
              {soon.map(t => (
                <Card key={t.id} variant="ghost">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <Badge preset="soon">⏳ EM BREVE</Badge>
                    {t.region && <span style={{ fontSize: '11px', color: 'var(--color-xama-muted)', fontWeight: 600 }}>{t.region}</span>}
                  </div>
                  <CardTitle>{t.name}</CardTitle>
                  <p style={{ fontSize: 'var(--fs-table)', color: 'var(--color-xama-muted)', margin: '10px 0 0', lineHeight: 1.5 }}>
                    Lineup será liberada quando os participantes forem confirmados.
                  </p>
                </Card>
              ))}
            </div>
          </>
        )}

        {/* ── SEÇÃO 3: Meus Resultados ── */}
        {myFinished.length > 0 && (
          <>
            <SectionTitle icon="📊">Meus Resultados</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-gap)', marginBottom: '8px' }}>
              {myFinished.map(t => {
                const rankEntry = rankings[t.id]
                return (
                  <Card key={t.id} variant="default" className="xama-card-hover" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <Badge preset="done">ENCERRADO</Badge>
                      {t.region && <span style={{ fontSize: '11px', color: 'var(--color-xama-muted)', fontWeight: 600 }}>{t.region}</span>}
                    </div>
                    <CardTitle>{t.name}</CardTitle>
                    <CardDivider style={{ margin: '14px 0 10px' }} />
                    <StatRow label="Posição final" value={`#${rankEntry.position}`} />
                    <StatRow label="Pontos totais" value={`${fmt1(rankEntry.total_points)} pts`} color="gold" />
                    <Button variant="outline" size="md" full style={{ marginTop: '16px' }} onClick={() => navigate(`/tournament/${t.id}`)}>
                      VER STATS
                    </Button>
                  </Card>
                )
              })}
            </div>
          </>
        )}

        {/* ── Empty state ── */}
        {open.length === 0 && soon.length === 0