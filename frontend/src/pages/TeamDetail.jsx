import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getTeam } from '../api/fantasyTeams'
import PriceBreakdown from '../components/PriceBreakdown'
import LoadingSpinner from '../components/LoadingSpinner'

export default function TeamDetail() {
  const { id } = useParams()
  const [team, setTeam] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getTeam(id)
      .then(setTeam)
      .catch(() => setError('Failed to load team.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-16">
        <LoadingSpinner size="lg" text="Loading team..." />
      </div>
    )
  }

  if (error || !team) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="card p-8 text-center max-w-md">
          <div className="text-4xl mb-3">❌</div>
          <h2 className="font-display font-bold uppercase text-xl text-white mb-2">Team Not Found</h2>
          <p className="text-text-secondary mb-4">{error || 'This team does not exist.'}</p>
          <Link to="/my-teams" className="btn-primary text-xs">Back to My Teams</Link>
        </div>
      </div>
    )
  }

  const players = team.players || []
  const totalSpent = players.reduce((sum, p) => sum + (p.price || 0), 0)
  const remaining = (team.budget_remaining ?? 500) - totalSpent
  const score = team.total_score || team.score || 0

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-px w-8 bg-accent" />
              <span className="font-mono text-xs text-accent uppercase tracking-widest">My Team</span>
            </div>
            <h1 className="section-title">{team.name?.toUpperCase()}</h1>
            {team.tournament_name && (
              <p className="font-mono text-sm text-text-secondary mt-1">{team.tournament_name}</p>
            )}
          </div>
          <div className="flex gap-3">
            <Link to={`/leaderboard/${team.tournament_id}`} className="btn-secondary text-xs">
              View Leaderboard
            </Link>
            <Link to="/create-team" className="btn-primary text-xs">
              + New Team
            </Link>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <StatCard label="Fantasy Score" value={score} color="text-accent" />
          <StatCard label="Players" value={`${players.length}/8`} color="text-white" />
          <StatCard label="Spent" value={`${totalSpent}cr`} color="text-orange-400" />
          <StatCard label="Remaining" value={`${remaining}cr`} color="text-success" />
        </div>

        {/* Players */}
        <div className="card p-6 mb-6">
          <h2 className="font-display font-bold uppercase text-xl text-white tracking-wide mb-5">
            Roster ({players.length} players)
          </h2>

          {players.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-3xl mb-2">👥</div>
              <p className="text-text-secondary font-body">No players on this team yet.</p>
              <Link to={`/create-team`} className="btn-primary text-xs mt-4 inline-block">
                Add Players
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {players.map((player, i) => (
                <PlayerRow key={player.id || i} player={player} rank={i + 1} />
              ))}
            </div>
          )}
        </div>

        {/* Team performance hint */}
        {score > 0 && (
          <div className="card p-4 border-accent/30 bg-accent-dim/20">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏆</span>
              <div>
                <h3 className="font-display font-bold uppercase text-white">Team Score: {score}</h3>
                <p className="text-text-secondary text-sm font-body">
                  Based on real match data. Score updates as matches are played.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, color }) {
  return (
    <div className="card p-4 text-center">
      <div className={`font-display font-black text-3xl ${color}`}>{value}</div>
      <div className="font-mono text-xs text-muted uppercase tracking-wider mt-1">{label}</div>
    </div>
  )
}

function PlayerRow({ player, rank }) {
  const [showBreakdown, setShowBreakdown] = useState(false)

  return (
    <div className="border border-border-color hover:border-accent/30 hover:bg-card-hover transition-all duration-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-muted w-5">{rank}</span>
          <div className="w-9 h-9 bg-accent-dim border border-accent/30 flex items-center justify-center font-display font-black text-accent"
               style={{ clipPath: 'polygon(4px 0%, 100% 0%, calc(100% - 4px) 100%, 0% 100%)' }}>
            {(player.name || player.username || '?')[0].toUpperCase()}
          </div>
          <div>
            <div className="font-display font-bold uppercase text-white tracking-wide">
              {player.name || player.username}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {player.team && <span className="font-mono text-xs text-muted">{player.team}</span>}
              {player.region && (
                <span className="region-tag border border-muted text-muted text-[10px]">{player.region}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Mini stats */}
          <div className="hidden sm:flex items-center gap-3 font-mono text-xs">
            <span className="text-red-400">{(player.kills_avg || player.avg_kills || 0).toFixed(1)}k</span>
            <span className="text-orange-400">{Math.round(player.damage_avg || player.avg_damage || 0)}dmg</span>
            <span className="text-yellow-400">#{(player.placement_avg || player.avg_placement || 0).toFixed(0)}</span>
          </div>
          <span className="price-badge text-xs">{player.price || 0}cr</span>
          {player.fantasy_points !== undefined && (
            <span className="font-mono font-bold text-sm text-accent">{player.fantasy_points}pts</span>
          )}
        </div>
      </div>

      {/* Price breakdown toggle */}
      <div className="mt-3 ml-12">
        <PriceBreakdown player={player} />
      </div>
    </div>
  )
}
