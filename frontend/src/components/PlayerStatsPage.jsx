// frontend/src/components/PlayerStatsPage.jsx
// XAMA Fantasy — Player Stats migrado para /stages/ (Fase 7)
// Hierarquia: Stage → Dia → Partida
// A tabela de jogadores é renderizada por PlayerStatsTable (fonte única de verdade).

import { useState, useEffect, useMemo } from 'react'
import { API_BASE_URL as API_BASE } from '../config'
import { track } from '../lib/analytics'
import PlayerStatsTable from './PlayerStatsTable'

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

const selectStyle = {
  background: '#0d0f14',
  border: '1px solid var(--xm-border)',
  borderRadius: '6px',
  color: 'var(--xm-text)',
  padding: '6px 10px',
  fontSize: '13px',
  cursor: 'pointer',
  outline: 'none',
}

// ── Aggregação de stats de múltiplas stages ───────────────────────────────────
function aggregateStats(allResults) {
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
          total_late_game_pts: 0,
          total_early_deaths: 0,
          stage_idxs: new Set(),
          pts_by_stage: [],
        })
      }
      const a = map.get(p.person_id)
      a.total_xama_points  += p.total_xama_points || 0
      a.matches_played     += p.matches_played || 0
      a.total_kills        += p.total_kills || 0
      a.total_assists      += p.total_assists || 0
      a.total_damage       += p.total_damage || 0
      a.total_knocks       += p.total_knocks || 0
      a.total_wins         += p.total_wins || 0
      a.total_late_game_pts += p.total_late_game_pts || 0
      a.total_early_deaths += p.total_early_deaths || 0
      if (p.fantasy_cost != null) a.fantasy_cost = p.fantasy_cost
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

// ── Componente principal ──────────────────────────────────────────────────────
export default function PlayerStatsPage({
  stageId: propStageId = null,
  shortName = '',
  siblingStages = [],
  championshipId = null,
}) {
  const [stageId, setStageId] = useState(propStageId ? Number(propStageId) : null)
  useEffect(() => { setStageId(propStageId ? Number(propStageId) : null) }, [propStageId])

  useEffect(() => {
    if (propStageId) track('player_stats_opened', { stage_id: Number(propStageId) })
  }, [propStageId])

  const allSiblings = useMemo(() => [...(siblingStages || [])].sort((a, b) => a.id - b.id), [siblingStages])
  const [selectedStageIds, setSelectedStageIds] = useState(() => propStageId ? [Number(propStageId)] : [])
  useEffect(() => { setSelectedStageIds(propStageId ? [Number(propStageId)] : []) }, [propStageId])

  const isSingleCurrentStage = selectedStageIds.length === 1 && selectedStageIds[0] === (stageId ?? -1)
  const isAllSelected = allSiblings.length > 0 && allSiblings.every(s => selectedStageIds.includes(s.id))

  const toggleStage = (sid) => {
    setSelectedStageIds(prev => {
      if (prev.includes(sid)) {
        if (prev.length === 1) return prev
        return prev.filter(s => s !== sid)
      }
      return [...prev, sid]
    })
  }
  const selectAllStages = () => setSelectedStageIds(allSiblings.map(s => s.id))

  const extractStageName = (fullName = '') => {
    const m = fullName.match(/[—–]\s*(.+)$/)
    return m ? m[1].trim().toUpperCase() : fullName.trim().toUpperCase()
  }

  // ── Hierarquia de filtros ─────────────────────────────────────────────────
  const [stageDays, setStageDays]             = useState([])
  const [selectedDayId, setSelectedDayId]     = useState(null)
  const [matches, setMatches]                 = useState([])
  const [selectedMatchId, setSelectedMatchId] = useState(null)

  // ── Stats ─────────────────────────────────────────────────────────────────
  const [stats, setStats]           = useState([])
  const [multiStats, setMultiStats] = useState([])
  const [loading, setLoading]       = useState(false)
  const [multiLoading, setMultiLoading] = useState(false)
  const [error, setError]           = useState(null)

  // ── Stats do dia anterior (para setas de posição) ─────────────────────────
  const [prevDayStats, setPrevDayStats] = useState([])

  useEffect(() => {
    setStageDays([]); setSelectedDayId(null)
    setMatches([]); setSelectedMatchId(null)
    setStats([]); setError(null)
    if (!stageId) return
    fetch(`${API_BASE}/stages/${stageId}/days`)
      .then(r => r.ok ? r.json() : [])
      .then(setStageDays)
      .catch(() => {})
  }, [stageId])

  useEffect(() => {
    setMatches([]); setSelectedMatchId(null)
    if (!stageId || !selectedDayId) return
    fetch(`${API_BASE}/stages/${stageId}/days/${selectedDayId}/matches`)
      .then(r => r.ok ? r.json() : [])
      .then(setMatches)
      .catch(() => {})
  }, [stageId, selectedDayId])

  // ── Fetch stats do dia anterior (para setas ↑/↓) ─────────────────────────
  useEffect(() => {
    setPrevDayStats([])
    if (!stageId || !selectedDayId || stageDays.length === 0) return
    const currentIdx = stageDays.findIndex(d => d.id === selectedDayId)
    if (currentIdx <= 0) return
    const prevDay = stageDays[currentIdx - 1]
    fetch(`${API_BASE}/stages/${stageId}/player-stats?limit=500&stage_day_id=${prevDay.id}`)
      .then(r => r.ok ? r.json() : [])
      .then(setPrevDayStats)
      .catch(() => {})
  }, [stageId, selectedDayId, stageDays])

  useEffect(() => {
    if (!stageId) return
    setLoading(true); setError(null); setStats([])
    let url = `${API_BASE}/stages/${stageId}/player-stats?limit=500`
    if (selectedMatchId)    url += `&match_id=${selectedMatchId}`
    else if (selectedDayId) url += `&stage_day_id=${selectedDayId}`
    fetch(url)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(d => { setStats(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [stageId, selectedDayId, selectedMatchId])

  useEffect(() => {
    if (isSingleCurrentStage || selectedStageIds.length === 0) return
    setMultiLoading(true); setMultiStats([])
    Promise.all(
      selectedStageIds.map((sid, idx) =>
        fetch(`${API_BASE}/stages/${sid}/player-stats?limit=500`)
          .then(r => r.ok ? r.json() : [])
          .then(data => ({ stageId: sid, stageIdx: idx, data }))
          .catch(() => ({ stageId: sid, stageIdx: idx, data: [] }))
      )
    ).then(results => { setMultiStats(aggregateStats(results)); setMultiLoading(false) })
     .catch(() => setMultiLoading(false))
  }, [selectedStageIds, isSingleCurrentStage])

  const activeStats   = isSingleCurrentStage ? stats : multiStats
  const activeLoading = isSingleCurrentStage ? loading : multiLoading

  // Mapa de rank anterior por pts_per_match (para setas de posição no Dia X vs Dia X-1)
  const prevRankMap = useMemo(() => {
    if (!prevDayStats.length || !selectedDayId) return null
    const sorted = [...prevDayStats].sort((a, b) => (b.pts_per_match || 0) - (a.pts_per_match || 0))
    return new Map(sorted.map((p, idx) => [p.person_id, idx + 1]))
  }, [prevDayStats, selectedDayId])

  const selectedDay   = stageDays.find(d => d.id === selectedDayId)
  const selectedMatch = matches.find(m => m.id === selectedMatchId)

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

  const beforeDate = selectedDay?.date
    ? new Date(selectedDay.date).toISOString()
    : selectedMatch?.played_at || null

  return (
    <div style={{ minHeight: '100vh', background: 'transparent' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="px-6 py-5 border-b" style={{ background: 'var(--xm-surface-1)', borderColor: 'var(--xm-border)' }}>
        <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
          <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span style={{ fontSize: '22px', lineHeight: 1 }}>📊</span>
                <h1 className="text-[28px] font-bold tracking-tight" style={{ color: 'var(--xm-text)', letterSpacing: '-0.01em' }}>
                  PLAYER STATS
                </h1>
                {(selectedDay || selectedMatch || !isSingleCurrentStage) && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold"
                    style={{ fontFamily: "'JetBrains Mono', monospace", background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', color: 'var(--xm-blue)' }}>
                    {filterLabel}
                  </span>
                )}
              </div>
              <p className="text-[12px] tracking-[0.1em] uppercase" style={{ color: 'var(--xm-muted)' }}>
                {stageId ? `Stage #${stageId}` : '—'}
              </p>
            </div>
          </div>

          {/* ── Filtros de dia/partida ────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-3">

            {allSiblings.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                <button
                  onClick={selectAllStages}
                  style={{
                    ...selectStyle,
                    padding: '4px 10px', fontWeight: 700, fontSize: '11px',
                    letterSpacing: '0.06em',
                    background: isAllSelected ? 'rgba(240,192,64,0.12)' : '#0d0f14',
                    borderColor: isAllSelected ? 'rgba(240,192,64,0.5)' : 'var(--xm-border)',
                    color: isAllSelected ? '#f0c040' : 'var(--xm-muted)',
                  }}>
                  TODOS
                </button>
                {allSiblings.map(s => {
                  const isSelected   = selectedStageIds.includes(s.id)
                  const isCurrentStg = s.id === stageId
                  return (
                    <button
                      key={s.id}
                      onClick={() => toggleStage(s.id)}
                      style={{
                        ...selectStyle,
                        position: 'relative',
                        padding: '5px 12px', fontWeight: 700, fontSize: '10px',
                        letterSpacing: '0.05em', lineHeight: '1.25',
                        whiteSpace: 'normal', textAlign: 'center',
                        maxWidth: '120px', minHeight: '34px',
                        background: isSelected ? 'rgba(249,115,22,0.10)' : '#0d0f14',
                        borderColor: isCurrentStg
                          ? 'rgba(20,184,166,0.6)'
                          : isSelected ? 'rgba(249,115,22,0.45)' : 'var(--xm-border)',
                        color: isSelected ? 'var(--xm-orange)' : 'var(--xm-muted)',
                        boxShadow: isCurrentStg ? 'inset 0 0 0 1px rgba(20,184,166,0.25)' : 'none',
                      }}>
                      {extractStageName(s.name)}
                      {isCurrentStg && (
                        <span style={{
                          position: 'absolute', top: '-4px', right: '-4px',
                          width: '7px', height: '7px', borderRadius: '50%',
                          background: '#14b8a6',
                          border: '1px solid #0d0f14',
                        }} />
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {isSingleCurrentStage && stageDays.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {stageDays.length > 1 && (
                    <button
                      onClick={() => { setSelectedDayId(null); setSelectedMatchId(null) }}
                      style={{
                        ...selectStyle, padding: '4px 10px', fontWeight: 700, fontSize: '10px', letterSpacing: '0.06em',
                        background: !selectedDayId ? 'rgba(240,192,64,0.12)' : '#0d0f14',
                        borderColor: !selectedDayId ? 'rgba(240,192,64,0.5)' : 'var(--xm-border)',
                        color: !selectedDayId ? '#f0c040' : 'var(--xm-muted)',
                      }}>
                      TOTAL
                    </button>
                  )}
                  {stageDays.map(d => {
                    const isActive = selectedDayId === d.id
                    return (
                      <button key={d.id}
                        onClick={() => {
                          if (isActive) { setSelectedDayId(null); setSelectedMatchId(null) }
                          else { setSelectedDayId(d.id); setSelectedMatchId(null) }
                        }}
                        style={{
                          ...selectStyle, padding: '4px 12px', fontWeight: 700, fontSize: '10px',
                          letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 4,
                          background: isActive ? 'rgba(96,165,250,0.12)' : '#0d0f14',
                          borderColor: isActive ? 'rgba(96,165,250,0.5)' : 'var(--xm-border)',
                          color: isActive ? 'var(--xm-blue)' : 'var(--xm-muted)',
                        }}>
                        {stageDays.length === 1 ? 'POR PARTIDAS' : `DIA ${d.day_number}`}
                        {isActive && <span style={{ fontSize: 8, opacity: 0.8 }}>▾</span>}
                      </button>
                    )
                  })}
                </div>

                {selectedDayId && matches.length > 0 && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap',
                    paddingLeft: 8, borderLeft: '2px solid rgba(96,165,250,0.25)',
                  }}>
                    <button
                      onClick={() => setSelectedMatchId(null)}
                      style={{
                        ...selectStyle, padding: '3px 8px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em',
                        background: !selectedMatchId ? 'rgba(96,165,250,0.10)' : '#0d0f14',
                        borderColor: !selectedMatchId ? 'rgba(96,165,250,0.4)' : 'var(--xm-border)',
                        color: !selectedMatchId ? 'var(--xm-blue)' : 'var(--xm-muted)',
                      }}>
                      TODAS
                    </button>
                    {matches.map(m => {
                      const mapInfo = m.map_name ? (MAP_DISPLAY[m.map_name] ?? { icon: '🗺️', name: m.map_name }) : null
                      const isChosen = selectedMatchId === m.id
                      return (
                        <button key={m.id}
                          onClick={() => setSelectedMatchId(isChosen ? null : m.id)}
                          style={{
                            ...selectStyle, padding: '3px 8px', fontSize: '10px', fontWeight: 700,
                            background: isChosen ? 'rgba(96,165,250,0.12)' : '#0d0f14',
                            borderColor: isChosen ? 'rgba(96,165,250,0.5)' : 'var(--xm-border)',
                            color: isChosen ? 'var(--xm-blue)' : 'var(--xm-muted)',
                          }}
                          title={mapInfo ? mapInfo.name : `Partida ${m.match_number}`}>
                          {mapInfo ? `${mapInfo.icon} P${m.match_number}` : `P${m.match_number}`}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Conteúdo ───────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '24px 16px' }}>

        {activeLoading && <p className="text-center py-20 text-[14px]" style={{ color: 'var(--xm-muted)' }}>Carregando stats...</p>}
        {error        && <div className="xm-msg xm-msg--err">Erro: {error}</div>}

        {!activeLoading && !error && !stageId && (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <span style={{ fontSize: '48px' }}>📊</span>
            <p className="text-[16px] font-semibold tracking-[0.06em] uppercase" style={{ color: 'var(--xm-muted)' }}>
              Selecione um torneio
            </p>
          </div>
        )}

        {!activeLoading && !error && stageId && activeStats.length === 0 && (
          <p className="text-center py-20 text-[13px]" style={{ color: 'var(--xm-muted)' }}>
            Nenhum dado disponível para o período selecionado.
          </p>
        )}

        {!activeLoading && !error && activeStats.length > 0 && (
          <PlayerStatsTable
            players={activeStats}
            shortName={shortName}
            showDaysPlayed={!isSingleCurrentStage}
            beforeDate={beforeDate}
            totalCount={activeStats.length}
            footerLabel={filterLabel}
            prevRankMap={isSingleCurrentStage && selectedDayId ? prevRankMap : null}
          />
        )}
      </div>
    </div>
  )
}
