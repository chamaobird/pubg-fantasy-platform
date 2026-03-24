// frontend/src/components/LineupBuilder.jsx
// XAMA Fantasy — Lineup Builder
// Tailwind v4 + tema XAMA

import { useEffect, useMemo, useState } from 'react'
import { API_BASE_URL } from '../config'
import ChampionshipSelector from './ChampionshipSelector'

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

// ── Section title ──────────────────────────────────────────────────────────
function SectionTitle({ step, label }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      {step && (
        <span className="flex items-center justify-center rounded text-[10px] font-bold w-5 h-5"
          style={{ background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.3)', color: 'var(--color-xama-orange)', fontFamily: "'JetBrains Mono', monospace" }}>
          {step}
        </span>
      )}
      <span className="text-[10px] font-bold tracking-[0.1em] uppercase"
        style={{ color: 'var(--color-xama-muted)', fontFamily: "'Rajdhani', sans-serif" }}>
        {label}
      </span>
    </div>
  )
}

// ── Card wrapper ───────────────────────────────────────────────────────────
function Card({ children, className = '' }) {
  return (
    <div className={`rounded-xl p-5 mb-4 last:mb-0 ${className}`}
      style={{ background: 'var(--color-xama-surface)', border: '1px solid var(--color-xama-border)' }}>
      {children}
    </div>
  )
}

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

  // true quando o torneio selecionado tem lineup_open=false
  const isLocked = selectedTournament ? !selectedTournament.lineup_open : false

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
    setSaveError(''); setSaveSuccess(null)
    return () => { mounted = false }
  }, [selectedTournamentId])

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
          name: 'Lineup criado via frontend',
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

  const SortIcon = ({ col }) => {
    if (sortKey !== col) return <span className="ml-0.5 opacity-25 text-[9px]">&#8645;</span>
    return <span className="ml-0.5 text-[9px]" style={{ color: 'var(--color-xama-orange)' }}>{sortDir === 'desc' ? '▼' : '▲'}</span>
  }

  const thStyle = (col) => ({
    cursor: 'pointer', userSelect: 'none',
    color: sortKey === col ? 'var(--color-xama-orange)' : 'var(--color-xama-muted)',
    fontFamily: "'Rajdhani', sans-serif",
    transition: 'color 0.15s',
  })

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
    <div className="min-h-screen py-6 px-4"
      style={{ background: 'var(--color-xama-black)', fontFamily: "'Rajdhani', sans-serif" }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        {/* Login / Register */}
        {!token && (
          <Card className="mb-4">
            <div className="flex gap-1 mb-4 p-1 rounded-lg" style={{ background: '#0a0c11', width: 'fit-content' }}>
              {['login', 'register'].map((mode) => (
                <button key={mode}
                  onClick={() => { setAuthMode(mode); setLoginError(''); setRegisterError(''); setRegisterSuccess('') }}
                  className="px-4 py-1.5 rounded text-[12px] font-bold tracking-[0.06em] uppercase transition-all duration-150"
                  style={{
                    fontFamily: "'Rajdhani', sans-serif",
                    background: authMode === mode ? 'var(--color-xama-surface)' : 'none',
                    color: authMode === mode ? 'var(--color-xama-orange)' : 'var(--color-xama-muted)',
                    border: authMode === mode ? '1px solid var(--color-xama-border)' : '1px solid transparent',
                    cursor: 'pointer',
                  }}>
                  {mode === 'login' ? 'Login' : 'Cadastro'}
                </button>
              ))}
            </div>
            {authMode === 'login' && (
              <>
                <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: '1fr 1fr auto' }}>
                  <input className="dark-input" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="E-mail" style={{ fontFamily: "'Rajdhani', sans-serif" }} />
                  <input className="dark-input" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="Senha" style={{ fontFamily: "'Rajdhani', sans-serif" }} />
                  <button className="dark-btn" onClick={doLogin} disabled={loginLoading} style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600 }}>
                    {loginLoading ? 'Entrando...' : 'Entrar'}
                  </button>
                </div>
                {loginError && <div className="msg-error">{loginError}</div>}
              </>
            )}
            {authMode === 'register' && (
              <>
                <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: '1fr 1fr 1fr auto' }}>
                  <input className="dark-input" value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} placeholder="E-mail" style={{ fontFamily: "'Rajdhani', sans-serif" }} />
                  <input className="dark-input" value={registerUsername} onChange={(e) => setRegisterUsername(e.target.value)} placeholder="Username" style={{ fontFamily: "'Rajdhani', sans-serif" }} />
                  <input className="dark-input" type="password" value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} placeholder="Senha" style={{ fontFamily: "'Rajdhani', sans-serif" }} />
                  <button className="dark-btn" onClick={doRegister} disabled={registerLoading} style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600 }}>
                    {registerLoading ? 'Criando...' : 'Criar conta'}
                  </button>
                </div>
                {registerError   && <div className="msg-error">{registerError}</div>}
                {registerSuccess && <div className="msg-success">{registerSuccess}</div>}
              </>
            )}
          </Card>
        )}

        {/* Two-column layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.4fr', gap: '16px' }}
             className="max-md:block">

          {/* Left column */}
          <div>
            {/* Tournament + budget */}
            <Card>
              <SectionTitle step="1" label="Torneio" />
              {tournamentsLoading && <span className="text-[13px]" style={{ color: 'var(--color-xama-muted)' }}>Carregando...</span>}
              {tournamentsError   && <div className="msg-error">{tournamentsError}</div>}
              {!tournamentsLoading && !tournamentsError && (
                <>
                  {championships.length === 0 && tournaments.length === 0 ? (
                    <div className="py-4 px-3 rounded-lg text-[13px]"
                      style={{ background: '#0a0c11', border: '1px solid var(--color-xama-border)', color: 'var(--color-xama-muted)' }}>
                      Nenhum torneio disponível no momento.
                    </div>
                  ) : championships.length > 0 ? (
                    <div className="mb-3">
                      <ChampionshipSelector
                        championships={championships}
                        loading={championshipsLoading}
                        selectedChampId={selectedChampId ? Number(selectedChampId) : null}
                        onChampChange={onChampChange}
                        selectedTournId={selectedTournamentId ? Number(selectedTournamentId) : null}
                        onTournChange={(tid) => onTournamentChange?.(tid)}
                        tournaments={tournaments}
                        allowAggregated={false}
                      />
                    </div>
                  ) : (
                    <select className="dark-select mb-3" value={selectedTournamentId}
                      onChange={(e) => onTournamentChange?.(e.target.value)}
                      style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                      {tournaments.map((t) => (
                        <option key={t.id} value={String(t.id)}>
                          {t.name}{t.region ? ` (${t.region})` : ''}{!t.lineup_open ? ' 🔒' : ''}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Banner LOCKED: aparece quando o torneio selecionado está fechado */}
                  {isLocked && (
                    <div className="flex items-center gap-3 mb-3 px-4 py-3 rounded-lg"
                      style={{
                        background: 'rgba(239,68,68,0.07)',
                        border: '1px solid rgba(239,68,68,0.25)',
                      }}>
                      <span style={{ fontSize: 20, lineHeight: 1 }}>🔒</span>
                      <div>
                        <p className="text-[13px] font-bold tracking-[0.04em] uppercase"
                          style={{ color: '#f87171', fontFamily: "'Rajdhani', sans-serif", marginBottom: 2 }}>
                          Lineup Fechado
                        </p>
                        <p className="text-[11px]" style={{ color: 'var(--color-xama-muted)' }}>
                          As submissões encerraram quando o primeiro match foi importado.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Hint quando há torneios abertos mas nenhum está selecionado */}
                  {openTournaments.length === 0 && !isLocked && (
                    <div className="py-3 px-3 rounded-lg text-[12px] mb-3"
                      style={{ background: '#0a0c11', border: '1px solid var(--color-xama-border)', color: 'var(--color-xama-muted)' }}>
                      Nenhum torneio com lineup aberto no momento.
                    </div>
                  )}
                </>
              )}
              {/* Budget bar */}
              <div className="rounded-lg p-3" style={{ background: '#0a0c11', border: '1px solid var(--color-xama-border)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold tracking-[0.06em] uppercase" style={{ color: 'var(--color-xama-muted)', fontFamily: "'Rajdhani', sans-serif" }}>Budget</span>
                  <span className="text-[13px] font-bold tabular-nums"
                    style={{ fontFamily: "'JetBrains Mono', monospace", color: isOverBudget ? '#f87171' : 'var(--color-xama-text)' }}>
                    {totalCost.toFixed(2)} <span style={{ color: 'var(--color-xama-muted)' }}>/ {budgetLimit}</span>
                  </span>
                </div>
                <div className="rounded-full overflow-hidden" style={{ height: '4px', background: '#1e2330' }}>
                  <div className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${budgetUsedPct}%`, background: budgetBarColor }} />
                </div>
                {reservePlayer && (
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[11px]" style={{ color: 'var(--color-xama-muted)' }}>Reserva</span>
                    <span className="text-[11px] font-bold tabular-nums"
                      style={{ fontFamily: "'JetBrains Mono', monospace", color: reserveEligible ? '#4ade80' : '#f87171' }}>
                      ${reserveCost.toFixed(2)}{!reserveEligible && <span className="ml-1 text-[9px]">&#9888;</span>}
                    </span>
                  </div>
                )}
              </div>
            </Card>

            {/* Player pool */}
            <Card>
              <div className="flex items-center justify-between mb-3">
                <SectionTitle step="2" label="Jogadores do torneio" />
                {Object.keys(champStats.byId || {}).length > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded font-bold tracking-[0.06em]"
                    style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', color: '#60a5fa', fontFamily: "'Rajdhani', sans-serif" }}>
                    STATS DO CAMPEONATO
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 mb-3">
                <input className="dark-input" value={searchName} onChange={(e) => setSearchName(e.target.value)}
                  placeholder="Buscar por nome..." style={{ fontFamily: "'Rajdhani', sans-serif" }} />
                <span className="text-[11px] tabular-nums whitespace-nowrap"
                  style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-xama-muted)' }}>
                  {filteredPlayers.length}/{players.length}
                </span>
              </div>

              {playersLoading && <span className="text-[13px]" style={{ color: 'var(--color-xama-muted)' }}>Carregando jogadores...</span>}
              {playersError   && <div className="msg-error">{playersError}</div>}

              {!playersLoading && !playersError && (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-[13px]">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-xama-border)', background: '#0a0c11' }}>
                        {COLS.map(({ key, label, right }) => (
                          <th key={key}
                            className="px-3 py-2 text-[10px] font-bold tracking-[0.08em] uppercase whitespace-nowrap"
                            style={{ ...thStyle(key), textAlign: right ? 'right' : 'left' }}
                            onClick={() => handleSort(key)}>
                            {label}<SortIcon col={key} />
                          </th>
                        ))}
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {sortedPlayers.map((p) => {
                        const cs = p._cs
                        return (
                          <tr key={p.id}
                            style={{ borderBottom: '1px solid #13161f' }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#161b27'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>

                            <td className="px-3 py-2">
                              {formatTeamTag(p.name, p.team) ? (
                                <span className="text-[10px] font-bold tracking-[0.06em] px-1.5 py-0.5 rounded"
                                  style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.18)', color: 'var(--color-xama-orange)' }}>
                                  {formatTeamTag(p.name, p.team)}
                                </span>
                              ) : '—'}
                            </td>

                            <td className="px-3 py-2 font-semibold whitespace-nowrap" style={{ color: 'var(--color-xama-text)' }}>
                              {formatPlayerName(p.name)}
                            </td>

                            <td className="px-3 py-2 text-right tabular-nums font-bold"
                              style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-xama-gold)' }}>
                              ${Number(p.fantasy_cost || 0).toFixed(2)}
                            </td>

                            <td className="px-3 py-2 text-right tabular-nums"
                              style={{ fontFamily: "'JetBrains Mono', monospace", color: cs ? 'var(--color-xama-orange)' : 'var(--color-xama-muted)' }}>
                              {cs ? Number(cs.total_fantasy_points).toFixed(1) : '—'}
                            </td>

                            <td className="px-3 py-2 text-right tabular-nums"
                              style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-xama-text)' }}>
                              {cs ? cs.total_kills : '—'}
                            </td>

                            <td className="px-3 py-2 text-right tabular-nums"
                              style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-xama-text)' }}>
                              {cs ? cs.total_assists : '—'}
                            </td>

                            <td className="px-3 py-2 text-right tabular-nums"
                              style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-xama-text)' }}>
                              {cs ? fmtMin(cs.surv_total_secs) : '—'}
                            </td>

                            <td className="px-3 py-2 text-right tabular-nums"
                              style={{ fontFamily: "'JetBrains Mono', monospace", color: cs?.total_late_game_bonus > 0 ? '#4ade80' : 'var(--color-xama-muted)' }}>
                              {cs ? (cs.total_late_game_bonus > 0 ? cs.total_late_game_bonus.toFixed(0) : '0') : '—'}
                            </td>

                            <td className="px-3 py-2 text-right tabular-nums"
                              style={{ fontFamily: "'JetBrains Mono', monospace", color: cs?.total_penalty_count > 0 ? '#f87171' : 'var(--color-xama-muted)' }}>
                              {cs
                                ? cs.total_penalty_count > 0
                                  ? `${cs.total_penalty_count}(${cs.total_penalty_count * -15})`
                                  : '0'
                                : '—'}
                            </td>

                            <td className="px-3 py-2">
                              {/* Botões desabilitados quando lineup está locked */}
                              <div className="flex gap-1 justify-end">
                                <button className="dark-btn-sm"
                                  disabled={isLocked}
                                  style={{
                                    fontFamily: "'Rajdhani', sans-serif",
                                    fontWeight: 600,
                                    opacity: isLocked ? 0.35 : 1,
                                    cursor: isLocked ? 'not-allowed' : 'pointer',
                                  }}
                                  onClick={() => !isLocked && addPlayer(p)}>
                                  Titular
                                </button>
                                <button className="dark-btn-sm"
                                  disabled={isLocked}
                                  style={{
                                    fontFamily: "'Rajdhani', sans-serif",
                                    fontWeight: 600,
                                    opacity: isLocked ? 0.35 : 1,
                                    cursor: isLocked ? 'not-allowed' : 'pointer',
                                  }}
                                  onClick={() => !isLocked && setAsReserve(p)}>
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
            </Card>
          </div>

          {/* Right column */}
          <div>
            <Card>
              <SectionTitle step="3" label={`Titulares (${selectedPlayers.length}/4)`} />
              {selectedPlayers.length === 0 && (
                <p className="text-[14px] py-2" style={{ color: '#374151' }}>Nenhum jogador adicionado.</p>
              )}
              {selectedPlayers.map((p, idx) => (
                <div key={p.id} className="flex items-center gap-3 py-3"
                  style={{ borderBottom: idx < selectedPlayers.length - 1 ? '1px solid #13161f' : 'none' }}>
                  <span className="text-[11px] font-bold tabular-nums flex-shrink-0"
                    style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-xama-muted)', width: '16px' }}>
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[15px] truncate" style={{ color: 'var(--color-xama-text)' }}>
                        {formatPlayerName(p.name)}
                      </span>
                      {captainId === p.id && (
                        <span className="text-[9px] font-bold tracking-[0.06em] px-1.5 py-0.5 rounded flex-shrink-0"
                          style={{ background: 'rgba(240,192,64,0.15)', border: '1px solid rgba(240,192,64,0.3)', color: 'var(--color-xama-gold)' }}>
                          CAP 1.25x
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px]" style={{ color: 'var(--color-xama-muted)' }}>
                        {formatTeamTag(p.name, p.team)}
                      </span>
                      <span className="text-[12px] tabular-nums"
                        style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-xama-gold)' }}>
                        ${Number(p.fantasy_cost || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <label className="flex items-center gap-1 text-[11px] font-bold tracking-[0.06em] cursor-pointer flex-shrink-0"
                    style={{ color: captainId === p.id ? 'var(--color-xama-gold)' : 'var(--color-xama-muted)' }}>
                    <input type="radio" name="captain" checked={captainId === p.id} onChange={() => setCaptainId(p.id)} style={{ accentColor: '#f0c040' }} />
                    Cap
                  </label>
                  <button className="dark-btn-danger flex-shrink-0" onClick={() => removePlayer(p.id)}>x</button>
                </div>
              ))}
            </Card>

            <Card>
              <SectionTitle label="Reserva (obrigatorio)" />
              {!reservePlayer && (
                <p className="text-[14px] py-2" style={{ color: '#374151' }}>Nenhum reserva selecionado.</p>
              )}
              {reservePlayer && (
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[15px]" style={{ color: 'var(--color-xama-text)' }}>
                      {formatPlayerName(reservePlayer.name)}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px]" style={{ color: 'var(--color-xama-muted)' }}>
                        {formatTeamTag(reservePlayer.name, reservePlayer.team)}
                      </span>
                      <span className="text-[12px] tabular-nums"
                        style={{ fontFamily: "'JetBrains Mono', monospace", color: reserveEligible ? '#4ade80' : '#f87171' }}>
                        ${Number(reservePlayer.fantasy_cost || 0).toFixed(2)}
                      </span>
                      {!reserveEligible && <span className="text-[10px]" style={{ color: '#f87171' }}>mais caro que minimo</span>}
                    </div>
                  </div>
                  <button className="dark-btn-danger flex-shrink-0" onClick={removeReserve}>x</button>
                </div>
              )}
            </Card>

            <Card>
              <SectionTitle step="4" label="Salvar lineup" />

              {/* Banner LOCKED no painel de save */}
              {isLocked ? (
                <div className="w-full py-3 px-4 rounded-lg text-center"
                  style={{
                    background: 'rgba(239,68,68,0.07)',
                    border: '1px solid rgba(239,68,68,0.25)',
                  }}>
                  <p className="text-[14px] font-bold tracking-[0.06em] uppercase"
                    style={{ color: '#f87171', fontFamily: "'Rajdhani', sans-serif" }}>
                    🔒 Lineup Fechado
                  </p>
                  <p className="text-[11px] mt-1" style={{ color: 'var(--color-xama-muted)' }}>
                    Submissões encerradas para este torneio
                  </p>
                </div>
              ) : (
                <button onClick={saveLineup} disabled={!canSave || saveLoading}
                  className="w-full py-3 rounded-lg text-[15px] font-bold tracking-[0.04em] uppercase transition-all duration-150"
                  style={{
                    fontFamily: "'Rajdhani', sans-serif",
                    background: canSave && !saveLoading ? 'var(--color-xama-orange)' : '#1a1f2e',
                    color: canSave && !saveLoading ? '#0d0f14' : '#374151',
                    border: canSave && !saveLoading ? 'none' : '1px solid #2a3046',
                    cursor: canSave && !saveLoading ? 'pointer' : 'default',
                  }}>
                  {saveLoading ? 'Salvando...' : 'Salvar lineup'}
                </button>
              )}

              {!isLocked && (
                <p className="text-[12px] mt-3 leading-relaxed" style={{ color: '#374151' }}>
                  Necessario: 4 titulares · 1 reserva · capitao · login · total &le; budget
                </p>
              )}
              {saveError   && <div className="msg-error mt-3">{saveError}</div>}
              {saveSuccess && <div className="msg-success mt-3">Lineup criado! ID: <b>{saveSuccess.id}</b></div>}
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
