// frontend/src/pages/ChampionshipGroupDetail.jsx
// Página de detalhe de um Championship Group (ex: PEC Spring 2026)
// Mostra leaderboard combinado de managers e ranking de jogadores.
// Rota: /group/:id

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { API_BASE_URL } from '../config'
import Navbar from '../components/Navbar'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n, dec = 2) {
  if (n == null) return '—'
  return Number(n).toLocaleString('pt-BR', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  })
}

function fmtPts(n) {
  if (n == null) return '—'
  return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function medalColor(rank) {
  if (rank === 1) return '#FFD700'
  if (rank === 2) return '#C0C0C0'
  if (rank === 3) return '#CD7F32'
  return 'var(--color-xama-muted)'
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

function TabBar({ active, onChange }) {
  const tabs = [
    { key: 'managers', label: 'Managers' },
    { key: 'players',  label: 'Jogadores' },
  ]
  return (
    <div style={{
      display: 'flex', gap: 4,
      borderBottom: '1px solid var(--color-xama-border)',
      marginBottom: 24,
    }}>
      {tabs.map(t => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          style={{
            padding: '10px 22px',
            background: 'none',
            border: 'none',
            borderBottom: active === t.key ? '2px solid var(--color-xama-orange)' : '2px solid transparent',
            color: active === t.key ? 'var(--color-xama-text)' : 'var(--color-xama-muted)',
            fontWeight: active === t.key ? 700 : 400,
            fontSize: 14,
            cursor: 'pointer',
            transition: 'color 0.15s',
            marginBottom: -1,
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ── Manager leaderboard ───────────────────────────────────────────────────────

function ManagerRow({ entry, isMe }) {
  const isMedal = entry.rank <= 3
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '44px 1fr 110px 90px',
      alignItems: 'center',
      gap: 12,
      padding: '12px 16px',
      background: isMe
        ? 'rgba(249,115,22,0.07)'
        : isMedal ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.01)',
      border: `1px solid ${isMe ? 'rgba(249,115,22,0.35)' : isMedal ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)'}`,
      borderRadius: 8,
    }}>
      {/* Rank */}
      <span style={{
        fontSize: isMedal ? 18 : 14,
        fontWeight: 700,
        color: medalColor(entry.rank),
        fontFamily: "'JetBrains Mono', monospace",
        textAlign: 'center',
      }}>
        {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`}
      </span>

      {/* Username */}
      <div>
        <span style={{
          fontSize: 15, fontWeight: isMe ? 700 : 500,
          color: isMe ? 'var(--color-xama-orange)' : 'var(--color-xama-text)',
        }}>
          {entry.username || entry.user_id}
        </span>
        {isMe && (
          <span style={{
            marginLeft: 8, fontSize: 10, fontWeight: 700,
            color: 'var(--color-xama-orange)',
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            VOCÊ
          </span>
        )}
      </div>

      {/* Stages played */}
      <span style={{
        fontSize: 12, color: 'var(--color-xama-muted)',
        fontFamily: "'JetBrains Mono', monospace",
        textAlign: 'right',
      }}>
        {entry.stages_played} stage{entry.stages_played !== 1 ? 's' : ''}
      </span>

      {/* Points */}
      <span style={{
        fontSize: 16, fontWeight: 700,
        color: 'var(--color-xama-text)',
        fontFamily: "'JetBrains Mono', monospace",
        textAlign: 'right',
      }}>
        {fmtPts(entry.total_points)}
      </span>
    </div>
  )
}

function ManagerLeaderboard({ groupId, currentUserId }) {
  const [data, setData]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')

  useEffect(() => {
    setLoading(true)
    fetch(`${API_BASE_URL}/championship-groups/${groupId}/leaderboard?limit=200`)
      .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setError('Erro ao carregar leaderboard'); setLoading(false) })
  }, [groupId])

  if (loading) return <LoadingBlock />
  if (error)   return <div className="msg-error">{error}</div>
  if (!data.length) return <EmptyBlock msg="Nenhum dado de pontuação ainda." />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {data.map(entry => (
        <ManagerRow
          key={entry.user_id}
          entry={entry}
          isMe={entry.user_id === currentUserId}
        />
      ))}
    </div>
  )
}

// ── Player stats ──────────────────────────────────────────────────────────────

function PlayerRow({ entry }) {
  const isMedal = entry.rank <= 3
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '44px 1fr 80px 100px 110px',
      alignItems: 'center',
      gap: 12,
      padding: '10px 16px',
      background: isMedal ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.01)',
      border: `1px solid ${isMedal ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)'}`,
      borderRadius: 8,
    }}>
      {/* Rank */}
      <span style={{
        fontSize: isMedal ? 18 : 13,
        fontWeight: 700,
        color: medalColor(entry.rank),
        fontFamily: "'JetBrains Mono', monospace",
        textAlign: 'center',
      }}>
        {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`}
      </span>

      {/* Nome */}
      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-xama-text)' }}>
        {entry.display_name}
      </span>

      {/* Partidas */}
      <span style={{
        fontSize: 12, color: 'var(--color-xama-muted)',
        fontFamily: "'JetBrains Mono', monospace",
        textAlign: 'right',
      }}>
        {entry.matches_played}x
      </span>

      {/* PPM */}
      <span style={{
        fontSize: 13, color: 'rgba(167,139,250,0.9)',
        fontFamily: "'JetBrains Mono', monospace",
        textAlign: 'right',
      }}>
        {fmt(entry.pts_per_match, 2)} ppm
      </span>

      {/* Total */}
      <span style={{
        fontSize: 15, fontWeight: 700,
        color: 'var(--color-xama-text)',
        fontFamily: "'JetBrains Mono', monospace",
        textAlign: 'right',
      }}>
        {fmtPts(entry.total_xama_points)}
      </span>
    </div>
  )
}

function PlayerStats({ groupId }) {
  const [data, setData]       = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    setLoading(true)
    fetch(`${API_BASE_URL}/championship-groups/${groupId}/player-stats?limit=200`)
      .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setError('Erro ao carregar stats'); setLoading(false) })
  }, [groupId])

  if (loading) return <LoadingBlock />
  if (error)   return <div className="msg-error">{error}</div>
  if (!data.length) return <EmptyBlock msg="Nenhuma stat de jogador registrada." />

  return (
    <>
      {/* Cabeçalho */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '44px 1fr 80px 100px 110px',
        gap: 12,
        padding: '0 16px 10px',
        fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
        color: 'var(--color-xama-muted)',
        fontFamily: "'JetBrains Mono', monospace",
        textTransform: 'uppercase',
      }}>
        <span style={{ textAlign: 'center' }}>#</span>
        <span>Jogador</span>
        <span style={{ textAlign: 'right' }}>Partidas</span>
        <span style={{ textAlign: 'right' }}>PPM</span>
        <span style={{ textAlign: 'right' }}>Total XAMA</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {data.map(entry => (
          <PlayerRow key={entry.person_id} entry={entry} />
        ))}
      </div>
    </>
  )
}

// ── Micro-components ──────────────────────────────────────────────────────────

function LoadingBlock() {
  return (
    <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-xama-muted)', fontSize: 16 }}>
      Carregando…
    </div>
  )
}

function EmptyBlock({ msg }) {
  return (
    <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-xama-muted)', fontSize: 14, fontStyle: 'italic' }}>
      {msg}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ChampionshipGroupDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [group, setGroup]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [tab, setTab]         = useState('managers')

  // Tenta pegar o user_id do token armazenado
  const [currentUserId, setCurrentUserId] = useState(null)
  useEffect(() => {
    try {
      const token = localStorage.getItem('token')
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]))
        setCurrentUserId(payload.sub || payload.user_id || null)
      }
    } catch { /* ignora */ }
  }, [])

  useEffect(() => {
    setLoading(true)
    fetch(`${API_BASE_URL}/championship-groups/${id}`)
      .then(r => {
        if (r.status === 404) throw new Error('404')
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(d => { setGroup(d); setLoading(false) })
      .catch(e => {
        setError(e.message === '404' ? 'Grupo não encontrado.' : 'Erro ao carregar grupo.')
        setLoading(false)
      })
  }, [id])

  return (
    <div style={{ minHeight: '100vh', background: 'transparent', position: 'relative' }}>
      <Navbar />

      <main style={{ position: 'relative', zIndex: 1, maxWidth: 900, margin: '0 auto', padding: '48px 24px' }}>

        {/* Breadcrumb */}
        <button
          onClick={() => navigate('/championships')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--color-xama-muted)', fontSize: 13,
            marginBottom: 24, padding: 0, display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          ← Campeonatos
        </button>

        {loading && <LoadingBlock />}
        {error && <div className="msg-error">{error}</div>}

        {!loading && !error && group && (
          <>
            {/* Header */}
            <div style={{ marginBottom: 32 }}>
              <div style={{
                fontSize: 12, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase',
                color: 'var(--color-xama-orange)', fontFamily: "'JetBrains Mono', monospace", marginBottom: 6,
              }}>
                {group.short_name}
              </div>
              <h1 style={{
                fontSize: 36, fontWeight: 800, color: 'var(--color-xama-text)',
                margin: '0 0 8px 0', letterSpacing: '-0.01em',
              }}>
                {group.name}
              </h1>
              <div style={{ fontSize: 13, color: 'var(--color-xama-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                {group.championship_ids.length} fase{group.championship_ids.length !== 1 ? 's' : ''} combinadas
                {' · '}
                resultado unificado
              </div>
            </div>

            {/* Tabs */}
            <TabBar active={tab} onChange={setTab} />

            {tab === 'managers' && (
              <>
                <div style={{
                  fontSize: 11, color: 'var(--color-xama-muted)', marginBottom: 16,
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  Pontuação acumulada de todas as fases do campeonato
                </div>
                <ManagerLeaderboard groupId={id} currentUserId={currentUserId} />
              </>
            )}

            {tab === 'players' && (
              <>
                <div style={{
                  fontSize: 11, color: 'var(--color-xama-muted)', marginBottom: 16,
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  Stats XAMA combinadas de todas as fases · PPM = pontos por partida
                </div>
                <PlayerStats groupId={id} />
              </>
            )}
          </>
        )}
      </main>
    </div>
  )
}
