// frontend/src/components/TournamentLeaderboard.jsx
// XAMA Fantasy — Leaderboard com filtro hierárquico por campeonato/stage/dia

import { useEffect, useRef, useState } from 'react'
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

// ── Painel de seleção hierárquico ──────────────────────────────────────────

/**
 * Constrói a lista de "opções de seleção" a partir das stages e seus dias.
 * Cada item: { key, label, type: 'total'|'stage'|'day', stageId, dayId }
 */
function buildOptions(championshipShortName, siblingStages) {
  const options = []

  // Opção 0: Total do campeonato
  options.push({
    key: '__champ__',
    label: `${championshipShortName || 'Campeonato'} — TOTAL`,
    type: 'total',
    stageId: null,
    dayId: null,
  })

  for (const stage of siblingStages) {
    const stageName = stage.short_name || stage.name

    if (stage.stage_days && stage.stage_days.length > 0) {
      // Stage com dias: só adiciona dias individuais (não o total da stage como opção extra)
      for (const day of stage.stage_days) {
        options.push({
          key: `day_${day.id}`,
          label: `${stageName} — Dia ${day.day_number}`,
          type: 'day',
          stageId: stage.id,
          dayId: day.id,
          stageLabel: stageName,
          dayNumber: day.day_number,
        })
      }
    } else {
      // Stage sem dias cadastrados: adiciona opção do total da stage
      options.push({
        key: `stage_${stage.id}`,
        label: stageName,
        type: 'stage',
        stageId: stage.id,
        dayId: null,
      })
    }
  }

  return options
}

/** Agrupa opções por stage para renderização hierárquica no painel */
function groupOptions(options) {
  const totalOpt = options.find(o => o.type === 'total')
  const byStage = {}
  for (const o of options) {
    if (o.type === 'total') continue
    const key = o.stageId ?? o.key
    if (!byStage[key]) byStage[key] = { stageLabel: o.stageLabel || o.label, options: [] }
    byStage[key].options.push(o)
  }
  return { totalOpt, stageGroups: Object.values(byStage) }
}

// ── Componente principal ───────────────────────────────────────────────────

export default function TournamentLeaderboard({
  token                 = '',
  stageId               = '',
  lineupStatus          = '',
  stageShortName        = '',
  championshipId        = null,
  championshipShortName = '',
  siblingStages         = [],
}) {
  const isOpen = lineupStatus === 'open'

  // ── Opções de filtro (derivadas de siblingStages) ─────────────────────────
  const options = buildOptions(championshipShortName, siblingStages)

  // ── Estado do filtro ──────────────────────────────────────────────────────
  // selectedKeys: conjunto de keys selecionadas (multi-select via checkbox)
  // Default: apenas '__champ__' (total do campeonato)
  const [selectedKeys, setSelectedKeys] = useState(new Set(['__champ__']))
  const [panelOpen,    setPanelOpen]    = useState(false)
  const panelRef = useRef(null)

  // ── Leaderboard ───────────────────────────────────────────────────────────
  const [rankings,  setRankings]  = useState([])
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)
  const [myUserId,  setMyUserId]  = useState(null)

  // ── Submissões (stage atual aberta) ──────────────────────────────────────
  const [submissions,        setSubmissions]  = useState([])
  const [submissionsLoading, setSubLoading]   = useState(false)

  // Exibe submissões só quando o filtro é exatamente a stage atual sem dias
  const showSubmissions = isOpen && selectedKeys.size === 1
    && (selectedKeys.has('__champ__') || [...selectedKeys][0] === `stage_${stageId}`)

  // ── Reset ao trocar de stage ──────────────────────────────────────────────
  useEffect(() => {
    setSelectedKeys(new Set(['__champ__']))
    setRankings([])
    setError(null)
    setSubmissions([])
  }, [stageId])

  // ── Fechar painel ao clicar fora ──────────────────────────────────────────
  useEffect(() => {
    if (!panelOpen) return
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setPanelOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [panelOpen])

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

  // ── Busca leaderboard quando seleção muda ─────────────────────────────────
  useEffect(() => {
    fetchLeaderboard()
  }, [selectedKeys, championshipId]) // eslint-disable-line

  // ── Fetch leaderboard ─────────────────────────────────────────────────────
  const fetchLeaderboard = () => {
    if (!championshipId && !stageId) return
    setLoading(true); setError(null)

    const selected = [...selectedKeys]

    // Total do campeonato
    if (selected.length === 1 && selected[0] === '__champ__') {
      if (!championshipId) { setLoading(false); return }
      fetch(`${API_BASE_URL}/championships/${championshipId}/leaderboard`)
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
        .then(data => { setRankings(data); setLoading(false) })
        .catch(e => { setError(e.message); setLoading(false) })
      return
    }

    // Seleção simples de uma stage sem dias
    const stageOnlyKeys = selected.filter(k => k.startsWith('stage_'))
    const dayKeys       = selected.filter(k => k.startsWith('day_'))

    if (selected.length === 1 && stageOnlyKeys.length === 1 && !dayKeys.length) {
      const sid = Number(stageOnlyKeys[0].replace('stage_', ''))
      fetch(`${API_BASE_URL}/stages/${sid}/leaderboard`)
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
        .then(data => { setRankings(data); setLoading(false) })
        .catch(e => { setError(e.message); setLoading(false) })
      return
    }

    // Seleção simples de um único dia
    if (selected.length === 1 && dayKeys.length === 1 && !stageOnlyKeys.length) {
      const dayId = Number(dayKeys[0].replace('day_', ''))
      // Descobre a stageId para esse day
      const opt = options.find(o => o.key === dayKeys[0])
      if (opt?.stageId) {
        fetch(`${API_BASE_URL}/stages/${opt.stageId}/days/${dayId}/leaderboard`)
          .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
          .then(data => { setRankings(data); setLoading(false) })
          .catch(e => { setError(e.message); setLoading(false) })
        return
      }
    }

    // Combinação arbitrária: coleta stage_day_ids de todas as seleções
    const dayIds = new Set()
    for (const key of selected) {
      if (key === '__champ__') {
        // Todos os days de todas as stages
        for (const s of siblingStages) {
          for (const d of (s.stage_days || [])) dayIds.add(d.id)
        }
      } else if (key.startsWith('stage_')) {
        const sid = Number(key.replace('stage_', ''))
        const stage = siblingStages.find(s => s.id === sid)
        for (const d of (stage?.stage_days || [])) dayIds.add(d.id)
      } else if (key.startsWith('day_')) {
        dayIds.add(Number(key.replace('day_', '')))
      }
    }

    if (dayIds.size === 0) { setRankings([]); setLoading(false); return }

    fetch(`${API_BASE_URL}/championships/${championshipId}/leaderboard/combined?stage_day_ids=${[...dayIds].join(',')}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(data => { setRankings(data); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }

  // ── Helpers de seleção ────────────────────────────────────────────────────
  const toggleKey = (key) => {
    setSelectedKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
        if (next.size === 0) next.add('__champ__') // nunca deixa vazio
      } else {
        next.delete('__champ__')  // remove total ao selecionar algo específico
        next.add(key)
      }
      return next
    })
  }

  const selectTotal = () => setSelectedKeys(new Set(['__champ__']))

  // ── Label do botão de filtro ──────────────────────────────────────────────
  const filterLabel = () => {
    if (selectedKeys.has('__champ__'))
      return `${championshipShortName || 'Campeonato'} — TOTAL`
    if (selectedKeys.size === 1) {
      const opt = options.find(o => o.key === [...selectedKeys][0])
      return opt?.label ?? '—'
    }
    return `${selectedKeys.size} seleções`
  }

  // ── Pontos normalizados por tipo de endpoint ──────────────────────────────
  const getPoints = (entry) =>
    entry.total_points !== undefined ? entry.total_points : (entry.points ?? 0)

  const getBadge = (entry) => {
    if (entry.stages_played > 0)
      return { label: `${entry.stages_played}S`, color: 'rgba(240,192,64,0.18)', border: 'rgba(240,192,64,0.4)', text: '#f0c040' }
    if (entry.days_played > 0)
      return { label: `${entry.days_played}D`, color: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.3)', text: 'var(--color-xama-blue)' }
    return null
  }

  const logoPrefix = champLogoPrefix(championshipShortName)
  const { totalOpt, stageGroups } = groupOptions(options)

  return (
    <div className="min-h-screen" style={{ background: 'transparent' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="px-6 py-5 border-b" style={{ background: 'var(--color-xama-surface)', borderColor: 'var(--color-xama-border)' }}>
        <div className="max-w-3xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {logoPrefix ? (
              <img
                src={`/logos/Tournaments/${logoPrefix}.png`}
                alt={logoPrefix}
                style={{ width: 34, height: 34, objectFit: 'contain', flexShrink: 0 }}
                onError={e => { e.currentTarget.style.display = 'none' }}
              />
            ) : (
              <span style={{ fontSize: '22px', lineHeight: 1 }}>🏆</span>
            )}
            <h1 className="text-[28px] font-bold tracking-tight" style={{ color: 'var(--color-xama-text)', letterSpacing: '-0.01em' }}>
              LEADERBOARD
            </h1>
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

        {/* ── Dropdown de filtro ───────────────────────────────────────────── */}
        <div className="max-w-3xl mx-auto mt-3" ref={panelRef} style={{ position: 'relative' }}>
          {/* Botão que abre o painel */}
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
              minWidth: '220px', justifyContent: 'space-between',
            }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-xama-gold)' }}>
              {filterLabel()}
            </span>
            <span style={{ fontSize: '10px', color: 'var(--color-xama-muted)' }}>
              {panelOpen ? '▲' : '▼'}
            </span>
          </button>

          {/* Painel hierárquico */}
          {panelOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 200,
              background: 'var(--color-xama-surface)',
              border: '1px solid var(--color-xama-border)',
              borderRadius: '10px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              minWidth: '280px',
              overflow: 'hidden',
            }}>
              {/* Cabeçalho do painel */}
              <div style={{
                padding: '8px 14px',
                borderBottom: '1px solid var(--color-xama-border)',
                fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em',
                color: 'var(--color-xama-muted)', textTransform: 'uppercase',
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                Selecionar visualização
              </div>

              <div style={{ maxHeight: '380px', overflowY: 'auto', padding: '6px 0' }}>

                {/* Opção: Total do campeonato */}
                {totalOpt && (
                  <FilterRow
                    label={totalOpt.label}
                    checked={selectedKeys.has('__champ__')}
                    onChange={selectTotal}
                    gold
                  />
                )}

                {/* Separador */}
                {stageGroups.length > 0 && (
                  <div style={{ margin: '4px 0', borderTop: '1px solid var(--color-xama-border)' }} />
                )}

                {/* Grupos por stage */}
                {stageGroups.map((group, gi) => (
                  <div key={gi}>
                    {/* Label da stage (não clicável — só label de seção) */}
                    <div style={{
                      padding: '5px 14px 2px',
                      fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em',
                      color: 'var(--color-xama-blue)', textTransform: 'uppercase',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}>
                      {group.stageLabel}
                    </div>

                    {/* Opções da stage */}
                    {group.options.map(opt => (
                      <FilterRow
                        key={opt.key}
                        label={opt.type === 'day' ? `Dia ${opt.dayNumber}` : opt.label}
                        checked={selectedKeys.has(opt.key)}
                        onChange={() => toggleKey(opt.key)}
                        indent
                      />
                    ))}

                    {gi < stageGroups.length - 1 && (
                      <div style={{ margin: '4px 0', borderTop: '1px solid rgba(255,255,255,0.04)' }} />
                    )}
                  </div>
                ))}
              </div>

              {/* Rodapé: confirmar */}
              <div style={{
                padding: '8px 14px',
                borderTop: '1px solid var(--color-xama-border)',
                display: 'flex', justifyContent: 'flex-end',
              }}>
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

// ── Sub-componente linha de filtro ──────────────────────────────────────────
function FilterRow({ label, checked, onChange, gold = false, indent = false }) {
  return (
    <label
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: `6px ${indent ? '24px' : '14px'}`,
        cursor: 'pointer',
        background: checked ? (gold ? 'rgba(240,192,64,0.06)' : 'rgba(96,165,250,0.06)') : 'transparent',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => { if (!checked) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
      onMouseLeave={e => { e.currentTarget.style.background = checked ? (gold ? 'rgba(240,192,64,0.06)' : 'rgba(96,165,250,0.06)') : 'transparent' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        style={{ accentColor: gold ? '#f0c040' : 'var(--color-xama-blue)', width: '14px', height: '14px', cursor: 'pointer' }}
      />
      <span style={{
        fontSize: '13px',
        color: checked ? (gold ? '#f0c040' : 'var(--color-xama-blue)') : 'var(--color-xama-text)',
        fontWeight: checked ? 600 : 400,
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        {label}
      </span>
    </label>
  )
}
