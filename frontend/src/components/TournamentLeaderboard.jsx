// frontend/src/components/TournamentLeaderboard.jsx
// XAMA Fantasy — Leaderboard com filtro hierárquico por campeonato/fase/dia

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_BASE_URL } from '../config'
import { track } from '../lib/analytics'
import TeamLogo from './TeamLogo'
import { formatTeamTag } from '../utils/teamUtils'

const RANK_COLORS = { 1: '#f0c040', 2: '#b4bcc8', 3: '#cd7f50' }
const RANK_BG     = {
  1: 'rgba(240,192,64,0.04)',
  2: 'rgba(180,188,200,0.03)',
  3: 'rgba(176,120,80,0.03)',
}

const ownerLabel = (entry) => entry.username || `#${entry.user_id.slice(0, 8)}`

// ── Helpers de nomenclatura ────────────────────────────────────────────────

/** "Playoffs 1 - Dia 1" → "Playoffs 1" */
function extractPhase(name) {
  const m = name.match(/^(.+?)\s*[-–]\s*Dia\s*\d+\s*$/i)
  return m ? m[1].trim() : name
}

/** "Playoffs 1 - Dia 1" → "Dia 1" */
function extractDayLabel(name) {
  const m = name.match(/[-–]\s*(Dia\s*\d+)\s*$/i)
  return m ? m[1].trim() : name
}

/** "PAS1 PO1" → "PAS1" (primeiro token) */
function extractChampCode(shortName) {
  return (shortName || '').split(/\s+/)[0] || 'Campeonato'
}

// ── Agrupa stages por fase ─────────────────────────────────────────────────

function buildPhases(siblingStages) {
  const map = new Map() // phaseLabel → { label, stages[] }
  for (const stage of siblingStages) {
    const label = extractPhase(stage.name)
    if (!map.has(label)) map.set(label, { label, stages: [] })
    map.get(label).stages.push(stage)
  }
  return [...map.values()]
}

// ── Rótulo do botão fechado ────────────────────────────────────────────────

function filterLabel(selectedKeys, champCode, phases) {
  if (selectedKeys.has('__champ__')) return `${champCode} — TOTAL`

  const selected = [...selectedKeys]
  const count    = selected.length

  // Fase inteira selecionada?
  for (const phase of phases) {
    const pKeys = phase.stages.map(s => `stage_${s.id}`)
    if (pKeys.length > 0 && pKeys.every(k => selectedKeys.has(k)) && count === pKeys.length) {
      return `${phase.label} — todos`
    }
  }

  // Dia único
  if (count === 1) {
    const stageId = Number(selected[0].replace('stage_', ''))
    for (const phase of phases) {
      const stage = phase.stages.find(s => s.id === stageId)
      if (stage) return `${phase.label} — ${extractDayLabel(stage.name)}`
    }
  }

  return `${count} selecionado${count !== 1 ? 's' : ''}`
}

// ── Coleta stage_day_ids para o endpoint combinado ─────────────────────────

function collectStageDayIds(stageIds, siblingStages) {
  const ids = []
  for (const sid of stageIds) {
    const stage = siblingStages.find(s => s.id === sid)
    for (const d of (stage?.stage_days || [])) ids.push(d.id)
  }
  return ids
}

// ── Componente principal ───────────────────────────────────────────────────

export default function TournamentLeaderboard({
  token                 = '',
  stageId               = '',
  lineupStatus          = '',
  championshipId        = null,
  championshipShortName = '',
  siblingStages         = [],
  onMyRankFound         = null,
}) {
  const isOpen   = lineupStatus === 'open'
  const champCode = extractChampCode(championshipShortName)
  const phases    = buildPhases(siblingStages)

  // selectedKeys: Set<'__champ__' | 'stage_N'>
  const [selectedKeys, setSelectedKeys] = useState(new Set(['__champ__']))
  const [panelOpen,    setPanelOpen]    = useState(false)
  const panelRef = useRef(null)

  const [rankings,     setRankings]     = useState([])
  const [rankDeltaMap, setRankDeltaMap] = useState(new Map()) // user_id → delta
  const rankingsRef = useRef([]) // snapshot do fetch anterior para calcular deltas
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)
  const [myUserId,     setMyUserId]     = useState(null)
  const [myLineups,    setMyLineups]    = useState([])
  const [expandedUserId, setExpandedUserId] = useState(null)
  const [lineupCache,  setLineupCache]  = useState({})

  const [submissions,        setSubmissions]  = useState([])
  const [submissionsLoading, setSubLoading]   = useState(false)

  const [highlights,        setHighlights]   = useState(null)

  useEffect(() => {
    if (stageId) track('leaderboard_viewed', { stage_id: stageId })
  }, [stageId])

  // Modo Espectador — visível quando locked/live (lineup fechado para edição)
  const isLocked = lineupStatus === 'locked' || lineupStatus === 'live'
  const [viewUser, setViewUser] = useState(null)   // { userId, username }

  // Stages relevantes para o modal (baseado na seleção do leaderboard)
  const selectedStageIds = isLocked
    ? siblingStages.map(s => s.id)   // sempre mostra o campeonato completo no modal
    : []

  const myRowRef      = useRef(null)
  const hasScrolledRef = useRef(false)

  const showSubmissions = isOpen
    && selectedKeys.size === 1
    && selectedKeys.has(`stage_${stageId}`)

  // ── Setas de posição: calcula delta vs fetch anterior ─────────────────────
  useEffect(() => {
    if (rankings.length === 0) return
    const prevMap = rankingsRef.current
    if (prevMap.size > 0) {
      const deltas = new Map()
      rankings.forEach((e, idx) => {
        const newRank = e.rank ?? idx + 1
        const prevRank = prevMap.get(e.user_id)
        if (prevRank !== undefined && prevRank !== newRank) {
          deltas.set(e.user_id, prevRank - newRank) // positivo = subiu
        }
      })
      setRankDeltaMap(deltas)
    }
    rankingsRef.current = new Map(rankings.map((e, idx) => [e.user_id, e.rank ?? idx + 1]))
  }, [rankings])

  // ── Reset ao trocar de stage ────────────────────────────────────────────
  useEffect(() => {
    setSelectedKeys(new Set(['__champ__']))
    setRankings([])
    setRankDeltaMap(new Map())
    rankingsRef.current = new Map()
    setError(null)
    setSubmissions([])
    setMyLineups([])
    setExpandedUserId(null)
    setLineupCache({})
    hasScrolledRef.current = false
  }, [stageId])

  // ── Fechar painel ao clicar fora ────────────────────────────────────────
  useEffect(() => {
    if (!panelOpen) return
    const h = (e) => { if (panelRef.current && !panelRef.current.contains(e.target)) setPanelOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [panelOpen])

  // ── Meu user_id ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) { setMyUserId(null); return }
    fetch(`${API_BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        if (r.status === 401) { window.dispatchEvent(new Event('auth:session-expired')); return null }
        return r.ok ? r.json() : null
      })
      .then(d => { if (d?.id) setMyUserId(d.id) })
      .catch(() => {})
  }, [token])

  // ── Meu lineup quando locked ─────────────────────────────────────────────
  useEffect(() => {
    if (!isLocked || !myUserId || !stageId) { setMyLineups([]); return }
    fetch(`${API_BASE_URL}/lineups/stage/${stageId}/user/${myUserId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : [])
      .then(d => setMyLineups(Array.isArray(d) ? d : []))
      .catch(() => setMyLineups([]))
  }, [isLocked, myUserId, stageId, token])

  // ── Callback myRank + auto-scroll para linha "EU" ──────────────────────
  useEffect(() => {
    if (!myUserId || rankings.length === 0) return
    const myEntry = rankings.find(e => e.user_id === myUserId)
    if (!myEntry) return
    // Notificar TournamentHub do rank/pts do usuário
    if (onMyRankFound) {
      const pos = myEntry.rank ?? (rankings.indexOf(myEntry) + 1)
      onMyRankFound(pos, getPoints(myEntry))
    }
    // Scroll para a linha "EU" (apenas uma vez por conjunto de rankings)
    if (!hasScrolledRef.current && myRowRef.current) {
      hasScrolledRef.current = true
      myRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [rankings, myUserId]) // eslint-disable-line

  // ── Submissões ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !stageId) return
    setSubLoading(true)
    fetch(`${API_BASE_URL}/stages/${stageId}/days`)
      .then(r => r.ok ? r.json() : [])
      .then(days => {
        const activeDay = days.find(d => d.is_active) || days[0]
        if (!activeDay) { setSubLoading(false); return null }
        return fetch(`${API_BASE_URL}/stages/${stageId}/days/${activeDay.id}/submissions`)
          .then(r => r.ok ? r.json() : [])
          .then(setSubmissions)
      })
      .catch(() => setSubmissions([]))
      .finally(() => setSubLoading(false))
  }, [isOpen, stageId]) // eslint-disable-line

  // ── Highlights do dia ───────────────────────────────────────────────────
  useEffect(() => {
    let sid, sdid

    const getLastDayId = (stage) => {
      if (!stage?.stage_days?.length) return null
      // stage_days ordenados por day_number ASC — o último é o mais recente
      return stage.stage_days[stage.stage_days.length - 1].id
    }

    if (selectedKeys.size === 1 && !selectedKeys.has('__champ__')) {
      // Dia único selecionado
      sid = Number([...selectedKeys][0].replace('stage_', ''))
      const stage = siblingStages.find(s => s.id === sid)
      sdid = getLastDayId(stage)
      if (!sdid) { setHighlights(null); return }
    } else if (selectedKeys.has('__champ__') && stageId) {
      // Total: usa o stage atual (o que o usuário está visualizando)
      sid = Number(stageId)
      const stage = siblingStages.find(s => s.id === sid)
      sdid = getLastDayId(stage)
      if (!sdid) { setHighlights(null); return }
    } else {
      setHighlights(null); return
    }

    fetch(`${API_BASE_URL}/stages/${sid}/days/${sdid}/highlights`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setHighlights(d?.top_user || d?.most_captain || d?.best_player ? d : null))
      .catch(() => setHighlights(null))
  }, [selectedKeys, siblingStages]) // eslint-disable-line

  // ── Fechar modal com Esc ────────────────────────────────────────────────
  useEffect(() => {
    if (!viewUser) return
    const h = (e) => { if (e.key === 'Escape') setViewUser(null) }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [viewUser])

  // ── Fetch ao mudar seleção ──────────────────────────────────────────────
  useEffect(() => { fetchLeaderboard() }, [selectedKeys, championshipId]) // eslint-disable-line

  // ── Fetch leaderboard ───────────────────────────────────────────────────
  const fetchLeaderboard = () => {
    if (!championshipId && !stageId) return
    setLoading(true); setError(null)

    // 1. Total do campeonato
    if (selectedKeys.has('__champ__')) {
      if (!championshipId) { setLoading(false); return }
      fetch(`${API_BASE_URL}/championships/${championshipId}/leaderboard`)
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
        .then(d => { setRankings(d); setLoading(false) })
        .catch(e => { setError(e.message); setLoading(false) })
      return
    }

    const stageIds = [...selectedKeys].map(k => Number(k.replace('stage_', '')))

    // 2. Stage única → endpoint de stage
    if (stageIds.length === 1) {
      fetch(`${API_BASE_URL}/stages/${stageIds[0]}/leaderboard`)
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
        .then(d => { setRankings(d); setLoading(false) })
        .catch(e => { setError(e.message); setLoading(false) })
      return
    }

    // 3. Combinação → endpoint combinado com stage_day_ids
    const dayIds = collectStageDayIds(stageIds, siblingStages)
    if (dayIds.length === 0) { setRankings([]); setLoading(false); return }

    fetch(`${API_BASE_URL}/championships/${championshipId}/leaderboard/combined?stage_day_ids=${dayIds.join(',')}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(d => { setRankings(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }

  // ── Toggles ─────────────────────────────────────────────────────────────

  const selectChamp = () => setSelectedKeys(new Set(['__champ__']))

  const toggleStage = (stageId) => {
    setSelectedKeys(prev => {
      const next = new Set(prev)
      next.delete('__champ__')
      const key = `stage_${stageId}`
      if (next.has(key)) {
        next.delete(key)
        if (next.size === 0) return new Set(['__champ__'])
      } else {
        next.add(key)
      }
      return next
    })
  }

  const togglePhase = (phase) => {
    const pKeys = phase.stages.map(s => `stage_${s.id}`)
    const allSelected = pKeys.every(k => selectedKeys.has(k))
    setSelectedKeys(prev => {
      const next = new Set(prev)
      next.delete('__champ__')
      if (allSelected) {
        pKeys.forEach(k => next.delete(k))
      } else {
        pKeys.forEach(k => next.add(k))
      }
      if (next.size === 0) return new Set(['__champ__'])
      return next
    })
  }

  // ── Computed ─────────────────────────────────────────────────────────────
  const getPoints = (e) => e.total_points !== undefined ? e.total_points : (e.points ?? 0)

  const lastDayLineup = myLineups.length > 0
    ? myLineups.reduce((best, l) => (l.stage_day_id > best.stage_day_id ? l : best))
    : null

  const myRankEntry = myUserId ? rankings.find(e => e.user_id === myUserId) : null

  // ── Inline expansion ──────────────────────────────────────────────────────
  const toggleExpand = (userId) => {
    if (!isLocked) return
    if (expandedUserId === userId) { setExpandedUserId(null); return }
    setExpandedUserId(userId)
    if (lineupCache[userId]) return
    fetch(`${API_BASE_URL}/lineups/stage/${stageId}/user/${userId}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.ok ? r.json() : [])
      .catch(() => [])
      .then(data => setLineupCache(prev => ({ ...prev, [userId]: Array.isArray(data) ? data : [] })))
  }

  const compDayMap = buildDayMap(siblingStages)

  return (
    <>
    <div className="min-h-screen" style={{ background: 'transparent' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="px-6 py-5 border-b" style={{ background: 'var(--xm-surface-1)', borderColor: 'var(--xm-border)' }}>
        <div className="max-w-3xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-[28px] font-bold tracking-tight" style={{ color: 'var(--xm-text)', letterSpacing: '-0.01em' }}>
            LEADERBOARD
          </h1>
          <button
            className="xm-btn xm-btn--ghost xm-btn--sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
            onClick={fetchLeaderboard}
            disabled={loading}
            style={{ fontWeight: 600 }}>
            <span style={{ fontSize: '13px' }}>↻</span>
            {loading ? 'Carregando…' : 'Atualizar'}
          </button>
        </div>

        {/* ── Dropdown ────────────────────────────────────────────────────── */}
        <div className="max-w-3xl mx-auto mt-3" ref={panelRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setPanelOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: '#0d0f14',
              border: '1px solid var(--xm-border)',
              borderRadius: '8px',
              color: 'var(--xm-text)',
              padding: '7px 12px',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              minWidth: '240px', justifyContent: 'space-between',
            }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--xm-gold)' }}>
              {filterLabel(selectedKeys, champCode, phases)}
            </span>
            <span style={{ fontSize: '10px', color: 'var(--xm-muted)' }}>
              {panelOpen ? '▲' : '▼'}
            </span>
          </button>

          {panelOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 200,
              background: 'var(--xm-surface-1)',
              border: '1px solid var(--xm-border)',
              borderRadius: '10px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              minWidth: '280px', overflow: 'hidden',
            }}>
              {/* Cabeçalho do painel */}
              <div style={{
                padding: '8px 14px', borderBottom: '1px solid var(--xm-border)',
                fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em',
                color: 'var(--xm-muted)', textTransform: 'uppercase',
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                Visualização
              </div>

              <div style={{ maxHeight: '400px', overflowY: 'auto', padding: '6px 0' }}>

                {/* Opção: Total do campeonato */}
                <FilterRow
                  label={`${champCode} — TOTAL`}
                  checked={selectedKeys.has('__champ__')}
                  onChange={selectChamp}
                  gold
                />

                {phases.length > 0 && (
                  <div style={{ margin: '4px 0', borderTop: '1px solid var(--xm-border)' }} />
                )}

                {phases.map((phase, gi) => {
                  const pKeys      = phase.stages.map(s => `stage_${s.id}`)
                  const allChecked = pKeys.length > 0 && pKeys.every(k => selectedKeys.has(k))
                  const someChecked = pKeys.some(k => selectedKeys.has(k))

                  return (
                    <div key={gi}>
                      {/* Cabeçalho da fase — clicável, seleciona todos os dias */}
                      <PhaseHeader
                        label={phase.label}
                        allChecked={allChecked}
                        someChecked={someChecked && !allChecked}
                        onClick={() => togglePhase(phase)}
                      />

                      {/* Dias da fase */}
                      {phase.stages.map(stage => (
                        <FilterRow
                          key={stage.id}
                          label={extractDayLabel(stage.name)}
                          checked={selectedKeys.has(`stage_${stage.id}`)}
                          onChange={() => toggleStage(stage.id)}
                          indent
                        />
                      ))}

                      {gi < phases.length - 1 && (
                        <div style={{ margin: '4px 0', borderTop: '1px solid rgba(255,255,255,0.04)' }} />
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Rodapé */}
              <div style={{ padding: '8px 14px', borderTop: '1px solid var(--xm-border)', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setPanelOpen(false)}
                  style={{
                    background: 'rgba(240,192,64,0.12)',
                    border: '1px solid rgba(240,192,64,0.4)',
                    borderRadius: '6px', color: '#f0c040',
                    padding: '5px 14px', fontSize: '12px', fontWeight: 700,
                    cursor: 'pointer',
                  }}>
                  Ver resultados
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Meu Resultado (stage locked/live) ───────────────────────────────── */}
      {isLocked && lastDayLineup && (
        <div className="max-w-3xl mx-auto px-4 pt-4 pb-0">
          <div style={{
            borderRadius: 12,
            border: '1px solid rgba(20,184,166,0.35)',
            background: 'var(--xm-surface-1)',
            overflow: 'hidden',
          }}>
            <div style={{ height: 2, background: 'linear-gradient(90deg, #14b8a6 0%, rgba(20,184,166,0.3) 60%, transparent 100%)' }} />
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 16px',
              background: 'rgba(20,184,166,0.06)',
              borderBottom: '1px solid rgba(20,184,166,0.15)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
                  color: '#14b8a6', fontFamily: "'JetBrains Mono', monospace",
                }}>
                  MEU RESULTADO
                </span>
                {myRankEntry && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
                    color: '#f0c040',
                    background: 'rgba(240,192,64,0.12)', border: '1px solid rgba(240,192,64,0.35)',
                    borderRadius: 4, padding: '1px 7px',
                  }}>
                    #{myRankEntry.rank ?? '—'}
                  </span>
                )}
                {myRankEntry && (
                  <span style={{
                    fontSize: 15, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
                    color: '#f0c040',
                  }}>
                    {Number(getPoints(myRankEntry)).toFixed(2)} pts
                  </span>
                )}
              </div>
              <button
                onClick={() => myUserId && setViewUser({ userId: myUserId, username: 'Meu Lineup' })}
                style={{
                  background: 'rgba(20,184,166,0.10)', border: '1px solid rgba(20,184,166,0.35)',
                  borderRadius: 7, padding: '4px 12px', fontSize: 12, fontWeight: 600,
                  color: '#2dd4bf', cursor: 'pointer',
                }}>
                Ver detalhes
              </button>
            </div>
            {(() => {
              const allPlayers = lastDayLineup.players || []
              const titulares = allPlayers
                .filter(p => p.slot_type === 'titular')
                .sort((a, b) => {
                  if (a.is_captain) return -1
                  if (b.is_captain) return 1
                  return (b.points_earned ?? -Infinity) - (a.points_earned ?? -Infinity)
                })
              const reserve = allPlayers.find(p => p.slot_type === 'reserve')
              return (
                <div style={{
                  padding: '12px 16px',
                  display: 'grid',
                  gridTemplateColumns: `repeat(${titulares.length}, 1fr)${reserve ? ' auto' : ''}`,
                  gap: 8,
                  alignItems: 'stretch',
                }}>
                  {titulares.map(p => (
                    <div key={p.id} style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      gap: 5, padding: '10px 6px', borderRadius: 8, textAlign: 'center',
                      background: p.is_captain ? 'rgba(240,192,64,0.07)' : 'rgba(20,184,166,0.05)',
                      border: p.is_captain ? '1px solid rgba(240,192,64,0.4)' : '1px solid rgba(20,184,166,0.18)',
                    }}>
                      {p.is_captain && (
                        <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.06em', color: '#f0c040', fontFamily: "'JetBrains Mono', monospace" }}>
                          ⭐ CAP
                        </span>
                      )}
                      <TeamLogo teamName={formatTeamTag(p.person_name, p.team_name)} size={30} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--xm-text)', lineHeight: 1 }}>
                        {fmtName(p.person_name)}
                      </span>
                      <span style={{ fontSize: 17, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1, color: p.is_captain ? '#f0c040' : 'var(--xm-orange)' }}>
                        {p.points_earned != null ? Number(p.points_earned).toFixed(1) : '—'}
                      </span>
                    </div>
                  ))}
                  {reserve && (
                    <div style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      gap: 5, padding: '10px 10px', borderRadius: 8, textAlign: 'center',
                      background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.06)',
                      opacity: 0.55, minWidth: 68,
                    }}>
                      <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.06em', color: 'var(--xm-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                        RES
                      </span>
                      <TeamLogo teamName={formatTeamTag(reserve.person_name, reserve.team_name)} size={30} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--xm-muted)', lineHeight: 1 }}>
                        {fmtName(reserve.person_name)}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1, color: 'var(--xm-muted)' }}>
                        {reserve.points_earned != null ? Number(reserve.points_earned).toFixed(1) : '—'}
                      </span>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* ── Submissões (stage atual aberta) ─────────────────────────────────── */}
      {showSubmissions && (
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--xm-border)', background: 'var(--xm-surface-1)' }}>
            <div style={{ height: '2px', background: 'linear-gradient(90deg, var(--xm-orange) 0%, transparent 50%)' }} />
            <div className="px-4 py-3 text-[11px] font-bold tracking-[0.08em] uppercase flex items-center justify-between"
              style={{ background: 'rgba(249,115,22,0.06)', borderBottom: '1px solid rgba(249,115,22,0.15)', color: 'var(--xm-orange)', fontFamily: "'JetBrains Mono', monospace" }}>
              <span>⚡ LINEUP ENVIADO — dia ainda em andamento</span>
              <span style={{ color: 'var(--xm-muted)', fontWeight: 400 }}>
                {submissionsLoading ? '…' : `${submissions.length} manager${submissions.length !== 1 ? 's' : ''}`}
              </span>
            </div>
            {submissionsLoading && (
              <p className="text-center py-12 text-[13px]" style={{ color: 'var(--xm-muted)' }}>Carregando…</p>
            )}
            {!submissionsLoading && submissions.length === 0 && (
              <p className="text-center py-12 text-[13px]" style={{ color: 'var(--xm-muted)' }}>Nenhum lineup enviado ainda.</p>
            )}
            {!submissionsLoading && submissions.length > 0 && (
              <table className="w-full border-collapse">
                <thead>
                  <tr style={{ background: '#0a0c11', borderBottom: '1px solid var(--xm-border)' }}>
                    {['#', 'Manager', 'Enviado'].map((h, i) => (
                      <th key={i} className="px-4 py-3 text-[10px] font-bold tracking-[0.1em] uppercase"
                        style={{ color: 'var(--xm-muted)', textAlign: i === 2 ? 'right' : 'left', width: i === 0 ? '52px' : undefined }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {submissions.map(entry => {
                    const isMe = entry.user_id === myUserId
                    const time = new Date(entry.submitted_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                    return (
                      <tr key={entry.user_id}
                        style={{ borderBottom: '1px solid #13161f', background: isMe ? 'rgba(20,184,166,0.06)' : 'transparent', outline: isMe ? '1px solid rgba(20,184,166,0.18)' : 'none', outlineOffset: '-1px' }}
                        onMouseEnter={e => { if (!isMe) e.currentTarget.style.background = '#161b27' }}
                        onMouseLeave={e => { e.currentTarget.style.background = isMe ? 'rgba(20,184,166,0.06)' : 'transparent' }}>
                        <td className="px-4 py-[13px]">
                          <span className="text-[13px] font-bold tabular-nums" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--surface-4)' }}>
                            {String(entry.rank).padStart(2, '0')}
                          </span>
                        </td>
                        <td className="px-4 py-[13px]">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '13px', color: 'var(--xm-text)', fontFamily: "'JetBrains Mono', monospace" }}>
                              {ownerLabel(entry)}
                            </span>
                            {isMe && <span className="text-[10px] font-bold tracking-[0.06em] px-2 py-0.5 rounded" style={{ background: 'rgba(20,184,166,0.18)', border: '1px solid rgba(20,184,166,0.4)', color: '#2dd4bf' }}>EU</span>}
                          </div>
                        </td>
                        <td className="px-4 py-[13px] text-right">
                          <span style={{ fontSize: '12px', color: 'var(--xm-muted)', fontFamily: "'JetBrains Mono', monospace" }}>✓ {time}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
            <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--xm-border)', background: '#0a0c11' }}>
              <span className="text-[11px] font-bold tracking-[0.1em] uppercase" style={{ color: 'var(--xm-orange)' }}>⚡ XAMA Fantasy</span>
              <span className="text-[11px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--xm-muted)' }}>pontos disponíveis após o encerramento</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Destaques do dia ─────────────────────────────────────────────────── */}
      {!isOpen && !showSubmissions && highlights && (
        <div className="max-w-3xl mx-auto px-4 pt-4 pb-0">
          <div style={{
            borderRadius: 12, border: '1px solid var(--xm-border)',
            background: 'var(--xm-surface-1)', overflow: 'hidden',
          }}>
            <div style={{
              height: 2,
              background: 'linear-gradient(90deg, var(--xm-gold) 0%, var(--xm-orange) 60%, transparent 100%)',
            }} />
            <div style={{
              padding: '8px 16px',
              fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: 'var(--xm-gold)',
              borderBottom: '1px solid var(--xm-border)',
              fontFamily: "'JetBrains Mono', monospace",
              background: 'rgba(240,192,64,0.04)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span>Destaques do dia</span>
              {(() => {
                const sdid = highlights.stage_day_id
                for (const s of siblingStages) {
                  for (const d of (s.stage_days || [])) {
                    if (d.id === sdid) return (
                      <span style={{ fontWeight: 400, color: 'var(--xm-muted)', textTransform: 'none', letterSpacing: 0 }}>
                        {s.name}
                      </span>
                    )
                  }
                }
                return null
              })()}
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${[highlights.top_user, highlights.most_captain, highlights.best_player].filter(Boolean).length}, 1fr)`,
              gap: 0,
            }}>
              {highlights.top_user && (
                <HighlightCell
                  icon="🏆"
                  label="Melhor manager"
                  title={highlights.top_user.username || highlights.top_user.user_id.slice(0, 8)}
                  subtitle={`${highlights.top_user.points.toFixed(2)} pts`}
                  subtitleColor="var(--xm-gold)"
                  detail={highlights.top_user.players?.map(p => p.person_name?.split('_').pop() || p.person_name).join(' · ')}
                />
              )}
              {highlights.most_captain && (
                <HighlightCell
                  icon="⭐"
                  label="Capitão mais escolhido"
                  title={highlights.most_captain.person_name?.split('_').pop() || highlights.most_captain.person_name}
                  subtitle={`${highlights.most_captain.pct}% dos times`}
                  subtitleColor="var(--xm-orange)"
                  detail={highlights.most_captain.team_name}
                  separator
                />
              )}
              {highlights.best_player && (
                <HighlightCell
                  icon="🔥"
                  label="Melhor jogador"
                  title={highlights.best_player.person_name?.split('_').pop() || highlights.best_player.person_name}
                  subtitle={`${highlights.best_player.xama_points.toFixed(1)} pts`}
                  subtitleColor="var(--xm-orange)"
                  detail={highlights.best_player.team_name}
                  separator
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Leaderboard ──────────────────────────────────────────────────────── */}
      {!showSubmissions && (
        <div className="max-w-3xl mx-auto px-4 py-6">
          {loading && (
            <p className="text-center py-20 text-[13px]" style={{ color: 'var(--xm-muted)' }}>Carregando leaderboard…</p>
          )}
          {error && !loading && (
            <div className="xm-msg xm-msg--err">Erro ao carregar: {error}</div>
          )}
          {!loading && !error && rankings.length === 0 && (
            <p className="text-center py-20 text-[13px]" style={{ color: 'var(--xm-muted)' }}>Nenhum resultado ainda.</p>
          )}
          {!loading && !error && rankings.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--xm-border)', background: 'var(--xm-surface-1)' }}>
              <div style={{ height: '2px', background: 'linear-gradient(90deg, var(--xm-gold) 0%, transparent 50%)' }} />
              <table className="w-full border-collapse">
                <thead>
                  <tr style={{ background: '#0a0c11', borderBottom: '1px solid var(--xm-border)' }}>
                    {['#', 'Manager', 'Pontos'].map((h, i) => (
                      <th key={i} className="px-4 py-3 text-[10px] font-bold tracking-[0.1em] uppercase"
                        style={{ color: 'var(--xm-muted)', textAlign: i >= 2 ? 'right' : 'left', width: i === 0 ? '52px' : undefined }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rankings.map((entry, idx) => {
                    const pos        = entry.rank ?? (idx + 1)
                    const isTop3     = pos <= 3
                    const isMe       = entry.user_id === myUserId
                    const pts        = getPoints(entry)
                    const canClick   = isLocked && token
                    const isExpanded = expandedUserId === entry.user_id
                    return (
                      <>
                      <tr key={entry.user_id}
                        ref={isMe ? myRowRef : null}
                        onClick={canClick ? () => toggleExpand(entry.user_id) : undefined}
                        style={{
                          borderBottom: isExpanded ? 'none' : '1px solid #13161f',
                          background: isExpanded
                            ? (isMe ? 'rgba(20,184,166,0.10)' : 'rgba(255,255,255,0.04)')
                            : isMe ? 'rgba(20,184,166,0.06)' : isTop3 ? RANK_BG[pos] : 'transparent',
                          outline: isMe ? '1px solid rgba(20,184,166,0.18)' : 'none',
                          outlineOffset: '-1px',
                          cursor: canClick ? 'pointer' : 'default',
                        }}
                        onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = isMe ? 'rgba(20,184,166,0.10)' : (canClick ? '#1e2435' : '#161b27') }}
                        onMouseLeave={e => { e.currentTarget.style.background = isExpanded ? (isMe ? 'rgba(20,184,166,0.10)' : 'rgba(255,255,255,0.04)') : isMe ? 'rgba(20,184,166,0.06)' : isTop3 ? RANK_BG[pos] : 'transparent' }}>
                        <td className="px-4 py-[13px]">
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                            <span className="text-[13px] font-bold tabular-nums"
                              style={{ fontFamily: "'JetBrains Mono', monospace", color: isTop3 ? RANK_COLORS[pos] : 'var(--surface-4)' }}>
                              {String(pos).padStart(2, '0')}
                            </span>
                            {(() => {
                              const delta = rankDeltaMap.get(entry.user_id)
                              if (!delta) return null
                              if (delta > 0) return <span style={{ fontSize: '8px', fontWeight: 700, color: '#4ade80', lineHeight: 1 }}>▲{delta}</span>
                              return <span style={{ fontSize: '8px', fontWeight: 700, color: '#f87171', lineHeight: 1 }}>▼{Math.abs(delta)}</span>
                            })()}
                          </div>
                        </td>
                        <td className="px-4 py-[13px]">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className="text-[13px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: canClick ? 'var(--xm-text)' : 'var(--xm-muted)' }}>
                              {ownerLabel(entry)}
                            </span>
                            {isMe && (
                              <span className="text-[10px] font-bold tracking-[0.06em] px-2 py-0.5 rounded"
                                style={{ background: 'rgba(20,184,166,0.18)', border: '1px solid rgba(20,184,166,0.4)', color: '#2dd4bf' }}>
                                EU
                              </span>
                            )}
                            {canClick && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                                style={{
                                  background: isExpanded ? 'rgba(96,165,250,0.12)' : isMe ? 'rgba(20,184,166,0.10)' : 'rgba(255,255,255,0.04)',
                                  border: isExpanded ? '1px solid rgba(96,165,250,0.35)' : isMe ? '1px solid rgba(20,184,166,0.30)' : '1px solid rgba(255,255,255,0.08)',
                                  color: isExpanded ? 'var(--xm-blue)' : isMe ? '#2dd4bf' : 'var(--xm-muted)',
                                  fontFamily: "'JetBrains Mono', monospace",
                                }}>
                                {isExpanded ? '▲ fechar' : isMe ? '▼ meu time' : '▼ ver time'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-[13px] text-right">
                          <span className="text-[15px] font-bold tabular-nums"
                            style={{ fontFamily: "'JetBrains Mono', monospace", color: pts > 0 ? 'var(--xm-gold)' : '#374151' }}>
                            {Number(pts).toFixed(2)}
                          </span>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${entry.user_id}-exp`}>
                          <td colSpan={3} style={{ padding: 0, borderBottom: '1px solid var(--xm-border)' }}>
                            <InlineLineup
                              userId={entry.user_id}
                              isMe={isMe}
                              lineups={lineupCache[entry.user_id]}
                              dayMap={compDayMap}
                            />
                          </td>
                        </tr>
                      )}
                      </>
                    )
                  })}
                </tbody>
              </table>
              <div className="px-5 py-3 flex items-center justify-between"
                style={{ borderTop: '1px solid var(--xm-border)', background: '#0a0c11' }}>
                <span className="text-[11px] font-bold tracking-[0.1em] uppercase" style={{ color: 'var(--xm-gold)' }}>
                  🏆 XAMA Fantasy
                </span>
                <span className="text-[11px] tabular-nums"
                  style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--xm-muted)' }}>
                  {rankings.length} managers
                </span>
              </div>
            </div>
          )}
        </div>
      )}

    </div>

    {/* ── Modal Espectador: lineup do manager ───────────────────────────── */}
    {viewUser && (
      <ManagerLineupModal
        username={viewUser.username}
        userId={viewUser.userId}
        isMe={viewUser.userId === myUserId}
        myUserId={myUserId}
        primaryStageId={stageId}
        stageIds={selectedStageIds}
        token={token}
        siblingStages={siblingStages}
        onClose={() => setViewUser(null)}
      />
    )}
    </>
  )
}

// ── Sub-componentes ────────────────────────────────────────────────────────

function InlineLineup({ userId, isMe, lineups, dayMap }) {
  if (!lineups) {
    return (
      <div style={{ padding: '14px 20px', color: 'var(--xm-muted)', fontSize: 12, textAlign: 'center' }}>
        Carregando…
      </div>
    )
  }
  if (lineups.length === 0) {
    return (
      <div style={{ padding: '14px 20px', color: 'var(--xm-muted)', fontSize: 12, textAlign: 'center' }}>
        Sem lineup para este stage.
      </div>
    )
  }

  const sorted = [...lineups].sort((a, b) => a.stage_day_id - b.stage_day_id)

  return (
    <div style={{
      background: isMe ? 'rgba(20,184,166,0.04)' : 'rgba(0,0,0,0.18)',
      borderTop: isMe ? '1px solid rgba(20,184,166,0.15)' : '1px solid rgba(255,255,255,0.05)',
    }}>
      {sorted.map((lineup, li) => {
        const dayInfo  = dayMap?.get(lineup.stage_day_id)
        const dayLabel = dayInfo ? `${dayInfo.stageName} · Dia ${dayInfo.dayNumber}` : `Dia ${li + 1}`
        const titulares = (lineup.players || [])
          .filter(p => p.slot_type === 'titular')
          .sort((a, b) => {
            if (a.is_captain) return -1
            if (b.is_captain) return 1
            return (b.points_earned ?? -Infinity) - (a.points_earned ?? -Infinity)
          })
        const reserve = (lineup.players || []).find(p => p.slot_type === 'reserve')
        const isPending = lineup.total_points == null

        return (
          <div key={lineup.id} style={{
            borderBottom: li < sorted.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
            padding: '10px 16px',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 8,
            }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--xm-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                {dayLabel}
              </span>
              <span style={{ fontSize: 14, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: isPending ? 'var(--xm-muted)' : 'var(--xm-orange)' }}>
                {isPending ? '—' : Number(lineup.total_points).toFixed(2)} {!isPending && <span style={{ fontSize: 10, color: 'var(--xm-muted)' }}>pts</span>}
              </span>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${titulares.length}, 1fr)${reserve ? ' 60px' : ''}`,
              gap: 6,
            }}>
              {titulares.map(p => (
                <div key={p.id} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: 4, padding: '8px 4px', borderRadius: 7, textAlign: 'center',
                  background: p.is_captain ? 'rgba(240,192,64,0.07)' : 'rgba(255,255,255,0.03)',
                  border: p.is_captain ? '1px solid rgba(240,192,64,0.35)' : '1px solid rgba(255,255,255,0.06)',
                }}>
                  {p.is_captain && (
                    <span style={{ fontSize: 7, fontWeight: 800, letterSpacing: '0.06em', color: '#f0c040', fontFamily: "'JetBrains Mono', monospace" }}>
                      ⭐ CAP
                    </span>
                  )}
                  <TeamLogo teamName={formatTeamTag(p.person_name, p.team_name)} size={26} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--xm-text)', lineHeight: 1 }}>
                    {fmtName(p.person_name)}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1, color: p.is_captain ? '#f0c040' : p.points_earned > 0 ? 'var(--xm-orange)' : 'var(--xm-muted)' }}>
                    {p.points_earned != null ? Number(p.points_earned).toFixed(1) : '—'}
                  </span>
                </div>
              ))}
              {reserve && (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: 4, padding: '8px 4px', borderRadius: 7, textAlign: 'center',
                  background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.04)',
                  opacity: 0.5,
                }}>
                  <span style={{ fontSize: 7, fontWeight: 800, letterSpacing: '0.06em', color: 'var(--xm-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                    RES
                  </span>
                  <TeamLogo teamName={formatTeamTag(reserve.person_name, reserve.team_name)} size={26} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--xm-muted)', lineHeight: 1 }}>
                    {fmtName(reserve.person_name)}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1, color: 'var(--xm-muted)' }}>
                    {reserve.points_earned != null ? Number(reserve.points_earned).toFixed(1) : '—'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function FilterRow({ label, checked, onChange, gold = false, indent = false }) {
  const activeColor = gold ? '#f0c040' : 'var(--xm-blue)'
  const activeBg    = gold ? 'rgba(240,192,64,0.06)' : 'rgba(96,165,250,0.06)'
  return (
    <label
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: `6px ${indent ? '28px' : '14px'}`,
        cursor: 'pointer',
        background: checked ? activeBg : 'transparent',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => { if (!checked) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
      onMouseLeave={e => { e.currentTarget.style.background = checked ? activeBg : 'transparent' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        style={{ accentColor: activeColor, width: '14px', height: '14px', cursor: 'pointer', flexShrink: 0 }}
      />
      <span style={{
        fontSize: '13px',
        color: checked ? activeColor : 'var(--xm-text)',
        fontWeight: checked ? 600 : 400,
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        {label}
      </span>
    </label>
  )
}

function PhaseHeader({ label, allChecked, someChecked, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        width: '100%', padding: '6px 14px',
        background: allChecked ? 'rgba(96,165,250,0.06)' : 'transparent',
        border: 'none', cursor: 'pointer', textAlign: 'left',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => { if (!allChecked) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
      onMouseLeave={e => { e.currentTarget.style.background = allChecked ? 'rgba(96,165,250,0.06)' : 'transparent' }}>
      {/* Checkbox visual (não é input real — o clique é no botão inteiro) */}
      <span style={{
        width: '14px', height: '14px', flexShrink: 0,
        border: `2px solid ${allChecked ? 'var(--xm-blue)' : someChecked ? 'var(--xm-blue)' : 'var(--xm-border)'}`,
        borderRadius: '3px',
        background: allChecked ? 'var(--xm-blue)' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '9px', color: '#fff', fontWeight: 700,
      }}>
        {allChecked ? '✓' : someChecked ? '−' : ''}
      </span>
      <span style={{
        fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: allChecked || someChecked ? 'var(--xm-blue)' : 'var(--xm-muted)',
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        {label}
      </span>
    </button>
  )
}

// ── ManagerLineupModal ─────────────────────────────────────────────────────

function fmtName(name) {
  if (!name) return '—'
  const idx = name.indexOf('_')
  return idx !== -1 ? name.slice(idx + 1) : name
}

/** Monta lookup: stage_day_id → { dayNumber, stageName, stageId } */
function buildDayMap(siblingStages) {
  const map = new Map()
  for (const stage of siblingStages) {
    for (const day of (stage.stage_days || [])) {
      map.set(day.id, {
        dayNumber: day.day_number,
        stageName: stage.name ?? `Stage ${stage.id}`,
        stageId: stage.id,
      })
    }
  }
  return map
}

function ManagerLineupModal({ username, userId, isMe = false, myUserId = null, primaryStageId = null, stageIds = [], token, siblingStages = [], onClose }) {
  const navigate = useNavigate()
  const [stageLineups, setStageLineups] = useState([]) // [{stageId, stageName, lineups}]
  const [loading, setLoading] = useState(true)

  const dayMap = useMemo(() => buildDayMap(siblingStages), [siblingStages])

  useEffect(() => {
    if (!userId || !stageIds.length) return
    setLoading(true)
    setStageLineups([])
    Promise.all(
      stageIds.map(sid =>
        fetch(`${API_BASE_URL}/lineups/stage/${sid}/user/${userId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
          .then(r => r.ok ? r.json() : [])
          .catch(() => [])
          .then(lineups => ({
            stageId:   sid,
            stageName: siblingStages.find(s => s.id === sid)?.name ?? `Stage ${sid}`,
            lineups:   Array.isArray(lineups) ? lineups : [],
          }))
      )
    ).then(results => {
      setStageLineups(results.filter(r => r.lineups.length > 0).sort((a, b) => a.stageId - b.stageId))
      setLoading(false)
    })
  }, [userId, stageIds, token]) // eslint-disable-line

  const totalLineups = stageLineups.reduce((s, sg) => s + sg.lineups.length, 0)
  const multiStage   = stageLineups.length > 1

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px 16px',
        backdropFilter: 'blur(2px)',
      }}>
      <div style={{
        background: 'var(--xm-surface-1)',
        border: '1px solid var(--xm-border)',
        borderRadius: 14,
        width: '100%', maxWidth: 540,
        maxHeight: '85vh',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px',
          borderBottom: '1px solid var(--xm-border)',
          background: 'var(--surface-2)',
        }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--xm-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
              {isMe ? 'Meu lineup' : 'Time de'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--xm-text)', fontFamily: "'JetBrains Mono', monospace" }}>
                {username}
              </span>
              {isMe && (
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', padding: '2px 6px', borderRadius: 4, background: 'rgba(20,184,166,0.18)', border: '1px solid rgba(20,184,166,0.4)', color: '#2dd4bf' }}>
                  EU
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {!isMe && myUserId && primaryStageId && (
              <button
                onClick={() => {
                  onClose()
                  navigate(`/compare/${primaryStageId}/${myUserId}/${userId}`)
                }}
                style={{
                  background: 'rgba(250,204,21,0.1)', border: '1px solid rgba(250,204,21,0.3)',
                  borderRadius: 8, padding: '0 12px', height: 32, fontSize: 12, fontWeight: 600,
                  color: 'var(--xm-gold)', cursor: 'pointer', whiteSpace: 'nowrap',
                }}>
                vs mim
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8, width: 32, height: 32,
                color: 'var(--xm-muted)', fontSize: 16, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
              ×
            </button>
          </div>
        </div>

        {/* Conteúdo */}
        <div style={{ overflowY: 'auto', padding: '12px 16px', flex: 1 }}>
          {loading && (
            <p style={{ textAlign: 'center', padding: '48px 0', color: 'var(--xm-muted)', fontSize: 13 }}>
              Carregando…
            </p>
          )}
          {!loading && totalLineups === 0 && (
            <p style={{ textAlign: 'center', padding: '48px 0', color: 'var(--xm-muted)', fontSize: 13 }}>
              Nenhum lineup encontrado.
            </p>
          )}
          {!loading && stageLineups.map(({ stageId, stageName, lineups }) => (
            <div key={stageId}>
              {multiStage && (
                <div style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                  color: 'var(--xm-orange)', fontFamily: "'JetBrains Mono', monospace",
                  padding: '6px 2px 8px', marginTop: 4,
                  borderBottom: '1px solid rgba(249,115,22,0.15)',
                  marginBottom: 10,
                }}>
                  {stageName}
                </div>
              )}
              {lineups.map(lineup => (
                <ModalLineupCard key={lineup.id} lineup={lineup} dayMap={dayMap} multiStage={multiStage} />
              ))}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: '10px 18px',
          borderTop: '1px solid var(--xm-border)',
          background: 'rgba(0,0,0,0.2)',
          fontSize: 10, color: 'var(--xm-muted)', textAlign: 'center',
          fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>
          Clique fora ou pressione Esc para fechar
        </div>
      </div>
    </div>
  )
}

function ModalLineupCard({ lineup, dayMap, multiStage }) {
  const titulares = (lineup.players || [])
    .filter(p => p.slot_type === 'titular')
    .sort((a, b) => {
      if (a.is_captain) return -1
      if (b.is_captain) return 1
      return (b.points_earned ?? -Infinity) - (a.points_earned ?? -Infinity)
    })
  const reserva   = (lineup.players || []).find(p => p.slot_type === 'reserve')
  const isPending = lineup.total_points == null
  const dayInfo   = dayMap?.get(lineup.stage_day_id)
  const dayLabel  = dayInfo ? `Dia ${dayInfo.dayNumber}` : 'Dia'

  return (
    <div style={{
      background: 'var(--surface-1)', border: '1px solid var(--xm-border)',
      borderRadius: 10, overflow: 'hidden', marginBottom: 12,
    }}>
      {/* Cabeçalho do card */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '9px 14px',
        background: 'var(--surface-2)', borderBottom: '1px solid var(--xm-border)',
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--xm-muted)' }}>
          {dayLabel}
        </span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 700, color: isPending ? 'var(--xm-muted)' : 'var(--xm-orange)' }}>
          {isPending ? '—' : Number(lineup.total_points).toFixed(2)}
          {!isPending && <span style={{ fontSize: 11, color: 'var(--xm-muted)', marginLeft: 4 }}>pts</span>}
        </span>
      </div>

      {/* Jogadores */}
      <div style={{ padding: '6px 0' }}>
        {titulares.map(lp => <ModalPlayerRow key={lp.id} lp={lp} />)}
      </div>

      {/* Reserva */}
      {reserva && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.15)' }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--xm-muted)', padding: '6px 14px 0' }}>
            Reserva
          </div>
          <div style={{ padding: '4px 0 6px' }}>
            <ModalPlayerRow lp={reserva} isReserve />
          </div>
        </div>
      )}
    </div>
  )
}

function HighlightCell({ icon, label, title, subtitle, subtitleColor, detail, separator = false }) {
  return (
    <div style={{
      padding: '12px 16px',
      borderLeft: separator ? '1px solid var(--xm-border)' : 'none',
    }}>
      <div style={{
        fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
        color: 'var(--xm-muted)', marginBottom: 6,
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        {icon} {label}
      </div>
      <div style={{
        fontSize: 15, fontWeight: 700, color: 'var(--xm-text)',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {title}
      </div>
      <div style={{
        fontSize: 13, fontWeight: 700, color: subtitleColor,
        fontFamily: "'JetBrains Mono', monospace", marginTop: 2,
      }}>
        {subtitle}
      </div>
      {detail && (
        <div style={{
          fontSize: 10, color: 'var(--xm-muted)', marginTop: 3,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {detail}
        </div>
      )}
    </div>
  )
}

function ModalPlayerRow({ lp, isReserve = false }) {
  const name    = lp.person_name || '—'
  const tag     = formatTeamTag(lp.person_name, lp.team_name)
  const pts     = lp.points_earned != null ? Number(lp.points_earned) : null
  const captainColor = 'var(--xm-gold)'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 14px',
      borderBottom: '1px solid rgba(255,255,255,0.03)',
      opacity: isReserve ? 0.65 : 1,
      background: lp.is_captain ? 'rgba(240,192,64,0.04)' : 'transparent',
    }}>
      <TeamLogo teamName={tag} size={22} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{
            fontSize: 12, fontWeight: 600,
            color: lp.is_captain ? captainColor : isReserve ? 'var(--xm-muted)' : 'var(--xm-text)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160,
          }}>
            {fmtName(name)}
          </span>
          {lp.is_captain && (
            <span style={{
              fontSize: 8, fontWeight: 800, color: captainColor,
              background: 'rgba(240,192,64,0.14)', border: '1px solid rgba(240,192,64,0.35)',
              borderRadius: 3, padding: '1px 4px', letterSpacing: '0.06em', flexShrink: 0,
            }}>
              CAP
            </span>
          )}
          {isReserve && (
            <span style={{
              fontSize: 8, fontWeight: 700, color: 'var(--xm-muted)',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 3, padding: '1px 4px', letterSpacing: '0.05em', flexShrink: 0,
            }}>
              RES
            </span>
          )}
        </div>
        {tag && (
          <div style={{ fontSize: 10, color: 'var(--xm-muted)', marginTop: 1 }}>{tag}</div>
        )}
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 52 }}>
        {pts != null ? (
          <span style={{
            fontSize: 13, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
            color: lp.is_captain ? captainColor : isReserve ? 'var(--xm-muted)' : 'var(--xm-text)',
          }}>
            {pts.toFixed(2)}
          </span>
        ) : (
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.15)', fontFamily: "'JetBrains Mono', monospace" }}>—</span>
        )}
      </div>
    </div>
  )
}
