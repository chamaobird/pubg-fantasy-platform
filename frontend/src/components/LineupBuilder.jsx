// frontend/src/components/LineupBuilder.jsx
// XAMA Fantasy — Lineup Builder
// Tailwind v4 + tema XAMA

import { useEffect, useMemo, useState } from 'react'
import { API_BASE_URL } from '../config'

// ── Helpers ────────────────────────────────────────────────────────────────
function formatPlayerName(name) {
  if (!name) return ''
  const idx = name.indexOf('_')
  return idx !== -1 ? name.slice(idx + 1) : name
}

function formatTeamTag(name, team) {
  if (team) return team
  if (!name) return ''
  const idx = name.indexOf('_')
  return idx !== -1 ? name.slice(0, idx) : ''
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

const placementColorHex = (val) => {
  if (val == null) return '#6b7280'
  if (val <= 5) return '#4ade80'
  if (val <= 12) return '#facc15'
  return '#f87171'
}

const fmtMin = (secs) => (secs != null ? Math.round(Number(secs) / 60) : '—')

// ── Section title ──────────────────────────────────────────────────────────
function SectionTitle({ step, label }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-[13px]"
        style={{ backgroundColor: 'var(--color-xama-accent-soft)', color: 'var(--color-xama-accent)' }}
      >
        {step}
      </div>
      <h2
        className="text-sm font-semibold tracking-wide"
        style={{ color: 'var(--color-xama-foreground)' }}
      >
        {label}
      </h2>
    </div>
  )
}

export default function LineupBuilder({
  const [tournaments, setTournaments] = useState([])
  const [tournamentsLoading, setTournamentsLoading] = useState(false)
  const [tournamentsError, setTournamentsError] = useState(null)

  // Apenas torneios com lineup_open === true
  const openTournaments = useMemo(
    () => tournaments.filter((t) => t.lineup_open),
    [tournaments],
  )

  const [tournamentId, setTournamentId] = useState(null)
  const [players, setPlayers] = useState([])
  const [playersLoading, setPlayersLoading] = useState(false)
  const [playersError, setPlayersError] = useState(null)

  const [selectedPlayers, setSelectedPlayers] = useState([])
  const [reservePlayer, setReservePlayer] = useState(null)
  const [captainId, setCaptainId] = useState(null)

  const [budgetLimit, setBudgetLimit] = useState(100)
  const [username, setUsername] = useState('')
  const [saveLoading, setSaveLoading] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [saveSuccess, setSaveSuccess] = useState(null)

  const [sortKey, setSortKey] = useState('fantasy_cost')
  const [sortDir, setSortDir] = useState('desc')

  // ── Fetch de torneios ───────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true
    setTournamentsLoading(true)
    setTournamentsError(null)

    httpJson(`${API_BASE_URL}/tournaments/`, { method: 'GET' })
      .then((data) => {
        if (!isMounted) return
        setTournaments(data || [])
      })
      .catch((err) => {
        if (!isMounted) return
        setTournamentsError(parseErrorMessage(err))
      })
      .finally(() => {
        if (!isMounted) return
        setTournamentsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  // ── Fetch de players quando tournamentId muda ───────────────────────────
  useEffect(() => {
    if (!tournamentId) {
      setPlayers([])
      return
    }

    let isMounted = true
    setPlayersLoading(true)
    setPlayersError(null)

    httpJson(`${API_BASE_URL}/tournaments/${tournamentId}/players`, { method: 'GET' })
      .then((data) => {
        if (!isMounted) return
        setPlayers(data || [])
      })
      .catch((err) => {
        if (!isMounted) return
        setPlayersError(parseErrorMessage(err))
      })
      .finally(() => {
        if (!isMounted) return
        setPlayersLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [tournamentId])

  // ── Cálculos derivados ──────────────────────────────────────────────────
  const totalCost = useMemo(() => {
    const startersCost = selectedPlayers.reduce((sum, p) => sum + (p.fantasy_cost ?? 0), 0)
    const reserveCost = reservePlayer ? reservePlayer.fantasy_cost ?? 0 : 0
    return startersCost + reserveCost
  }, [selectedPlayers, reservePlayer])

  const budgetRemaining = budgetLimit - totalCost

  const selectedIds = useMemo(
    () => new Set(selectedPlayers.map((p) => p.id).concat(reservePlayer ? [reservePlayer.id] : [])),
    [selectedPlayers, reservePlayer],
  )

  const sortedPlayers = useMemo(() => {
    const list = [...players]
    list.sort((a, b) => {
      const va = a[sortKey] ?? 0
      const vb = b[sortKey] ?? 0
      if (va === vb) return 0
      return sortDir === 'asc' ? (va < vb ? -1 : 1) : va > vb ? -1 : 1
    })
    return list
  }, [players, sortKey, sortDir])

  const startersFull = selectedPlayers.length >= 4
  const hasReserve = !!reservePlayer

  const canSave =
    !!tournamentId &&
    startersFull &&
    hasReserve &&
    !!captainId &&
    !!username &&
    budgetRemaining >= 0

  // ── Handlers ────────────────────────────────────────────────────────────
  function toggleStarter(player) {
    if (selectedPlayers.some((p) => p.id === player.id)) {
      setSelectedPlayers((prev) => prev.filter((p) => p.id !== player.id))
      if (captainId === player.id) setCaptainId(null)
      return
    }

    if (selectedPlayers.length >= 4) return
    setSelectedPlayers((prev) => [...prev, player])
  }

  function toggleReserve(player) {
    if (reservePlayer && reservePlayer.id === player.id) {
      setReservePlayer(null)
      return
    }
    if (selectedPlayers.some((p) => p.id === player.id)) return
    setReservePlayer(player)
  }

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  async function handleSave() {
    if (!canSave) return
    setSaveLoading(true)
    setSaveError(null)
    setSaveSuccess(null)

    try {
      const body = {
        tournament_id: tournamentId,
        username: username.trim(),
        starters: selectedPlayers.map((p) => p.id),
        reserve: reservePlayer?.id ?? null,
        captain_id: captainId,
      }

      const data = await httpJson(`${API_BASE_URL}/lineups/`, {
        method: 'POST',
        body: JSON.stringify(body),
      })

      setSaveSuccess('Lineup salvo com sucesso!')
      setSaveError(null)
    } catch (err) {
      setSaveError(parseErrorMessage(err))
      setSaveSuccess(null)
    } finally {
      setSaveLoading(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Left column */}
        <div className="flex-1 min-w-0">
          {/* 1. Escolher torneio */}
          <SectionTitle step={1} label="Escolha o torneio" />

          {tournamentsLoading && (
            <div className="py-2 text-[13px]" style={{ color: 'var(--color-xama-muted)' }}>
              Carregando torneios...
            </div>
          )}

          {tournamentsError && (
            <div className="py-2 text-[13px]" style={{ color: 'var(--color-xama-danger)' }}>
              Erro ao carregar torneios: {tournamentsError}
            </div>
          )}

          {openTournaments.length === 0 && !tournamentsLoading && (
            <div className="py-3 text-[13px]" style={{ color: 'var(--color-xama-muted)' }}>
              Nenhum torneio aberto para lineup no momento.
            </div>
          )}

          <div className="mb-4">
            <select
              value={tournamentId ?? ''}
              onChange={(e) => setTournamentId(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-3 py-2 border rounded bg-transparent text-[13px]"
              style={{
                borderColor: 'var(--color-xama-border-subtle)',
                color: 'var(--color-xama-foreground)',
              }}
              disabled={openTournaments.length === 0}
            >
              <option value="">Selecione um torneio</option>
              {openTournaments.map((t) => (
                <option key={t.id} value={String(t.id)}>
                  {t.name}
                  {t.region ? ` (${t.region})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Lista de jogadores */}
          <SectionTitle step={2} label="Escolha seus jogadores" />

          {playersLoading && (
            <div className="py-2 text-[13px]" style={{ color: 'var(--color-xama-muted)' }}>
              Carregando jogadores...
            </div>
          )}

          {playersError && (
            <div className="py-2 text-[13px]" style={{ color: 'var(--color-xama-danger)' }}>
              Erro ao carregar jogadores: {playersError}
            </div>
          )}

          {!playersLoading && !playersError && players.length === 0 && tournamentId && (
            <div className="py-2 text-[13px]" style={{ color: 'var(--color-xama-muted)' }}>
              Nenhum jogador encontrado para este torneio.
            </div>
          )}

          {/* Tabela de jogadores */}
          {players.length > 0 && (
            <div className="border rounded overflow-hidden" style={{ borderColor: 'var(--color-xama-border-subtle)' }}>
              <div
                className="grid grid-cols-12 text-[11px] uppercase tracking-wide px-3 py-2"
                style={{ backgroundColor: 'var(--color-xama-surface-subtle)', color: 'var(--color-xama-muted)' }}
              >
                <div className="col-span-3 cursor-pointer" onClick={() => handleSort('name')}>
                  Jogador
                </div>
                <div className="col-span-1 text-right cursor-pointer" onClick={() => handleSort('fantasy_cost')}>
                  Preço
                </div>
                <div className="col-span-1 text-right cursor-pointer" onClick={() => handleSort('avg_kills_50')}>
                  K
                </div>
                <di                  const isReserve = reservePlayer && reservePlayer.id === p.id
                  const isSelected = isStarter || isReserve
                  const disabled = isSelected
                    ? false
                    : selectedPlayers.length >= 4 && !isReserve && !isStarter

                  return (
                    <div
                      key={p.id}
                      className="grid grid-cols-12 items-center px-3 py-2 text-[13px]"
                      style={{
                        backgroundColor: isSelected
                          ? 'var(--color-xama-surface-subtle)'
                          : 'var(--color-xama-background)',
                        color: 'var(--color-xama-foreground)',
                        opacity: disabled ? 0.55 : 1,
                      }}
                    >
                      <div className="col-span-3 flex flex-col">
                        <span className="font-medium">
                          {formatPlayerName(p.name)}
                          {captainId === p.id && (
                            <span style={{ color: 'var(--color-xama-accent)' }}> (C)</span>
                          )}
                        </span>
                        <span className="text-[11px]" style={{ color: 'var(--color-xama-muted)' }}>
                          {formatTeamTag(p.name, p.team)}
                        </span>
                      </div>
                      <div className="col-span-1 text-right">
                        {p.fantasy_cost != null ? p.fantasy_cost.toFixed(2) : '—'}
                      </div>
                      <div className="col-span-1 text-right">
                        {p.avg_kills_50 != null ? p.avg_kills_50.toFixed(1) : '—'}
                      </div>
                      <div className="col-span-1 text-right">
                        {p.avg_damage_50 != null ? p.avg_damage_50.toFixed(0) : '—'}
                      </div>
                      <div className="col-span-1 text-right">
                        <span style={{ color: placementColorHex(p.avg_placement_50) }}>
                          {p.avg_placement_50 != null ? p.avg_placement_50.toFixed(1) : '—'}
                        </span>
                      </div>
                      <div className="col-span-1 text-right">
                        {p.avg_survival_50 != null ? fmtMin(p.avg_survival_50) : '—'}
                      </div>
                      <div className="col-span-1 text-right">
                        {p.pts_per_game != null ? p.pts_per_game.toFixed(2) : '—'}
                      </div>
                      <div className="col-span-1 text-right">
                        <button
                          type="button"
                          onClick={() => toggleStarter(p)}
                          disabled={disabled && !isStarter}
                          className="px-2 py-1 text-[11px] rounded border"
                          style={{
                            borderColor: isStarter
                              ? 'var(--color-xama-accent)'
                              : 'var(--color-xama-border-subtle)',
                            color: isStarter
                              ? 'var(--color-xama-accent)'
                              : 'var(--color-xama-foreground)',
                            backgroundColor: 'transparent',
                          }}
                        >
                          {isStarter ? 'Remover' : 'Titular'}
                        </button>
                      </div>
                      <div className="col-span-2 text-right">
                        <button
                          type="button"
                          onClick={() => toggleReserve(p)}
                          disabled={isStarter}
                          className="px-2 py-1 text-[11px] rounded border"
                          style={{
                            borderColor: isReserve
                              ? 'var(--color-xama-              <span
                className="font-semibold"
                style={{
                  color:
                    budgetRemaining < 0
                      ? 'var(--color-xama-danger)'
                      : 'var(--color-xama-foreground)',
                }}
              >
                {budgetRemaining.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between mb-2 text-[13px]">
              <span style={{ color: 'var(--color-xama-muted)' }}>Custo total</span>
              <span style={{ color: 'var(--color-xama-foreground)' }}>
                {totalCost.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span style={{ color: 'var(--color-xama-muted)' }}>Limite de budget</span>
              <span style={{ color: 'var(--color-xama-foreground)' }}>
                {budgetLimit.toFixed(2)}
              </span>
            </div>
          </div>

          <div
            className="border rounded p-3 mb-4"
            style={{ borderColor: 'var(--color-xama-border-subtle)' }}
          >
            <div className="mb-2 text-[13px]" style={{ color: 'var(--color-xama-muted)' }}>
              Titulares
            </div>
            {selectedPlayers.length === 0 && (
              <div className="text-[13px]" style={{ color: 'var(--color-xama-muted)' }}>
                Nenhum jogador adicionado.
              </div>
            )}
            {selectedPlayers.map((p, idx) => (
              <div
                key={p.id}
                className="flex items-center justify-between mb-1 text-[13px]"
                style={{ color: 'var(--color-xama-foreground)' }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[11px]" style={{ color: 'var(--color-xama-muted)' }}>
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <span className="font-medium">
                    {formatPlayerName(p.name)}
                    {captainId === p.id && (
                      <span style={{ color: 'var(--color-xama-accent)' }}> (C)</span>
                    )}
                  </span>
                  <span className="text-[11px]" style={{ color: 'var(--color-xama-muted)' }}>
                    {formatTeamTag(p.name, p.team)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCaptainId(p.id)}
                    className="px-2 py-0.5 text-[11px] rounded border"
                    style={{
                      borderColor:
                        captainId === p.id
                          ? 'var(--color-xama-accent)'
                          : 'var(--color-xama-border-subtle)',
                      color:
                        captainId === p.id
                          ? 'var(--color-xama-accent)'
                          : 'var(--color-xama-foreground)',
                      backgroundColor: 'transparent',
                    }}
                  >
                    C
                  </button>
                  <span className="text-[12px]">
                    {p.fantasy_cost != null ? p.fantasy_cost.toFixed(2) : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div
            className="border rounded p-3 mb-4"
            style={{ borderColor: 'var(--color-xama-border-subtle)' }}
          >
            <div className="mb-2 text-[13px]" style={{ color: 'var(--color-xama-muted)' }}>
              Reserva
            </div>
            {!reservePlayer && (
              <div className="text-[13px]" style={{ color: 'var(--color-xama-muted)' }}>
                Nenhum reserva selecionado.
              </div>
            )}
            {reservePlayer && (
              <div
                className="flex items-center justify-between text-[13px]"
                style={{ color: 'var(--color-xama-foreground)' }}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{formatPlayerName(reservePlayer.name)}</span>
                  <span className="text-[11px]" style={{ color: 'var(--color-xama-muted)' }}>
                    {formatTeamTag(reservePlayer.name, reservePlayer.team)}
                  </span>
                </div>
                <span className="text-[12px]">
                  {reservePlayer.fantasy_cost != null
                    ? reservePlayer.fantasy_cost.toFixed(2)
                    : '—'}
                </span>
              </div>
            )}
          </div>

          <div
            className="border rounded p-3 mb-4"
            style={{ borderColor: 'var(--color-xama-border-subtle)' }}
          >
            <div className="mb-2 text-[13px]" style={{ color: 'var(--color-xama-muted)' }}>
              Dados do lineup
            </div>

            <div className="mb-2">
              <label className="block text-[12px] mb-1" style={{ color: 'var(--color-xama-muted)' }}>
                Seu nick (login)
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 border rounded bg-transparent text-[13px]"
                style={{
                  borderColor: 'var(--color-xama-border-subtle)',
                  color: 'var(--color-xama-foreground)',
                }}
                placeholder="Seu nick in-game ou identificador"
              />
            </div>

            <div className="text-[11px]" style={{ color: 'var(--color-xama-muted)' }}>
              Necessário: 4 titulares · 1 reserva · capitão · login · total ≤ budget
            </div>
          </div>

          {saveError && (
            <div
              className="mb-3 text-[13px]"
              style={{ color: 'var(--color-xama-danger)' }}
            >
              {saveError}
            </div>
          )}

          {saveSuccess && (
            <div
              className="mb-3 text-[13px]"
              style={{ color: 'var(--color-xama-success)' }}
            >
              {saveSuccess}
            </div>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || saveLoading}
            className="w-full py-2.5 text-[14px] font-semibold rounded"
            style={{
              backgroundColor: canSave
                ? 'var(--color-xama-accent)'
                : 'var(--color-xama-surface-subtle)',
              color: canSave ? '#020817' : 'var(--color-xama-muted)',
              cursor: canSave ? 'pointer' : 'not-allowed',
            }}
          >
            {saveLoading ? 'Salvando...' : 'Salvar lineup'}
          </button>
        </div>
      </div>
    </div>
  )
}
