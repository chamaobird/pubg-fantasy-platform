// frontend/src/components/ChampionshipSelector.jsx
// XAMA Fantasy — Seletor hierárquico Campeonato → Fase
//
// Props:
//   championships       : array de championship objects (de /championship-phases/)
//   loading             : bool
//   selectedChampId     : number | null
//   onChampChange       : (champId: number | null) => void
//   selectedTournId     : number | null  (null = "campeonato completo" quando allowAggregated=true)
//   onTournChange       : (tournId: number | null) => void
//   allowAggregated     : bool (default false) — exibe opção "Campeonato completo" no select de fase
//   tournaments         : array de tournament objects (para cross-reference de status/lineup_open)
//   filterLineupOpen    : bool (default false) — filtra fases com lineup_open=true
//   style               : CSSProperties extra para o wrapper

const selectStyle = {
  background: '#0d0f14',
  border: '1px solid var(--color-xama-border)',
  borderRadius: '6px',
  color: 'var(--color-xama-text)',
  padding: '6px 10px',
  fontSize: '13px',
  fontFamily: "'Rajdhani', sans-serif",
  cursor: 'pointer',
  outline: 'none',
}

// Deriva o label de fase a partir do campo phase ou do tournament_name
function phaseLabel(phase, champName) {
  if (phase.phase) return phase.phase
  // Tenta remover o prefixo do campeonato: "PGS 2026 · Group Stage" → "Group Stage"
  const tn = phase.tournament_name || ''
  if (champName && tn.startsWith(champName)) {
    const rest = tn.slice(champName.length).replace(/^[\s·\-]+/, '').trim()
    if (rest) return rest
  }
  return tn || `Torneio #${phase.tournament_id}`
}

export default function ChampionshipSelector({
  championships = [],
  loading = false,
  selectedChampId = null,
  onChampChange,
  selectedTournId = null,
  onTournChange,
  allowAggregated = false,
  tournaments = [],
  filterLineupOpen = false,
  style = {},
}) {
  const selectedChamp = championships.find((c) => c.id === selectedChampId) ?? null

  // Fases do campeonato selecionado, ordenadas por phase_order
  const phases = selectedChamp
    ? [...selectedChamp.phases].sort((a, b) => a.phase_order - b.phase_order)
    : []

  // Cross-reference com a lista de tournaments para obter status/lineup_open
  const tournById = Object.fromEntries(tournaments.map((t) => [t.id, t]))

  // Filtra fases com lineup_open quando solicitado
  const visiblePhases = filterLineupOpen
    ? phases.filter((p) => tournById[p.tournament_id]?.lineup_open)
    : phases

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', ...style }}>
      {/* Select 1: Campeonato */}
      <select
        value={selectedChampId ?? ''}
        onChange={(e) => {
          const val = e.target.value ? Number(e.target.value) : null
          onChampChange?.(val)
          // Ao trocar campeonato, reseta a fase
          onTournChange?.(allowAggregated ? null : null)
        }}
        disabled={loading}
        style={{ ...selectStyle, minWidth: '200px', opacity: loading ? 0.5 : 1 }}
      >
        <option value="">
          {loading ? 'Carregando…' : 'Selecione campeonato'}
        </option>
        {championships.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      {/* Select 2: Fase (só aparece com campeonato selecionado) */}
      {selectedChamp && (
        <select
          value={selectedTournId ?? ''}
          onChange={(e) => {
            const val = e.target.value ? Number(e.target.value) : null
            onTournChange?.(val)
          }}
          style={{ ...selectStyle, minWidth: '180px' }}
        >
          {allowAggregated && (
            <option value="">Campeonato completo</option>
          )}
          {!allowAggregated && (
            <option value="">Selecione a fase</option>
          )}
          {visiblePhases.map((p) => {
            const tourn = tournById[p.tournament_id]
            const status = tourn?.status
            let suffix = ''
            if (tourn) {
              if (!tourn.lineup_open) suffix = ' 🔒'
              else if (status === 'active')   suffix = ' 🟢'
              else if (status === 'upcoming') suffix = ' 🔵'
            }
            return (
              <option key={p.tournament_id} value={p.tournament_id}>
                {phaseLabel(p, selectedChamp.name)}{suffix}
              </option>
            )
          })}
        </select>
      )}
    </div>
  )
}
