// frontend/src/components/LineupBuilder.jsx
// XAMA Fantasy — Lineup Builder (Fase 6)
// Consome os novos endpoints: /stages/, /stages/{id}/roster, /stages/{id}/days, /lineups/

import { useEffect, useMemo, useState } from 'react'
import { API_BASE_URL } from '../config'
import TeamLogo from './TeamLogo'
import PlayerHistoryModal from './PlayerHistoryModal'

// ── Helpers ────────────────────────────────────────────────────────────────
function formatPlayerName(name) {
  if (!name) return ''
  const idx = name.indexOf('_')
  return idx !== -1 ? name.slice(idx + 1) : name
}
function formatTeamTag(name, team) {
  if (name) {
    const idx = name.indexOf('_')
    if (idx !== -1) return name.slice(0, idx)
  }
  return team || ''
}
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
  const [sortKey,      setSortKey]      = useState('effective_cost')
  const [sortDir,      setSortDir]      = useState('desc')
  const [saveLoading,  setSaveLoading]  = useState(false)
  const [saveError,    setSaveError]    = useState('')
  const [saveSuccess,  setSaveSuccess]  = useState(null)
  const [historyPlayer, setHistoryPlayer] = useState(null)

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

  // isLocked: true quando preview, não pode editar, ou já tem lineup submetido
  const isLocked = isPreview || !canEdit || !!currentDayLineup

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

  // ── Derived — tabela filtrada e ordenada ────────────────────────────────
  const filteredPlayers = useMemo(() => {
    const q = searchName.trim().toLowerCase()
    if (!q) return players
    return players.filter(p =>
      String(p.person_name || '').toLowerCase().includes(q) ||
      String(p.team_name || '').toLowerCase().includes(q)
    )
  }, [players, searchName])

  const sortedPlayers = useMemo(() => {
    return [...filteredPlayers].sort((a, b) => {
      let aVal, bVal
      if (sortKey === 'name')           { aVal = formatPlayerName(a.person_name); bVal = formatPlayerName(b.person_name) }
      else if (sortKey === 'team')      { aVal = a.team_name; bVal = b.team_name }
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
    else { setSortKey(key); setSortDir('desc') }
  }

  const budgetUsedPct  = Math.min((totalCost / BUDGET_CAP) * 100, 100)
  const budgetBarColor = isOverBudget ? '#f87171' : totalCost / BUDGET_CAP > 0.85
    ? 'var(--color-xama-gold)' : 'var(--color-xama-orange)'

  const COLS = [
    { key: 'team',           label: 'Time',    right: false },
    { key: 'name',           label: 'Jogador', right: false },
    { key: 'effective_cost', label: 'Preço',   right: true  },
  ]

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="xlb-page">
      <div className="xama-container">

        {/* ── Cabeçalho sticky com lineup montado ──────────────────────── */}
        <div className="xlb-sticky-header">

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
              color: '#f87171', fontSize: 13, fontWeight: 600, textAlign: 'center',
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
              color: '#4ade80', fontSize: 13, fontWeight: 600, textAlign: 'center',
            }}>
              ✅ Lineup já submetido para hoje
            </div>
          )}

          {/* Budget bar */}
          <div style={{ padding: '12px 16px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--color-xama-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Budget
                </span>
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
                color: isOverBudget ? '#f87171' : 'var(--color-xama-text)',
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

          {/* Slots de titulares */}
          <div className="xlb-hslots-row" style={{ padding: '12px 16px 0', display: 'flex', gap: 8 }}>
            {Array.from({ length: 4 }).map((_, i) => {
              const p = selectedPlayers[i]
              const isCap = p && p.id === captainId
              return p ? (
                <div key={p.id} className="xlb-hslot" style={{
                  flex: 1, background: 'var(--surface-2)',
                  border: `1px solid ${isCap ? 'var(--color-xama-gold)' : 'var(--color-xama-border)'}`,
                  borderRadius: 8, padding: '8px 10px', position: 'relative',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                      color: isCap ? 'var(--color-xama-gold)' : 'var(--color-xama-muted)',
                      textTransform: 'uppercase',
                    }}>
                      {isCap ? '⭐ CAP' : `T${i + 1}`}
                    </span>
                    <button
                      className="xlb-remove-btn"
                      onClick={() => removePlayer(p.id)}
                      title="Remover">×</button>
                  </div>
                  <div className="xlb-hslot-name" style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-xama-text)', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {formatPlayerName(p.person_name)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 10, color: 'var(--color-xama-muted)' }}>
                      {formatTeamTag(p.person_name, p.team_name)}
                    </span>
                    <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-xama-gold)', fontWeight: 700 }}>
                      {Number(p.effective_cost || 0)}
                    </span>
                  </div>
                  {isCap ? (
                    stage?.captain_multiplier && (
                      <div style={{
                        marginTop: 5, textAlign: 'center',
                        fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
                        color: 'var(--color-xama-gold)',
                        fontFamily: "'JetBrains Mono', monospace",
                      }}>
                        ×{Number(stage.captain_multiplier).toFixed(2)}
                      </div>
                    )
                  ) : (
                    <button
                      onClick={() => toggleCaptain(p.id)}
                      title="Definir como capitão"
                      style={{
                        marginTop: 6, width: '100%', fontSize: 9, fontWeight: 700,
                        letterSpacing: '0.06em', textTransform: 'uppercase',
                        background: 'rgba(250,204,21,0.08)',
                        border: '1px solid rgba(250,204,21,0.2)',
                        borderRadius: 4, padding: '3px 0',
                        color: 'var(--color-xama-gold)', cursor: 'pointer',
                      }}>
                      CAP
                    </button>
                  )}
                </div>
              ) : (
                <div key={i} className="xlb-hslot empty" style={{
                  flex: 1, background: 'var(--surface-1)',
                  border: '1px dashed var(--color-xama-border)',
                  borderRadius: 8, padding: '8px 10px',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 80,
                }}>
                  <span style={{ fontSize: 9, color: 'var(--color-xama-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>T{i + 1}</span>
                  <span style={{ fontSize: 10, color: 'var(--color-xama-muted)', fontStyle: 'italic' }}>— vazio —</span>
                </div>
              )
            })}
          </div>

          {/* Divider + slot de reserva */}
          <div style={{ padding: '10px 16px 0' }}>
            <div style={{ height: 1, background: 'var(--color-xama-border)', marginBottom: 10 }} />
            {reservePlayer ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'var(--surface-2)',
                border: '1px solid rgba(96,165,250,0.3)',
                borderRadius: 8, padding: '8px 12px',
              }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa', letterSpacing: '0.06em', flexShrink: 0 }}>RES</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-xama-text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {formatPlayerName(reservePlayer.person_name)}
                </span>
                <span style={{ fontSize: 11, color: 'var(--color-xama-muted)', flexShrink: 0 }}>
                  {formatTeamTag(reservePlayer.person_name, reservePlayer.team_name)}
                </span>
                <span style={{
                  fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
                  color: reserveEligible ? '#4ade80' : '#f87171', fontWeight: 700, flexShrink: 0,
                }}>
                  {Number(reservePlayer.effective_cost || 0)}{!reserveEligible && ' ⚠'}
                </span>
                <button className="xlb-remove-btn" onClick={removeReserve} title="Remover reserva">×</button>
              </div>
            ) : (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--surface-1)',
                border: '1px dashed rgba(96,165,250,0.25)',
                borderRadius: 8, padding: '10px 12px',
                color: 'rgba(96,165,250,0.5)', fontSize: 11, fontStyle: 'italic',
              }}>
                RES — reserva vazia
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
                  fontFamily: "'Rajdhani', sans-serif",
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
                  fontFamily: "'Rajdhani', sans-serif",
                  fontSize: 15, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                  borderRadius: 8, border: 'none', cursor: canSave && !saveLoading ? 'pointer' : 'not-allowed',
                  background: canSave && !saveLoading ? 'var(--color-xama-orange)' : 'var(--surface-3)',
                  color: canSave && !saveLoading ? '#fff' : 'var(--color-xama-muted)',
                  transition: 'background 0.15s',
                }}>
                {saveLoading ? 'Salvando...' : isLocked ? '🔒 Fechado' : 'Salvar Lineup'}
              </button>
            )}
          </div>
        </div>{/* fim sticky header */}

        {/* ── Pool de jogadores ──────────────────────────────────────── */}
        <div className="xlb-panel">

          {/* Barra de busca */}
          <div className="xlb-search-row">
            <input
              className="xlb-search-input"
              value={searchName}
              onChange={e => setSearchName(e.target.value)}
              placeholder="Buscar jogador ou time..."
            />
            <span className="xlb-count">{filteredPlayers.length}/{players.length}</span>
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
                        onClick={() => handleSort(key)}>
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
                    const playerTag    = formatTeamTag(p.person_name, p.team_name)
                    const isSelected   = selectedPlayers.some(sp => sp.id === p.id) || reservePlayer?.id === p.id
                    const isConflicted = !isSelected && conflictedTeams.has(playerTag) && conflictedTeams.size > 0
                    const isCap        = p.id === captainId
                    // Em preview: todos os botões de ação ficam desabilitados
                    const btnDisabled  = isLocked || isConflicted
                    return (
                      <tr key={p.id} className={isConflicted ? 'xlb-row--dimmed' : ''}>
                        <td>
                          <div className="flex items-center gap-1.5">
                            <TeamLogo teamName={playerTag} size={20} />
                            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--color-xama-muted)' }}>
                              {playerTag || '—'}
                            </span>
                          </div>
                        </td>
                        <td className="font-semibold whitespace-nowrap" style={{ color: 'var(--color-xama-text)' }}>
                          <span
                            onClick={() => setHistoryPlayer({
                              person_id: p.person_id,
                              person_name: formatPlayerName(p.person_name),
                              team_name: playerTag,
                              before_date: stageDays.find(d => d.id === activeStageDayId)?.lineup_close_at || null,
                            })}
                            style={{ cursor: 'pointer', borderBottom: '1px dashed rgba(249,115,22,0.4)', paddingBottom: '1px' }}
                            title="Ver histórico de partidas"
                          >
                            {formatPlayerName(p.person_name)}
                          </span>
                          {isCap && (
                            <span style={{ marginLeft: 4, fontSize: 9, color: 'var(--color-xama-gold)', fontWeight: 700 }}>⭐CAP</span>
                          )}
                          {p.newcomer_to_tier && (
                            <span style={{ marginLeft: 4, fontSize: 9, color: '#60a5fa', fontWeight: 700 }}>NEW</span>
                          )}
                        </td>
                        <td className="right tabular-nums font-bold"
                          style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-xama-gold)' }}>
                          {Number(p.effective_cost || 0)}
                        </td>
                        <td>
                          <div className="flex gap-1 justify-end">
                            {onPlayerInfoClick && (
                              <button
                                className="xlb-action-btn"
                                style={{ background: 'rgba(96,165,250,0.08)', borderColor: 'rgba(96,165,250,0.2)', color: '#60a5fa' }}
                                onClick={() => onPlayerInfoClick(p)}
                                title="Ver histórico de preços">
                                📈
                              </button>
                            )}
                            <button
                              className={`xlb-action-btn${isConflicted ? ' xlb-action-btn--conflict' : ''}`}
                              disabled={btnDisabled || isSelected}
                              onClick={() => !btnDisabled && !isSelected && addPlayer(p)}>
                              Titular
                            </button>
                            <button
                              className={`xlb-action-btn${isConflicted ? ' xlb-action-btn--conflict' : ''}`}
                              disabled={btnDisabled || isSelected}
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
    </div>
  )
}
