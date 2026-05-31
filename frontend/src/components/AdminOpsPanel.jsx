// frontend/src/components/AdminOpsPanel.jsx
// Painel admin de operações de dia: import de matches, stats e scoring.

import { useEffect, useState, useCallback, useRef } from 'react'
import { API_BASE_URL } from '../config'

// ── Estilos ──────────────────────────────────────────────────────────────────

const btn = (variant = 'primary', extra = {}) => ({
  padding: '6px 16px',
  borderRadius: '6px',
  border: 'none',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: 600,
  ...(variant === 'primary'   && { background: 'var(--xm-orange)', color: '#000' }),
  ...(variant === 'secondary' && { background: 'rgba(249,115,22,0.08)', color: 'var(--xm-orange)', border: '1px solid rgba(249,115,22,0.2)' }),
  ...(variant === 'ghost'     && { background: 'transparent', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)' }),
  ...extra,
})

const card = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(249,115,22,0.12)',
  borderRadius: '10px',
  padding: '18px 20px',
  marginBottom: '16px',
}

const sectionTitle = {
  fontSize: '13px',
  fontWeight: 700,
  color: 'var(--xm-orange)',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  marginBottom: '14px',
}

const label  = { fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px', display: 'block' }
const select = {
  background: 'var(--surface-3)',
  border: '1px solid rgba(249,115,22,0.2)',
  borderRadius: '6px',
  color: '#fff',
  padding: '6px 10px',
  fontSize: '13px',
  width: '100%',
  colorScheme: 'dark',
}
const input_ = { ...select, width: '100%', boxSizing: 'border-box' }
const textarea_ = { ...input_, resize: 'vertical', fontFamily: 'monospace', fontSize: '12px', minHeight: '80px' }
const hr_ = { border: 'none', borderTop: '1px solid rgba(249,115,22,0.08)', margin: '14px 0' }

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusBadge({ result }) {
  if (!result) return null
  const ok = result.ok !== false
  return (
    <div style={{
      marginTop: '10px', padding: '8px 12px', borderRadius: '6px',
      fontSize: '12px', fontFamily: 'monospace',
      background: ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
      border: `1px solid ${ok ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
      color: ok ? '#86efac' : '#fca5a5',
      whiteSpace: 'pre-wrap', wordBreak: 'break-all',
    }}>
      {result.message}
    </div>
  )
}

function MatchList({ matches, selectedMatches, toggleMatch, toggleAllNew, newMatches, importedMatches }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
          {newMatches.length} nova(s) · {importedMatches.length} já importada(s)
        </div>
        {newMatches.length > 0 && (
          <button onClick={toggleAllNew} style={btn('ghost', { fontSize: 11, padding: '3px 10px' })}>
            {newMatches.every(m => selectedMatches.has(m.match_id)) ? 'Desmarcar todas' : 'Selecionar novas'}
          </button>
        )}
      </div>
      <div style={{ maxHeight: 280, overflowY: 'auto', borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)' }}>
        {matches.map((m, i) => {
          const checked = selectedMatches.has(m.match_id)
          return (
            <div
              key={m.match_id}
              onClick={() => toggleMatch(m.match_id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', cursor: 'pointer',
                borderBottom: i < matches.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                background: checked ? 'rgba(249,115,22,0.06)' : 'transparent',
                opacity: m.imported && !checked ? 0.5 : 1,
              }}
            >
              <input type="checkbox" checked={checked} onChange={() => {}} style={{ accentColor: 'var(--xm-orange)', flexShrink: 0 }} />
              <span style={{ fontFamily: 'monospace', fontSize: 11, color: m.imported ? 'rgba(255,255,255,0.4)' : 'var(--xm-text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {m.match_id}
              </span>
              {m.twire_id && (
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>
                  #{m.twire_id}
                </span>
              )}
              {m.played_at && (
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', flexShrink: 0 }}>{fmtUtc(m.played_at)}</span>
              )}
              {m.imported ? (
                <span style={{ fontSize: 10, fontWeight: 700, color: '#4ade80', flexShrink: 0 }}>importado</span>
              ) : (
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--xm-orange)', flexShrink: 0 }}>novo</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function fmtUtc(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      timeZone: 'UTC', day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit',
    }) + ' UTC'
  } catch { return iso }
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function AdminOpsPanel({ stageId, token }) {
  const [days,      setDays]      = useState([])
  const [daysError, setDaysError] = useState('')

  // Import por torneio
  const [importTab,       setImportTab]       = useState('tournament')  // 'tournament' | 'twire' | 'manual'
  const [tournamentId,    setTournamentId]    = useState('')
  const [tournamentMatches, setTournamentMatches] = useState([])   // [{match_id, imported, played_at, stage_day_id}]
  const [selectedMatches, setSelectedMatches] = useState(new Set())
  const [fetchLoading,    setFetchLoading]    = useState(false)
  const [fetchResult,     setFetchResult]     = useState(null)

  // Twire
  const [twireTournamentId, setTwireTournamentId] = useState('')
  const [twirePage,         setTwirePage]         = useState('1')

  // Import compartilhado
  const [importDay,      setImportDay]      = useState('')
  const [forceReproc,    setForceReproc]    = useState(false)
  const [importLoading,  setImportLoading]  = useState(false)
  const [importResult,   setImportResult]   = useState(null)

  // Import manual
  const [matchIds,   setMatchIds]   = useState('')

  // Unresolved players from last import
  const [unresolvedPlayers, setUnresolvedPlayers] = useState([])

  // Ref para scroll ao form de substituição
  const subFormRef = useRef(null)

  // Substituições
  const [subs,           setSubs]           = useState([])
  const [subOutSearch,   setSubOutSearch]   = useState('')
  const [subOutResults,  setSubOutResults]  = useState([])
  const [subOutPerson,   setSubOutPerson]   = useState(null)   // {id, name}
  const [subInSearch,    setSubInSearch]    = useState('')
  const [subInResults,   setSubInResults]   = useState([])
  const [subInPerson,    setSubInPerson]    = useState(null)   // {id, name}
  const [subLoading,     setSubLoading]     = useState(false)
  const [subResult,      setSubResult]      = useState(null)

  // Standings da stage
  const [standingsData,    setStandingsData]    = useState(null)
  const [standingsLoading, setStandingsLoading] = useState(false)
  const [standingsTopN,    setStandingsTopN]    = useState(8)

  // Saúde da Stage (preflight)
  const [preflightData,    setPreflightData]    = useState(null)
  const [preflightLoading, setPreflightLoading] = useState(false)

  // Missing players (pré-scoring)
  const [missingPlayers,  setMissingPlayers]  = useState(null)
  const [missingLoading,  setMissingLoading]  = useState(false)

  // Próxima stage
  const [nextStage,        setNextStage]        = useState(undefined) // undefined=não buscado, null=não existe
  const [nextLoading,      setNextLoading]      = useState(false)
  const [openNextLoading,  setOpenNextLoading]  = useState(false)
  const [openNextResult,   setOpenNextResult]   = useState(null)

  // Reassign match day state
  const [stageMatches,       setStageMatches]       = useState(null)   // null = not loaded
  const [stageMatchesLoading, setStageMatchesLoading] = useState(false)
  const [reassignSelected,   setReassignSelected]   = useState(new Set())
  const [reassignTargetDay,  setReassignTargetDay]  = useState('')
  const [reassignLoading,    setReassignLoading]    = useState(false)
  const [reassignResult,     setReassignResult]     = useState(null)

  // Stats state
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsResult,  setStatsResult]  = useState(null)

  // Score day state
  const [scoreDay,        setScoreDay]        = useState('')
  const [scoreDayLoading, setScoreDayLoading] = useState(false)
  const [scoreDayResult,  setScoreDayResult]  = useState(null)

  const loadDays = useCallback(() => {
    if (!stageId) return
    fetch(`${API_BASE_URL}/stages/${stageId}/days`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => {
        const sorted = [...data].sort((a, b) => a.day_number - b.day_number)
        setDays(sorted)
        const today = new Date().toISOString().slice(0, 10)
        const active = sorted.filter(d => d.date && d.date <= today).at(-1) || sorted[0]
        if (active) {
          setImportDay(String(active.id))
          setScoreDay(String(active.id))
        }
      })
      .catch(() => setDaysError('Erro ao carregar dias da stage'))
  }, [stageId])

  const loadSubs = useCallback(() => {
    if (!stageId) return
    fetch(`${API_BASE_URL}/admin/stages/${stageId}/substitutions`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(setSubs)
      .catch(() => {})
  }, [stageId, token])

  useEffect(() => { loadDays(); loadSubs() }, [loadDays, loadSubs])

  useEffect(() => {
    if (!scoreDay || !stageId || !token) { setMissingPlayers(null); return }
    setMissingLoading(true)
    setMissingPlayers(null)
    fetch(`${API_BASE_URL}/admin/stages/${stageId}/roster/days/${scoreDay}/missing-players`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => setMissingPlayers(d))
      .catch(() => setMissingPlayers(null))
      .finally(() => setMissingLoading(false))
  }, [scoreDay, stageId, token])

  // ── Helpers de chamada de API ─────────────────────────────────────────────

  async function callApi(path, body, method, setLoading, setResult, successFmt) {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch(`${API_BASE_URL}${path}`, {
        method: method || 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: body != null ? JSON.stringify(body) : undefined,
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setResult({ ok: false, message: data?.detail || `HTTP ${res.status}` })
      } else {
        setResult({ ok: true, message: successFmt(data) })
      }
    } catch (e) {
      setResult({ ok: false, message: e.message })
    } finally {
      setLoading(false)
    }
  }

  // ── Handlers ─────────────────────────────────────────────────────────────

  async function handleFetchTournament() {
    if (!tournamentId.trim()) return
    setFetchLoading(true)
    setFetchResult(null)
    setTournamentMatches([])
    setSelectedMatches(new Set())
    try {
      const res = await fetch(
        `${API_BASE_URL}/admin/stages/tournament-matches?tournament_id=${encodeURIComponent(tournamentId.trim())}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        const detail = data?.detail
        const msg = Array.isArray(detail)
          ? detail.map(e => e.msg || JSON.stringify(e)).join('; ')
          : (typeof detail === 'string' ? detail : `HTTP ${res.status}`)
        setFetchResult({ ok: false, message: msg })
        return
      }
      setTournamentMatches(data)
      // Pré-seleciona apenas os não importados
      setSelectedMatches(new Set(data.filter(m => !m.imported).map(m => m.match_id)))
      if (data.length === 0) setFetchResult({ ok: false, message: 'Nenhuma partida encontrada para este torneio.' })
    } catch (e) {
      setFetchResult({ ok: false, message: e.message })
    } finally {
      setFetchLoading(false)
    }
  }

  async function handleFetchTwire() {
    const tid = twireTournamentId.trim()
    if (!tid || isNaN(Number(tid))) return
    setFetchLoading(true)
    setFetchResult(null)
    setTournamentMatches([])
    setSelectedMatches(new Set())
    try {
      const res = await fetch(
        `${API_BASE_URL}/admin/stages/twire-matches?twire_tournament_id=${encodeURIComponent(tid)}&page=${twirePage || 1}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        const detail = data?.detail
        const msg = typeof detail === 'string' ? detail : `HTTP ${res.status}`
        setFetchResult({ ok: false, message: msg })
        return
      }
      setTournamentMatches(data)
      setSelectedMatches(new Set(data.filter(m => !m.imported).map(m => m.match_id)))
      if (data.length === 0) setFetchResult({ ok: false, message: 'Nenhuma partida encontrada no Twire para este torneio.' })
    } catch (e) {
      setFetchResult({ ok: false, message: e.message })
    } finally {
      setFetchLoading(false)
    }
  }

  function toggleMatch(matchId) {
    setSelectedMatches(prev => {
      const next = new Set(prev)
      if (next.has(matchId)) next.delete(matchId)
      else next.add(matchId)
      return next
    })
  }

  function toggleAllNew() {
    const newIds = tournamentMatches.filter(m => !m.imported).map(m => m.match_id)
    const allSelected = newIds.every(id => selectedMatches.has(id))
    if (allSelected) setSelectedMatches(new Set())
    else setSelectedMatches(new Set(newIds))
  }

  async function doImport(ids) {
    setImportLoading(true)
    setImportResult(null)
    setUnresolvedPlayers([])
    try {
      const res = await fetch(`${API_BASE_URL}/admin/stages/${stageId}/import-matches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pubg_match_ids: ids, stage_day_id: importDay ? Number(importDay) : null, force_reprocess: forceReproc }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok) {
        setImportResult({ ok: false, message: d?.detail || `HTTP ${res.status}` })
      } else {
        const lines = [`Importados: ${d.imported ?? 0}`, `Skippados: ${d.skipped ?? 0}`]
        if (d.errors?.length) lines.push(`Erros: ${d.errors.map(e => e.error || e).join(', ')}`)
        if (d.unresolved_players?.length) lines.push(`Não resolvidos: ${d.unresolved_players.join(', ')}`)
        setImportResult({ ok: true, message: lines.join('\n') })
        if (d.unresolved_players?.length) setUnresolvedPlayers(d.unresolved_players)
      }
    } catch (e) {
      setImportResult({ ok: false, message: e.message })
    } finally {
      setImportLoading(false)
    }
  }

  function handleImportTournament() {
    const ids = [...selectedMatches]
    if (!ids.length) return setImportResult({ ok: false, message: 'Nenhuma partida selecionada.' })
    doImport(ids)
  }

  function handleImportManual() {
    const ids = matchIds.split(/[\n,\s]+/).map(s => s.trim()).filter(Boolean)
    if (!ids.length) return setImportResult({ ok: false, message: 'Nenhum match ID informado.' })
    doImport(ids)
  }

  function handleRecalcStats() {
    callApi(`/admin/stages/${stageId}/recalculate-stage-stats`, null, 'POST',
      setStatsLoading, setStatsResult,
      d => `Stats recalculadas: ${d.updated ?? d.persons_updated ?? 'ok'}`,
    )
  }

  function handleScoreDay() {
    if (!scoreDay) return setScoreDayResult({ ok: false, message: 'Selecione um dia.' })
    callApi(
      `/admin/stages/${stageId}/score-day`,
      { stage_day_id: Number(scoreDay) },
      'POST', setScoreDayLoading, setScoreDayResult,
      d => {
        const parts = [`Lineups pontuadas: ${d.lineups_scored ?? d.scored ?? 'ok'}`]
        if (d.stage_day_id) parts.push(`Dia: ${d.stage_day_id}`)
        return parts.join('\n')
      },
    )
  }

  async function searchPersons(q, setResults) {
    if (!q.trim()) return setResults([])
    try {
      const res = await fetch(`${API_BASE_URL}/admin/persons?search=${encodeURIComponent(q.trim())}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json().catch(() => [])
      setResults(Array.isArray(data) ? data : (data.items ?? []))
    } catch { setResults([]) }
  }

  function handlePreFillSub(person_id, person_name) {
    setSubOutPerson({ id: person_id, name: person_name })
    setSubOutSearch('')
    setSubOutResults([])
    setSubResult(null)
    setTimeout(() => subFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
  }

  function handlePreFillSubIn(person_id, person_name) {
    setSubInPerson({ id: person_id, name: person_name })
    setSubInSearch('')
    setSubInResults([])
    setSubResult(null)
    setTimeout(() => subFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
  }

  async function handleLoadStandings() {
    setStandingsLoading(true)
    setStandingsData(null)
    try {
      const res = await fetch(
        `${API_BASE_URL}/admin/stages/${stageId}/team-standings?top_n=${standingsTopN}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      const d = await res.json().catch(() => null)
      if (res.ok) setStandingsData(d)
      else setStandingsData({ error: d?.detail || `HTTP ${res.status}` })
    } catch (e) {
      setStandingsData({ error: e.message })
    } finally {
      setStandingsLoading(false)
    }
  }

  async function handleSaveSub() {
    if (!subOutPerson || !subInPerson) return
    setSubLoading(true)
    setSubResult(null)
    try {
      const res = await fetch(`${API_BASE_URL}/admin/stages/${stageId}/substitutions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ out_person_id: subOutPerson.id, in_person_id: subInPerson.id }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok) {
        setSubResult({ ok: false, message: d?.detail || `HTTP ${res.status}` })
      } else {
        setSubResult({ ok: true, message: `Substituição registrada: ${d.out_person_name} → ${d.in_person_name}` })
        setSubOutPerson(null); setSubOutSearch(''); setSubOutResults([])
        setSubInPerson(null);  setSubInSearch('');  setSubInResults([])
        loadSubs()
      }
    } catch (e) {
      setSubResult({ ok: false, message: e.message })
    } finally {
      setSubLoading(false)
    }
  }

  async function handleFetchNextStage() {
    setNextLoading(true)
    setNextStage(undefined)
    setOpenNextResult(null)
    try {
      const res = await fetch(`${API_BASE_URL}/admin/stages/${stageId}/next-stage`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const d = await res.json().catch(() => null)
      setNextStage(res.ok ? d : null)
    } catch { setNextStage(null) }
    finally { setNextLoading(false) }
  }

  async function handleOpenNextStage() {
    if (!nextStage) return
    setOpenNextLoading(true)
    setOpenNextResult(null)
    try {
      // 1. Recalcular pricing
      const r1 = await fetch(`${API_BASE_URL}/admin/pricing/stages/${nextStage.id}/recalculate-pricing`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!r1.ok) {
        const d = await r1.json().catch(() => null)
        setOpenNextResult({ ok: false, message: `Pricing falhou: ${d?.detail || r1.status}` })
        return
      }
      // 2. Abrir lineup
      const r2 = await fetch(`${API_BASE_URL}/admin/stages/${nextStage.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ lineup_status: 'open' }),
      })
      const d2 = await r2.json().catch(() => null)
      if (!r2.ok) {
        setOpenNextResult({ ok: false, message: `Abrir lineup falhou: ${d2?.detail || r2.status}` })
      } else {
        setOpenNextResult({ ok: true, message: `${nextStage.name} aberta com sucesso!` })
        setNextStage(prev => prev ? { ...prev, lineup_status: 'open' } : prev)
      }
    } catch (e) {
      setOpenNextResult({ ok: false, message: e.message })
    } finally {
      setOpenNextLoading(false)
    }
  }

  async function handleLoadStageMatches() {
    setStageMatchesLoading(true)
    setStageMatches(null)
    setReassignSelected(new Set())
    setReassignResult(null)
    try {
      const res = await fetch(`${API_BASE_URL}/admin/stages/${stageId}/matches`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const d = await res.json().catch(() => null)
      if (res.ok) setStageMatches(d)
      else setReassignResult({ ok: false, message: d?.detail || `HTTP ${res.status}` })
    } catch (e) {
      setReassignResult({ ok: false, message: e.message })
    } finally {
      setStageMatchesLoading(false)
    }
  }

  function toggleReassign(id) {
    setReassignSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleReassign() {
    if (!reassignSelected.size || !reassignTargetDay) return
    setReassignLoading(true)
    setReassignResult(null)
    try {
      const res = await fetch(`${API_BASE_URL}/admin/stages/${stageId}/reassign-match-day`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ match_ids: [...reassignSelected], target_stage_day_id: Number(reassignTargetDay) }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok) {
        setReassignResult({ ok: false, message: d?.detail || `HTTP ${res.status}` })
      } else {
        setReassignResult({
          ok: true,
          message: `${d.moved} partida(s) movida(s) para Dia ${d.target_day_number}.\n${d.cleared_day_stats} day_stats + ${d.cleared_stage_stats} stage_stats apagados.\n${d.next_step}`,
        })
        setReassignSelected(new Set())
        handleLoadStageMatches()
      }
    } catch (e) {
      setReassignResult({ ok: false, message: e.message })
    } finally {
      setReassignLoading(false)
    }
  }

  async function handlePreflight() {
    setPreflightLoading(true)
    setPreflightData(null)
    try {
      const res = await fetch(`${API_BASE_URL}/admin/stages/${stageId}/roster/preflight`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const d = await res.json().catch(() => null)
      if (res.ok) setPreflightData(d)
    } catch {}
    finally { setPreflightLoading(false) }
  }

  async function handleDeleteSub(subId) {
    try {
      await fetch(`${API_BASE_URL}/admin/stages/${stageId}/substitutions/${subId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      loadSubs()
    } catch {}
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  const dayLabel = d => {
    const dateStr = d.date
      ? new Date(d.date.substring(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
      : '—'
    return `Dia ${d.day_number} — ${dateStr}`
  }

  const newMatches = tournamentMatches.filter(m => !m.imported)
  const importedMatches = tournamentMatches.filter(m => m.imported)

  if (daysError) return <p style={{ color: '#f87171', fontSize: '13px' }}>{daysError}</p>

  return (
    <div style={{ maxWidth: '600px' }}>

      {/* ── Saúde da Stage ── */}
      <div style={card}>
        <div style={sectionTitle}>Saúde da Stage</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: preflightData ? 14 : 0 }}>
          <button style={btn('secondary')} onClick={handlePreflight} disabled={preflightLoading}>
            {preflightLoading ? 'Verificando…' : 'Verificar Accounts'}
          </button>
          {preflightData && (
            <span style={{ fontSize: 12, fontWeight: 600, color: preflightData.ok && preflightData.config_warnings.length === 0 ? '#86efac' : '#fca5a5' }}>
              {preflightData.ok && preflightData.config_warnings.length === 0
                ? `✓ Tudo ok (${preflightData.total_active} jogadores)`
                : `${preflightData.issues_count} problema(s) de account`}
            </span>
          )}
        </div>

        {preflightData && (
          <>
            {preflightData.issues.length > 0 && (
              <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 6, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#fca5a5', marginBottom: 6 }}>
                  Jogadores sem account válido ({preflightData.shard}):
                </div>
                {preflightData.issues.map(iss => (
                  <div key={iss.person_id} style={{ fontSize: 12, padding: '2px 0', color: 'rgba(255,255,255,0.75)' }}>
                    <span style={{ fontFamily: 'monospace', color: '#fca5a5', marginRight: 6 }}>[{iss.status}]</span>
                    {iss.person_name}
                    <span style={{ color: 'rgba(255,255,255,0.35)', margin: '0 6px' }}>—</span>
                    {iss.team_name}
                    {iss.pending_ids?.length > 0 && (
                      <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.3)', marginLeft: 8 }}>
                        ({iss.pending_ids[0]})
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {preflightData.config_warnings.length > 0 && (
              <div style={{ padding: '8px 12px', borderRadius: 6, background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', marginBottom: 6 }}>
                  Configurações:
                </div>
                {preflightData.config_warnings.map(w => (
                  <div key={w.check} style={{ fontSize: 12, color: '#fde68a', padding: '2px 0' }}>
                    ⚠ {w.message}
                  </div>
                ))}
              </div>
            )}

            {preflightData.ok && preflightData.config_warnings.length === 0 && (
              <div style={{ fontSize: 12, color: '#86efac' }}>
                {preflightData.total_active} jogadores com account ok. Nenhum warning de configuração.
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Importar Partidas ── */}
      <div style={card}>
        <div style={sectionTitle}>Importar Partidas</div>

        {/* Sub-tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
          {[['tournament', 'Por Torneio'], ['twire', 'Via Twire'], ['manual', 'Manual']].map(([t, label]) => (
            <button key={t} onClick={() => { setImportTab(t); setImportResult(null); setTournamentMatches([]); setSelectedMatches(new Set()); setFetchResult(null) }} style={{
              padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: importTab === t ? 'var(--xm-orange)' : 'rgba(255,255,255,0.06)',
              color: importTab === t ? '#000' : 'rgba(255,255,255,0.5)',
            }}>{label}</button>
          ))}
        </div>

        {/* ── Tab: Por Torneio ── */}
        {importTab === 'tournament' && (
          <div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '10px' }}>
              Informe o Tournament ID da PUBG API (ex: <code style={{ color: 'var(--xm-orange)' }}>am-pas126</code>)
              para buscar as partidas recentes e selecionar quais importar.
            </div>

            {/* Input + Buscar */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <input
                type="text"
                placeholder="Tournament ID (ex: am-pas126)"
                value={tournamentId}
                onChange={e => setTournamentId(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleFetchTournament()}
                style={{ ...input_, flex: 1 }}
              />
              <button
                style={btn('primary', { whiteSpace: 'nowrap' })}
                onClick={handleFetchTournament}
                disabled={fetchLoading || !tournamentId.trim()}
              >
                {fetchLoading ? 'Buscando…' : 'Buscar'}
              </button>
            </div>
            {fetchResult && <StatusBadge result={fetchResult} />}

            {/* Lista de partidas */}
            {tournamentMatches.length > 0 && (
              <MatchList
                matches={tournamentMatches}
                selectedMatches={selectedMatches}
                toggleMatch={toggleMatch}
                toggleAllNew={toggleAllNew}
                newMatches={newMatches}
                importedMatches={importedMatches}
              />
            )}
          </div>
        )}

        {/* ── Tab: Via Twire ── */}
        {importTab === 'twire' && (
          <div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '10px' }}>
              Backup quando a PUBG API falha. Informe o ID numérico do torneio no Twire
              (ex: <code style={{ color: 'var(--xm-orange)' }}>2513</code> para PAS,{' '}
              <code style={{ color: 'var(--xm-orange)' }}>2512</code> para PEC).
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <input
                type="number"
                placeholder="Tournament ID Twire (ex: 2513)"
                value={twireTournamentId}
                onChange={e => setTwireTournamentId(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleFetchTwire()}
                style={{ ...input_, flex: 1 }}
              />
              <input
                type="number"
                placeholder="Página"
                value={twirePage}
                onChange={e => setTwirePage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleFetchTwire()}
                style={{ ...input_, width: 72 }}
                min={1}
              />
              <button
                style={btn('primary', { whiteSpace: 'nowrap' })}
                onClick={handleFetchTwire}
                disabled={fetchLoading || !twireTournamentId.trim()}
              >
                {fetchLoading ? 'Buscando…' : 'Buscar'}
              </button>
            </div>
            {fetchResult && <StatusBadge result={fetchResult} />}

            {/* Lista de partidas — reutiliza o mesmo bloco abaixo */}
            {tournamentMatches.length > 0 && (
              <MatchList
                matches={tournamentMatches}
                selectedMatches={selectedMatches}
                toggleMatch={toggleMatch}
                toggleAllNew={toggleAllNew}
                newMatches={newMatches}
                importedMatches={importedMatches}
              />
            )}
          </div>
        )}

        {/* ── Tab: Manual ── */}
        {importTab === 'manual' && (
          <div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '10px' }}>
              Cole os Match IDs manualmente (um por linha, ou separados por vírgula/espaço).
            </div>
            <div style={{ marginBottom: '10px' }}>
              <textarea
                style={textarea_}
                placeholder={'ex:\nabc123\ndef456'}
                value={matchIds}
                onChange={e => setMatchIds(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Controles compartilhados de import */}
        {(importTab === 'manual' || tournamentMatches.length > 0) && (
          <div style={{ marginTop: 14 }}>
            <hr style={hr_} />
            <div style={{ marginBottom: '10px' }}>
              <span style={label}>Stage Day</span>
              <select style={select} value={importDay} onChange={e => setImportDay(e.target.value)}>
                <option value=''>— nenhum (detectar automático) —</option>
                {days.map(d => <option key={d.id} value={d.id}>{dayLabel(d)}</option>)}
              </select>
            </div>
            {preflightData && preflightData.issues_count > 0 && (
              <div style={{ marginBottom: 10, padding: '6px 10px', borderRadius: 6, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', fontSize: 12, color: '#fca5a5' }}>
                ⚠ {preflightData.issues_count} jogador(es) sem account válido — alguns aliases podem aparecer como não resolvidos.
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
                <input type='checkbox' checked={forceReproc} onChange={e => setForceReproc(e.target.checked)} style={{ accentColor: 'var(--xm-orange)' }} />
                Force reprocess
              </label>
              <button
                style={btn('primary')}
                onClick={importTab === 'manual' ? handleImportManual : handleImportTournament}
                disabled={importLoading || (importTab !== 'manual' && selectedMatches.size === 0)}
              >
                {importLoading
                  ? 'Importando…'
                  : importTab !== 'manual'
                    ? `Importar ${selectedMatches.size > 0 ? `(${selectedMatches.size})` : ''}`
                    : 'Importar'}
              </button>
            </div>
            <StatusBadge result={importResult} />
          </div>
        )}
      </div>

      {/* ── Corrigir Dia das Partidas ── */}
      <div style={card}>
        <div style={sectionTitle}>Corrigir Dia das Partidas</div>
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '12px' }}>
          Mova partidas importadas para o dia correto. Stats e scoring dos dias afetados são apagados automaticamente para reprocessamento.
        </div>

        <button style={btn('secondary')} onClick={handleLoadStageMatches} disabled={stageMatchesLoading}>
          {stageMatchesLoading ? 'Carregando…' : 'Carregar Partidas'}
        </button>

        {stageMatches && stageMatches.length === 0 && (
          <div style={{ marginTop: 10, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>Nenhuma partida importada.</div>
        )}

        {stageMatches && stageMatches.length > 0 && (
          <div style={{ marginTop: 14 }}>
            {/* Group by day */}
            {days.map(d => {
              const dayMatches = stageMatches.filter(m => m.stage_day_id === d.id)
              if (!dayMatches.length) return null
              return (
                <div key={d.id} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4 }}>
                    Dia {d.day_number}
                  </div>
                  {dayMatches.map((m, i) => {
                    const checked = reassignSelected.has(m.id)
                    return (
                      <div
                        key={m.id}
                        onClick={() => toggleReassign(m.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '7px 10px', cursor: 'pointer', borderRadius: 5,
                          background: checked ? 'rgba(249,115,22,0.08)' : 'transparent',
                          border: `1px solid ${checked ? 'rgba(249,115,22,0.25)' : 'rgba(255,255,255,0.05)'}`,
                          marginBottom: 3,
                        }}
                      >
                        <input type="checkbox" checked={checked} onChange={() => {}} style={{ accentColor: 'var(--xm-orange)', flexShrink: 0 }} />
                        <span style={{ fontFamily: 'monospace', fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'rgba(255,255,255,0.7)' }}>
                          {m.pubg_match_id}
                        </span>
                        {m.played_at && (
                          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>{fmtUtc(m.played_at)}</span>
                        )}
                        {m.map_name && (
                          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>{m.map_name.replace('_Main', '')}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}

            {reassignSelected.size > 0 && (
              <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 8, background: 'rgba(249,115,22,0.05)', border: '1px solid rgba(249,115,22,0.2)' }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>
                  {reassignSelected.size} partida(s) selecionada(s) — mover para:
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <select style={{ ...select, flex: 1 }} value={reassignTargetDay} onChange={e => setReassignTargetDay(e.target.value)}>
                    <option value=''>— selecione o dia destino —</option>
                    {days.map(d => <option key={d.id} value={d.id}>{dayLabel(d)}</option>)}
                  </select>
                  <button
                    style={btn('primary')}
                    onClick={handleReassign}
                    disabled={reassignLoading || !reassignTargetDay}
                  >
                    {reassignLoading ? 'Movendo…' : 'Mover'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <StatusBadge result={reassignResult} />
      </div>

      {/* ── Substituições ── */}
      <div style={card}>
        <div style={sectionTitle}>Substituições</div>
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '12px' }}>
          Registre quando um titular não jogou e um sub entrou no lugar. O sub é adicionado ao roster
          automaticamente (<code style={{ color: 'var(--xm-orange)' }}>is_available=False</code>). Reimporte as partidas após salvar.
        </div>

        {/* Jogadores não resolvidos do último import */}
        {unresolvedPlayers.length > 0 && (
          <div style={{ marginBottom: '12px', padding: '8px 12px', borderRadius: 6, background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#fbbf24', marginBottom: 4 }}>
              ⚠ Não resolvidos no último import
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {unresolvedPlayers.map(alias => (
                <span key={alias} style={{ fontSize: '11px', fontFamily: 'monospace', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 4, padding: '1px 8px', color: '#fde68a' }}>
                  {alias}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Lista de substituições existentes */}
        {subs.length > 0 && (
          <div style={{ marginBottom: '14px' }}>
            {subs.map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', marginBottom: 4 }}>
                <span style={{ fontSize: '13px' }}>
                  <span style={{ color: '#fca5a5' }}>{s.out_person_name}</span>
                  <span style={{ color: 'rgba(255,255,255,0.3)', margin: '0 6px' }}>→</span>
                  <span style={{ color: '#93c5fd' }}>{s.in_person_name}</span>
                  {s.created_at && (
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginLeft: 10, fontVariantNumeric: 'tabular-nums' }}>
                      {fmtUtc(s.created_at)}
                    </span>
                  )}
                </span>
                <button onClick={() => handleDeleteSub(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(248,113,113,0.6)', fontSize: '14px', padding: '0 4px' }} title="Remover">×</button>
              </div>
            ))}
          </div>
        )}

        {/* Form: registrar nova substituição */}
        <div ref={subFormRef} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <span style={label}>Titular que saiu</span>
            <input
              style={input_}
              placeholder="Buscar por nome…"
              value={subOutPerson ? subOutPerson.name : subOutSearch}
              onChange={e => {
                if (subOutPerson) { setSubOutPerson(null) }
                setSubOutSearch(e.target.value)
                searchPersons(e.target.value, setSubOutResults)
              }}
            />
            {subOutResults.length > 0 && !subOutPerson && (
              <div style={{ borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: '#0d0f14', marginTop: 2, zIndex: 10 }}>
                {subOutResults.map(p => (
                  <div key={p.id} onClick={() => { setSubOutPerson({ id: p.id, name: p.display_name }); setSubOutResults([]) }}
                    style={{ padding: '6px 10px', fontSize: 12, cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(249,115,22,0.08)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    {p.display_name}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <span style={label}>Sub que entrou</span>
            <input
              style={input_}
              placeholder="Buscar por nome…"
              value={subInPerson ? subInPerson.name : subInSearch}
              onChange={e => {
                if (subInPerson) { setSubInPerson(null) }
                setSubInSearch(e.target.value)
                searchPersons(e.target.value, setSubInResults)
              }}
            />
            {subInResults.length > 0 && !subInPerson && (
              <div style={{ borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: '#0d0f14', marginTop: 2, zIndex: 10 }}>
                {subInResults.map(p => (
                  <div key={p.id} onClick={() => { setSubInPerson({ id: p.id, name: p.display_name }); setSubInResults([]) }}
                    style={{ padding: '6px 10px', fontSize: 12, cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(249,115,22,0.08)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    {p.display_name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <button
          style={btn('secondary')}
          onClick={handleSaveSub}
          disabled={subLoading || !subOutPerson || !subInPerson}
        >
          {subLoading ? 'Salvando…' : 'Salvar Substituição'}
        </button>
        <StatusBadge result={subResult} />
      </div>

      {/* ── Stats & Scoring ── */}
      <div style={card}>
        <div style={sectionTitle}>Stats & Scoring</div>

        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>
            Reconstrói os totais de stats da stage do zero. Execute após importar os matches do dia.
          </div>
          <button style={btn('secondary')} onClick={handleRecalcStats} disabled={statsLoading}>
            {statsLoading ? 'Recalculando…' : 'Recalcular Stats da Stage'}
          </button>
          <StatusBadge result={statsResult} />
        </div>

        <hr style={hr_} />

        <div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>
            Calcula pontos de todos os lineups do dia selecionado.
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <select style={{ ...select, width: 'auto', flex: 1 }} value={scoreDay} onChange={e => setScoreDay(e.target.value)}>
              <option value=''>— selecione o dia —</option>
              {days.map(d => <option key={d.id} value={d.id}>{dayLabel(d)}</option>)}
            </select>
            <button style={btn('primary')} onClick={handleScoreDay} disabled={scoreDayLoading}>
              {scoreDayLoading ? 'Pontuando…' : 'Pontuar Dia'}
            </button>
          </div>

          {missingLoading && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>Verificando roster…</div>
          )}
          {missingPlayers && missingPlayers.missing.length > 0 && (
            <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.25)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24', marginBottom: 8 }}>
                ⚠ {missingPlayers.missing.length} jogador(es) do roster sem stats hoje — possíveis substituídos
              </div>
              {missingPlayers.missing.map(p => (
                <div key={p.person_id} style={{ fontSize: 12, padding: '4px 0', display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.75)' }}>
                  <span style={{ color: '#fde68a', fontWeight: 600 }}>{p.person_name}</span>
                  <span style={{ color: 'rgba(255,255,255,0.3)' }}>—</span>
                  <span>{p.team_name}</span>
                  {p.has_substitution ? (
                    <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 4, padding: '1px 6px', color: '#86efac' }}>
                      sub registrada
                    </span>
                  ) : p.is_sub_in ? (
                    <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 4, padding: '1px 6px', color: '#a5b4fc' }}>
                      é o sub que entrou — verificar stats
                    </span>
                  ) : (
                    <button
                      onClick={() => handlePreFillSub(p.person_id, p.person_name)}
                      style={{ fontSize: 10, fontWeight: 600, background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: 4, padding: '2px 8px', color: 'var(--xm-orange)', cursor: 'pointer' }}
                      title="Pré-preencher como titular que saiu"
                    >
                      → registrar sub
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {missingPlayers && missingPlayers.missing.length === 0 && scoreDay && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#86efac' }}>
              ✓ Todos os {missingPlayers.total_roster} jogadores do roster aparecem em pelo menos uma partida.
            </div>
          )}
          {missingPlayers && missingPlayers.unexpected && missingPlayers.unexpected.length > 0 && (
            <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.25)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#818cf8', marginBottom: 8 }}>
                ↑ {missingPlayers.unexpected.length} jogador(es) com stats fora do roster ativo — possíveis subs que entraram
              </div>
              {missingPlayers.unexpected.map(p => (
                <div key={p.person_id} style={{ fontSize: 12, padding: '4px 0', display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.75)' }}>
                  <span style={{ color: '#c7d2fe', fontWeight: 600 }}>{p.person_name}</span>
                  <span style={{ color: 'rgba(255,255,255,0.3)' }}>—</span>
                  <span>{p.team_name || '?'}</span>
                  {p.has_substitution ? (
                    <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 4, padding: '1px 6px', color: '#86efac' }}>
                      sub registrada
                    </span>
                  ) : (
                    <button
                      onClick={() => handlePreFillSubIn(p.person_id, p.person_name)}
                      style={{ fontSize: 10, fontWeight: 600, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 4, padding: '2px 8px', color: '#818cf8', cursor: 'pointer' }}
                      title="Pré-preencher como substituto que entrou"
                    >
                      → registrar como sub que entrou
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <StatusBadge result={scoreDayResult} />
          {scoreDayResult?.ok && (
            <div style={{ marginTop: 8 }}>
              <a
                href="/admin/email"
                style={{
                  fontSize: 12, color: '#818cf8',
                  textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px', borderRadius: 6,
                  background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)',
                }}
              >
                📧 Enviar resultados por e-mail
              </a>
            </div>
          )}
        </div>
      </div>

      {/* ── Próxima Stage ── */}
      <div style={card}>
        <div style={sectionTitle}>Transição de Stage</div>
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '12px' }}>
          Infere a próxima stage do championship, recalcula pricing e abre o lineup.
          O roster deve estar configurado antes de confirmar.
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: nextStage !== undefined ? 14 : 0 }}>
          <button style={btn('secondary')} onClick={handleFetchNextStage} disabled={nextLoading}>
            {nextLoading ? 'Buscando…' : 'Buscar Próxima Stage'}
          </button>
          {nextStage === null && !nextLoading && (
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>Nenhuma stage pendente encontrada.</span>
          )}
        </div>

        {nextStage && (
          <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(249,115,22,0.15)', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--xm-orange)', marginBottom: 8 }}>
              {nextStage.name}
              <span style={{ fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,0.4)', marginLeft: 8 }}>
                [{nextStage.lineup_status}] · {nextStage.shard}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px 16px', fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 10 }}>
              <span>price_min: <b style={{ color: '#fff' }}>{nextStage.price_min}</b></span>
              <span>price_max: <b style={{ color: '#fff' }}>{nextStage.price_max}</b></span>
              <span>newcomer: <b style={{ color: '#fff' }}>{nextStage.pricing_newcomer_cost}</b></span>
              <span>captain: <b style={{ color: '#fff' }}>×{nextStage.captain_multiplier}</b></span>
              {nextStage.pubg_tournament_id && (
                <span style={{ gridColumn: 'span 2' }}>tournament_id: <b style={{ color: '#fff', fontFamily: 'monospace' }}>{nextStage.pubg_tournament_id}</b></span>
              )}
              {nextStage.independent_lineups && (
                <span style={{ gridColumn: 'span 3', color: '#fbbf24' }}>⚡ Lineups independentes por dia</span>
              )}
            </div>

            {nextStage.lineup_status !== 'open' ? (
              <button
                style={btn('primary')}
                onClick={handleOpenNextStage}
                disabled={openNextLoading}
              >
                {openNextLoading ? 'Abrindo…' : `Confirmar — Abrir ${nextStage.short_name}`}
              </button>
            ) : (
              <span style={{ fontSize: 12, color: '#86efac', fontWeight: 600 }}>✓ Lineup já aberto</span>
            )}
          </div>
        )}

        <StatusBadge result={openNextResult} />
      </div>

      {/* ── Standings da Stage ── */}
      <div style={card}>
        <div style={sectionTitle}>Standings da Stage</div>
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '12px' }}>
          Ranking por pontuação oficial PUBG (sobrevivência + kills). Útil para identificar classificados para a próxima fase.
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Top</span>
            <select
              style={{ ...select, width: 70 }}
              value={standingsTopN}
              onChange={e => setStandingsTopN(Number(e.target.value))}
            >
              {[4, 8, 12, 16].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <button style={btn('secondary')} onClick={handleLoadStandings} disabled={standingsLoading}>
            {standingsLoading ? 'Calculando…' : 'Calcular Standings'}
          </button>
        </div>

        {standingsData?.error && (
          <div style={{ fontSize: 12, color: '#fca5a5' }}>{standingsData.error}</div>
        )}
        {standingsData?.standings && (
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>
              {standingsData.stage_name} · {standingsData.standings.length} de {standingsData.total_teams} times
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 60px 60px 60px', gap: '2px 0', fontSize: 12 }}>
              <span style={{ color: 'rgba(255,255,255,0.3)', paddingBottom: 4 }}>#</span>
              <span style={{ color: 'rgba(255,255,255,0.3)', paddingBottom: 4 }}>Time</span>
              <span style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'right', paddingBottom: 4 }}>Pts</span>
              <span style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'right', paddingBottom: 4 }}>Surv</span>
              <span style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'right', paddingBottom: 4 }}>Kills</span>
              {standingsData.standings.map((s, i) => (
                <>
                  <span key={`r${i}`} style={{ color: i < standingsTopN ? 'var(--xm-orange)' : 'rgba(255,255,255,0.4)', fontWeight: 700 }}>{s.rank}</span>
                  <span key={`n${i}`} style={{ color: i < 8 ? '#fff' : 'rgba(255,255,255,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.team_name}</span>
                  <span key={`t${i}`} style={{ textAlign: 'right', fontWeight: 700, color: '#fde68a' }}>{s.total_pts}</span>
                  <span key={`sv${i}`} style={{ textAlign: 'right', color: 'rgba(255,255,255,0.5)' }}>{s.survival_pts}</span>
                  <span key={`k${i}`} style={{ textAlign: 'right', color: 'rgba(255,255,255,0.5)' }}>{s.kill_pts}</span>
                </>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
