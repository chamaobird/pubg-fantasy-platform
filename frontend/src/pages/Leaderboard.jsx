import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getLeaderboard } from '../api/fantasyTeams'
import { getTournament } from '../api/tournaments'
import LoadingSpinner from '../components/LoadingSpinner'

export default function Leaderboard() {
  const { tournament_id } = useParams()
  const [entries, setEntries] = useState([])
  const [tournament, setTournament] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!tournament_id) {
      setError('No tournament ID specified.')
      setLoading(false)
      return
    }

    Promise.all([
      getLeaderboard(tournament_id).catch(() => []),
      getTournament(tournament_id).catch(() => null),
    ]).then(([lb, t]) => {
      setEntries(Array.isArray(lb) ? lb : [])
      setTournament(t)
    }).catch(() => setError('Failed to load leaderboard.'))
      .finally(() => setLoading(false))
  }, [tournament_id])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-16">
        <LoadingSpinner size="lg" text="Loading leaderboard..." />
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-px w-8 bg-accent" />
            <span className="font-mono text-xs text-accent uppercase tracking-widest">Rankings</span>
          </div>
          <h1 className="section-title">
            <span>LEADERBOARD</span>
          </h1>
          {tournament && (
            <div className="flex items-center gap-3 mt-2">
              <p className="font-display font-bold text-xl text-text-secondary uppercase">
                {tournament.name}
              </p>
              {tournament.region && (
                <span className="region-tag border border-muted text-muted text-xs">{tournament.region}</span>
              )}
              <StatusBadge status={tournament.status} />
            </div>
          )}
        </div>

        {error && (
          <div className="card p-4 border-danger/40 text-danger font-body text-sm mb-4">{error}</div>
        )}

        {/* Top 3 podium */}
        {entries.length >= 3 && (
          <div className="grid grid-cols-3 gap-3 mb-8">
            {[entries[1], entries[0], entries[2]].map((entry, i) => {
              const realRank = i === 0 ? 2 : i === 1 ? 1 : 3
              const heights = ['h-24', 'h-32', 'h-20']
              const podiumColors = ['border-text-secondary', 'border-accent', 'border-orange-600']
              const scoreColors = ['text-text-secondary', 'text-accent glow-accent', 'text-orange-600']

              return entry ? (
                <div key={entry.team_id || i} className="flex flex-col items-center">
                  <div className={`card ${podiumColors[i]} p-3 text-center w-full mb-2`}>
                    <div className={`font-display font-black text-2xl ${scoreColors[i]}`}>
                      {realRank === 1 ? '🥇' : realRank === 2 ? '🥈' : '🥉'}
                    </div>
                    <div className="font-display font-bold text-sm text-white uppercase truncate mt-1">
                      {entry.team_name || entry.name || `Team ${realRank}`}
                    </div>
                    <div className={`font-mono font-bold text-xl mt-1 ${scoreColors[i]}`}>
                      {entry.score || entry.total_score || 0}
                    </div>
                    <div className="font-mono text-[10px] text-muted uppercase tracking-wider">pts</div>
                  </div>
                  <div className={`w-full ${heights[i]} ${podiumColors[i]} border-t-0 border bg-gradient-to-b from-card to-bg`}>
                    <div className="flex items-end justify-center h-full pb-2">
                      <span className="font-mono text-xs text-muted">#{realRank}</span>
                    </div>
                  </div>
                </div>
              ) : <div key={i} />
            })}
          </div>
        )}

        {/* Full rankings table */}
        {entries.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="text-4xl mb-3">📊</div>
            <h2 className="font-display font-bold uppercase text-xl text-white mb-2">No entries yet</h2>
            <p className="text-text-secondary font-body mb-4">
              Be the first to create a team for this tournament.
            </p>
            <Link to="/create-team" className="btn-primary text-xs">Create a Team</Link>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-border-color flex justify-between items-center">
              <h2 className="font-display font-bold uppercase text-lg text-white tracking-wide">
                Full Rankings
              </h2>
              <span className="font-mono text-xs text-muted uppercase">{entries.length} teams</span>
            </div>

            <table className="w-full">
              <thead>
                <tr className="border-b border-border-color bg-bg/50">
                  <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted w-12">#</th>
                  <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted">Team</th>
                  <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted hidden sm:table-cell">Manager</th>
                  <th className="text-right px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-accent">Score</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, i) => (
                  <LeaderboardRow key={entry.team_id || i} entry={entry} rank={i + 1} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <Link to="/tournaments" className="btn-ghost text-xs">← All Tournaments</Link>
          <Link to="/create-team" className="btn-primary text-xs">+ Create Team</Link>
        </div>
      </div>
    </div>
  )
}

function LeaderboardRow({ entry, rank }) {
  const isTop3 = rank <= 3
  const rankColors = {
    1: 'text-accent',
    2: 'text-text-secondary',
    3: 'text-orange-600',
  }

  return (
    <tr className={`border-b border-border-color/50 hover:bg-card-hover transition-colors
                    ${isTop3 ? 'bg-accent-dim/5' : ''}`}>
      <td className="px-4 py-3">
        <span className={`font-mono font-bold text-sm ${rankColors[rank] || 'text-muted'}`}>
          {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}
        </span>
      </td>
      <td className="px-4 py-3">
        <Link
          to={`/teams/${entry.team_id}`}
          className="font-display font-bold uppercase text-white hover:text-accent transition-colors tracking-wide"
        >
          {entry.team_name || entry.name || `Team ${rank}`}
        </Link>
        {entry.player_count !== undefined && (
          <div className="font-mono text-xs text-muted">{entry.player_count} players</div>
        )}
      </td>
      <td className="px-4 py-3 hidden sm:table-cell">
        <span className="font-mono text-sm text-text-secondary">
          {entry.username || entry.user_name || entry.owner || '—'}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <span className={`font-mono font-bold text-lg ${isTop3 ? 'text-accent' : 'text-white'}`}>
          {entry.score || entry.total_score || 0}
        </span>
      </td>
    </tr>
  )
}

function StatusBadge({ status }) {
  const cfg = {
    live: { color: 'border-success text-success bg-success/10', dot: 'bg-success animate-pulse', label: 'LIVE' },
    active: { color: 'border-success text-success bg-success/10', dot: 'bg-success animate-pulse', label: 'LIVE' },
    upcoming: { color: 'border-blue-500 text-blue-400 bg-blue-500/10', dot: 'bg-blue-400', label: 'UPCOMING' },
    finished: { color: 'border-muted text-muted bg-muted/10', dot: 'bg-muted', label: 'FINISHED' },
    completed: { color: 'border-muted text-muted bg-muted/10', dot: 'bg-muted', label: 'FINISHED' },
  }
  const c = cfg[status?.toLowerCase()] || cfg.upcoming

  return (
    <span className={`region-tag border flex items-center gap-1.5 text-xs ${c.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  )
}
