// frontend/src/components/PlayerStatsPage.jsx
// XAMA Fantasy — Player Stats Page (expanded)
// Filtros: campeonato → fase → dia → grupo → partida → time → jogador

import { useState, useEffect, useMemo } from 'react'
import { API_BASE_URL as API_BASE } from '../config'
import { PAS_2026_PHASE_MAP } from '../config/pas2026'
import TeamLogo from './TeamLogo'
import ChampionshipSelector from './ChampionshipSelector'

if (!document.getElementById('xama-fonts')) {
  const link = document.createElement('link')
  link.id = 'xama-fonts'; link.rel = 'stylesheet'
  link.href = 'https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=JetBrains+Mono:wght@400;600&display=swap'
  document.head.appendChild(link)
}

const formatPlayerName = (name) => {
  if (!name) return '—'
  const parts = name.split('_')
  return parts.length > 1 ? parts.slice(1).join('_') : name
}
const formatTeamTag = (name, teamFromApi) => {
  if (!name) return teamFromApi || '—'
  const parts = name.split('_')
  return parts.length > 1 ? parts[0] : (teamFromApi || '—')
}
const placementColorHex = (val) => {
  if (val == null) return '#dce1ea'
  if (val <= 5)    return '#4ade80'
  if (val <= 12)   return '#f0c040'
  return '#f87171'
}
const fmt1   = (v) => v != null ? Number(v).toFixed(1) : '—'
const fmt2   = (v) => v != null ? Number(v).toFixed(2) : '—'
const fmtInt = (v) => v != null ? Math.round(v) : '—'
const fmtMin = (secs) => secs != null ? Math.round(Number(secs) / 60) : '—'

const MAP_ICONS = { Erangel: '🌿', Miramar: '🏜️', Taego: '🌾', Rondo: '❄️', Vikendi: '❄️', Deston: '🌊' }

const calcTwire = (p) => {
  const kills  = (p.total_kills  || 0) * 2
  const damage = (p.total_damage || 0) / 100
  const wins   = (p.total_wins   || 0) * 5   // +5 pts por vitória (sobreviventes)
  return Math.round((kills + damage + wins) * 100) / 100
}
const calcPenalty = (p) => {
  const count = p.total_penalty_count || 0
  if (count === 0) return '0'
  return `${count}(${count * -15})`
}

const COLUMNS = [
  { key: 'matches_played',       label: 'M',          title: 'Partidas jogadas',         right: true,  render: (p) => p.matches_played ?? '—' },
  {
    key: 'total_wins',
    label: 'W',
    title: 'Vitórias (1º lugar)',
    right: true,
    render: (p) => (
      <span style={{ color: (p.total_wins || 0) > 0 ? '#4ade80' : 'var(--color-xama-muted)' }}>
        {fmtInt(p.total_wins)}
      </span>
    ),
    sortVal: (p) => p.total_wins || 0,
  },
  { key: 'total_fantasy_points', label: 'PTS XAMA',   title: 'Pontos XAMA totais',       right: true,  render: (p) => fmt2(p.total_fantasy_points),
    color: () => 'var(--color-xama-orange)' },
  { key: 'twire_pts',            label: 'PTS TWIRE',  title: 'Estimativa Twire',         right: true,  render: (p) => fmt2(calcTwire(p)),
    sortVal: (p) => calcTwire(p) },
  { key: 'pts_per_match',        label: 'PTS/G',      title: 'Pontos XAMA por jogo',     right: true,  render: (p) => fmt2(p.pts_per_match) },
  { key: 'total_kills',          label: 'K Total',    title: 'Total de kills',           right: true,  render: (p) => fmtInt(p.total_kills) },
  { key: 'total_assists',        label: 'ASS Total',  title: 'Total de assists',         right: true,  render: (p) => fmtInt(p.total_assists) },
  { key: 'total_damage',         label: 'DMG Total',  title: 'Dano total',               right: true,  render: (p) => fmtInt(p.total_damage) },
  { key: 'avg_placement',        label: 'PLACE',      title: 'Colocação média',          right: true,  render: (p) => fmt1(p.avg_placement),
    color: (p) => placementColorHex(p.avg_placement) },
  { key: 'surv_total_min',       label: 'SURV (min)', title: 'Sobrevivência total (min)',right: true,
    render: (p) => fmtMin((p.avg_survival_secs || 0) * (p.matches_played || 1)),
    sortVal: (p) => (p.avg_survival_secs || 0) * (p.matches_played || 1) },
  { key: 'late_game_bonus',      label: 'LATE GAME',  title: 'Bônus late game total',    right: true,
    render: (p) => {
      const bonus = p.total_late_game_bonus || 0
      if (bonus === 0) return '0'
      return <span style={{ color: '#4ade80' }}>{fmt2(bonus)}</span>
    },
    sortVal: (p) => p.total_late_game_bonus || 0 },
  { key: 'penalty',              label: 'PUNIÇÃO',    title: 'Penalidade morte precoce', right: true,
    render: (p) => {
      const val = calcPenalty(p)
      if (val === '0') return <span style={{ color: 'var(--color-xama-muted)' }}>0</span>
      return <span style={{ color: '#f87171' }}>{val}</span>
    },
    sortVal: (p) => {
      const base  = p.total_base_points     || 0
      const total = p.total_fantasy_points  || 0
      const bonus = p.total_late_game_bonus || 0
      return total - bonus - base
    }},
  { key: 'fantasy_cost',         label: 'PREÇO',      title: 'Preço fantasy',            right: true,
    render: (p) => <span style={{ color: 'var(--color-xama-gold)' }}>${Number(p.fantasy_cost).toFixed(2)}</span> },
]

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
  fontFamily: "'Rajdhani', sans-serif",
  cursor: 'pointer',
  outline: 'none',
}

export default function PlayerStatsPage({
  // Hierarquia nova
  championships, championshipsLoading,
  selectedChampId: propChampId, onChampChange,
  // Fase específica (legado + nova hierarquia)
  tournaments, tournamentsLoading,
  selectedTournamentId: propTournId, onTournamentChange,
}) {
  // Estado local — permite "campeonato completo" sem mudar a URL
  const [localChampId, setLocalChampId] = useState(propChampId ? Number(propChampId) : null)
  const [localTournId, setLocalTournId] = useState(propTournId ? Number(propTournId) : null)

  // Sincroniza quando a URL (props externas) mudar
  useEffect(() => { setLocalChampId(propChampId ? Number(propChampId) : null) }, [propChampId])
  useEffect(() => { setLocalTournId(propTournId ? Number(propTournId) : null) }, [propTournId])

  const [stats, setStats]           = useState([])
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)
  const [search, setSearch]         = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [sortKey, setSortKey]       = useState('total_fantasy_points')
  const [sortDir, setSortDir]       = useState('desc')

  const [matchDays, setMatchDays]         = useState([])
  const [selectedWeek, setSelectedWeek]   = useState('')
  const [selectedDate, setSelectedDate]   = useState('')
  const [selectedGroup, setSelectedGroup] = useState('')
  const [selectedMatch, setSelectedMatch] = useState('')

  // Modo agregado: campeonato selecionado mas sem fase específica
  const isAggregated = !!localChampId && !localTournId

  // Config estática da fase selecionada (PAS 2026)
  const phaseConfig = localTournId ? PAS_2026_PHASE_MAP.get(localTournId) ?? null : null

  // Busca dias/partidas quando uma fase específica é selecionada
  useEffect(() => {
    if (!localTournId) { setMatchDays([]); setSelectedWeek(''); setSelectedDate(''); setSelectedGroup(''); setSelectedMatch(''); return }
    setMatchDays([]); setSelectedWeek(''); setSelectedDate(''); setSelectedGroup(''); setSelectedMatch('')
    fetch(`${API_BASE}/tournaments/${localTournId}/matches`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.days) setMatchDays(d.days) })
      .catch(() => {})
  }, [localTournId])

  useEffect(() => { setSelectedMatch('') }, [selectedGroup])
  useEffect(() => { setSelectedGroup(''); setSelectedMatch('') }, [selectedDate])
  useEffect(() => { setSelectedDate(''); setSelectedGroup(''); setSelectedMatch('') }, [selectedWeek])

  // Agrupa dias em semanas: gap > 4 dias entre sessões = nova semana
  const weeks = useMemo(() => {
    if (matchDays.length === 0) return []
    const groups = [[matchDays[0]]]
    for (let i = 1; i < matchDays.length; i++) {
      const prev = new Date(matchDays[i - 1].date)
      const curr = new Date(matchDays[i].date)
      const diffDays = (curr - prev) / (1000 * 60 * 60 * 24)
      if (diffDays > 4) groups.push([matchDays[i]])
      else groups[groups.length - 1].push(matchDays[i])
    }
    return groups.map((days, i) => ({
      week: i + 1,
      label: `Week ${i + 1}`,
      dates: days.map((d) => d.date),
      matchCount: days.reduce((a, d) => a + d.matches_count, 0),
    }))
  }, [matchDays])

  // Dias visíveis conforme semana selecionada
  const visibleMatchDays = useMemo(() => {
    if (!selectedWeek) return matchDays
    const wk = weeks.find((w) => w.week === Number(selectedWeek))
    return wk ? matchDays.filter((d) => wk.dates.includes(d.date)) : matchDays
  }, [matchDays, selectedWeek, weeks])

  // Grupos disponíveis no dia selecionado (derivado dos group_label das partidas)
  // Só aparece quando a fase config indica may_have_groups e o dia tem partidas com group_label
  const groupsForDay = useMemo(() => {
    if (!phaseConfig?.may_have_groups || !selectedDate) return []
    const day = matchDays.find((d) => d.date === selectedDate)
    if (!day?.matches) return []
    const gs = [...new Set(day.matches.map((m) => m.group_label).filter(Boolean))].sort()
    return gs
  }, [phaseConfig, selectedDate, matchDays])

  // Busca stats: campeonato completo ou fase específica
  useEffect(() => {
    if (!localTournId && !localChampId) return
    setLoading(true); setError(null); setStats([])

    let url
    if (isAggregated) {
      url = `${API_BASE}/championship-phases/${localChampId}/player-stats?limit=200`
    } else {
      url = `${API_BASE}/tournaments/${localTournId}/player-stats?limit=200`
      if (selectedMatch) {
        url += `&match_id=${selectedMatch}`
      } else {
        if (selectedDate)  url += `&date=${selectedDate}`
        if (selectedGroup) url += `&group_label=${selectedGroup}`
      }
    }

    fetch(url)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((d) => { setStats(d); setLoading(false) })
      .catch((e) => { setError(e.message); setLoading(false) })
  }, [localChampId, localTournId, selectedDate, selectedGroup, selectedMatch, isAggregated])

  const teamOptions = useMemo(() => {
    const tags = new Set(stats.map((p) => formatTeamTag(p.name, p.team)).filter(Boolean))
    return Array.from(tags).sort()
  }, [stats])

  const filtered = useMemo(() => stats.filter((p) => {
    const nm = !search || formatPlayerName(p.name).toLowerCase().includes(search.toLowerCase())
    const tm = !teamFilter || formatTeamTag(p.name, p.team) === teamFilter
    return nm && tm
  }), [stats, search, teamFilter])

  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    return [...filtered].sort((a, b) => {
      const col = COLUMNS.find(c => c.key === sortKey)
      let av, bv
      if (col?.sortVal) {
        av = col.sortVal(a)
        bv = col.sortVal(b)
      } else if (sortKey === 'name') {
        av = formatPlayerName(a.name)
        bv = formatPlayerName(b.name)
      } else {
        av = a[sortKey]
        bv = b[sortKey]
      }
      av = av ?? (sortDir === 'desc' ? -Infinity : Infinity)
      bv = bv ?? (sortDir === 'desc' ? -Infinity : Infinity)
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      return sortDir === 'desc' ? bv - av : av - bv
    })
  }, [filtered, sortKey, sortDir])

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const matchesTotal       = isAggregated ? 0 : (stats[0]?.matches_total ?? 0)
  const selectedTournament = tournaments?.find((t) => t.id === localTournId)
  const selectedChamp      = championships?.find((c) => c.id === localChampId)

  const matchesForDay = useMemo(() => {
    if (!selectedDate) return []
    const day = matchDays.find((d) => d.date === selectedDate)
    return day?.matches || []
  }, [selectedDate, matchDays])

  // Partidas visíveis no seletor de partida — filtradas por grupo quando selecionado
  const matchesForGroup = useMemo(() => {
    if (!selectedGroup) return matchesForDay
    return matchesForDay.filter((m) => m.group_label === selectedGroup)
  }, [matchesForDay, selectedGroup])

  const filterLabel = useMemo(() => {
    if (selectedMatch) {
      const match = matchesForDay.find((m) => String(m.id) === String(selectedMatch))
      if (match) {
        const groupPart = match.group_label ? ` · Grupo ${match.group_label}` : ''
        return `Partida ${match.match_number_in_day}${groupPart} — ${match.map_name}`
      }
    }
    if (selectedGroup && selectedDate) {
      const [, mm, dd] = selectedDate.split('-')
      const wkLabel = selectedWeek ? ` · ${weeks.find((w) => w.week === Number(selectedWeek))?.label ?? ''}` : ''
      return `${dd}/${mm}${wkLabel} · Grupo ${selectedGroup}`
    }
    if (selectedDate) {
      const [, mm, dd] = selectedDate.split('-')
      const wkLabel = selectedWeek ? ` · ${weeks.find((w) => w.week === Number(selectedWeek))?.label ?? ''}` : ''
      return `${dd}/${mm}${wkLabel}`
    }
    if (selectedWeek) {
      return weeks.find((w) => w.week === Number(selectedWeek))?.label ?? 'Semana'
    }
    return 'Torneio completo'
  }, [selectedMatch, selectedDate, selectedGroup, selectedWeek, matchesForDay, weeks])

  const thStyle = (col) => ({
    padding: '10px 12px',
    fontSize: '11px', fontWeight: 700,
    letterSpacing: '0.08em', textTransform: 'uppercase',
    textAlign: col?.right ? 'right' : 'left',
    cursor: 'pointer', userSelect: 'none',
    whiteSpace: 'nowrap',
    color: sortKey === col?.key ? 'var(--color-xama-orange)' : 'var(--color-xama-muted)',
    fontFamily: "'Rajdhani', sans-serif",
    transition: 'color 0.15s',
  })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-xama-black)', fontFamily: "'Rajdhani', sans-serif" }}>

      {/* Header */}
      <div className="px-6 py-5 border-b" style={{ background: 'var(--color-xama-surface)', borderColor: 'var(--color-xama-border)' }}>
        <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
          <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span style={{ fontSize: '22px', lineHeight: 1 }}>📊</span>
                <h1 className="text-[28px] font-bold tracking-tight" style={{ color: 'var(--color-xama-text)', letterSpacing: '-0.01em' }}>
                  PLAYER STATS
                </h1>
                {matchesTotal > 0 && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-[0.08em]"
                    style={{ fontFamily: "'JetBrains Mono', monospace", background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.25)', color: 'var(--color-xama-orange)' }}>
                    {matchesTotal}M
                  </span>
                )}
                {(selectedDate || selectedGroup || selectedMatch || selectedWeek) && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold"
                    style={{ fontFamily: "'JetBrains Mono', monospace", background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa' }}>
                    {filterLabel}
                  </span>
                )}
              </div>
              <p className="text-[12px] tracking-[0.1em] uppercase" style={{ color: 'var(--color-xama-muted)' }}>
                {isAggregated
                  ? (selectedChamp?.name ?? 'Campeonato completo')
                  : (selectedTournament?.name ?? (selectedChamp ? 'Selecione a fase' : 'Selecione um campeonato'))
                }
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Seletor hierárquico: Campeonato → Fase */}
            <ChampionshipSelector
              championships={championships || []}
              loading={championshipsLoading}
              selectedChampId={localChampId}
              onChampChange={(cid) => {
                setLocalChampId(cid)
                setLocalTournId(null)
                setSelectedDate(''); setSelectedGroup(''); setSelectedMatch('')
              }}
              selectedTournId={localTournId}
              onTournChange={(tid) => {
                setLocalTournId(tid)
                // Navega para a fase selecionada (quando é uma fase real, não "campeonato completo")
                if (tid) onTournamentChange?.(tid)
                setSelectedDate(''); setSelectedGroup(''); setSelectedMatch('')
              }}
              tournaments={tournaments || []}
              allowAggregated={true}
            />

            {/* Filtros de dia e partida — só disponíveis para uma fase específica */}
            {/* Seletor de Semana (só aparece se há mais de 1 semana) */}
            {!isAggregated && weeks.length > 1 && (
              <select value={selectedWeek} onChange={(e) => setSelectedWeek(e.target.value)} style={{ ...selectStyle, minWidth: '130px' }}>
                <option value="">Todas as semanas</option>
                {weeks.map((w) => (
                  <option key={w.week} value={w.week}>
                    {w.label} ({w.matchCount}M)
                  </option>
                ))}
              </select>
            )}

            {!isAggregated && visibleMatchDays.length > 0 && (
              <select value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={{ ...selectStyle, minWidth: '140px' }}>
                <option value="">Todos os dias</option>
                {visibleMatchDays.map((d) => {
                  const [, mm, dd] = d.date.split('-')
                  return <option key={d.date} value={d.date}>{dd}/{mm} ({d.matches_count} partidas)</option>
                })}
              </select>
            )}

            {/* Seletor de Grupo — só aparece quando o dia tem partidas com group_label */}
            {!isAggregated && groupsForDay.length > 0 && (
              <select value={selectedGroup} onChange={(e) => setSelectedGroup(e.target.value)} style={{ ...selectStyle, minWidth: '130px' }}>
                <option value="">Todos os grupos</option>
                {groupsForDay.map((g) => (
                  <option key={g} value={g}>Grupo {g}</option>
                ))}
              </select>
            )}

            {!isAggregated && selectedDate && matchesForGroup.length > 0 && (
              <select value={selectedMatch} onChange={(e) => setSelectedMatch(e.target.value)} style={{ ...selectStyle, minWidth: '180px' }}>
                <option value="">Todas as partidas</option>
                {matchesForGroup.map((m) => (
                  <option key={m.id} value={m.id}>
                    {MAP_ICONS[m.map_name] || '🗺️'} P{m.match_number_in_day}{m.group_label ? ` [${m.group_label}]` : ''} — {m.map_name}
                  </option>
                ))}
              </select>
            )}

            <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} style={{ ...selectStyle, minWidth: '110px' }}>
              <option value="">Todos os times</option>
              {teamOptions.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>

            <input type="text" placeholder="Buscar jogador..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ ...selectStyle, width: '160px' }} />

            {(selectedWeek || selectedDate || selectedGroup || selectedMatch || teamFilter || search) && (
              <button onClick={() => { setSelectedWeek(''); setSelectedDate(''); setSelectedGroup(''); setSelectedMatch(''); setTeamFilter(''); setSearch('') }}
                style={{ ...selectStyle, color: '#f87171', borderColor: 'rgba(248,113,113,0.3)', cursor: 'pointer', background: 'rgba(248,113,113,0.05)' }}>
                ✕ Limpar
              </button>
            )}

            {sorted.length > 0 && (
              <span className="px-2 py-1 rounded text-[12px]"
                style={{ fontFamily: "'JetBrains Mono', monospace", background: '#1a1f2e', border: '1px solid var(--color-xama-border)', color: 'var(--color-xama-muted)' }}>
                {sorted.length}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '24px 16px' }}>

        {loading && <p className="text-center py-20 text-[14px]" style={{ color: 'var(--color-xama-muted)' }}>Carregando stats...</p>}
        {error   && <div className="msg-error max-w-lg mx-auto mt-8">Erro: {error}</div>}
        {!loading && !error && !localTournId && !localChampId && (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <span style={{ fontSize: '48px' }}>📊</span>
            <p className="text-[16px] font-semibold tracking-[0.06em] uppercase" style={{ color: 'var(--color-xama-muted)' }}>
              Selecione um campeonato
            </p>
          </div>
        )}

        {!loading && !error && sorted.length > 0 && (
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
                    {COLUMNS.map((col) => (
                      <th key={col.key} onClick={() => handleSort(col.key)}
                        title={col.title} style={thStyle(col)}>
                        {col.label}<SortIcon active={sortKey === col.key} dir={sortDir} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((p, idx) => {
                    const rankColors = ['#f0c040', '#b4bcc8', '#cd7f50']
                    const teamTag = formatTeamTag(p.name, p.team)
                    return (
                      <tr key={p.player_id}
                        style={{ borderBottom: '1px solid #13161f' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#161b27'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 700, color: idx < 3 ? rankColors[idx] : '#2a3046' }}>
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <TeamLogo teamName={teamTag} size={28} />
                            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em',
                              color: 'var(--color-xama-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                              {teamTag}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-xama-text)' }}>
                            {formatPlayerName(p.name)}
                          </span>
                        </td>
                        {COLUMNS.map((col) => {
                          const rendered = col.render(p)
                          const cellColor = col.color ? col.color(p) : 'var(--color-xama-text)'
                          return (
                            <td key={col.key} style={{ padding: '10px 12px', textAlign: col.right ? 'right' : 'left', fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', color: cellColor }}>
                              {rendered}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--color-xama-border)', background: '#0a0c11' }}>
              <span className="text-[11px] font-bold tracking-[0.1em] uppercase" style={{ color: 'var(--color-xama-orange)', fontFamily: "'Rajdhani', sans-serif" }}>
                🔥 XAMA Fantasy
              </span>
              <span className="text-[11px] tabular-nums" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-xama-muted)' }}>
                {sorted.length} / {stats.length} jogadores · {filterLabel}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
