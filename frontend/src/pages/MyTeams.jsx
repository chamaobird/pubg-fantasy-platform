import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getTeams } from '../api/fantasyTeams'
import LoadingSpinner from '../components/LoadingSpinner'

export default function MyTeams() {
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getTeams()
      .then(data => setTeams(Array.isArray(data) ? data : []))
      .catch(() => setError('Failed to load your teams.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-16">
        <LoadingSpinner size="lg" text="Loading teams..." />
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-px w-8 bg-accent" />
              <span className="font-mono text-xs text-accent uppercase tracking-widest">My Roster</span>
            </div>
            <h1 className="section-title">MY <span>TEAMS</span></h1>
          </div>
          <Link to="/create-team" className="btn-primary text-xs">+ Create Team</Link>
        </div>

        {error && (
          <div className="card p-4 border-danger/40 text-danger text-sm font-body mb-4">{error}</div>
        )}

        {!loading && teams.length === 0 && (
          <div className="card p-12 text-center">
            <div className="text-5xl mb-4">🎮</div>
            <h2 className="font-display font-bold uppercase text-2xl text-white mb-3">No Teams Yet</h2>
            <p className="text-text-secondary font-body mb-6 max-w-md mx-auto">
              Create your first fantasy team and compete in regional or global PUBG tournaments.
            </p>
            <Link to="/create-team" className="btn-primary">Create Your First Team</Link>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {teams.map(team => (
            <TeamCard key={team.id} team={team} />
          ))}
        </div>
      </div>
    </div>
  )
}

function TeamCard({ team }) {
  const players = team.players || []
  const spent = players.reduce((sum, p) => sum + (p.price || 0), 0)
  const remaining = team.budget_remaining ?? (500 - spent)
  const score = team.total_score || team.score || 0
  const budgetPct = Math.min(100, (spent / 500) * 100)

  return (
    <div className="card p-5 hover:border-accent/50 hover:bg-card-hover transition-all duration-200 group">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-accent-dim border border-accent flex items-center justify-center font-display font-black text-accent text-sm"
                 style={{ clipPath: 'polygon(3px 0%, 100% 0%, calc(100% - 3px) 100%, 0% 100%)' }}>
              {(team.name || 'T')[0].toUpperCase()}
            </div>
            <h3 className="font-display font-bold uppercase text-white text-lg tracking-wide group-hover:text-accent transition-colors">
              {team.name}
            </h3>
          </div>
          {team.tournament_name && (
            <p className="font-mono text-xs text-muted mt-1 ml-10">{team.tournament_name}</p>
          )}
        </div>
        {score > 0 && (
          <div className="text-right">
            <div className="font-display font-black text-2xl text-accent">{score}</div>
            <div className="font-mono text-[10px] text-muted uppercase tracking-wider">pts</div>
          </div>
        )}
      </div>

      {/* Budget bar */}
      <div className="mb-4">
        <div className="flex justify-between font-mono text-xs text-muted mb-1">
          <span>{spent}cr spent</span>
          <span className={remaining < 50 ? 'text-accent' : 'text-success'}>{remaining}cr left</span>
        </div>
        <div className="h-1.5 bg-bg border border-border-color overflow-hidden">
          <div
            className="h-full bg-accent transition-all duration-500"
            style={{ width: `${budgetPct}%` }}
          />
        </div>
      </div>

      {/* Players preview */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex -space-x-1">
          {players.slice(0, 6).map((p, i) => (
            <div
              key={p.id || i}
              className="w-7 h-7 bg-card border border-border-color flex items-center justify-center text-[10px] font-display font-bold text-text-secondary"
              title={p.name || p.username}
              style={{ clipPath: 'polygon(3px 0%, 100% 0%, calc(100% - 3px) 100%, 0% 100%)' }}
            >
              {(p.name || p.username || '?')[0].toUpperCase()}
            </div>
          ))}
        </div>
        <span className="font-mono text-xs text-muted">{players.length}/8 players</span>
      </div>

      <div className="flex gap-2">
        <Link to={`/teams/${team.id}`} className="btn-secondary text-xs flex-1 text-center">
          View Team
        </Link>
        {team.tournament_id && (
          <Link to={`/leaderboard/${team.tournament_id}`} className="btn-ghost text-xs flex-1 text-center">
            Leaderboard
          </Link>
        )}
      </div>
    </div>
  )
}
