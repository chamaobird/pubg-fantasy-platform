// frontend/src/components/TournamentLeaderboard.jsx
// XAMA Fantasy — Leaderboard v4: removed Lineup column, EU badge in Manager

import { useEffect, useState } from 'react'
import { API_BASE_URL } from '../config'
import TeamLogo from './TeamLogo'
import ChampionshipSelector from './ChampionshipSelector'

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

  const fetchRankings = () => {
    if (!tournamentId) return
    setLoading(true); setError(null)
    fetch(`${API_BASE_URL}/tournaments/${tournamentId}/rankings`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((data) => { setRankings(data); setLoading(false) })
      .catch((e) => { setError(e.message || 'Erro desconhecido'); setLoading(false) })
  }

  useEffect(() => { setRankings([]); setExpanded({}); fetchRankings() }, [tournamentId]) // eslint-disable-line

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
            <button className="dark-btn flex items-center gap-2" onClick={fetchRankings} disabled={loading}
              style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600 }}>
              <span style={{ fontSize: '13px' }}>↻</span>
              {loading ? 'Carregando…' : 'Atualizar'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {loading && <p className="text-center py-20 text-[13px]" style={{ color: 'var(--color-xama-muted)' }}>Carregando leaderboard…</p>}
        {error && !loading && <div className="msg-error max-w-lg mx-auto mt-8">Erro ao carregar: {error}</div>}
        {!loading && !error && !tournamentId && (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <span style={{ fontSize: '48px' }}>🏆</span>
            <p className="text-[16px] font-semibold tracking-[0.06em] uppercase" style={{ color: 'var(--color-xama-muted)' }}>Selecione um torneio</p>
          </div>
        )}
        {!loading && !error && tournamentId && rankings.length === 0 && (
          <p className="text-center py-20 text-[13px]" style={{ color: 'var(--color-xama-muted)' }}>Nenhum lineup encontrado para este torneio.</p>
        )}

        {!loading && !error && rankings.length > 0 && (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-xama-border)', background: 'var(--color-xama-surface)' }}>
            <div style={{ height: '2px', background: 'linear-gradient(90deg, var(--color-xama-gold) 0%, transparent 50%)' }} />
            <table className="w-full border-collapse">
              <thead>
                <tr style={{ background: '#0a0c11', borderBottom: '1px solid var(--color-xama-border)' }}>
                  {['#', 'Manager', 'Pontos', ''].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-[10px] font-bold tracking-[0.1em] uppercase"
                      style={{ color: 'var(--color-xama-muted)', textAlign: i >= 2 ? 'right' : 'left',
                        fontFamily: "'Rajdhani', sans-serif", width: i === 0 ? '52px' : i === 3 ? '120px' : undefined }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rankings.map((entry) => {
                  const isOpen = !!expanded[entry.lineup_id]
                  const isMe = myLineupIds.has(entry.lineup_id)
                  const pos = entry.position
                  const isTop3 = pos <= 3
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

                        {/* Manager + EU badge */}
                        <td className="px-4 py-[13px]">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className="text-[13px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-xama-muted)' }}>
                              {ownerLabel(entry)}
                            </span>
                            {isMe && (
                              <span className="text-[10px] font-bold tracking-[0.06em] px-2 py-0.5 rounded"
                                style={{ background: 'rgba(20,184,166,0.18)', border: '1px solid rgba(20,184,166,0.4)', color: '#2dd4bf' }}>
                                EU
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Pontos */}
                        <td className="px-4 py-[13px] text-right">
                          <span className="text-[15px] font-bold tabular-nums"
                            style={{ fontFamily: "'JetBrains Mono', monospace",
                              color: anyPoints && entry.total_points > 0 ? 'var(--color-xama-gold)' : '#374151' }}>
                            {entry.total_points.toFixed(2)}
                          </span>
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
                {rankings.length} lineups
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
