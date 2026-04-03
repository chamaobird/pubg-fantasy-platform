// components/TournamentHeader.jsx
import { StatusBadge } from './ui/Badge'

export default function TournamentHeader({ tournament, championship, phaseLabel, myRank }) {
  if (!tournament) return null

  return (
    <div className="xt-header">
      <div className="xt-header-inner">

        {/* Lado esquerdo: breadcrumb + nome + meta */}
        <div>
          {championship && (
            <p className="xt-breadcrumb" style={{ fontSize: '16px' }}>
              {championship.name}
              {phaseLabel && (
                <>
                  <span style={{ margin: '0 6px', opacity: 0.4 }}>›</span>
                  <span style={{ color: 'var(--color-xama-text)' }}>{phaseLabel}</span>
                </>
              )}
            </p>
          )}

          <h2 className="xt-name" style={{ fontSize: '30px' }}>{tournament.name}</h2>

          <div className="xt-meta">
            <StatusBadge status={tournament.status} />
            {tournament.region && (
              <span className="xt-region" style={{ fontSize: '16px' }}>{tournament.region}</span>
            )}
          </div>
        </div>

        {/* Lado direito: pontos e posição */}
        {myRank && (
          <div className="xt-stats">
            <div className="xt-stat">
              <p className="xt-stat-label" style={{ fontSize: '16px' }}>Meus Pontos</p>
              <p className="xt-stat-value" style={{ fontSize: '30px' }}>{Number(myRank.total_points).toFixed(1)}</p>
            </div>
            <div className="xt-stat">
              <p className="xt-stat-label" style={{ fontSize: '16px' }}>Posição</p>
              <p className="xt-stat-value muted" style={{ fontSize: '30px' }}>#{myRank.position}</p>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
