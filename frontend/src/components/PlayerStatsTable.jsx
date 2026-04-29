// frontend/src/components/PlayerStatsTable.jsx
// Tabela canônica de player stats — fonte única de verdade.
// Usada em PlayerStatsPage e ChampionshipGroupDetail.
// Qualquer mudança de layout/estilo aqui reflete em todos os lugares.
//
// Props:
//   players       — array de objetos com person_name, team_name, person_id + stats
//   shortName     — identificador do torneio/grupo para TeamLogo
//   showDaysPlayed — exibe coluna "DIAS" (multi-stage view)
//   beforeDate    — passado para PlayerHistoryModal (filtra histórico até essa data)
//   totalCount    — total de jogadores antes de filtros (para o rodapé)
//   footerLabel   — label extra no rodapé (ex: "Dia 1 · 22/04")

import { useState, useMemo } from 'react'
import TeamLogo from './TeamLogo'
import PlayerHistoryModal from './PlayerHistoryModal'
import { formatTeamTag, formatPlayerName } from '../utils/teamUtils'

if (!document.getElementById('xama-fonts')) {
  const link = document.createElement('link')
  link.id = 'xama-fonts'; link.rel = 'stylesheet'
  link.href = 'https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=JetBrains+Mono:wght@400;600&display=swap'
  document.head.appendChild(link)
}

// ── Formatadores ──────────────────────────────────────────────────────────────
const fmt2   = (v) => v != null ? Number(v).toFixed(2)  : '—'
const fmtInt = (v) => v != null ? Math.round(v)         : '—'

const KILL_PTS  =  5.0
const ASSIST_PTS = 1.0
const KNOCK_PTS  = 1.0
const DMG_PTS    = 0.03
function survivalPts(p) {
  if (p.total_xama_points == null) return null
  const combatPts = (p.total_kills   || 0) * KILL_PTS
    + (p.total_assists || 0) * ASSIST_PTS
    + (p.total_knocks  || 0) * KNOCK_PTS
    + (p.total_damage  || 0) * DMG_PTS
  return Math.round(((p.total_xama_points || 0) - combatPts) * 100) / 100
}

// ── Colunas ───────────────────────────────────────────────────────────────────
const COLUMNS = [
  { key: 'fantasy_cost',
    label: 'PREÇO', title: 'Preço fantasy atual', right: true,
    render: (p) => (
      <span style={{ color: p.fantasy_cost != null ? 'var(--color-xama-gold)' : 'var(--color-xama-muted)', fontWeight: 700 }}>
        {p.fantasy_cost != null ? Number(p.fantasy_cost).toFixed(2) : '—'}
      </span>
    ),
    sortVal: (p) => Number(p.fantasy_cost ?? 0) },

  { key: 'pts_per_match',
    label: 'PTS/G', title: 'Pontos XAMA por jogo', right: true,
    render: (p) => fmt2(p.pts_per_match) },

  { key: 'total_xama_points',
    label: 'PTS XAMA', title: 'Pontos XAMA totais', right: true,
    render: (p) => (
      <span style={{ color: 'var(--color-xama-orange)' }}>
        {fmt2(p.total_xama_points)}
      </span>
    ),
    sortVal: (p) => p.total_xama_points || 0 },

  { key: 'total_kills',
    label: 'K TOTAL', title: 'Total de kills', right: true,
    render: (p) => fmtInt(p.total_kills) },

  { key: 'total_damage',
    label: 'DMG', title: 'Dano total', right: true,
    render: (p) => fmtInt(p.total_damage) },

  { key: 'total_assists',
    label: 'ASS', title: 'Total de assists', right: true,
    render: (p) => fmtInt(p.total_assists) },

  { key: 'total_wins',
    label: 'WINS', title: 'Vitórias', right: true,
    render: (p) => fmtInt(p.total_wins) },

  { key: 'days_played',
    label: 'DIAS', title: 'Dias (stages) em que o jogador aparece na seleção', right: true,
    multiOnly: true,
    render: (p) => p.days_played ?? '—' },

  { key: 'survival_pts',
    label: 'PTS SOBREV', title: 'Pontos derivados de sobrevivência (late game bonus – early death)', right: true,
    render: (p) => {
      const sp = survivalPts(p)
      if (sp == null) return '—'
      return <span style={{ color: sp >= 0 ? 'var(--color-xama-text)' : '#f87171' }}>{fmt2(sp)}</span>
    },
    sortVal: (p) => survivalPts(p) ?? 0 },

  { key: 'matches_played',
    label: 'P', title: 'Partidas jogadas', right: true,
    render: (p) => p.matches_played ?? '—' },
]

// ── Badges de destaque ────────────────────────────────────────────────────────
const BADGE_DEFS = [
  { key: 'total_kills',   icon: '💀', title: 'Top Fragger',   color: '#fb923c', bg: 'rgba(251,146,60,0.15)',  border: 'rgba(251,146,60,0.40)', min: 1 },
  { key: 'total_damage',  icon: '💥', title: 'Top Damage',    color: '#f0c040', bg: 'rgba(240,192,64,0.15)',  border: 'rgba(240,192,64,0.40)', min: 100 },
  { key: 'total_knocks',  icon: '👊', title: 'Top Knocks',    color: '#60a5fa', bg: 'rgba(96,165,250,0.15)',  border: 'rgba(96,165,250,0.40)', min: 1 },
  { key: 'total_assists', icon: '🤝', title: 'Top Assists',   color: '#34d399', bg: 'rgba(52,211,153,0.15)',  border: 'rgba(52,211,153,0.40)', min: 1 },
  { key: 'total_wins',    icon: '🏆', title: 'Mais Vitórias', color: '#f0c040', bg: 'rgba(240,192,64,0.15)',  border: 'rgba(240,192,64,0.40)', min: 1 },
]

function computeBadgeMap(players) {
  const result = new Map() // person_id → Set<badgeKey>
  for (const def of BADGE_DEFS) {
    const vals = players.map(p => Number(p[def.key] || 0))
    const maxVal = Math.max(...vals)
    if (maxVal < def.min) continue
    players.forEach(p => {
      if (Number(p[def.key] || 0) === maxVal) {
        if (!result.has(p.person_id)) result.set(p.person_id, new Set())
        result.get(p.person_id).add(def.key)
      }
    })
  }
  return result
}

function RankDelta({ currentRank, prevRank }) {
  if (prevRank === undefined || prevRank === null) return null
  const delta = prevRank - currentRank
  if (delta === 0) return (
    <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.15)', lineHeight: 1 }}>─</span>
  )
  if (delta > 0) return (
    <span style={{ fontSize: '8px', fontWeight: 700, color: '#4ade80', lineHeight: 1 }}>▲{delta}</span>
  )
  return (
    <span style={{ fontSize: '8px', fontWeight: 700, color: '#f87171', lineHeight: 1 }}>▼{Math.abs(delta)}</span>
  )
}

// ── Sub-componentes ───────────────────────────────────────────────────────────
function SortIcon({ active, dir }) {
  if (!active) return <span className="ml-0.5 opacity-20 text-[9px]">⇅</span>
  return <span className="ml-0.5 text-[9px]" style={{ color: 'var(--color-xama-orange)' }}>{dir === 'desc' ? '▼' : '▲'}</span>
}

const selectStyle = {
  background: '#0d0f14',
  border: '1px solid var(--color-xama-border)',
  borderRadius: '6px',
  color: 'var(--color-xama-text)',
  padding: '6px 10px',
  fontSize: '13px',
  cursor: 'pointer',
  outline: 'none',
}

const rankColors = ['#f0c040', '#b4bcc8', '#cd7f50']

// ── Componente principal ──────────────────────────────────────────────────────
export default function PlayerStatsTable({
  players = [],
  shortName = '',
  showDaysPlayed = false,
  beforeDate = null,
  totalCount = null,
  footerLabel = null,
  prevRankMap = null,   // Map<person_id, rank> — para setas de posição
}) {
  const [search, setSearch]         = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [sortKey, setSortKey]       = useState('pts_per_match')
  const [sortDir, setSortDir]       = useState('desc')
  const [historyPlayer, setHistoryPlayer] = useState(null)

  const badgeMap = useMemo(() => computeBadgeMap(players), [players])

  const visibleColumns = showDaysPlayed ? COLUMNS : COLUMNS.filter(c => !c.multiOnly)

  const teamOptions = useMemo(() => {
    const tags = new Set(players.map(p => formatTeamTag(p.person_name, p.team_name)).filter(Boolean))
    return Array.from(tags).sort()
  }, [players])

  const filtered = useMemo(() => players.filter(p => {
    const q = search.toLowerCase()
    const nm = !search
      || formatPlayerName(p.person_name).toLowerCase().includes(q)
      || (p.aliases || []).some(a => a.toLowerCase().includes(q))
    const tm = !teamFilter || formatTeamTag(p.person_name, p.team_name) === teamFilter
    return nm && tm
  }), [players, search, teamFilter])

  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    return [...filtered].sort((a, b) => {
      let av, bv
      if (sortKey === 'team') {
        av = formatTeamTag(a.person_name, a.team_name)
        bv = formatTeamTag(b.person_name, b.team_name)
      } else if (sortKey === 'name') {
        av = formatPlayerName(a.person_name)
        bv = formatPlayerName(b.person_name)
      } else if (sortKey === 'survival_pts') {
        av = survivalPts(a); bv = survivalPts(b)
      } else {
        const col = COLUMNS.find(c => c.key === sortKey)
        if (col?.sortVal) { av = col.sortVal(a); bv = col.sortVal(b) }
        else { av = a[sortKey]; bv = b[sortKey] }
      }
      av = av ?? (sortDir === 'desc' ? -Infinity : Infinity)
      bv = bv ?? (sortDir === 'desc' ? -Infinity : Infinity)
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      return sortDir === 'desc' ? bv - av : av - bv
    })
  }, [filtered, sortKey, sortDir])

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir(key === 'team' || key === 'name' ? 'asc' : 'desc') }
  }

  const thStyle = (col) => ({
    padding: '10px 12px',
    fontSize: '11px', fontWeight: 700,
    letterSpacing: '0.08em', textTransform: 'uppercase',
    textAlign: col?.right ? 'center' : 'left',
    cursor: 'pointer', userSelect: 'none',
    whiteSpace: 'nowrap',
    color: sortKey === col?.key ? 'var(--color-xama-orange)' : 'var(--color-xama-muted)',
    transition: 'color 0.15s',
  })

  const displayTotal = totalCount ?? players.length

  return (
    <>
      {/* ── Filtros ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)} style={{ ...selectStyle, minWidth: '110px' }}>
          <option value="">Todos os times</option>
          {teamOptions.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <input
          type="text" placeholder="Buscar jogador..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...selectStyle, width: '160px' }}
        />

        {(teamFilter || search) && (
          <button
            onClick={() => { setTeamFilter(''); setSearch('') }}
            style={{ ...selectStyle, color: 'var(--color-xama-red)', borderColor: 'rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.05)' }}>
            ✕ Limpar
          </button>
        )}

        {sorted.length > 0 && (
          <span className="px-2 py-1 rounded text-[12px]"
            style={{ fontFamily: "'JetBrains Mono', monospace", background: 'var(--surface-3)', border: '1px solid var(--color-xama-border)', color: 'var(--color-xama-muted)' }}>
            {sorted.length}
          </span>
        )}
      </div>

      {/* ── Tabela ──────────────────────────────────────────────────────────── */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-xama-border)', background: 'var(--color-xama-surface)' }}>
        <div style={{ height: '2px', background: 'linear-gradient(90deg, var(--color-xama-orange) 0%, transparent 55%)' }} />
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#0a0c11', borderBottom: '1px solid var(--color-xama-border)' }}>
                <th style={{ ...thStyle({}), width: '40px' }}>#</th>
                <th onClick={() => handleSort('team')} style={thStyle({ key: 'team', right: false })}>
                  Time<SortIcon active={sortKey === 'team'} dir={sortDir} />
                </th>
                <th onClick={() => handleSort('name')} style={thStyle({ key: 'name', right: false })}>
                  Jogador<SortIcon active={sortKey === 'name'} dir={sortDir} />
                </th>
                {visibleColumns.map(col => (
                  <th key={col.key} onClick={() => handleSort(col.key)} title={col.title} style={thStyle(col)}>
                    {col.label}<SortIcon active={sortKey === col.key} dir={sortDir} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, idx) => {
                const teamTag    = formatTeamTag(p.person_name, p.team_name)
                const playerName = formatPlayerName(p.person_name)
                return (
                  <tr key={p.person_id}
                    style={{ borderBottom: '1px solid #13161f', background: idx % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#161b27'}
                    onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent'}>

                    {/* Rank */}
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 700, color: idx < 3 ? rankColors[idx] : 'var(--surface-4)' }}>
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        {sortKey === 'pts_per_match' && prevRankMap && (
                          <RankDelta currentRank={idx + 1} prevRank={prevRankMap.get(p.person_id)} />
                        )}
                      </div>
                    </td>

                    {/* Time */}
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <TeamLogo teamName={teamTag} shortName={shortName} size={28} />
                        <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--color-xama-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                          {teamTag}
                        </span>
                      </div>
                    </td>

                    {/* Jogador */}
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span
                          onClick={() => setHistoryPlayer({
                            person_id: p.person_id,
                            person_name: playerName,
                            team_name: teamTag,
                          })}
                          style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-xama-text)', cursor: 'pointer', borderBottom: '1px dashed rgba(249,115,22,0.4)', paddingBottom: '1px' }}
                          title="Ver histórico de partidas"
                        >
                          {playerName}
                        </span>
                        {badgeMap.has(p.person_id) && (
                          <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                            {BADGE_DEFS.filter(d => badgeMap.get(p.person_id).has(d.key)).map(def => (
                              <span key={def.key} title={def.title} style={{
                                fontSize: '11px',
                                background: def.bg,
                                border: `1px solid ${def.border}`,
                                borderRadius: '4px',
                                padding: '1px 5px',
                                cursor: 'default',
                                lineHeight: 1.5,
                                userSelect: 'none',
                              }}>
                                {def.icon}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Colunas numéricas */}
                    {visibleColumns.map(col => (
                      <td key={col.key} style={{ padding: '10px 12px', textAlign: col.right ? 'center' : 'left', fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', color: 'var(--color-xama-text)' }}>
                        {col.render(p)}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Rodapé */}
        <div className="px-5 py-3 flex items-center justify-between"
          style={{ borderTop: '1px solid var(--color-xama-border)', background: '#0a0c11' }}>
          <span className="text-[11px] font-bold tracking-[0.1em] uppercase" style={{ color: 'var(--color-xama-orange)' }}>
            🔥 XAMA Fantasy
          </span>
          <span className="text-[11px] tabular-nums" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-xama-muted)' }}>
            {sorted.length} / {displayTotal} jogadores{footerLabel ? ` · ${footerLabel}` : ''}
          </span>
        </div>
      </div>

      {/* Modal de histórico */}
      {historyPlayer && (
        <PlayerHistoryModal
          personId={historyPlayer.person_id}
          personName={historyPlayer.person_name}
          teamName={historyPlayer.team_name}
          shortName={shortName}
          beforeDate={beforeDate}
          onClose={() => setHistoryPlayer(null)}
        />
      )}
    </>
  )
}
