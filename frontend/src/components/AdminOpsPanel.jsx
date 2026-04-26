// frontend/src/components/AdminOpsPanel.jsx
// Painel admin de operações de dia: import de matches, stats e scoring.

import { useEffect, useState, useCallback } from 'react'
import { API_BASE_URL } from '../config'

// ── Estilos ──────────────────────────────────────────────────────────────────

const btn = (variant = 'primary', extra = {}) => ({
  padding: '6px 16px',
  borderRadius: '6px',
  border: 'none',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: 600,
  ...(variant === 'primary'   && { background: 'var(--color-xama-orange)', color: '#000' }),
  ...(variant === 'secondary' && { background: 'rgba(249,115,22,0.08)', color: 'var(--color-xama-orange)', border: '1px solid rgba(249,115,22,0.2)' }),
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
  color: 'var(--color-xama-orange)',
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
  const [importTab,       setImportTab]       = useState('tournament')  // 'tournament' | 'manual'
  const [tournamentId,    setTournamentId]    = useState('')
  const [tournamentMatches, setTournamentMatches] = useState([])   // [{match_id, imported, played_at, stage_day_id}]
  const [selectedMatches, setSelectedMatches] = useState(new Set())
  const [fetchLoading,    setFetchLoading]    = useState(false)
  const [fetchResult,     setFetchResult]     = useState(null)

  // Import compartilhado
  const [importDay,      setImportDay]      = useState('')
  const [forceReproc,    setForceReproc]    = useState(false)
  const [importLoading,  setImportLoading]  = useState(false)
  const [importResult,   setImportResult]   = useState(null)

  // Import manual
  const [matchIds,   setMatchIds]   = useState('')

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

  useEffect(() => { loadDays() }, [loadDays])

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
        setFetchResult({ ok: false, message: data?.detail || `HTTP ${res.status}` })
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

  function handleImportTournament() {
    const ids = [...selectedMatches]
    if (!ids.length) return setImportResult({ ok: false, message: 'Nenhuma partida selecionada.' })
    callApi(
      `/admin/stages/${stageId}/import-matches`,
      { pubg_match_ids: ids, stage_day_id: importDay ? Number(importDay) : null, force_reprocess: forceReproc },
      'POST', setImportLoading, setImportResult,
      d => {
        const lines = [`Importados: ${d.imported ?? 0}`, `Skippados: ${d.skipped ?? 0}`]
        if (d.errors?.length) lines.push(`Erros: ${d.errors.join(', ')}`)
        return lines.join('\n')
      },
    )
  }

  function handleImportManual() {
    const ids = matchIds.split(/[\n,\s]+/).map(s => s.trim()).filter(Boolean)
    if (!ids.length) return setImportResult({ ok: false, message: 'Nenhum match ID informado.' })
    callApi(
      `/admin/stages/${stageId}/import-matches`,
      { pubg_match_ids: ids, stage_day_id: importDay ? Number(importDay) : null, force_reprocess: forceReproc },
      'POST', setImportLoading, setImportResult,
      d => {
        const lines = [`Importados: ${d.imported ?? 0}`, `Skippados: ${d.skipped ?? 0}`]
        if (d.errors?.length) lines.push(`Erros: ${d.errors.join(', ')}`)
        return lines.join('\n')
      },
    )
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

  // ── Render helpers ────────────────────────────────────────────────────────

  const dayLabel = d => {
    const dateStr = d.date
      ? new Date(d.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
      : '—'
    return `Dia ${d.day_number} — ${dateStr}`
  }

  const newMatches = tournamentMatches.filter(m => !m.imported)
  const importedMatches = tournamentMatches.filter(m => m.imported)

  if (daysError) return <p style={{ color: '#f87171', fontSize: '13px' }}>{daysError}</p>

  return (
    <div style={{ maxWidth: '600px' }}>

      {/* ── Importar Partidas ── */}
      <div style={card}>
        <div style={sectionTitle}>Importar Partidas</div>

        {/* Sub-tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
          {[['tournament', 'Por Torneio'], ['manual', 'Manual']].map(([t, label]) => (
            <button key={t} onClick={() => { setImportTab(t); setImportResult(null) }} style={{
              padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: importTab === t ? 'var(--color-xama-orange)' : 'rgba(255,255,255,0.06)',
              color: importTab === t ? '#000' : 'rgba(255,255,255,0.5)',
            }}>{label}</button>
          ))}
        </div>

        {/* ── Tab: Por Torneio ── */}
        {importTab === 'tournament' && (
          <div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '10px' }}>
              Informe o Tournament ID da PUBG API (ex: <code style={{ color: 'var(--color-xama-orange)' }}>am-pas126</code>)
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
              <div>
                {/* Cabeçalho */}
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

                {/* Items */}
                <div style={{
                  maxHeight: 280, overflowY: 'auto',
                  borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)',
                }}>
                  {tournamentMatches.map((m, i) => {
                    const checked = selectedMatches.has(m.match_id)
                    return (
                      <div
                        key={m.match_id}
                        onClick={() => toggleMatch(m.match_id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '9px 12px', cursor: 'pointer',
                          borderBottom: i < tournamentMatches.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                          background: checked ? 'rgba(249,115,22,0.06)' : 'transparent',
                          opacity: m.imported && !checked ? 0.5 : 1,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {}}
                          style={{ accentColor: 'var(--color-xama-orange)', flexShrink: 0 }}
                        />
                        <span style={{
                          fontFamily: 'monospace', fontSize: 11,
                          color: m.imported ? 'rgba(255,255,255,0.4)' : 'var(--color-xama-text)',
                          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {m.match_id}
                        </span>
                        {m.imported ? (
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#4ade80', flexShrink: 0 }}>
                            importado
                          </span>
                        ) : (
                          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-xama-orange)', flexShrink: 0 }}>
                            novo
                          </span>
                        )}
                        {m.played_at && (
                          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
                            {fmtUtc(m.played_at)}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
                <input type='checkbox' checked={forceReproc} onChange={e => setForceReproc(e.target.checked)} style={{ accentColor: 'var(--color-xama-orange)' }} />
                Force reprocess
              </label>
              <button
                style={btn('primary')}
                onClick={importTab === 'tournament' ? handleImportTournament : handleImportManual}
                disabled={importLoading || (importTab === 'tournament' && selectedMatches.size === 0)}
              >
                {importLoading
                  ? 'Importando…'
                  : importTab === 'tournament'
                    ? `Importar ${selectedMatches.size > 0 ? `(${selectedMatches.size})` : ''}`
                    : 'Importar'}
              </button>
            </div>
            <StatusBadge result={importResult} />
          </div>
        )}
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
          <StatusBadge result={scoreDayResult} />
        </div>
      </div>

    </div>
  )
}
