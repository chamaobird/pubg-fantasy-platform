// frontend/src/components/PlayerStatsPage.jsx
// XAMA Fantasy — Player Stats Page (expanded)
// Inspirado na densidade da Twire, fontes maiores, todas as métricas

import { useState, useEffect, useMemo } from 'react'
import { API_BASE_URL as API_BASE } from '../config'

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
const fmt1 = (v) => v != null ? Number(v).toFixed(1) : '—'
const fmt2 = (v) => v != null ? Number(v).toFixed(2) : '—'
const fmtInt = (v) => v != null ? Math.round(v) : '—'

// ── Column definitions ────────────────────────────────────────────────────────
const COLUMNS = [
  { key: 'matches_played', label: 'M',        title: 'Partidas jogadas',     right: true,  render: (p) => `${p.matches_played}/${p.matches_total}` },
  { key: 'avg_kills',      label: 'K/G',       title: 'Kills por jogo',       right: true,  render: (p) => fmt1(p.avg_kills) },
  { key: 'total_kills',    label: 'K Total',   title: 'Total de kills',       right: true,  render: (p) => fmtInt(p.total_kills) },
  { key: 'avg_assists',    label: 'ASS/G',     title: 'Assists por jogo',     right: true,  render: (p) => fmt2(p.avg_assists) },
  { key: 'avg_damage',     label: 'DMG/G',     title: 'Dano por jogo',        right: true,  render: (p) => fmtInt(p.avg_damage) },
  { key: 'total_damage',   label: 'DMG Total', title: 'Dano total',           right: true,  render: (p) => fmtInt(p.total_damage) },
  { key: 'avg_placement',  label: 'PLACE',     title: 'Colocação média',      right: true,  render: (p) => fmt1(p.avg_placement), color: (p) => placementColorHex(p.avg_placement) },
  { key: 'avg_headshots',  label: 'HS/G',      title: 'Headshots por jogo',   right: true,  render: (p) => fmt2(p.avg_headshots) },
  { key: 'avg_knocks',     label: 'KD/G',      title: 'Knockdowns por jogo',  right: true,  render: (p) => fmt2(p.avg_knocks) },
  { key: 'avg_survival_secs', label: 'SURV',   title: 'Sobrevivência média (s)', right: true, render: (p) => fmtInt(p.avg_survival_secs) },
  { key: 'pts_per_match',  label: 'PTS/G',     title: 'Pontos fantasy por jogo', right: true, render: (p) => fmt2(p.pts_per_match) },
  { key: 'total_fantasy_points', label: 'PTS Total', title: 'Pontos fantasy totais', right: true, render: (p) => fmt2(p.total_fantasy_points) },
  { key: 'fantasy_cost',   label: 'PREÇO',     title: 'Preço fantasy',        right: true,  render: (p) => `${Number(p.fantasy_cost).toFixed(2)} cr` },
]

function SortIcon({ active, dir }) {
  if (!active) return <span className="ml-0.5 opacity-20 text-[9px]">⇅</span>
  return <span className="ml-0.5 text-[9px]" style={{ color: 'var(--color-xama-orange)' }}>{dir === 'desc' ? '▼' : '▲'}</span>
}

export default function PlayerStatsPage({
  tournaments, tournamentsLoading, selectedTournamentId, onTournamentChange,
}) {
  const [stats, setStats]           = useState([])
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)
  const [search, setSearch]         = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [sortKey, setSortKey]       = useState('pts_per_match')
  const [sortDir, setSortDir]       = useState('desc')

  useEffect(() => {
    if (!selectedTournamentId) return
    setLoading(true); setError(null)
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
      let av = sortKey === 'name' ? formatPlayerName(a.name) : a[sortKey]
      let bv = sortKey === 'name' ? formatPlayerName(b.name) : b[sortKey]
      av = av ?? (sortDir === 'desc' ? -Infinity : Infinity)
      bv = bv ?? (sortDir === 'desc' ? -Infinity : Infinity)
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      return sortDir === 'desc' ? bv - av : av - bv
    })
  }, [filtered, sortKey, sortDir])

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir(key === 'avg_placement' ? 'asc' : 'desc') }
  }

  const matchesTotal = stats[0]?.matches_total ?? 0
  const selectedTournament = tournaments?.find((t) => t.id === Number(selectedTournamentId))

  const thStyle = (col) => ({
    padding: '10px 12px',
    fontSize: '11px', fontWeight: 700,
    letterSpacing: '0.08em', textTransform: 'uppercase',
    textAlign: col.right ? 'right' : 'left',
    cursor: 'pointer', userSelect: 'none',
    whiteSpace: 'nowrap',
    color: sortKey === col.key ? 'var(--color-xama-orange)' : 'var(--color-xama-muted)',
    fontFamily: "'Rajdhani', sans-serif",
    transition: 'color 0.15s',
  })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-xama-black)', fontFamily: "'Rajdhani', sans-serif" }}>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="px-6 py-5 border-b" style={{ background: 'var(--color-xama-surface)', borderColor: 'var(--color-xama-border)' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }} className="flex flex-wrap items-end justify-between gap-4">
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
            </div>
            <p className="text-[12px] tracking-[0.1em] uppercase" style={{ color: 'var(--color-xama-muted)' }}>
              {selectedTournament?.name ?? 'Selecione um torneio'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select value={selectedTournamentId || ''} onChange={(e) => onTournamentChange(Number(e.target.value))}
              className="dark-select" style={{ width: 'auto', minWidth: '220px', fontFamily: "'Rajdhani', sans-serif" }}>
              <option value="">Selecione torneio</option>
              {(tournaments || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>

            <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}
              className="dark-select" style={{ width: 'auto', minWidth: '110px', fontFamily: "'Rajdhani', sans-serif" }}>
              <option value="">Todos os times</option>
              {teamOptions.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>

            <input type="text" placeholder="Buscar jogador..." value={search}
              onChange={(e) => setSearch(e.target.value)} className="dark-input"
              style={{ width: '160px', fontFamily: "'Rajdhani', sans-serif" }} />

            {sorted.length > 0 && (
              <span className="px-2 py-1 rounded text-[12px]"
                style={{ fontFamily: "'JetBrains Mono', monospace", background: '#1a1f2e', border: '1px solid var(--color-xama-border)', color: 'var(--color-xama-muted)' }}>
                {sorted.length}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px 16px' }}>

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
                    {/* Fixed columns */}
                    <th style={{ ...thStyle({ right: false }), width: '40px' }}>#</th>
                    <th onClick={() => handleSort('name')} style={thStyle({ key: 'name', right: false })}>
                      Jogador<SortIcon active={sortKey === 'name'} dir={sortDir} />
                    </th>
                    <th onClick={() => handleSort('team')} style={thStyle({ key: 'team', right: false })}>
                      Time<SortIcon active={sortKey === 'team'} dir={sortDir} />
                    </th>
                    {/* Dynamic columns */}
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
                    return (
                      <tr key={p.player_id}
                        style={{ borderBottom: '1px solid #13161f' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#161b27'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        {/* Rank */}
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 700, color: idx < 3 ? rankColors[idx] : '#2a3046' }}>
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                        </td>

                        {/* Name */}
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-xama-text)' }}>
                            {formatPlayerName(p.name)}
                          </span>
                        </td>

                        {/* Team */}
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', padding: '2px 7px', borderRadius: '4px', background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.18)', color: 'var(--color-xama-orange)' }}>
                            {formatTeamTag(p.name, p.team)}
                          </span>
                        </td>

                        {/* Dynamic columns */}
                        {COLUMNS.map((col) => (
                          <td key={col.key} style={{ padding: '10px 12px', textAlign: col.right ? 'right' : 'left', fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', color: col.color ? col.color(p) : 'var(--color-xama-text)' }}>
                            {col.render(p)}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--color-xama-border)', background: '#0a0c11' }}>
              <span className="text-[11px] font-bold tracking-[0.1em] uppercase" style={{ color: 'var(--color-xama-orange)', fontFamily: "'Rajdhani', sans-serif" }}>
                🔥 XAMA Fantasy
              </span>
              <span className="text-[11px] tabular-nums" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-xama-muted)' }}>
                {sorted.length} / {stats.length} jogadores
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
