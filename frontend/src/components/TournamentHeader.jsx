// components/TournamentHeader.jsx
import { StatusBadge } from './ui/Badge'

/**
 * Header strip do torneio — aparece entre a Navbar e as Tabs.
 * Props:
 *   tournament   — objeto do torneio (name, status, region)
 *   championship — objeto do campeonato (name) ou null
 *   phaseLabel   — string da fase (ex: "Winners Stage") ou null
 *   myRank       — { total_points, position } ou null
 */
export default function TournamentHeader({ tournament, championship, phaseLabel, myRank }) {
  if (!tournament) return null

  return (
    <div className="xt-header">
      <div className="xt-header-inner">

        {/* Lado esquerdo: breadcrumb + nome + meta */}
        <div>
          {championship && (
            <p className="xt-breadcrumb">
              {championship.name}
              {phaseLabel && (
                <>
                  <span style={{ margin: '0 6px', opacity: 0.4 }}>›</span>
                  <span style={{ color: 'var(--color-xama-text)' }}>{phaseLabel}</span>
                </>
              )}
            </p>
          )}

          <h2 className="xt-name">{tournament.name}</h2>

          <div className="xt-meta">
            <StatusBadge status={tournament.status} />
            {tournament.region && (
              <span className="xt-region">{tournament.region}</span>
            )}
          </div>
        </div>

        {/* Lado direito: pontos e posição do usuário (só se tiver ranking) */}
        {myRank && (
          <div className="xt-stats">
            <div className="xt-stat">
              <p className="xt-stat-label">Meus Pontos</p>
              <p className="xt-stat-value">{Number(myRank.total_points).toFixed(1)}</p>
            </div>
            <div className="xt-stat">
              <p className="xt-stat-label">Posição</p>
              <p className="xt-stat-value muted">#{myRank.position}</p>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
