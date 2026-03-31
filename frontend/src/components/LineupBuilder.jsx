// frontend/src/components/LineupBuilder.jsx
// XAMA Fantasy — Lineup Builder
// Tailwind v4 + tema XAMA

import { useEffect, useMemo, useState } from 'react'
import { API_BASE_URL } from '../config'
import TeamLogo from './TeamLogo'

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
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
  })
  const contentType = res.headers.get('content-type') || ''
  const isJson = contentType.includes('application/json')
  const data = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null)
  if (!res.ok) {
    const detail = data && typeof data === 'object' && 'detail' in data ? data.detail : null
    const message = detail || `HTTP ${res.status}`
    const error = new Error(typeof message === 'string' ? message : JSON.stringify(message))
    error.status = res.status; error.data = data
    throw error
  }
  return data
}
const placementColorHex = (val) => {
  if (val == null) return '#6b7280'
  if (val <= 5)    return '#4ade80'
  if (val <= 12)   return '#facc15'
  return '#f87171'
}
const fmtMin = (secs) => secs != null ? Math.round(Number(secs) / 60) : '—'

// ── Main component ─────────────────────────────────────────────────────────
export default function LineupBuilder({
  token = '',
  setToken,
  tournaments = [],
  tournamentsLoading = false,
  tournamentsError = '',
  selectedTournamentId = '',
  onTournamentChange,
  championships = [],
  championshipsLoading = false,
  selectedChampId = null,
  onChampChange,
}) {
  const [loginEmail,    setLoginEmail]    = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginLoading,  setLoginLoading]  = useState(false)
  const [loginError,    setLoginError]    = useState('')

  const [authMode,         setAuthMode]         = useState('login')
  const [registerEmail,    setRegisterEmail]    = useState('')
  const [registerUsername, setRegisterUsername] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [registerLoading,  setRegisterLoading]  = useState(false)
  const [registerError,    setRegisterError]    = useState('')
  const [registerSuccess,  setRegisterSuccess]  = useState('')

  const [players,        setPlayers]        = useState([])
  const [playersLoading, setPlayersLoading] = useState(false)
  const [playersError,   setPlayersError]   = useState('')
  const [searchName,     setSearchName]     = useState('')

  const [champStats, setChampStats] = useState({})

  const [selectedPlayers, setSelectedPlayers] = useState([])
  const [reservePlayer,   setReservePlayer]   = useState(null)
  const [captainId,       setCaptainId]       = useState(null)

  const [saveLoading, setSaveLoading] = useState(false)
  const [saveError,   setSaveError]   = useState('')
  const [saveSuccess, setSaveSuccess] = useState(null)

  // ── Lineups já submetidas pelo usuário (multi-dia) ──────────────────────
  const [myLineups, setMyLineups] = useState([])

  const [sortKey, setSortKey] = useState('fantasy_cost')
  const [sortDir, setSortDir] = useState('desc')

  // ── Derived ────────────────────────────────────────────────────────────
  // Mostra todos os torneios no dropdown (não só os abertos),
  // o estado LOCKED é exibido via banner quando lineup_open=false
  const openTournaments = useMemo(
    () => tournaments.filter((t) => t.lineup_open),
    [tournaments]
  )

  const selectedTournament = useMemo(() => {
    const idNum = Number(selectedTournamentId)
    return tournaments.find((t) => t.id === idNum) || null
  }, [selectedTournamentId, tournaments])

  // Dia atual do torneio (1 por default)
  const currentDay = selectedTournament?.current_day ?? 1

  // Lineup já submetida para o dia atual (se houver)
  const currentDayLineup = useMemo(
    () => myLineups.find((l) => l.day === currentDay) || null,
    [myLineups, currentDay]
  )

  // true quando o torneio selecionado tem lineup_open=false OU user já submeteu para o dia atual
  const isLocked = selectedTournament
    ? !selectedTournament.lineup_open || !!currentDayLineup
    : false

  // true especificamente porque o torneio fechou (vs. user já submeteu)
  const isTournamentClosed = selectedTournament ? !selectedTournament.lineup_open : false

  const budgetLimit = useMemo(() => {
    const val = selectedTournament?.budget_limit
    const num = typeof val === 'number' ? val : val ? Number(val) : NaN
    return Number.isFinite(num) ? num : 100
  }, [selectedTournament])

  const totalCost = useMemo(
    () => selectedPlayers.reduce((acc, p) => acc + (Number(p.fantasy_cost) || 0), 0),
    [selectedPlayers],
  )
  const minStarterCost = useMemo(() => {
    if (selectedPlayers.length === 0) return Infinity
    return Math.min(...selectedPlayers.map((p) => Number(p.fantasy_cost) || 0))
  }, [selectedPlayers])

  const reserveCost     = reservePlayer ? Number(reservePlayer.fantasy_cost) || 0 : 0
  const reserveEligible = reservePlayer == null || reserveCost <= minStarterCost
  const isOverBudget    = totalCost > budgetLimit

  const playersWithStats = useMemo(() => {
    return players.map((p) => ({
      ...p,
      _cs: (champStats.byId?.[p.id] || champStats.byName?.[p.name]) ?? null
    }))
  }, [players, champStats])

  const filteredPlayers = useMemo(() => {
    const q = searchName.trim().toLowerCase()
    if (!q) return playersWithStats
    return playersWithStats.filter((p) => String(p.name || '').toLowerCase().includes(q))
  }, [playersWithStats, searchName])

  const sortedPlayers = useMemo(() => {
    return [...filteredPlayers].sort((a, b) => {
      let aVal, bVal
      if (sortKey === 'name')                       { aVal = formatPlayerName(a.name);       bVal = formatPlayerName(b.name) }
      else if (sortKey === 'team')                  { aVal = formatTeamTag(a.name, a.team);  bVal = formatTeamTag(b.name, b.team) }
      else if (sortKey === 'total_fantasy_points')  { aVal = a._cs?.total_fantasy_points;    bVal = b._cs?.total_fantasy_points }
      else if (sortKey === 'total_kills')           { aVal = a._cs?.total_kills;             bVal = b._cs?.total_kills }
      else if (sortKey === 'total_assists')         { aVal = a._cs?.total_assists;           bVal = b._cs?.total_assists }
      else if (sortKey === 'surv_total_secs')       { aVal = a._cs?.surv_total_secs;         bVal = b._cs?.surv_total_secs }
      else if (sortKey === 'total_late_game_bonus') { aVal = a._cs?.total_late_game_bonus;   bVal = b._cs?.total_late_game_bonus }
      else if (sortKey === 'total_penalty_count')   { aVal = a._cs?.total_penalty_count;     bVal = b._cs?.total_penalty_count }
      else { aVal = a[sortKey]; bVal = b[sortKey] }
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1
      if (typeof aVal === 'string') return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal
    })
  }, [filteredPlayers, sortKey, sortDir])

  // ── Effects ────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true
    if (!selectedTournamentId) { setPlayers([]); setChampStats({ byId: {}, byName: {} }); return }
    setPlayersLoading(true); setPlayersError('')

    const playersPromise = httpJson(
      `${API_BASE_URL}/tournaments/${selectedTournamentId}/players?skip=0&limit=200`,
      { method: 'GET' }
    )

    const champPromise = httpJson(`${API_BASE_URL}/championship-phases/`, { method: 'GET' })
      .then((champs) => {
        const champ = champs.find((c) =>
          c.phases.some((ph) => ph.tournament_id === Number(selectedTournamentId))
        )
        if (!champ) return {}
        return httpJson(
          `${API_BASE_URL}/championship-phases/${champ.id}/player-stats?limit=500`,
          { method: 'GET' }
        ).then((stats) => {
           const byId = {}
           const byName = {}
          stats.forEach((s) => {
            byId[s.player_id] = s
            byName[s.name] = s
          })
          return { byId, byName }
        })
      })
      .catch(() => ({}))

    Promise.all([playersPromise, champPromise])
      .then(([pData, csMap]) => {
        if (!mounted) return
        setPlayers(Array.isArray(pData) ? pData : [])
        setChampStats(csMap)
      })
      .catch((e) => { if (mounted) { setPlayersError(parseErrorMessage(e)); setPlayers([]) } })
      .finally(() => { if (mounted) setPlayersLoading(false) })

    setSelectedPlayers([]); setReservePlayer(null); setCaptainId(null)
    setSaveError(''); setSaveSuccess(null); setMyLineups([])
    return () => { mounted = false }
  }, [selectedTournamentId])

  // ── Busca lineups submetidas pelo usuário para o torneio selecionado ───
  useEffect(() => {
    if (!token || !selectedTournamentId) { setMyLineups([]); return }
    httpJson(`${API_BASE_URL}/tournaments/${selectedTournamentId}/lineups/me`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token.trim()}` },
    })
      .then((data) => setMyLineups(Array.isArray(data) ? data : []))
      .catch(() => setMyLineups([]))
  }, [token, selectedTournamentId, saveSuccess])

  // ── Actions ────────────────────────────────────────────────────────────
  async function doLogin() {
    setLoginLoading(true); setLoginError('')
    try {
      const body = new URLSearchParams({ username: loginEmail, password: loginPassword })
      const res  = await fetch(`${API_BASE_URL}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body,
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(typeof data?.detail === 'string' ? data.detail : `HTTP ${res.status}`)
      const t = data?.access_token
      if (!t) throw new Error('Resposta sem access_token')
      setToken?.(t)
    } catch (e) {
      setLoginError(parseErrorMessage(e))
    } finally {
      setLoginLoading(false)
    }
  }

  async function doRegister() {
    setRegisterLoading(true); setRegisterError(''); setRegisterSuccess('')
    try {
      if (!registerEmail.trim())    throw new Error('E-mail obrigatorio')
      if (!registerUsername.trim()) throw new Error('Username obrigatorio')
      if (!registerPassword.trim()) throw new Error('Senha obrigatoria')
      const res = await fetch(`${API_BASE_URL}/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email: registerEmail.trim(), username: registerUsername.trim(), password: registerPassword }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(typeof data?.detail === 'string' ? data.detail : `HTTP ${res.status}`)
      setRegisterSuccess('Conta criada! Faca login para continuar.')
      setRegisterEmail(''); setRegisterUsername(''); setRegisterPassword('')
      setTimeout(() => setAuthMode('login'), 1500)
    } catch (e) {
      setRegisterError(parseErrorMessage(e))
    } finally {
      setRegisterLoading(false)
    }
  }

  function addPlayer(player) {
    setSaveError(''); setSaveSuccess(null)
    if (reservePlayer?.id === player.id)                 { setSaveError('Jogador ja e reserva'); return }
    if (selectedPlayers.some((p) => p.id === player.id)) { setSaveError('Jogador ja no lineup'); return }
    if (selectedPlayers.length >= 4)                     { setSaveError('Lineup ja tem 4 jogadores'); return }
    const next = [...selectedPlayers, player]
    if (next.reduce((a, p) => a + (Number(p.fantasy_cost) || 0), 0) > budgetLimit) {
      setSaveError('Adicionar este jogador estoura o budget'); return
    }
    setSelectedPlayers(next)
    if (next.length === 1) setCaptainId(player.id)
  }

  function setAsReserve(player) {
    setSaveError(''); setSaveSuccess(null)
    if (selectedPlayers.some((p) => p.id === player.id)) { setSaveError('Reserva nao pode ser titular'); return }
    setReservePlayer(player)
    const playerCost = Number(player.fantasy_cost) || 0
    if (selectedPlayers.length > 0 && playerCost > minStarterCost) {
      setSaveError('Reserva mais caro que o titular mais barato')
    }
  }

  function removeReserve() { setSaveError(''); setSaveSuccess(null); setReservePlayer(null) }

  function removePlayer(pid) {
    setSaveError(''); setSaveSuccess(null)
    const next = selectedPlayers.filter((p) => p.id !== pid)
    setSelectedPlayers(next)
    if (captainId === pid) setCaptainId(next.length > 0 ? next[0].id : null)
  }

  async function saveLineup() {
    setSaveLoading(true); setSaveError(''); setSaveSuccess(null)
    try {
      if (!selectedTournamentId)        throw new Error('Selecione um torneio')
      if (isLocked)                     throw new Error('Lineup fechado para este torneio')
      if (selectedPlayers.length !== 4) throw new Error('Selecione exatamente 4 jogadores')
      if (!reservePlayer)               throw new Error('Selecione o reserva')
      if (!captainId)                   throw new Error('Selecione o capitao')
      if (!token.trim())                throw new Error('Faca login primeiro')
      if (totalCost > budgetLimit)      throw new Error('Total excede o budget')
      if (!reserveEligible)             throw new Error('Reserva mais caro que o titular mais barato')
      const data = await httpJson(`${API_BASE_URL}/tournaments/${selectedTournamentId}/lineups`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token.trim()}` },
        body: JSON.stringify({
          name: 'Lineup',
          player_ids: selectedPlayers.map((p) => p.id),
          captain_id: captainId,
          reserve_player_id: reservePlayer.id,
        }),
      })
      setSaveSuccess(data)
    } catch (e) {
      setSaveError(parseErrorMessage(e))
    } finally {
      setSaveLoading(false)
    }
  }

  // isLocked bloqueia o save mesmo que todos os outros campos estejam preenchidos
  const canSave = !isLocked && selectedTournamentId && selectedPlayers.length === 4 &&
    reservePlayer && captainId && token.trim() && totalCost <= budgetLimit && reserveEligible

  function handleSort(key) {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const budgetUsedPct  = Math.min((totalCost / budgetLimit) * 100, 100)
  const budgetBarColor = isOverBudget ? '#f87171' : totalCost / budgetLimit > 0.85 ? 'var(--color-xama-gold)' : 'var(--color-xama-orange)'

  const COLS = [
    { key: 'team',                  label: 'Time',      right: false },
    { key: 'name',                  label: 'Jogador',   right: false },
    { key: 'fantasy_cost',          label: 'Preco',     right: true  },
    { key: 'total_fantasy_points',  label: 'PTS XAMA',  right: true  },
    { key: 'total_kills',           label: 'K Total',   right: true  },
    { key: 'total_assists',         label: 'ASS Total', right: true  },
    { key: 'surv_total_secs',       label: 'Surv(min)', right: true  },
    { key: 'total_late_game_bonus', label: 'Late Game', right: true  },
    { key: 'total_penalty_count',   label: 'Punicao',   right: true  },
  ]

  return (
    <div className="xlb-page">
      <div className="xama-container">

        {/* ── Login / Cadastro ───────────────────────────────────────────── */}
        {!token && (
          <div className="xlb-panel" style={{ marginBottom: 20 }}>
            <div className="xlb-panel-head">
              <div className="flex gap-1 p-1 rounded-lg" style={{ background: '#0a0c11', width: 'fit-content' }}>
                {['login', 'register'].map((mode) => (
                  <button key={mode}
                    onClick={() => { setAuthMode(mode); setLoginError(''); setRegisterError(''); setRegisterSuccess('') }}
                    style={{
                      fontFamily: "'Rajdhani', sans-serif",
                      padding: '6px 16px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      background: authMode === mode ? 'var(--color-xama-surface)' : 'transparent',
                      color: authMode === mode ? 'var(--color-xama-orange)' : 'var(--color-xama-muted)',
                      border: authMode === mode ? '1px solid var(--color-xama-border)' : '1px solid transparent',
                    }}>
                    {mode === 'login' ? 'Login' : 'Cadastro'}
                  </button>
                ))}
              </div>
            </div>
            <div className="xlb-panel-body">
              {authMode === 'login' && (
                <>
                  <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr auto' }}>
                    <input className="dark-input" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="E-mail" style={{ fontFamily: "'Rajdhani', sans-serif" }} />
                    <input className="dark-input" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="Senha" style={{ fontFamily: "'Rajdhani', sans-serif" }} onKeyDown={(e) => e.key === 'Enter' && doLogin()} />
                    <button className="dark-btn" onClick={doLogin} disabled={loginLoading} style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600 }}>
                      {loginLoading ? 'Entrando...' : 'Entrar'}
                    </button>
                  </div>
                  {loginError && <div className="msg-error" style={{ marginTop: 10 }}>{loginError}</div>}
                </>
              )}
              {authMode === 'register' && (
                <>
                  <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr 1fr auto' }}>
                    <input className="dark-input" value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} placeholder="E-mail" style={{ fontFamily: "'Rajdhani', sans-serif" }} />
                    <input className="dark-input" value={registerUsername} onChange={(e) => setRegisterUsername(e.target.value)} placeholder="Username" style={{ fontFamily: "'Rajdhani', sans-serif" }} />
                    <input className="dark-input" type="password" value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} placeholder="Senha" style={{ fontFamily: "'Rajdhani', sans-serif" }} />
                    <button className="dark-btn" onClick={doRegister} disabled={registerLoading} style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600 }}>
                      {registerLoading ? 'Criando...' : 'Criar conta'}
                    </button>
                  </div>
                  {registerError   && <div className="msg-error"   style={{ marginTop: 10 }}>{registerError}</div>}
                  {registerSuccess && <div className="msg-success" style={{ marginTop: 10 }}>{registerSuccess}</div>}
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Banner de dia de competição (quando multi-dia) ─────────────── */}
        {selectedTournament && selectedTournament.lineup_open && (
          <div style={{
            marginBottom: 16, padding: '10px 16px', borderRadius: 8,
            background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>📅</span>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, letterSpacing: '0.05em', color: '#60a5fa', fontFamily: "'Rajdhani', sans-serif" }}>
                Dia {currentDay} — Lineup Aberta
              </p>
              {myLineups.length > 0 && (
                <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--color-xama-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                  Submetidas: {myLineups.map((l) => `Dia ${l.day}`).join(' · ')}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Banner lineup fechado ──────────────────────────────────────── */}
        {isTournamentClosed && (
          <div className="xlb-locked" style={{ marginBottom: 20 }}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>🔒</span>
            <div>
              <p className="xlb-locked-title">Lineup Fechado</p>
              <p className="xlb-locked-sub">As submissões encerraram quando o primeiro match foi importado.</p>
            </div>
          </div>
        )}

        {/* ── Banner lineup já submetida para o dia atual ─────────────────── */}
        {!isTournamentClosed && currentDayLineup && (
          <div className="xlb-locked" style={{ marginBottom: 20, background: 'rgba(34,197,94,0.05)', borderColor: 'rgba(34,197,94,0.2)' }}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>✅</span>
            <div>
              <p className="xlb-locked-title" style={{ color: '#4ade80' }}>Lineup Dia {currentDay} Submetida</p>
              <p className="xlb-locked-sub">
                Sua lineup foi salva para o Dia {currentDay}.
                {myLineups.length > 1
                  ? ` Você tem lineups nos dias: ${myLineups.map((l) => l.day).join(', ')}.`
                  : ' Aguarde a abertura do próximo dia.'
                }
              </p>
            </div>
          </div>
        )}

        {/* ── Grid principal ────────────────────────────────────────────── */}
        <div className="xlb-grid">

          {/* ── Coluna esquerda: pool de jogadores ── */}
          <div className="xlb-panel">

            {/* Barra de busca */}
            <div className="xlb-search-row">
              <input
                className="xlb-search-input"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                placeholder="Buscar jogador..."
              />
              <span className="xlb-count">{filteredPlayers.length}/{players.length}</span>
              {Object.keys(champStats.byId || {}).length > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                  padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap', flexShrink: 0,
                  background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', color: '#60a5fa',
                  fontFamily: "'Rajdhani', sans-serif",
                }}>
                  STATS CAMP.
                </span>
              )}
            </div>

            {/* Estados de carregamento */}
            {playersLoading && <p className="xama-loading" style={{ padding: '24px 18px' }}>Carregando jogadores...</p>}
            {playersError   && <p className="xama-error"   style={{ padding: '16px 18px' }}>{playersError}</p>}

            {/* Tabela de jogadores */}
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
                    {sortedPlayers.map((p) => {
                      const cs = p._cs
                      return (
                        <tr key={p.id}>
                          <td>
                            <div className="flex items-center gap-1.5">
                              <TeamLogo teamName={formatTeamTag(p.name, p.team)} size={20} />
                              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--color-xama-muted)' }}>
                                {formatTeamTag(p.name, p.team) || '—'}
                              </span>
                            </div>
                          </td>
                          <td className="font-semibold whitespace-nowrap" style={{ color: 'var(--color-xama-text)' }}>
                            {formatPlayerName(p.name)}
                          </td>
                          <td className="right tabular-nums font-bold"
                            style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-xama-gold)' }}>
                            ${Number(p.fantasy_cost || 0).toFixed(2)}
                          </td>
                          <td className="right tabular-nums"
                            style={{ fontFamily: "'JetBrains Mono', monospace", color: cs ? 'var(--color-xama-orange)' : 'var(--color-xama-muted)' }}>
                            {cs ? Number(cs.total_fantasy_points).toFixed(1) : '—'}
                          </td>
                          <td className="right tabular-nums"
                            style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-xama-text)' }}>
                            {cs ? cs.total_kills : '—'}
                          </td>
                          <td className="right tabular-nums"
                            style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-xama-text)' }}>
                            {cs ? cs.total_assists : '—'}
                          </td>
                          <td className="right tabular-nums"
                            style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-xama-text)' }}>
                            {cs ? fmtMin(cs.surv_total_secs) : '—'}
                          </td>
                          <td className="right tabular-nums"
                            style={{ fontFamily: "'JetBrains Mono', monospace", color: cs?.total_late_game_bonus > 0 ? '#4ade80' : 'var(--color-xama-muted)' }}>
                            {cs ? (cs.total_late_game_bonus > 0 ? cs.total_late_game_bonus.toFixed(0) : '0') : '—'}
                          </td>
                          <td className="right tabular-nums"
                            style={{ fontFamily: "'JetBrains Mono', monospace", color: cs?.total_penalty_count > 0 ? '#f87171' : 'var(--color-xama-muted)' }}>
                            {cs
                              ? cs.total_penalty_count > 0
                                ? `${cs.total_penalty_count}(${cs.total_penalty_count * -15})`
                                : '0'
                              : '—'}
                          </td>
                          <td>
                            <div className="flex gap-1 justify-end">
                              <button className="xlb-action-btn" disabled={isLocked} onClick={() => !isLocked && addPlayer(p)}>
                                Titular
                              </button>
                              <button className="xlb-action-btn" disabled={isLocked} onClick={() => !isLocked && setAsReserve(p)}>
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
          </div>

          {/* ── Coluna direita: painel sticky ── */}
          <div style={{ position: 'sticky', top: 24, alignSelf: 'start' }}>
            <div className="xlb-panel">

              {/* Cabeçalho do painel */}
              <div className="xlb-panel-head">
                <p className="xlb-panel-title">
                  Meu Lineup
                  {selectedTournament?.lineup_open && (
                    <span style={{
                      marginLeft: 8, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                      padding: '2px 8px', borderRadius: 4, background: 'rgba(96,165,250,0.12)',
                      border: '1px solid rgba(96,165,250,0.3)', color: '#60a5fa',
                      fontFamily: "'Rajdhani', sans-serif",
                    }}>
                      DIA {currentDay}
                    </span>
                  )}
                </p>
              </div>

              {/* Budget bar */}
              <div className="xlb-budget">
                <p className="xlb-budget-label">Budget</p>
                <div className="xlb-budget-bar-track">
                  <div className="xlb-budget-bar-fill" style={{ width: `${budgetUsedPct}%`, background: budgetBarColor }} />
                </div>
                <div className="xlb-budget-stats">
                  <div className="xlb-budget-stat">
                    <p className="xlb-budget-stat-label">Total</p>
                    <p className="xlb-budget-stat-value">{budgetLimit}</p>
                  </div>
                  <div className="xlb-budget-stat">
                    <p className="xlb-budget-stat-label">Usado</p>
                    <p className={`xlb-budget-stat-value ${isOverBudget ? 'danger' : totalCost / budgetLimit > 0.85 ? 'warn' : ''}`}>
                      {totalCost.toFixed(2)}
                    </p>
                  </div>
                  <div className="xlb-budget-stat">
                    <p className="xlb-budget-stat-label">Restante</p>
                    <p className={`xlb-budget-stat-value ${isOverBudget ? 'danger' : 'ok'}`}>
                      {(budgetLimit - totalCost).toFixed(2)}
                    </p>
                  </div>
                </div>
                {reservePlayer && (
                  <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: '1px solid var(--color-xama-border)' }}>
                    <span style={{ fontSize: 11, color: 'var(--color-xama-muted)' }}>Reserva</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontVariantNumeric: 'tabular-nums', color: reserveEligible ? '#4ade80' : '#f87171' }}>
                      ${reserveCost.toFixed(2)}{!reserveEligible && ' ⚠'}
                    </span>
                  </div>
                )}
              </div>

              {/* Slots de titulares × 4 */}
              {Array.from({ length: 4 }).map((_, idx) => {
                const p = selectedPlayers[idx]
                if (!p) {
                  return (
                    <div key={`empty-${idx}`} className="xlb-slot">
                      <span className="xlb-slot-num">{idx + 1}</span>
                      <span className="xlb-slot-empty">— vazio —</span>
                    </div>
                  )
                }
                const isCap = captainId === p.id
                return (
                  <div key={p.id} className="xlb-slot">
                    <span className="xlb-slot-num">{idx + 1}</span>
                    <div className="xlb-slot-info">
                      <div className="xlb-slot-name">
                        {formatPlayerName(p.name)}
                        {isCap && <span className="xlb-captain-badge" style={{ marginLeft: 6 }}>CAP 1.25×</span>}
                      </div>
                      <div className="xlb-slot-meta">
                        <TeamLogo teamName={formatTeamTag(p.name, p.team)} size={14} />
                        <span>{formatTeamTag(p.name, p.team)}</span>
                        <span className="xlb-slot-cost">${Number(p.fantasy_cost || 0).toFixed(2)}</span>
                      </div>
                    </div>
                    <button
                      className={`xlb-captain-btn${isCap ? ' active' : ''}`}
                      onClick={() => setCaptainId(p.id)}
                      title="Definir como capitão">
                      ♛
                    </button>
                    <button className="xlb-remove-btn" onClick={() => removePlayer(p.id)} title="Remover">×</button>
                  </div>
                )
              })}

              {/* Divisor + slot de reserva */}
              <div style={{ borderTop: '2px solid var(--color-xama-border)' }} />

              {reservePlayer ? (
                <div className="xlb-slot">
                  <span className="xlb-slot-num" style={{ fontSize: 9, fontStyle: 'italic', color: '#4b5563' }}>RES</span>
                  <div className="xlb-slot-info">
                    <div className="xlb-slot-name">{formatPlayerName(reservePlayer.name)}</div>
                    <div className="xlb-slot-meta">
                      <TeamLogo teamName={formatTeamTag(reservePlayer.name, reservePlayer.team)} size={14} />
                      <span>{formatTeamTag(reservePlayer.name, reservePlayer.team)}</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', fontSize: 11, color: reserveEligible ? '#4ade80' : '#f87171' }}>
                        ${Number(reservePlayer.fantasy_cost || 0).toFixed(2)}
                        {!reserveEligible && ' ⚠'}
                      </span>
                    </div>
                  </div>
                  <button className="xlb-remove-btn" onClick={removeReserve} title="Remover reserva">×</button>
                </div>
              ) : (
                <div className="xlb-slot">
                  <span className="xlb-slot-num" style={{ fontSize: 9, fontStyle: 'italic', color: '#4b5563' }}>RES</span>
                  <span className="xlb-slot-empty">— reserva —</span>
                </div>
              )}

              {/* Salvar lineup */}
              <div className="xlb-panel-body" style={{ borderTop: '1px solid var(--color-xama-border)' }}>
                {isTournamentClosed ? (
                  <div className="xlb-locked" style={{ margin: 0 }}>
                    <span style={{ fontSize: 16 }}>🔒</span>
                    <div>
                      <p className="xlb-locked-title">Lineup Fechado</p>
                      <p className="xlb-locked-sub">Submissões encerradas para este torneio</p>
                    </div>
                  </div>
                ) : currentDayLineup ? (
                  <div className="xlb-locked" style={{ margin: 0, background: 'rgba(34,197,94,0.05)', borderColor: 'rgba(34,197,94,0.2)' }}>
                    <span style={{ fontSize: 16 }}>✅</span>
                    <div>
                      <p className="xlb-locked-title" style={{ color: '#4ade80' }}>Dia {currentDay} concluído</p>
                      <p className="xlb-locked-sub">Aguarde a abertura do próximo dia</p>
                    </div>
                  </div>
                ) : (
                  <button
                    className={`xlb-save-btn ${saveLoading ? 'loading' : canSave ? 'ready' : 'idle'}`}
                    onClick={saveLineup}
                    disabled={!canSave || saveLoading}>
                    {saveLoading ? 'Salvando...' : `SALVAR LINEUP — DIA ${currentDay}`}
                  </button>
                )}

                {saveError   && <div className="msg-error"   style={{ marginTop: 10 }}>{saveError}</div>}
                {saveSuccess && <div className="msg-success" style={{ marginTop: 10 }}>Lineup Dia {currentDay} salva com sucesso!</div>}

              </div>{/* fim xlb-panel-body (save) */}
            </div>{/* fim xlb-panel (direito) */}
          </div>{/* fim sticky wrapper */}
        </div>{/* fim xlb-grid */}
      </div>{/* fim xama-container */}
    </div>
  )
}