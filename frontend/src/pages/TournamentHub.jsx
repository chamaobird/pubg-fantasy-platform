// frontend/src/pages/TournamentHub.jsx
import { useEffect, useState } from 'react'
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
  const { id } = useParams()          // stage_id na nova arquitetura
  const navigate = useNavigate()
  const { token, setToken } = useAuth()

  const [tab,   setTab]   = useState(TAB_LINEUP)
  const [stage, setStage] = useState(null)
  const [myRank, setMyRank] = useState(null)
  const [userId, setUserId] = useState(null)

  // ── Usuário ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return
    fetch(`${API_BASE_URL}/users/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(u => { if (u) setUserId(u.id) })
      .catch(() => {})
  }, [token])

  // ── Stage ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return
    fetch(`${API_BASE_URL}/stages/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(setStage)
      .catch(() => {})
  }, [id])

  // ── Tabs (oculta Lineup quando stage não está open) ────────────────────
  const isFinished = stage ? (stage.lineup_status === 'locked' || !stage.is_active) : false
  const TABS       = isFinished ? ALL_TABS.filter(t => t.id !== TAB_LINEUP) : ALL_TABS
  const activeTab  = TABS.find(t => t.id === tab) ? tab : TABS[0]?.id ?? TAB_LEADERBOARD

  useEffect(() => {
    if (isFinished) setTab(TAB_LEADERBOARD)
  }, [isFinished])

  // Props legadas passadas para componentes que ainda usam o schema antigo
  // (Leaderboard e Stats serão migrados em tarefas futuras)
  const legacySharedProps = {
    tournaments: [],
    tournamentsLoading: false,
    selectedTournamentId: String(id),
    onTournamentChange: (newId) => { if (newId) navigate(`/tournament/${newId}`) },
    championships: [],
    championshipsLoading: false,
    selectedChampId: null,
    onChampChange: () => {},
  }

  return (
    <TournamentLayout
      tournament={stage ? { name: stage.name, status: stage.lineup_status } : null}
      championship={null}
      phaseLabel={stage?.short_name ?? null}
      myRank={myRank}
      tabs={TABS}
      activeTab={activeTab}
      onTabChange={setTab}
    >
      {activeTab === TAB_LINEUP && (
        <LineupBuilder
          token={token}
          stageId={Number(id)}
        />
      )}
      {activeTab === TAB_LEADERBOARD && (
        <TournamentLeaderboard
          token={token}
          {...legacySharedProps}
        />
      )}
      {activeTab === TAB_STATS && (
        <PlayerStatsPage
          token={token}
          {...legacySharedProps}
        />
      )}
    </TournamentLayout>
  )
}
