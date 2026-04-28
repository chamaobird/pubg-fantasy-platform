// frontend/src/components/PlayerStatsPage.jsx
// XAMA Fantasy — Player Stats migrado para /stages/ (Fase 7)
// Hierarquia: Stage → Dia → Partida
// A tabela de jogadores é renderizada por PlayerStatsTable (fonte única de verdade).

import { useState, useEffect, useMemo, useRef } from 'react'
import { API_BASE_URL as API_BASE } from '../config'
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
  border: '1px solid var(--color-xama-border)',
  borderRadius: '6px',
  color: 'var(--color-xama-text)',
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
          stage_idxs: new Set(),
          pts_by_stage: [],
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

  const didInitStages = useRef(false)
  useEffect(() => {
    if (allSiblings.length > 1 && !didInitStages.current) {
      setSelectedStageIds(allSiblings.map(s => s.id))
      didInitStages.current = true
    }
  }, [allSiblings])
  useEffect(() => { didInitStages.current = false }, [propStageId])

  const [stageDropdownOpen, setStageDropdownOpen] = useState(false)
  const stageDropdownRef = useRef(null)
  useEffect(() => {
    if (!stageDropdownOpen) return
    const handler = (e) => {
      if (stageDropdownRef.current && !stageDropdownRef.current.contains(e.target)) setStageDropdownOpen(false)
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

          {/* ── Filtros de dia/partida ────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-3">

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
                    <label style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '6px 10px', cursor: 'pointer', borderRadius: '5px',
                      background: isAllSelected ? 'rgba(240,192,64,0.08)' : 'transparent',
                      color: isAllSelected ? '#f0c040' : 'var(--color-xama-muted)',
                      fontSize: '13px', fontWeight: 600, transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = isAllSelected ? 'rgba(240,192,64,0.08)' : 'transparent'}>
                      <input type="checkbox" checked={isAllSelected} onChange={selectAllStages}
                        style={{ accentColor: '#f0c040', width: '14px', height: '14px', cursor: 'pointer' }} />
                      Tudo
                    </label>
                    <div style={{ borderTop: '1px solid var(--color-xama-border)', margin: '4px 0' }} />
                    {allSiblings.map((s, idx) => {
                      const isChecked = selectedStageIds.includes(s.id)
                      return (
                        <label key={s.id} style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          padding: '6px 10px', cursor: 'pointer', borderRadius: '5px',
                          background: isChecked ? 'rgba(249,115,22,0.08)' : 'transparent',
                          color: isChecked ? 'var(--color-xama-orange)' : 'var(--color-xama-muted)',
                          fontSize: '13px', fontWeight: 600, transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                        onMouseLeave={e => e.currentTarget.style.background = isChecked ? 'rgba(249,115,22,0.08)' : 'transparent'}>
                          <input type="checkbox" checked={isChecked} onChange={() => toggleStage(s.id)}
                            style={{ accentColor: 'var(--color-xama-orange)', width: '14px', height: '14px', cursor: 'pointer' }} />
                          Dia {idx + 1}
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

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
                {stageDays.map(d => (
                  <button key={d.id}
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

            {isSingleCurrentStage && selectedDayId && matches.length > 0 && (
              <select
                value={selectedMatchId ?? ''}
                onChange={e => setSelectedMatchId(e.target.value ? Number(e.target.value) : null)}
                style={{ ...selectStyle, minWidth: '180px' }}>
                <option value="">Dia inteiro</option>
                {matches.map(m => {
                  const map = m.map_name ? (MAP_DISPLAY[m.map_name] ?? { icon: '🗺️', name: m.map_name }) : null
                  const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo'
                  const time = m.played_at
                    ? new Date(m.played_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: userTz })
                    : `#${m.id}`
                  return <option key={m.id} value={m.id}>{map ? `P${m.match_number} ${map.icon} ${map.name} — ${time}` : `P${m.match_number} — ${time}`}</option>
                })}
              </select>
            )}

            {(selectedDayId || selectedMatchId) && (
              <button
                onClick={() => { setSelectedDayId(null); setSelectedMatchId(null) }}
                style={{ ...selectStyle, color: 'var(--color-xama-red)', borderColor: 'rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.05)' }}>
                ✕ Limpar
              </button>
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

        {!activeLoading && !error && stageId && activeStats.length === 0 && (
          <p className="text-center py-20 text-[13px]" style={{ color: 'var(--color-xama-muted)' }}>
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
