// frontend/src/pages/admin/AdminEmail.jsx
import { useEffect, useState, useCallback } from 'react'
import { API_BASE_URL } from '../../config'

const RECIPIENT_LABELS = {
  all:       'Todos os usuários ativos',
  no_lineup: 'Usuários sem lineup na stage',
}

// Variáveis que são preenchidas via seletor de stage (não campo de texto livre)
const STAGE_VARS = new Set(['stage_id', 'stage_name'])

export default function AdminEmail({ token }) {
  const [templates, setTemplates]           = useState([])
  const [selected, setSelected]             = useState(null)
  const [variables, setVariables]           = useState({})
  const [recipientGroup, setRecipientGroup] = useState('all')
  const [logs, setLogs]                     = useState([])
  const [tab, setTab]                       = useState('dispatch')
  const [loading, setLoading]               = useState(false)
  const [result, setResult]                 = useState(null)
  const [error, setError]                   = useState(null)

  // stage/championship selectors
  const [championships, setChampionships]   = useState([])
  const [stages, setStages]                 = useState([])
  const [champFilter, setChampFilter]       = useState('')
  const [selectedStage, setSelectedStage]   = useState(null)

  // preview modal
  const [preview, setPreview]               = useState(null) // { subject, html } | null
  const [previewing, setPreviewing]         = useState(false)

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }), [token])

  // Carrega templates e championships na montagem
  useEffect(() => {
    fetch(`${API_BASE_URL}/admin/email/templates`, { headers: headers() })
      .then(r => r.json()).then(data => {
        setTemplates(data)
        if (data.length > 0) selectTemplate(data[0])
      }).catch(() => {})

    fetch(`${API_BASE_URL}/admin/email/championships`, { headers: headers() })
      .then(r => r.json()).then(setChampionships).catch(() => {})
  }, [])

  // Carrega stages quando championship muda
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

  function selectTemplate(tpl) {
    setSelected(tpl)
    setVariables({})
    setSelectedStage(null)
    setRecipientGroup(tpl.recipient_groups[0])
    setResult(null)
    setError(null)
    setPreview(null)
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

  // Verifica se o template requer stage
  const templateNeedsStage = selected?.variables?.some(v => STAGE_VARS.has(v.key))

  async function handlePreview() {
    if (!selected) return
    setPreviewing(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE_URL}/admin/email/preview`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          template_key:    selected.key,
          variables,
          recipient_group: recipientGroup,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Erro ao gerar preview')
      setPreview(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setPreviewing(false)
    }
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
      if (tab === 'logs') loadLogs()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Estilos ────────────────────────────────────────────────────────────────

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
  const selectStyle = {
    ...inputStyle,
    cursor: 'pointer', colorScheme: 'dark',
    appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2364748b' stroke-width='1.5' fill='none'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', paddingRight: 30,
  }
  const labelStyle = {
    display: 'block', fontSize: 11, fontWeight: 600,
    color: 'var(--color-xama-muted)', letterSpacing: '0.08em',
    textTransform: 'uppercase', marginBottom: 6,
  }

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
        {[['dispatch', '✉️ Disparar'], ['logs', '📋 Histórico']].map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: tab === t ? 'var(--color-xama-orange)' : 'rgba(255,255,255,0.06)',
            color: tab === t ? '#0d0f14' : 'var(--color-xama-muted)',
            fontWeight: tab === t ? 700 : 400, fontSize: 13,
          }}>{label}</button>
        ))}
      </div>

      {tab === 'dispatch' && (
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>

          {/* Template selector */}
          <div style={{ ...card, flex: '0 0 240px', minWidth: 200 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-xama-orange)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>
              Templates
            </div>
            {templates.map(tpl => (
              <button key={tpl.key} onClick={() => selectTemplate(tpl)} style={{
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

              {/* Seletor de stage (para templates que precisam de stage_id/stage_name) */}
              {templateNeedsStage && (
                <div style={{ marginBottom: 20, padding: '16px', background: 'rgba(99,102,241,0.06)', borderRadius: 10, border: '1px solid rgba(99,102,241,0.2)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#a5b4fc', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
                    Selecionar Stage
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 160px' }}>
                      <label style={labelStyle}>Championship</label>
                      <select value={champFilter} onChange={e => setChampFilter(e.target.value)} style={selectStyle}>
                        <option value="">Todos</option>
                        {championships.map(c => (
                          <option key={c.id} value={c.id}>{c.short_name} — {c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ flex: '2 1 220px' }}>
                      <label style={labelStyle}>Stage <span style={{ color: 'var(--color-xama-orange)' }}>*</span></label>
                      <select
                        value={selectedStage?.id || ''}
                        onChange={e => handleStageSelect(e.target.value)}
                        style={selectStyle}
                      >
                        <option value="">Selecione uma stage...</option>
                        {stages.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.id} — {s.champ_short_name} · {s.name}
                            {s.lineup_status === 'open' ? ' ✓' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {selectedStage && (
                    <div style={{ marginTop: 10, fontSize: 12, color: 'var(--color-xama-muted)', display: 'flex', gap: 16 }}>
                      <span>ID: <strong style={{ color: 'var(--color-xama-text)', fontFamily: 'JetBrains Mono, monospace' }}>{selectedStage.id}</strong></span>
                      <span>Status: <strong style={{ color: selectedStage.lineup_status === 'open' ? '#4ade80' : 'var(--color-xama-muted)' }}>{selectedStage.lineup_status}</strong></span>
                      <span>Fase: <strong style={{ color: 'var(--color-xama-text)' }}>{selectedStage.stage_phase}</strong></span>
                    </div>
                  )}
                </div>
              )}

              {/* Demais variáveis (excluindo stage_id e stage_name que são preenchidos via dropdown) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
                {selected.variables
                  .filter(v => !STAGE_VARS.has(v.key))
                  .map(v => (
                    <div key={v.key}>
                      <label style={labelStyle}>
                        {v.label}{v.required && <span style={{ color: 'var(--color-xama-orange)' }}> *</span>}
                      </label>
                      {v.multiline ? (
                        <textarea
                          rows={4}
                          value={variables[v.key] || ''}
                          onChange={e => setVar(v.key, e.target.value)}
                          style={{ ...inputStyle, resize: 'vertical' }}
                        />
                      ) : (
                        <input
                          type={v.type === 'number' ? 'number' : 'text'}
                          value={variables[v.key] || ''}
                          onChange={e => setVar(v.key, e.target.value)}
                          style={inputStyle}
                          placeholder={v.required ? '' : 'Opcional'}
                        />
                      )}
                    </div>
                  ))}
              </div>

              {/* Destinatários */}
              {selected.recipient_groups.length > 1 && (
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
                      }}>
                        {RECIPIENT_LABELS[g] || g}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selected.recipient_groups.length === 1 && (
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
                <button
                  onClick={handlePreview}
                  disabled={previewing}
                  style={{
                    padding: '11px 22px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.4)',
                    cursor: previewing ? 'not-allowed' : 'pointer',
                    background: 'rgba(99,102,241,0.1)', color: '#a5b4fc',
                    fontWeight: 600, fontSize: 14,
                  }}
                >
                  {previewing ? 'Gerando...' : '👁 Pré-visualizar'}
                </button>
                <button
                  onClick={handleDispatch}
                  disabled={loading}
                  style={{
                    padding: '11px 28px', borderRadius: 8, border: 'none',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    background: loading ? 'rgba(249,115,22,0.4)' : 'var(--color-xama-orange)',
                    color: '#0d0f14', fontWeight: 700, fontSize: 14, letterSpacing: '0.04em',
                  }}
                >
                  {loading ? 'Enviando...' : '✉️ Disparar email'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

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
                      <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--color-xama-muted)', fontWeight: 600, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid var(--color-xama-border)', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
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
        <div
          onClick={() => setPreview(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#13151f', border: '1px solid var(--color-xama-border)',
              borderRadius: 14, width: '100%', maxWidth: 560,
              maxHeight: '90vh', display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header do modal */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-xama-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-xama-text)' }}>Pré-visualização</div>
                <div style={{ fontSize: 11, color: 'var(--color-xama-muted)', marginTop: 2 }}>
                  Assunto: {preview.subject}
                </div>
              </div>
              <button
                onClick={() => setPreview(null)}
                style={{ background: 'none', border: 'none', color: 'var(--color-xama-muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
              >✕</button>
            </div>
            {/* iframe com o HTML do email */}
            <iframe
              srcDoc={preview.html}
              title="Email preview"
              sandbox="allow-same-origin"
              style={{ flex: 1, border: 'none', minHeight: 480 }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
