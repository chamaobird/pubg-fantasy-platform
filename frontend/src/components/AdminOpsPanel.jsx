// frontend/src/components/AdminOpsPanel.jsx
// Painel admin de operações de dia: import de matches, recálculo de stats, scoring e match schedule.

import { useEffect, useState, useCallback } from 'react'
import { API_BASE_URL } from '../config'

// ── Estilos ──────────────────────────────────────────────────────────────────

const _orange = 'var(--color-xama-orange)'

const btn = (variant = 'primary', extra = {}) => ({
  padding: '6px 16px',
  borderRadius: '6px',
  border: 'none',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: 600,
  ...(variant === 'primary'   && { background: 'var(--color-xama-orange)', color: '#000' }),
  ...(variant === 'danger'    && { background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }),
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
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(249,115,22,0.2)',
  borderRadius: '6px',
  color: '#fff',
  padding: '6px 10px',
  fontSize: '13px',
  width: '100%',
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
    return new Date(iso).toLocaleString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' UTC'
  } catch { return iso }
}

// ── Componente principal ──────────────────────────────────────────────────────

function fmtBrt(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit',
    }) + ' BRT'
  } catch { return iso }
}

export default function AdminOpsPanel({ stageId, token }) {
  const [days,      setDays]      = useState([])
  const [daysError, setDaysError] = useState('')

  // Stage state (for lineup_close_at)
  const [stageData,      setStageData]      = useState(null)
  const [extendMins,     setExtendMins]     = useState('')
  const [extendLoading,  setExtendLoading]  = useState(false)
  const [extendResult,   setExtendResult]   = useState(null)

  // Import state
  const [importDay,      setImportDay]      = useState('')
  const [matchIds,       setMatchIds]       = useState('')
  const [forceReproc,    setForceReproc]    = useState(false)
  const [importLoading,  setImportLoading]  = useState(false)
  const [importResult,   setImportResult]   = useState(null)

  // Stats state
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsResult,  setStatsResult]  = useState(null)

  // Score day state
  const [scoreDay,        setScoreDay]        = useState('')
  const [scoreDayLoading, setScoreDayLoading] = useState(false)
  const [scoreDayResult,  setScoreDayResult]  = useState(null)

  // Rescore all state
  const [rescoreLoading, setRescoreLoading] = useState(false)
  const [rescoreResult,  setRescoreResult]  = useState(null)

  // Lineup control state
  const [lcStatus,  setLcStatus]  = useState('')
  const [lcLoading, setLcLoading] = useState(false)
  const [lcResult,  setLcResult]  = useState(null)

  // Notificação state
  const [notifLoading, setNotifLoading] = useState(false)
  const [notifResult,  setNotifResult]  = useState(null)

  // Schedule state
  const [scheduleDay,     setScheduleDay]     = useState('')
  const [scheduleJson,    setScheduleJson]    = useState('')
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [scheduleResult,  setScheduleResult]  = useState(null)

  const loadDays = useCallback(() => {
    if (!stageId) return
    fetch(`${API_BASE_URL}/stages/${stageId}/days`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => {
        const sorted = [...data].sort((a, b) => a.day_number - b.day_number)
        setDays(sorted)
        const today = new Date().toISOString().slice(0, 10)
        const active = sorted.filter(d => d.date <= today).at(-1) || sorted[0]
        if (active) {
          setImportDay(String(active.id))
          setScoreDay(String(active.id))
          setScheduleDay(String(active.id))
        }
      })
      .catch(() => setDaysError('Erro ao carregar dias da stage'))
  }, [stageId])

  const loadStage = useCallback(() => {
    if (!stageId) return
    fetch(`${API_BASE_URL}/stages/${stageId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setStageData(data) })
      .catch(() => {})
  }, [stageId])

  useEffect(() => { loadDays(); loadStage() }, [loadDays, loadStage])

  // Quando muda o dia selecionado no schedule, preenche o JSON atual
  useEffect(() => {
    if (!scheduleDay) return
    const day = days.find(d => String(d.id) === scheduleDay)
    if (!day) return
    if (day.match_schedule) {
      setScheduleJson(JSON.stringify(day.match_schedule, null, 2))
    } else {
      // Template padrão de 4 partidas (40min de intervalo, a partir de 22:45 UTC)
      const date = day.date  // YYYY-MM-DD
      const template = [1, 2, 3, 4].map((n, i) => {
        const h = 22 + Math.floor((45 + i * 40) / 60)
        const m = (45 + i * 40) % 60
        return {
          match_number: n,
          import_after: `${date}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00Z`,
          pubg_match_id: null,
        }
      })
      setScheduleJson(JSON.stringify(template, null, 2))
    }
  }, [scheduleDay, days])

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

  function handleImport() {
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

  function handleRescore() {
    if (!window.confirm('Reexecutar scoring de TODOS os dias desta stage?')) return
    callApi(`/admin/stages/${stageId}/rescore`, null, 'POST',
      setRescoreLoading, setRescoreResult,
      d => `Rescore completo: ${d.days_scored ?? 'ok'} dias`,
    )
  }

  function handleNotifyLineupOpen() {
    if (!window.confirm('Enviar email de "Lineup aberta" para todos os usuários?')) return
    callApi(
      `/admin/stages/${stageId}/notify-lineup-open`,
      null, 'POST',
      setNotifLoading, setNotifResult,
      d => `Emails enviados: ${d.sent ?? 0} ✓  falhas: ${d.failed ?? 0}`,
    )
  }

  async function handleLineupControl() {
    if (!lcStatus) return
    setLcLoading(true)
    setLcResult(null)
    try {
      const res = await fetch(`${API_BASE_URL}/admin/stages/${stageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ lineup_status: lcStatus }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) setLcResult({ ok: false, message: data?.detail || `HTTP ${res.status}` })
      else setLcResult({ ok: true, message: `Status → ${data.lineup_status ?? lcStatus}` })
    } catch (e) {
      setLcResult({ ok: false, message: e.message })
    } finally {
      setLcLoading(false)
    }
  }

  async function handleExtendDeadline(mins) {
    const minutes = Number(mins)
    if (!minutes || minutes <= 0) return setExtendResult({ ok: false, message: 'Informe um número positivo de minutos.' })
    setExtendLoading(true)
    setExtendResult(null)
    try {
      const res = await fetch(`${API_BASE_URL}/admin/stages/${stageId}/extend-deadline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ minutes }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setExtendResult({ ok: false, message: data?.detail || `HTTP ${res.status}` })
      } else {
        setExtendResult({
          ok: true,
          message: `+${minutes}min aplicado\nNovo prazo: ${fmtBrt(data.new_lineup_close_at)}`,
        })
        setExtendMins('')
        loadStage()
      }
    } catch (e) {
      setExtendResult({ ok: false, message: e.message })
    } finally {
      setExtendLoading(false)
    }
  }

  async function handleSaveSchedule() {
    if (!scheduleDay) return setScheduleResult({ ok: false, message: 'Selecione um dia.' })
    let parsed
    try {
      parsed = JSON.parse(scheduleJson)
    } catch {
      return setScheduleResult({ ok: false, message: 'JSON inválido. Verifique a formatação.' })
    }
    setScheduleLoading(true)
    setScheduleResult(null)
    try {
      const res = await fetch(
        `${API_BASE_URL}/admin/stage-days/${scheduleDay}/match-schedule`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ schedule: parsed }),
        },
      )
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setScheduleResult({ ok: false, message: data?.detail || `HTTP ${res.status}` })
      } else {
        setScheduleResult({ ok: true, message: `Schedule salvo: ${parsed.length} entrada(s)` })
        // Recarrega os dias para mostrar o schedule atualizado
        loadDays()
      }
    } catch (e) {
      setScheduleResult({ ok: false, message: e.message })
    } finally {
      setScheduleLoading(false)
    }
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  const dayLabel = d => `Dia ${d.day_number} — ${new Date(d.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`

  const selectedScheduleDay = days.find(d => String(d.id) === scheduleDay)
  const currentSchedule = selectedScheduleDay?.match_schedule || []

  if (daysError) return <p style={{ color: '#f87171', fontSize: '13px' }}>{daysError}</p>

  return (
    <div style={{ maxWidth: '600px' }}>

      {/* ── Prazo de Fechamento ── */}
      <div style={card}>
        <div style={sectionTitle}>Prazo de Fechamento</div>
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '12px' }}>
          Estenda o <code style={{ color: _orange }}>lineup_close_at</code> em tempo real — útil quando há
          atrasos no início da partida. O countdown no lineup dos usuários atualiza automaticamente.
        </div>

        {/* Prazo atual */}
        <div style={{
          marginBottom: '14px', padding: '10px 14px', borderRadius: '8px',
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(249,115,22,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
        }}>
          <div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Prazo atual
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'monospace', color: stageData?.lineup_close_at ? 'var(--color-xama-orange)' : 'rgba(255,255,255,0.3)' }}>
              {stageData?.lineup_close_at ? fmtBrt(stageData.lineup_close_at) : '—'}
            </div>
          </div>
          <button
            style={{ ...btn('ghost'), fontSize: '11px', padding: '4px 10px' }}
            onClick={loadStage}
          >↻ atualizar</button>
        </div>

        {/* Botões rápidos */}
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>
          Extensão rápida:
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
          {[10, 15, 30, 60].map(m => (
            <button
              key={m}
              style={btn('secondary', { fontSize: '12px', padding: '5px 12px' })}
              onClick={() => handleExtendDeadline(m)}
              disabled={extendLoading}
            >+{m}min</button>
          ))}
        </div>

        {/* Campo custom */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type='number'
            min='1'
            placeholder='minutos'
            style={{ ...input_, width: '100px', flex: 'none' }}
            value={extendMins}
            onChange={e => setExtendMins(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleExtendDeadline(extendMins)}
          />
          <button
            style={btn('primary')}
            onClick={() => handleExtendDeadline(extendMins)}
            disabled={extendLoading || !extendMins}
          >{extendLoading ? 'Aplicando…' : 'Estender'}</button>
        </div>
        <StatusBadge result={extendResult} />
      </div>

      {/* ── Match Schedule ── */}
      <div style={card}>
        <div style={sectionTitle}>Schedule de Partidas</div>
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '10px' }}>
          Define quando o job automático tenta importar cada partida.
          Edite <code style={{ color: 'var(--color-xama-orange)' }}>import_after</code> (UTC) e,
          opcionalmente, <code style={{ color: 'var(--color-xama-orange)' }}>pubg_match_id</code> se
          já souber o ID.
        </div>

        <div style={{ marginBottom: '10px' }}>
          <span style={label}>Stage Day</span>
          <select style={select} value={scheduleDay} onChange={e => setScheduleDay(e.target.value)}>
            <option value=''>— selecione —</option>
            {days.map(d => <option key={d.id} value={d.id}>{dayLabel(d)}</option>)}
          </select>
        </div>

        {/* Status do schedule atual */}
        {currentSchedule.length > 0 && (
          <div style={{
            marginBottom: '10px',
            padding: '8px 10px',
            borderRadius: '6px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>
              Status atual ({currentSchedule.length} partida{currentSchedule.length !== 1 ? 's' : ''}):
            </div>
            {currentSchedule.map((e, i) => {
              const done = !!e.processed_at
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', marginBottom: '3px' }}>
                  <span style={{
                    width: '16px', height: '16px', borderRadius: '50%', display: 'inline-flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: '10px',
                    background: done ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.06)',
                    color: done ? '#86efac' : 'rgba(255,255,255,0.3)',
                    flexShrink: 0,
                  }}>
                    {done ? '✓' : e.match_number ?? i + 1}
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>
                    {fmtUtc(e.import_after)}
                  </span>
                  {e.pubg_match_id && (
                    <span style={{ fontFamily: 'monospace', fontSize: '10px', color: 'rgba(249,115,22,0.7)' }}>
                      {e.pubg_match_id.slice(0, 8)}…
                    </span>
                  )}
                  {done && (
                    <span style={{ fontSize: '10px', color: 'rgba(34,197,94,0.6)' }}>
                      importado {fmtUtc(e.processed_at)}
                    </span>
                  )}
                </div>
              )
            })}
            {selectedScheduleDay?.last_import_at && (
              <div style={{ fontSize: '11px', color: 'rgba(34,197,94,0.5)', marginTop: '6px' }}>
                Último import: {fmtUtc(selectedScheduleDay.last_import_at)}
              </div>
            )}
          </div>
        )}

        <div style={{ marginBottom: '10px' }}>
          <span style={label}>JSON do schedule</span>
          <textarea
            style={textarea_}
            rows={12}
            value={scheduleJson}
            onChange={e => setScheduleJson(e.target.value)}
            spellCheck={false}
          />
        </div>

        <button style={btn('primary')} onClick={handleSaveSchedule} disabled={scheduleLoading}>
          {scheduleLoading ? 'Salvando…' : 'Salvar Schedule'}
        </button>
        <StatusBadge result={scheduleResult} />
      </div>

      {/* ── Import Manual ── */}
      <div style={card}>
        <div style={sectionTitle}>Import Manual</div>
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '10px' }}>
          Use para importar manualmente em caso de atraso ou falha do job automático.
        </div>

        <div style={{ marginBottom: '10px' }}>
          <span style={label}>Stage Day</span>
          <select style={select} value={importDay} onChange={e => setImportDay(e.target.value)}>
            <option value=''>— nenhum (detectar automático) —</option>
            {days.map(d => <option key={d.id} value={d.id}>{dayLabel(d)}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: '10px' }}>
          <span style={label}>Match IDs (um por linha, ou separados por vírgula/espaço)</span>
          <textarea style={textarea_} placeholder={'ex:\nabc123\ndef456'} value={matchIds} onChange={e => setMatchIds(e.target.value)} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
            <input type='checkbox' checked={forceReproc} onChange={e => setForceReproc(e.target.checked)} style={{ accentColor: 'var(--color-xama-orange)' }} />
            Force reprocess
          </label>
          <button style={btn('primary')} onClick={handleImport} disabled={importLoading}>
            {importLoading ? 'Importando…' : 'Importar'}
          </button>
        </div>
        <StatusBadge result={importResult} />
      </div>

      {/* ── Stats & Scoring ── */}
      <div style={card}>
        <div style={sectionTitle}>Stats & Scoring</div>

        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
            Reconstrói PERSON_STAGE_STAT do zero. Execute após importar os matches do dia.
          </div>
          <button style={btn('secondary')} onClick={handleRecalcStats} disabled={statsLoading}>
            {statsLoading ? 'Recalculando…' : 'Recalcular Stats da Stage'}
          </button>
          <StatusBadge result={statsResult} />
        </div>

        <hr style={hr_} />

        <div style={{ marginBottom: '14px' }}>
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

        <hr style={hr_} />

        <div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
            Re-executa o scoring de <strong style={{ color: '#fcd34d' }}>todos os dias</strong> da stage.
          </div>
          <button style={btn('danger')} onClick={handleRescore} disabled={rescoreLoading}>
            {rescoreLoading ? 'Rescorando…' : 'Rescore Completo'}
          </button>
          <StatusBadge result={rescoreResult} />
        </div>
      </div>

      {/* ── Notificações ── */}
      <div style={card}>
        <div style={sectionTitle}>Notificações</div>
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '10px' }}>
          Envia email de <strong style={{ color: _orange }}>"Lineup aberta"</strong> para todos os usuários verificados.
          O job automático já faz isso ao abrir a stage — use aqui apenas para reenviar.
        </div>
        <button style={btn('secondary')} onClick={handleNotifyLineupOpen} disabled={notifLoading}>
          {notifLoading ? 'Enviando…' : 'Enviar notificação de lineup aberta'}
        </button>
        <StatusBadge result={notifResult} />
      </div>

      {/* ── Controle de Lineup ── */}
      <div style={card}>
        <div style={sectionTitle}>Controle de Lineup</div>
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '10px' }}>
          Forçar transição manual de status (override de emergência).
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select style={{ ...select, width: 'auto', flex: 1 }} value={lcStatus} onChange={e => setLcStatus(e.target.value)}>
            <option value=''>— selecione o status —</option>
            <option value='closed'>closed</option>
            <option value='open'>open</option>
            <option value='locked'>locked</option>
          </select>
          <button style={btn('danger')} onClick={handleLineupControl} disabled={lcLoading || !lcStatus}>
            {lcLoading ? 'Aplicando…' : 'Aplicar'}
          </button>
        </div>
        <StatusBadge result={lcResult} />
      </div>

    </div>
  )
}
