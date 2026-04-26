// frontend/src/pages/admin/AdminEmail.jsx
import { useEffect, useState, useCallback, useRef } from 'react'
import { API_BASE_URL } from '../../config'
import { SearchableSelect } from './Modal'

const RECIPIENT_LABELS = {
  all:       'Todos os usuários ativos',
  no_lineup: 'Usuários sem lineup na stage',
}

const STAGE_VARS = new Set(['stage_id', 'stage_name'])

const URGENCY_COLOR = {
  high:   { bg: 'rgba(249,115,22,0.1)',  border: 'rgba(249,115,22,0.3)',  dot: '#f97316' },
  medium: { bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.25)', dot: '#818cf8' },
}

// ── Dismiss storage (formato v2: { stageId: expiresAtISO | null }) ────────────
const DISMISSED_KEY = 'xama_email_checklist_dismissed_v2'

function loadDismissed() {
  try {
    const raw = JSON.parse(localStorage.getItem(DISMISSED_KEY) || '{}')
    const now = Date.now()
    const valid = {}
    for (const [id, exp] of Object.entries(raw)) {
      if (exp === null || new Date(exp).getTime() > now) valid[id] = exp
    }
    return valid
  } catch { return {} }
}

function saveDismissed(obj) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify(obj))
}

function isExpired(exp) {
  if (exp === null) return false          // permanente
  return new Date(exp).getTime() <= Date.now()
}

function expiryLabel(exp) {
  if (exp === null) return 'Permanente'
  const d = new Date(exp)
  return `Até ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`
}

// ── Componente ChecklistGroup ─────────────────────────────────────────────────
function ChecklistGroup({ group, card, onDismiss, onRestore, onDispatch, onMarkSent, isDismissed, isCollapsed, onToggle }) {
  const [showExpiry, setShowExpiry] = useState(false)
  const [customUnit, setCustomUnit]   = useState('days')
  const [customVal, setCustomVal]     = useState('')
  const allOptional = group.items.every(i => i.urgency === 'medium')

  function dismiss(exp) {
    onDismiss(group.stage_id, exp)
    setShowExpiry(false)
    setCustomVal('')
  }

  function handlePreset(duration) {
    const now = new Date()
    if (duration === 'week')  { now.setDate(now.getDate() + 7);    dismiss(now.toISOString()) }
    else if (duration === 'month') { now.setMonth(now.getMonth() + 1); dismiss(now.toISOString()) }
    else dismiss(null)   // permanent
  }

  function handleCustom() {
    const n = parseInt(customVal)
    if (!n || n <= 0) return
    const now = new Date()
    if (customUnit === 'hours') now.setHours(now.getHours() + n)
    else                        now.setDate(now.getDate() + n)
    dismiss(now.toISOString())
  }

  const btnBase = {
    padding: '3px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600, border: 'none',
  }

  return (
    <div style={{ ...card, opacity: isDismissed ? 0.55 : 1, marginBottom: 0 }}>
      {/* ── Cabeçalho da stage ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: (isCollapsed && !showExpiry) ? 0 : 10 }}>
        {/* Toggle colapso */}
        <button onClick={onToggle} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--color-xama-muted)', fontSize: 13, padding: '2px 4px', lineHeight: 1,
        }}>
          {isCollapsed ? '▶' : '▼'}
        </button>

        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-xama-text)', flex: 1, cursor: 'pointer' }} onClick={onToggle}>
          {group.stage_name}
          {allOptional && !isCollapsed && (
            <span style={{ marginLeft: 8, fontSize: 10, color: '#818cf8', fontWeight: 400 }}>opcional</span>
          )}
        </div>

        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
          background: group.lineup_status === 'open' ? 'rgba(74,222,128,0.15)' : 'rgba(100,116,139,0.15)',
          color: group.lineup_status === 'open' ? '#4ade80' : 'var(--color-xama-muted)',
          letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>{group.lineup_status}</span>

        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
          background: 'rgba(99,102,241,0.12)', color: '#a5b4fc',
          letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>{group.stage_phase}</span>

        {!isDismissed && (
          <button
            onClick={() => setShowExpiry(v => !v)}
            style={{
              ...btnBase,
              background: showExpiry ? 'rgba(248,113,113,0.18)' : 'rgba(248,113,113,0.08)',
              border: '1px solid rgba(248,113,113,0.25)', color: '#f87171',
            }}
          >
            {showExpiry ? 'Cancelar' : 'Descartar'}
          </button>
        )}
        {isDismissed && (
          <button onClick={() => onRestore(group.stage_id)} style={{
            ...btnBase, background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--color-xama-border)', color: 'var(--color-xama-muted)',
          }}>
            Restaurar
          </button>
        )}
      </div>

      {/* ── Expiry picker (painel separado, abaixo do header) ── */}
      {showExpiry && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8,
          padding: '10px 14px', marginBottom: isCollapsed ? 0 : 10,
          background: 'rgba(248,113,113,0.06)', borderRadius: 8,
          border: '1px solid rgba(248,113,113,0.2)',
        }}>
          <span style={{ fontSize: 11, color: '#f87171', fontWeight: 600, marginRight: 2 }}>
            Ocultar por:
          </span>
          {[['week', '1 semana'], ['month', '1 mês'], ['permanent', 'Sempre']].map(([d, label]) => (
            <button key={d} onClick={() => handlePreset(d)} style={{
              ...btnBase, padding: '5px 12px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--color-xama-border)', color: 'var(--color-xama-text)',
            }}>{label}</button>
          ))}
          {/* Campo personalizado */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 4 }}>
            <input
              type="number" min="1" value={customVal}
              onChange={e => setCustomVal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCustom()}
              placeholder="Ex: 3"
              style={{
                width: 64, padding: '4px 8px', borderRadius: 6, fontSize: 12,
                background: 'rgba(255,255,255,0.06)', border: '1px solid var(--color-xama-border)',
                color: 'var(--color-xama-text)', outline: 'none',
              }}
            />
            <select
              value={customUnit} onChange={e => setCustomUnit(e.target.value)}
              style={{
                padding: '4px 8px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                background: 'rgba(255,255,255,0.06)', border: '1px solid var(--color-xama-border)',
                color: 'var(--color-xama-text)', outline: 'none', colorScheme: 'dark',
              }}
            >
              <option value="days">dias</option>
              <option value="hours">horas</option>
            </select>
            <button
              onClick={handleCustom}
              disabled={!customVal || parseInt(customVal) <= 0}
              style={{
                ...btnBase, padding: '5px 10px',
                background: customVal && parseInt(customVal) > 0 ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${customVal && parseInt(customVal) > 0 ? 'rgba(249,115,22,0.4)' : 'var(--color-xama-border)'}`,
                color: customVal && parseInt(customVal) > 0 ? 'var(--color-xama-orange)' : 'var(--color-xama-muted)',
              }}
            >OK</button>
          </div>
        </div>
      )}


      {/* ── Resumo colapsado ── */}
      {isCollapsed && (
        <div style={{ fontSize: 12, color: 'var(--color-xama-muted)', paddingLeft: 26, cursor: 'pointer' }} onClick={onToggle}>
          {group.items.filter(i => i.status === 'pending').length} pendentes
          · {group.items.filter(i => i.status === 'sent').length} enviados
          {allOptional && ' · apenas opcionais'}
        </div>
      )}

      {/* ── Items expandidos ── */}
      {!isCollapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {group.items.map(item => {
            const colors = URGENCY_COLOR[item.urgency] || URGENCY_COLOR.medium
            const sent   = item.status === 'sent'
            return (
              <div key={item.template_key} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 8,
                background: sent ? 'rgba(255,255,255,0.02)' : colors.bg,
                border: `1px solid ${sent ? 'var(--color-xama-border)' : colors.border}`,
                opacity: sent ? 0.65 : 1,
              }}>
                <div style={{
                  width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                  background: sent ? '#4ade80' : colors.dot,
                }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-xama-text)' }}>
                    {item.template_label}
                  </div>
                  {sent && item.last_sent_at ? (
                    <div style={{ fontSize: 11, color: 'var(--color-xama-muted)', marginTop: 1 }}>
                      Enviado {new Date(item.last_sent_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                      {item.total_sent > 0 && ` · ${item.total_sent} dest.`}
                    </div>
                  ) : !sent ? (
                    <div style={{ fontSize: 11, color: colors.dot, marginTop: 1 }}>
                      {item.urgency === 'high' ? 'Recomendado' : 'Opcional'}
                    </div>
                  ) : null}
                </div>

                {!isDismissed && (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {/* Já enviei */}
                    {!sent && (
                      <button
                        onClick={() => onMarkSent(item)}
                        title="Marcar como enviado sem disparar"
                        style={{
                          padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                          background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-xama-border)',
                          color: 'var(--color-xama-muted)', cursor: 'pointer', whiteSpace: 'nowrap',
                        }}
                      >
                        Já enviei
                      </button>
                    )}
                    {/* Disparar / Reenviar */}
                    <button
                      onClick={() => onDispatch(item)}
                      style={{
                        padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                        background: sent ? 'rgba(255,255,255,0.05)' : 'var(--color-xama-orange)',
                        border: 'none',
                        color: sent ? 'var(--color-xama-muted)' : '#0d0f14',
                        cursor: 'pointer', whiteSpace: 'nowrap',
                      }}
                    >
                      {sent ? 'Reenviar' : 'Disparar'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function AdminEmail({ token }) {
  const [templates, setTemplates]           = useState([])
  const [selected, setSelected]             = useState(null)
  const [variables, setVariables]           = useState({})
  const [recipientGroup, setRecipientGroup] = useState('all')
  const [logs, setLogs]                     = useState([])
  const [checklist, setChecklist]           = useState([])
  const [tab, setTab]                       = useState('checklist')
  const [loading, setLoading]               = useState(false)
  const [result, setResult]                 = useState(null)
  const [error, setError]                   = useState(null)

  // checklist controls
  const [dismissed, setDismissed]         = useState(loadDismissed)   // { stageId: expiresAt|null }
  const [collapsedStages, setCollapsedStages] = useState(() => new Set())
  const autoCollapsedRef = useRef(false)
  const [champChecklist, setChampChecklist] = useState('')
  const [showSent, setShowSent]           = useState(false)
  const [showDismissed, setShowDismissed] = useState(false)

  // aba Disparar — seletores
  const [championships, setChampionships] = useState([])
  const [stages, setStages]               = useState([])
  const [champFilter, setChampFilter]     = useState('')
  const [selectedStage, setSelectedStage] = useState(null)

  // preview modal
  const [preview, setPreview]             = useState(null)
  const [previewing, setPreviewing]       = useState(false)

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }), [token])

  useEffect(() => {
    fetch(`${API_BASE_URL}/admin/email/templates`, { headers: headers() })
      .then(r => r.json()).then(data => {
        setTemplates(data)
        if (data.length > 0) applyTemplate(data[0])
      }).catch(() => {})

    fetch(`${API_BASE_URL}/admin/email/championships`, { headers: headers() })
      .then(r => r.json()).then(setChampionships).catch(() => {})

    loadChecklist()
  }, [])

  // Auto-colapsa stages opcionais na primeira carga
  useEffect(() => {
    if (checklist.length === 0 || autoCollapsedRef.current) return
    const groups = {}
    for (const item of checklist) {
      if (!groups[item.stage_id]) groups[item.stage_id] = []
      groups[item.stage_id].push(item)
    }
    const toCollapse = new Set()
    for (const [id, items] of Object.entries(groups)) {
      if (items.every(i => i.urgency === 'medium')) toCollapse.add(String(id))
    }
    setCollapsedStages(toCollapse)
    autoCollapsedRef.current = true
  }, [checklist])

  useEffect(() => {
    const url = champFilter
      ? `${API_BASE_URL}/admin/email/stages?championship_id=${champFilter}`
      : `${API_BASE_URL}/admin/email/stages`
    fetch(url, { headers: headers() })
      .then(r => r.json()).then(setStages).catch(() => {})
    setSelectedStage(null)
  }, [champFilter])

  useEffect(() => {
    if (tab === 'logs') loadLogs()
  }, [tab])

  function loadLogs() {
    fetch(`${API_BASE_URL}/admin/email/logs`, { headers: headers() })
      .then(r => r.json()).then(setLogs).catch(() => {})
  }

  function loadChecklist() {
    fetch(`${API_BASE_URL}/admin/email/checklist`, { headers: headers() })
      .then(r => r.json()).then(setChecklist).catch(() => {})
  }

  function applyTemplate(tpl, prefillStage = null) {
    setSelected(tpl)
    setVariables(prefillStage ? {
      stage_id:   String(prefillStage.id),
      stage_name: prefillStage.stage_name,
    } : {})
    setSelectedStage(prefillStage ? {
      id:            prefillStage.id,
      lineup_status: prefillStage.lineup_status,
      stage_phase:   prefillStage.stage_phase,
    } : null)
    setRecipientGroup(tpl.recipient_groups[0])
    setResult(null); setError(null); setPreview(null)
  }

  function handleStageSelect(stageId) {
    const stage = stages.find(s => s.id === parseInt(stageId))
    setSelectedStage(stage || null)
    if (stage) {
      setVariables(prev => ({
        ...prev,
        stage_id:   String(stage.id),
        stage_name: `${stage.champ_short_name} — ${stage.name}`,
      }))
    } else {
      setVariables(prev => { const n = { ...prev }; delete n.stage_id; delete n.stage_name; return n })
    }
    setPreview(null)
  }

  function setVar(key, value) {
    setVariables(prev => ({ ...prev, [key]: value }))
    setPreview(null)
  }

  function prefillFromChecklist(item) {
    const tpl = templates.find(t => t.key === item.template_key)
    if (!tpl) return
    applyTemplate(tpl, { id: item.stage_id, stage_name: item.stage_name, lineup_status: item.lineup_status, stage_phase: item.stage_phase })
    setTab('dispatch')
  }

  function dismissStage(stageId, expiresAt) {
    const next = { ...dismissed, [String(stageId)]: expiresAt }
    setDismissed(next)
    saveDismissed(next)
  }

  function restoreStage(stageId) {
    const next = { ...dismissed }
    delete next[String(stageId)]
    setDismissed(next)
    saveDismissed(next)
  }

  function restoreAll() {
    setDismissed({})
    saveDismissed({})
  }

  function toggleCollapse(stageId) {
    setCollapsedStages(prev => {
      const next = new Set(prev)
      if (next.has(String(stageId))) next.delete(String(stageId))
      else next.add(String(stageId))
      return next
    })
  }

  async function handleMarkSent(item) {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/email/checklist/mark-sent`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ stage_id: item.stage_id, template_key: item.template_key }),
      })
      if (res.ok) loadChecklist()
    } catch {}
  }

  async function handlePreview() {
    if (!selected) return
    setPreviewing(true); setError(null)
    try {
      const res = await fetch(`${API_BASE_URL}/admin/email/preview`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ template_key: selected.key, variables, recipient_group: recipientGroup }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Erro ao gerar preview')
      setPreview(data)
    } catch (e) { setError(e.message) }
    finally { setPreviewing(false) }
  }

  async function handleDispatch() {
    if (!selected) return
    const missing = selected.variables.filter(v => v.required && !variables[v.key]?.toString().trim())
    if (missing.length > 0) { setError(`Campo obrigatório: ${missing[0].label}`); return }
    if (!confirm(`Confirmar disparo de "${selected.label}" para: ${RECIPIENT_LABELS[recipientGroup] || recipientGroup}?`)) return

    setLoading(true); setError(null); setResult(null)
    try {
      const res = await fetch(`${API_BASE_URL}/admin/email/dispatch`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ template_key: selected.key, variables, recipient_group: recipientGroup }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Erro ao enviar')
      setResult(data)
      loadChecklist()
      if (tab === 'logs') loadLogs()
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  // ── Estilos base ─────────────────────────────────────────────────────────────

  const card = {
    background: 'rgba(18,21,28,0.92)',
    border: '1px solid var(--color-xama-border)',
    borderRadius: 12, padding: '20px 24px',
  }
  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--color-xama-border)',
    borderRadius: 8, padding: '9px 12px',
    color: 'var(--color-xama-text)', fontSize: 14, outline: 'none',
  }
  const labelStyle = {
    display: 'block', fontSize: 11, fontWeight: 600,
    color: 'var(--color-xama-muted)', letterSpacing: '0.08em',
    textTransform: 'uppercase', marginBottom: 6,
  }

  // ── Checklist — derivações ────────────────────────────────────────────────

  const dismissedCount = Object.keys(dismissed).length

  // Contagem de pendentes por championship (excluindo descartados)
  const champPendingCount = {}
  for (const item of checklist) {
    if (item.status === 'pending' && !dismissed[String(item.stage_id)]) {
      champPendingCount[item.championship_id] = (champPendingCount[item.championship_id] || 0) + 1
    }
  }

  const pendingCount = Object.values(champPendingCount).reduce((a, b) => a + b, 0)

  // Championships únicos no checklist
  const checklistChamps = [...new Map(
    checklist.map(i => [i.championship_id, { id: i.championship_id, short_name: i.champ_short_name, name: i.champ_name }])
  ).values()].sort((a, b) => a.short_name.localeCompare(b.short_name))

  // Filtrar + agrupar por stage
  const visibleGroups = {}
  const dismissedGroups = {}
  for (const item of checklist) {
    if (champChecklist && String(item.championship_id) !== String(champChecklist)) continue
    if (!showSent && item.status === 'sent') continue
    const key = item.stage_id
    const isDism = !!dismissed[String(key)]
    const target = isDism ? dismissedGroups : visibleGroups
    if (!target[key]) target[key] = {
      stage_id: key, stage_name: item.stage_name,
      lineup_status: item.lineup_status, stage_phase: item.stage_phase,
      championship_id: item.championship_id, champ_short_name: item.champ_short_name,
      items: [],
    }
    target[key].items.push(item)
  }

  const templateNeedsStage = selected?.variables?.some(v => STAGE_VARS.has(v.key))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ ...card, padding: '16px 24px' }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-xama-text)' }}>
          Comunicação por Email
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-xama-muted)', marginTop: 4 }}>
          Disparo de emails transacionais para usuários da plataforma via Resend
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4 }}>
        {[
          ['checklist', `Pendências${pendingCount > 0 ? ` (${pendingCount})` : ''}`],
          ['dispatch',  'Disparar'],
          ['logs',      'Histórico'],
        ].map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: tab === t ? 'var(--color-xama-orange)' : 'rgba(255,255,255,0.06)',
            color: tab === t ? '#0d0f14' : t === 'checklist' && pendingCount > 0 ? '#f97316' : 'var(--color-xama-muted)',
            fontWeight: tab === t ? 700 : t === 'checklist' && pendingCount > 0 ? 600 : 400,
            fontSize: 13,
          }}>{label}</button>
        ))}
      </div>

      {/* ── Aba Pendências ──────────────────────────────────────────────────── */}
      {tab === 'checklist' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Controles */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Filtro championship — SearchableSelect evita popup nativo do OS (branco no Windows) */}
            <div style={{ minWidth: 200, flex: '1 1 200px', maxWidth: 320 }}>
              <SearchableSelect
                value={champChecklist}
                onChange={setChampChecklist}
                options={[
                  { value: '', label: `Todos os campeonatos${pendingCount > 0 ? ` (${pendingCount} pendentes)` : ''}` },
                  ...checklistChamps.map(c => ({
                    value: String(c.id),
                    label: `${c.short_name} — ${c.name}${champPendingCount[c.id] ? ` (${champPendingCount[c.id]})` : ''}`,
                  })),
                ]}
                placeholder="Filtrar championship..."
              />
            </div>

            <button onClick={() => setShowSent(v => !v)} style={{
              padding: '8px 14px', borderRadius: 8,
              border: `1px solid ${showSent ? 'rgba(74,222,128,0.3)' : 'var(--color-xama-border)'}`,
              background: showSent ? 'rgba(74,222,128,0.08)' : 'rgba(255,255,255,0.04)',
              color: showSent ? '#4ade80' : 'var(--color-xama-muted)',
              cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
            }}>
              {showSent ? 'Ocultar enviados' : 'Mostrar enviados'}
            </button>

            {dismissedCount > 0 && (
              <>
                <button onClick={() => setShowDismissed(v => !v)} style={{
                  padding: '8px 14px', borderRadius: 8,
                  border: '1px solid var(--color-xama-border)',
                  background: 'rgba(255,255,255,0.04)', color: 'var(--color-xama-muted)',
                  cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                }}>
                  {showDismissed ? 'Ocultar descartados' : `Descartados (${dismissedCount})`}
                </button>
                <button onClick={restoreAll} style={{
                  padding: '8px 14px', borderRadius: 8, border: 'none',
                  background: 'rgba(255,255,255,0.04)', color: 'var(--color-xama-muted)',
                  cursor: 'pointer', fontSize: 12,
                }}>
                  Restaurar todos
                </button>
              </>
            )}
          </div>

          {/* Grupos visíveis */}
          {Object.values(visibleGroups).length === 0 && Object.values(dismissedGroups).length === 0 ? (
            <div style={{ ...card, color: 'var(--color-xama-muted)', fontSize: 13 }}>
              Nenhuma stage com pendências para os filtros selecionados.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Object.values(visibleGroups).map(group => (
                <ChecklistGroup
                  key={group.stage_id}
                  group={group}
                  card={card}
                  isDismissed={false}
                  isCollapsed={collapsedStages.has(String(group.stage_id))}
                  onToggle={() => toggleCollapse(group.stage_id)}
                  onDismiss={dismissStage}
                  onRestore={null}
                  onDispatch={prefillFromChecklist}
                  onMarkSent={handleMarkSent}
                />
              ))}

              {showDismissed && Object.values(dismissedGroups).length > 0 && (
                <>
                  <div style={{ fontSize: 11, color: 'var(--color-xama-muted)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', paddingTop: 4 }}>
                    Descartados
                  </div>
                  {Object.values(dismissedGroups).map(group => (
                    <ChecklistGroup
                      key={group.stage_id}
                      group={group}
                      card={card}
                      isDismissed={true}
                      isCollapsed={collapsedStages.has(String(group.stage_id))}
                      onToggle={() => toggleCollapse(group.stage_id)}
                      onDismiss={null}
                      onRestore={restoreStage}
                      onDispatch={prefillFromChecklist}
                      onMarkSent={handleMarkSent}
                    />
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Aba Disparar ────────────────────────────────────────────────────── */}
      {tab === 'dispatch' && (
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>

          {/* Template selector */}
          <div style={{ ...card, flex: '0 0 240px', minWidth: 200 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-xama-orange)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>
              Templates
            </div>
            {templates.map(tpl => (
              <button key={tpl.key} onClick={() => applyTemplate(tpl)} style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '10px 12px', marginBottom: 6, borderRadius: 8,
                border: `1px solid ${selected?.key === tpl.key ? 'var(--color-xama-orange)' : 'transparent'}`,
                background: selected?.key === tpl.key ? 'rgba(249,115,22,0.1)' : 'rgba(255,255,255,0.03)',
                color: selected?.key === tpl.key ? 'var(--color-xama-text)' : 'var(--color-xama-muted)',
                cursor: 'pointer', fontSize: 13, fontWeight: selected?.key === tpl.key ? 600 : 400,
              }}>
                <div>{tpl.label}</div>
                <div style={{ fontSize: 10, marginTop: 2, opacity: 0.7 }}>{tpl.description}</div>
              </button>
            ))}
          </div>

          {/* Form */}
          {selected && (
            <div style={{ ...card, flex: 1, minWidth: 300 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-xama-text)', marginBottom: 4 }}>
                {selected.label}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-xama-muted)', marginBottom: 20 }}>
                {selected.description}
              </div>

              {/* Seletor de stage */}
              {templateNeedsStage && (
                <div style={{ marginBottom: 20, padding: '16px', background: 'rgba(99,102,241,0.06)', borderRadius: 10, border: '1px solid rgba(99,102,241,0.2)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#a5b4fc', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
                    Selecionar Stage
                  </div>
                  {variables.stage_id && !stages.find(s => s.id === parseInt(variables.stage_id)) ? (
                    <div style={{ fontSize: 13, color: 'var(--color-xama-text)', padding: '8px 12px', background: 'rgba(249,115,22,0.08)', borderRadius: 8, border: '1px solid rgba(249,115,22,0.2)' }}>
                      Stage ID <strong>{variables.stage_id}</strong> — {variables.stage_name}
                      <button onClick={() => { setVar('stage_id', ''); setVar('stage_name', ''); setSelectedStage(null) }}
                        style={{ marginLeft: 10, background: 'none', border: 'none', color: 'var(--color-xama-muted)', cursor: 'pointer', fontSize: 12 }}>
                        ✕ trocar
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ flex: '1 1 160px' }}>
                        <label style={labelStyle}>Championship</label>
                        <SearchableSelect
                          value={champFilter}
                          onChange={setChampFilter}
                          options={[
                            { value: '', label: 'Todos' },
                            ...championships.map(c => ({ value: String(c.id), label: `${c.short_name} — ${c.name}` })),
                          ]}
                          placeholder="Filtrar championship..."
                        />
                      </div>
                      <div style={{ flex: '2 1 220px' }}>
                        <label style={labelStyle}>Stage <span style={{ color: 'var(--color-xama-orange)' }}>*</span></label>
                        <SearchableSelect
                          value={selectedStage?.id ? String(selectedStage.id) : ''}
                          onChange={handleStageSelect}
                          options={[
                            { value: '', label: 'Selecione uma stage...' },
                            ...stages.map(s => ({
                              value: String(s.id),
                              label: `${s.id} — ${s.champ_short_name} · ${s.name}${s.lineup_status === 'open' ? ' ✓' : ''}`,
                            })),
                          ]}
                          placeholder="Buscar stage..."
                        />
                      </div>
                    </div>
                  )}
                  {selectedStage && stages.find(s => s.id === selectedStage.id) && (
                    <div style={{ marginTop: 10, fontSize: 12, color: 'var(--color-xama-muted)', display: 'flex', gap: 16 }}>
                      <span>ID: <strong style={{ color: 'var(--color-xama-text)', fontFamily: 'JetBrains Mono, monospace' }}>{selectedStage.id}</strong></span>
                      <span>Status: <strong style={{ color: selectedStage.lineup_status === 'open' ? '#4ade80' : 'var(--color-xama-muted)' }}>{selectedStage.lineup_status}</strong></span>
                      <span>Fase: <strong style={{ color: 'var(--color-xama-text)' }}>{selectedStage.stage_phase}</strong></span>
                    </div>
                  )}
                </div>
              )}

              {/* Variáveis livres */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
                {selected.variables.filter(v => !STAGE_VARS.has(v.key)).map(v => (
                  <div key={v.key}>
                    <label style={labelStyle}>
                      {v.label}{v.required && <span style={{ color: 'var(--color-xama-orange)' }}> *</span>}
                    </label>
                    {v.multiline ? (
                      <textarea rows={4} value={variables[v.key] || ''} onChange={e => setVar(v.key, e.target.value)}
                        style={{ ...inputStyle, resize: 'vertical' }} />
                    ) : (
                      <input type={v.type === 'number' ? 'number' : 'text'}
                        value={variables[v.key] || ''} onChange={e => setVar(v.key, e.target.value)}
                        style={inputStyle} placeholder={v.required ? '' : 'Opcional'} />
                    )}
                  </div>
                ))}
              </div>

              {/* Destinatários */}
              {selected.recipient_groups.length > 1 ? (
                <div style={{ marginBottom: 20 }}>
                  <label style={labelStyle}>Destinatários</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {selected.recipient_groups.map(g => (
                      <button key={g} onClick={() => setRecipientGroup(g)} style={{
                        padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
                        border: `1px solid ${recipientGroup === g ? 'rgba(249,115,22,0.4)' : 'transparent'}`,
                        background: recipientGroup === g ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.05)',
                        color: recipientGroup === g ? 'var(--color-xama-orange)' : 'var(--color-xama-muted)',
                        fontWeight: recipientGroup === g ? 600 : 400,
                      }}>{RECIPIENT_LABELS[g] || g}</button>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ marginBottom: 20, fontSize: 12, color: 'var(--color-xama-muted)' }}>
                  Destinatários: <strong style={{ color: 'var(--color-xama-text)' }}>
                    {RECIPIENT_LABELS[recipientGroup] || recipientGroup}
                  </strong>
                </div>
              )}

              {/* Feedback */}
              {error && (
                <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8, padding: '10px 14px', color: '#f87171', fontSize: 13, marginBottom: 16 }}>
                  {error}
                </div>
              )}
              {result && (
                <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
                  <div style={{ color: '#4ade80', fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Email disparado</div>
                  <div style={{ color: 'var(--color-xama-muted)', fontSize: 13 }}>
                    ✅ {result.sent} enviados &nbsp;·&nbsp; ❌ {result.failed} falhas &nbsp;·&nbsp; Log #{result.log_id}
                  </div>
                </div>
              )}

              {/* Ações */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={handlePreview} disabled={previewing} style={{
                  padding: '11px 22px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.4)',
                  cursor: previewing ? 'not-allowed' : 'pointer',
                  background: 'rgba(99,102,241,0.1)', color: '#a5b4fc', fontWeight: 600, fontSize: 14,
                }}>
                  {previewing ? 'Gerando...' : 'Pré-visualizar'}
                </button>
                <button onClick={handleDispatch} disabled={loading} style={{
                  padding: '11px 28px', borderRadius: 8, border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  background: loading ? 'rgba(249,115,22,0.4)' : 'var(--color-xama-orange)',
                  color: '#0d0f14', fontWeight: 700, fontSize: 14, letterSpacing: '0.04em',
                }}>
                  {loading ? 'Enviando...' : 'Disparar email'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Aba Histórico ───────────────────────────────────────────────────── */}
      {tab === 'logs' && (
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-xama-text)', marginBottom: 16 }}>
            Histórico de envios
          </div>
          {logs.length === 0 ? (
            <div style={{ color: 'var(--color-xama-muted)', fontSize: 13 }}>Nenhum disparo registrado.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    {['#', 'Template', 'Assunto', 'Destinatários', 'Stage', 'Enviados', 'Falhas', 'Por', 'Data'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--color-xama-muted)', fontWeight: 600, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid var(--color-xama-border)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '8px 10px', color: 'var(--color-xama-muted)' }}>{log.id}</td>
                      <td style={{ padding: '8px 10px', color: 'var(--color-xama-text)', fontWeight: 600 }}>{log.template_key}</td>
                      <td style={{ padding: '8px 10px', color: 'var(--color-xama-muted)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.subject}</td>
                      <td style={{ padding: '8px 10px', color: 'var(--color-xama-muted)', whiteSpace: 'nowrap' }}>{RECIPIENT_LABELS[log.recipient_group] || log.recipient_group}</td>
                      <td style={{ padding: '8px 10px', color: 'var(--color-xama-muted)', fontFamily: 'JetBrains Mono, monospace' }}>{log.stage_id ?? '—'}</td>
                      <td style={{ padding: '8px 10px', color: '#4ade80', fontWeight: 700 }}>{log.sent_count}</td>
                      <td style={{ padding: '8px 10px', color: log.failed_count > 0 ? '#f87171' : 'var(--color-xama-muted)' }}>{log.failed_count}</td>
                      <td style={{ padding: '8px 10px', color: 'var(--color-xama-muted)' }}>{log.triggered_by ?? '—'}</td>
                      <td style={{ padding: '8px 10px', color: 'var(--color-xama-muted)', whiteSpace: 'nowrap' }}>
                        {new Date(log.sent_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal de preview */}
      {preview && (
        <div onClick={() => setPreview(null)} style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#13151f', border: '1px solid var(--color-xama-border)',
            borderRadius: 14, width: '100%', maxWidth: 560,
            maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-xama-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-xama-text)' }}>Pré-visualização</div>
                <div style={{ fontSize: 11, color: 'var(--color-xama-muted)', marginTop: 2 }}>Assunto: {preview.subject}</div>
              </div>
              <button onClick={() => setPreview(null)} style={{ background: 'none', border: 'none', color: 'var(--color-xama-muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
            </div>
            <iframe srcDoc={preview.html} title="Email preview" sandbox="allow-same-origin" style={{ flex: 1, border: 'none', minHeight: 480 }} />
          </div>
        </div>
      )}
    </div>
  )
}
