// frontend/src/components/TournamentLeaderboard.jsx
// XAMA Fantasy — Leaderboard v6: multi-day support + per-day/match view

import { useEffect, useState, useMemo } from 'react'
import { API_BASE_URL } from '../config'
import TeamLogo from './TeamLogo'
import ChampionshipSelector from './ChampionshipSelector'

const MAP_ICONS = { Erangel: '🌿', Miramar: '🏜️', Taego: '🌾', Rondo: '❄️', Vikendi: '❄️', Deston: '🌊' }

const selectStyle = {
  background: '#0d0f14',
  border: '1px solid var(--color-xama-border)',
  borderRadius: '6px',
  color: 'var(--color-xama-text)',
  padding: '5px 8px',
  fontSize: '12px',
  fontFamily: "'Rajdhani', sans-serif",
  cursor: 'pointer',
  outline: 'none',
}

const formatPlayerName = (name) => {
  if (!name) return '—'
  const parts = name.split('_')
  return parts.length > 1 ? parts.slice(1).join('_') : name
}
const getTeamTag = (name) => {
  if (!name) return ''
  const parts = name.split('_')
  return parts.length > 1 ? parts[0] : ''
}
const ownerLabel = (entry) => entry.display_name || entry.username || `#${entry.user_id}`

const RANK_COLORS = { 1: '#f0c040', 2: '#b4bcc8', 3: '#cd7f50' }
const RANK_LABELS = { 1: '01', 2: '02', 3: '03' }
const RANK_BG = {
  1: 'rgba(240,192,64,0.04)',
  2: 'rgba(180,188,200,0.03)',
  3: 'rgba(176,120,80,0.03)',
}

export default function TournamentLeaderboard({
  token = '',
  tournaments = [],
  tournamentsLoading = false,
  selectedTournamentId = '',
  onTournamentChange,
  championships = [],
  championshipsLoading = false,
  selectedChampId = null,
  onChampChange,
}) {
  const [rankings, setRankings] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState({})
  const [myLineupIds, setMyLineupIds] = useState(new Set())
  const tournamentId = selectedTournamentId

  // Filtro por dia de competição (lineup day) — null = total acumulado
  const [selectedLineupDay, setSelectedLineupDay] = useState(null)

  // Filtro por data/partida (client-side re-ranking por player stats)
  const [matchDays, setMatchDays] = useState([])
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedMatch, setSelectedMatch] = useState('')
  const [dayStats, setDayStats] = useState({})
  const [dayStatsLoading, setDayStatsLoading] = useState(false)

  // ── Fetch rankings (aceita lineup day opcional) ────────────────────────────
  const fetchRankings = (lineupDay = selectedLineupDay) => {
    if (!tournamentId) return
    setLoading(true); setError(null)
    const url = lineupDay != null
      ? `${API_BASE_URL}/tournaments/${tournamentId}/rankings?day=${lineupDay}`
      : `${API_BASE_URL}/tournaments/${tournamentId}/rankings`
    fetch(url)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((data) => { setRankings(data); setLoading(false) })
      .catch((e) => { setError(e.message || 'Erro desconhecido'); setLoading(false) })
  }

  // ── Reset e re-fetch ao trocar torneio ────────────────────────────────────
  useEffect(() => {
    setRankings([]); setExpanded({})
    setMatchDays([]); setSelectedDate(''); setSelectedMatch(''); setDayStats({})
    setSelectedLineupDay(null)
    fetchRankings(null)
    if (tournamentId) {
      fetch(`${API_BASE_URL}/tournaments/${tournamentId}/matches`)
        .then((r) => r.ok ? r.json() : null)
        .then((d) => { if (d?.days) setMatchDays(d.days) })
        .catch(() => {})
    }
  }, [tournamentId]) // eslint-disable-line

  // ── Re-fetch rankings ao trocar dia de competição ─────────────────────────
  useEffect(() => {
    setSelectedDate(''); setSelectedMatch(''); setDayStats({})
    fetchRankings(selectedLineupDay)
  }, [selectedLineupDay]) // eslint-disable-line

  // ── Busca stats de player para o dia/partida selecionado (re-ranking) ─────
  useEffect(() => {
    if (!tournamentId || (!selectedDate && !selectedMatch)) { setDayStats({}); return }
    setDayStatsLoading(true)
    let url = `${API_BASE_URL}/tournaments/${tournamentId}/player-stats?limit=200`
    if (selectedMatch) url += `&match_id=${selectedMatch}`
    else if (selectedDate) url += `&date=${selectedDate}`
    fetch(url)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        const map = {}
        data.forEach((p) => { map[p.player_id] = p.total_fantasy_points || 0 })
        setDayStats(map)
        setDayStatsLoading(false)
      })
      .catch(() => { setDayStats({}); setDayStatsLoading(false) })
  }, [selectedDate, selectedMatch, tournamentId])

  useEffect(() => { setSelectedMatch('') }, [selectedDate])

  // ── Dias de competição disponíveis (extraídos dos matchDays) ──────────────
  const competitionDays = useMemo(() => {
    const days = [...new Set(matchDays.map((d) => d.day).filter(Boolean))].sort()
    return days.length > 1 ? days : []
  }, [matchDays])

  // ── matchDays filtrados pelo dia de competição selecionado ─────────────────
  const filteredMatchDays = useMemo(() => {
    if (!selectedLineupDay) return matchDays
    return matchDays.filter((d) => d.day === selectedLineupDay)
  }, [matchDays, selectedLineupDay])

  const matchesForDay = useMemo(() => {
    if (!selectedDate) return []
    return filteredMatchDays.find((d) => d.date === selectedDate)?.matches || []
  }, [selectedDate, filteredMatchDays])

  // ── Re-ranking client-side por stats do período ───────────────────────────
  const rankingsWithDayPts = useMemo(() => {
    const hasDayFilter = Object.keys(dayStats).length > 0
    if (!hasDayFilter) return rankings
    return [...rankings]
      .map((entry) => ({
        ...entry,
        day_points: entry.players.reduce((sum, p) => sum + (dayStats[p.id] || 0), 0),
      }))
      .sort((a, b) => b.day_points - a.day_points)
      .map((entry, i) => ({ ...entry, display_position: i + 1 }))
  }, [rankings, dayStats])

  const hasDayFilter = !!(selectedDate || selectedMatch)
  const hasLineupDayFilter = selectedLineupDay != null

  // ── Meus lineup IDs para highlight EU ────────────────────────────────────
  useEffect(() => {
    if (!token || !tournamentId) { setMyLineupIds(new Set()); return }
    fetch(`${API_BASE_URL}/tournaments/${tournamentId}/lineups/me`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => { const ids = new Set((Array.isArray(data) ? data : []).map((l) => l.id)); setMyLineupIds(ids) })
      .catch(() => setMyLineupIds(new Set()))
  }, [token, tournamentId])

  const toggle = (id) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  const anyPoints = rankings.some((r) => r.total_points > 0)
  const selectedTournament = tournaments.find((t) => String(t.id) === String(tournamentId))

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-xama-black)', fontFamily: "'Rajdhani', sans-serif" }}>
      <div className="px-6 py-5 border-b" style={{ background: 'var(--color-xama-surface)', borderColor: 'var(--color-xama-border)' }}>
        <div className="max-w-3xl mx-auto flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span style={{ fontSize: '22px', lineHeight: 1 }}>🏆</span>
              <h1 className="text-[28px] font-bold tracking-tight" style={{ color: 'var(--color-xama-text)', letterSpacing: '-0.01em' }}>LEADERBOARD</h1>
            </div>
            <p className="text-[11px] tracking-[0.1em] uppercase" style={{ color: 'var(--color-xama-muted)' }}>
              {selectedTournament ? `${selectedTournament.name}${selectedTournament.region ? ' · ' + selectedTournament.region : ''}` : tournamentId ? `Torneio #${tournamentId}` : '—'}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {championships.length > 0 && (
              <ChampionshipSelector
                championships={championships}
                loading={championshipsLoading}
                selectedChampId={selectedChampId ? Number(selectedChampId) : null}
                onChampChange={onChampChange}
                selectedTournId={selectedTournamentId ? Number(selectedTournamentId) : null}
                onTournChange={(tid) => onTournamentChange?.(tid)}
                tournaments={tournaments}
                allowAggregated={false}
              />
            )}
            <button className="dark-btn flex items-center gap-2" onClick={() => fetchRankings()} disabled={loading}
              style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600 }}>
              <span style={{ fontSize: '13px' }}>↻</span>
              {loading ? 'Carregando…' : 'Atualizar'}
            </button>
          </div>
        </div>

        {/* ── Seletores de filtro ─────────────────────────────────────────── */}
        <div className="max-w-3xl mx-auto mt-3 flex flex-wrap items-center gap-2">

          {/* Seletor de dia de competição (aparece só quando há múltiplos dias) */}
          {competitionDays.length > 0 && (
            <div className="flex items-center gap-1">
              {/* Chip "Total" */}
              <button
                onClick={() => setSelectedLineupDay(null)}
                style={{
                  ...selectStyle,
                  padding: '4px 10px',
                  fontWeight: 600,
                  background: !hasLineupDayFilter ? 'rgba(240,192,64,0.12)' : '#0d0f14',
                  borderColor: !hasLineupDayFilter ? 'rgba(240,192,64,0.5)' : 'var(--color-xama-border)',
                  color: !hasLineupDayFilter ? '#f0c040' : 'var(--color-xama-muted)',
                }}>
                Total
              </button>
              {competitionDays.map((d) => (
                <button
                  key={d}
                  onClick={() => setSelectedLineupDay(d)}
                  style={{
                    ...selectStyle,
                    padding: '4px 10px',
                    fontWeight: 600,
                    background: selectedLineupDay === d ? 'rgba(96,165,250,0.12)' : '#0d0f14',
                    borderColor: selectedLineupDay === d ? 'rgba(96,165,250,0.5)' : 'var(--color-xama-border)',
                    color: selectedLineupDay === d ? '#60a5fa' : 'var(--color-xama-muted)',
                  }}>
                  Dia {d}
                </button>
              ))}
            </div>
          )}

          {/* Separador visual */}
          {competitionDays.length > 0 && filteredMatchDays.length > 0 && (
            <span style={{ color: 'var(--color-xama-border)', fontSize: '16px' }}>|</span>
          )}

          {/* Filtro por data (dentro do dia de competição selecionado) */}
          {filteredMatchDays.length > 0 && (
            <select value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={{ ...selectStyle }}>
              <option value="">{hasLineupDayFilter ? `Dia ${selectedLineupDay} inteiro` : 'Acumulado total'}</option>
              {filteredMatchDays.map((d) => {
                const [, mm, dd] = d.date.split('-')
                return <option key={d.date} value={d.date}>{dd}/{mm} ({d.matches_count}M)</option>
              })}
            </select>
          )}

          {/* Filtro por partida */}
          {selectedDate && matchesForDay.length > 0 && (
            <select value={selectedMatch} onChange={(e) => setSelectedMatch(e.target.value)} style={{ ...selectStyle }}>
              <option value="">Dia inteiro</option>
              {matchesForDay.map((m) => (
                <option key={m.id} value={m.id}>
                  {MAP_ICONS[m.map_name] || '🗺️'} P{m.match_number_in_day} — {m.map_name}
                </option>
              ))}
            </select>
          )}

          {/* Botão limpar filtros de data/partida */}
          {hasDayFilter && (
            <button onClick={() => { setSelectedDate(''); setSelectedMatch('') }}
              style={{ ...selectStyle, color: '#f87171', borderColor: 'rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.05)' }}>
              ✕ Limpar
            </button>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {(loading || dayStatsLoading) && <p className="text-center py-20 text-[13px]" style={{ color: 'var(--color-xama-muted)' }}>{loading ? 'Carregando leaderboard…' : 'Calculando pontos do período…'}</p>}
        {error && !loading && <div className="msg-error max-w-lg mx-auto mt-8">Erro ao carregar: {error}</div>}
        {!loading && !error && !tournamentId && (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <span style={{ fontSize: '48px' }}>🏆</span>
            <p className="text-[16px] font-semibold tracking-[0.06em] uppercase" style={{ color: 'var(--color-xama-muted)' }}>Selecione um torneio</p>
          </div>
        )}
        {!loading && !error && tournamentId && rankingsWithDayPts.length === 0 && (
          <p className="text-center py-20 text-[13px]" style={{ color: 'var(--color-xama-muted)' }}>
            {hasLineupDayFilter
              ? `Nenhum lineup encontrado para Dia ${selectedLineupDay}.`
              : 'Nenhum lineup encontrado para este torneio.'
            }
          </p>
        )}

        {!loading && !error && rankingsWithDayPts.length > 0 && (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-xama-border)', background: 'var(--color-xama-surface)' }}>
            <div style={{ height: '2px', background: 'linear-gradient(90deg, var(--color-xama-gold) 0%, transparent 50%)' }} />

            {/* Banner de contexto do filtro */}
            {(hasLineupDayFilter || hasDayFilter) && (
              <div className="px-4 py-2 text-[11px] font-bold tracking-[0.08em] uppercase"
                style={{ background: 'rgba(96,165,250,0.08)', borderBottom: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa', fontFamily: "'JetBrains Mono', monospace" }}>
                {hasLineupDayFilter && !hasDayFilter && `📅 Lineup Dia ${selectedLineupDay} — pontos acumulados do dia`}
                {hasLineupDayFilter && hasDayFilter && selectedMatch && `📅 Dia ${selectedLineupDay} · Partida ${matchesForDay.find(m => String(m.id) === String(selectedMatch))?.match_number_in_day || ''} — re-ranking por período`}
                {hasLineupDayFilter && hasDayFilter && !selectedMatch && `📅 Dia ${selectedLineupDay} · ${selectedDate.split('-').slice(1).reverse().join('/')} — re-ranking por período`}
                {!hasLineupDayFilter && hasDayFilter && selectedMatch && `📅 Partida ${matchesForDay.find(m => String(m.id) === String(selectedMatch))?.match_number_in_day || ''} · ${matchesForDay.find(m => String(m.id) === String(selectedMatch))?.map_name || ''} — re-ranking por período`}
                {!hasLineupDayFilter && hasDayFilter && !selectedMatch && `📅 ${selectedDate.split('-').slice(1).reverse().join('/')} — re-ranking por período`}
              </div>
            )}

            <table className="w-full border-collapse">
              <thead>
                <tr style={{ background: '#0a0c11', borderBottom: '1px solid var(--color-xama-border)' }}>
                  {['#', 'Manager', hasDayFilter ? 'Pts (período)' : hasLineupDayFilter ? `Pts Dia ${selectedLineupDay}` : 'Pontos', ''].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-[10px] font-bold tracking-[0.1em] uppercase"
                      style={{ color: 'var(--color-xama-muted)', textAlign: i >= 2 ? 'right' : 'left',
                        fontFamily: "'Rajdhani', sans-serif", width: i === 0 ? '52px' : i === 3 ? '120px' : undefined }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rankingsWithDayPts.map((entry) => {
                  const isOpen = !!expanded[entry.lineup_id]
                  const isMe = myLineupIds.has(entry.lineup_id)
                  const pos = hasDayFilter ? (entry.display_position ?? entry.position) : entry.position
                  const isTop3 = pos <= 3
                  // Dias em que o user tem lineup (ex: [1, 2])
                  const daysPlayed = entry.days_played || []
                  const isMultiDay = daysPlayed.length > 1

                  return (
                    <>
                      <tr key={entry.lineup_id}
                        style={{ borderBottom: isOpen ? 'none' : '1px solid #13161f',
                          background: isMe ? 'rgba(20,184,166,0.06)' : isTop3 ? RANK_BG[pos] : 'transparent',
                          outline: isMe ? '1px solid rgba(20,184,166,0.18)' : 'none', outlineOffset: '-1px' }}
                        onMouseEnter={(e) => { if (!isMe) e.currentTarget.style.background = '#161b27' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = isMe ? 'rgba(20,184,166,0.06)' : isTop3 ? RANK_BG[pos] : 'transparent' }}>

                        {/* # */}
                        <td className="px-4 py-[13px]">
                          <span className="text-[13px] font-bold tabular-nums"
                            style={{ fontFamily: "'JetBrains Mono', monospace", color: isTop3 ? RANK_COLORS[pos] : '#2a3046' }}>
                            {RANK_LABELS[pos] ?? String(pos).padStart(2, '0')}
                          </span>
                        </td>

                        {/* Manager + badges */}
                        <td className="px-4 py-[13px]">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span className="text-[13px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-xama-muted)' }}>
                              {ownerLabel(entry)}
                            </span>
                            {isMe && (
                              <span className="text-[10px] font-bold tracking-[0.06em] px-2 py-0.5 rounded"
                                style={{ background: 'rgba(20,184,166,0.18)', border: '1px solid rgba(20,184,166,0.4)', color: '#2dd4bf' }}>
                                EU
                              </span>
                            )}
                            {/* Badges de dias se o user tem lineup em múltiplos dias */}
                            {isMultiDay && !hasLineupDayFilter && daysPlayed.map((d) => (
                              <span key={d} className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                                style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)', color: '#60a5fa', fontFamily: "'JetBrains Mono', monospace" }}>
                                D{d}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Pontos */}
                        <td className="px-4 py-[13px] text-right">
                          <span className="text-[15px] font-bold tabular-nums"
                            style={{ fontFamily: "'JetBrains Mono', monospace",
                              color: hasDayFilter
                                ? (entry.day_points > 0 ? '#60a5fa' : '#374151')
                                : (anyPoints && entry.total_points > 0 ? 'var(--color-xama-gold)' : '#374151') }}>
                            {hasDayFilter
                              ? (entry.day_points ?? 0).toFixed(2)
                              : entry.total_points.toFixed(2)
                            }
                          </span>
                          {/* Subscrito: total acumulado quando em filtro de dia */}
                          {hasDayFilter && entry.total_points > 0 && (
                            <div className="text-[10px] tabular-nums" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-xama-muted)' }}>
                              total: {entry.total_points.toFixed(2)}
                            </div>
                          )}
                        </td>

                        {/* Ver */}
                        <td className="px-4 py-[13px] text-right">
                          <button onClick={() => toggle(entry.lineup_id)}
                            className="text-[11px] font-semibold tracking-[0.04em] px-3 py-1 rounded"
                            style={{ background: '#1a1f2e', border: '1px solid var(--color-xama-border)',
                              color: 'var(--color-xama-muted)', fontFamily: "'Rajdhani', sans-serif", cursor: 'pointer' }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-xama-text)'; e.currentTarget.style.borderColor = '#3d4d6e' }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-xama-muted)'; e.currentTarget.style.borderColor = 'var(--color-xama-border)' }}>
                            {isOpen ? '▲ Ocultar' : `▼ Ver (${entry.players.length})`}
                          </button>
                        </td>
                      </tr>

                      {isOpen && (
                        <tr key={`${entry.lineup_id}-players`}>
                          <td colSpan={4} style={{ padding: 0, background: '#0a0c11', borderBottom: '1px solid #13161f' }}>
                            {/* Label do dia quando em visão total */}
                            {!hasLineupDayFilter && entry.day != null && (
                              <div style={{ padding: '4px 16px 0 52px', fontSize: '10px', color: '#60a5fa', fontFamily: "'JetBrains Mono', monospace", opacity: 0.7 }}>
                                Mostrando lineup Dia {entry.day}
                              </div>
                            )}
                            <ul style={{ margin: 0, padding: '4px 0', listStyle: 'none' }}>
                              {entry.players.map((p) => {
                                const teamTag = getTeamTag(p.name)
                                return (
                                  <li key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '7px 16px 7px 52px', borderBottom: '1px solid #14171f',
                                    fontSize: '12px', color: 'var(--color-xama-muted)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      {teamTag && <TeamLogo teamName={teamTag} size={18} />}
                                      <span style={{ color: '#c4cad6' }}>{formatPlayerName(p.name)}</span>
                                    </div>
                                    <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#4b5563', fontSize: '11px' }}>
                                      {Number(p.fantasy_cost).toFixed(1)} cr
                                    </span>
                                  </li>
                                )
                              })}
                            </ul>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
            <div className="px-5 py-3 flex items-center justify-between"
              style={{ borderTop: '1px solid var(--color-xama-border)', background: '#0a0c11' }}>
              <span className="text-[11px] font-bold tracking-[0.1em] uppercase"
                style={{ color: 'var(--color-xama-gold)', fontFamily: "'Rajdhani', sans-serif" }}>🏆 XAMA Fantasy</span>
              <span className="text-[11px] tabular-nums"
                style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-xama-muted)' }}>
                {rankingsWithDayPts.length} {hasLineupDayFilter ? `lineups · Dia ${selectedLineupDay}` : 'managers'}
                {hasDayFilter ? ' · período filtrado' : ''}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
