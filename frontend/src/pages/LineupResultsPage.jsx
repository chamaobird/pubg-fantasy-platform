// frontend/src/pages/LineupResultsPage.jsx
// XAMA Fantasy — Resultados por lineup (#092)

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { API_BASE_URL } from '../config'
import TeamLogo from '../components/TeamLogo'

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(name) {
  if (!name) return '—'
  const idx = name.indexOf('_')
  return idx !== -1 ? name.slice(idx + 1) : name
}
function tag(name, teamName) {
  if (name) { const idx = name.indexOf('_'); if (idx !== -1) return name.slice(0, idx) }
  return teamName || '—'
}
async function get(url, token) {
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data?.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

// ── component ─────────────────────────────────────────────────────────────────

export default function LineupResultsPage({ token = '', stageId: stageIdProp, embedded = false }) {
  const { stageId: stageIdParam } = useParams()
  const stageId = stageIdProp ?? stageIdParam

  const [stage,       setStage]       = useState(null)
  const [days,        setDays]        = useState([])
  const [lineups,     setLineups]     = useState([])
  const [playerStats, setPlayerStats] = useState([])
  const [activeDayId, setActiveDayId] = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')

  useEffect(() => {
    if (!stageId) return
    setLoading(true)
    setError('')

    Promise.all([
      get(`${API_BASE_URL}/stages/${stageId}`, null),
      get(`${API_BASE_URL}/stages/${stageId}/days`, null),
      token
        ? get(`${API_BASE_URL}/lineups/stage/${stageId}`, token)
        : Promise.resolve([]),
    ])
      .then(([stageData, daysData, lineupsData]) => {
        setStage(stageData)
        const daysArr = Array.isArray(daysData) ? daysData : []
        setDays(daysArr)
        setLineups(Array.isArray(lineupsData) ? lineupsData : [])
        const scored = daysArr.filter(d =>
          (Array.isArray(lineupsData) ? lineupsData : []).some(
            l => l.stage_day_id === d.id && l.total_points != null
          )
        )
        const defaultDay = scored.length > 0
          ? scored[scored.length - 1].id
          : daysArr.length > 0 ? daysArr[0].id : null
        setActiveDayId(defaultDay)
      })
      .catch(e => setError(e.message || 'Erro ao carregar dados'))
      .finally(() => setLoading(false))
  }, [stageId, token])

  // Carrega stats do dia ativo
  useEffect(() => {
    if (!stageId || !activeDayId) return
    get(`${API_BASE_URL}/stages/${stageId}/player-stats?stage_day_id=${activeDayId}`, null)
      .then(data => setPlayerStats(Array.isArray(data) ? data : []))
      .catch(() => setPlayerStats([]))
  }, [stageId, activeDayId])

  const activeLineup = useMemo(
    () => lineups.find(l => l.stage_day_id === activeDayId) || null,
    [lineups, activeDayId]
  )

  // Map person_id → stat
  const statByPersonId = useMemo(() => {
    const m = {}
    playerStats.forEach(s => { m[s.person_id] = s })
    return m
  }, [playerStats])

  const captainMultiplier = stage?.captain_multiplier ? Number(stage.captain_multiplier) : 1.3

  return (
    <div style={embedded ? { padding: '24px 0' } : { minHeight: '100vh', background: 'var(--surface-0)', padding: '24px 0' }}>
      <div className="xama-container" style={{ maxWidth: 680 }}>

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{
            fontSize: 22, fontWeight: 700, letterSpacing: '0.06em',
            textTransform: 'uppercase', color: 'var(--color-xama-text)', margin: 0,
          }}>
            Resultados do Lineup
          </h1>
          {stage && (
            <p style={{ fontSize: 13, color: 'var(--color-xama-muted)', margin: '4px 0 0' }}>
              {stage.name}
            </p>
          )}
        </div>

        {loading && (
          <p className="xama-loading" style={{ padding: '32px 0', textAlign: 'center' }}>
            Carregando resultados...
          </p>
        )}
        {error && <p className="xama-error" style={{ padding: '16px 0' }}>{error}</p>}
        {!loading && !error && !token && (
          <div style={{
            background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)',
            borderRadius: 8, padding: '16px', textAlign: 'center',
            color: 'var(--color-xama-red)', fontSize: 14,
          }}>
            Faça login para ver seus resultados.
          </div>
        )}

        {!loading && !error && token && (
          <>
            {/* Seletor de dias */}
            {days.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
                {days.map(d => {
                  const hasLineup = lineups.some(l => l.stage_day_id === d.id)
                  const isActive  = d.id === activeDayId
                  return (
                    <button
                      key={d.id}
                      onClick={() => setActiveDayId(d.id)}
                      style={{
                        padding: '6px 14px',
                        fontSize: 13, fontWeight: 700, letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        borderRadius: 6, border: 'none', cursor: 'pointer',
                        background: isActive ? 'var(--color-xama-orange)' : hasLineup ? 'var(--surface-2)' : 'var(--surface-1)',
                        color: isActive ? '#fff' : hasLineup ? 'var(--color-xama-text)' : 'var(--color-xama-muted)',
                        outline: isActive ? 'none' : hasLineup ? '1px solid var(--color-xama-border)' : '1px dashed var(--color-xama-border)',
                      }}>
                      Dia {d.day_number}
                    </button>
                  )
                })}
              </div>
            )}

            {activeDayId && !activeLineup && (
              <div style={{
                background: 'var(--surface-1)', border: '1px dashed var(--color-xama-border)',
                borderRadius: 8, padding: '24px', textAlign: 'center',
                color: 'var(--color-xama-muted)', fontSize: 14,
              }}>
                Nenhum lineup submetido para este dia.
              </div>
            )}

            {activeLineup && (
              <LineupCard
                lineup={activeLineup}
                captainMultiplier={captainMultiplier}
                statByPersonId={statByPersonId}
              />
            )}

            {lineups.length > 0 && (
              <StageSummary lineups={lineups} days={days} />
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── LineupCard ────────────────────────────────────────────────────────────────

function LineupCard({ lineup, captainMultiplier, statByPersonId }) {
  const isPending = lineup.total_points == null

  const titulares = (lineup.players || [])
    .filter(p => p.slot_type === 'titular')
    .sort((a, b) => {
      if (a.is_captain) return -1
      if (b.is_captain) return 1
      const pa = a.points_earned ?? -Infinity
      const pb = b.points_earned ?? -Infinity
      return pb - pa
    })
  const reserva = (lineup.players || []).find(p => p.slot_type === 'reserve')

  return (
    <div style={{
      background: 'var(--surface-1)', border: '1px solid var(--color-xama-border)',
      borderRadius: 12, overflow: 'hidden', marginBottom: 20,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 16px',
        background: 'var(--surface-2)', borderBottom: '1px solid var(--color-xama-border)',
      }}>
        <span style={{
          fontSize: 12, fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: 'var(--color-xama-muted)',
        }}>
          Total do dia
        </span>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 24, fontWeight: 700,
          color: isPending ? 'var(--color-xama-muted)' : 'var(--color-xama-orange)',
        }}>
          {isPending ? '—' : Number(lineup.total_points).toFixed(2)}
          {!isPending && (
            <span style={{ fontSize: 12, color: 'var(--color-xama-muted)', marginLeft: 5 }}>pts</span>
          )}
        </span>
      </div>

      {isPending && (
        <div style={{
          padding: '10px 16px',
          background: 'rgba(250,204,21,0.06)', borderBottom: '1px solid rgba(250,204,21,0.15)',
          color: 'var(--color-xama-gold)', fontSize: 12, textAlign: 'center',
        }}>
          ⏳ Aguardando pontuação
        </div>
      )}

      {/* Legenda de colunas */}
      {!isPending && (
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: '6px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          background: 'rgba(255,255,255,0.015)',
        }}>
          <div style={{ width: 26 }} />
          <div style={{ flex: 1 }} />
          <div style={{
            display: 'flex', gap: 6, marginRight: 8,
            fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
            color: 'var(--color-xama-muted)', textTransform: 'uppercase',
          }}>
            <span style={{ width: 34, textAlign: 'center' }}>K</span>
            <span style={{ width: 44, textAlign: 'center' }}>DMG</span>
            <span style={{ width: 28, textAlign: 'center' }}>#</span>
          </div>
          <div style={{
            minWidth: 64, textAlign: 'right',
            fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
            color: 'var(--color-xama-muted)', textTransform: 'uppercase',
          }}>
            PTS
          </div>
        </div>
      )}

      {/* Titulares */}
      <div style={{ padding: '8px 0' }}>
        {titulares.map((lp, idx) => (
          <PlayerRow
            key={lp.id}
            lp={lp}
            captainMultiplier={captainMultiplier}
            isPending={isPending}
            rank={isPending ? null : idx + 1}
            playerStat={statByPersonId[lp.person_id] || null}
          />
        ))}
      </div>

      {/* Reserva */}
      {reserva && (
        <div style={{
          borderTop: '1px solid var(--color-xama-border)',
          background: 'rgba(0,0,0,0.15)',
        }}>
          <div style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: 'var(--color-xama-muted)',
            padding: '8px 16px 0',
          }}>
            Reserva
          </div>
          <div style={{ padding: '4px 0 8px' }}>
            <PlayerRow
              lp={reserva}
              captainMultiplier={captainMultiplier}
              isPending={isPending}
              isReserve
              playerStat={statByPersonId[reserva.person_id] || null}
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{
        borderTop: '1px solid var(--color-xama-border)',
        padding: '8px 16px',
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'var(--surface-0)',
      }}>
        <span style={{ fontSize: 10, color: 'var(--color-xama-muted)' }}>
          Multiplicador do capitão:
        </span>
        <span style={{
          fontSize: 11, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
          color: 'var(--color-xama-gold)',
          background: 'rgba(250,204,21,0.10)', border: '1px solid rgba(250,204,21,0.25)',
          borderRadius: 4, padding: '1px 6px',
        }}>
          ×{captainMultiplier.toFixed(2)}
        </span>
      </div>
    </div>
  )
}

// ── PlayerRow ─────────────────────────────────────────────────────────────────

function StatPill({ value, color, bg, borderColor }) {
  return (
    <span style={{
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 11, fontWeight: 700,
      color, background: bg,
      border: `1px solid ${borderColor}`,
      borderRadius: 4, padding: '2px 5px',
      minWidth: 0, display: 'inline-block', textAlign: 'center',
    }}>
      {value}
    </span>
  )
}

function PlayerRow({ lp, captainMultiplier, isPending, isReserve = false, rank = null, playerStat = null }) {
  const name    = lp.person_name || '—'
  const teamTag = tag(lp.person_name, lp.team_name)
  const pts     = lp.points_earned != null ? Number(lp.points_earned) : null
  const basePts = lp.is_captain && pts != null ? pts / captainMultiplier : null

  const kills    = playerStat?.total_kills ?? null
  const damage   = playerStat?.total_damage != null ? Math.round(playerStat.total_damage) : null
  const avgPlace = playerStat?.avg_placement != null ? Math.round(playerStat.avg_placement) : null

  const captainColor = 'var(--color-xama-gold)'
  const textColor    = isReserve ? 'var(--color-xama-muted)' : 'var(--color-xama-text)'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '7px 16px',
      borderBottom: '1px solid rgba(255,255,255,0.035)',
      opacity: isReserve ? 0.7 : 1,
      transition: 'background 0.15s',
      background: lp.is_captain ? 'rgba(240,192,64,0.04)' : 'transparent',
    }}>

      {/* Logo */}
      <TeamLogo teamName={teamTag} size={24} />

      {/* Nome + badges */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'nowrap' }}>
          <span style={{
            fontSize: 13, fontWeight: 600,
            color: lp.is_captain ? captainColor : textColor,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            maxWidth: 140,
          }}>
            {fmt(name)}
          </span>
          {lp.is_captain && (
            <span style={{
              fontSize: 9, fontWeight: 800, color: captainColor,
              background: 'rgba(240,192,64,0.14)', border: '1px solid rgba(240,192,64,0.35)',
              borderRadius: 3, padding: '1px 5px', letterSpacing: '0.06em',
              flexShrink: 0,
            }}>
              ⭐ CAP
            </span>
          )}
          {isReserve && (
            <span style={{
              fontSize: 9, fontWeight: 700, color: 'var(--color-xama-blue)',
              background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)',
              borderRadius: 3, padding: '1px 4px', letterSpacing: '0.06em',
              flexShrink: 0,
            }}>
              RES
            </span>
          )}
        </div>
        <div style={{ fontSize: 10, color: 'var(--color-xama-muted)', marginTop: 1 }}>
          {teamTag}
        </div>
      </div>

      {/* Stats do dia */}
      {!isPending && (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
          {/* Kills */}
          <div style={{ width: 34, textAlign: 'center' }}>
            {kills !== null ? (
              <StatPill
                value={kills}
                color={kills >= 5 ? '#fb923c' : kills >= 3 ? '#fbbf24' : 'var(--color-xama-muted)'}
                bg={kills >= 5 ? 'rgba(251,146,60,0.12)' : kills >= 3 ? 'rgba(251,191,36,0.10)' : 'rgba(255,255,255,0.04)'}
                borderColor={kills >= 5 ? 'rgba(251,146,60,0.3)' : kills >= 3 ? 'rgba(251,191,36,0.25)' : 'rgba(255,255,255,0.08)'}
              />
            ) : (
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.15)' }}>—</span>
            )}
          </div>

          {/* Damage */}
          <div style={{ width: 44, textAlign: 'center' }}>
            {damage !== null ? (
              <StatPill
                value={damage}
                color={damage >= 800 ? '#4ade80' : damage >= 400 ? '#a3e635' : 'var(--color-xama-muted)'}
                bg={damage >= 800 ? 'rgba(74,222,128,0.10)' : damage >= 400 ? 'rgba(163,230,53,0.08)' : 'rgba(255,255,255,0.04)'}
                borderColor={damage >= 800 ? 'rgba(74,222,128,0.25)' : damage >= 400 ? 'rgba(163,230,53,0.2)' : 'rgba(255,255,255,0.08)'}
              />
            ) : (
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.15)' }}>—</span>
            )}
          </div>

          {/* Placement */}
          <div style={{ width: 28, textAlign: 'center' }}>
            {avgPlace !== null ? (
              <StatPill
                value={`#${avgPlace}`}
                color={avgPlace <= 3 ? '#fde68a' : avgPlace <= 8 ? 'var(--color-xama-text)' : 'var(--color-xama-muted)'}
                bg={avgPlace <= 3 ? 'rgba(253,230,138,0.10)' : 'rgba(255,255,255,0.04)'}
                borderColor={avgPlace <= 3 ? 'rgba(253,230,138,0.3)' : 'rgba(255,255,255,0.08)'}
              />
            ) : (
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.15)' }}>—</span>
            )}
          </div>
        </div>
      )}

      {/* Pontos */}
      <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 64 }}>
        {isPending || pts == null ? (
          <span style={{ fontSize: 12, color: 'var(--color-xama-muted)', fontFamily: "'JetBrains Mono', monospace" }}>—</span>
        ) : (
          <>
            <div style={{
              fontSize: 15, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
              color: lp.is_captain ? captainColor : isReserve ? 'var(--color-xama-muted)' : 'var(--color-xama-text)',
            }}>
              {pts.toFixed(2)}
            </div>
            {lp.is_captain && basePts != null && (
              <div style={{ fontSize: 9, color: 'var(--color-xama-muted)', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.3 }}>
                {basePts.toFixed(1)} ×{captainMultiplier.toFixed(2)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── StageSummary ──────────────────────────────────────────────────────────────

function StageSummary({ lineups, days }) {
  const scored = lineups.filter(l => l.total_points != null)
  if (scored.length === 0) return null

  const total = scored.reduce((acc, l) => acc + Number(l.total_points), 0)

  return (
    <div style={{
      background: 'var(--surface-1)', border: '1px solid var(--color-xama-border)',
      borderRadius: 10, overflow: 'hidden',
    }}>
      <div style={{
        padding: '10px 16px',
        background: 'var(--surface-2)', borderBottom: '1px solid var(--color-xama-border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{
          fontSize: 12, fontWeight: 700,
          letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-xama-muted)',
        }}>
          Acumulado da Stage
        </span>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700,
          color: 'var(--color-xama-orange)',
        }}>
          {total.toFixed(2)} pts
        </span>
      </div>
      <div style={{ padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {scored
          .sort((a, b) => {
            const da = days.find(d => d.id === a.stage_day_id)
            const db = days.find(d => d.id === b.stage_day_id)
            return (da?.day_number || 0) - (db?.day_number || 0)
          })
          .map(l => {
            const day = days.find(d => d.id === l.stage_day_id)
            return (
              <div key={l.id} style={{
                background: 'var(--surface-2)', border: '1px solid var(--color-xama-border)',
                borderRadius: 6, padding: '6px 14px', textAlign: 'center', minWidth: 80,
              }}>
                <div style={{
                  fontSize: 10, color: 'var(--color-xama-muted)',
                  fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                }}>
                  Dia {day?.day_number || '?'}
                </div>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 700,
                  color: 'var(--color-xama-text)', marginTop: 3,
                }}>
                  {Number(l.total_points).toFixed(2)}
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )
}
