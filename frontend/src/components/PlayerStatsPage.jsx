// frontend/src/components/PlayerStatsPage.jsx
// XAMA Fantasy — Player Stats Page (expanded)
// Filtros: torneio, dia, partida, time, jogador

import { useState, useEffect, useMemo } from 'react'
import { API_BASE_URL as API_BASE } from '../config'
import TeamLogo from './TeamLogo'

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
  return Math.round((kills + damage) * 100) / 100
}
const calcPenalty = (p) => {
  const count = p.total_penalty_count || 0
  if (count === 0) return '0'
  return `${count}(${count * -15})`
}

const COLUMNS = [
  { key: 'matches_played',       label: 'M',          title: 'Partidas jogadas',         right: true,  render: (p) => `${p.matches_played}/${p.matches_total}` },
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
  tournaments, tournamentsLoading, selectedTournamentId, onTournamentChange,
}) {
  const [stats, setStats]           = useState([])
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)
  const [search, setSearch]         = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [sortKey, setSortKey]       = useState('total_fantasy_points')
  const [sortDir, setSortDir]       = useState('desc')

  const [matchDays, setMatchDays]         = useState([])
  const [selectedDate, setSelectedDate]   = useState('')
  const [selectedMatch, setSelectedMatch] = useState('')

  useEffect(() => {
    if (!selectedTournamentId) return
    setMatchDays([]); setSelectedDate(''); setSelectedMatch('')
    fetch(`${API_BASE}/tournaments/${selectedTournamentId}/matches`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.days) setMatchDays(d.days) })
      .catch(() => {})
  }, [selectedTournamentId])

  useEffect(() => { setSelectedMatch('') }, [selectedDate])

  useEffect(() => {
    if (!selectedTournamentId) return
    setLoading(true); setError(null)
    let url = `${API_BASE}/tournaments/${selectedTournamentId}/player-stats?limit=200`
    if (selectedMatch) url += `&match_id=${selectedMatch}`
    else if (selectedDate) url += `&date=${selectedDate}`
    fetch(url)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((d) => { setStats(d); setLoading(false) })
      .catch((e) => { setError(e.message); setLoading(false) })
  }, [selectedTournamentId, selectedDate, selectedMatch])

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

  const matchesTotal       = stats[0]?.matches_total ?? 0
  const selectedTournament = tournaments?.find((t) => t.id === Number(selectedTournamentId))

  const matchesForDay = useMemo(() => {
    if (!selectedDate) return []
    const day = matchDays.find((d) => d.date === selectedDate)
    return day?.matches || []
  }, [selectedDate, matchDays])

  const filterLabel = useMemo(() => {
    if (selectedMatch) {
      const match = matchesForDay.find((m) => String(m.id) === String(selectedMatch))
      if (match) return `Partida ${match.match_number_in_day} — ${match.map_name}`
    }
    if (selectedDate) {
      const [, mm, dd] = selectedDate.split('-')
      return `${dd}/${mm}`
    }
    return 'Torneio completo'
  }, [selectedMatch, selectedDate, matchesForDay])

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
                {(selectedDate || selectedMatch) && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold"
                    style={{ fontFamily: "'JetBrains Mono', monospace", background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa' }}>
                    {filterLabel}
                  </span>
                )}
              </div>
              <p className="text-[12px] tracking-[0.1em] uppercase" style={{ color: 'var(--color-xama-muted)' }}>
                {selectedTournament?.name ?? 'Selecione um torneio'}
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <select value={selectedTournamentId || ''} onChange={(e) => { onTournamentChange(Number(e.target.value)); setSelectedDate(''); setSelectedMatch('') }}
              style={{ ...selectStyle, minWidth: '220px' }}>
              <option value="">Selecione torneio</option>
              {(tournaments || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>

            {matchDays.length > 0 && (
              <select value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={{ ...selectStyle, minWidth: '140px' }}>
                <option value="">Todos os dias</option>
                {matchDays.map((d) => {
                  const [, mm, dd] = d.date.split('-')
                  return <option key={d.date} value={d.date}>{dd}/{mm} ({d.matches_count} partidas)</option>
                })}
              </select>
            )}

            {selectedDate && matchesForDay.length > 0 && (
              <select value={selectedMatch} onChange={(e) => setSelectedMatch(e.target.value)} style={{ ...selectStyle, minWidth: '180px' }}>
                <option value="">Todas as partidas</option>
                {matchesForDay.map((m) => (
                  <option key={m.id} value={m.id}>
                    {MAP_ICONS[m.map_name] || '🗺️'} P{m.match_number_in_day} — {m.map_name}
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

            {(selectedDate || selectedMatch || teamFilter || search) && (
              <button onClick={() => { setSelectedDate(''); setSelectedMatch(''); setTeamFilter(''); setSearch('') }}
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
        {!loading && !error && !selectedTournamentId && (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <span style={{ fontSize: '48px' }}>📊</span>
            <p className="text-[16px] font-semibold tracking-[0.06em] uppercase" style={{ color: 'var(--color-xama-muted)' }}>
              Selecione um torneio
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
