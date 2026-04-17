// frontend/src/components/LineupBuilder.jsx
// XAMA Fantasy — Lineup Builder (Fase 6)
// Consome os novos endpoints: /stages/, /stages/{id}/roster, /stages/{id}/days, /lineups/

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { API_BASE_URL } from '../config'
import TeamLogo from './TeamLogo'
import PlayerHistoryModal from './PlayerHistoryModal'
import ScoringRulesModal from './ScoringRulesModal'
import { formatTeamTag, formatPlayerName } from '../utils/teamUtils'
// ── Countdown ──────────────────────────────────────────────────────────────
function computeCountdown(targetIso) {
  if (!targetIso) return null
  const diff = new Date(targetIso).getTime() - Date.now()
  if (diff <= 0) return null
  const totalMins = Math.floor(diff / 60_000)
  const hours = Math.floor(totalMins / 60)
  const mins = totalMins % 60
  const days = Math.floor(hours / 24)
  return { diff, days, hours: hours % 24, mins }
}

function useCountdown(targetIso) {
  const [remaining, setRemaining] = useState(() => computeCountdown(targetIso))
  useEffect(() => {
    setRemaining(computeCountdown(targetIso))
    const timer = setInterval(() => setRemaining(computeCountdown(targetIso)), 30_000)
    return () => clearInterval(timer)
  }, [targetIso])
  return remaining
}

const TUTORIAL_KEY = 'xama_lb_tutorial_seen'

function parseErrorMessage(err) {
  if (typeof err === 'string') return err
  if (err && typeof err === 'object' && 'message' in err) return String(err.message)
  return 'Erro inesperado'
}
async function httpJson(url, options) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  })
  const contentType = res.headers.get('content-type') || ''
  const isJson = contentType.includes('application/json')
  const data = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null)
  if (!res.ok) {
    if (res.status === 401) {
      window.dispatchEvent(new Event('auth:session-expired'))
    }
    const detail = data && typeof data === 'object' && 'detail' in data ? data.detail : null
    const message = detail || `HTTP ${res.status}`
    const error = new Error(typeof message === 'string' ? message : JSON.stringify(message))
    error.status = res.status
    error.data = data
    throw error
  }
  return data
}

const BUDGET_CAP = 100
const fmtCost = (v) => Number(v || 0).toFixed(2)

// ── Main component ─────────────────────────────────────────────────────────
export default function LineupBuilder({
  token = '',
  stageId,
  onPlayerInfoClick,
  canEdit = false,
  isPreview = false,
}) {
  // ── Dados da stage ──────────────────────────────────────────────────────
  const [stage,          setStage]          = useState(null)
  const [stageDays,      setStageDays]      = useState([])
  const [players,        setPlayers]        = useState([])
  const [playersLoading, setPlayersLoading] = useState(false)
  const [playersError,   setPlayersError]   = useState('')

  // ── Lineup do usuário ───────────────────────────────────────────────────
  const [myLineups,      setMyLineups]      = useState([])
  const [myLineupsLoaded, setMyLineupsLoaded] = useState(false)

  // ── Seleção ─────────────────────────────────────────────────────────────
  const [selectedPlayers, setSelectedPlayers] = useState([])
  const [reservePlayer,   setReservePlayer]   = useState(null)
  const [captainId,       setCaptainId]       = useState(null)

  // ── UI ──────────────────────────────────────────────────────────────────
  const [searchName,   setSearchName]   = useState('')
  const [teamFilter,   setTeamFilter]   = useState(null)   // null = todos os times
  const [sortKey,      setSortKey]      = useState('effective_cost')
  const [sortDir,      setSortDir]      = useState('desc')
  const [saveLoading,  setSaveLoading]  = useState(false)
  const [saveError,    setSaveError]    = useState('')
  const [saveSuccess,  setSaveSuccess]  = useState(null)
  const [historyPlayer, setHistoryPlayer] = useState(null)
  const [showScoringRules, setShowScoringRules] = useState(false)
  const [tutorialDismissed, setTutorialDismissed] = useState(
    () => localStorage.getItem(TUTORIAL_KEY) === '1'
  )

  // ── Ref para evitar re-popular o builder após edições do usuário ────────
  const loadedLineupIdRef = useRef(null)

  // ── Stage day ativo ─────────────────────────────────────────────────────
  const activeStageDayId = useMemo(() => {
    if (stageDays.length === 0) return null
    const active = stageDays.find(d => d.is_active)
    return active ? active.id : stageDays[stageDays.length - 1].id
  }, [stageDays])

  const currentDayLineup = useMemo(
    () => myLineups.find(l => l.stage_day_id === activeStageDayId) || null,
    [myLineups, activeStageDayId]
  )

  // isLocked: true quando preview ou stage não está aberta
  const isLocked = isPreview || !canEdit

  // ── Derived — budget ────────────────────────────────────────────────────
  const totalCost = useMemo(
    () => selectedPlayers.reduce((acc, p) => acc + (Number(p.effective_cost) || 0), 0),
    [selectedPlayers]
  )
  const minStarterCost = useMemo(() => {
    if (selectedPlayers.length === 0) return Infinity
    return Math.min(...selectedPlayers.map(p => Number(p.effective_cost) || 0))
  }, [selectedPlayers])

  const reserveCost     = reservePlayer ? Number(reservePlayer.effective_cost) || 0 : 0
  const reserveEligible = reservePlayer == null || reserveCost <= minStarterCost
  const isOverBudget    = totalCost > BUDGET_CAP

  // ── Derived — conflict detection ────────────────────────────────────────
  const conflictedTeams = useMemo(() => {
    const teams = new Set()
    selectedPlayers.forEach(p => teams.add(formatTeamTag(p.person_name, p.team_name)))
    if (reservePlayer) teams.add(formatTeamTag(reservePlayer.person_name, reservePlayer.team_name))
    return teams
  }, [selectedPlayers, reservePlayer])

  // ── Derived — lista de times únicos para pills ──────────────────────────
  const teamTags = useMemo(() => {
    const tags = new Set()
    players.forEach(p => tags.add(formatTeamTag(p.person_name, p.team_name)))
    return [...tags].filter(Boolean).sort()
  }, [players])

  // ── Derived — countdown para fechamento ────────────────────────────────
  const closeTarget = stage?.start_date || null
  const countdown = useCountdown(closeTarget)

  // ── Derived — tabela filtrada e ordenada ────────────────────────────────
  const filteredPlayers = useMemo(() => {
    let list = players
    if (teamFilter) {
      list = list.filter(p => formatTeamTag(p.person_name, p.team_name) === teamFilter)
    }
    const q = searchName.trim().toLowerCase()
    if (!q) return list
    return list.filter(p =>
      String(p.person_name || '').toLowerCase().includes(q) ||
      String(p.team_name || '').toLowerCase().includes(q)
    )
  }, [players, searchName, teamFilter])

  const sortedPlayers = useMemo(() => {
    return [...filteredPlayers].sort((a, b) => {
      let aVal, bVal
      if (sortKey === 'name')           { aVal = formatPlayerName(a.person_name, a.team_name); bVal = formatPlayerName(b.person_name, b.team_name) }
      else if (sortKey === 'team')      { aVal = formatTeamTag(a.person_name, a.team_name); bVal = formatTeamTag(b.person_name, b.team_name) }
      else                              { aVal = a[sortKey]; bVal = b[sortKey] }
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1
      if (typeof aVal === 'string') return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal
    })
  }, [filteredPlayers, sortKey, sortDir])

  // ── Effects — carregar dados da stage ───────────────────────────────────
  useEffect(() => {
    loadedLineupIdRef.current = null   // reset ao trocar de stage
    if (!stageId) return
    setPlayersLoading(true)
    setPlayersError('')
    setSelectedPlayers([])
    setReservePlayer(null)
    setCaptainId(null)
    setSaveError('')
    setSaveSuccess(null)

    Promise.all([
      httpJson(`${API_BASE_URL}/stages/${stageId}`),
      httpJson(`${API_BASE_URL}/stages/${stageId}/days`),
      httpJson(`${API_BASE_URL}/stages/${stageId}/roster`),
    ])
      .then(([stageData, daysData, rosterData]) => {
        setStage(stageData)
        setStageDays(Array.isArray(daysData) ? daysData : [])
        setPlayers(Array.isArray(rosterData) ? rosterData : [])
      })
      .catch(e => setPlayersError(parseErrorMessage(e)))
      .finally(() => setPlayersLoading(false))
  }, [stageId])

  // ── Effects — carregar lineups do usuário ───────────────────────────────
  useEffect(() => {
    if (!token || !stageId) { setMyLineups([]); return }
    httpJson(`${API_BASE_URL}/lineups/stage/${stageId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(data => setMyLineups(Array.isArray(data) ? data : []))
      .catch(() => setMyLineups([]))
      .finally(() => setMyLineupsLoaded(true))
  }, [token, stageId, saveSuccess])

  // ── Effects — keep-alive ────────────────────────────────────────────────
  useEffect(() => {
    const ping = () => fetch(`${API_BASE_URL}/health`).catch(() => {})
    const interval = setInterval(ping, 10 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  // ── Effects — popular builder com lineup existente ───────────────────────
  useEffect(() => {
    if (!currentDayLineup || players.length === 0) return
    if (loadedLineupIdRef.current === currentDayLineup.id) return

    loadedLineupIdRef.current = currentDayLineup.id

    const titulares = currentDayLineup.players
      .filter(lp => lp.slot_type === 'titular')
      .map(lp => players.find(p => p.id === lp.roster_id))
      .filter(Boolean)

    const reserveEntry = currentDayLineup.players.find(lp => lp.slot_type === 'reserve')
    const reserve = reserveEntry ? (players.find(p => p.id === reserveEntry.roster_id) || null) : null

    const captainEntry = currentDayLineup.players.find(lp => lp.is_captain)

    setSelectedPlayers(titulares)
    setReservePlayer(reserve)
    setCaptainId(captainEntry?.roster_id || null)
  }, [currentDayLineup, players])

  // ── Actions ─────────────────────────────────────────────────────────────
  function addPlayer(player) {
    setSaveError(''); setSaveSuccess(null)
    if (reservePlayer?.id === player.id)                  { setSaveError('Jogador já é reserva'); return }
    if (selectedPlayers.some(p => p.id === player.id))    { setSaveError('Jogador já no lineup'); return }
    if (selectedPlayers.length >= 4)                      { setSaveError('Lineup já tem 4 titulares'); return }
    const next = [...selectedPlayers, player]
    const nextCost = next.reduce((a, p) => a + (Number(p.effective_cost) || 0), 0)
    if (nextCost > BUDGET_CAP) { setSaveError('Adicionar este jogador estoura o budget'); return }
    setSelectedPlayers(next)
    if (next.length === 1) setCaptainId(player.id)
  }

  function setAsReserve(player) {
    setSaveError(''); setSaveSuccess(null)
    if (selectedPlayers.some(p => p.id === player.id)) { setSaveError('Reserva não pode ser titular'); return }
    setReservePlayer(player)
    const playerCost = Number(player.effective_cost) || 0
    if (selectedPlayers.length > 0 && playerCost > minStarterCost) {
      setSaveError('Reserva mais caro que o titular mais barato')
    }
  }

  function removeReserve() { setSaveError(''); setSaveSuccess(null); setReservePlayer(null) }

  function removePlayer(pid) {
    setSaveError(''); setSaveSuccess(null)
    const next = selectedPlayers.filter(p => p.id !== pid)
    setSelectedPlayers(next)
    if (captainId === pid) setCaptainId(next.length > 0 ? next[0].id : null)
  }

  function toggleCaptain(pid) {
    if (!selectedPlayers.some(p => p.id === pid)) return
    setCaptainId(pid)
  }

  async function saveLineup() {
    setSaveLoading(true); setSaveError(''); setSaveSuccess(null)
    try {
      if (!stageId)                      throw new Error('Stage não identificada')
      if (isLocked)                      throw new Error('Lineup fechado para esta stage')
      if (!activeStageDayId)             throw new Error('Nenhum dia ativo encontrado')
      if (selectedPlayers.length !== 4)  throw new Error('Selecione exatamente 4 titulares')
      if (!reservePlayer)                throw new Error('Selecione o reserva')
      if (!captainId)                    throw new Error('Selecione o capitão')
      if (!token.trim())                 throw new Error('Faça login primeiro')
      if (isOverBudget)                  throw new Error('Total excede o budget de 100')
      if (!reserveEligible)              throw new Error('Reserva mais caro que o titular mais barato')

      const data = await httpJson(`${API_BASE_URL}/lineups/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token.trim()}` },
        body: JSON.stringify({
          stage_day_id:       activeStageDayId,
          titular_roster_ids: selectedPlayers.map(p => p.id),
          reserve_roster_id:  reservePlayer.id,
          captain_roster_id:  captainId,
        }),
      })
      setSaveSuccess(data)
    } catch (e) {
      setSaveError(parseErrorMessage(e))
    } finally {
      setSaveLoading(false)
    }
  }

  const canSave = !isLocked && stageId && selectedPlayers.length === 4 &&
    reservePlayer && captainId && token.trim() && !isOverBudget && reserveEligible

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else {
      setSortKey(key)
      setSortDir(key === 'team' || key === 'name' ? 'asc' : 'desc')
    }
  }

  // Id do titular mais barato — usado para destacar quando há erro de reserva
  const cheapestStarterId = useMemo(() => {
    if (selectedPlayers.length === 0) return null
    return selectedPlayers.reduce((min, p) =>
      Number(p.effective_cost) < Number(min.effective_cost) ? p : min
    ).id
  }, [selectedPlayers])

  const isReserveError = saveError && saveError.toLowerCase().includes('reserva')

  const budgetUsedPct  = Math.min((totalCost / BUDGET_CAP) * 100, 100)
  const budgetBarColor = isOverBudget ? '#f87171' : totalCost / BUDGET_CAP > 0.85
    ? 'var(--color-xama-gold)' : 'var(--color-xama-orange)'

  const COLS = [
    { key: 'team',           label: 'Time',    right: false },
    { key: 'name',           label: 'Jogador', right: false },
    { key: 'effective_cost', label: 'Preço',   right: true,
      render: (p) => <span style={{ color: 'var(--color-xama-gold)', fontWeight: 700, fontSize: 14 }}>{fmtCost(p.effective_cost)}</span> },
    { key: 'pts_per_match',  label: 'PTS/G',   right: true,
      render: (p) => p.pts_per_match != null ? Number(p.pts_per_match).toFixed(2) : '—' },
    { key: 'total_kills',    label: 'K',       right: true,
      render: (p) => p.total_kills != null ? Math.round(p.total_kills) : '—' },
    { key: 'total_assists',  label: 'ASS',     right: true,
      render: (p) => p.total_assists != null ? Math.round(p.total_assists) : '—' },
    { key: 'total_damage',   label: 'DMG',     right: true,
      render: (p) => p.total_damage != null ? Math.round(p.total_damage) : '—' },
    { key: 'avg_survival_secs', label: 'SURV', right: true,
      render: (p) => p.avg_survival_secs != null ? Math.round(Number(p.avg_survival_secs) / 60) : '—' },
    { key: 'matches_played', label: 'P',       right: true,
      render: (p) => p.matches_played ?? '—' },
  ]

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="xlb-page">
      <div className="xama-container">

        {/* ── Cabeçalho sticky com lineup montado ──────────────────────── */}
        <div className="xlb-sticky-header">

          {/* Banner tutorial — primeiros passos (dispensável, salvo em localStorage) */}
          {!tutorialDismissed && !isLocked && (
            <div style={{
              background: 'rgba(96,165,250,0.06)',
              border: '1px solid rgba(96,165,250,0.2)',
              borderRadius: 8, padding: '12px 16px', marginBottom: 12,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-xama-blue)', marginBottom: 8 }}>
                  📋 Como montar seu lineup
                </div>
                <button
                  onClick={() => { setTutorialDismissed(true); localStorage.setItem(TUTORIAL_KEY, '1') }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--color-xama-muted)', fontSize: 16, lineHeight: 1,
                    padding: 0, flexShrink: 0,
                  }}
                  title="Dispensar">×</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {[
                  '4 titulares + 1 reserva dentro do budget de 100',
                  'A reserva deve custar ≤ ao titular mais barato',
                  'Clique ⭐ num slot para definir o Capitão — ele recebe ×1.30 nos pontos',
                  'Pontos: Kill +10 · Assist +1 · Knock +1 · Dano ×0.03',
                ].map(tip => (
                  <div key={tip} style={{ fontSize: 12, color: 'var(--color-xama-muted)', display: 'flex', gap: 6 }}>
                    <span style={{ color: 'var(--color-xama-blue)', flexShrink: 0 }}>›</span>
                    {tip}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Banner preview — aguardando confirmação */}
          {isPreview && (
            <div style={{
              background: 'rgba(249,115,22,0.08)',
              border: '1px solid rgba(249,115,22,0.3)',
              borderRadius: 8, padding: '12px 16px', marginBottom: 12,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 18 }}>⏳</span>
              <div>
                <div style={{ color: 'var(--color-xama-orange)', fontSize: 13, fontWeight: 700 }}>
                  Lineup desabilitado — Aguardando confirmação
                </div>
                <div style={{ color: 'var(--color-xama-muted)', fontSize: 12, marginTop: 2 }}>
                  O roster está sendo validado. A montagem será liberada em breve.
                </div>
              </div>
            </div>
          )}

          {/* Banner de stage fechada (closed/locked mas não preview) */}
          {stage && !stage.lineup_open && !isPreview && (
            <div style={{
              background: 'rgba(248,113,113,0.08)',
              border: '1px solid rgba(248,113,113,0.3)',
              borderRadius: 8, padding: '10px 16px', marginBottom: 12,
              color: 'var(--color-xama-red)', fontSize: 13, fontWeight: 600, textAlign: 'center',
            }}>
              🔒 Lineup fechado — submissões não são aceitas no momento
            </div>
          )}

          {/* Banner de lineup já submetido */}
          {currentDayLineup && (
            <div style={{
              background: 'rgba(74,222,128,0.08)',
              border: '1px solid rgba(74,222,128,0.25)',
              borderRadius: 8, padding: '10px 16px', marginBottom: 12,
              color: 'var(--color-xama-green)', fontSize: 13, fontWeight: 600, textAlign: 'center',
            }}>
              ✅ Lineup já submetido para hoje
            </div>
          )}

          {/* Budget bar */}
          <div style={{ padding: '12px 16px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: 'var(--color-xama-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Budget
                </span>
                {countdown && canEdit && (() => {
                  const { diff, days, hours, mins } = countdown
                  let label, color, border, bg
                  if (diff > 24 * 3_600_000) {
                    label = `Fecha em ${days}d ${hours}h`; color = 'var(--color-xama-muted)'
                    bg = 'rgba(148,163,184,0.06)'; border = 'rgba(148,163,184,0.15)'
                  } else if (diff > 3_600_000) {
                    label = `Fecha em ${hours}h ${mins}min`; color = 'var(--color-xama-orange)'
                    bg = 'rgba(249,115,22,0.08)'; border = 'rgba(249,115,22,0.25)'
                  } else {
                    label = `⚠ ${hours > 0 ? `${hours}h ` : ''}${mins}min`; color = '#f87171'
                    bg = 'rgba(248,113,113,0.08)'; border = 'rgba(248,113,113,0.25)'
                  }
                  return (
                    <span style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                      fontFamily: "'JetBrains Mono', monospace",
                      padding: '1px 6px', borderRadius: 4,
                      background: bg, border: `1px solid ${border}`, color,
                    }}>{label}</span>
                  )
                })()}
                {stage?.captain_multiplier && (
                  <span title={`Capitão recebe ×${Number(stage.captain_multiplier).toFixed(2)} nos pontos`} style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
                    color: 'var(--color-xama-gold)',
                    background: 'rgba(250,204,21,0.10)',
                    border: '1px solid rgba(250,204,21,0.25)',
                    borderRadius: 4, padding: '1px 5px',
                    fontFamily: "'JetBrains Mono', monospace",
                    cursor: 'default',
                  }}>
                    ⭐ CAP ×{Number(stage.captain_multiplier).toFixed(2)}
                  </span>
                )}
              </div>
              <span style={{
                fontSize: 13, fontWeight: 700,
                fontFamily: "'JetBrains Mono', monospace",
                color: isOverBudget ? 'var(--color-xama-red)' : 'var(--color-xama-text)',
              }}>
                {totalCost} / {BUDGET_CAP}
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'var(--surface-3)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 3,
                width: `${budgetUsedPct}%`,
                background: budgetBarColor,
                transition: 'width 0.2s ease, background 0.2s ease',
              }} />
            </div>
          </div>

          {/* Slots de titulares + reserva em linha */}
          <div className="xlb-hslots-row" style={{ padding: '12px 16px 0', display: 'flex', gap: 8, alignItems: 'stretch' }}>
            {Array.from({ length: 4 }).map((_, i) => {
              const p = selectedPlayers[i]
              const isCap = p && p.id === captainId
              const isCheapest = p && isReserveError && p.id === cheapestStarterId
              return p ? (
                <div key={p.id} className="xlb-hslot" style={{
                  flex: 1, background: 'var(--surface-2)',
                  border: `1px solid ${isCap ? 'var(--color-xama-gold)' : isCheapest ? 'rgba(249,115,22,0.7)' : 'var(--color-xama-border)'}`,
                  boxShadow: isCheapest ? '0 0 0 2px rgba(249,115,22,0.18)' : 'none',
                  borderRadius: 8, padding: '8px 10px', position: 'relative', minHeight: 120,
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <button
                      onClick={() => toggleCaptain(p.id)}
                      title={isCap ? 'Remover capitão' : 'Definir como capitão'}
                      style={{
                        background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 3, lineHeight: 1,
                      }}>
                      <span style={{ fontSize: 16, color: isCap ? 'var(--color-xama-gold)' : 'var(--color-xama-muted)', lineHeight: 1 }}>
                        {isCap ? '⭐' : '☆'}
                      </span>
                      {isCap && stage?.captain_multiplier && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, color: 'var(--color-xama-gold)',
                          fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.04em',
                        }}>
                          ×{Number(stage.captain_multiplier).toFixed(2)}
                        </span>
                      )}
                    </button>
                    <button
                      className="xlb-remove-btn"
                      onClick={() => removePlayer(p.id)}
                      title="Remover">×</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 4, minWidth: 0 }}>
                    <div style={{ marginBottom: 6 }}>
                      <TeamLogo teamName={formatTeamTag(p.person_name, p.team_name)} size={42} />
                    </div>
                    <div className="xlb-hslot-name" style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-xama-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, textAlign: 'center', width: '100%' }}>
                      {formatPlayerName(p.person_name, p.team_name)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: 'var(--color-xama-muted)' }}>
                      {formatTeamTag(p.person_name, p.team_name)}
                    </span>
                    <span style={{ fontSize: 13, fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-xama-gold)', fontWeight: 700 }}>
                      {fmtCost(p.effective_cost)}
                    </span>
                  </div>
                </div>
              ) : (
                <div key={i} className="xlb-hslot empty" style={{
                  flex: 1, background: 'var(--surface-1)',
                  border: '1px dashed var(--color-xama-border)',
                  borderRadius: 8, padding: '8px 10px',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 120,
                }}>
                  <span style={{ fontSize: 9, color: 'var(--color-xama-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>T{i + 1}</span>
                  <span style={{ fontSize: 10, color: 'var(--color-xama-muted)', fontStyle: 'italic' }}>— vazio —</span>
                </div>
              )
            })}

            {/* 5º card — reserva */}
            {reservePlayer ? (
              <div className="xlb-hslot" style={{
                flex: 1, background: 'var(--surface-2)',
                border: '1px solid rgba(96,165,250,0.3)',
                borderRadius: 8, padding: '8px 10px', position: 'relative', minHeight: 120,
                marginLeft: 12,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.10em',
                    color: 'var(--color-xama-blue)', textTransform: 'uppercase',
                  }}>RESERVA</span>
                  <button
                    className="xlb-remove-btn"
                    onClick={removeReserve}
                    title="Remover reserva">×</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 4, minWidth: 0 }}>
                  <div style={{ marginBottom: 6 }}>
                    <TeamLogo teamName={formatTeamTag(reservePlayer.person_name, reservePlayer.team_name)} size={42} />
                  </div>
                  <div className="xlb-hslot-name" style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-xama-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, textAlign: 'center', width: '100%' }}>
                    {formatPlayerName(reservePlayer.person_name, reservePlayer.team_name)}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: 'var(--color-xama-muted)' }}>
                    {formatTeamTag(reservePlayer.person_name, reservePlayer.team_name)}
                  </span>
                  <span style={{
                    fontSize: 13, fontFamily: "'JetBrains Mono', monospace",
                    color: reserveEligible ? 'var(--color-xama-gold)' : 'var(--color-xama-red)', fontWeight: 700,
                  }}>
                    {fmtCost(reservePlayer.effective_cost)}{!reserveEligible && ' ⚠'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="xlb-hslot empty" style={{
                flex: 1, background: 'rgba(59,130,246,0.08)',
                border: '1px dashed rgba(96,165,250,0.4)',
                borderRadius: 8, padding: '8px 10px',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 120,
                marginLeft: 12,
              }}>
                <span style={{ fontSize: 9, color: 'var(--color-xama-blue)', letterSpacing: '0.10em', textTransform: 'uppercase' }}>RESERVA</span>
                <span style={{ fontSize: 10, color: 'rgba(96,165,250,0.6)', fontStyle: 'italic' }}>— vazio —</span>
                {selectedPlayers.length > 0 && (
                  <span style={{
                    fontSize: 9, color: 'rgba(96,165,250,0.5)',
                    textAlign: 'center', lineHeight: 1.4,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    custo ≤ {fmtCost(minStarterCost)}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Feedback + botão salvar */}
          <div style={{ padding: '10px 16px 14px' }}>
            {saveError   && <div className="msg-error"   style={{ marginBottom: 8 }}>{saveError}</div>}
            {saveSuccess && <div className="msg-success" style={{ marginBottom: 8 }}>Lineup salvo com sucesso!</div>}

            {/* Botão desabilitado com mensagem específica para preview */}
            {isPreview ? (
              <button
                disabled
                style={{
                  width: '100%', padding: '11px 0',
                  fontSize: 15, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                  borderRadius: 8, border: '1px solid rgba(249,115,22,0.2)',
                  cursor: 'not-allowed',
                  background: 'rgba(249,115,22,0.05)',
                  color: 'var(--color-xama-muted)',
                }}>
                ⏳ Lineup desabilitado — Aguardando confirmação
              </button>
            ) : (
              <button
                onClick={saveLineup}
                disabled={!canSave || saveLoading}
                style={{
                  width: '100%', padding: '11px 0',
                  fontSize: 15, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                  borderRadius: 8, border: 'none', cursor: canSave && !saveLoading ? 'pointer' : 'not-allowed',
                  background: canSave && !saveLoading ? 'var(--color-xama-orange)' : 'var(--surface-3)',
                  color: canSave && !saveLoading ? 'var(--color-xama-text)' : 'var(--color-xama-muted)',
                  transition: 'background 0.15s',
                }}>
                {saveLoading ? 'Salvando...' : isLocked ? '🔒 Fechado' : 'Salvar Lineup'}
              </button>
            )}
          </div>
        </div>{/* fim sticky header */}

        {/* ── Pool de jogadores ──────────────────────────────────────── */}
        <div className="xlb-panel">

          {/* Pills de filtro por time */}
          {teamTags.length > 1 && (
            <div style={{
              padding: '8px 12px 0',
              display: 'flex', gap: 6, flexWrap: 'wrap',
            }}>
              <button
                onClick={() => setTeamFilter(null)}
                style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                  padding: '3px 10px', borderRadius: 20, border: 'none', cursor: 'pointer',
                  background: teamFilter === null ? 'var(--color-xama-orange)' : 'var(--surface-3)',
                  color: teamFilter === null ? '#fff' : 'var(--color-xama-muted)',
                  transition: 'background 0.12s, color 0.12s',
                }}>
                Todos
              </button>
              {teamTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setTeamFilter(prev => prev === tag ? null : tag)}
                  style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                    padding: '3px 10px', borderRadius: 20, border: 'none', cursor: 'pointer',
                    background: teamFilter === tag ? 'var(--color-xama-orange)' : 'var(--surface-3)',
                    color: teamFilter === tag ? '#fff' : 'var(--color-xama-muted)',
                    transition: 'background 0.12s, color 0.12s',
                  }}>
                  {tag}
                </button>
              ))}
            </div>
          )}

          {/* Barra de busca */}
          <div className="xlb-search-row">
            <input
              className="xlb-search-input"
              value={searchName}
              onChange={e => setSearchName(e.target.value)}
              placeholder="Buscar jogador..."
            />
            <span className="xlb-count">{filteredPlayers.length}/{players.length}</span>
            <button
              onClick={() => setShowScoringRules(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'rgba(249,115,22,0.08)',
                border: '1px solid rgba(249,115,22,0.25)',
                borderRadius: 6, padding: '5px 12px', cursor: 'pointer',
                color: 'var(--color-xama-orange)',
                fontSize: 13, fontWeight: 700, letterSpacing: '0.04em',
                whiteSpace: 'nowrap', flexShrink: 0,
              }}>
              📋 Cálculo
            </button>
          </div>

          {/* Banner resumo da fórmula */}
          <div
            onClick={() => setShowScoringRules(true)}
            style={{
              display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px 16px',
              padding: '8px 16px', cursor: 'pointer',
              background: 'rgba(249,115,22,0.04)',
              borderBottom: '1px solid rgba(249,115,22,0.12)',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(249,115,22,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(249,115,22,0.04)'}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-xama-orange)', letterSpacing: '0.08em', fontFamily: "'JetBrains Mono', monospace" }}>
              🔥 XAMA
            </span>
            {[
              'Kill +10', 'Assist +1', 'Knock +1', 'Dano ×0.03', 'Morte precoce −15', 'Late Game bônus', `Cap ×${Number(stage?.captain_multiplier ?? 1.30).toFixed(2)}`
            ].map(item => (
              <span key={item} style={{ fontSize: 11, color: 'var(--color-xama-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                {item}
              </span>
            ))}
            <span style={{ fontSize: 11, color: 'var(--color-xama-orange)', fontFamily: "'JetBrains Mono', monospace", marginLeft: 'auto' }}>
              ver detalhes →
            </span>
          </div>

          {/* Estados */}
          {playersLoading && <p className="xama-loading" style={{ padding: '24px 18px' }}>Carregando jogadores...</p>}
          {playersError   && <p className="xama-error"   style={{ padding: '16px 18px' }}>{playersError}</p>}

          {/* Tabela — sempre renderizada em preview, botões desabilitados */}
          {!playersLoading && !playersError && (
            <div style={{ overflowX: 'auto' }}>
              <table className="xlb-table">
                <thead>
                  <tr>
                    {COLS.map(({ key, label, right }) => (
                      <th key={key}
                        className={`${right ? 'right' : ''} ${sortKey === key ? 'active' : ''}`}
                        onClick={() => handleSort(key)}
                        style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
                        {label}
                        {sortKey === key
                          ? <span className="ml-0.5 text-[9px]">{sortDir === 'desc' ? '▼' : '▲'}</span>
                          : <span className="ml-0.5 opacity-25 text-[9px]">⇅</span>}
                      </th>
                    ))}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {sortedPlayers.map(p => {
                    const playerTag      = formatTeamTag(p.person_name, p.team_name)
                    const isSelected     = selectedPlayers.some(sp => sp.id === p.id) || reservePlayer?.id === p.id
                    const isConflicted   = !isSelected && conflictedTeams.has(playerTag) && conflictedTeams.size > 0
                    const isCap          = p.id === captainId
                    // Em preview: todos os botões de ação ficam desabilitados
                    const titularDisabled     = isLocked || isConflicted || (selectedPlayers.length >= 4 && !isSelected)
                    const btnDisabled         = isLocked || isConflicted
                    const isReserveHighlighted = !btnDisabled && selectedPlayers.length === 4 && !isSelected && !isConflicted && Number(p.effective_cost) <= minStarterCost
                    const isBudgetFade        = !isSelected && !isReserveHighlighted && Number(p.effective_cost) > (BUDGET_CAP - totalCost)
                    const rowClass = isConflicted ? 'xlb-row--dimmed' : isBudgetFade ? 'xlb-row--budget-fade' : ''
                    return (
                      <tr key={p.id} className={rowClass}>
                        <td>
                          <div className="flex items-center gap-1.5">
                            <TeamLogo teamName={playerTag} size={20} />
                            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--color-xama-muted)' }}>
                              {playerTag || '—'}
                            </span>
                          </div>
                        </td>
                        <td className="font-semibold whitespace-nowrap" style={{ color: 'var(--color-xama-text)', fontSize: 15 }}>
                          <span
                            onClick={() => setHistoryPlayer({
                              person_id: p.person_id,
                              person_name: formatPlayerName(p.person_name, p.team_name),
                              team_name: playerTag,
                              before_date: stageDays.find(d => d.id === activeStageDayId)?.lineup_close_at || null,
                            })}
                            style={{ cursor: 'pointer', borderBottom: '1px dashed rgba(249,115,22,0.4)', paddingBottom: '1px' }}
                            title="Ver histórico de partidas"
                          >
                            {formatPlayerName(p.person_name, p.team_name)}
                          </span>
                          {isCap && (
                            <span style={{ marginLeft: 4, fontSize: 9, color: 'var(--color-xama-gold)', fontWeight: 700 }}>⭐CAP</span>
                          )}
                          {p.newcomer_to_tier && (
                            <span style={{ marginLeft: 4, fontSize: 9, color: '#60a5fa', fontWeight: 700 }}>NEW</span>
                          )}
                        </td>
                        {COLS.slice(2).map(col => (
                          <td key={col.key}
                            className="right tabular-nums"
                            style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: 13,
                              color: 'var(--color-xama-text)',
                              whiteSpace: 'nowrap',
                            }}>
                            {col.render ? col.render(p) : (p[col.key] ?? '—')}
                          </td>
                        ))}
                        <td>
                          <div className="flex gap-1 justify-end">
                            {onPlayerInfoClick && (
                              <button
                                className="xlb-action-btn"
                                style={{ background: 'rgba(96,165,250,0.08)', borderColor: 'rgba(96,165,250,0.2)', color: 'var(--color-xama-blue)' }}
                                onClick={() => onPlayerInfoClick(p)}
                                title="Ver histórico de preços">
                                📈
                              </button>
                            )}
                            <button
                              className={`xlb-action-btn${isConflicted ? ' xlb-action-btn--conflict' : ''}`}
                              disabled={titularDisabled || isSelected}
                              title={selectedPlayers.length >= 4 && !isSelected ? '4 titulares já selecionados' : undefined}
                              onClick={() => !titularDisabled && !isSelected && addPlayer(p)}>
                              Titular
                            </button>
                            <button
                              className={`xlb-action-btn${isConflicted ? ' xlb-action-btn--conflict' : ''}`}
                              disabled={btnDisabled || isSelected}
                              style={isReserveHighlighted ? {
                                background: 'rgba(249,115,22,0.15)',
                                borderColor: 'rgba(249,115,22,0.5)',
                                color: 'var(--color-xama-orange)',
                              } : undefined}
                              onClick={() => !btnDisabled && !isSelected && setAsReserve(p)}>
                              Reserva
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>{/* fim xlb-panel */}

      </div>{/* fim xama-container */}

      {historyPlayer && (
        <PlayerHistoryModal
          personId={historyPlayer.person_id}
          personName={historyPlayer.person_name}
          teamName={historyPlayer.team_name}
          shortName={stage?.short_name || ''}
          beforeDate={historyPlayer.before_date}
          onClose={() => setHistoryPlayer(null)}
        />
      )}

      {showScoringRules && (
        <ScoringRulesModal
          captainMultiplier={stage?.captain_multiplier ?? 1.30}
          onClose={() => setShowScoringRules(false)}
        />
      )}
    </div>
  )
}
