// frontend/src/components/TournamentLeaderboard.jsx
// XAMA Fantasy — Leaderboard com hierarquia Campeonato → Stage → Dia

import { useEffect, useState } from 'react'
import { API_BASE_URL } from '../config'

const RANK_COLORS = { 1: '#f0c040', 2: '#b4bcc8', 3: '#cd7f50' }
const RANK_BG     = {
  1: 'rgba(240,192,64,0.04)',
  2: 'rgba(180,188,200,0.03)',
  3: 'rgba(176,120,80,0.03)',
}

const ownerLabel = (entry) => entry.username || `#${entry.user_id.slice(0, 8)}`

/** Extrai prefixo de logo: "PAS1" → "PAS", "PGS7" → "PGS" */
function champLogoPrefix(shortName) {
  if (!shortName) return null
  const m = shortName.match(/^([A-Za-z]+)/)
  return m ? m[1].toUpperCase() : null
}

function chip(active, color = 'gold') {
  const colors = {
    gold:  { active: { bg: 'rgba(240,192,64,0.12)', border: 'rgba(240,192,64,0.5)',  text: '#f0c040' } },
    blue:  { active: { bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.5)',   text: 'var(--color-xama-blue)' } },
  }
  const c = colors[color] || colors.gold
  return {
    background:   active ? c.active.bg     : '#0d0f14',
    border:       `1px solid ${active ? c.active.border : 'var(--color-xama-border)'}`,
    borderRadius: '6px',
    color:        active ? c.active.text : 'var(--color-xama-muted)',
    padding:      '4px 10px',
    fontSize:     '12px',
    fontWeight:   600,
    cursor:       'pointer',
    outline:      'none',
  }
}

export default function TournamentLeaderboard({
  token            = '',
  stageId          = '',
  lineupStatus     = '',
  stageShortName   = '',
  championshipId   = null,
  championshipShortName = '',
  siblingStages    = [],
}) {
  const isOpen = lineupStatus === 'open'

  // ── Filtro hierárquico ────────────────────────────────────────────────────
  // null = visão do campeonato (default); number = stage específica
  const [selectedStageId, setSelectedStageId] = useState(null)
  const [selectedDayId,   setSelectedDayId]   = useState(null)
  const [stageDays,       setStageDays]        = useState([])

  // ── Leaderboard ───────────────────────────────────────────────────────────
  const [rankings,  setRankings]  = useState([])
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)
  const [myUserId,  setMyUserId]  = useState(null)

  // ── Submissões (stage aberta) ─────────────────────────────────────────────
  const [submissions,      setSubmissions]  = useState([])
  const [submissionsLoading, setSubLoading] = useState(false)

  // Exibe submissões apenas quando o usuário está vendo a stage atual e ela está aberta
  const viewingCurrentStage = Number(selectedStageId) === Number(stageId)
  const showSubmissions = isOpen && viewingCurrentStage && selectedDayId === null

  // ── Reset ao trocar de stage ──────────────────────────────────────────────
  useEffect(() => {
    setSelectedStageId(null)
    setSelectedDayId(null)
    setStageDays([])
    setRankings([])
    setError(null)
    setSubmissions([])
  }, [stageId])

  // ── Busca dias ao selecionar uma stage ────────────────────────────────────
  useEffect(() => {
    setStageDays([])
    setSelectedDayId(null)
    if (!selectedStageId) return
    fetch(`${API_BASE_URL}/stages/${selectedStageId}/days`)
      .then(r => r.ok ? r.json() : [])
      .then(setStageDays)
      .catch(() => {})
  }, [selectedStageId])

  // ── Busca leaderboard ao mudar filtro ─────────────────────────────────────
  useEffect(() => {
    fetchLeaderboard()
  }, [selectedStageId, selectedDayId, stageId, championshipId]) // eslint-disable-line

  // ── Meu user_id ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) { setMyUserId(null); return }
    fetch(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.id) setMyUserId(d.id) })
      .catch(() => {})
  }, [token])

  // ── Busca submissões ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !viewingCurrentStage || !stageId) return
    setSubLoading(true)
    fetch(`${API_BASE_URL}/stages/${stageId}/days`)
      .then(r => r.ok ? r.json() : [])
      .then(days => {
        const activeDay = days.find(d => d.is_active) || days[0]
        if (!activeDay) { setSubLoading(false); return null }
        return fetch(`${API_BASE_URL}/stages/${stageId}/days/${activeDay.id}/submissions`)
          .then(r => r.ok ? r.json() : [])
          .then(setSubmissions)
      })
      .catch(() => setSubmissions([]))
      .finally(() => setSubLoading(false))
  }, [isOpen, viewingCurrentStage, stageId]) // eslint-disable-line

  // ── Fetch leaderboard ─────────────────────────────────────────────────────
  const fetchLeaderboard = () => {
    setLoading(true); setError(null)
    let url
    if (selectedStageId === null) {
      if (!championshipId) { setLoading(false); return }
      url = `${API_BASE_URL}/championships/${championshipId}/leaderboard`
    } else if (selectedDayId) {
      url = `${API_BASE_URL}/stages/${selectedStageId}/days/${selectedDayId}/leaderboard`
    } else {
      url = `${API_BASE_URL}/stages/${selectedStageId}/leaderboard`
    }
    fetch(url)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(data => { setRankings(data); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }

  // ── Computed ──────────────────────────────────────────────────────────────
  const logoPrefix      = champLogoPrefix(championshipShortName)
  const hasMultipleDays = stageDays.length > 1
  const selectedDay     = stageDays.find(d => d.id === selectedDayId)

  // Subtítulo muda conforme o nível de visualização
  const headerSubtitle =
    selectedStageId === null
      ? (championshipShortName || '—')
      : siblingStages.find(s => s.id === selectedStageId)?.short_name || stageShortName

  // Pontos normalizados por tipo de endpoint
  const getPoints = (entry) =>
    entry.total_points !== undefined ? entry.total_points : (entry.points ?? 0)

  // Badge lateral (stages jogadas no campeonato, ou dias na stage)
  const getBadge = (entry) => {
    if (selectedStageId === null && entry.stages_played > 0)
      return { label: `${entry.stages_played}S`, color: 'rgba(240,192,64,0.18)', border: 'rgba(240,192,64,0.4)', text: '#f0c040' }
    if (selectedStageId !== null && !selectedDayId && entry.days_played > 0)
      return { label: `${entry.days_played}D`, color: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.3)', text: 'var(--color-xama-blue)' }
    return null
  }

  const pointsColor = (pts) => {
    if (pts <= 0) return '#374151'
    if (selectedDayId) return 'var(--color-xama-blue)'
    if (selectedStageId === null) return 'var(--color-xama-gold)'
    return 'var(--color-xama-gold)'
  }

  return (
    <div className="min-h-screen" style={{ background: 'transparent' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="px-6 py-5 border-b" style={{ background: 'var(--color-xama-surface)', borderColor: 'var(--color-xama-border)' }}>
        <div className="max-w-3xl mx-auto flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Logo do campeonato */}
            {logoPrefix ? (
              <img
                src={`/logos/Tournaments/${logoPrefix}.png`}
                alt={logoPrefix}
                style={{ width: 34, height: 34, objectFit: 'contain', flexShrink: 0 }}
                onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'inline' }}
              />
            ) : null}
            <span style={{ fontSize: '22px', lineHeight: 1, display: logoPrefix ? 'none' : 'inline' }}>🏆</span>
            <div>
              <h1 className="text-[28px] font-bold tracking-tight" style={{ color: 'var(--color-xama-text)', letterSpacing: '-0.01em' }}>
                LEADERBOARD
              </h1>
              <p className="text-[11px] tracking-[0.1em] uppercase" style={{ color: 'var(--color-xama-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                {headerSubtitle}
              </p>
            </div>
          </div>
          <button
            className="dark-btn flex items-center gap-2"
            onClick={fetchLeaderboard}
            disabled={loading}
            style={{ fontWeight: 600 }}>
            <span style={{ fontSize: '13px' }}>↻</span>
            {loading ? 'Carregando…' : 'Atualizar'}
          </button>
        </div>

        {/* ── Filtros ─────────────────────────────────────────────────────── */}
        <div className="max-w-3xl mx-auto mt-3 flex flex-wrap items-center gap-2">

          {/* Nível 1: Campeonato + Stages */}
          <div className="flex items-center flex-wrap gap-1">
            <button
              onClick={() => { setSelectedStageId(null); setSelectedDayId(null) }}
              style={chip(selectedStageId === null, 'gold')}>
              {championshipShortName || 'Campeonato'}
            </button>
            {siblingStages.map(s => (
              <button
                key={s.id}
                onClick={() => { setSelectedStageId(s.id); setSelectedDayId(null) }}
                style={chip(selectedStageId === s.id, 'blue')}>
                {s.short_name || s.name}
              </button>
            ))}
          </div>

          {/* Nível 2: Dias — só aparece quando stage selecionada tem múltiplos dias */}
          {selectedStageId !== null && hasMultipleDays && (
            <>
              <span style={{ color: 'var(--color-xama-border)', fontSize: '16px', margin: '0 2px' }}>|</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSelectedDayId(null)}
                  style={chip(!selectedDayId, 'blue')}>
                  Total
                </button>
                {stageDays.map(d => (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDayId(d.id)}
                    style={chip(selectedDayId === d.id, 'blue')}>
                    Dia {d.day_number}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── View de submissões (stage atual aberta) ─────────────────────────── */}
      {showSubmissions && (
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-xama-border)', background: 'var(--color-xama-surface)' }}>
            <div style={{ height: '2px', background: 'linear-gradient(90deg, var(--color-xama-orange) 0%, transparent 50%)' }} />
            <div className="px-4 py-3 text-[11px] font-bold tracking-[0.08em] uppercase flex items-center justify-between"
              style={{ background: 'rgba(249,115,22,0.06)', borderBottom: '1px solid rgba(249,115,22,0.15)', color: 'var(--color-xama-orange)', fontFamily: "'JetBrains Mono', monospace" }}>
              <span>⚡ LINEUP ENVIADO — dia ainda em andamento</span>
              <span style={{ color: 'var(--color-xama-muted)', fontWeight: 400 }}>
                {submissionsLoading ? '…' : `${submissions.length} manager${submissions.length !== 1 ? 's' : ''}`}
              </span>
            </div>

            {submissionsLoading && (
              <p className="text-center py-12 text-[13px]" style={{ color: 'var(--color-xama-muted)' }}>Carregando…</p>
            )}
            {!submissionsLoading && submissions.length === 0 && (
              <p className="text-center py-12 text-[13px]" style={{ color: 'var(--color-xama-muted)' }}>Nenhum lineup enviado ainda.</p>
            )}
            {!submissionsLoading && submissions.length > 0 && (
              <table className="w-full border-collapse">
                <thead>
                  <tr style={{ background: '#0a0c11', borderBottom: '1px solid var(--color-xama-border)' }}>
                    {['#', 'Manager', 'Enviado'].map((h, i) => (
                      <th key={i} className="px-4 py-3 text-[10px] font-bold tracking-[0.1em] uppercase"
                        style={{ color: 'var(--color-xama-muted)', textAlign: i === 2 ? 'right' : 'left', width: i === 0 ? '52px' : undefined }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {submissions.map(entry => {
                    const isMe = entry.user_id === myUserId
                    const time = new Date(entry.submitted_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                    return (
                      <tr key={entry.user_id}
                        style={{
                          borderBottom: '1px solid #13161f',
                          background: isMe ? 'rgba(20,184,166,0.06)' : 'transparent',
                          outline: isMe ? '1px solid rgba(20,184,166,0.18)' : 'none',
                          outlineOffset: '-1px',
                        }}
                        onMouseEnter={e => { if (!isMe) e.currentTarget.style.background = '#161b27' }}
                        onMouseLeave={e => { e.currentTarget.style.background = isMe ? 'rgba(20,184,166,0.06)' : 'transparent' }}>
                        <td className="px-4 py-[13px]">
                          <span className="text-[13px] font-bold tabular-nums"
                            style={{ fontFamily: "'JetBrains Mono', monospace", color: '#2a3046' }}>
                            {String(entry.rank).padStart(2, '0')}
                          </span>
                        </td>
                        <td className="px-4 py-[13px]">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '13px', color: 'var(--color-xama-text)', fontFamily: "'JetBrains Mono', monospace" }}>
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
                        <td className="px-4 py-[13px] text-right">
                          <span style={{ fontSize: '12px', color: 'var(--color-xama-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                            ✓ {time}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}

            <div className="px-5 py-3 flex items-center justify-between"
              style={{ borderTop: '1px solid var(--color-xama-border)', background: '#0a0c11' }}>
              <span className="text-[11px] font-bold tracking-[0.1em] uppercase" style={{ color: 'var(--color-xama-orange)' }}>
                ⚡ XAMA Fantasy
              </span>
              <span className="text-[11px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-xama-muted)' }}>
                pontos disponíveis após o encerramento
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Leaderboard normal ────────────────────────────────────────────── */}
      {!showSubmissions && (
        <div className="max-w-3xl mx-auto px-4 py-6">
          {loading && (
            <p className="text-center py-20 text-[13px]" style={{ color: 'var(--color-xama-muted)' }}>
              Carregando leaderboard…
            </p>
          )}
          {error && !loading && (
            <div className="msg-error max-w-lg mx-auto mt-8">Erro ao carregar: {error}</div>
          )}
          {!loading && !error && rankings.length === 0 && (
            <p className="text-center py-20 text-[13px]" style={{ color: 'var(--color-xama-muted)' }}>
              {selectedDayId
                ? `Nenhum resultado para Dia ${selectedDay?.day_number ?? ''}.`
                : 'Nenhum resultado ainda.'}
            </p>
          )}

          {!loading && !error && rankings.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-xama-border)', background: 'var(--color-xama-surface)' }}>
              <div style={{ height: '2px', background: 'linear-gradient(90deg, var(--color-xama-gold) 0%, transparent 50%)' }} />

              {/* Banner de contexto */}
              {selectedDayId && (
                <div className="px-4 py-2 text-[11px] font-bold tracking-[0.08em] uppercase"
                  style={{ background: 'rgba(96,165,250,0.08)', borderBottom: '1px solid rgba(96,165,250,0.2)', color: 'var(--color-xama-blue)', fontFamily: "'JetBrains Mono', monospace" }}>
                  📅 Dia {selectedDay?.day_number} —{' '}
                  {selectedDay?.date ? new Date(selectedDay.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : ''}
                </div>
              )}

              <table className="w-full border-collapse">
                <thead>
                  <tr style={{ background: '#0a0c11', borderBottom: '1px solid var(--color-xama-border)' }}>
                    {['#', 'Manager', selectedDayId ? 'Pts (dia)' : 'Pontos'].map((h, i) => (
                      <th key={i} className="px-4 py-3 text-[10px] font-bold tracking-[0.1em] uppercase"
                        style={{ color: 'var(--color-xama-muted)', textAlign: i >= 2 ? 'right' : 'left', width: i === 0 ? '52px' : undefined }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rankings.map((entry, idx) => {
                    const pos    = entry.rank ?? (idx + 1)
                    const isTop3 = pos <= 3
                    const isMe   = entry.user_id === myUserId
                    const pts    = getPoints(entry)
                    const badge  = getBadge(entry)

                    return (
                      <tr key={entry.user_id}
                        style={{
                          borderBottom: '1px solid #13161f',
                          background: isMe ? 'rgba(20,184,166,0.06)' : isTop3 ? RANK_BG[pos] : 'transparent',
                          outline: isMe ? '1px solid rgba(20,184,166,0.18)' : 'none',
                          outlineOffset: '-1px',
                        }}
                        onMouseEnter={e => { if (!isMe) e.currentTarget.style.background = '#161b27' }}
                        onMouseLeave={e => { e.currentTarget.style.background = isMe ? 'rgba(20,184,166,0.06)' : isTop3 ? RANK_BG[pos] : 'transparent' }}>

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
                            {badge && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                                style={{ background: badge.color, border: `1px solid ${badge.border}`, color: badge.text, fontFamily: "'JetBrains Mono', monospace" }}>
                                {badge.label}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Pontos */}
                        <td className="px-4 py-[13px] text-right">
                          <span className="text-[15px] font-bold tabular-nums"
                            style={{ fontFamily: "'JetBrains Mono', monospace", color: pointsColor(pts) }}>
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
                <span className="text-[11px] font-bold tracking-[0.1em] uppercase" style={{ color: 'var(--color-xama-gold)' }}>
                  🏆 XAMA Fantasy
                </span>
                <span className="text-[11px] tabular-nums"
                  style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-xama-muted)' }}>
                  {rankings.length} managers
                  {selectedDayId ? ` · Dia ${selectedDay?.day_number}` : ''}
                  {selectedStageId === null ? ` · ${championshipShortName}` : ''}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  )
}
