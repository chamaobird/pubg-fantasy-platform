// frontend/src/pages/TournamentHub.jsx
// XAMA Fantasy — Tournament Hub
// Wraps LineupBuilder, TournamentLeaderboard, PlayerStatsPage
// under a tournament-scoped navbar with tabs

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { API_BASE_URL } from '../config'
import LineupBuilder from '../components/LineupBuilder'
import TournamentLeaderboard from '../components/TournamentLeaderboard'
import PlayerStatsPage from '../components/PlayerStatsPage'

const TAB_LINEUP      = 'lineup'
const TAB_LEADERBOARD = 'leaderboard'
const TAB_STATS       = 'stats'

const TABS = [
  { id: TAB_LINEUP,      label: 'Montar Lineup', icon: '⚔️' },
  { id: TAB_LEADERBOARD, label: 'Leaderboard',   icon: '🏆' },
  { id: TAB_STATS,       label: 'Stats',          icon: '📊' },
]

export default function TournamentHub() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { token, setToken, logout } = useAuth()

  const [tab, setTab] = useState(TAB_LINEUP)
  const [tournament, setTournament] = useState(null)
  const [tournaments, setTournaments] = useState([])
  const [tournamentsLoading, setTournamentsLoading] = useState(true)

  // Load all tournaments (needed by child components)
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

  const selectedTournamentId = String(id)

  // When user changes tournament in a child component's selector,
  // navigate to that tournament's hub
  const handleTournamentChange = (newId) => {
    navigate(`/tournament/${newId}`)
  }

  const STATUS_COLOR = { active: '#4ade80', upcoming: '#f97316', finished: '#6b7280' }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--color-xama-black)',
      fontFamily: "'Rajdhani', sans-serif",
      display: 'flex',
      flexDirection: 'column',
    }}>

      {/* ── Navbar ───────────────────────────────────────────────────────── */}
      <header style={{
        background: 'var(--color-xama-surface)',
        borderBottom: '1px solid var(--color-xama-border)',
        position: 'relative', flexShrink: 0,
      }}>
        <div style={{ height: '2px', background: 'linear-gradient(90deg, var(--color-xama-orange), transparent 50%)' }} />

        <div style={{
          maxWidth: '1200px', margin: '0 auto', padding: '0 24px',
          display: 'flex', alignItems: 'stretch', height: '56px',
        }}>
          {/* Logo — back to tournament select */}
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', paddingRight: '20px', borderRight: '1px solid var(--color-xama-border)' }}
            onClick={() => navigate('/tournaments')}
          >
            <div style={{
              width: '30px', height: '30px', fontSize: '15px',
              background: 'linear-gradient(135deg, rgba(249,115,22,0.25), rgba(249,115,22,0.05))',
              border: '1px solid rgba(249,115,22,0.3)', borderRadius: '7px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>🔥</div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-xama-text)', letterSpacing: '0.06em', lineHeight: 1 }}>XAMA</div>
              <div style={{ fontSize: '8px', color: 'var(--color-xama-orange)', letterSpacing: '0.14em', textTransform: 'uppercase', lineHeight: 1 }}>Fantasy</div>
            </div>
          </div>

          {/* Tournament name + status */}
          {tournament && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '20px', paddingRight: '20px', borderRight: '1px solid var(--color-xama-border)' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-xama-text)', lineHeight: 1, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {tournament.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                  <span style={{
                    fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em',
                    fontFamily: "'JetBrains Mono', monospace",
                    color: STATUS_COLOR[tournament.status] || '#6b7280',
                  }}>
                    ● {tournament.status.toUpperCase()}
                  </span>
                  <span style={{ fontSize: '10px', color: '#2a3046' }}>{tournament.region}</span>
                </div>
              </div>
            </div>
          )}

          {/* Tabs */}
          <nav style={{ display: 'flex', alignItems: 'stretch', gap: '2px', paddingLeft: '16px' }}>
            {TABS.map(({ id: tabId, label, icon }) => {
              const active = tab === tabId
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
          </nav>

          <div style={{ flex: 1 }} />

          {/* Right: back + logout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button onClick={() => navigate('/tournaments')}
              style={{
                background: 'none', border: '1px solid var(--color-xama-border)',
                borderRadius: '6px', padding: '5px 12px', fontSize: '11px',
                fontWeight: 600, letterSpacing: '0.06em',
                color: 'var(--color-xama-muted)', cursor: 'pointer',
                fontFamily: "'Rajdhani', sans-serif",
              }}
            >
              ← Torneios
            </button>

            <button onClick={() => navigate('/profile')}
              style={{ background: 'none', border: '1px solid var(--color-xama-border)', borderRadius: '6px', padding: '5px 12px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', color: 'var(--color-xama-muted)', cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif" }}
            >
              👤 Perfil
            </button>

            {token && (
              <span style={{
                fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em',
                padding: '5px 10px', borderRadius: '6px',
                fontFamily: "'JetBrains Mono', monospace",
                background: 'rgba(52,211,153,0.1)',
                border: '1px solid rgba(52,211,153,0.25)',
                color: '#34d399',
              }}>
                ● ON
              </span>
            )}

            <button onClick={logout}
              style={{
                background: 'none', border: '1px solid var(--color-xama-border)',
                borderRadius: '6px', padding: '5px 12px', fontSize: '11px',
                fontWeight: 600, letterSpacing: '0.06em',
                color: 'var(--color-xama-muted)', cursor: 'pointer',
                fontFamily: "'Rajdhani', sans-serif",
              }}
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* ── Page content ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1 }}>
        {tab === TAB_LINEUP && (
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

        {tab === TAB_LEADERBOARD && (
          <TournamentLeaderboard
            token={token}
            tournaments={tournaments}
            tournamentsLoading={tournamentsLoading}
            selectedTournamentId={selectedTournamentId}
            onTournamentChange={handleTournamentChange}
          />
        )}

        {tab === TAB_STATS && (
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
