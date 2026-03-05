import PriceBreakdown from './PriceBreakdown'

const REGION_COLORS = {
  NA: 'border-blue-500 text-blue-400',
  EU: 'border-indigo-500 text-indigo-400',
  EMEA: 'border-indigo-500 text-indigo-400',
  APAC: 'border-green-500 text-green-400',
  BR: 'border-yellow-500 text-yellow-400',
  SA: 'border-yellow-500 text-yellow-400',
  CIS: 'border-red-500 text-red-400',
  KR: 'border-pink-500 text-pink-400',
  DEFAULT: 'border-muted text-text-secondary',
}

export default function PlayerCard({ player, onSelect, isSelected, showSelect = false, disabled = false }) {
  const region = player.region || 'GLOBAL'
  const regionColor = REGION_COLORS[region.toUpperCase()] || REGION_COLORS.DEFAULT
  const price = player.price || 0

  return (
    <div
      className={`card p-4 transition-all duration-200 scanlines
                  ${isSelected ? 'border-accent bg-card-hover border-glow' : 'hover:border-accent/40 hover:bg-card-hover'}
                  ${disabled && !isSelected ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display font-bold text-lg text-white uppercase tracking-wide truncate">
              {player.name || player.username || 'Unknown'}
            </h3>
            {isSelected && (
              <div className="flex-shrink-0 w-4 h-4 bg-accent flex items-center justify-center">
                <svg className="w-2.5 h-2.5 text-bg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            {player.team && (
              <span className="font-mono text-xs text-text-secondary uppercase">{player.team}</span>
            )}
            <span className={`region-tag border ${regionColor}`}>{region}</span>
          </div>
        </div>
        <div className="flex-shrink-0">
          <div className="price-badge text-sm font-black">{price}cr</div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        <StatCell
          label="K/G"
          value={(player.kills_avg || player.avg_kills || 0).toFixed(1)}
          color="text-red-400"
        />
        <StatCell
          label="DMG"
          value={Math.round(player.damage_avg || player.avg_damage || 0)}
          color="text-orange-400"
        />
        <StatCell
          label="PLACE"
          value={`#${(player.placement_avg || player.avg_placement || 0).toFixed(0)}`}
          color="text-yellow-400"
        />
        <StatCell
          label="SURV"
          value={`${(player.survival_time_avg || player.avg_survival_time || 0).toFixed(0)}m`}
          color="text-green-400"
        />
      </div>

      {/* Games played if available */}
      {(player.games_played || player.total_games) && (
        <div className="mb-3">
          <span className="font-mono text-[10px] text-muted uppercase tracking-wider">
            {player.games_played || player.total_games} games played
          </span>
        </div>
      )}

      {/* Price breakdown */}
      <PriceBreakdown player={player} className="mb-3" />

      {/* Select button */}
      {showSelect && (
        <button
          onClick={() => onSelect && onSelect(player)}
          disabled={disabled && !isSelected}
          className={`w-full mt-2 text-xs font-display font-bold uppercase tracking-widest py-2 transition-all duration-200
                      ${isSelected
                        ? 'bg-accent/20 border border-accent text-accent hover:bg-danger/20 hover:border-danger hover:text-danger'
                        : disabled
                          ? 'bg-card border border-muted text-muted cursor-not-allowed'
                          : 'bg-transparent border border-accent/50 text-accent hover:bg-accent hover:text-bg'
                      }`}
          style={{ clipPath: 'polygon(4px 0%, 100% 0%, calc(100% - 4px) 100%, 0% 100%)' }}
        >
          {isSelected ? '✕ Remove' : '+ Add to Team'}
        </button>
      )}
    </div>
  )
}

function StatCell({ label, value, color }) {
  return (
    <div className="bg-bg/50 border border-border-color p-2 text-center">
      <div className={`font-mono font-bold text-sm ${color}`}>{value}</div>
      <div className="font-mono text-[9px] text-muted uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  )
}
