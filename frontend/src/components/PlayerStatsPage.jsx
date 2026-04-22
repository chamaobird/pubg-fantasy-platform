// frontend/src/components/PlayerStatsPage.jsx
// XAMA Fantasy — Player Stats migrado para /stages/ (Fase 7)
// Hierarquia: Stage → Dia → Partida
// Championship scope: agrega stats de todas as stages locked do campeonato

import { useState, useEffect, useMemo, useCallback } from 'react'
import { API_BASE_URL as API_BASE } from '../config'
import TeamLogo from './TeamLogo'
import PlayerHistoryModal from './PlayerHistoryModal'
import { formatTeamTag, formatPlayerName } from '../utils/teamUtils'

if (!document.getElementById('xama-fonts')) {
  const link = document.createElement('link')
  link.id = 'xama-fonts'; link.rel = 'stylesheet'
  link.href = 'https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=JetBrains+Mono:wght@400;600&display=swap'
  document.head.appendChild(link)
}

const fmt1   = (v) => v != null ? Number(v).toFixed(1) : '—'
const fmt2   = (v) => v != null ? Number(v).toFixed(2) : '—'
const fmtInt = (v) => v != null ? Math.round(v) : '—'

// Pontos derivados de sobrevivência = total – kills×10 – assists×1 – knocks×1 – damage×0.03
// (late game bonus + early death penalty)
const KILL_PTS   = 10.0
const ASSIST_PTS  = 1.0
const KNOCK_PTS   = 1.0
const DMG_PTS     = 0.03
function survivalPts(p) {
  if (p.total_xama_points == null) return null
  const combatPts = (p.total_kills || 0) * KILL_PTS
    + (p.total_assists || 0) * ASSIST_PTS
    + (p.total_knocks  || 0) * KNOCK_PTS
    + (p.total_damage  || 0) * DMG_PTS
  return Math.round(((p.total_xama_points || 0) - combatPts) * 100) / 100
}

const MAP_DISPLAY = {
  Baltic_Main:  { icon: '🌿', name: 'Erangel' },
  Desert_Main:  { icon: '🏜️', name: 'Miramar' },
  Tiger_Main:   { icon: '🌾', name: 'Taego' },
  Neon_Main:    { icon: '🌀', name: 'Rondo' },
  Vikendi_Main: { icon: '❄️', name: 'Vikendi' },
  Kiki_Main:    { icon: '🌊', name: 'Deston' },
  Savage_Main:  { icon: '🌴', name: 'Sanhok' },
  Heaven_Main:  { icon: '🏙️', name: 'Haven' },
}

// ── Sparkline SVG inline ───────────────────────────────────────────────────

function Sparkline({ data, width = 48, height = 18 }) {
  if (!data || data.length < 2) return null
  const max = Math.max(...data.map((d) => d.pts), 0.01)
  const barW = Math.max(2, Math.floor((width - data.length) / data.length))
  const gap  = Math.max(1, Math.floor((width - data.length * barW) / (data.length - 1)))

  return (
    <svg width={width} height={height} style={{ display: 'inline-block', verticalAlign: 'middle', marginLeft: '6px' }}>
      {data.map((d, i) => {
        const barH = Math.max(2, Math.round((d.pts / max) * (height - 2)))
        const x = i * (barW + gap)
        const y = height - barH
        return (
          <rect
            key={d.day ?? d.stage ?? i}
            x={x} y={y} width={barW} height={barH}
            rx="1"
            fill={d.pts > 0 ? 'var(--color-xama-orange, #f97316)' : '#2a3046'}
            opacity={d.pts > 0 ? 0.8 : 0.4}
          />
        )
      })}
    </svg>
  )
}

// ── Colunas da tabela ──────────────────────────────────────────────────────
// Ordem: PREÇO, PTS/G, PTS XAMA, K TOTAL, DMG, ASS, PONTOS POR SOBREVIVENCIA
// (sparkline embutida no PTS XAMA)

const COLUMNS = [
  { key: 'fantasy_cost',
    label: 'PREÇO',
    title: 'Preço fantasy atual',
    right: true,
    render: (p) => (
      <span style={{ color: 'var(--color-xama-gold)', fontWeight: 700 }}>
        {Number(p.fantasy_cost || 0).toFixed(2)}
      </span>
    ),
    sortVal: (p) => Number(p.fantasy_cost || 0) },

  { key: 'pts_per_match',
    label: 'PTS/G',
    title: 'Pontos XAMA por jogo',
    right: true,
    render: (p) => fmt2(p.pts_per_match) },

  { key: 'total_xama_points',
    label: 'PTS XAMA',
    title: 'Pontos XAMA totais',
    right: true,
    render: (p, sparkKey) => (
      <span style={{ color: 'var(--color-xama-orange)', display: 'inline-flex', alignItems: 'center' }}>
        {fmt2(p.total_xama_points)}
        <Sparkline data={sparkKey === 'stage' ? p.pts_by_day : p.pts_by_stage} />
      </span>
    ),
    sortVal: (p) => p.total_xama_points || 0 },

  { key: 'total_kills',
    label: 'K TOTAL',
    title: 'Total de kills',
    right: true,
    render: (p) => fmtInt(p.total_kills) },

  { key: 'total_damage',
    label: 'DMG',
    title: 'Dano total',
    right: true,
    render: (p) => fmtInt(p.total_damage) },

  { key: 'total_assists',
    label: 'ASS',
    title: 'Total de assists',
    right: true,
    render: (p) => fmtInt(p.total_assists) },

  { key: 'survival_pts',
    label: 'PTS SOBREV',
    title: 'Pontos derivados de sobrevivência (late game bonus – early death)',
    right: true,
    render: (p) => {
      const sp = survivalPts(p)
      if (sp == null) return '—'
      return <span style={{ color: sp >= 0 ? 'var(--color-xama-text)' : '#f87171' }}>{fmt2(sp)}</span>
    },
    sortVal: (p) => survivalPts(p) ?? 0 },

  // Coluna de partidas — mantida mas mais compacta
  { key: 'matches_played',
    label: 'P',
    title: 'Partidas jogadas',
    right: true,
    render: (p) => p.matches_played ?? '—' },
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
  cursor: 'pointer',
  outline: 'none',
}

// ── Aggregação de stats de múltiplas stages ───────────────────────────────

function aggregateStats(allResults) {
  // allResults: [{stageId, stageIdx, data: PlayerStatOut[]}]
  const map = new Map()
  for (const { stageIdx, data } of allResults) {
    for (const p of data) {
      if (!map.has(p.person_id)) {
        map.set(p.person_id, {
          person_id: p.person_id,
          person_name: p.person_name,
          team_name: p.team_name,
          fantasy_cost: p.fantasy_cost,
          total_xama_points: 0,
          matches_played: 0,
          total_kills: 0,
          total_assists: 0,
          total_damage: 0,
          total_knocks: 0,
          total_wins: 0,
          pts_by_stage: [],
          pts_by_day: [],
        })
      }
      const a = map.get(p.person_id)
      a.total_xama_points += p.total_xama_points || 0
      a.matches_played    += p.matches_played || 0
      a.total_kills       += p.total_kills || 0
      a.total_assists     += p.total_assists || 0
      a.total_damage      += p.total_damage || 0
      a.total_knocks      += p.total_knocks || 0
      a.total_wins        += p.total_wins || 0
      if (p.fantasy_cost != null) a.fantasy_cost = p.fantasy_cost  // keep latest
      a.pts_by_stage[stageIdx] = (a.pts_by_stage[stageIdx] || 0) + (p.total_xama_points || 0)
    }
  }

  return Array.from(map.values()).map(a => ({
    ...a,
    total_xama_points: Math.round(a.total_xama_points * 100) / 100,
    total_damage: Math.round(a.total_damage * 10) / 10,
    pts_per_match: a.matches_played > 0 ? Math.round(a.total_xama_points / a.matches_played * 100) / 100 : 0,
    pts_by_stage: a.pts_by_stage.map((pts, i) => ({ stage: i + 1, pts: Math.round(pts * 100) / 100 })),
  }))
}

// ── Componente principal ───────────────────────────────────────────────────

export default function PlayerStatsPage({
  stageId: propStageId = null,
  shortName = '',
  siblingStages = [],
  championshipId = null,
}) {
  const [stageId, setStageId] = useState(propStageId ? Number(propStageId) : null)
  useEffect(() => { setStageId(propStageId ? Number(propStageId) : null) }, [propStageId])

  // Escopo: 'stage' | 'championship'
  const [scope, setScope] = useState('stage')

  // ── Hierarquia de filtros (escopo stage) ─────────────────────────────────
  const [stageDays, setStageDays]             = useState([])
  const [selectedDayId, setSelectedDayId]     = useState(null)
  const [matches, setMatches]                 = useState([])
  const [selectedMatchId, setSelectedMatchId] = useState(null)

  // ── Stats ─────────────────────────────────────────────────────────────────
  const [stats, setStats]           = useState([])
  const [champStats, setChampStats] = useState([])
  const [loading, setLoading]       = useState(false)
  const [champLoading, setChampLoading] = useState(false)
  const [error, setError]           = useState(null)

  // ── Filtros de tabela ─────────────────────────────────────────────────────
  const [search, setSearch]         = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  // Default: ordenar por PTS/G decrescente
  const [sortKey, setSortKey]       = useState('pts_per_match')
  const [sortDir, setSortDir]       = useState('desc')
  const [historyPlayer, setHistoryPlayer] = useState(null)

  // ── Reset ao trocar stage ─────────────────────────────────────────────────
  useEffect(() => {
    setStageDays([]); setSelectedDayId(null)
    setMatches([]); setSelectedMatchId(null)
    setStats([]); setError(null); setScope('stage')
    if (!stageId) return

    fetch(`${API_BASE}/stages/${stageId}/days`)
      .then((r) => r.ok ? r.json() : [])
      .then(setStageDays)
      .catch(() => {})
  }, [stageId])

  // ── Busca partidas ao selecionar um dia ───────────────────────────────────
  useEffect(() => {
    setMatches([]); setSelectedMatchId(null)
    if (!stageId || !selectedDayId) return
    fetch(`${API_BASE}/stages/${stageId}/days/${selectedDayId}/matches`)
      .then((r) => r.ok ? r.json() : [])
      .then(setMatches)
      .catch(() => {})
  }, [stageId, selectedDayId])

  // ── Busca stats da stage ──────────────────────────────────────────────────
  useEffect(() => {
    if (!stageId) return
    setLoading(true); setError(null); setStats([])

    let url = `${API_BASE}/stages/${stageId}/player-stats?limit=500`
    if (selectedMatchId) {
      url += `&match_id=${selectedMatchId}`
    } else if (selectedDayId) {
      url += `&stage_day_id=${selectedDayId}`
    }

    fetch(url)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((d) => { setStats(d); setLoading(false) })
      .catch((e) => { setError(e.message); setLoading(false) })
  }, [stageId, selectedDayId, selectedMatchId])

  // ── Busca stats do campeonato (stages locked) ─────────────────────────────
  const lockedSiblings = useMemo(() => {
    if (!siblingStages || siblingStages.length === 0) return []
    return siblingStages
      .filter(s => s.lineup_status === 'locked')
      .sort((a, b) => a.id - b.id)
  }, [siblingStages])

  const fetchChampStats = useCallback(async () => {
    if (lockedSiblings.length === 0) return
    setChampLoading(true)
    try {
      const results = await Promise.all(
        lockedSiblings.map((s, idx) =>
          fetch(`${API_BASE}/stages/${s.id}/player-stats?limit=500`)
            .then(r => r.ok ? r.json() : [])
            .then(data => ({ stageId: s.id, stageIdx: idx, data }))
            .catch(() => ({ stageId: s.id, stageIdx: idx, data: [] }))
        )
      )
      setChampStats(aggregateStats(results))
    } finally {
      setChampLoading(false)
    }
  }, [lockedSiblings])

  useEffect(() => {
    if (scope === 'championship' && champStats.length === 0 && !champLoading) {
      fetchChampStats()
    }
  }, [scope, champStats.length, champLoading, fetchChampStats])

  // ── Dados ativos (stage vs campeonato) ───────────────────────────────────
  const activeStats  = scope === 'championship' ? champStats : stats
  const activeLoading = scope === 'championship' ? champLoading : loading

  // ── Opções de time ────────────────────────────────────────────────────────
  const teamOptions = useMemo(() => {
    const tags = new Set(activeStats.map((p) => formatTeamTag(p.person_name, p.team_name)).filter(Boolean))
    return Array.from(tags).sort()
  }, [activeStats])

  // ── Filtro + sort ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => activeStats.filter((p) => {
    const nm = !search || formatPlayerName(p.person_name).toLowerCase().includes(search.toLowerCase())
    const tm = !teamFilter || formatTeamTag(p.person_name, p.team_name) === teamFilter
    return nm && tm
  }), [activeStats, search, teamFilter])

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
        av = survivalPts(a)
        bv = survivalPts(b)
      } else {
        const col = COLUMNS.find((c) => c.key === sortKey)
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
    if (sortKey === key) setSortDir((d) => d === 'desc' ? 'asc' : 'desc')
    else {
      setSortKey(key)
      setSortDir(key === 'team' || key === 'name' ? 'asc' : 'desc')
    }
  }

  // ── Labels de contexto ────────────────────────────────────────────────────
  const selectedDay   = stageDays.find((d) => d.id === selectedDayId)
  const selectedMatch = matches.find((m) => m.id === selectedMatchId)

  const filterLabel = useMemo(() => {
    if (scope === 'championship') {
      return `${lockedSiblings.length} stages · Campeonato`
    }
    if (selectedMatch) return `Partida ${selectedMatch.match_number} — ${new Date(selectedMatch.played_at || '').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`
    if (selectedDay) {
      const date = selectedDay.date ? new Date(selectedDay.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : ''
      return `Dia ${selectedDay.day_number}${date ? ` · ${date}` : ''}`
    }
    return stageDays.length > 1 ? 'Total' : (stageDays[0] ? `Dia ${stageDays[0].day_number}` : 'Total')
  }, [scope, selectedMatch, selectedDay, stageDays, lockedSiblings.length])

  const thStyle = (col) => ({
    padding: '10px 12px',
    fontSize: '11px', fontWeight: 700,
    letterSpacing: '0.08em', textTransform: 'uppercase',
    textAlign: col?.right ? 'right' : 'left',
    cursor: 'pointer', userSelect: 'none',
    whiteSpace: 'nowrap',
    color: sortKey === col?.key ? 'var(--color-xama-orange)' : 'var(--color-xama-muted)',
    transition: 'color 0.15s',
  })

  const hasChampionshipData = lockedSiblings.length > 0

  return (
    <div style={{ minHeight: '100vh', background: 'transparent' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="px-6 py-5 border-b" style={{ background: 'var(--color-xama-surface)', borderColor: 'var(--color-xama-border)' }}>
        <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
          <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span style={{ fontSize: '22px', lineHeight: 1 }}>📊</span>
                <h1 className="text-[28px] font-bold tracking-tight" style={{ color: 'var(--color-xama-text)', letterSpacing: '-0.01em' }}>
                  PLAYER STATS
                </h1>
                {(selectedDay || selectedMatch || scope === 'championship') && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold"
                    style={{ fontFamily: "'JetBrains Mono', monospace", background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', color: 'var(--color-xama-blue)' }}>
                    {filterLabel}
                  </span>
                )}
              </div>
              <p className="text-[12px] tracking-[0.1em] uppercase" style={{ color: 'var(--color-xama-muted)' }}>
                {stageId ? `Stage #${stageId}` : '—'}
              </p>
            </div>
          </div>

          {/* ── Filtros ───────────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-3">

            {/* Botões de escopo: Stage vs Campeonato */}
            {hasChampionshipData && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setScope('stage')}
                  style={{
                    ...selectStyle, padding: '4px 10px', fontWeight: 600,
                    background: scope === 'stage' ? 'rgba(249,115,22,0.12)' : '#0d0f14',
                    borderColor: scope === 'stage' ? 'rgba(249,115,22,0.5)' : 'var(--color-xama-border)',
                    color: scope === 'stage' ? 'var(--color-xama-orange)' : 'var(--color-xama-muted)',
                  }}>
                  Stage
                </button>
                <button
                  onClick={() => setScope('championship')}
                  style={{
                    ...selectStyle, padding: '4px 10px', fontWeight: 600,
                    background: scope === 'championship' ? 'rgba(249,115,22,0.12)' : '#0d0f14',
                    borderColor: scope === 'championship' ? 'rgba(249,115,22,0.5)' : 'var(--color-xama-border)',
                    color: scope === 'championship' ? 'var(--color-xama-orange)' : 'var(--color-xama-muted)',
                  }}>
                  Campeonato ({lockedSiblings.length} stages)
                </button>
              </div>
            )}

            {/* Chips de dia (apenas no escopo de stage) */}
            {scope === 'stage' && stageDays.length > 0 && (
              <div className="flex items-center gap-1">
                {stageDays.length > 1 && (
                  <button
                    onClick={() => { setSelectedDayId(null); setSelectedMatchId(null) }}
                    style={{
                      ...selectStyle, padding: '4px 10px', fontWeight: 600,
                      background: !selectedDayId ? 'rgba(240,192,64,0.12)' : '#0d0f14',
                      borderColor: !selectedDayId ? 'rgba(240,192,64,0.5)' : 'var(--color-xama-border)',
                      color: !selectedDayId ? '#f0c040' : 'var(--color-xama-muted)',
                    }}>
                    TOTAL
                  </button>
                )}
                {stageDays.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => { setSelectedDayId(d.id); setSelectedMatchId(null) }}
                    style={{
                      ...selectStyle, padding: '4px 10px', fontWeight: 600,
                      background: selectedDayId === d.id ? 'rgba(96,165,250,0.12)' : '#0d0f14',
                      borderColor: selectedDayId === d.id ? 'rgba(96,165,250,0.5)' : 'var(--color-xama-border)',
                      color: selectedDayId === d.id ? 'var(--color-xama-blue)' : 'var(--color-xama-muted)',
                    }}>
                    Dia {d.day_number}
                  </button>
                ))}
              </div>
            )}

            {/* Seletor de partida */}
            {scope === 'stage' && selectedDayId && matches.length > 0 && (
              <select
                value={selectedMatchId ?? ''}
                onChange={(e) => setSelectedMatchId(e.target.value ? Number(e.target.value) : null)}
                style={{ ...selectStyle, minWidth: '180px' }}>
                <option value="">Dia inteiro</option>
                {matches.map((m) => {
                  const map = m.map_name ? (MAP_DISPLAY[m.map_name] ?? { icon: '🗺️', name: m.map_name }) : null
                  const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo'
                  const time = m.played_at
                    ? new Date(m.played_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: userTz })
                    : `#${m.id}`
                  const label = map
                    ? `P${m.match_number} ${map.icon} ${map.name} — ${time}`
                    : `P${m.match_number} — ${time}`
                  return <option key={m.id} value={m.id}>{label}</option>
                })}
              </select>
            )}

            {/* Filtro de time */}
            <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} style={{ ...selectStyle, minWidth: '110px' }}>
              <option value="">Todos os times</option>
              {teamOptions.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>

            {/* Busca */}
            <input
              type="text" placeholder="Buscar jogador..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ ...selectStyle, width: '160px' }} />

            {/* Limpar */}
            {(selectedDayId || selectedMatchId || teamFilter || search) && (
              <button
                onClick={() => { setSelectedDayId(null); setSelectedMatchId(null); setTeamFilter(''); setSearch('') }}
                style={{ ...selectStyle, color: 'var(--color-xama-red)', borderColor: 'rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.05)' }}>
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

      {/* ── Conteúdo ───────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '24px 16px' }}>

        {activeLoading && <p className="text-center py-20 text-[14px]" style={{ color: 'var(--color-xama-muted)' }}>Carregando stats...</p>}
        {error        && <div className="msg-error max-w-lg mx-auto mt-8">Erro: {error}</div>}

        {!activeLoading && !error && !stageId && (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <span style={{ fontSize: '48px' }}>📊</span>
            <p className="text-[16px] font-semibold tracking-[0.06em] uppercase" style={{ color: 'var(--color-xama-muted)' }}>
              Selecione um torneio
            </p>
          </div>
        )}

        {!activeLoading && !error && stageId && sorted.length === 0 && (
          <p className="text-center py-20 text-[13px]" style={{ color: 'var(--color-xama-muted)' }}>
            {scope === 'championship' && lockedSiblings.length === 0
              ? 'Nenhuma stage encerrada neste campeonato ainda.'
              : 'Nenhum dado disponível para o período selecionado.'}
          </p>
        )}

        {!activeLoading && !error && sorted.length > 0 && (
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
                      <th key={col.key} onClick={() => handleSort(col.key)} title={col.title} style={thStyle(col)}>
                        {col.label}<SortIcon active={sortKey === col.key} dir={sortDir} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((p, idx) => {
                    const rankColors = ['#f0c040', '#b4bcc8', '#cd7f50']
                    const teamTag = formatTeamTag(p.person_name, p.team_name)
                    return (
                      <tr key={p.person_id}
                        style={{ borderBottom: '1px solid #13161f' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#161b27'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 700, color: idx < 3 ? rankColors[idx] : '#2a3046' }}>
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <TeamLogo teamName={teamTag} shortName={shortName} size={28} />
                            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--color-xama-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                              {teamTag}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span
                            onClick={() => setHistoryPlayer({
                              person_id: p.person_id,
                              person_name: formatPlayerName(p.person_name),
                              team_name: formatTeamTag(p.person_name, p.team_name),
                              before_date: selectedDay?.date
                                ? new Date(selectedDay.date).toISOString()
                                : selectedMatch?.played_at || null,
                            })}
                            style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-xama-text)', cursor: 'pointer', borderBottom: '1px dashed rgba(249,115,22,0.4)', paddingBottom: '1px' }}
                            title="Ver histórico de partidas"
                          >
                            {formatPlayerName(p.person_name)}
                          </span>
                        </td>
                        {COLUMNS.map((col) => {
                          const rendered = col.render(p, scope)
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
              <span className="text-[11px] font-bold tracking-[0.1em] uppercase" style={{ color: 'var(--color-xama-orange)' }}>
                🔥 XAMA Fantasy
              </span>
              <span className="text-[11px] tabular-nums" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-xama-muted)' }}>
                {sorted.length} / {activeStats.length} jogadores · {filterLabel}
              </span>
            </div>
          </div>
        )}
      </div>

      {historyPlayer && (
        <PlayerHistoryModal
          personId={historyPlayer.person_id}
          personName={historyPlayer.person_name}
          teamName={historyPlayer.team_name}
          shortName={shortName}
          beforeDate={historyPlayer.before_date}
          onClose={() => setHistoryPlayer(null)}
        />
      )}
    </div>
  )
}
