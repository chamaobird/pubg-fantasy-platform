// frontend/src/pages/ChampionshipGroupDetail.jsx
// Página de detalhe de um Championship Group (ex: PEC Spring 2026)
// Rota: /group/:id

import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { API_BASE_URL } from '../config'
import Navbar from '../components/Navbar'
import PlayerStatsTable from '../components/PlayerStatsTable'

// ── Helpers ───────────────────────────────────────────────────────────────────

const RANK_COLORS = { 1: '#f0c040', 2: '#b4bcc8', 3: '#cd7f50' }
const RANK_BG     = {
  1: 'rgba(240,192,64,0.04)',
  2: 'rgba(180,188,200,0.03)',
  3: 'rgba(176,120,80,0.03)',
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

function TabBar({ active, onChange }) {
  const tabs = [
    { key: 'managers', label: 'Managers' },
    { key: 'players',  label: 'Jogadores' },
  ]
  return (
    <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--color-xama-border)', marginBottom: 24 }}>
      {tabs.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)} style={{
          padding: '10px 22px', background: 'none', border: 'none',
          borderBottom: active === t.key ? '2px solid var(--color-xama-orange)' : '2px solid transparent',
          color: active === t.key ? 'var(--color-xama-text)' : 'var(--color-xama-muted)',
          fontWeight: active === t.key ? 700 : 400,
          fontSize: 14, cursor: 'pointer', transition: 'color 0.15s', marginBottom: -1,
        }}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ── Manager leaderboard ───────────────────────────────────────────────────────

function ManagerLeaderboard({ groupId, currentUserId }) {
  const [data, setData]       = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const myRowRef = useRef(null)

  useEffect(() => {
    setLoading(true)
    fetch(`${API_BASE_URL}/championship-groups/${groupId}/leaderboard?limit=200`)
      .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setError('Erro ao carregar leaderboard'); setLoading(false) })
  }, [groupId])

  useEffect(() => {
    if (myRowRef.current) myRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [data])

  if (loading) return <LoadingBlock />
  if (error)   return <div className="msg-error">{error}</div>
  if (!data.length) return <EmptyBlock msg="Nenhum dado de pontuação ainda." />

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-xama-border)', background: 'var(--color-xama-surface)' }}>
      <div style={{ height: '2px', background: 'linear-gradient(90deg, var(--color-xama-gold) 0%, transparent 50%)' }} />
      <table className="w-full border-collapse">
        <thead>
          <tr style={{ background: '#0a0c11', borderBottom: '1px solid var(--color-xama-border)' }}>
            {['#', 'Manager', 'Fases', 'Pontos'].map((h, i) => (
              <th key={i}
                className="px-4 py-3 text-[10px] font-bold tracking-[0.1em] uppercase"
                style={{
                  color: 'var(--color-xama-muted)',
                  textAlign: i === 0 ? 'center' : i >= 2 ? 'right' : 'left',
                  width: i === 0 ? '52px' : i === 2 ? '80px' : undefined,
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((entry, idx) => {
            const pos    = entry.rank ?? (idx + 1)
            const isTop3 = pos <= 3
            const isMe   = entry.user_id === currentUserId
            return (
              <tr key={entry.user_id}
                ref={isMe ? myRowRef : null}
                style={{
                  borderBottom: '1px solid #13161f',
                  background: isMe ? 'rgba(20,184,166,0.06)' : isTop3 ? RANK_BG[pos] : 'transparent',
                  outline: isMe ? '1px solid rgba(20,184,166,0.18)' : 'none',
                  outlineOffset: '-1px',
                }}
                onMouseEnter={e => { if (!isMe) e.currentTarget.style.background = '#161b27' }}
                onMouseLeave={e => { e.currentTarget.style.background = isMe ? 'rgba(20,184,166,0.06)' : isTop3 ? RANK_BG[pos] : 'transparent' }}>
                <td className="px-4 py-[13px] text-center">
                  <span className="text-[13px] font-bold tabular-nums"
                    style={{ fontFamily: "'JetBrains Mono', monospace", color: isTop3 ? RANK_COLORS[pos] : 'var(--surface-4)' }}>
                    {String(pos).padStart(2, '0')}
                  </span>
                </td>
                <td className="px-4 py-[13px]">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, fontFamily: "'JetBrains Mono', monospace", color: isMe ? '#2dd4bf' : 'var(--color-xama-text)' }}>
                      {entry.username || entry.user_id}
                    </span>
                    {isMe && (
                      <span className="text-[10px] font-bold tracking-[0.06em] px-2 py-0.5 rounded"
                        style={{ background: 'rgba(20,184,166,0.18)', border: '1px solid rgba(20,184,166,0.4)', color: '#2dd4bf' }}>
                        EU
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-[13px] text-right">
                  <span style={{ fontSize: 12, color: 'var(--color-xama-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                    {entry.stages_played}
                  </span>
                </td>
                <td className="px-4 py-[13px] text-right">
                  <span className="text-[15px] font-bold tabular-nums"
                    style={{ fontFamily: "'JetBrains Mono', monospace", color: entry.total_points > 0 ? 'var(--color-xama-gold)' : '#374151' }}>
                    {Number(entry.total_points).toFixed(2)}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="px-5 py-3 flex items-center justify-between"
        style={{ borderTop: '1px solid var(--color-xama-border)', background: '#0a0c11' }}>
        <span className="text-[11px] font-bold tracking-[0.1em] uppercase" style={{ color: 'var(--color-xama-gold)' }}>
          🏆 XAMA Fantasy
        </span>
        <span className="text-[11px] tabular-nums" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-xama-muted)' }}>
          {data.length} managers
        </span>
      </div>
    </div>
  )
}

// ── Player stats ──────────────────────────────────────────────────────────────
// Faz o fetch e normaliza display_name → person_name antes de passar para PlayerStatsTable

function PlayerStats({ groupId, shortName }) {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    setLoading(true)
    fetch(`${API_BASE_URL}/championship-groups/${groupId}/player-stats?limit=200`)
      .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then(d => {
        // Normaliza display_name → person_name para PlayerStatsTable
        setPlayers(d.map(p => ({ ...p, person_name: p.display_name })))
        setLoading(false)
      })
      .catch(() => { setError('Erro ao carregar stats'); setLoading(false) })
  }, [groupId])

  if (loading) return <LoadingBlock />
  if (error)   return <div className="msg-error">{error}</div>
  if (!players.length) return <EmptyBlock msg="Nenhuma stat de jogador registrada." />

  return (
    <PlayerStatsTable
      players={players}
      shortName={shortName}
      showDaysPlayed={false}
      beforeDate={null}
      totalCount={players.length}
    />
  )
}

// ── Micro-components ──────────────────────────────────────────────────────────

function LoadingBlock() {
  return <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-xama-muted)', fontSize: 16 }}>Carregando…</div>
}

function EmptyBlock({ msg }) {
  return <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-xama-muted)', fontSize: 14, fontStyle: 'italic' }}>{msg}</div>
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ChampionshipGroupDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [group, setGroup]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [tab, setTab]         = useState('managers')

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

  // Largura máxima: 1600px na aba de jogadores (igual PlayerStatsPage), 900px em managers
  const contentMaxWidth = tab === 'players' ? 1600 : 900

  return (
    <div style={{ minHeight: '100vh', background: 'transparent', position: 'relative' }}>
      <Navbar />

      <main style={{ position: 'relative', zIndex: 1, maxWidth: contentMaxWidth, margin: '0 auto', padding: '48px 24px', transition: 'max-width 0.2s' }}>

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
            <div style={{ marginBottom: 32 }}>
              <div style={{
                fontSize: 12, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase',
                color: 'var(--color-xama-orange)', fontFamily: "'JetBrains Mono', monospace", marginBottom: 6,
              }}>
                {group.short_name}
              </div>
              <h1 style={{ fontSize: 36, fontWeight: 800, color: 'var(--color-xama-text)', margin: '0 0 8px 0', letterSpacing: '-0.01em' }}>
                {group.name}
              </h1>
              <div style={{ fontSize: 13, color: 'var(--color-xama-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                {group.championship_ids.length} fase{group.championship_ids.length !== 1 ? 's' : ''} combinadas
                {' · '}resultado unificado
              </div>
            </div>

            <TabBar active={tab} onChange={setTab} />

            {tab === 'managers' && (
              <>
                <div style={{ fontSize: 11, color: 'var(--color-xama-muted)', marginBottom: 16, fontFamily: "'JetBrains Mono', monospace" }}>
                  Pontuação acumulada de todas as fases do campeonato
                </div>
                <ManagerLeaderboard groupId={id} currentUserId={currentUserId} />
              </>
            )}

            {tab === 'players' && (
              <>
                <div style={{ fontSize: 11, color: 'var(--color-xama-muted)', marginBottom: 16, fontFamily: "'JetBrains Mono', monospace" }}>
                  Stats XAMA combinadas de todas as fases · PREÇO do último roster
                </div>
                <PlayerStats groupId={id} shortName={group.short_name} />
              </>
            )}
          </>
        )}
      </main>
    </div>
  )
}
