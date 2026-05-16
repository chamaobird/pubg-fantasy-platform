// pages/admin/AdminChampionships.jsx — CRUD de Championships
import { useState, useEffect, useCallback } from 'react'
import { API_BASE_URL } from '../../config'
import {
  Modal, Field, Msg, ActBtn, SaveBtn, SectionHeader,
  inputStyle, selectStyle, tableStyle, thStyle, tdStyle,
  useSorting, SortableHeader,
} from './Modal'

// ── Coverage Audit Panel ───────────────────────────────────────────────────────

// ── helpers ──────────────────────────────────────────────────────────────────

const badge = (color, bg, border, text) => (
  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
    fontFamily: 'JetBrains Mono, monospace', background: bg, border: `1px solid ${border}`, color }}>
    {text}
  </span>
)
const coverageBadge = (pct) => pct === 0
  ? badge('#ef4444', 'rgba(239,68,68,0.12)', 'rgba(239,68,68,0.4)', '0%')
  : badge('#f59e0b', 'rgba(251,191,36,0.12)', 'rgba(251,191,36,0.4)', `${pct}%`)

const confBadge = (conf) => conf >= 75
  ? badge('#4ade80', 'rgba(74,222,128,0.1)', 'rgba(74,222,128,0.3)', `AUTO ${conf}%`)
  : conf >= 60
  ? badge('#f59e0b', 'rgba(251,191,36,0.1)', 'rgba(251,191,36,0.3)', `PARCIAL ${conf}%`)
  : badge('#6b7280', 'rgba(107,114,128,0.1)', 'rgba(107,114,128,0.2)', 'SEM MATCH')

// ── Coverage Audit Panel (3-step workflow) ────────────────────────────────────

function CoverageAuditPanel({ token, championships }) {
  const [selectedId, setSelectedId] = useState('')
  const [step, setStep] = useState(1)  // 1=audit, 2=scan+map, 3=reprocess

  // Step 1 — audit
  const [audit, setAudit] = useState(null)
  const [auditing, setAuditing] = useState(false)

  // Step 2 — full scan + mapping
  const [scanData, setScanData] = useState(null)
  const [scanning, setScanning] = useState(false)
  // confirmed mappings: {account_id → {person_id, alias, shard}}
  const [mappings, setMappings] = useState({})

  // Step 3 — reprocess
  const [reprocessResult, setReprocessResult] = useState(null)
  const [reprocessing, setReprocessing] = useState(false)

  const [err, setErr] = useState('')

  const authHeader = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const reset = (newId) => {
    setSelectedId(newId); setStep(1); setAudit(null); setScanData(null)
    setMappings({}); setReprocessResult(null); setErr('')
  }

  // ── Step 1: run audit ──
  const runAudit = async () => {
    if (!selectedId) return
    setAuditing(true); setAudit(null); setErr('')
    try {
      const res = await fetch(`${API_BASE_URL}/admin/championships/${selectedId}/coverage-audit`, { headers: authHeader })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setAudit(await res.json())
    } catch (e) { setErr(e.message) }
    finally { setAuditing(false) }
  }

  // ── Step 2: full scan ──
  const runFullScan = async () => {
    setScanning(true); setScanData(null); setErr('')
    try {
      const res = await fetch(
        `${API_BASE_URL}/admin/championships/${selectedId}/full-coverage-scan?matches_per_stage=2`,
        { method: 'POST', headers: authHeader }
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setScanData(data)
      // Pre-fill mappings from high-confidence suggestions
      const auto = {}
      for (const u of data.all_unresolved || []) {
        if (u.confidence >= 75 && u.suggested_person_id) {
          auto[u.account_id] = {
            person_id: u.suggested_person_id,
            alias: u.alias,
            shard: 'pc-tournament',
            confirmed: true,
          }
        }
      }
      setMappings(auto)
    } catch (e) { setErr(e.message) }
    finally { setScanning(false) }
  }

  const updateMapping = (account_id, field, value) => {
    setMappings(prev => ({
      ...prev,
      [account_id]: { ...(prev[account_id] || {}), [field]: value }
    }))
  }

  const applyMappings = async () => {
    const toAdd = Object.entries(mappings)
      .filter(([, m]) => m.confirmed && m.person_id)
      .map(([account_id, m]) => ({
        person_id: parseInt(m.person_id),
        account_id,
        alias: m.alias || null,
        shard: m.shard || 'pc-tournament',
      }))
    if (!toAdd.length) { setErr('Nenhum mapeamento confirmado para aplicar.'); return }
    try {
      const res = await fetch(`${API_BASE_URL}/admin/persons/bulk-add-accounts`, {
        method: 'POST', headers: authHeader, body: JSON.stringify(toAdd)
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const results = await res.json()
      const added = results.filter(r => r.status === 'added').length
      const skipped = results.filter(r => r.status === 'skipped_duplicate').length
      const errors = results.filter(r => r.status === 'error').length
      alert(`Contas aplicadas: ${added} adicionadas · ${skipped} já existiam · ${errors} erros`)
      setStep(3)
    } catch (e) { setErr(e.message) }
  }

  // ── Step 3: reprocess ──
  const runReprocess = async () => {
    if (!window.confirm(`Reprocessar TODAS as partidas de "${championships.find(c => c.id == selectedId)?.name}"?\n\nIsso atualiza match_stat e pontuações de usuários. Operação pode levar 1-2 minutos.`)) return
    setReprocessing(true); setReprocessResult(null); setErr('')
    try {
      const res = await fetch(`${API_BASE_URL}/admin/championships/${selectedId}/reprocess-all`, {
        method: 'POST', headers: authHeader
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setReprocessResult(await res.json())
    } catch (e) { setErr(e.message) }
    finally { setReprocessing(false) }
  }

  const byStage = audit ? audit.players.reduce((acc, p) => {
    const k = p.stage_id; if (!acc[k]) acc[k] = []; acc[k].push(p); return acc
  }, {}) : {}

  const stepStyle = (n) => ({
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700,
    fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.08em',
    cursor: step >= n ? 'pointer' : 'default',
    background: step === n ? 'rgba(240,192,64,0.12)' : step > n ? 'rgba(74,222,128,0.08)' : 'rgba(255,255,255,0.03)',
    border: step === n ? '1px solid rgba(240,192,64,0.4)' : step > n ? '1px solid rgba(74,222,128,0.3)' : '1px solid rgba(255,255,255,0.07)',
    color: step === n ? '#f0c040' : step > n ? '#4ade80' : 'var(--xm-muted)',
  })

  return (
    <div style={{ marginTop: 32 }}>
      <SectionHeader title="Recuperação de Dados — Aliases & Contas" />
      <div style={{
        background: 'rgba(18,21,28,0.9)', border: '1px solid var(--xm-border)',
        borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <p style={{ fontSize: 12, color: 'var(--xm-muted)', margin: 0 }}>
          Detecta jogadores sem cobertura completa (conta não cadastrada, rename de IGN, substituição), sugere mapeamentos automaticamente e reprocessa as partidas de forma segura.
        </p>

        {/* Championship selector */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select style={{ ...selectStyle, minWidth: 300 }} value={selectedId} onChange={e => reset(e.target.value)}>
            <option value="">— Selecione um championship —</option>
            {championships.map(c => <option key={c.id} value={c.id}>{c.short_name} — {c.name}</option>)}
          </select>
        </div>

        {/* Step indicator */}
        {selectedId && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { n: 1, label: '1 · Auditar Gaps' },
              { n: 2, label: '2 · Scan + Mapear' },
              { n: 3, label: '3 · Reprocessar' },
            ].map(({ n, label }) => (
              <div key={n} style={stepStyle(n)} onClick={() => step > n && setStep(n)}>{label}</div>
            ))}
          </div>
        )}

        {err && <div style={{ color: '#ef4444', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}>⚠ {err}</div>}

        {/* ── STEP 1: Audit ── */}
        {selectedId && step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <ActBtn onClick={runAudit} disabled={auditing}>
              {auditing ? 'Auditando...' : 'Auditar Cobertura'}
            </ActBtn>

            {audit && (
              <>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Com gaps', value: audit.total_gaps, color: audit.total_gaps > 0 ? '#f59e0b' : '#4ade80' },
                    { label: 'Cobertura 0%', value: audit.zero_coverage, color: audit.zero_coverage > 0 ? '#ef4444' : '#4ade80' },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div style={{ fontSize: 10, color: 'var(--xm-muted)', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.1em' }}>{label.toUpperCase()}</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: 'Rajdhani, sans-serif' }}>{value}</div>
                    </div>
                  ))}
                </div>

                {audit.total_gaps === 0
                  ? <div style={{ color: '#4ade80', fontSize: 13, fontWeight: 600 }}>✓ Cobertura completa.</div>
                  : (
                    <>
                      {Object.entries(byStage).map(([sid, players]) => (
                        <div key={sid} style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, overflow: 'hidden' }}>
                          <div style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 11, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: 'var(--xm-muted)' }}>
                            STAGE #{sid}
                          </div>
                          <table style={{ ...tableStyle, margin: 0 }}>
                            <thead><tr>
                              <th style={thStyle}>Jogador</th><th style={thStyle}>Time</th>
                              <th style={thStyle}>Aparições</th><th style={thStyle}>Cobertura</th>
                              <th style={thStyle}>Contas</th>
                            </tr></thead>
                            <tbody>
                              {players.map(p => (
                                <tr key={`${p.stage_id}-${p.person_id}`}>
                                  <td style={{ ...tdStyle, fontWeight: 600 }}>{p.display_name}</td>
                                  <td style={{ ...tdStyle, fontSize: 12, color: 'var(--xm-muted)' }}>{p.team_name}</td>
                                  <td style={{ ...tdStyle, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{p.matches_appeared}/{p.total_matches}</td>
                                  <td style={tdStyle}>{coverageBadge(p.coverage_pct)}</td>
                                  <td style={{ ...tdStyle, fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: p.registered_accounts.length ? 'var(--xm-muted)' : '#ef4444' }}>
                                    {p.registered_accounts.length ? p.registered_accounts.join(' | ') : '⚠ nenhuma'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))}
                      <ActBtn onClick={() => setStep(2)} style={{ alignSelf: 'flex-start', background: 'rgba(240,192,64,0.1)', borderColor: 'rgba(240,192,64,0.4)', color: '#f0c040' }}>
                        Próximo: Scan & Mapeamento →
                      </ActBtn>
                    </>
                  )}
              </>
            )}
          </div>
        )}

        {/* ── STEP 2: Full scan + mapping ── */}
        {selectedId && step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--xm-muted)' }}>
              Busca 2 partidas por stage na PUBG API. Aliases não resolvidos recebem sugestão automática de person pelo nome/time. Confirme ou ajuste cada mapeamento antes de aplicar.
            </p>
            <ActBtn onClick={runFullScan} disabled={scanning} style={{ alignSelf: 'flex-start' }}>
              {scanning ? '⏳ Escaneando API...' : '🔍 Iniciar Scan Completo'}
            </ActBtn>

            {scanData && (
              <>
                {/* Summary */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Não resolvidos', value: scanData.total_unresolved, color: scanData.total_unresolved > 0 ? '#f59e0b' : '#4ade80' },
                    { label: 'Auto-mapeados', value: scanData.high_confidence_matches, color: '#4ade80' },
                    { label: 'Para revisar', value: scanData.needs_review + scanData.no_match_found, color: scanData.needs_review + scanData.no_match_found > 0 ? '#f59e0b' : '#4ade80' },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div style={{ fontSize: 10, color: 'var(--xm-muted)', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.1em' }}>{label.toUpperCase()}</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: 'Rajdhani, sans-serif' }}>{value}</div>
                    </div>
                  ))}
                </div>

                {scanData.total_unresolved === 0
                  ? <div style={{ color: '#4ade80', fontSize: 13, fontWeight: 600 }}>✓ Nenhum alias não resolvido — dados completos.</div>
                  : (
                    <>
                      <table style={{ ...tableStyle }}>
                        <thead><tr>
                          <th style={thStyle}>Alias (API)</th>
                          <th style={thStyle}>Stage</th>
                          <th style={thStyle}>Confiança</th>
                          <th style={thStyle}>Sugestão</th>
                          <th style={thStyle}>Person ID</th>
                          <th style={thStyle}>Shard</th>
                          <th style={thStyle}>Confirmar</th>
                        </tr></thead>
                        <tbody>
                          {scanData.all_unresolved.map((u) => {
                            const m = mappings[u.account_id] || {}
                            return (
                              <tr key={u.account_id}>
                                <td style={{ ...tdStyle, fontWeight: 700 }}>
                                  {u.alias}
                                  <div style={{ fontSize: 9, color: 'var(--xm-muted)', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>{u.account_id.slice(0, 20)}...</div>
                                </td>
                                <td style={{ ...tdStyle, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--xm-muted)' }}>#{u.stage_id}</td>
                                <td style={tdStyle}>{confBadge(u.confidence)}</td>
                                <td style={{ ...tdStyle, fontSize: 12 }}>
                                  {u.suggested_display_name
                                    ? <><span style={{ fontWeight: 600 }}>{u.suggested_display_name}</span><br /><span style={{ fontSize: 10, color: 'var(--xm-muted)' }}>{u.suggested_team}</span></>
                                    : <span style={{ color: 'var(--xm-muted)', fontSize: 11 }}>—</span>
                                  }
                                </td>
                                <td style={tdStyle}>
                                  <input
                                    type="number"
                                    placeholder={u.suggested_person_id || 'person_id'}
                                    defaultValue={u.suggested_person_id || ''}
                                    style={{ ...inputStyle, width: 80, padding: '4px 8px', fontSize: 12 }}
                                    onChange={e => updateMapping(u.account_id, 'person_id', e.target.value)}
                                  />
                                </td>
                                <td style={tdStyle}>
                                  <select
                                    style={{ ...selectStyle, padding: '4px 8px', fontSize: 11 }}
                                    defaultValue={u.stage_shard || 'pc-tournament'}
                                    onChange={e => updateMapping(u.account_id, 'shard', e.target.value)}
                                  >
                                    <option value="pc-tournament">pc-tournament</option>
                                    <option value="steam">steam</option>
                                  </select>
                                </td>
                                <td style={tdStyle}>
                                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                    <input
                                      type="checkbox"
                                      checked={!!m.confirmed}
                                      onChange={e => updateMapping(u.account_id, 'confirmed', e.target.checked)}
                                    />
                                    <span style={{ fontSize: 11, color: m.confirmed ? '#4ade80' : 'var(--xm-muted)' }}>
                                      {m.confirmed ? 'OK' : 'Verificar'}
                                    </span>
                                  </label>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>

                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, color: 'var(--xm-muted)' }}>
                          {Object.values(mappings).filter(m => m.confirmed && m.person_id).length} mapeamento(s) confirmado(s)
                        </span>
                        <ActBtn
                          onClick={applyMappings}
                          disabled={Object.values(mappings).filter(m => m.confirmed && m.person_id).length === 0}
                          style={{ background: 'rgba(74,222,128,0.1)', borderColor: 'rgba(74,222,128,0.3)', color: '#4ade80' }}
                        >
                          Aplicar Mapeamentos
                        </ActBtn>
                        <ActBtn onClick={() => setStep(3)} style={{ background: 'rgba(240,192,64,0.1)', borderColor: 'rgba(240,192,64,0.4)', color: '#f0c040' }}>
                          Pular → Reprocessar
                        </ActBtn>
                      </div>
                    </>
                  )}
              </>
            )}
          </div>
        )}

        {/* ── STEP 3: Reprocess ── */}
        {selectedId && step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--xm-muted)' }}>
              Reprocessa todas as partidas do campeonato — re-busca dados da API e recalcula match_stat e pontuações de usuários usando os novos mapeamentos de contas. Operação idempotente e segura.
            </p>
            <ActBtn
              onClick={runReprocess}
              disabled={reprocessing}
              style={{ alignSelf: 'flex-start', background: 'rgba(139,92,246,0.1)', borderColor: 'rgba(139,92,246,0.3)', color: '#a78bfa' }}
            >
              {reprocessing ? '⏳ Reprocessando (pode demorar)...' : '⚙ Reprocessar Todas as Partidas'}
            </ActBtn>

            {reprocessResult && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  {[
                    { label: 'Total', value: reprocessResult.matches_total },
                    { label: 'OK', value: reprocessResult.matches_ok, color: '#4ade80' },
                    { label: 'Erros', value: reprocessResult.matches_error, color: reprocessResult.matches_error > 0 ? '#ef4444' : '#4ade80' },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div style={{ fontSize: 10, color: 'var(--xm-muted)', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.1em' }}>{label.toUpperCase()}</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: color || 'var(--xm-text)', fontFamily: 'Rajdhani, sans-serif' }}>{value}</div>
                    </div>
                  ))}
                </div>
                {reprocessResult.matches_error === 0
                  ? <div style={{ color: '#4ade80', fontWeight: 600, fontSize: 13 }}>✓ Reprocessamento concluído — dados atualizados.</div>
                  : (
                    <div style={{ border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ padding: '8px 14px', background: 'rgba(239,68,68,0.06)', fontSize: 11, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: '#ef4444' }}>ERROS</div>
                      <table style={{ ...tableStyle, margin: 0 }}>
                        <thead><tr><th style={thStyle}>Stage</th><th style={thStyle}>Match ID</th><th style={thStyle}>Erro</th></tr></thead>
                        <tbody>
                          {reprocessResult.results.filter(r => r.error).map((r, i) => (
                            <tr key={i}>
                              <td style={{ ...tdStyle, fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>#{r.stage_id}</td>
                              <td style={{ ...tdStyle, fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--xm-muted)' }}>{r.pubg_match_id?.slice(0, 12)}...</td>
                              <td style={{ ...tdStyle, color: '#ef4444', fontSize: 11 }}>{r.error}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const api = (token) => async (method, path, body) => {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body != null ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(e.detail || `HTTP ${res.status}`)
  }
  return res.status === 204 ? null : res.json()
}

const BLANK = { name: '', short_name: '', shard: 'steam', tier_weight: 1.0, is_active: true, has_faceoff: false }

export default function AdminChampionships({ token }) {
  const call = useCallback(api(token), [token])

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const [showOld, setShowOld] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await call('GET', '/admin/championships?include_inactive=true')
      setItems(Array.isArray(data) ? data.sort((a, b) => b.id - a.id) : [])
    } catch { setItems([]) }
    finally { setLoading(false) }
  }, [call])

  useEffect(() => { load() }, [load])

  const openCreate = () => { setForm(BLANK); setMsg(''); setModal({ mode: 'create' }) }
  const openEdit = (c) => {
    setForm({ name: c.name, short_name: c.short_name, shard: c.shard, tier_weight: c.tier_weight, is_active: c.is_active, has_faceoff: c.has_faceoff ?? false })
    setMsg('')
    setModal({ mode: 'edit', data: c })
  }

  const handleSave = async () => {
    setSaving(true); setMsg('')
    try {
      const body = { ...form, tier_weight: parseFloat(form.tier_weight) }
      if (modal.mode === 'create') {
        await call('POST', '/admin/championships', body)
        setMsg('Championship criada.')
        setModal(null)
      } else {
        await call('PATCH', `/admin/championships/${modal.data.id}`, body)
        setMsg('Championship atualizada.')
      }
      await load()
    } catch (e) { setMsg('!' + e.message) }
    finally { setSaving(false) }
  }

  const toggleActive = async (c) => {
    try {
      await call('PATCH', `/admin/championships/${c.id}`, { is_active: !c.is_active })
      await load()
    } catch (e) { alert(e.message) }
  }

  const markFinished = async (c) => {
    if (!window.confirm(`Marcar "${c.name}" como encerrado? Isso vai remover o faceoff do dashboard e habilitar a seção de resultados.`)) return
    try {
      await call('PATCH', `/admin/championships/${c.id}`, { finished_at: new Date().toISOString() })
      await load()
    } catch (e) { alert(e.message) }
  }

  const { sort, toggle, apply } = useSorting('id', 'desc')

  const f = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }))

  const sortKeys = { id: c => c.id, name: c => c.name, short_name: c => c.short_name, tier_weight: c => c.tier_weight, status: c => c.is_active ? 0 : 1 }
  const activeItems = apply(items.filter(c => c.is_active), sortKeys)
  const oldItems = apply(items.filter(c => !c.is_active), sortKeys)

  const renderRow = (c) => (
    <tr key={c.id} style={{ opacity: c.is_active ? 1 : 0.4 }}>
      <td style={{ ...tdStyle, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--xm-muted)' }}>{c.id}</td>
      <td style={{ ...tdStyle, fontWeight: 600 }}>{c.name}</td>
      <td style={{ ...tdStyle, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{c.short_name}</td>
      <td style={{ ...tdStyle, color: 'var(--xm-muted)', fontSize: 12 }}>{c.shard}</td>
      <td style={{ ...tdStyle, color: 'var(--xm-muted)' }}>{c.tier_weight}</td>
      <td style={tdStyle}>
        {c.has_faceoff && !c.finished_at && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4, fontFamily: 'JetBrains Mono, monospace', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', color: '#f59e0b' }}>
            VOTAÇÃO ABERTA
          </span>
        )}
        {c.has_faceoff && c.finished_at && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4, fontFamily: 'JetBrains Mono, monospace', background: 'rgba(107,114,128,0.1)', border: '1px solid rgba(107,114,128,0.3)', color: 'var(--xm-muted)' }}>
            VOTAÇÃO ENCERRADA
          </span>
        )}
        {!c.has_faceoff && (
          <span style={{ fontSize: 10, color: 'var(--xm-muted)', fontFamily: 'JetBrains Mono, monospace' }}>—</span>
        )}
      </td>
      <td style={tdStyle}>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4,
          fontFamily: 'JetBrains Mono, monospace',
          background: c.is_active ? 'rgba(74,222,128,0.1)' : 'rgba(107,114,128,0.1)',
          border: c.is_active ? '1px solid rgba(74,222,128,0.3)' : '1px solid rgba(107,114,128,0.3)',
          color: c.is_active ? 'var(--xm-green)' : 'var(--xm-muted)',
        }}>
          {c.is_active ? 'ATIVA' : 'INATIVA'}
        </span>
      </td>
      <td style={{ ...tdStyle, textAlign: 'right' }}>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <ActBtn small onClick={() => openEdit(c)}>Editar</ActBtn>
          {c.has_faceoff && !c.finished_at && (
            <ActBtn
              small
              onClick={() => markFinished(c)}
              title="Marca a votação do Faceoff como encerrada e exibe resultados"
              style={{ background: 'rgba(240,192,64,0.1)', borderColor: 'rgba(240,192,64,0.3)', color: '#f59e0b' }}
            >
              Fechar Votação
            </ActBtn>
          )}
          <ActBtn small danger onClick={() => toggleActive(c)}>
            {c.is_active ? 'Desativar' : 'Ativar'}
          </ActBtn>
        </div>
      </td>
    </tr>
  )

  return (
    <div>
      <SectionHeader
        title="Championships"
        action={<ActBtn onClick={openCreate}>+ Nova Championship</ActBtn>}
      />

      <div style={{ background: 'rgba(18,21,28,0.9)', border: '1px solid var(--xm-border)', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--xm-muted)' }}>Carregando...</div>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <SortableHeader label="ID" col="id" sort={sort} onSort={toggle} />
                <SortableHeader label="Nome" col="name" sort={sort} onSort={toggle} />
                <SortableHeader label="Tag" col="short_name" sort={sort} onSort={toggle} />
                <th style={thStyle}>Shard</th>
                <SortableHeader label="Peso" col="tier_weight" sort={sort} onSort={toggle} />
                <th style={thStyle}>Faceoff</th>
                <SortableHeader label="Status" col="status" sort={sort} onSort={toggle} />
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {activeItems.map(renderRow)}
              {oldItems.length > 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: 0, border: 'none' }}>
                    <button
                      onClick={() => setShowOld(v => !v)}
                      style={{
                        width: '100%', padding: '10px 16px', background: 'rgba(255,255,255,0.02)',
                        border: 'none', borderTop: '1px solid var(--xm-border)',
                        cursor: 'pointer', textAlign: 'center',
                        fontSize: 11, fontWeight: 700, letterSpacing: '0.14em',
                        fontFamily: 'JetBrains Mono, monospace',
                        color: 'var(--xm-muted)',
                      }}
                    >
                      {showOld ? '▲' : '▼'} &nbsp;ENCERRADOS ({oldItems.length})
                    </button>
                  </td>
                </tr>
              )}
              {showOld && oldItems.map(renderRow)}
            </tbody>
          </table>
        )}
      </div>

      <CoverageAuditPanel token={token} championships={items} />

      {modal && (
        <Modal
          title={modal.mode === 'create' ? 'Nova Championship' : `Editar — ${modal.data?.name}`}
          onClose={() => setModal(null)}
        >
          <Msg msg={msg} />
          <Field label="Nome completo">
            <input style={inputStyle} value={form.name} onChange={f('name')} placeholder="ex: PUBG Americas Series 1 2026" />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Short name (tag)">
              <input style={inputStyle} value={form.short_name} onChange={f('short_name')} placeholder="ex: PAS" />
            </Field>
            <Field label="Peso (tier_weight)">
              <input style={inputStyle} type="number" step="0.1" min="0.1" max="2" value={form.tier_weight} onChange={f('tier_weight')} />
            </Field>
          </div>
          <Field label="Shard">
            <select style={selectStyle} value={form.shard} onChange={f('shard')}>
              <option value="steam">steam</option>
              <option value="pc-tournament">pc-tournament</option>
            </select>
          </Field>
          <Field label="Team Faceoff">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--xm-text)' }}>
              <input type="checkbox" checked={!!form.has_faceoff} onChange={e => setForm(prev => ({ ...prev, has_faceoff: e.target.checked }))} />
              Habilitar Team Faceoff neste campeonato
            </label>
          </Field>
          {modal.mode === 'edit' && (
            <Field label="Status">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--xm-text)' }}>
                <input type="checkbox" checked={!!form.is_active} onChange={e => setForm(prev => ({ ...prev, is_active: e.target.checked }))} />
                Ativa
              </label>
            </Field>
          )}
          <SaveBtn loading={saving} onClick={handleSave} label={modal.mode === 'create' ? 'Criar' : 'Salvar'} />
        </Modal>
      )}
    </div>
  )
}
