// frontend/src/components/PlayerStatsPage.jsx
// XAMA Fantasy — Player Stats Page
// Tailwind v4 + tema XAMA
// Tipografia: Rajdhani (display) + JetBrains Mono (números)

import { useState, useEffect, useMemo } from 'react'
import { API_BASE_URL as API_BASE } from '../config'

// ── Google Fonts injection ────────────────────────────────────────────────────
if (!document.getElementById('xama-fonts')) {
  const link = document.createElement('link')
  link.id   = 'xama-fonts'
  link.rel  = 'stylesheet'
  link.href = 'https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=JetBrains+Mono:wght@400;600&display=swap'
  document.head.appendChild(link)
}

// ── Helpers ───────────────────────────────────────────────────────────────────
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

// ── Participation bar ─────────────────────────────────────────────────────────
function MatchBar({ played, total }) {
  const pct  = total > 0 ? (played / total) * 100 : 0
  const full = played === total
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-[3px] rounded-full overflow-hidden" style={{ background: '#1e2330' }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: full ? 'var(--color-xama-orange)' : 'var(--color-xama-muted)',
            transition: 'width 0.4s ease',
          }}
        />
      </div>
      <span
        className="text-[11px] tabular-nums"
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          color: full ? 'var(--color-xama-orange)' : 'var(--color-xama-muted)',
        }}
      >
        {played}<span style={{ color: '#2a3046' }}>/{total}</span>
      </span>
    </div>
  )
}

// ── Sort indicator ────────────────────────────────────────────────────────────
function SortIcon({ active, dir }) {
  if (!active) return <span className="ml-1 text-[9px] opacity-25">⇅</span>
  return (
    <span className="ml-1 text-[9px]" style={{ color: 'var(--color-xama-orange)' }}>
      {dir === 'desc' ? '▼' : '▲'}
    </span>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function PlayerStatsPage({
  tournaments,
  tournamentsLoading,
  selectedTournamentId,
  onTournamentChange,
}) {
  const [stats, setStats]           = useState([])
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)
  const [search, setSearch]         = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [sortKey, setSortKey]       = useState('avg_kills')
  const [sortDir, setSortDir]       = useState('desc')

  useEffect(() => {
    if (!selectedTournamentId) return
    setLoading(true)
    setError(null)
    fetch(`${API_BASE}/tournaments/${selectedTournamentId}/player-stats?limit=200`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((d) => { setStats(d); setLoading(false) })
      .catch((e) => { setError(e.message); setLoading(false) })
  }, [selectedTournamentId])

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
      const av = a[sortKey] ?? (sortDir === 'desc' ? -Infinity : Infinity)
      const bv = b[sortKey] ?? (sortDir === 'desc' ? -Infinity : Infinity)
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      return sortDir === 'desc' ? bv - av : av - bv
    })
  }, [filtered, sortKey, sortDir])

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir(key === 'avg_placement' ? 'asc' : 'desc') }
  }

  const matchesTotal        = stats[0]?.matches_total ?? 0
  const selectedTournament  = tournaments?.find((t) => t.id === selectedTournamentId)

  // sortable header cell
  const Th = ({ col, label, right = false }) => (
    <th
      onClick={() => handleSort(col)}
      className="px-4 py-3 text-[10px] font-bold tracking-[0.1em] uppercase cursor-pointer select-none whitespace-nowrap transition-colors duration-150"
      style={{
        textAlign: right ? 'right' : 'left',
        color: sortKey === col ? 'var(--color-xama-orange)' : 'var(--color-xama-muted)',
        fontFamily: "'Rajdhani', sans-serif",
      }}
    >
      {label}<SortIcon active={sortKey === col} dir={sortDir} />
    </th>
  )

  return (
    <div style={{ background: 'var(--color-xama-black)', minHeight: '100vh', fontFamily: "'Rajdhani', sans-serif" }}>

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div
        className="px-6 py-5 border-b"
        style={{ background: 'var(--color-xama-surface)', borderColor: 'var(--color-xama-border)' }}
      >
        <div className="max-w-6xl mx-auto flex flex-wrap items-end justify-between gap-4">

          {/* Title */}
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span style={{ fontSize: '22px', lineHeight: 1 }}>🔥</span>
              <h1
                className="text-[28px] font-bold tracking-tight"
                style={{ color: 'var(--color-xama-text)', letterSpacing: '-0.01em' }}
              >
                PLAYER STATS
              </h1>
              {matchesTotal > 0 && (
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-bold tracking-[0.08em]"
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    background: 'rgba(249,115,22,0.12)',
                    border: '1px solid rgba(249,115,22,0.25)',
                    color: 'var(--color-xama-orange)',
                  }}
                >
                  {matchesTotal}M
                </span>
              )}
            </div>
            <p
              className="text-[11px] tracking-[0.1em] uppercase"
              style={{ color: 'var(--color-xama-muted)' }}
            >
              {selectedTournament?.name ?? 'Nenhum torneio selecionado'}
            </p>
          </div>

          {/* Controls row */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedTournamentId || ''}
              onChange={(e) => onTournamentChange(Number(e.target.value))}
              className="dark-select"
              style={{ width: 'auto', minWidth: '200px', fontFamily: "'Rajdhani', sans-serif" }}
            >
              <option value="">Selecione torneio</option>
              {(tournaments || []).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>

            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="dark-select"
              style={{ width: 'auto', minWidth: '110px', fontFamily: "'Rajdhani', sans-serif" }}
            >
              <option value="">Todos os times</option>
              {teamOptions.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>

            <input
              type="text"
              placeholder="Buscar jogador..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="dark-input"
              style={{ width: '160px', fontFamily: "'Rajdhani', sans-serif" }}
            />

            {sorted.length > 0 && (
              <span
                className="px-2 py-1 rounded text-[11px]"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  background: '#1a1f2e',
                  border: '1px solid var(--color-xama-border)',
                  color: 'var(--color-xama-muted)',
                }}
              >
                {sorted.length}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 py-6">

        {(tournamentsLoading || loading) && (
          <p className="text-center py-20 text-[13px]" style={{ color: 'var(--color-xama-muted)' }}>
            Carregando...
          </p>
        )}

        {error && <div className="msg-error max-w-lg mx-auto mt-8">Erro: {error}</div>}

        {!loading && !error && !selectedTournamentId && (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <span style={{ fontSize: '48px' }}>🔥</span>
            <p
              className="text-[16px] font-semibold tracking-[0.06em] uppercase"
              style={{ color: 'var(--color-xama-muted)' }}
            >
              Selecione um torneio
            </p>
          </div>
        )}

        {!loading && !error && selectedTournamentId && sorted.length === 0 && !loading && (
          <p className="text-center py-20 text-[13px]" style={{ color: 'var(--color-xama-muted)' }}>
            Nenhum jogador com stats neste torneio.
          </p>
        )}

        {!loading && !error && sorted.length > 0 && (
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: '1px solid var(--color-xama-border)', background: 'var(--color-xama-surface)' }}
          >
            {/* orange accent line */}
            <div style={{ height: '2px', background: 'linear-gradient(90deg, var(--color-xama-orange) 0%, transparent 55%)' }} />

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr style={{ background: '#0a0c11', borderBottom: '1px solid var(--color-xama-border)' }}>
                    <th
                      className="px-4 py-3 text-[10px] font-bold tracking-[0.1em] uppercase text-left"
                      style={{ color: 'var(--color-xama-muted)', width: '48px', fontFamily: "'Rajdhani', sans-serif" }}
                    >
                      #
                    </th>
                    <Th col="name"           label="Jogador" />
                    <Th col="team"           label="Time" />
                    <Th col="matches_played" label="Jogos" />
                    <Th col="avg_kills"      label="K/G"     right />
                    <Th col="total_kills"    label="Total K" right />
                    <Th col="avg_damage"     label="DMG/G"   right />
                    <Th col="avg_placement"  label="Place"   right />
                    <Th col="fantasy_cost"   label="Preço"   right />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((p, idx) => {
                    const rankColors = ['#f0c040', '#b4bcc8', '#cd7f50']
                    return (
                      <tr
                        key={p.player_id}
                        style={{ borderBottom: '1px solid #13161f', cursor: 'default' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#161b27'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        {/* rank */}
                        <td className="px-4 py-[11px]">
                          <span
                            className="text-[13px] font-bold tabular-nums"
                            style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              color: idx < 3 ? rankColors[idx] : '#2a3046',
                            }}
                          >
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                        </td>

                        {/* name */}
                        <td className="px-4 py-[11px]">
                          <span
                            className="text-[15px] font-semibold tracking-wide"
                            style={{ color: 'var(--color-xama-text)' }}
                          >
                            {formatPlayerName(p.name)}
                          </span>
                        </td>

                        {/* team */}
                        <td className="px-4 py-[11px]">
                          <span
                            className="text-[10px] font-bold tracking-[0.07em] px-2 py-0.5 rounded"
                            style={{
                              background: 'rgba(249,115,22,0.08)',
                              border: '1px solid rgba(249,115,22,0.18)',
                              color: 'var(--color-xama-orange)',
                            }}
                          >
                            {formatTeamTag(p.name, p.team)}
                          </span>
                        </td>

                        {/* matches bar */}
                        <td className="px-4 py-[11px]">
                          <MatchBar played={p.matches_played} total={matchesTotal} />
                        </td>

                        {/* K/G */}
                        <td className="px-4 py-[11px] text-right">
                          <span
                            className="text-[13px] font-semibold tabular-nums"
                            style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-xama-text)' }}
                          >
                            {p.avg_kills.toFixed(1)}
                          </span>
                        </td>

                        {/* total kills */}
                        <td className="px-4 py-[11px] text-right">
                          <span
                            className="text-[13px] tabular-nums"
                            style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-xama-muted)' }}
                          >
                            {p.total_kills}
                          </span>
                        </td>

                        {/* dmg */}
                        <td className="px-4 py-[11px] text-right">
                          <span
                            className="text-[13px] tabular-nums"
                            style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-xama-text)' }}
                          >
                            {Math.round(p.avg_damage)}
                          </span>
                        </td>

                        {/* placement */}
                        <td className="px-4 py-[11px] text-right">
                          <span
                            className="text-[13px] font-semibold tabular-nums"
                            style={{ fontFamily: "'JetBrains Mono', monospace", color: placementColorHex(p.avg_placement) }}
                          >
                            #{p.avg_placement.toFixed(1)}
                          </span>
                        </td>

                        {/* price */}
                        <td className="px-4 py-[11px] text-right">
                          <span
                            className="text-[13px] font-bold tabular-nums"
                            style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-xama-gold)' }}
                          >
                            {p.fantasy_cost.toFixed(2)}
                            <span className="text-[10px] ml-0.5 font-normal" style={{ color: 'var(--color-xama-muted)' }}>cr</span>
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* table footer */}
            <div
              className="px-5 py-3 flex items-center justify-between"
              style={{ borderTop: '1px solid var(--color-xama-border)', background: '#0a0c11' }}
            >
              <span
                className="text-[11px] font-bold tracking-[0.1em] uppercase"
                style={{ color: 'var(--color-xama-orange)', fontFamily: "'Rajdhani', sans-serif" }}
              >
                🔥 XAMA Fantasy
              </span>
              <span
                className="text-[11px] tabular-nums"
                style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-xama-muted)' }}
              >
                {sorted.length} / {stats.length}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
