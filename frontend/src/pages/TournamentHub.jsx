// frontend/src/pages/TournamentHub.jsx
import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../App'
import { API_BASE_URL } from '../config'
import TournamentLayout from '../components/TournamentLayout'
import LineupBuilder from '../components/LineupBuilder'
import TournamentLeaderboard from '../components/TournamentLeaderboard'
import PlayerStatsPage from '../components/PlayerStatsPage'
import AdminPricingPanel from '../components/AdminPricingPanel'
import AdminOpsPanel from '../components/AdminOpsPanel'
import PriceHistoryModal from '../components/PriceHistoryModal'
import LineupResultsPage from './LineupResultsPage'

const TAB_LINEUP      = 'lineup'
const TAB_LEADERBOARD = 'leaderboard'
const TAB_STATS       = 'stats'
const TAB_ADMIN       = 'admin'

function decodeJwtPayload(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(base64))
  } catch {
    return {}
  }
}

export default function TournamentHub() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { token, setToken } = useAuth()
  const [searchParams] = useSearchParams()

  const [tab,   setTab]   = useState(() => searchParams.get('tab') || TAB_LINEUP)
  const [stage, setStage] = useState(null)
  const [siblingStages, setSiblingStages] = useState([])
  const [myRank, setMyRank] = useState(null)
  const [priceModalRoster, setPriceModalRoster] = useState(null)

  const isAdmin = token ? decodeJwtPayload(token)?.is_admin === true : false

  useEffect(() => {
    if (!id) return
    fetch(`${API_BASE_URL}/stages/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        setStage(data)
        if (data?.championship_id) {
          fetch(`${API_BASE_URL}/stages/?championship_id=${data.championship_id}`)
            .then(r => r.ok ? r.json() : [])
            .then(setSiblingStages)
            .catch(() => {})
        }
      })
      .catch(() => {})
  }, [id])

  const isFinished = stage ? (!stage.is_active) : false
  const isLocked   = stage ? (stage.lineup_status === 'locked') : false
  const isClosed   = stage ? (stage.lineup_status === 'closed')  : false
  const canEdit    = stage ? (stage.lineup_status === 'open') : false

  // closed: não exibe tab de lineup (ainda não está disponível)
  const showLineupTab = !isFinished && !isClosed

  const ALL_TABS = [
    ...(showLineupTab ? [{ id: TAB_LINEUP, label: isPreview ? 'Lineup' : isLocked ? 'Meus Resultados' : 'Montar Lineup', icon: isLocked ? '📊' : '⚔️' }] : []),
    { id: TAB_LEADERBOARD, label: 'Leaderboard', icon: '🏆' },
    { id: TAB_STATS,       label: 'Stats',        icon: '📊' },
    ...(isAdmin ? [{ id: TAB_ADMIN, label: 'Admin', icon: '⚙️' }] : []),
  ]

  const TABS      = ALL_TABS
  const activeTab = TABS.find(t => t.id === tab) ? tab : TABS[0]?.id ?? TAB_LEADERBOARD

  useEffect(() => {
    if (isFinished) setTab(TAB_LEADERBOARD)
  }, [isFinished])

  return (
    <>
      <TournamentLayout
        tournament={stage ? { name: stage.name, status: stage.lineup_status } : null}
        championship={null}
        championshipName={stage?.championship_name ?? null}
        siblingStages={siblingStages}
        currentStageId={Number(id)}
        phaseLabel={stage?.short_name ?? null}
        myRank={myRank}
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={setTab}
      >
        {activeTab === TAB_LINEUP && (
          isLocked ? (
            <LineupResultsPage token={token} stageId={String(id)} embedded />
          ) : (
            <LineupBuilder
              token={token}
              stageId={Number(id)}
              canEdit={canEdit}
              isPreview={isPreview}
              onPlayerInfoClick={(roster) => setPriceModalRoster(roster)}
            />
          )
        )}
        {activeTab === TAB_LEADERBOARD && (
          <TournamentLeaderboard
            token={token}
            stageId={Number(id)}
            lineupStatus={stage?.lineup_status}
            stageShortName={stage?.short_name ?? ''}
            championshipId={stage?.championship_id ?? null}
            championshipShortName={stage?.championship_short_name ?? ''}
            siblingStages={siblingStages}
            onMyRankFound={(position, total_points) => setMyRank({ position, total_points })}
          />
        )}
        {activeTab === TAB_STATS && (
          <PlayerStatsPage
            stageId={Number(id)}
            shortName={stage?.short_name ?? ''}
            siblingStages={siblingStages}
            championshipId={stage?.championship_id ?? null}
          />
        )}
        {activeTab === TAB_ADMIN && isAdmin && (
          <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 340px', minWidth: '300px' }}>
              <AdminOpsPanel stageId={Number(id)} token={token} />
            </div>
            <div style={{ flex: '2 1 420px', minWidth: '320px' }}>
              <AdminPricingPanel stageId={Number(id)} token={token} />
            </div>
          </div>
        )}
      </TournamentLayout>

      {priceModalRoster && (
        <PriceHistoryModal
          stageId={Number(id)}
          roster={priceModalRoster}
          onClose={() => setPriceModalRoster(null)}
        />
      )}
    </>
  )
}
