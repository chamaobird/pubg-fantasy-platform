// frontend/src/pages/LineupResultsPage.jsx
// XAMA Fantasy — Resultados por lineup (#092)

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { API_BASE_URL } from '../config'
import TeamLogo from '../components/TeamLogo'
import { formatTeamTag, formatPlayerName } from '../utils/teamUtils'
import { useLiveScoring } from '../hooks/useLiveScoring'

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(name) {
  if (!name) return '—'
  return formatPlayerName(name, null) || name
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

// ── table style helpers ───────────────────────────────────────────────────────

const thStyle = (right = false) => ({
  padding: '8px 12px',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  textAlign: right ? 'right' : 'left',
  color: 'var(--color-xama-muted)',
  whiteSpace: 'nowrap',
  userSelect: 'none',
})

const tdStyle = {
  padding: '9px 12px',
  textAlign: 'right',
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 13,
  fontVariantNumeric: 'tabular-nums',
  color: 'var(--color-xama-text)',
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
  const [lastUpdate,  setLastUpdate]  = useState(null)

  // Busca lineups e stats do dia — separada para poder re-chamar ao vivo
  const fetchDayData = useCallback((dayId) => {
    if (!stageId || !dayId) return
    Promise.all([
      token ? get(`${API_BASE_URL}/lineups/stage/${stageId}`, token) : Promise.resolve([]),
      get(`${API_BASE_URL}/stages/${stageId}/player-stats?stage_day_id=${dayId}`, null),
    ]).then(([lineupsData, statsData]) => {
      setLineups(Array.isArray(lineupsData) ? lineupsData : [])
      setPlayerStats(Array.isArray(statsData) ? statsData : [])
      setLastUpdate(new Date())
    }).catch(() => {})
  }, [stageId, token])

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

  // Carrega stats do dia ativo quando muda manualmente
  useEffect(() => {
    if (!stageId || !activeDayId) return
    get(`${API_BASE_URL}/stages/${stageId}/player-stats?stage_day_id=${activeDayId}`, null)
      .then(data => setPlayerStats(Array.isArray(data) ? data : []))
      .catch(() => setPlayerStats([]))
  }, [stageId, activeDayId])

  // WebSocket — atualiza automaticamente quando scoring roda
  const { connected: liveConnected } = useLiveScoring(
    activeDayId,
    () => fetchDayData(activeDayId),
  )

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
      <div className="xama-container" style={{ maxWidth: 720 }}>

        {/* Header */}
        <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h1 style={{
              fontSize: 22, fontWeight: 700, letterSpacing: '0.06em',
              textTransform: 'uppercase', color: 'var(--color-xama-text)', margin: 0,
            }}>
              Meus Resultados
            </h1>
            {stage && (
              <p style={{ fontSize: 13, color: 'var(--color-xama-muted)', margin: '4px 0 0' }}>
                {stage.name}
              </p>
            )}
          </div>
          {/* Indicador ao vivo */}
          {activeDayId && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 20, flexShrink: 0,
              background: liveConnected ? 'rgba(74,222,128,0.08)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${liveConnected ? 'rgba(74,222,128,0.25)' : 'var(--color-xama-border)'}`,
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                background: liveConnected ? 'var(--color-xama-green, #4ade80)' : 'var(--color-xama-muted)',
                animation: liveConnected ? 'xamaPulse 1.8s ease-in-out infinite' : 'none',
              }} />
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: liveConnected ? 'var(--color-xama-green, #4ade80)' : 'var(--color-xama-muted)' }}>
                {liveConnected ? 'Ao Vivo' : 'Offline'}
              </span>
              {lastUpdate && liveConnected && (
                <span style={{ fontSize: 10, color: 'var(--color-xama-muted)' }}>
                  · {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              )}
            </div>
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
              <MyLineupStatsTable
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

// ── MyLineupStatsTable ────────────────────────────────────────────────────────

function MyLineupStatsTable({ lineup, captainMultiplier, statByPersonId }) {
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
  const allPlayers = reserva ? [...titulares, reserva] : titulares

  const captainColor = 'var(--color-xama-gold)'

  return (
    <div style={{
      background: 'var(--surface-1)',
      border: '1px solid var(--color-xama-border)',
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: 20,
    }}>
      {/* Barra laranja no topo */}
      <div style={{ height: 2, background: 'linear-gradient(90deg, var(--color-xama-orange) 0%, transparent 60%)' }} />

      {/* Total do dia */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 16px',
        background: 'var(--surface-2)', borderBottom: '1px solid var(--color-xama-border)',
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-xama-muted)' }}>
          Total do dia
        </span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 700, color: isPending ? 'var(--color-xama-muted)' : 'var(--color-xama-orange)' }}>
          {isPending ? '—' : Number(lineup.total_points).toFixed(2)}
          {!isPending && <span style={{ fontSize: 12, color: 'var(--color-xama-muted)', marginLeft: 5 }}>pts</span>}
        </span>
      </div>

      {isPending && (
        <div style={{ padding: '10px 16px', background: 'rgba(250,204,21,0.06)', borderBottom: '1px solid rgba(250,204,21,0.15)', color: 'var(--color-xama-gold)', fontSize: 12, textAlign: 'center' }}>
          ⏳ Aguardando pontuação
        </div>
      )}

      {/* Tabela */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(0,0,0,0.25)', borderBottom: '1px solid var(--color-xama-border)' }}>
              <th style={thStyle(false)}>Jogador</th>
              <th style={thStyle(true)} title="Kills totais no dia">K</th>
              <th style={thStyle(true)} title="Dano total no dia">DMG</th>
              <th style={thStyle(true)} title="Assists totais no dia">ASS</th>
              <th style={thStyle(true)} title="Colocação média no dia">POS</th>
              <th style={thStyle(true)} title="Pontos XAMA brutos (sem multiplicador)">XAMA</th>
              <th style={thStyle(true)} title="Pontos fantasy (capitão com multiplicador)">FANTASY</th>
            </tr>
          </thead>
          <tbody>
            {allPlayers.map((lp, idx) => {
              const stat      = statByPersonId[lp.person_id] || null
              const isReserve = lp.slot_type === 'reserve'
              const pts       = lp.points_earned != null ? Number(lp.points_earned) : null
              const basePts   = lp.is_captain && pts != null ? pts / captainMultiplier : null
              const teamTag   = formatTeamTag(lp.person_name, lp.team_name)

              const kills    = stat?.total_kills ?? null
              const damage   = stat?.total_damage != null ? Math.round(stat.total_damage) : null
              const assists  = stat?.total_assists ?? null
              const avgPlace = stat?.avg_placement != null ? Math.round(stat.avg_placement) : null
              const xama     = stat?.total_xama_points ?? null

              return (
                <tr
                  key={lp.id}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    background: lp.is_captain
                      ? 'rgba(240,192,64,0.04)'
                      : isReserve
                        ? 'rgba(0,0,0,0.18)'
                        : idx % 2 === 1 ? 'rgba(255,255,255,0.015)' : 'transparent',
                    opacity: isReserve ? 0.72 : 1,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#161b27' }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = lp.is_captain
                      ? 'rgba(240,192,64,0.04)'
                      : isReserve
                        ? 'rgba(0,0,0,0.18)'
                        : idx % 2 === 1 ? 'rgba(255,255,255,0.015)' : 'transparent'
                  }}
                >
                  {/* Jogador */}
                  <td style={{ padding: '9px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <TeamLogo teamName={teamTag} size={24} />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'nowrap' }}>
                          <span style={{
                            fontSize: 13, fontWeight: 600,
                            color: lp.is_captain ? captainColor : isReserve ? 'var(--color-xama-muted)' : 'var(--color-xama-text)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150,
                          }}>
                            {fmt(lp.person_name)}
                          </span>
                          {lp.is_captain && (
                            <span style={{ fontSize: 9, fontWeight: 800, color: captainColor, background: 'rgba(240,192,64,0.14)', border: '1px solid rgba(240,192,64,0.35)', borderRadius: 3, padding: '1px 5px', letterSpacing: '0.06em', flexShrink: 0 }}>
                              ⭐ CAP
                            </span>
                          )}
                          {isReserve && (
                            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--color-xama-blue)', background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 3, padding: '1px 4px', letterSpacing: '0.06em', flexShrink: 0 }}>
                              RES
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--color-xama-muted)', marginTop: 1 }}>{teamTag}</div>
                      </div>
                    </div>
                  </td>

                  {/* K */}
                  <td style={{ ...tdStyle, color: kills != null && kills >= 5 ? '#fb923c' : kills != null && kills >= 3 ? '#fbbf24' : 'var(--color-xama-muted)' }}>
                    {kills !== null ? kills : '—'}
                  </td>

                  {/* DMG */}
                  <td style={{ ...tdStyle, color: damage != null && damage >= 800 ? '#4ade80' : damage != null && damage >= 400 ? '#a3e635' : 'var(--color-xama-muted)' }}>
                    {damage !== null ? damage : '—'}
                  </td>

                  {/* ASS */}
                  <td style={{ ...tdStyle, color: 'var(--color-xama-muted)' }}>
                    {assists !== null ? assists : '—'}
                  </td>

                  {/* POS */}
                  <td style={{ ...tdStyle, color: avgPlace != null && avgPlace <= 3 ? '#fde68a' : 'var(--color-xama-muted)' }}>
                    {avgPlace !== null ? `#${avgPlace}` : '—'}
                  </td>

                  {/* XAMA */}
                  <td style={{ ...tdStyle, color: 'var(--color-xama-orange)' }}>
                    {xama !== null ? Number(xama).toFixed(2) : '—'}
                  </td>

                  {/* FANTASY */}
                  <td style={{ ...tdStyle, color: lp.is_captain ? captainColor : isReserve ? 'var(--color-xama-muted)' : 'var(--color-xama-text)', fontWeight: 700 }}>
                    {pts !== null ? (
                      <div>
                        <div>{pts.toFixed(2)}</div>
                        {lp.is_captain && basePts !== null && (
                          <div style={{ fontSize: 9, fontWeight: 400, color: 'var(--color-xama-muted)' }}>
                            {basePts.toFixed(1)} ×{captainMultiplier.toFixed(2)}
                          </div>
                        )}
                      </div>
                    ) : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

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
