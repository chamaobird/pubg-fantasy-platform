// frontend/src/pages/TournamentHub.jsx
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { API_BASE_URL } from '../config'
import LineupBuilder from '../components/LineupBuilder'
import TournamentLeaderboard from '../components/TournamentLeaderboard'
import PlayerStatsPage from '../components/PlayerStatsPage'
import Navbar from '../components/Navbar'

const TAB_LINEUP      = 'lineup'
const TAB_LEADERBOARD = 'leaderboard'
const TAB_STATS       = 'stats'

const ALL_TABS = [
  { id: TAB_LINEUP,      label: 'Montar Lineup', icon: '⚔️' },
  { id: TAB_LEADERBOARD, label: 'Leaderboard',   icon: '🏆' },
  { id: TAB_STATS,       label: 'Stats',          icon: '📊' },
]

const STATUS_BADGE = {
  finished: { label: 'ENCERRADO', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.3)', color: '#f87171' },
  active:   { label: 'AO VIVO',   bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.3)',  color: '#4ade80' },
  upcoming: { label: 'EM BREVE',  bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.3)',  color: '#60a5fa' },
}

export default function TournamentHub() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { token, setToken } = useAuth()

  const [tab, setTab] = useState(TAB_LINEUP)
  const [tournament, setTournament] = useState(null)
  const [tournaments, setTournaments] = useState([])
  const [tournamentsLoading, setTournamentsLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_BASE_URL}/tournaments/?skip=0&limit=50`, {
      headers: { Accept: 'application/json' },
    })
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : []
        setTournaments(list)
        const current = list.find((t) => String(t.id) === String(id))
        setTournament(current || null)
        setTournamentsLoading(false)
      })
      .catch(() => setTournamentsLoading(false))
  }, [id])

  // Torneio finalizado: default para leaderboard
  useEffect(() => {
    if (tournament?.status === 'finished') setTab(TAB_LEADERBOARD)
  }, [tournament?.status])

  const selectedTournamentId = String(id)
  const isFinished = tournament?.status === 'finished'

  // Esconde aba Lineup quando torneio está finalizado
  const TABS = isFinished ? ALL_TABS.filter(t => t.id !== TAB_LINEUP) : ALL_TABS

  // Garante que a aba ativa é válida
  const activeTab = TABS.find(t => t.id === tab) ? tab : TABS[0]?.id ?? TAB_LEADERBOARD

  const handleTournamentChange = (newId) => {
    navigate(`/tournament/${newId}`)
  }

  const badge = tournament ? STATUS_BADGE[tournament.status] : null

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--color-xama-black)',
      fontFamily: "'Rajdhani', sans-serif",
      display: 'flex',
      flexDirection: 'column',
    }}>

      <Navbar tournament={tournament} />

      {/* Tabs */}
      <div style={{
        background: 'var(--color-xama-surface)',
        borderBottom: '1px solid var(--color-xama-border)',
        flexShrink: 0,
      }}>
        <div style={{
          maxWidth: '1200px', margin: '0 auto', padding: '0 24px',
          display: 'flex', alignItems: 'stretch', height: '44px', gap: '0',
        }}>
          {TABS.map(({ id: tabId, label, icon }) => {
            const active = activeTab === tabId
            return (
              <button
                key={tabId}
                onClick={() => setTab(tabId)}
                style={{
                  position: 'relative',
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '0 16px', paddingBottom: '2px',
                  fontSize: '12px', fontWeight: 700,
                  letterSpacing: '0.05em', textTransform: 'uppercase',
                  fontFamily: "'Rajdhani', sans-serif",
                  background: 'none', border: 'none', outline: 'none',
                  cursor: 'pointer',
                  color: active ? 'var(--color-xama-text)' : 'var(--color-xama-muted)',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = '#c9d1e0' }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = 'var(--color-xama-muted)' }}
              >
                <span style={{ fontSize: '12px' }}>{icon}</span>
                {label}
                {active && (
                  <span style={{
                    position: 'absolute', bottom: 0, left: '8px', right: '8px',
                    height: '2px', borderRadius: '2px 2px 0 0',
                    background: 'var(--color-xama-orange)',
                  }} />
                )}
              </button>
            )
          })}

          {/* Badge de status */}
          {badge && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
              <span style={{
                fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em',
                fontFamily: "'JetBrains Mono', monospace",
                padding: '3px 8px', borderRadius: '4px',
                background: badge.bg, border: `1px solid ${badge.border}`, color: badge.color,
              }}>
                {badge.label}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Conteúdo */}
      <div style={{ flex: 1 }}>
        {activeTab === TAB_LINEUP && (
          <LineupBuilder
            token={token}
            setToken={setToken}
            tournaments={tournaments}
            tournamentsLoading={tournamentsLoading}
            tournamentsError=""
            selectedTournamentId={selectedTournamentId}
            onTournamentChange={handleTournamentChange}
          />
        )}
        {activeTab === TAB_LEADERBOARD && (
          <TournamentLeaderboard
            token={token}
            tournaments={tournaments}
            tournamentsLoading={tournamentsLoading}
            selectedTournamentId={selectedTournamentId}
            onTournamentChange={handleTournamentChange}
          />
        )}
        {activeTab === TAB_STATS && (
          <PlayerStatsPage
            tournaments={tournaments}
            tournamentsLoading={tournamentsLoading}
            selectedTournamentId={selectedTournamentId}
            onTournamentChange={handleTournamentChange}
          />
        )}
      </div>

    </div>
  )
}
