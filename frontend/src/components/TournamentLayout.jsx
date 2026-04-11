// components/TournamentLayout.jsx
// Layout completo de torneio: Navbar + Header + Tabs + Conteúdo
import Navbar from './Navbar'
import TournamentHeader from './TournamentHeader'
import Tabs from './Tabs'

/**
 * Props:
 *   tournament    — objeto do torneio
 *   championship  — objeto do campeonato ou null
 *   phaseLabel    — string da fase ou null
 *   myRank        — { total_points, position } ou null
 *   tabs          — array de { id, label, icon }
 *   activeTab     — id da tab ativa
 *   onTabChange   — fn(tabId)
 *   children      — conteúdo da tab ativa
 */
export default function TournamentLayout({
  tournament,
  championship,
  championshipName,
  siblingStages,
  currentStageId,
  phaseLabel,
  myRank,
  tabs,
  activeTab,
  onTabChange,
  children,
}) {
  return (
    <div className="xama-page">
      <Navbar tournament={tournament} />

      <TournamentHeader
        tournament={tournament}
        championship={championship}
        championshipName={championshipName}
        siblingStages={siblingStages}
        currentStageId={currentStageId}
        phaseLabel={phaseLabel}
        myRank={myRank}
      />

      <Tabs tabs={tabs} activeTab={activeTab} onChange={onTabChange} />

      <div style={{ flex: 1 }}>
        {children}
      </div>
    </div>
  )
}
