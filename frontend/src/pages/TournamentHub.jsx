// frontend/src/pages/TournamentHub.jsx
import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { API_BASE_URL } from '../config'
import TournamentLayout from '../components/TournamentLayout'
import LineupBuilder from '../components/LineupBuilder'
import TournamentLeaderboard from '../components/TournamentLeaderboard'
import PlayerStatsPage from '../components/PlayerStatsPage'

const TAB_LINEUP      = 'lineup'
const TAB_LEADERBOARD = 'leaderboard'
const TAB_STATS       = 'stats'

const ALL_TABS = [
  { id: TAB_LINEUP,      label: 'Montar Lineup', icon: '⚔️' },
  { id: TAB_LEADERBOARD, label: 'Leaderboard',   icon: '🏆' },
  { id: TAB_STATS,       label: 'Stats',          icon: '📊' },
]

export default function TournamentHub() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { token, setToken } = useAuth()

  // ── Estado principal ──────────────────────────────────────────────
  const [tab,                  setTab]                  = useState(TAB_LINEUP)
  const [tournament,           setTournament]           = useState(null)
  const [tournaments,          setTournaments]          = useState([])
  const [tournamentsLoading,   setTournamentsLoading]   = useState(true)
  const [championships,        setChampionships]        = useState([])
  const [championshipsLoading, setChampionshipsLoading] = useState(true)
  const [myRank,               setMyRank]               = useState(null)
  const [localChampId,         setLocalChampId]         = useState(null)

  // ── Usuário (para buscar ranking) ─────────────────────────────────
  const [userId, setUserId] = useState(null)
  useEffect(() => {
    if (!token) return
    fetch(`${API_BASE_URL}/users/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(u => { if (u) setUserId(u.id) })
      .catch(() => {})
  }, [token])

  // ── Torneios + campeonatos ────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE_URL}/tournaments/?skip=0&limit=50`).then(r => r.json()),
      fetch(`${API_BASE_URL}/championship-phases/`).then(r => r.json()),
    ])
      .then(([tournsData, champsData]) => {
        const list  = Array.isArray(tournsData) ? tournsData : []
        const champs = Array.isArray(champsData) ? champsData : []
        setTournaments(list)
        setChampionships(champs)
        setTournament(list.find(t => String(t.id) === String(id)) || null)
        setTournamentsLoading(false)
        setChampionshipsLoading(false)
      })
      .catch(() => { setTournamentsLoading(false); setChampionshipsLoading(false) })
  }, [id])

  // ── Ranking do usuário (para o header) ───────────────────────────
  useEffect(() => {
    if (!userId || !id) return
    fetch(`${API_BASE_URL}/tournaments/${id}/rankings`)
      .then(r => r.json())
      .then(rank => {
        const entry = rank.find(e => e.user_id === userId)
        if (entry) setMyRank(entry)
      })
      .catch(() => {})
  }, [userId, id])

  // ── Campeonato da URL ─────────────────────────────────────────────
  const urlChampId = useMemo(
    () => championships.find(c => c.phases.some(p => p.tournament_id === Number(id)))?.id ?? null,
    [championships, id]
  )
  useEffect(() => { if (urlChampId !== null) setLocalChampId(urlChampId) }, [urlChampId])
  const selectedChampId = localChampId ?? urlChampId

  // ── Dados derivados para o header ─────────────────────────────────
  const championship = championships.find(c => c.phases.some(p => p.tournament_id === Number(id)))
  const phase        = championship?.phases.find(p => p.tournament_id === Number(id))
  const phaseLabel   = phase?.phase ?? null

  // ── Tabs (Lineup oculta quando torneio finalizado) ────────────────
  const isFinished = tournament?.status === 'finished'
  const TABS       = isFinished ? ALL_TABS.filter(t => t.id !== TAB_LINEUP) : ALL_TABS
  const activeTab  = TABS.find(t => t.id === tab) ? tab : TABS[0]?.id ?? TAB_LEADERBOARD

  useEffect(() => {
    if (isFinished) setTab(TAB_LEADERBOARD)
  }, [isFinished])

  // ── Handlers ─────────────────────────────────────────────────────
  const handleChampChange      = (champId) => setLocalChampId(champId)
  const handleTournamentChange = (newId)   => { if (newId) navigate(`/tournament/${newId}`) }

  // Props compartilhadas entre os componentes filhos
  const sharedProps = {
    tournaments,
    tournamentsLoading,
    selectedTournamentId: String(id),
    onTournamentChange: handleTournamentChange,
    championships,
    championshipsLoading,
    selectedChampId,
    onChampChange: handleChampChange,
  }

  return (
    <TournamentLayout
      tournament={tournament}
      championship={championship}
      phaseLabel={phaseLabel}
      myRank={myRank}
      tabs={TABS}
      activeTab={activeTab}
      onTabChange={setTab}
    >
      {activeTab === TAB_LINEUP && (
        <LineupBuilder
          token={token}
          setToken={setToken}
          tournamentsError=""
          {...sharedProps}
        />
      )}
      {activeTab === TAB_LEADERBOARD && (
        <TournamentLeaderboard
          token={token}
          {...sharedProps}
        />
      )}
      {activeTab === TAB_STATS && (
        <PlayerStatsPage
          token={token}
          {...sharedProps}
        />
      )}
    </TournamentLayout>
  )
}
