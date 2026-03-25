// frontend/src/config/pas2026.js
// PAS 2026 — Configuração estática das fases do torneio
// Usado para personalizar o comportamento dos filtros na UI (Fase → Dia → Grupo → Partida)

/**
 * @typedef {'scrims' | 'cups' | 'playoffs' | 'finals'} PhaseType
 *
 * @typedef {Object} PhaseConfig
 * @property {number}    tournament_id - ID interno do torneio no DB
 * @property {string}    label         - Label amigável para a fase
 * @property {PhaseType} phase_type    - Tipo da fase (controla regras de filtro)
 * @property {boolean}   may_have_groups - true quando grupos podem aparecer nesta fase
 */

/**
 * Fases do PAS 2026.
 * A presença de grupos em um dia específico é detectada dinamicamente via
 * group_label das partidas. may_have_groups=true apenas habilita essa detecção.
 *
 * Weeks 1–3 dos Scrims não tiveram grupos (group_label=null nesses matches).
 * Week 4 tem grupos A, B, C, D — detectados via group_label nas partidas.
 *
 * @type {PhaseConfig[]}
 */
export const PAS_2026_PHASES = [
  {
    tournament_id:  7,
    label:          'Scrims',
    phase_type:     'scrims',
    may_have_groups: true,   // grupos a partir da Week 4
  },
  // Adicionar quando os torneios de Cups/Playoffs/Finals forem criados no DB:
  // { tournament_id: ??, label: 'Cups',     phase_type: 'cups',     may_have_groups: false },
  // { tournament_id: ??, label: 'Playoffs', phase_type: 'playoffs', may_have_groups: false },
  // { tournament_id: ??, label: 'Finals',   phase_type: 'finals',   may_have_groups: false },
]

/**
 * Lookup rápido: tournament_id → PhaseConfig
 * @type {Map<number, PhaseConfig>}
 */
export const PAS_2026_PHASE_MAP = new Map(
  PAS_2026_PHASES.map((p) => [p.tournament_id, p])
)
