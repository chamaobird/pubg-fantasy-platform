// frontend/src/components/LineupBuilder.jsx
// XAMA Fantasy — Lineup Builder (Fase 6)
// Consome os novos endpoints: /stages/, /stages/{id}/roster, /stages/{id}/days, /lineups/

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { API_BASE_URL } from '../config'
import { track } from '../lib/analytics'
import TeamLogo from './TeamLogo'
import PlayerHistoryModal from './PlayerHistoryModal'
import ScoringRulesModal from './ScoringRulesModal'
import { formatTeamTag, formatPlayerName } from '../utils/teamUtils'
// ── Countdown ──────────────────────────────────────────────────────────────
function computeCountdown(targetIso) {
  if (!targetIso) return null
  const diff = new Date(targetIso).getTime() - Date.now()
  if (diff <= 0) return null
  const totalSecs = Math.floor(diff / 1_000)
  const days  = Math.floor(totalSecs / 86_400)
  const hours = Math.floor((totalSecs % 86_400) / 3_600)
  const mins  = Math.floor((totalSecs % 3_600) / 60)
  const secs  = totalSecs % 60
  return { diff, days, hours, mins, secs }
}

function useCountdown(targetIso) {
  const [remaining, setRemaining] = useState(() => computeCountdown(targetIso))
  useEffect(() => {
    setRemaining(computeCountdown(targetIso))
    // Tick a cada segundo quando <1h, a cada 10s até 24h, a cada 30s acima
    const interval = () => {
      const r = computeCountdown(targetIso)
      setRemaining(r)
      return r
    }
    const r = interval()
    const tickMs = r && r.diff < 3_600_000 ? 1_000 : r && r.diff < 86_400_000 ? 10_000 : 30_000
    const timer = setInterval(interval, tickMs)
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
  const [priorStats,     setPriorStats]     = useState({})  // person_id → PriorStatsOut
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

  // ── Analytics: lineup_started / lineup_abandoned ─────────────────────────
  const _savedRef = useRef(false)
  useEffect(() => {
    if (!canEdit || !stageId) return
    _savedRef.current = false
    track('lineup_started', { stage_id: stageId })
    return () => {
      if (!_savedRef.current) track('lineup_abandoned', { stage_id: stageId })
    }
  }, [canEdit, stageId])

  // ── Stage day ativo ─────────────────────────────────────────────────────
  const activeStageDayId = useMemo(() => {
    if (stageDays.length === 0) return null
    // Para stages com independent_lineups, seleciona o primeiro day cujo
    // lineup_close_at ainda não passou — garante que o usuário edita o dia correto.
    if (stage?.independent_lineups) {
      const now = new Date()
      const upcoming = stageDays.find(d => d.lineup_close_at && new Date(d.lineup_close_at) > now)
      if (upcoming) return upcoming.id
      return stageDays[stageDays.length - 1].id
    }
    const active = stageDays.find(d => d.is_active)
    return active ? active.id : stageDays[stageDays.length - 1].id
  }, [stageDays, stage])

  const currentDayLineup = useMemo(
    () => myLineups.find(l => l.stage_day_id === activeStageDayId) || null,
    [myLineups, activeStageDayId]
  )

  // isLocked: true apenas quando lineup não está aberta (canEdit=false)
  // preview + open = montagem permitida; preview + closed = bloqueado
  const isLocked = !canEdit

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

  // ── Derived — sugestão de capitão ──────────────────────────────────────
  const suggestedCaptainId = useMemo(() => {
    if (selectedPlayers.length === 0 || isLocked) return null
    let bestId = null, bestPpm = -1
    for (const p of selectedPlayers) {
      const ppm = priorStats[p.person_id]?.pts_per_match ?? -1
      if (ppm > bestPpm) { bestPpm = ppm; bestId = p.id }
    }
    return bestId
  }, [selectedPlayers, priorStats, isLocked])

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
  const closeTarget = stage?.lineup_close_at || stage?.start_date || null
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
      String(p.team_name || '').toLowerCase().includes(q) ||
      (p.aliases || []).some(a => a.toLowerCase().includes(q))
    )
  }, [players, searchName, teamFilter])

  const sortedPlayers = useMemo(() => {
    const PRIOR_KEYS = new Set(['pts_per_match', 'kills_per_match', 'damage_per_match', 'assists_per_match', 'total_wins', 'late_game_pts_per_match'])

    const getVal = (p, key) => {
      if (key === 'name') return formatPlayerName(p.person_name, p.team_name)
      if (key === 'team') return formatTeamTag(p.person_name, p.team_name)
      if (PRIOR_KEYS.has(key)) { const s = priorStats[p.person_id]; return s ? s[key] : null }
      return p[key]
    }

    const cmp = (a, b, key, dir) => {
      const aVal = getVal(a, key)
      const bVal = getVal(b, key)
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1
      if (typeof aVal === 'string') return dir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      return dir === 'asc' ? aVal - bVal : bVal - aVal
    }

    return [...filteredPlayers].sort((a, b) => {
      // Ordenação primária pelo usuário
      let r = cmp(a, b, sortKey, sortDir)
      if (r !== 0) return r
      // Cascade de tiebreakers: preço desc → PTS/G desc → time asc
      if (sortKey !== 'effective_cost') { r = cmp(a, b, 'effective_cost', 'desc'); if (r !== 0) return r }
      if (sortKey !== 'pts_per_match')  { r = cmp(a, b, 'pts_per_match',  'desc'); if (r !== 0) return r }
      if (sortKey !== 'team')           { r = cmp(a, b, 'team',           'asc');  if (r !== 0) return r }
      return 0
    })
  }, [filteredPlayers, sortKey, sortDir, priorStats])

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
      httpJson(`${API_BASE_URL}/stages/${stageId}/prior-stats`).catch(() => []),
    ])
      .then(([stageData, daysData, rosterData, priorData]) => {
        setStage(stageData)
        setStageDays(Array.isArray(daysData) ? daysData : [])
        setPlayers(Array.isArray(rosterData) ? rosterData : [])
        const statsMap = {}
        if (Array.isArray(priorData)) {
          priorData.forEach(s => { statsMap[s.person_id] = s })
        }
        setPriorStats(statsMap)
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

  // ── Effects — polling lineup_close_at (para capturar extensões do admin) ─
  useEffect(() => {
    if (!stageId || !canEdit) return
    const poll = () => {
      httpJson(`${API_BASE_URL}/stages/${stageId}`)
        .then(data => setStage(prev => {
          // Só atualiza se lineup_close_at mudou para não re-renderizar desnecessariamente
          if (prev && data.lineup_close_at === prev.lineup_close_at) return prev
          return data
        }))
        .catch(() => {})
    }
    const timer = setInterval(poll, 30_000)
    return () => clearInterval(timer)
  }, [stageId, canEdit])

  // ── Effects — popular builder com lineup existente ───────────────────────
  useEffect(() => {
    if (!currentDayLineup || players.length === 0) return
    if (loadedLineupIdRef.current === currentDayLineup.id) return

    loadedLineupIdRef.current = currentDayLineup.id

    // Ao carregar lineup existente, sobrescreve effective_cost com locked_cost
    // para que o budget exibido reflita o preço no momento do envio,
    // não o preço atual (que pode ter mudado por repricing posterior).
    const withLockedCost = (player, lp) =>
      player && lp.locked_cost != null
        ? { ...player, effective_cost: lp.locked_cost }
        : player

    const titulares = currentDayLineup.players
      .filter(lp => lp.slot_type === 'titular')
      .map(lp => withLockedCost(players.find(p => p.id === lp.roster_id), lp))
      .filter(Boolean)

    const reserveEntry = currentDayLineup.players.find(lp => lp.slot_type === 'reserve')
    const reserve = reserveEntry
      ? withLockedCost(players.find(p => p.id === reserveEntry.roster_id) || null, reserveEntry)
      : null

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
      _savedRef.current = true
      track('lineup_saved', { stage_id: stageId })
      setSaveSuccess(data)
    } catch (e) {
      setSaveError(parseErrorMessage(e))
    } finally {
      setSaveLoading(false)
    }
  }

  const canSave = !isLocked && stageId && selectedPlayers.length === 4 &&
    reservePlayer && captainId && token.trim() && !isOverBudget && reserveEligible

  // Detecta se o lineup atual difere do salvo — sem este flag o botão fica "Editar"
  const hasChangedFromSaved = useMemo(() => {
    if (!currentDayLineup) return true  // sem lineup salvo: sempre em modo "novo"
    const savedTitulares = new Set(
      currentDayLineup.players.filter(p => p.slot_type === 'titular').map(p => p.roster_id)
    )
    const savedReserveId = currentDayLineup.players.find(p => p.slot_type === 'reserve')?.roster_id ?? null
    const savedCaptainId = currentDayLineup.players.find(p => p.is_captain)?.roster_id ?? null
    const currentTitulares = new Set(selectedPlayers.map(p => p.id))
    if (savedTitulares.size !== currentTitulares.size) return true
    for (const id of savedTitulares) { if (!currentTitulares.has(id)) return true }
    return savedReserveId !== (reservePlayer?.id ?? null) || savedCaptainId !== captainId
  }, [currentDayLineup, selectedPlayers, reservePlayer, captainId])

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

  function handleQuickFill() {
    if (isLocked) return
    const available = players.filter(p => Number(p.effective_cost) > 0)
    // Sort by pts_per_match / cost efficiency (desc), fallback to pts_per_match
    const ranked = [...available].sort((a, b) => {
      const ea = (priorStats[a.person_id]?.pts_per_match ?? 0) / (Number(a.effective_cost) || 1)
      const eb = (priorStats[b.person_id]?.pts_per_match ?? 0) / (Number(b.effective_cost) || 1)
      return eb - ea
    })

    // Greedy fill: pick best 4 titulares within budget, max 1 per team
    const titulares = []
    const usedTeams = new Set()
    let spent = 0
    for (const p of ranked) {
      if (titulares.length >= 4) break
      const cost = Number(p.effective_cost)
      const team = p.team_name || ''
      if (usedTeams.has(team)) continue
      if (spent + cost <= BUDGET_CAP) {
        titulares.push(p)
        usedTeams.add(team)
        spent += cost
      }
    }
    if (titulares.length < 4) return  // not enough players within budget

    const minCost = Math.min(...titulares.map(p => Number(p.effective_cost)))
    const titularIds = new Set(titulares.map(p => p.id))

    // Pick cheapest reserve (must be cheaper than cheapest titular, not already selected, different team)
    const reserveCandidates = ranked.filter(p =>
      !titularIds.has(p.id) &&
      !usedTeams.has(p.team_name || '') &&
      Number(p.effective_cost) <= minCost
    )
    const reserve = reserveCandidates[reserveCandidates.length - 1] // least efficient but cheapest
      ?? available.filter(p =>
          !titularIds.has(p.id) &&
          !usedTeams.has(p.team_name || '') &&
          Number(p.effective_cost) <= minCost
        ).sort((a, b) => Number(a.effective_cost) - Number(b.effective_cost))[0]

    // Pick captain = highest pts_per_match among titulares
    const captain = titulares.reduce((best, p) => {
      const ppm = priorStats[p.person_id]?.pts_per_match ?? -1
      const bpm = priorStats[best.person_id]?.pts_per_match ?? -1
      return ppm > bpm ? p : best
    })

    setSaveError('')
    setSaveSuccess(null)
    setSelectedPlayers(titulares)
    if (reserve) setReservePlayer(reserve)
    setCaptainId(captain.id)
  }

  const budgetUsedPct  = Math.min((totalCost / BUDGET_CAP) * 100, 100)
  const budgetBarColor = isOverBudget ? '#f87171' : totalCost / BUDGET_CAP > 0.85
    ? 'var(--xm-gold)' : 'var(--xm-orange)'

  const ps = (p) => priorStats[p.person_id]  // helper: prior stats de um player

  const COLS = [
    { key: 'team',              label: 'Time',     right: false },
    { key: 'name',              label: 'Jogador',  right: false },
    { key: 'effective_cost',    label: 'Preço',    right: true,
      title: 'Custo do jogador nesta stage',
      render: (p) => <span style={{ color: 'var(--xm-gold)', fontWeight: 700, fontSize: 14 }}>{fmtCost(p.effective_cost)}</span> },
    { key: 'pts_per_match',     label: 'PTS/G',    right: true,
      title: 'Pontos XAMA médios por partida (dias anteriores deste campeonato)',
      render: (p) => ps(p) ? ps(p).pts_per_match.toFixed(1) : '—' },
    { key: 'kills_per_match',   label: 'K/G',      right: true,
      title: 'Kills médias por partida',
      render: (p) => ps(p) ? ps(p).kills_per_match.toFixed(1) : '—' },
    { key: 'damage_per_match',  label: 'DMG/G',    right: true,
      title: 'Dano médio por partida',
      render: (p) => ps(p) ? Math.round(ps(p).damage_per_match) : '—' },
    { key: 'assists_per_match', label: 'ASS/G',    right: true,
      title: 'Assists médios por partida',
      render: (p) => ps(p) ? ps(p).assists_per_match.toFixed(1) : '—' },
    { key: 'total_wins',               label: 'WIN',      right: true,
      title: 'Chicken dinners (1º lugar) nos dias anteriores',
      render: (p) => ps(p) != null ? ps(p).total_wins : '—' },
    { key: 'late_game_pts_per_match',  label: 'SOBREV/G', right: true,
      title: 'Pontos de late game por partida (bônus por sobreviver ao top-8)',
      render: (p) => ps(p) != null ? ps(p).late_game_pts_per_match.toFixed(1) : '—' },
  ]

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="xlb-page">
      <div className="xm-page__container xm-page__container--2xl" style={{ padding: '0 24px' }}>

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
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--xm-blue)', marginBottom: 8 }}>
                  📋 Como montar seu lineup
                </div>
                <button
                  onClick={() => { setTutorialDismissed(true); localStorage.setItem(TUTORIAL_KEY, '1') }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--xm-muted)', fontSize: 16, lineHeight: 1,
                    padding: 0, flexShrink: 0,
                  }}
                  title="Dispensar">×</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {[
                  '4 titulares + 1 reserva dentro do budget de 100',
                  'A reserva deve custar ≤ ao titular mais barato',
                  'Clique ⭐ num slot para definir o Capitão — ele recebe ×1.30 nos pontos',
                  'Pontos: Kill +5 · Assist +1 · Knock +1 · Dano ×0.03',
                ].map(tip => (
                  <div key={tip} style={{ fontSize: 12, color: 'var(--xm-muted)', display: 'flex', gap: 6 }}>
                    <span style={{ color: 'var(--xm-blue)', flexShrink: 0 }}>›</span>
                    {tip}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Banner preview — aguardando confirmação (só quando preview E lineup ainda fechado) */}
          {isPreview && !canEdit && (
            <div style={{
              background: 'rgba(249,115,22,0.08)',
              border: '1px solid rgba(249,115,22,0.3)',
              borderRadius: 8, padding: '12px 16px', marginBottom: 12,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 18 }}>⏳</span>
              <div>
                <div style={{ color: 'var(--xm-orange)', fontSize: 13, fontWeight: 700 }}>
                  Lineup desabilitado — Aguardando confirmação
                </div>
                <div style={{ color: 'var(--xm-muted)', fontSize: 12, marginTop: 2 }}>
                  O roster está sendo validado. A montagem será liberada em breve.
                </div>
              </div>
            </div>
          )}

          {/* Banner independent_lineups — aparece quando stage tem dias independentes e o dia ativo não tem lineup */}
          {stage?.independent_lineups && stageDays.length > 1 && !currentDayLineup && canEdit && (
            <div style={{
              background: 'rgba(99,102,241,0.08)',
              border: '1px solid rgba(99,102,241,0.25)',
              borderRadius: 8, padding: '10px 16px', marginBottom: 12,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 16 }}>📋</span>
              <div>
                <div style={{ color: '#a5b4fc', fontSize: 13, fontWeight: 700 }}>
                  Nova escalação necessária
                </div>
                <div style={{ color: 'var(--xm-muted)', fontSize: 12, marginTop: 2 }}>
                  Cada dia desta fase requer uma escalação própria — o lineup anterior não é reaproveitado automaticamente.
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
              color: 'var(--xm-red)', fontSize: 13, fontWeight: 600, textAlign: 'center',
            }}>
              🔒 Lineup fechado — submissões não são aceitas no momento
            </div>
          )}

          {/* ── Barra unificada: budget + cap + countdown + botão ─────── */}
          <div style={{ padding: '12px 16px 0' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 8 }}>

              {/* Budget */}
              <div style={{ flexShrink: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--xm-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>
                  Budget
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>
                  <span style={{ fontSize: 22, fontWeight: 800, color: isOverBudget ? '#f87171' : 'var(--xm-gold)' }}>
                    {fmtCost(totalCost)}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--xm-muted)' }}>/ {BUDGET_CAP}</span>
                </div>
              </div>

              {/* CAP pill */}
              {stage?.captain_multiplier && (
                <span
                  title={`Capitão recebe ×${Number(stage.captain_multiplier).toFixed(2)} nos pontos`}
                  style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
                    color: 'var(--xm-gold)',
                    background: 'rgba(250,204,21,0.10)',
                    border: '1px solid rgba(250,204,21,0.25)',
                    borderRadius: 4, padding: '3px 7px',
                    fontFamily: "'JetBrains Mono', monospace",
                    cursor: 'default', alignSelf: 'center', flexShrink: 0,
                  }}>
                  ⭐ ×{Number(stage.captain_multiplier).toFixed(2)}
                </span>
              )}

              <div style={{ flex: 1 }} />

              {/* Countdown — sempre visível enquanto houver tempo */}
              {canEdit && countdown && (() => {
                const { diff, days, hours, mins, secs } = countdown
                const urgent  = diff < 10 * 60_000
                const warning = diff < 60 * 60_000
                const color   = urgent ? '#f87171' : warning ? 'var(--xm-gold)' : 'var(--xm-muted)'
                const label   = urgent ? 'URGENTE' : warning ? 'fechando' : 'fecha em'
                const timeStr = diff > 24 * 3_600_000
                  ? `${days}d ${hours}h`
                  : diff > 3_600_000
                    ? `${hours}h${String(mins).padStart(2,'0')}m`
                    : diff > 60_000
                      ? `${mins}m${String(secs).padStart(2,'0')}s`
                      : `00:${String(secs).padStart(2,'0')}`
                return (
                  <div
                    className={urgent ? 'xama-pulse' : undefined}
                    style={{ textAlign: 'right', flexShrink: 0 }}
                  >
                    <div style={{ fontSize: 10, fontWeight: 600, color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>
                      {label}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color, lineHeight: 1 }}>
                      {timeStr}
                    </div>
                  </div>
                )
              })()}

              {/* Botão salvar / editar */}
              {!(isPreview && !canEdit) && (() => {
                // "Editar" quando lineup existe e nada mudou; "Salvar" quando há alteração
                const isEditMode = !!currentDayLineup && !hasChangedFromSaved
                const active = !isEditMode && canSave && !saveLoading
                return (
                  <button
                    className="xlb-header-save-btn"
                    onClick={isEditMode ? undefined : saveLineup}
                    disabled={isEditMode || !canSave || saveLoading}
                    title={isEditMode ? 'Altere jogadores, capitão ou reserva para salvar uma nova versão' : undefined}
                    style={{
                      padding: '9px 20px', borderRadius: 8, flexShrink: 0,
                      fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                      cursor: isEditMode ? 'default' : (canSave && !saveLoading ? 'pointer' : 'not-allowed'),
                      transition: 'background 0.15s, border-color 0.15s, opacity 0.15s',
                      alignSelf: 'center',
                      ...(isEditMode
                        ? { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--xm-muted)', opacity: 0.7 }
                        : active
                          ? { background: 'var(--xm-orange)', border: '1px solid transparent', color: '#fff' }
                          : { background: 'var(--surface-3)', border: '1px solid transparent', color: 'var(--xm-muted)' }
                      ),
                    }}
                  >
                    {saveLoading ? '...' : isLocked ? '🔒 Fechado' : isEditMode ? '✏ Editar' : 'Salvar'}
                  </button>
                )
              })()}
            </div>

            {/* Barra de progresso */}
            <div style={{ height: 4, borderRadius: 2, background: 'var(--surface-3)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 2,
                width: `${budgetUsedPct}%`,
                background: budgetBarColor,
                transition: 'width 0.2s ease, background 0.2s ease',
              }} />
            </div>
          </div>

          {/* Quick Fill */}
          {!isLocked && selectedPlayers.length < 4 && players.length > 0 && (
            <div style={{ padding: '4px 16px 0', textAlign: 'right' }}>
              <button
                onClick={handleQuickFill}
                title="Preenche automaticamente o melhor lineup dentro do budget"
                style={{
                  background: 'none', border: 'none', padding: '2px 0',
                  fontSize: 12, fontWeight: 600,
                  color: 'var(--xm-muted)', cursor: 'pointer',
                  textDecoration: 'underline', textUnderlineOffset: '3px',
                }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--xm-orange)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--xm-muted)'}
              >
                ⚡ preencher automaticamente
              </button>
            </div>
          )}

          {/* Mensagens de erro / sucesso */}
          {(saveError || saveSuccess) && (
            <div style={{ padding: '6px 16px 0' }}>
              {saveError   && <div className="xm-msg xm-msg--err">{saveError}</div>}
              {saveSuccess && <p className="xm-msg xm-msg--ok">Lineup salvo com sucesso!</p>}
            </div>
          )}

          {/* Slots de titulares + reserva em linha */}
          <div className="xlb-hslots-row" style={{ padding: '12px 16px 14px', display: 'flex', gap: 8, alignItems: 'stretch' }}>
            {Array.from({ length: 4 }).map((_, i) => {
              const p = selectedPlayers[i]
              const isCap = p && p.id === captainId
              const isRecCap = p && !isCap && p.id === suggestedCaptainId
              const isCheapest = p && isReserveError && p.id === cheapestStarterId
              const tag = p ? formatTeamTag(p.person_name, p.team_name) : null
              return p ? (
                <div key={p.id} className="xlb-hslot" style={{
                  flex: 1,
                  background: 'var(--surface-2)',
                  border: `1px solid ${isCap ? 'var(--xm-gold)' : isCheapest ? 'rgba(249,115,22,0.7)' : 'var(--xm-border)'}`,
                  boxShadow: isCap ? '0 0 0 2px rgba(250,204,21,0.10)' : isCheapest ? '0 0 0 2px rgba(249,115,22,0.18)' : 'none',
                  borderRadius: 8, overflow: 'hidden',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                }}>
                  {/* Logo column */}
                  <div className="xlb-hslot-logo-col">
                    <TeamLogo teamName={tag} shortName={stage?.championship_short_name ?? ''} size={56} />
                  </div>
                  <div className="xlb-hslot-sep" />
                  {/* Info column */}
                  <div className="xlb-hslot-info">
                    {/* Row 1: TAG + × */}
                    <div className="xlb-hslot-toprow">
                      <span className="xlb-hslot-tag-label">{tag || '—'}</span>
                      <button className="xlb-remove-btn" onClick={() => removePlayer(p.id)} title="Remover">×</button>
                    </div>
                    {/* Nome — prominente */}
                    <div className="xlb-hslot-name">
                      {formatPlayerName(p.person_name, p.team_name)}
                      {p.newcomer_to_tier && <span className="xlb-new-badge">NEW</span>}
                    </div>
                    {/* Row 3: PREÇO + capitão */}
                    <div className="xlb-hslot-bottomrow">
                      <span className="xlb-hslot-price">{fmtCost(p.effective_cost)}</span>
                      <button
                        className="xlb-captain-btn"
                        onClick={() => toggleCaptain(p.id)}
                        title={isCap ? 'Remover capitão' : isRecCap ? 'Recomendado ★ — melhor pts/g do lineup' : 'Definir como capitão'}>
                        {isRecCap && (
                          <span style={{ fontSize: 8, color: 'rgba(250,204,21,0.85)', fontWeight: 800, letterSpacing: '0.05em', marginRight: 2 }}>REC</span>
                        )}
                        <span style={{ color: isCap ? 'var(--xm-gold)' : isRecCap ? 'rgba(250,204,21,0.65)' : 'var(--xm-muted)', lineHeight: 1, fontSize: 16 }}>{isCap ? '⭐' : '☆'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div key={i} className="xlb-hslot empty" style={{
                  flex: 1, background: 'var(--surface-1)',
                  border: '1px dashed var(--xm-border)',
                  borderRadius: 8, padding: '8px 10px',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 120,
                }}>
                  <span style={{ fontSize: 9, color: 'var(--xm-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>T{i + 1}</span>
                  <span style={{ fontSize: 10, color: 'var(--xm-muted)', fontStyle: 'italic' }}>— vazio —</span>
                </div>
              )
            })}

            {/* 5º card — reserva */}
            {reservePlayer ? (
              <div className="xlb-hslot xlb-hslot-reserve" style={{
                flex: 1, background: 'var(--surface-2)',
                border: '1px solid rgba(96,165,250,0.3)',
                borderRadius: 8, marginLeft: 12, overflow: 'hidden',
                transition: 'border-color 0.2s',
              }}>
                <div className="xlb-hslot-logo-col">
                  <TeamLogo teamName={formatTeamTag(reservePlayer.person_name, reservePlayer.team_name)} shortName={stage?.championship_short_name ?? ''} size={56} />
                </div>
                <div className="xlb-hslot-sep" />
                <div className="xlb-hslot-info">
                  <div className="xlb-hslot-toprow">
                    <span className="xlb-hslot-tag-label" style={{ color: 'var(--xm-blue)' }}>RESERVA</span>
                    <button className="xlb-remove-btn" onClick={removeReserve} title="Remover reserva">×</button>
                  </div>
                  <div className="xlb-hslot-name">{formatPlayerName(reservePlayer.person_name, reservePlayer.team_name)}</div>
                  <div className="xlb-hslot-bottomrow">
                    <span className="xlb-hslot-price" style={{ color: reserveEligible ? 'var(--xm-gold)' : 'var(--xm-red)' }}>
                      {fmtCost(reservePlayer.effective_cost)}{!reserveEligible && ' ⚠'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="xlb-hslot xlb-hslot-reserve empty" style={{
                flex: 1, background: 'rgba(59,130,246,0.08)',
                border: '1px dashed rgba(96,165,250,0.4)',
                borderRadius: 8, padding: '8px 10px',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 120,
                marginLeft: 12,
              }}>
                <span style={{ fontSize: 9, color: 'var(--xm-blue)', letterSpacing: '0.10em', textTransform: 'uppercase' }}>RESERVA</span>
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

            {/* 6º slot: botão Salvar/Editar — mobile only (desktop usa header) */}
            {!(isPreview && !canEdit) && (() => {
              const isEditMode = !!currentDayLineup && !hasChangedFromSaved
              const active = !isEditMode && canSave && !saveLoading
              return (
                <div className="xlb-hslot xlb-hslot-save" style={{ flex: 1, borderRadius: 8 }}>
                  <button
                    onClick={isEditMode ? undefined : saveLineup}
                    disabled={isEditMode || !canSave || saveLoading}
                    style={{
                      width: '100%', height: '100%', minHeight: 44,
                      borderRadius: 8, border: 'none',
                      fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                      cursor: isEditMode ? 'default' : (canSave && !saveLoading ? 'pointer' : 'not-allowed'),
                      transition: 'background 0.15s, opacity 0.15s',
                      ...(isEditMode
                        ? { background: 'rgba(255,255,255,0.04)', color: 'var(--xm-muted)', opacity: 0.7 }
                        : active
                          ? { background: 'var(--xm-orange)', color: '#fff' }
                          : { background: 'var(--surface-3)', color: 'var(--xm-muted)' }
                      ),
                    }}
                  >
                    {saveLoading ? '...' : isLocked ? '🔒' : isEditMode ? '✏ Editar' : 'Salvar'}
                  </button>
                </div>
              )
            })()}
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
                  background: teamFilter === null ? 'var(--xm-orange)' : 'var(--surface-3)',
                  color: teamFilter === null ? '#fff' : 'var(--xm-muted)',
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
                    background: teamFilter === tag ? 'var(--xm-orange)' : 'var(--surface-3)',
                    color: teamFilter === tag ? '#fff' : 'var(--xm-muted)',
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
                color: 'var(--xm-orange)',
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
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--xm-orange)', letterSpacing: '0.08em', fontFamily: "'JetBrains Mono', monospace" }}>
              🔥 XAMA
            </span>
            {[
              'Kill +5', 'Assist +1', 'Knock +1', 'Dano ×0.03', 'Morte precoce −15', 'Late Game bônus', `Cap ×${Number(stage?.captain_multiplier ?? 1.30).toFixed(2)}`
            ].map(item => (
              <span key={item} style={{ fontSize: 11, color: 'var(--xm-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                {item}
              </span>
            ))}
            <span style={{ fontSize: 11, color: 'var(--xm-orange)', fontFamily: "'JetBrains Mono', monospace", marginLeft: 'auto' }}>
              ver detalhes →
            </span>
          </div>

          {/* Estados */}
          {playersLoading && <p className="xm-empty__body" style={{ padding: '24px 18px' }}>Carregando jogadores...</p>}
          {playersError   && <p className="xm-msg xm-msg--err"   style={{ padding: '16px 18px' }}>{playersError}</p>}

          {/* Tabela — sempre renderizada em preview, botões desabilitados */}
          {!playersLoading && !playersError && (
            <div style={{ overflowX: 'auto' }}>
              <table className="xlb-table">
                <thead>
                  <tr>
                    {COLS.map(({ key, label, right, title }) => (
                      <th key={key}
                        className={sortKey === key ? 'active' : ''}
                        onClick={() => handleSort(key)}
                        title={title}
                        style={{ fontSize: 13, whiteSpace: 'nowrap', textAlign: right ? 'center' : 'left' }}>
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
                    const isRecCaptain   = !isCap && p.id === suggestedCaptainId
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
                            <TeamLogo teamName={playerTag} shortName={stage?.championship_short_name ?? ''} size={20} />
                            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--xm-muted)' }}>
                              {playerTag || '—'}
                            </span>
                          </div>
                        </td>
                        <td className="font-semibold whitespace-nowrap" style={{ color: 'var(--xm-text)', fontSize: 15 }}>
                          <span
                            onClick={() => setHistoryPlayer({
                              person_id: p.person_id,
                              person_name: formatPlayerName(p.person_name, p.team_name),
                              team_name: playerTag,
                              before_date: stageDays.find(d => d.id === activeStageDayId)?.lineup_close_at || null,
                              price_components: p.price_components,
                            })}
                            style={{ cursor: 'pointer', borderBottom: '1px dashed rgba(249,115,22,0.4)', paddingBottom: '1px' }}
                            title="Ver histórico de partidas"
                          >
                            {formatPlayerName(p.person_name, p.team_name)}
                          </span>
                          {isCap && (
                            <span style={{ marginLeft: 4, fontSize: 9, color: 'var(--xm-gold)', fontWeight: 700 }}>⭐CAP</span>
                          )}
                          {isRecCaptain && (
                            <span title="Recomendado como capitão — melhor pts/g do lineup" style={{ marginLeft: 4, fontSize: 9, color: 'rgba(250,204,21,0.75)', fontWeight: 700 }}>★REC</span>
                          )}
                          {p.newcomer_to_tier && (
                            <span style={{ marginLeft: 4, fontSize: 9, color: '#60a5fa', fontWeight: 700 }}>NEW</span>
                          )}
                          {p.trend === 'up' && (
                            <span
                              title="Em alta — média das últimas 3 partidas acima da histórica"
                              style={{ marginLeft: 5, fontSize: 11, color: '#4ade80', fontWeight: 800, verticalAlign: 'middle' }}>
                              ▲
                            </span>
                          )}
                          {p.trend === 'down' && (
                            <span
                              title="Em queda — média das últimas 3 partidas abaixo da histórica"
                              style={{ marginLeft: 5, fontSize: 11, color: '#f87171', fontWeight: 800, verticalAlign: 'middle' }}>
                              ▼
                            </span>
                          )}
                        </td>
                        {COLS.slice(2).map(col => (
                          <td key={col.key}
                            className="tabular-nums"
                            style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: 13,
                              color: 'var(--xm-text)',
                              whiteSpace: 'nowrap',
                              textAlign: 'center',
                            }}>
                            {col.render ? col.render(p) : (p[col.key] ?? '—')}
                          </td>
                        ))}
                        <td>
                          <div className="xlb-action-btns">
                            {onPlayerInfoClick && (
                              <button
                                className="xlb-action-btn xlb-action-btn--graph"
                                style={{ background: 'rgba(96,165,250,0.08)', borderColor: 'rgba(96,165,250,0.2)', color: 'var(--xm-blue)' }}
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
                                color: 'var(--xm-orange)',
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

      </div>{/* fim xm-page__container */}

      {historyPlayer && (
        <PlayerHistoryModal
          player={historyPlayer}
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
