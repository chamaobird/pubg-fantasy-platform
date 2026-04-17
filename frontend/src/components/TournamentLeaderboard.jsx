// frontend/src/components/TournamentLeaderboard.jsx
// XAMA Fantasy — Leaderboard com filtro hierárquico por campeonato/fase/dia

import { useEffect, useRef, useState, useCallback } from 'react'
import { API_BASE_URL } from '../config'

const RANK_COLORS = { 1: '#f0c040', 2: '#b4bcc8', 3: '#cd7f50' }
const RANK_BG     = {
  1: 'rgba(240,192,64,0.04)',
  2: 'rgba(180,188,200,0.03)',
  3: 'rgba(176,120,80,0.03)',
}

const ownerLabel = (entry) => entry.username || `#${entry.user_id.slice(0, 8)}`

// ── Helpers de nomenclatura ────────────────────────────────────────────────

/** "Playoffs 1 - Dia 1" → "Playoffs 1" */
function extractPhase(name) {
  const m = name.match(/^(.+?)\s*[-–]\s*Dia\s*\d+\s*$/i)
  return m ? m[1].trim() : name
}

/** "Playoffs 1 - Dia 1" → "Dia 1" */
function extractDayLabel(name) {
  const m = name.match(/[-–]\s*(Dia\s*\d+)\s*$/i)
  return m ? m[1].trim() : name
}

/** "PAS1 PO1" → "PAS1" (primeiro token) */
function extractChampCode(shortName) {
  return (shortName || '').split(/\s+/)[0] || 'Campeonato'
}

// ── Agrupa stages por fase ─────────────────────────────────────────────────

function buildPhases(siblingStages) {
  const map = new Map() // phaseLabel → { label, stages[] }
  for (const stage of siblingStages) {
    const label = extractPhase(stage.name)
    if (!map.has(label)) map.set(label, { label, stages: [] })
    map.get(label).stages.push(stage)
  }
  return [...map.values()]
}

// ── Rótulo do botão fechado ────────────────────────────────────────────────

function filterLabel(selectedKeys, champCode, phases) {
  if (selectedKeys.has('__champ__')) return `${champCode} — TOTAL`

  const selected = [...selectedKeys]
  const count    = selected.length

  // Fase inteira selecionada?
  for (const phase of phases) {
    const pKeys = phase.stages.map(s => `stage_${s.id}`)
    if (pKeys.length > 0 && pKeys.every(k => selectedKeys.has(k)) && count === pKeys.length) {
      return `${phase.label} — todos`
    }
  }

  // Dia único
  if (count === 1) {
    const stageId = Number(selected[0].replace('stage_', ''))
    for (const phase of phases) {
      const stage = phase.stages.find(s => s.id === stageId)
      if (stage) return `${phase.label} — ${extractDayLabel(stage.name)}`
    }
  }

  return `${count} selecionado${count !== 1 ? 's' : ''}`
}

// ── Coleta stage_day_ids para o endpoint combinado ─────────────────────────

function collectStageDayIds(stageIds, siblingStages) {
  const ids = []
  for (const sid of stageIds) {
    const stage = siblingStages.find(s => s.id === sid)
    for (const d of (stage?.stage_days || [])) ids.push(d.id)
  }
  return ids
}

// ── Componente principal ───────────────────────────────────────────────────

export default function TournamentLeaderboard({
  token                 = '',
  stageId               = '',
  lineupStatus          = '',
  championshipId        = null,
  championshipShortName = '',
  siblingStages         = [],
  onMyRankFound         = null,
}) {
  const isOpen   = lineupStatus === 'open'
  const champCode = extractChampCode(championshipShortName)
  const phases    = buildPhases(siblingStages)

  // selectedKeys: Set<'__champ__' | 'stage_N'>
  const [selectedKeys, setSelectedKeys] = useState(new Set(['__champ__']))
  const [panelOpen,    setPanelOpen]    = useState(false)
  const panelRef = useRef(null)

  const [rankings,  setRankings]  = useState([])
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)
  const [myUserId,  setMyUserId]  = useState(null)

  const [submissions,        setSubmissions]  = useState([])
  const [submissionsLoading, setSubLoading]   = useState(false)

  const myRowRef      = useRef(null)
  const hasScrolledRef = useRef(false)

  const showSubmissions = isOpen
    && selectedKeys.size === 1
    && selectedKeys.has(`stage_${stageId}`)

  // ── Reset ao trocar de stage ────────────────────────────────────────────
  useEffect(() => {
    setSelectedKeys(new Set(['__champ__']))
    setRankings([])
    setError(null)
    setSubmissions([])
    hasScrolledRef.current = false
  }, [stageId])

  // ── Fechar painel ao clicar fora ────────────────────────────────────────
  useEffect(() => {
    if (!panelOpen) return
    const h = (e) => { if (panelRef.current && !panelRef.current.contains(e.target)) setPanelOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [panelOpen])

  // ── Meu user_id ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) { setMyUserId(null); return }
    fetch(`${API_BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        if (r.status === 401) { window.dispatchEvent(new Event('auth:session-expired')); return null }
        return r.ok ? r.json() : null
      })
      .then(d => { if (d?.id) setMyUserId(d.id) })
      .catch(() => {})
  }, [token])

  // ── Callback myRank + auto-scroll para linha "EU" ──────────────────────
  useEffect(() => {
    if (!myUserId || rankings.length === 0) return
    const myEntry = rankings.find(e => e.user_id === myUserId)
    if (!myEntry) return
    // Notificar TournamentHub do rank/pts do usuário
    if (onMyRankFound) {
      const pos = myEntry.rank ?? (rankings.indexOf(myEntry) + 1)
      onMyRankFound(pos, getPoints(myEntry))
    }
    // Scroll para a linha "EU" (apenas uma vez por conjunto de rankings)
    if (!hasScrolledRef.current && myRowRef.current) {
      hasScrolledRef.current = true
      myRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [rankings, myUserId]) // eslint-disable-line

  // ── Submissões ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !stageId) return
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
  }, [isOpen, stageId]) // eslint-disable-line

  // ── Fetch ao mudar seleção ──────────────────────────────────────────────
  useEffect(() => { fetchLeaderboard() }, [selectedKeys, championshipId]) // eslint-disable-line

  // ── Fetch leaderboard ───────────────────────────────────────────────────
  const fetchLeaderboard = () => {
    if (!championshipId && !stageId) return
    setLoading(true); setError(null)

    // 1. Total do campeonato
    if (selectedKeys.has('__champ__')) {
      if (!championshipId) { setLoading(false); return }
      fetch(`${API_BASE_URL}/championships/${championshipId}/leaderboard`)
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
        .then(d => { setRankings(d); setLoading(false) })
        .catch(e => { setError(e.message); setLoading(false) })
      return
    }

    const stageIds = [...selectedKeys].map(k => Number(k.replace('stage_', '')))

    // 2. Stage única → endpoint de stage
    if (stageIds.length === 1) {
      fetch(`${API_BASE_URL}/stages/${stageIds[0]}/leaderboard`)
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
        .then(d => { setRankings(d); setLoading(false) })
        .catch(e => { setError(e.message); setLoading(false) })
      return
    }

    // 3. Combinação → endpoint combinado com stage_day_ids
    const dayIds = collectStageDayIds(stageIds, siblingStages)
    if (dayIds.length === 0) { setRankings([]); setLoading(false); return }

    fetch(`${API_BASE_URL}/championships/${championshipId}/leaderboard/combined?stage_day_ids=${dayIds.join(',')}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(d => { setRankings(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }

  // ── Toggles ─────────────────────────────────────────────────────────────

  const selectChamp = () => setSelectedKeys(new Set(['__champ__']))

  const toggleStage = (stageId) => {
    setSelectedKeys(prev => {
      const next = new Set(prev)
      next.delete('__champ__')
      const key = `stage_${stageId}`
      if (next.has(key)) {
        next.delete(key)
        if (next.size === 0) return new Set(['__champ__'])
      } else {
        next.add(key)
      }
      return next
    })
  }

  const togglePhase = (phase) => {
    const pKeys = phase.stages.map(s => `stage_${s.id}`)
    const allSelected = pKeys.every(k => selectedKeys.has(k))
    setSelectedKeys(prev => {
      const next = new Set(prev)
      next.delete('__champ__')
      if (allSelected) {
        pKeys.forEach(k => next.delete(k))
      } else {
        pKeys.forEach(k => next.add(k))
      }
      if (next.size === 0) return new Set(['__champ__'])
      return next
    })
  }

  // ── Computed ─────────────────────────────────────────────────────────────
  const getPoints = (e) => e.total_points !== undefined ? e.total_points : (e.points ?? 0)
  const getBadge  = (e) => {
    if ((e.stages_played ?? 0) > 0)
      return { label: `${e.stages_played}S`, color: 'rgba(240,192,64,0.18)', border: 'rgba(240,192,64,0.4)', text: '#f0c040' }
    if ((e.days_played ?? 0) > 0)
      return { label: `${e.days_played}D`, color: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.3)', text: 'var(--color-xama-blue)' }
    return null
  }

  return (
    <div className="min-h-screen" style={{ background: 'transparent' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="px-6 py-5 border-b" style={{ background: 'var(--color-xama-surface)', borderColor: 'var(--color-xama-border)' }}>
        <div className="max-w-3xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-[28px] font-bold tracking-tight" style={{ color: 'var(--color-xama-text)', letterSpacing: '-0.01em' }}>
            LEADERBOARD
          </h1>
          <button
            className="dark-btn flex items-center gap-2"
            onClick={fetchLeaderboard}
            disabled={loading}
            style={{ fontWeight: 600 }}>
            <span style={{ fontSize: '13px' }}>↻</span>
            {loading ? 'Carregando…' : 'Atualizar'}
          </button>
        </div>

        {/* ── Dropdown ────────────────────────────────────────────────────── */}
        <div className="max-w-3xl mx-auto mt-3" ref={panelRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setPanelOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: '#0d0f14',
              border: '1px solid var(--color-xama-border)',
              borderRadius: '8px',
              color: 'var(--color-xama-text)',
              padding: '7px 12px',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              minWidth: '240px', justifyContent: 'space-between',
            }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-xama-gold)' }}>
              {filterLabel(selectedKeys, champCode, phases)}
            </span>
            <span style={{ fontSize: '10px', color: 'var(--color-xama-muted)' }}>
              {panelOpen ? '▲' : '▼'}
            </span>
          </button>

          {panelOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 200,
              background: 'var(--color-xama-surface)',
              border: '1px solid var(--color-xama-border)',
              borderRadius: '10px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              minWidth: '280px', overflow: 'hidden',
            }}>
              {/* Cabeçalho do painel */}
              <div style={{
                padding: '8px 14px', borderBottom: '1px solid var(--color-xama-border)',
                fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em',
                color: 'var(--color-xama-muted)', textTransform: 'uppercase',
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                Visualização
              </div>

              <div style={{ maxHeight: '400px', overflowY: 'auto', padding: '6px 0' }}>

                {/* Opção: Total do campeonato */}
                <FilterRow
                  label={`${champCode} — TOTAL`}
                  checked={selectedKeys.has('__champ__')}
                  onChange={selectChamp}
                  gold
                />

                {phases.length > 0 && (
                  <div style={{ margin: '4px 0', borderTop: '1px solid var(--color-xama-border)' }} />
                )}

                {phases.map((phase, gi) => {
                  const pKeys      = phase.stages.map(s => `stage_${s.id}`)
                  const allChecked = pKeys.length > 0 && pKeys.every(k => selectedKeys.has(k))
                  const someChecked = pKeys.some(k => selectedKeys.has(k))

                  return (
                    <div key={gi}>
                      {/* Cabeçalho da fase — clicável, seleciona todos os dias */}
                      <PhaseHeader
                        label={phase.label}
                        allChecked={allChecked}
                        someChecked={someChecked && !allChecked}
                        onClick={() => togglePhase(phase)}
                      />

                      {/* Dias da fase */}
                      {phase.stages.map(stage => (
                        <FilterRow
                          key={stage.id}
                          label={extractDayLabel(stage.name)}
                          checked={selectedKeys.has(`stage_${stage.id}`)}
                          onChange={() => toggleStage(stage.id)}
                          indent
                        />
                      ))}

                      {gi < phases.length - 1 && (
                        <div style={{ margin: '4px 0', borderTop: '1px solid rgba(255,255,255,0.04)' }} />
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Rodapé */}
              <div style={{ padding: '8px 14px', borderTop: '1px solid var(--color-xama-border)', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setPanelOpen(false)}
                  style={{
                    background: 'rgba(240,192,64,0.12)',
                    border: '1px solid rgba(240,192,64,0.4)',
                    borderRadius: '6px', color: '#f0c040',
                    padding: '5px 14px', fontSize: '12px', fontWeight: 700,
                    cursor: 'pointer',
                  }}>
                  Ver resultados
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Submissões (stage atual aberta) ─────────────────────────────────── */}
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
                        style={{ borderBottom: '1px solid #13161f', background: isMe ? 'rgba(20,184,166,0.06)' : 'transparent', outline: isMe ? '1px solid rgba(20,184,166,0.18)' : 'none', outlineOffset: '-1px' }}
                        onMouseEnter={e => { if (!isMe) e.currentTarget.style.background = '#161b27' }}
                        onMouseLeave={e => { e.currentTarget.style.background = isMe ? 'rgba(20,184,166,0.06)' : 'transparent' }}>
                        <td className="px-4 py-[13px]">
                          <span className="text-[13px] font-bold tabular-nums" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#2a3046' }}>
                            {String(entry.rank).padStart(2, '0')}
                          </span>
                        </td>
                        <td className="px-4 py-[13px]">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '13px', color: 'var(--color-xama-text)', fontFamily: "'JetBrains Mono', monospace" }}>
                              {ownerLabel(entry)}
                            </span>
                            {isMe && <span className="text-[10px] font-bold tracking-[0.06em] px-2 py-0.5 rounded" style={{ background: 'rgba(20,184,166,0.18)', border: '1px solid rgba(20,184,166,0.4)', color: '#2dd4bf' }}>EU</span>}
                          </div>
                        </td>
                        <td className="px-4 py-[13px] text-right">
                          <span style={{ fontSize: '12px', color: 'var(--color-xama-muted)', fontFamily: "'JetBrains Mono', monospace" }}>✓ {time}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
            <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--color-xama-border)', background: '#0a0c11' }}>
              <span className="text-[11px] font-bold tracking-[0.1em] uppercase" style={{ color: 'var(--color-xama-orange)' }}>⚡ XAMA Fantasy</span>
              <span className="text-[11px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-xama-muted)' }}>pontos disponíveis após o encerramento</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Leaderboard ──────────────────────────────────────────────────────── */}
      {!showSubmissions && (
        <div className="max-w-3xl mx-auto px-4 py-6">
          {loading && (
            <p className="text-center py-20 text-[13px]" style={{ color: 'var(--color-xama-muted)' }}>Carregando leaderboard…</p>
          )}
          {error && !loading && (
            <div className="msg-error max-w-lg mx-auto mt-8">Erro ao carregar: {error}</div>
          )}
          {!loading && !error && rankings.length === 0 && (
            <p className="text-center py-20 text-[13px]" style={{ color: 'var(--color-xama-muted)' }}>Nenhum resultado ainda.</p>
          )}
          {!loading && !error && rankings.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-xama-border)', background: 'var(--color-xama-surface)' }}>
              <div style={{ height: '2px', background: 'linear-gradient(90deg, var(--color-xama-gold) 0%, transparent 50%)' }} />
              <table className="w-full border-collapse">
                <thead>
                  <tr style={{ background: '#0a0c11', borderBottom: '1px solid var(--color-xama-border)' }}>
                    {['#', 'Manager', 'Pontos'].map((h, i) => (
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
                        ref={isMe ? myRowRef : null}
                        style={{
                          borderBottom: '1px solid #13161f',
                          background: isMe ? 'rgba(20,184,166,0.06)' : isTop3 ? RANK_BG[pos] : 'transparent',
                          outline: isMe ? '1px solid rgba(20,184,166,0.18)' : 'none',
                          outlineOffset: '-1px',
                        }}
                        onMouseEnter={e => { if (!isMe) e.currentTarget.style.background = '#161b27' }}
                        onMouseLeave={e => { e.currentTarget.style.background = isMe ? 'rgba(20,184,166,0.06)' : isTop3 ? RANK_BG[pos] : 'transparent' }}>
                        <td className="px-4 py-[13px]">
                          <span className="text-[13px] font-bold tabular-nums"
                            style={{ fontFamily: "'JetBrains Mono', monospace", color: isTop3 ? RANK_COLORS[pos] : '#2a3046' }}>
                            {String(pos).padStart(2, '0')}
                          </span>
                        </td>
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
                        <td className="px-4 py-[13px] text-right">
                          <span className="text-[15px] font-bold tabular-nums"
                            style={{ fontFamily: "'JetBrains Mono', monospace", color: pts > 0 ? 'var(--color-xama-gold)' : '#374151' }}>
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
                </span>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  )
}

// ── Sub-componentes ────────────────────────────────────────────────────────

function FilterRow({ label, checked, onChange, gold = false, indent = false }) {
  const activeColor = gold ? '#f0c040' : 'var(--color-xama-blue)'
  const activeBg    = gold ? 'rgba(240,192,64,0.06)' : 'rgba(96,165,250,0.06)'
  return (
    <label
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: `6px ${indent ? '28px' : '14px'}`,
        cursor: 'pointer',
        background: checked ? activeBg : 'transparent',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => { if (!checked) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
      onMouseLeave={e => { e.currentTarget.style.background = checked ? activeBg : 'transparent' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        style={{ accentColor: activeColor, width: '14px', height: '14px', cursor: 'pointer', flexShrink: 0 }}
      />
      <span style={{
        fontSize: '13px',
        color: checked ? activeColor : 'var(--color-xama-text)',
        fontWeight: checked ? 600 : 400,
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        {label}
      </span>
    </label>
  )
}

function PhaseHeader({ label, allChecked, someChecked, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        width: '100%', padding: '6px 14px',
        background: allChecked ? 'rgba(96,165,250,0.06)' : 'transparent',
        border: 'none', cursor: 'pointer', textAlign: 'left',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => { if (!allChecked) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
      onMouseLeave={e => { e.currentTarget.style.background = allChecked ? 'rgba(96,165,250,0.06)' : 'transparent' }}>
      {/* Checkbox visual (não é input real — o clique é no botão inteiro) */}
      <span style={{
        width: '14px', height: '14px', flexShrink: 0,
        border: `2px solid ${allChecked ? 'var(--color-xama-blue)' : someChecked ? 'var(--color-xama-blue)' : 'var(--color-xama-border)'}`,
        borderRadius: '3px',
        background: allChecked ? 'var(--color-xama-blue)' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '9px', color: '#fff', fontWeight: 700,
      }}>
        {allChecked ? '✓' : someChecked ? '−' : ''}
      </span>
      <span style={{
        fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: allChecked || someChecked ? 'var(--color-xama-blue)' : 'var(--color-xama-muted)',
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        {label}
      </span>
    </button>
  )
}
