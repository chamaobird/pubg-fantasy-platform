// frontend/src/pages/ChampionshipGroupDetail.jsx
// XAMA Fantasy — Detalhe de um Championship Group (ex: PEC Spring 2026)
// Rota: /group/:id

import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { API_BASE_URL } from '../config'
import Navbar from '../components/Navbar'
import PlayerStatsTable from '../components/PlayerStatsTable'
import FaceoffCard from '../components/FaceoffCard'
import { DashIcon } from '../components/DashIcon'

// ── Tokens locais ─────────────────────────────────────────────────────────────

const RANK_COLORS = { 1: '#f0c040', 2: '#b4bcc8', 3: '#cd7f50' }
const RANK_BG     = {
  1: 'rgba(240,192,64,0.04)',
  2: 'rgba(180,188,200,0.03)',
  3: 'rgba(176,120,80,0.03)',
}

const DashIconSafe = (props) =>
  <DashIcon {...props} />

// ── Summary mini-cards (acima das tabs) ───────────────────────────────────────
// Row horizontal de stat pills usando /summary

function SummaryPills({ summary, currentUser, championships }) {
  if (!summary) return null

  const phases = (championships || []).map(c => {
    const parts = (c.name || '').split(' - ')
    return parts.length > 1 ? parts[parts.length - 1] : (c.short_name || c.name)
  }).filter(Boolean)
  const phaseLabel = phases.length > 3 ? `${phases.slice(0, 3).join(' · ')} +${phases.length - 3}` : phases.join(' · ')

  const baseStyle = {
    display: 'inline-flex', alignItems: 'center', gap: 10,
    padding: '10px 14px', borderRadius: 9,
    border: '1px solid rgba(255,255,255,0.07)',
    background: 'rgba(255,255,255,0.025)',
    minWidth: 0,
  }
  const iconWrap = (color) => ({
    width: 28, height: 28, borderRadius: 6, flexShrink: 0,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: `${color}14`, color, border: `1px solid ${color}33`,
  })
  const label = { fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: 'var(--xm-muted-soft, #4b5563)', letterSpacing: '0.1em', fontWeight: 700, textTransform: 'uppercase' }
  const value = { fontSize: 14, fontWeight: 700, color: 'var(--xm-text-bright, #f1f5f9)', fontFamily: 'var(--xm-font-display, Rajdhani), sans-serif', letterSpacing: '0.01em', lineHeight: 1.1 }

  return (
    <div style={{
      display: 'grid', gap: 10,
      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      marginBottom: 28,
    }}>
      {/* Managers */}
      <div style={baseStyle}>
        <div style={iconWrap('#f97316')}><DashIconSafe name="target" size={14}/></div>
        <div style={{ minWidth: 0 }}>
          <div style={label}>Managers</div>
          <div style={value}>{summary.total_managers}</div>
        </div>
      </div>

      {/* Líder com tag dourada — usa cor de #1 do pódio */}
      {summary.leader && (
        <div style={baseStyle}>
          <div style={iconWrap('#f0c040')}><DashIconSafe name="trophy" size={14}/></div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={label}>Líder</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
              <span style={{ ...value, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {summary.leader.username}
              </span>
              <span style={{ fontSize: 11, color: '#f0c040', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                {Number(summary.leader.total_points).toFixed(0)} pts
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Fases combinadas — lista truncada */}
      {phases.length > 0 && (
        <div style={baseStyle}>
          <div style={iconWrap('#94a3b8')}><DashIconSafe name="calendar" size={14}/></div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={label}>{phases.length} Fase{phases.length !== 1 ? 's' : ''}</div>
            <div style={{
              fontSize: 12, color: 'var(--xm-text, #dce1ea)',
              fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '0.02em',
            }}>{phaseLabel}</div>
          </div>
        </div>
      )}

      {/* Você (se logado) — destaque teal */}
      {currentUser && (
        <div style={{ ...baseStyle, borderColor: 'rgba(20,184,166,0.3)', background: 'rgba(20,184,166,0.06)' }}>
          <div style={iconWrap('#2dd4bf')}><DashIconSafe name="user" size={14}/></div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ ...label, color: 'rgba(45,212,191,0.65)' }}>Você</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ ...value, color: '#2dd4bf' }}>#{currentUser.rank}</span>
              <span style={{ fontSize: 11, color: 'rgba(45,212,191,0.85)', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                {Number(currentUser.points).toFixed(0)} pts
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

function TabBar({ active, onChange, showFaceoff, faceoffMeta }) {
  const tabs = [
    { key: 'managers', label: 'Managers', icon: 'target' },
    { key: 'players',  label: 'Jogadores', icon: 'crosshair' },
    ...(showFaceoff ? [{ key: 'faceoff', label: 'Team Faceoff', icon: 'swords', meta: faceoffMeta }] : []),
  ]
  return (
    <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: 24 }}>
      {tabs.map(t => {
        const isActive = active === t.key
        return (
          <button key={t.key} onClick={() => onChange(t.key)}
            style={{
              padding: '11px 18px',
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: isActive ? '2px solid var(--xm-orange, #f97316)' : '2px solid transparent',
              color: isActive ? 'var(--xm-text-bright, #f1f5f9)' : 'var(--xm-muted, #6b7280)',
              fontWeight: isActive ? 700 : 500,
              fontSize: 14, marginBottom: -1,
              display: 'inline-flex', alignItems: 'center', gap: 8,
              transition: 'color 0.15s',
              fontFamily: 'var(--xm-font-body), Inter, sans-serif',
            }}>
            <span style={{ color: isActive ? '#f97316' : 'var(--xm-muted-soft, #4b5563)' }}>
              <DashIconSafe name={t.icon} size={14} />
            </span>
            {t.label}
            {t.meta && (
              <span style={{
                fontSize: 10, padding: '2px 6px', borderRadius: 3,
                background: 'rgba(74,222,128,0.12)', color: '#4ade80',
                border: '1px solid rgba(74,222,128,0.3)',
                fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, letterSpacing: '0.06em',
              }}>
                {t.meta}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── Podium (top 3 esports — 2 esq, 1 centro maior, 3 dir) ─────────────────────

function Podium({ data, currentUserId }) {
  const top3 = data.slice(0, 3)
  if (top3.length === 0) return null
  // Order: pega rank 2, 1, 3 — se não houver suficientes, oculta
  const findByRank = r => top3.find(e => (e.rank ?? top3.indexOf(e) + 1) === r)
  const slots = [
    { entry: findByRank(2), rank: 2, height: 96, scale: 0.92 },
    { entry: findByRank(1), rank: 1, height: 124, scale: 1, isCenter: true },
    { entry: findByRank(3), rank: 3, height: 80, scale: 0.88 },
  ].filter(s => s.entry)

  if (slots.length < 2) return null

  return (
    <div style={{
      display: 'grid', gap: 14,
      gridTemplateColumns: slots.length === 3 ? '1fr 1.15fr 1fr' : `repeat(${slots.length}, 1fr)`,
      alignItems: 'end', marginBottom: 28,
    }}>
      {slots.map(({ entry, rank, height, isCenter }) => {
        const color = RANK_COLORS[rank]
        const isMe  = entry.user_id === currentUserId
        return (
          <div key={rank} style={{
            position: 'relative',
            padding: isCenter ? '22px 16px 18px' : '18px 14px 16px',
            background: isCenter ? 'rgba(240,192,64,0.05)' : 'rgba(255,255,255,0.025)',
            border: `1px solid ${isCenter ? 'rgba(240,192,64,0.32)' : `${color}40`}`,
            borderRadius: 12, minHeight: height,
            display: 'flex', flexDirection: 'column', gap: 6,
            // Glow dourado no #1 — assinatura visual
            boxShadow: isCenter
              ? '0 8px 28px rgba(240,192,64,0.12), 0 0 32px rgba(240,192,64,0.08)'
              : '0 4px 16px rgba(0,0,0,0.25)',
            overflow: 'hidden',
          }}>
            {/* Accent bar superior na cor do pódio */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: isCenter ? 3 : 2,
              background: `linear-gradient(90deg, ${color}, ${color}55 40%, transparent 80%)`,
            }} />

            <div style={{
              fontSize: isCenter ? 11 : 10, fontWeight: 700, letterSpacing: '0.18em',
              fontFamily: "'JetBrains Mono', monospace", color,
              textTransform: 'uppercase',
            }}>
              {rank === 1 ? '1º · Líder' : `${rank}º Lugar`}
            </div>

            <div style={{
              fontSize: isCenter ? 22 : 18, fontWeight: 700,
              color: 'var(--xm-text-bright, #f1f5f9)',
              fontFamily: 'var(--xm-font-display, Rajdhani), sans-serif',
              lineHeight: 1.15, letterSpacing: '-0.005em',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {entry.username || entry.user_id}
            </div>

            <div style={{
              display: 'flex', alignItems: 'baseline', gap: 8,
              marginTop: 'auto', paddingTop: 8,
            }}>
              <span style={{
                fontSize: isCenter ? 32 : 24, fontWeight: 800,
                color, fontFamily: "'JetBrains Mono', monospace",
                fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em', lineHeight: 1,
              }}>
                {Number(entry.total_points).toFixed(0)}
              </span>
              <span style={{ fontSize: 11, color: 'var(--xm-muted)', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                pts · {entry.stages_played} fase{entry.stages_played !== 1 ? 's' : ''}
              </span>
            </div>

            {isMe && (
              <span style={{
                position: 'absolute', top: 8, right: 8,
                fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
                padding: '2px 6px', borderRadius: 3,
                background: 'rgba(20,184,166,0.18)', color: '#2dd4bf',
                border: '1px solid rgba(20,184,166,0.4)',
                fontFamily: "'JetBrains Mono', monospace",
              }}>VOCÊ</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── PhaseBreakdown (pills horizontais quando linha é expandida) ───────────────

function PhaseBreakdown({ phaseScores }) {
  if (!phaseScores?.length) {
    return <div style={{ fontSize: 12, color: 'var(--xm-muted)', fontStyle: 'italic' }}>Sem fases pontuadas.</div>
  }
  // Identifica a melhor fase para destacar
  const best = phaseScores.reduce((acc, p) => p.points > (acc?.points ?? -1) ? p : acc, null)

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '12px 16px 14px' }}>
      {phaseScores.map((p, i) => {
        const isBest = p === best
        return (
          <div key={i} style={{
            display: 'inline-flex', flexDirection: 'column', gap: 4,
            padding: '8px 12px', borderRadius: 7,
            background: isBest ? 'rgba(240,192,64,0.08)' : 'rgba(255,255,255,0.025)',
            border: `1px solid ${isBest ? 'rgba(240,192,64,0.32)' : 'rgba(255,255,255,0.07)'}`,
            minWidth: 90,
          }}>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
              color: isBest ? '#f0c040' : 'var(--xm-muted-soft, #4b5563)',
              fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase',
            }}>
              {p.championship_short_name || p.championship_name}
              {isBest && ' ★'}
            </span>
            <span style={{
              fontSize: 14, fontWeight: 700,
              color: isBest ? '#f0c040' : 'var(--xm-text, #dce1ea)',
              fontFamily: "'JetBrains Mono', monospace",
              fontVariantNumeric: 'tabular-nums', letterSpacing: '0.01em',
            }}>
              {Number(p.points).toFixed(1)}
            </span>
            <span style={{ fontSize: 10, color: 'var(--xm-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
              {p.stages_played} stage{p.stages_played !== 1 ? 's' : ''}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Manager leaderboard (com expansão + coluna "Melhor fase" + pódio) ─────────

function ManagerLeaderboard({ groupId, currentUserId, onCurrentUser }) {
  const [data, setData]       = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    setLoading(true)
    fetch(`${API_BASE_URL}/championship-groups/${groupId}/leaderboard?limit=200&breakdown=true`)
      .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then(d => {
        setData(d); setLoading(false)
        if (currentUserId) {
          const me = d.find(e => e.user_id === currentUserId)
          if (me) onCurrentUser?.({ rank: me.rank ?? d.indexOf(me) + 1, points: me.total_points })
        }
      })
      .catch(() => { setError('Erro ao carregar leaderboard'); setLoading(false) })
  }, [groupId, currentUserId, onCurrentUser])

  if (loading) return <LoadingBlock />
  if (error)   return <div className="msg-error">{error}</div>
  if (!data.length) return <EmptyBlock msg="Nenhum dado de pontuação ainda." />

  // Best phase = maior pontuação de qualquer phase_score
  const bestPhaseOf = entry => {
    if (!entry.phase_scores?.length) return null
    return entry.phase_scores.reduce((acc, p) => p.points > (acc?.points ?? -1) ? p : acc, null)
  }

  return (
    <>
      <Podium data={data} currentUserId={currentUserId} />

      <div style={{
        border: '1px solid rgba(255,255,255,0.07)',
        background: 'rgba(18,21,28,0.6)',
        borderRadius: 12, overflow: 'hidden',
      }}>
        <div style={{ height: 2, background: 'linear-gradient(90deg, #f0c040, transparent 50%)' }} />
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 56 }} />
            <col />
            <col style={{ width: 80 }} />
            <col style={{ width: 160 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 36 }} />
          </colgroup>
          <thead>
            <tr style={{ background: '#0a0c11', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              {['#', 'Manager', 'Fases', 'Melhor fase', 'Pontos', ''].map((h, i) => (
                <th key={i} style={{
                  padding: '12px 14px', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: 'var(--xm-muted)',
                  textAlign: i === 0 ? 'center' : i === 4 ? 'right' : 'left',
                  fontFamily: "'JetBrains Mono', monospace",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((entry, idx) => {
              const pos     = entry.rank ?? (idx + 1)
              const isTop3  = pos <= 3
              const isMe    = entry.user_id === currentUserId
              const isOpen  = expandedId === entry.user_id
              const best    = bestPhaseOf(entry)
              const hasBreakdown = !!entry.phase_scores?.length

              return (
                <>
                  <tr key={entry.user_id}
                    onClick={() => hasBreakdown && setExpandedId(isOpen ? null : entry.user_id)}
                    style={{
                      borderBottom: isOpen ? 'none' : '1px solid #13161f',
                      // Highlight teal MAIS chamativo no usuário logado
                      background: isMe ? 'rgba(20,184,166,0.08)' : isTop3 ? RANK_BG[pos] : 'transparent',
                      borderLeft: isMe ? '3px solid #2dd4bf' : '3px solid transparent',
                      cursor: hasBreakdown ? 'pointer' : 'default',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { if (!isMe) e.currentTarget.style.background = '#161b27' }}
                    onMouseLeave={e => { e.currentTarget.style.background = isMe ? 'rgba(20,184,166,0.08)' : isTop3 ? RANK_BG[pos] : 'transparent' }}>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <span style={{
                        fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                        fontFamily: "'JetBrains Mono', monospace",
                        color: isTop3 ? RANK_COLORS[pos] : 'var(--xm-muted-soft, #4b5563)',
                      }}>{String(pos).padStart(2, '0')}</span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <span style={{
                          fontSize: 13, fontFamily: "'JetBrains Mono', monospace",
                          color: isMe ? '#2dd4bf' : 'var(--xm-text, #dce1ea)', fontWeight: isMe ? 700 : 500,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>{entry.username || entry.user_id}</span>
                        {isMe && (
                          <span style={{
                            fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
                            padding: '2px 7px', borderRadius: 3,
                            background: 'rgba(20,184,166,0.22)', color: '#2dd4bf',
                            border: '1px solid rgba(20,184,166,0.5)',
                            fontFamily: "'JetBrains Mono', monospace",
                          }}>VOCÊ</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontSize: 12, color: 'var(--xm-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                        {entry.stages_played}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {best ? (
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--xm-muted-soft, #4b5563)', fontFamily: "'JetBrains Mono', monospace" }}>
                            {best.championship_short_name}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#f0c040', fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums' }}>
                            {Number(best.points).toFixed(1)}
                          </span>
                        </div>
                      ) : <span style={{ fontSize: 11, color: 'var(--xm-muted-soft, #4b5563)' }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      <span style={{
                        fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                        fontFamily: "'JetBrains Mono', monospace",
                        color: entry.total_points > 0 ? 'var(--xm-gold, #f0c040)' : '#374151',
                      }}>{Number(entry.total_points).toFixed(2)}</span>
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                      {hasBreakdown && (
                        <span style={{
                          display: 'inline-block', fontSize: 10,
                          color: 'var(--xm-muted)',
                          transform: isOpen ? 'rotate(90deg)' : 'none',
                          transition: 'transform 0.15s',
                        }}>▶</span>
                      )}
                    </td>
                  </tr>
                  {isOpen && hasBreakdown && (
                    <tr key={`${entry.user_id}-breakdown`}>
                      <td colSpan={6} style={{
                        borderBottom: '1px solid #13161f',
                        background: 'rgba(255,255,255,0.012)',
                        padding: 0,
                      }}>
                        <PhaseBreakdown phaseScores={entry.phase_scores} />
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
        <div style={{
          padding: '10px 18px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderTop: '1px solid rgba(255,255,255,0.07)', background: '#0a0c11',
        }}>
          <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
            color: 'var(--xm-gold)', fontFamily: "'JetBrains Mono', monospace",
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <DashIconSafe name="trophy" size={12}/> XAMA Fantasy
          </span>
          <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: 'var(--xm-muted)' }}>
            {data.length} managers
          </span>
        </div>
      </div>
    </>
  )
}

// ── Player stats ──────────────────────────────────────────────────────────────

function PlayerStats({ groupId, shortName }) {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    setLoading(true)
    fetch(`${API_BASE_URL}/championship-groups/${groupId}/player-stats?limit=200`)
      .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then(d => {
        setPlayers(d.map(p => ({ ...p, person_name: p.display_name })))
        setLoading(false)
      })
      .catch(() => { setError('Erro ao carregar stats'); setLoading(false) })
  }, [groupId])

  if (loading) return <LoadingBlock />
  if (error)   return <div className="msg-error">{error}</div>
  if (!players.length) return <EmptyBlock msg="Nenhuma stat de jogador registrada." />

  return (
    <PlayerStatsTable players={players} shortName={shortName} showDaysPlayed={false} beforeDate={null} totalCount={players.length} />
  )
}

// ── SectionHead local (reaproveita padrão do Dashboard) ───────────────────────

function SectionHead({ icon, label, count, tone = 'muted' }) {
  const color = tone === 'orange' ? '#f97316' : tone === 'green' ? '#4ade80' : 'var(--xm-muted)'
  const bg    = tone === 'orange' ? 'rgba(249,115,22,0.1)' : tone === 'green' ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.03)'
  const bd    = tone === 'orange' ? 'rgba(249,115,22,0.3)' : tone === 'green' ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.08)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 0 16px 0' }}>
      <span style={{
        width: 28, height: 28, borderRadius: 7, display: 'inline-flex',
        alignItems: 'center', justifyContent: 'center',
        background: bg, border: `1px solid ${bd}`, color,
      }}>
        <DashIconSafe name={icon} size={14}/>
      </span>
      <span style={{
        fontSize: 12, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
        color, fontFamily: "'JetBrains Mono', monospace",
      }}>{label}</span>
      {count != null && (
        <span style={{
          fontSize: 11, fontWeight: 700,
          color: 'var(--xm-muted-soft, #4b5563)',
          fontFamily: "'JetBrains Mono', monospace",
          padding: '2px 8px', borderRadius: 4,
          background: 'rgba(255,255,255,0.025)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>{String(count).padStart(2, '0')}</span>
      )}
      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
    </div>
  )
}

// ── Faceoff Results (summary + sections Resolvidos/Pendentes) ─────────────────

function FaceoffResults({ championshipIds }) {
  const [faceoffs, setFaceoffs] = useState([])
  const [loading, setLoading]   = useState(true)
  const token = localStorage.getItem('token')

  useEffect(() => {
    if (!championshipIds?.length) { setLoading(false); return }
    const headers = token ? { Authorization: `Bearer ${token}` } : {}
    Promise.all(
      championshipIds.map(cid =>
        fetch(`${API_BASE_URL}/faceoffs?championship_id=${cid}`, { headers }).then(r => r.ok ? r.json() : [])
      )
    ).then(results => {
      setFaceoffs(results.flat().filter(f => f.status !== 'draft'))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [championshipIds])

  if (loading) return <LoadingBlock />
  if (!faceoffs.length) return <EmptyBlock msg="Nenhum faceoff registrado para este campeonato." />

  const resolved = faceoffs.filter(f => f.status === 'resolved')
  const pending  = faceoffs.filter(f => f.status !== 'resolved')
  const myCorrect = resolved.filter(f => {
    if (!f.my_vote || !f.winner_team_name) return false
    const votedTeam = f.my_vote === 'a' ? f.team_a_name : f.team_b_name
    return votedTeam === f.winner_team_name
  }).length
  const pct = resolved.length > 0 ? Math.round((myCorrect / resolved.length) * 100) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Summary card horizontal — barra de progresso laranja/cinza */}
      {resolved.length > 0 && (
        <div style={{
          padding: '14px 18px', borderRadius: 12,
          background: 'rgba(240,192,64,0.04)',
          border: '1px solid rgba(240,192,64,0.22)',
          display: 'flex', alignItems: 'center', gap: 18,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 8, flexShrink: 0,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(240,192,64,0.1)', color: '#f0c040',
            border: '1px solid rgba(240,192,64,0.28)',
          }}>
            <DashIconSafe name="trophy" size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
              color: 'rgba(240,192,64,0.7)', fontFamily: "'JetBrains Mono', monospace", marginBottom: 4,
            }}>Seus palpites</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
              <span style={{
                fontSize: 22, fontWeight: 800, color: '#f0c040',
                fontFamily: 'var(--xm-font-display, Rajdhani), sans-serif',
                fontVariantNumeric: 'tabular-nums',
              }}>{myCorrect}/{resolved.length}</span>
              <span style={{ fontSize: 12, color: 'var(--xm-muted)', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                acertos · {pct}%
              </span>
            </div>
            {/* Barra de progresso — não só texto */}
            <div style={{
              height: 8, borderRadius: 4, overflow: 'hidden',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
            }}>
              <div style={{
                width: `${pct}%`,
                background: 'linear-gradient(90deg, #f97316, #f0c040)',
                transition: 'width 0.6s var(--xm-ease, ease)',
              }} />
            </div>
          </div>
        </div>
      )}

      {/* Pendentes — SectionHead */}
      {pending.length > 0 && (
        <div>
          <SectionHead icon="swords" label="Pendentes" count={pending.length} tone="orange" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pending.map(f => <FaceoffCard key={f.id} faceoff={f} token={null} onVoted={null} />)}
          </div>
        </div>
      )}

      {/* Resolvidos — SectionHead */}
      {resolved.length > 0 && (
        <div>
          <SectionHead icon="check-circle" label="Resolvidos" count={resolved.length} tone="green" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {resolved.map(f => <FaceoffCard key={f.id} faceoff={f} token={null} onVoted={null} />)}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Micro-components ──────────────────────────────────────────────────────────

function LoadingBlock() {
  return <div style={{ textAlign: 'center', padding: 60, color: 'var(--xm-muted)', fontSize: 16 }}>Carregando…</div>
}
function EmptyBlock({ msg }) {
  return <div style={{ textAlign: 'center', padding: 60, color: 'var(--xm-muted)', fontSize: 14, fontStyle: 'italic' }}>{msg}</div>
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ChampionshipGroupDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [group, setGroup]       = useState(null)
  const [summary, setSummary]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [tab, setTab]           = useState('managers')
  const [champDetails, setChampDetails] = useState([])
  const [myStanding, setMyStanding] = useState(null) // {rank, points} para o pill "Você"

  const [currentUserId, setCurrentUserId] = useState(null)
  useEffect(() => {
    try {
      const token = localStorage.getItem('token')
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]))
        setCurrentUserId(payload.sub || payload.user_id || null)
      }
    } catch { /* ignora */ }
  }, [])

  useEffect(() => {
    setLoading(true)
    fetch(`${API_BASE_URL}/championship-groups/${id}`)
      .then(r => {
        if (r.status === 404) throw new Error('404')
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(d => {
        setGroup(d); setLoading(false)
        if (d.championship_ids?.length) {
          Promise.all(
            d.championship_ids.map(cid => fetch(`${API_BASE_URL}/championships/${cid}`).then(r => r.ok ? r.json() : null))
          ).then(details => setChampDetails(details.filter(Boolean)))
        }
        // Novo endpoint /summary — informações para os mini-cards
        fetch(`${API_BASE_URL}/championship-groups/${id}/summary`)
          .then(r => r.ok ? r.json() : null)
          .then(s => s && setSummary(s))
          .catch(() => {})
      })
      .catch(e => {
        setError(e.message === '404' ? 'Grupo não encontrado.' : 'Erro ao carregar grupo.')
        setLoading(false)
      })
  }, [id])

  const hasFaceoff = champDetails.some(c => c.has_faceoff)
  const faceoffChampIds = champDetails.filter(c => c.has_faceoff).map(c => c.id)

  const contentMaxWidth = tab === 'players' ? 1600 : 1000

  // Championships ordenados para mostrar nome curto nos pills (usa /summary se disponível)
  const summaryChamps = summary?.championships ?? champDetails

  return (
    <div style={{ minHeight: '100vh', background: 'transparent', position: 'relative' }}>
      <Navbar />

      <main style={{
        position: 'relative', zIndex: 1, maxWidth: contentMaxWidth,
        margin: '0 auto', padding: '40px 24px 64px', transition: 'max-width 0.2s',
      }}>
        <button onClick={() => navigate('/championships')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--xm-muted)', fontSize: 12,
            marginBottom: 20, padding: 0,
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.06em',
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--xm-text)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--xm-muted)'}>
          <DashIconSafe name="arrow-left" size={12} /> Campeonatos
        </button>

        {loading && <LoadingBlock />}
        {error && <div className="msg-error">{error}</div>}

        {!loading && !error && group && (
          <>
            <div style={{ marginBottom: 24 }}>
              <div style={{
                fontSize: 12, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase',
                color: 'var(--xm-orange)', fontFamily: "'JetBrains Mono', monospace", marginBottom: 8,
              }}>{group.short_name}</div>
              <h1 style={{
                fontSize: 40, fontWeight: 700,
                color: 'var(--xm-text-bright, #f1f5f9)',
                fontFamily: 'var(--xm-font-display, Rajdhani), sans-serif',
                margin: '0 0 10px 0', letterSpacing: '-0.01em', lineHeight: 1.05,
              }}>{group.name}</h1>
              <div style={{
                fontSize: 12, color: 'var(--xm-muted)',
                fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.04em',
              }}>
                {group.championship_ids.length} fase{group.championship_ids.length !== 1 ? 's' : ''} combinadas
                {' · '}resultado unificado
              </div>
            </div>

            {/* Stat pills resumindo o grupo */}
            <SummaryPills
              summary={summary}
              currentUser={myStanding}
              championships={summaryChamps}
            />

            <TabBar
              active={tab}
              onChange={setTab}
              showFaceoff={hasFaceoff}
              faceoffMeta={null}
            />

            {tab === 'managers' && (
              <>
                <div style={{
                  fontSize: 11, color: 'var(--xm-muted)', marginBottom: 16,
                  fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.04em',
                }}>
                  Pontuação acumulada · clique numa linha para ver pontos por fase
                </div>
                <ManagerLeaderboard
                  groupId={id}
                  currentUserId={currentUserId}
                  onCurrentUser={setMyStanding}
                />
              </>
            )}

            {tab === 'players' && (
              <>
                <div style={{ fontSize: 11, color: 'var(--xm-muted)', marginBottom: 16, fontFamily: "'JetBrains Mono', monospace" }}>
                  Stats XAMA combinadas de todas as fases · PREÇO do último roster
                </div>
                <PlayerStats groupId={id} shortName={group.short_name} />
              </>
            )}

            {tab === 'faceoff' && hasFaceoff && (
              <>
                <div style={{ fontSize: 11, color: 'var(--xm-muted)', marginBottom: 16, fontFamily: "'JetBrains Mono', monospace" }}>
                  Confrontos · Vencedor definido pela performance no campeonato
                </div>
                <FaceoffResults championshipIds={faceoffChampIds} />
              </>
            )}
          </>
        )}
      </main>
    </div>
  )
}
