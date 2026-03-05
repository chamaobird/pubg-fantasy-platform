import { useState } from 'react'

// Formula constants matching backend
const KILL_WEIGHT = 2.0
const DAMAGE_WEIGHT = 0.05
const PLACEMENT_WEIGHT = 3.0
const SURVIVAL_WEIGHT = 0.1
const BASE_SCORE = 10
const PRICE_DIVISOR = 2

function calcBreakdown(player) {
  const kills = parseFloat(player.kills_avg || player.avg_kills || 0)
  const damage = parseFloat(player.damage_avg || player.avg_damage || 0)
  const placement = parseFloat(player.placement_avg || player.avg_placement || 0)
  const survival = parseFloat(player.survival_time_avg || player.avg_survival_time || 0)

  const killPts = kills * KILL_WEIGHT
  const damagePts = damage * DAMAGE_WEIGHT
  // Lower placement number = better, so invert for points (assuming 1–16 scale)
  const placementPts = Math.max(0, (17 - placement)) * PLACEMENT_WEIGHT
  const survivalPts = survival * SURVIVAL_WEIGHT
  const totalScore = BASE_SCORE + killPts + damagePts + placementPts + survivalPts
  const price = player.price || Math.round(totalScore / PRICE_DIVISOR)

  return { killPts, damagePts, placementPts, survivalPts, totalScore, price }
}

export default function PriceBreakdown({ player, className = '' }) {
  const [expanded, setExpanded] = useState(false)
  const bd = calcBreakdown(player)

  const rows = [
    { label: 'Kills avg', formula: `${(player.kills_avg || player.avg_kills || 0).toFixed(1)} × ${KILL_WEIGHT}`, pts: bd.killPts, color: 'text-red-400' },
    { label: 'Damage avg', formula: `${(player.damage_avg || player.avg_damage || 0).toFixed(0)} × ${DAMAGE_WEIGHT}`, pts: bd.damagePts, color: 'text-orange-400' },
    { label: 'Placement', formula: `(17 - ${(player.placement_avg || player.avg_placement || 0).toFixed(1)}) × ${PLACEMENT_WEIGHT}`, pts: bd.placementPts, color: 'text-yellow-400' },
    { label: 'Survival min', formula: `${(player.survival_time_avg || player.avg_survival_time || 0).toFixed(1)} × ${SURVIVAL_WEIGHT}`, pts: bd.survivalPts, color: 'text-green-400' },
    { label: 'Base', formula: '—', pts: BASE_SCORE, color: 'text-blue-400' },
  ]

  return (
    <div className={`font-mono text-xs ${className}`}>
      {/* Toggle button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-accent hover:text-white transition-colors group"
      >
        <div className={`w-3 h-3 border border-accent flex items-center justify-center transition-transform duration-200 ${expanded ? 'rotate-45' : ''}`}>
          <span className="text-accent" style={{ fontSize: '8px', lineHeight: 1 }}>+</span>
        </div>
        <span className="uppercase tracking-wider text-[10px] group-hover:tracking-widest transition-all duration-200">
          Price breakdown
        </span>
      </button>

      {/* Breakdown panel */}
      {expanded && (
        <div className="mt-2 border border-border-color bg-bg/50 p-3 animate-fade-in">
          {/* Header */}
          <div className="flex justify-between items-center mb-2 pb-1 border-b border-border-color">
            <span className="text-text-secondary uppercase tracking-widest text-[10px]">Score Formula</span>
            <span className="text-accent font-bold">{bd.price} credits</span>
          </div>

          {/* Rows */}
          {rows.map((row) => (
            <div key={row.label} className="flex justify-between items-center py-0.5">
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${row.color.replace('text-', 'bg-')}`} />
                <span className="text-text-secondary text-[10px]">{row.label}</span>
                <span className="text-muted text-[10px]">({row.formula})</span>
              </div>
              <span className={`${row.color} font-bold text-[11px]`}>+{row.pts.toFixed(1)}</span>
            </div>
          ))}

          {/* Total */}
          <div className="mt-2 pt-2 border-t border-border-color flex justify-between items-center">
            <span className="text-text-secondary text-[10px] uppercase tracking-wider">
              Total score → ÷{PRICE_DIVISOR}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-white text-[11px]">{bd.totalScore.toFixed(1)}</span>
              <span className="text-muted">→</span>
              <span className="text-accent font-bold text-[11px]">{bd.price} cr</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
