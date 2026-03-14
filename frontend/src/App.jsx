import { useEffect, useState } from 'react'
import LineupBuilder from './components/LineupBuilder'
import TournamentLeaderboard from './components/TournamentLeaderboard'
import PlayerStatsPage from './components/PlayerStatsPage'
import { API_BASE_URL } from './config'

const TAB_LINEUP      = 'lineup'
const TAB_LEADERBOARD = 'leaderboard'
const TAB_STATS       = 'stats'

// ── Navbar tab definition ─────────────────────────────────────────────────────
const TABS = [
  { id: TAB_LINEUP,      label: 'Montar Lineup', icon: '⚔️'  },
  { id: TAB_LEADERBOARD, label: 'Leaderboard',   icon: '🏆'  },
  { id: TAB_STATS,       label: 'Stats',          icon: '📊'  },
]

export default function App() {
  const [tab, setTab] = useState(TAB_LINEUP)

  // ── Shared auth ───────────────────────────────────────────────────────────
  const [token, setToken] = useState(() => localStorage.getItem('wf_token') || '')
  const handleSetToken = (t) => { localStorage.setItem('wf_token', t); setToken(t) }

  // ── Shared tournaments ────────────────────────────────────────────────────
  const [tournaments, setTournaments]                   = useState([])
  const [tournamentsLoading, setTournamentsLoading]     = useState(false)
  const [tournamentsError, setTournamentsError]         = useState('')
  const [selectedTournamentId, setSelectedTournamentId] = useState('')

  useEffect(() => {
    let mounted = true
    setTournamentsLoading(true)
    fetch(`${API_BASE_URL}/tournaments/?skip=0&limit=50`, {
      headers: { Accept: 'application/json' },
    })
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return
        const list = Array.isArray(data) ? data : []
        setTournaments(list)
        if (list.length > 0) setSelectedTournamentId(String(list[0].id))
      })
      .catch(() => { if (mounted) setTournamentsError('Erro ao carregar torneios') })
      .finally(() => { if (mounted) setTournamentsLoading(false) })
    return () => { mounted = false }
  }, [])

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--color-xama-black)', fontFamily: "'Rajdhani', sans-serif" }}
    >
      {/* ── Navbar ─────────────────────────────────────────────────────── */}
      <header
        style={{
          background: 'var(--color-xama-surface)',
          borderBottom: '1px solid var(--color-xama-border)',
          position: 'relative',
        }}
      >
        {/* orange glow line at very top */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: '2px',
          background: 'linear-gradient(90deg, var(--color-xama-orange) 0%, transparent 50%)',
        }} />

        <div className="flex items-stretch" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>

          {/* Logo + brand */}
          <div className="flex items-center gap-3 py-4 pr-8" style={{ borderRight: '1px solid var(--color-xama-border)' }}>
            {/* Flame logo mark */}
            <div
              className="flex items-center justify-center rounded-lg"
              style={{
                width: '36px',
                height: '36px',
                background: 'linear-gradient(135deg, rgba(249,115,22,0.25), rgba(249,115,22,0.05))',
                border: '1px solid rgba(249,115,22,0.3)',
                fontSize: '18px',
                lineHeight: 1,
              }}
            >
              🔥
            </div>

            {/* Brand name */}
            <div>
              <div
                className="text-[18px] font-bold tracking-[0.06em] leading-none"
                style={{ color: 'var(--color-xama-text)' }}
              >
                XAMA
              </div>
              <div
                className="text-[9px] tracking-[0.16em] uppercase leading-none mt-0.5"
                style={{ color: 'var(--color-xama-orange)' }}
              >
                Fantasy
              </div>
            </div>
          </div>

          {/* Tabs */}
          <nav className="flex items-stretch gap-1 pl-6">
            {TABS.map(({ id, label, icon }) => {
              const active = tab === id
              return (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className="relative flex items-center gap-2 px-4 text-[13px] font-semibold tracking-[0.04em] uppercase transition-colors duration-150 border-none outline-none cursor-pointer"
                  style={{
                    background: 'none',
                    color: active ? 'var(--color-xama-text)' : 'var(--color-xama-muted)',
                    paddingBottom: '2px',
                  }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = '#c9d1e0' }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = 'var(--color-xama-muted)' }}
                >
                  <span style={{ fontSize: '13px' }}>{icon}</span>
                  {label}

                  {/* active indicator */}
                  {active && (
                    <span
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: '8px',
                        right: '8px',
                        height: '2px',
                        borderRadius: '2px 2px 0 0',
                        background: 'var(--color-xama-orange)',
                      }}
                    />
                  )}
                </button>
              )
            })}
          </nav>

          {/* Spacer + optional right side slot */}
          <div className="flex-1" />

          {/* Token status pill */}
          {token && (
            <div className="flex items-center">
              <span
                className="text-[10px] font-bold tracking-[0.08em] px-2 py-1 rounded"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  background: 'rgba(52,211,153,0.1)',
                  border: '1px solid rgba(52,211,153,0.25)',
                  color: '#34d399',
                }}
              >
                ● LOGADO
              </span>
            </div>
          )}
        </div>
      </header>

      {/* ── Page content ───────────────────────────────────────────────── */}
      {tab === TAB_LINEUP && (
        <LineupBuilder
          token={token}
          setToken={handleSetToken}
          tournaments={tournaments}
          tournamentsLoading={tournamentsLoading}
          tournamentsError={tournamentsError}
          selectedTournamentId={selectedTournamentId}
          onTournamentChange={setSelectedTournamentId}
        />
      )}

      {tab === TAB_LEADERBOARD && (
        <TournamentLeaderboard
          token={token}
          tournaments={tournaments}
          tournamentsLoading={tournamentsLoading}
          selectedTournamentId={selectedTournamentId}
          onTournamentChange={setSelectedTournamentId}
        />
      )}

      {tab === TAB_STATS && (
        <PlayerStatsPage
          tournaments={tournaments}
          tournamentsLoading={tournamentsLoading}
          selectedTournamentId={selectedTournamentId}
          onTournamentChange={setSelectedTournamentId}
        />
      )}
    </div>
  )
}
