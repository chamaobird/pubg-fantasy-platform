// frontend/src/config/pas2026.js
// PAS 2026 — Configuração estática das fases do torneio
// Usado para personalizar o comportamento dos filtros na UI (Fase → Dia → Grupo → Partida)

/**
 * @typedef {'scrims' | 'cups' | 'playoffs' | 'finals'} PhaseType
 *
 * @typedef {Object} PhaseConfig
 * @property {number}    tournament_id   - ID interno do torneio no DB
 * @property {string}    label           - Label amigável para a fase
 * @property {PhaseType} phase_type      - Tipo da fase (controla regras de filtro)
 * @property {boolean}   may_have_groups - true quando grupos podem aparecer nesta fase
 * @property {WeekMap[]} weeks           - Mapeamento explícito de semanas → datas reais
 */

/**
 * @typedef {Object} WeekMap
 * @property {number}   week   - Número da semana (1, 2, 3...)
 * @property {string}   label  - Label exibido no dropdown ("Week 1", etc.)
 * @property {string[]} dates  - Datas reais no banco (YYYY-MM-DD) pertencentes a esta semana
 */

/**
 * Mapeamento explícito de semanas para o torneio 7 (PAS Scrims/Cups).
 *
 * Usa datas REAIS do banco (não as do calendário oficial), pois houve
 * atrasos por atualização do jogo em algumas semanas.
 *
 * Calendário oficial vs datas reais:
 *   Week 4 Dia 2: oficial 24/03 → real 25/03 (atraso)
 *   Week 4 Dia 3: oficial 25/03 → real 26/03 (atraso)
 *
 * Weeks 1–3: apenas o dia da Cup foi importado (scrims não capturados).
 * Week 4: 4 dias (23/03 scrims, 25/03 scrims, 26/03 scrims, 28/03 cup)
 * Week 5: 3 dias (30/03 scrims, 31/03 scrims, 01/04 scrims — cup em 04/04)
 *
 * @type {WeekMap[]}
 */
export const PAS_TOURNAMENT_7_WEEKS = [
  { week: 1, label: 'Week 1', dates: ['2026-03-06'] },
  { week: 2, label: 'Week 2', dates: ['2026-03-14'] },
  { week: 3, label: 'Week 3', dates: ['2026-03-21'] },
  { week: 4, label: 'Week 4', dates: ['2026-03-23', '2026-03-25', '2026-03-26', '2026-03-28'] },
  { week: 5, label: 'Week 5', dates: ['2026-03-30', '2026-03-31', '2026-04-01'] },
]

/**
 * Lookup rápido: date string (YYYY-MM-DD) → WeekMap
 * Permite ao frontend encontrar a semana de qualquer data em O(1).
 * @type {Map<string, WeekMap>}
 */
export const PAS_TOURNAMENT_7_DATE_TO_WEEK = new Map(
  PAS_TOURNAMENT_7_WEEKS.flatMap((w) => w.dates.map((d) => [d, w]))
)

/**
 * Fases do PAS 2026.
 * A presença de grupos em um dia específico é detectada dinamicamente via
 * group_label das partidas. may_have_groups=true apenas habilita essa detecção.
 *
 * Weeks 1–3: sem grupos (group_label=null).
 * Week 4 Dia 1 (23/03): grupos A, B, C, D (formato separado, 5 partidas por grupo).
 * Week 4 Dias 2–3 (25–26/03): grupos AxB, CxD, ExF etc. (formato todos-contra-todos).
 * Week 5 Dia 1 (30/03): grupos A, B, C, D (formato separado).
 * Week 5 Dias 2–3 (31/03–01/04): formato todos-contra-todos.
 *
 * @type {PhaseConfig[]}
 */
export const PAS_2026_PHASES = [
  {
    tournament_id:   7,
    label:           'Scrims',
    phase_type:      'scrims',
    may_have_groups: true,
    weeks:           PAS_TOURNAMENT_7_WEEKS,
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
