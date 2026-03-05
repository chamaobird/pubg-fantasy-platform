import { Link } from 'react-router-dom'

const REGION_COLORS = {
  NA: 'border-blue-500 text-blue-400 bg-blue-500/10',
  EU: 'border-indigo-500 text-indigo-400 bg-indigo-500/10',
  EMEA: 'border-indigo-500 text-indigo-400 bg-indigo-500/10',
  APAC: 'border-green-500 text-green-400 bg-green-500/10',
  BR: 'border-yellow-500 text-yellow-400 bg-yellow-500/10',
  SA: 'border-yellow-500 text-yellow-400 bg-yellow-500/10',
  CIS: 'border-red-500 text-red-400 bg-red-500/10',
  KR: 'border-pink-500 text-pink-400 bg-pink-500/10',
  GLOBAL: 'border-accent text-accent bg-accent-dim',
}

const STATUS_CONFIG = {
  upcoming: { label: 'UPCOMING', color: 'text-blue-400 border-blue-500 bg-blue-500/10', dot: 'bg-blue-400' },
  live: { label: 'LIVE', color: 'text-success border-success bg-success/10', dot: 'bg-success animate-pulse' },
  active: { label: 'LIVE', color: 'text-success border-success bg-success/10', dot: 'bg-success animate-pulse' },
  finished: { label: 'FINISHED', color: 'text-muted border-muted bg-muted/10', dot: 'bg-muted' },
  completed: { label: 'FINISHED', color: 'text-muted border-muted bg-muted/10', dot: 'bg-muted' },
}

const TYPE_LABELS = {
  regional: 'REGIONAL',
  scrims: 'SCRIMS',
  qualifier: 'QUALIFIER',
  global: 'GLOBAL',
  weekly: 'WEEKLY',
}

export default function TournamentCard({ tournament }) {
  const region = tournament.region || 'GLOBAL'
  const status = tournament.status || 'upcoming'
  const regionStyle = REGION_COLORS[region.toUpperCase()] || REGION_COLORS.GLOBAL
  const statusCfg = STATUS_CONFIG[status.toLowerCase()] || STATUS_CONFIG.upcoming
  const typeLabel = TYPE_LABELS[tournament.type?.toLowerCase()] || tournament.type?.toUpperCase() || ''

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    })
  }

  return (
    <div className="card p-5 hover:border-accent/50 hover:bg-card-hover transition-all duration-200 group">
      {/* Top badges */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className={`region-tag border text-xs ${regionStyle}`}>{region}</span>
        <span className={`flex items-center gap-1.5 region-tag border text-xs ${statusCfg.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusCfg.dot}`} />
          {statusCfg.label}
        </span>
        {typeLabel && (
          <span className="region-tag border border-muted text-muted text-xs">{typeLabel}</span>
        )}
      </div>

      {/* Name */}
      <h3 className="font-display font-black text-xl uppercase text-white group-hover:text-accent transition-colors tracking-wide mb-1">
        {tournament.name}
      </h3>

      {/* Description */}
      {tournament.description && (
        <p className="text-text-secondary text-sm font-body mb-3 line-clamp-2">
          {tournament.description}
        </p>
      )}

      {/* Dates */}
      <div className="flex items-center gap-4 text-xs font-mono text-muted mb-4">
        {tournament.start_date && (
          <span>▶ {formatDate(tournament.start_date)}</span>
        )}
        {tournament.end_date && (
          <span>◼ {formatDate(tournament.end_date)}</span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs font-mono text-muted">
          {tournament.prize_pool && (
            <span className="text-accent font-bold">
              ${Number(tournament.prize_pool).toLocaleString()}
            </span>
          )}
          {tournament.max_teams && (
            <span>{tournament.max_teams} teams max</span>
          )}
        </div>
        <Link
          to={`/leaderboard/${tournament.id}`}
          className="font-display font-bold text-xs uppercase tracking-widest text-accent
                     hover:text-white transition-colors flex items-center gap-1"
        >
          Leaderboard
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  )
}
