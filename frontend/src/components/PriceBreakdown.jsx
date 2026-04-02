import { useState } from 'react'

// ---------------------------------------------------------------------------
// Constantes — espelham exatamente app/core/pricing.py (Fórmula B unificada)
// Ao ajustar pesos no backend, atualizar aqui também.
// ---------------------------------------------------------------------------
const KILL_WEIGHT     = 2.5
const DAMAGE_WEIGHT   = 1.8   // aplicado sobre (damage / 100)
const SURVIVAL_WEIGHT = 1.2   // por minuto sobrevivido
const PLACEMENT_WEIGHT = 3.0  // sobre placement_score 0–10
const BASE_PRICE      = 5.0
const SCORE_MULTIPLIER = 0.5
const TOTAL_TEAMS     = 16

// Intervalo de normalização (apenas para exibição — o preço real vem do backend)
const NORM_MIN = 10
const NORM_MAX = 35

function placementScore(avgPlacement, totalTeams = TOTAL_TEAMS) {
  if (totalTeams <= 1) return 10
  return Math.max(0, ((totalTeams - avgPlacement) / (totalTeams - 1)) * 10)
}

/**
 * Calcula o breakdown a partir dos stats do jogador.
 *
 * Prioriza components vindos do backend (player.price_components) quando disponíveis,
 * pois eles já incluem a normalização real aplicada.
 * O cálculo local serve como fallback para exibição imediata.
 */
function calcBreakdown(player) {
  // Se o backend enviou os componentes detalhados, usa direto
  const pc = player.price_components || player.components
  if (pc) {
    return {
      killPts:      pc.kill_component,
      damagePts:    pc.damage_component,
      survivalPts:  pc.survival_component,
      placementPts: pc.placement_component,
      baseScore:    pc.base_score,
      rawPrice:     pc.raw_price,
      finalPrice:   pc.final_price,
      gamesUsed:    pc.games_considered || 0,
      hadRecentPhase:  pc.had_recent_phase ?? true,
      hadOtherPhases:  pc.had_other_phases ?? false,
      isFromBackend: true,
    }
  }

  // Fallback: cálculo local com Fórmula B (sem normalização de grupo)
  const avgKills    = parseFloat(player.kills_avg    || player.avg_kills    || 0)
  const avgDamage   = parseFloat(player.damage_avg   || player.avg_damage   || 0)
  const avgPlace    = parseFloat(player.placement_avg || player.avg_placement || TOTAL_TEAMS)
  const avgSurvival = parseFloat(player.survival_time_avg || player.avg_survival_minutes || 0)

  const killPts     = avgKills * KILL_WEIGHT
  const damagePts   = (avgDamage / 100) * DAMAGE_WEIGHT
  const survivalPts = avgSurvival * SURVIVAL_WEIGHT
  const placementPts = placementScore(avgPlace) * PLACEMENT_WEIGHT

  const baseScore  = killPts + damagePts + survivalPts + placementPts
  const rawPrice   = BASE_PRICE + baseScore * SCORE_MULTIPLIER

  return {
    killPts,
    damagePts,
    survivalPts,
    placementPts,
    baseScore,
    rawPrice,
    finalPrice: player.fantasy_cost || player.price || Math.round(rawPrice),
    gamesUsed: 0,
    hadRecentPhase: false,
    hadOtherPhases: false,
    isFromBackend: false,
  }
}

export default function PriceBreakdown({ player, className = '' }) {
  const [expanded, setExpanded] = useState(false)
  const bd = calcBreakdown(player)

  const avgKills    = parseFloat(player.kills_avg    || player.avg_kills    || 0)
  const avgDamage   = parseFloat(player.damage_avg   || player.avg_damage   || 0)
  const avgPlace    = parseFloat(player.placement_avg || player.avg_placement || TOTAL_TEAMS)
  const avgSurvival = parseFloat(player.survival_time_avg || player.avg_survival_minutes || 0)

  const rows = [
    {
      label:   'Kills avg',
      formula: `${avgKills.toFixed(1)} × ${KILL_WEIGHT}`,
      pts:     bd.killPts,
      color:   'text-red-400',
    },
    {
      label:   'Damage avg',
      formula: `(${avgDamage.toFixed(0)} ÷ 100) × ${DAMAGE_WEIGHT}`,
      pts:     bd.damagePts,
      color:   'text-orange-400',
    },
    {
      label:   'Survival min',
      formula: `${avgSurvival.toFixed(1)} × ${SURVIVAL_WEIGHT}`,
      pts:     bd.survivalPts,
      color:   'text-green-400',
    },
    {
      label:   'Placement',
      formula: `score(${avgPlace.toFixed(1)}) × ${PLACEMENT_WEIGHT}`,
      pts:     bd.placementPts,
      color:   'text-yellow-400',
    },
  ]

  return (
    <div className={`font-mono text-xs ${className}`}>
      {/* Toggle button — idêntico ao original */}
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
            <span className="text-accent font-bold">{bd.finalPrice} credits</span>
          </div>

          {/* Componentes */}
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

          {/* Base */}
          <div className="flex justify-between items-center py-0.5">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              <span className="text-text-secondary text-[10px]">Base</span>
              <span className="text-muted text-[10px]">(fixo)</span>
            </div>
            <span className="text-blue-400 font-bold text-[11px]">+{BASE_PRICE.toFixed(1)}</span>
          </div>

          {/* Total → preço raw */}
          <div className="mt-2 pt-2 border-t border-border-color flex justify-between items-center">
            <span className="text-text-secondary text-[10px] uppercase tracking-wider">
              Score → preço base
            </span>
            <div className="flex items-center gap-2">
              <span className="text-white text-[11px]">{bd.baseScore.toFixed(1)}</span>
              <span className="text-muted">→</span>
              <span className="text-text-secondary text-[11px]">{bd.rawPrice.toFixed(1)} cr</span>
            </div>
          </div>

          {/* Preço final (normalizado) */}
          <div className="mt-1 flex justify-between items-center">
            <span className="text-text-secondary text-[10px] uppercase tracking-wider">
              Após normalização ({NORM_MIN}–{NORM_MAX} cr)
            </span>
            <span className="text-accent font-bold text-[11px]">{bd.finalPrice} cr</span>
          </div>

          {/* Fonte dos dados */}
          {bd.isFromBackend && (
            <div className="mt-2 pt-1 border-t border-border-color flex gap-2 flex-wrap">
              {bd.hadRecentPhase && (
                <span className="text-[9px] text-text-secondary uppercase tracking-wider">
                  65% fase anterior
                </span>
              )}
              {bd.hadOtherPhases && (
                <span className="text-[9px] text-text-secondary uppercase tracking-wider">
                  · 35% histórico
                </span>
              )}
              {bd.gamesUsed > 0 && (
                <span className="text-[9px] text-muted">
                  · {bd.gamesUsed} partidas
                </span>
              )}
            </div>
          )}

          {!bd.isFromBackend && (
            <div className="mt-2 pt-1 border-t border-border-color">
              <span className="text-[9px] text-muted uppercase tracking-wider">
                estimativa local — preço real definido pelo backend
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
