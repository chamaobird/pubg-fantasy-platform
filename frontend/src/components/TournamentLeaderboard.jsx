// frontend/src/components/TournamentLeaderboard.jsx
// XAMA Fantasy — Leaderboard migrado para /stages/ (Fase 7)

import { useEffect, useState, useMemo } from 'react'
import { API_BASE_URL } from '../config'

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

const RANK_COLORS = { 1: '#f0c040', 2: '#b4bcc8', 3: '#cd7f50' }
const RANK_BG    = {
  1: 'rgba(240,192,64,0.04)',
  2: 'rgba(180,188,200,0.03)',
  3: 'rgba(176,120,80,0.03)',
}

const ownerLabel = (entry) => entry.username || `#${entry.user_id.slice(0, 8)}`

export default function TournamentLeaderboard({
  token = '',
  stageId = '',
}) {

  // ── Dados de dias e partidas ───────────────────────────────────────────────
  const [stageDays, setStageDays]     = useState([])   // [{id, day_number, date}]
  const [selectedDayId, setSelectedDayId] = useState(null) // null = acumulado

  // Partidas do dia selecionado
  const [matches, setMatches]           = useState([])
  const [selectedMatchId, setSelectedMatchId] = useState(null)

  // ── Leaderboard ────────────────────────────────────────────────────────────
  const [rankings, setRankings]   = useState([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)
  const [myUserId, setMyUserId]   = useState(null)

  // ── Reset ao trocar stage ──────────────────────────────────────────────────
  useEffect(() => {
    setStageDays([]); setSelectedDayId(null)
    setMatches([]); setSelectedMatchId(null)
    setRankings([]); setError(null)

    if (!stageId) return

    // Busca dias da stage
    fetch(`${API_BASE_URL}/stages/${stageId}/days`)
      .then((r) => r.ok ? r.json() : [])
      .then(setStageDays)
      .catch(() => {})

    // Busca leaderboard acumulado
    fetchLeaderboard(null, null)
  }, [stageId]) // eslint-disable-line

  // ── Busca partidas ao selecionar um dia ───────────────────────────────────
  useEffect(() => {
    setMatches([]); setSelectedMatchId(null)
    if (!stageId || !selectedDayId) return
    fetch(`${API_BASE_URL}/stages/${stageId}/days/${selectedDayId}/matches`)
      .then((r) => r.ok ? r.json() : [])
      .then(setMatches)
      .catch(() => {})
  }, [stageId, selectedDayId]) // eslint-disable-line

  // ── Re-fetch leaderboard ao mudar filtro ──────────────────────────────────
  useEffect(() => {
    if (!stageId) return
    fetchLeaderboard(selectedDayId, selectedMatchId)
  }, [selectedDayId, selectedMatchId]) // eslint-disable-line

  // ── Meu user_id para highlight "EU" ───────────────────────────────────────
  useEffect(() => {
    if (!token) { setMyUserId(null); return }
    fetch(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.id) setMyUserId(d.id) })
      .catch(() => {})
  }, [token])

  // ── Fetch leaderboard ─────────────────────────────────────────────────────
  const fetchLeaderboard = (dayId, matchId) => {
    if (!stageId) return
    setLoading(true); setError(null)

    let url
    if (dayId) {
      url = `${API_BASE_URL}/stages/${stageId}/days/${dayId}/leaderboard`
    } else {
      url = `${API_BASE_URL}/stages/${stageId}/leaderboard`
    }

    fetch(url)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((data) => { setRankings(data); setLoading(false) })
      .catch((e) => { setError(e.message); setLoading(false) })
  }

  // ── Computed ───────────────────────────────────────────────────────────────
  const hasMultipleDays   = stageDays.length > 1
  const selectedDay       = stageDays.find((d) => d.id === selectedDayId)
  const anyPoints         = rankings.some((r) => (r.total_points ?? r.points ?? 0) > 0)

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-xama-black)', fontFamily: "'Rajdhani', sans-serif" }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="px-6 py-5 border-b" style={{ background: 'var(--color-xama-surface)', borderColor: 'var(--color-xama-border)' }}>
        <div className="max-w-3xl mx-auto flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span style={{ fontSize: '22px', lineHeight: 1 }}>🏆</span>
              <h1 className="text-[28px] font-bold tracking-tight" style={{ color: 'var(--color-xama-text)', letterSpacing: '-0.01em' }}>LEADERBOARD</h1>
            </div>
            <p className="text-[11px] tracking-[0.1em] uppercase" style={{ color: 'var(--color-xama-muted)' }}>
              {stageId ? `Stage #${stageId}` : '—'}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              className="dark-btn flex items-center gap-2"
              onClick={() => fetchLeaderboard(selectedDayId, selectedMatchId)}
              disabled={loading}
              style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600 }}>
              <span style={{ fontSize: '13px' }}>↻</span>
              {loading ? 'Carregando…' : 'Atualizar'}
            </button>
          </div>
        </div>

        {/* ── Filtros ─────────────────────────────────────────────────────── */}
        <div className="max-w-3xl mx-auto mt-3 flex flex-wrap items-center gap-2">

          {/* Chips de dia — só aparecem se a stage tem múltiplos dias */}
          {hasMultipleDays && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSelectedDayId(null)}
                style={{
                  ...selectStyle,
                  padding: '4px 10px', fontWeight: 600,
                  background: !selectedDayId ? 'rgba(240,192,64,0.12)' : '#0d0f14',
                  borderColor: !selectedDayId ? 'rgba(240,192,64,0.5)' : 'var(--color-xama-border)',
                  color: !selectedDayId ? '#f0c040' : 'var(--color-xama-muted)',
                }}>
                Total
              </button>
              {stageDays.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setSelectedDayId(d.id)}
                  style={{
                    ...selectStyle,
                    padding: '4px 10px', fontWeight: 600,
                    background: selectedDayId === d.id ? 'rgba(96,165,250,0.12)' : '#0d0f14',
                    borderColor: selectedDayId === d.id ? 'rgba(96,165,250,0.5)' : 'var(--color-xama-border)',
                    color: selectedDayId === d.id ? '#60a5fa' : 'var(--color-xama-muted)',
                  }}>
                  Dia {d.day_number}
                </button>
              ))}
            </div>
          )}

          {/* Separador */}
          {hasMultipleDays && matches.length > 0 && (
            <span style={{ color: 'var(--color-xama-border)', fontSize: '16px' }}>|</span>
          )}

          {/* Nota: o leaderboard por partida não existe como endpoint separado.
              Quando o usuário selecionar uma partida, redirecionamos para PlayerStats
              ou exibimos um aviso. Por ora, mostramos o ranking do dia. */}
          {selectedDayId && matches.length > 0 && (
            <span className="text-[11px]" style={{ color: 'var(--color-xama-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
              {matches.length} partida{matches.length !== 1 ? 's' : ''} no dia
            </span>
          )}

          {/* Limpar filtro de dia */}
          {selectedDayId && (
            <button
              onClick={() => setSelectedDayId(null)}
              style={{ ...selectStyle, color: '#f87171', borderColor: 'rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.05)' }}>
              ✕ Limpar
            </button>
          )}
        </div>
      </div>

      {/* ── Conteúdo ───────────────────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        {loading && (
          <p className="text-center py-20 text-[13px]" style={{ color: 'var(--color-xama-muted)' }}>
            Carregando leaderboard…
          </p>
        )}
        {error && !loading && (
          <div className="msg-error max-w-lg mx-auto mt-8">Erro ao carregar: {error}</div>
        )}
        {!loading && !error && !stageId && (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <span style={{ fontSize: '48px' }}>🏆</span>
            <p className="text-[16px] font-semibold tracking-[0.06em] uppercase" style={{ color: 'var(--color-xama-muted)' }}>
              Selecione um torneio
            </p>
          </div>
        )}
        {!loading && !error && stageId && rankings.length === 0 && (
          <p className="text-center py-20 text-[13px]" style={{ color: 'var(--color-xama-muted)' }}>
            {selectedDayId
              ? `Nenhum resultado para Dia ${selectedDay?.day_number ?? ''}.`
              : 'Nenhum resultado para este torneio ainda.'}
          </p>
        )}

        {!loading && !error && rankings.length > 0 && (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-xama-border)', background: 'var(--color-xama-surface)' }}>
            <div style={{ height: '2px', background: 'linear-gradient(90deg, var(--color-xama-gold) 0%, transparent 50%)' }} />

            {/* Banner de contexto */}
            {selectedDayId && (
              <div className="px-4 py-2 text-[11px] font-bold tracking-[0.08em] uppercase"
                style={{ background: 'rgba(96,165,250,0.08)', borderBottom: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa', fontFamily: "'JetBrains Mono', monospace" }}>
                📅 Dia {selectedDay?.day_number} —{' '}
                {selectedDay?.date ? new Date(selectedDay.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : ''}
              </div>
            )}

            <table className="w-full border-collapse">
              <thead>
                <tr style={{ background: '#0a0c11', borderBottom: '1px solid var(--color-xama-border)' }}>
                  {['#', 'Manager', selectedDayId ? 'Pts (dia)' : 'Pontos'].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-[10px] font-bold tracking-[0.1em] uppercase"
                      style={{
                        color: 'var(--color-xama-muted)',
                        textAlign: i >= 2 ? 'right' : 'left',
                        fontFamily: "'Rajdhani', sans-serif",
                        width: i === 0 ? '52px' : undefined,
                      }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rankings.map((entry, idx) => {
                  const pos   = entry.rank ?? (idx + 1)
                  const isTop3 = pos <= 3
                  const isMe  = entry.user_id === myUserId
                  const pts   = entry.total_points ?? entry.points ?? 0

                  return (
                    <tr key={entry.user_id}
                      style={{
                        borderBottom: '1px solid #13161f',
                        background: isMe ? 'rgba(20,184,166,0.06)' : isTop3 ? RANK_BG[pos] : 'transparent',
                        outline: isMe ? '1px solid rgba(20,184,166,0.18)' : 'none',
                        outlineOffset: '-1px',
                      }}
                      onMouseEnter={(e) => { if (!isMe) e.currentTarget.style.background = '#161b27' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = isMe ? 'rgba(20,184,166,0.06)' : isTop3 ? RANK_BG[pos] : 'transparent' }}>

                      {/* Rank */}
                      <td className="px-4 py-[13px]">
                        <span className="text-[13px] font-bold tabular-nums"
                          style={{ fontFamily: "'JetBrains Mono', monospace", color: isTop3 ? RANK_COLORS[pos] : '#2a3046' }}>
                          {String(pos).padStart(2, '0')}
                        </span>
                      </td>

                      {/* Manager */}
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
                          {/* Badge de dias jogados no acumulado */}
                          {!selectedDayId && entry.days_played > 0 && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                              style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)', color: '#60a5fa', fontFamily: "'JetBrains Mono', monospace" }}>
                              {entry.days_played}D
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Pontos */}
                      <td className="px-4 py-[13px] text-right">
                        <span className="text-[15px] font-bold tabular-nums"
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            color: pts > 0 ? (selectedDayId ? '#60a5fa' : 'var(--color-xama-gold)') : '#374151',
                          }}>
                          {Number(pts).toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <div className="px-5 py-3 flex items-center justify-between"
              style={{ borderTop: '1px solid var(--color-xama-border)', background: '#0a0c11' }}>
              <span className="text-[11px] font-bold tracking-[0.1em] uppercase"
                style={{ color: 'var(--color-xama-gold)', fontFamily: "'Rajdhani', sans-serif" }}>
                🏆 XAMA Fantasy
              </span>
              <span className="text-[11px] tabular-nums"
                style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-xama-muted)' }}>
                {rankings.length} managers{selectedDayId ? ` · Dia ${selectedDay?.day_number}` : ''}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
