// frontend/src/components/PlayerStatsPage.jsx
// XAMA Fantasy — Player Stats migrado para /stages/ (Fase 7)
// Hierarquia: Stage → Dia → Partida
// Championship scope: agrega stats de todas as stages locked do campeonato

import { useState, useEffect, useMemo, useRef } from 'react'
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
  return Math.round((p.total_xama_points || 0) - combatPts)
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
    render: (p) => (
      <span style={{ color: 'var(--color-xama-orange)' }}>
        {fmt2(p.total_xama_points)}
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

  { key: 'total_wins',
    label: 'WINS',
    title: 'Vitórias',
    right: true,
    render: (p) => fmtInt(p.total_wins) },

  { key: 'days_played',
    label: 'DIAS',
    title: 'Dias (stages) em que o jogador aparece na seleção',
    right: true,
    multiOnly: true,  // renderizado apenas no modo multi-stage
    render: (p) => p.days_played ?? '—' },

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
          aliases: p.aliases || [],
          total_xama_points: 0,
          matches_played: 0,
          total_kills: 0,
          total_assists: 0,
          total_damage: 0,
          total_knocks: 0,
          total_wins: 0,
          stage_idxs: new Set(),
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
      a.stage_idxs.add(stageIdx)
      a.pts_by_stage[stageIdx] = (a.pts_by_stage[stageIdx] || 0) + (p.total_xama_points || 0)
    }
  }

  return Array.from(map.values()).map(a => ({
    ...a,
    total_xama_points: Math.round(a.total_xama_points * 100) / 100,
    total_damage: Math.round(a.total_damage * 10) / 10,
    pts_per_match: a.matches_played > 0 ? Math.round(a.total_xama_points / a.matches_played * 100) / 100 : 0,
    days_played: a.stage_idxs.size,
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

  // Stages selecionados para multi-view
  const allSiblings = useMemo(() => [...(siblingStages || [])].sort((a, b) => a.id - b.id), [siblingStages])
  const [selectedStageIds, setSelectedStageIds] = useState(() => propStageId ? [Number(propStageId)] : [])
  useEffect(() => { setSelectedStageIds(propStageId ? [Number(propStageId)] : []) }, [propStageId])

  // Single-current-stage: exibe filtros de dia/partida, usa fetch existente
  const isSingleCurrentStage = selectedStageIds.length === 1 && selectedStageIds[0] === (stageId ?? -1)
  const isAllSelected = allSiblings.length > 0 && allSiblings.every(s => selectedStageIds.includes(s.id))

  const toggleStage = (sid) => {
    setSelectedStageIds(prev => {
      if (prev.includes(sid)) {
        if (prev.length === 1) return prev  // não permite deselecionar todos
        return prev.filter(s => s !== sid)
      }
      return [...prev, sid]
    })
  }
  const selectAllStages = () => setSelectedStageIds(allSiblings.map(s => s.id))

  // Auto-inicializa com todas as stages ao carregar (default = Tudo)
  const didInitStages = useRef(false)
  useEffect(() => {
    if (allSiblings.length > 1 && !didInitStages.current) {
      setSelectedStageIds(allSiblings.map(s => s.id))
      didInitStages.current = true
    }
  }, [allSiblings])

  // Reseta init flag ao trocar de torneio
  useEffect(() => { didInitStages.current = false }, [propStageId])

  // Dropdown de stages
  const [stageDropdownOpen, setStageDropdownOpen] = useState(false)
  const stageDropdownRef = useRef(null)
  useEffect(() => {
    if (!stageDropdownOpen) return
    const handler = (e) => {
      if (stageDropdownRef.current && !stageDropdownRef.current.contains(e.target)) {
        setStageDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [stageDropdownOpen])

  const stageDropdownLabel = isAllSelected
    ? 'Tudo'
    : selectedStageIds.length === 0
      ? 'Nenhum'
      : selectedStageIds.length === 1
        ? (() => { const idx = allSiblings.findIndex(s => s.id === selectedStageIds[0]); return idx >= 0 ? `Dia ${idx + 1}` : '1 dia' })()
        : `${selectedStageIds.length} dias`

  // ── Hierarquia de filtros (escopo stage) ─────────────────────────────────
  const [stageDays, setStageDays]             = useState([])
  const [selectedDayId, setSelectedDayId]     = useState(null)
  const [matches, setMatches]                 = useState([])
  const [selectedMatchId, setSelectedMatchId] = useState(null)

  // ── Stats ─────────────────────────────────────────────────────────────────
  const [stats, setStats]         = useState([])
  const [multiStats, setMultiStats] = useState([])
  const [loading, setLoading]     = useState(false)
  const [multiLoading, setMultiLoading] = useState(false)
  const [error, setError]         = useState(null)

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
    setStats([]); setError(null)
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

  // ── Busca stats de múltiplas stages (multi-select) ───────────────────────
  useEffect(() => {
    if (isSingleCurrentStage || selectedStageIds.length === 0) return
    setMultiLoading(true)
    setMultiStats([])
    Promise.all(
      selectedStageIds.map((sid, idx) =>
        fetch(`${API_BASE}/stages/${sid}/player-stats?limit=500`)
          .then(r => r.ok ? r.json() : [])
          .then(data => ({ stageId: sid, stageIdx: idx, data }))
          .catch(() => ({ stageId: sid, stageIdx: idx, data: [] }))
      )
    ).then(results => {
      setMultiStats(aggregateStats(results))
      setMultiLoading(false)
    }).catch(() => setMultiLoading(false))
  }, [selectedStageIds, isSingleCurrentStage])

  // ── Dados ativos ──────────────────────────────────────────────────────────
  const activeStats   = isSingleCurrentStage ? stats : multiStats
  const activeLoading = isSingleCurrentStage ? loading : multiLoading

  // ── Opções de time ────────────────────────────────────────────────────────
  const teamOptions = useMemo(() => {
    const tags = new Set(activeStats.map((p) => formatTeamTag(p.person_name, p.team_name)).filter(Boolean))
    return Array.from(tags).sort()
  }, [activeStats])

  // ── Filtro + sort ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => activeStats.filter((p) => {
    const q = search.toLowerCase()
    const nm = !search
      || formatPlayerName(p.person_name).toLowerCase().includes(q)
      || (p.aliases || []).some(a => a.toLowerCase().includes(q))
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
    if (!isSingleCurrentStage) {
      const count = selectedStageIds.length
      return isAllSelected
        ? `${count} stages · Campeonato`
        : `${count} stage${count > 1 ? 's' : ''} selecionada${count > 1 ? 's' : ''}`
    }
    if (selectedMatch) return `Partida ${selectedMatch.match_number} — ${new Date(selectedMatch.played_at || '').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`
    if (selectedDay) {
      const date = selectedDay.date ? new Date(selectedDay.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : ''
      return `Dia ${selectedDay.day_number}${date ? ` · ${date}` : ''}`
    }
    return stageDays.length > 1 ? 'Total' : (stageDays[0] ? `Dia ${stageDays[0].day_number}` : 'Total')
  }, [isSingleCurrentStage, isAllSelected, selectedStageIds, selectedMatch, selectedDay, stageDays])

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
                {(selectedDay || selectedMatch || !isSingleCurrentStage) && (
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

            {/* Seletor de stages — dropdown com checkboxes */}
            {allSiblings.length > 1 && (
              <div ref={stageDropdownRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setStageDropdownOpen(o => !o)}
                  style={{
                    ...selectStyle, padding: '5px 12px', fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: '6px',
                    background: isAllSelected ? 'rgba(240,192,64,0.08)' : 'rgba(249,115,22,0.08)',
                    borderColor: isAllSelected ? 'rgba(240,192,64,0.4)' : 'rgba(249,115,22,0.4)',
                    color: isAllSelected ? '#f0c040' : 'var(--color-xama-orange)',
                  }}>
                  <span style={{ fontSize: '11px' }}>📅</span>
                  {stageDropdownLabel}
                  <span style={{ fontSize: '10px', opacity: 0.7, marginLeft: '2px' }}>{stageDropdownOpen ? '▲' : '▼'}</span>
                </button>

                {stageDropdownOpen && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 200,
                    background: '#0d0f14', border: '1px solid var(--color-xama-border)',
                    borderRadius: '8px', padding: '6px', minWidth: '150px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  }}>
                    {/* Tudo */}
                    <label style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '6px 10px', cursor: 'pointer', borderRadius: '5px',
                      background: isAllSelected ? 'rgba(240,192,64,0.08)' : 'transparent',
                      color: isAllSelected ? '#f0c040' : 'var(--color-xama-muted)',
                      fontSize: '13px', fontWeight: 600,
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = isAllSelected ? 'rgba(240,192,64,0.08)' : 'transparent'}>
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={selectAllStages}
                        style={{ accentColor: '#f0c040', width: '14px', height: '14px', cursor: 'pointer' }}
                      />
                      Tudo
                    </label>

                    <div style={{ borderTop: '1px solid var(--color-xama-border)', margin: '4px 0' }} />

                    {/* Cada stage como "Dia N" */}
                    {allSiblings.map((s, idx) => {
                      const isChecked = selectedStageIds.includes(s.id)
                      return (
                        <label key={s.id} style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          padding: '6px 10px', cursor: 'pointer', borderRadius: '5px',
                          background: isChecked ? 'rgba(249,115,22,0.08)' : 'transparent',
                          color: isChecked ? 'var(--color-xama-orange)' : 'var(--color-xama-muted)',
                          fontSize: '13px', fontWeight: 600,
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                        onMouseLeave={e => e.currentTarget.style.background = isChecked ? 'rgba(249,115,22,0.08)' : 'transparent'}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleStage(s.id)}
                            style={{ accentColor: 'var(--color-xama-orange)', width: '14px', height: '14px', cursor: 'pointer' }}
                          />
                          Dia {idx + 1}
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Chips de dia (apenas quando uma única stage está selecionada) */}
            {isSingleCurrentStage && stageDays.length > 0 && (
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
            {isSingleCurrentStage && selectedDayId && matches.length > 0 && (
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
                style={{ fontFamily: "'JetBrains Mono', monospace", background: 'var(--surface-3)', border: '1px solid var(--color-xama-border)', color: 'var(--color-xama-muted)' }}>
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
            Nenhum dado disponível para o período selecionado.
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
                    {COLUMNS.filter(col => !col.multiOnly || !isSingleCurrentStage).map((col) => (
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
                        style={{ borderBottom: '1px solid #13161f', background: idx % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#161b27'}
                        onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent'}>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 700, color: idx < 3 ? rankColors[idx] : 'var(--surface-4)' }}>
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
                        {COLUMNS.filter(col => !col.multiOnly || !isSingleCurrentStage).map((col) => {
                          const rendered = col.render(p)
                          const cellColor = col.color ? col.color(p) : 'var(--color-xama-text)'
                          return (
                            <td key={col.key} style={{ padding: '10px 12px', textAlign: col.right ? 'center' : 'left', fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', color: cellColor }}>
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
