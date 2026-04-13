// components/TournamentHeader.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { StatusBadge } from './ui/Badge'

// Resolve logo do campeonato pelo nome da stage (shortName como fallback)
function ChampionshipLogo({ shortName, size = 32 }) {
  const upper = (shortName || '').toUpperCase()
  const folder = upper.startsWith('PGS') ? 'PGS'
    : (upper.startsWith('PAS') || upper.startsWith('PO')) ? 'PAS'
    : null
  const candidates = folder ? [
    `/logos/Tournaments/${folder}.webp`,
    `/logos/Tournaments/${folder}.png`,
  ] : []
  const [idx, setIdx] = useState(0)
  const [failed, setFailed] = useState(false)

  // Reset quando shortName muda (ex: carrega de null para PGS3GF)
  useEffect(() => { setIdx(0); setFailed(false) }, [folder])

  if (!folder || failed || candidates.length === 0) return null

  return (
    <img
      src={candidates[idx]}
      alt=""
      onError={() => idx + 1 < candidates.length ? setIdx(i => i + 1) : setFailed(true)}
      style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }}
    />
  )
}

// Status label para o dropdown
const STATUS_LABEL = { open: 'ABERTA', closed: 'EM BREVE', locked: 'ENCERRADO' }
const STATUS_COLOR = { open: '#4ade80', closed: '#f97316', locked: '#6b7280' }
const DROPDOWN_SHOW_SEARCH = 6  // mostra campo de busca quando há mais de N stages

export default function TournamentHeader({ tournament, championship, championshipName, siblingStages, currentStageId, phaseLabel, myRank }) {
  const navigate = useNavigate()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [stageSearch, setStageSearch] = useState('')

  if (!tournament) return null

  const hasDropdown = siblingStages && siblingStages.length > 1

  return (
    <div className="xt-header">
      <div className="xt-header-inner">

        {/* Lado esquerdo: logo + nome + meta */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>

          {/* Logo do campeonato */}
          <ChampionshipLogo shortName={phaseLabel} size={44} />

          <div>
            <h2 className="xt-name" style={{ fontSize: '30px', display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
              {hasDropdown ? (
                <>
                  <button
                    onClick={() => setDropdownOpen(o => !o)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--color-xama-text)', fontFamily: 'inherit',
                      fontSize: 'inherit', fontWeight: 'inherit', padding: 0,
                      display: 'flex', alignItems: 'center', gap: '8px',
                    }}
                  >
                    {tournament.name}
                    <span style={{ fontSize: '14px', color: 'var(--color-xama-muted)', marginTop: '2px' }}>
                      {dropdownOpen ? '▲' : '▼'}
                    </span>
                  </button>

                  {dropdownOpen && (
                    <>
                      {/* Overlay para fechar */}
                      <div
                        onClick={() => { setDropdownOpen(false); setStageSearch('') }}
                        style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                      />
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, zIndex: 100,
                        background: 'var(--color-xama-surface)',
                        border: '1px solid var(--color-xama-border)',
                        borderRadius: '10px', minWidth: '280px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                        overflow: 'hidden', marginTop: '6px',
                      }}>
                        {/* Campo de busca — aparece quando há muitas stages */}
                        {siblingStages.length > DROPDOWN_SHOW_SEARCH && (
                          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--color-xama-border)' }}>
                            <input
                              autoFocus
                              type="text"
                              placeholder="Buscar stage..."
                              value={stageSearch}
                              onChange={e => setStageSearch(e.target.value)}
                              onClick={e => e.stopPropagation()}
                              style={{
                                width: '100%', background: 'var(--surface-3)',
                                border: '1px solid var(--color-xama-border)',
                                borderRadius: '6px', padding: '6px 10px',
                                fontSize: '13px', color: 'var(--color-xama-text)',
                                fontFamily: "'Rajdhani', sans-serif", outline: 'none',
                              }}
                            />
                          </div>
                        )}

                        {/* Lista com scroll */}
                        <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                          {[...siblingStages]
                            .sort((a, b) => b.id - a.id)
                            .filter(s => !stageSearch || s.name.toLowerCase().includes(stageSearch.toLowerCase()))
                            .map(s => {
                              const isCurrent = s.id === currentStageId
                              const color = STATUS_COLOR[s.lineup_status] || '#6b7280'
                              return (
                                <div
                                  key={s.id}
                                  onClick={() => { setDropdownOpen(false); setStageSearch(''); if (!isCurrent) navigate(`/tournament/${s.id}`) }}
                                  style={{
                                    padding: '10px 16px',
                                    cursor: isCurrent ? 'default' : 'pointer',
                                    background: isCurrent ? 'rgba(249,115,22,0.08)' : 'transparent',
                                    borderLeft: isCurrent ? '2px solid var(--color-xama-orange)' : '2px solid transparent',
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
                                    transition: 'background 0.12s',
                                  }}
                                  onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                                  onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.background = 'transparent' }}
                                >
                                  <span style={{
                                    fontSize: '14px', fontWeight: isCurrent ? 700 : 500,
                                    color: isCurrent ? 'var(--color-xama-orange)' : 'var(--color-xama-text)',
                                    fontFamily: "'Rajdhani', sans-serif",
                                  }}>
                                    {s.name}
                                  </span>
                                  <span style={{
                                    fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em',
                                    color, fontFamily: "'JetBrains Mono', monospace", flexShrink: 0,
                                  }}>
                                    {STATUS_LABEL[s.lineup_status] || s.lineup_status}
                                  </span>
                                </div>
                              )
                            })}
                        </div>
                      </div>
                    </>
                  )}
                </>
              ) : (
                tournament.name
              )}
            </h2>

            <div className="xt-meta">
              <StatusBadge status={tournament.status} />
              {tournament.region && (
                <span className="xt-region" style={{ fontSize: '16px' }}>{tournament.region}</span>
              )}
            </div>
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
