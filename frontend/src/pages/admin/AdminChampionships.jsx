// pages/admin/AdminChampionships.jsx — CRUD de Championships
import { useState, useEffect, useCallback } from 'react'
import { API_BASE_URL } from '../../config'
import {
  Modal, Field, Msg, ActBtn, SaveBtn, SectionHeader,
  inputStyle, selectStyle, tableStyle, thStyle, tdStyle,
  useSorting, SortableHeader,
} from './Modal'

// ── Coverage Audit Panel ───────────────────────────────────────────────────────

function CoverageAuditPanel({ token, championships }) {
  const [selectedId, setSelectedId] = useState('')
  const [audit, setAudit] = useState(null)
  const [loading, setLoading] = useState(false)
  const [scanResult, setScanResult] = useState(null)
  const [scanStageId, setScanStageId] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [err, setErr] = useState('')

  const runAudit = async () => {
    if (!selectedId) return
    setLoading(true); setAudit(null); setErr(''); setScanResult(null)
    try {
      const res = await fetch(`${API_BASE_URL}/admin/championships/${selectedId}/coverage-audit`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setAudit(await res.json())
    } catch (e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  const runScan = async (stageId) => {
    setScanStageId(stageId); setScanning(true); setScanResult(null); setErr('')
    try {
      const res = await fetch(`${API_BASE_URL}/admin/stages/${stageId}/scan-unresolved`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setScanResult(await res.json())
    } catch (e) { setErr(e.message) }
    finally { setScanning(false) }
  }

  // Group players by stage for display
  const byStage = audit ? audit.players.reduce((acc, p) => {
    const key = p.stage_id
    if (!acc[key]) acc[key] = []
    acc[key].push(p)
    return acc
  }, {}) : {}

  const coverageBadge = (pct) => {
    const bg = pct === 0 ? 'rgba(239,68,68,0.12)' : 'rgba(251,191,36,0.12)'
    const border = pct === 0 ? 'rgba(239,68,68,0.4)' : 'rgba(251,191,36,0.4)'
    const color = pct === 0 ? '#ef4444' : '#f59e0b'
    return (
      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
        fontFamily: 'JetBrains Mono, monospace', background: bg, border: `1px solid ${border}`, color }}>
        {pct}%
      </span>
    )
  }

  return (
    <div style={{ marginTop: 32 }}>
      <SectionHeader title="Auditoria de Cobertura de Dados" />
      <div style={{
        background: 'rgba(18,21,28,0.9)', border: '1px solid var(--color-xama-border)',
        borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <p style={{ fontSize: 12, color: 'var(--color-xama-muted)', margin: 0 }}>
          Detecta jogadores do roster com cobertura de partidas incompleta — contas não cadastradas, subs não mapeados, ou ausências.
        </p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            style={{ ...selectStyle, minWidth: 260 }}
            value={selectedId}
            onChange={e => { setSelectedId(e.target.value); setAudit(null); setScanResult(null) }}
          >
            <option value="">— Selecione um championship —</option>
            {championships.map(c => (
              <option key={c.id} value={c.id}>{c.short_name} — {c.name}</option>
            ))}
          </select>
          <ActBtn onClick={runAudit} disabled={!selectedId || loading}>
            {loading ? 'Auditando...' : 'Auditar Cobertura'}
          </ActBtn>
        </div>

        {err && <div style={{ color: '#ef4444', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}>Erro: {err}</div>}

        {audit && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Summary pills */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {[
                { label: 'Total com gaps', value: audit.total_gaps, color: audit.total_gaps > 0 ? '#f59e0b' : '#4ade80' },
                { label: 'Cobertura 0%', value: audit.zero_coverage, color: audit.zero_coverage > 0 ? '#ef4444' : '#4ade80' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div style={{ fontSize: 10, color: 'var(--color-xama-muted)', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.1em' }}>{label.toUpperCase()}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: 'Rajdhani, sans-serif' }}>{value}</div>
                </div>
              ))}
              {audit.total_gaps === 0 && (
                <div style={{ fontSize: 13, color: '#4ade80', padding: '8px 14px', fontWeight: 600 }}>
                  ✓ Cobertura completa — nenhum gap detectado.
                </div>
              )}
            </div>

            {/* Per-stage breakdown */}
            {Object.entries(byStage).map(([stageId, players]) => (
              <div key={stageId} style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', background: 'rgba(255,255,255,0.03)',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: 'var(--color-xama-muted)' }}>
                    STAGE #{stageId} — {players[0]?.stage_shard}
                  </span>
                  <ActBtn
                    small
                    onClick={() => runScan(parseInt(stageId))}
                    disabled={scanning && scanStageId === parseInt(stageId)}
                    style={{ background: 'rgba(139,92,246,0.1)', borderColor: 'rgba(139,92,246,0.3)', color: '#a78bfa' }}
                  >
                    {scanning && scanStageId === parseInt(stageId) ? 'Escaneando...' : '🔍 Scan API'}
                  </ActBtn>
                </div>
                <table style={{ ...tableStyle, margin: 0 }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Jogador</th>
                      <th style={thStyle}>Time</th>
                      <th style={thStyle}>Aparições</th>
                      <th style={thStyle}>Cobertura</th>
                      <th style={thStyle}>Contas cadastradas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map(p => (
                      <tr key={`${p.stage_id}-${p.person_id}`}>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>{p.display_name}</td>
                        <td style={{ ...tdStyle, fontSize: 12, color: 'var(--color-xama-muted)' }}>{p.team_name}</td>
                        <td style={{ ...tdStyle, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
                          {p.matches_appeared} / {p.total_matches}
                        </td>
                        <td style={tdStyle}>{coverageBadge(p.coverage_pct)}</td>
                        <td style={{ ...tdStyle, fontSize: 11, color: p.registered_accounts.length ? 'var(--color-xama-muted)' : '#ef4444', fontFamily: 'JetBrains Mono, monospace' }}>
                          {p.registered_accounts.length ? p.registered_accounts.join(', ') : '⚠ nenhuma conta cadastrada'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Scan result for this stage */}
                {scanResult && scanStageId === parseInt(stageId) && (
                  <div style={{ padding: 14, background: 'rgba(139,92,246,0.04)', borderTop: '1px solid rgba(139,92,246,0.15)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: '#a78bfa', marginBottom: 8 }}>
                      SCAN — {scanResult.matches_scanned} partida(s) analisada(s) · {scanResult.unique_unresolved_players} aliases não resolvidos
                    </div>
                    {scanResult.unresolved.length === 0 ? (
                      <div style={{ fontSize: 12, color: '#4ade80' }}>✓ Nenhum alias não resolvido — todos os jogadores da API foram mapeados.</div>
                    ) : (
                      <table style={{ ...tableStyle, margin: 0 }}>
                        <thead>
                          <tr>
                            <th style={thStyle}>Alias (API)</th>
                            <th style={thStyle}>Account ID</th>
                            <th style={thStyle}>Primeira partida</th>
                            <th style={{ ...thStyle, fontSize: 10 }}>Ação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {scanResult.unresolved.map((u, i) => (
                            <tr key={i}>
                              <td style={{ ...tdStyle, fontWeight: 700, color: '#f59e0b' }}>{u.alias}</td>
                              <td style={{ ...tdStyle, fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: 'var(--color-xama-muted)' }}>{u.account_id}</td>
                              <td style={{ ...tdStyle, fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: 'var(--color-xama-muted)' }}>{u.first_seen_match?.slice(0, 8)}...</td>
                              <td style={tdStyle}>
                                <button
                                  onClick={() => navigator.clipboard?.writeText(u.account_id)}
                                  style={{ fontSize: 10, padding: '3px 8px', cursor: 'pointer', borderRadius: 4, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--color-xama-text)' }}
                                >
                                  Copiar ID
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {scanResult.next_steps && scanResult.unresolved.length > 0 && (
                      <div style={{ marginTop: 10, fontSize: 11, color: 'var(--color-xama-muted)', lineHeight: 1.5 }}>
                        💡 {scanResult.next_steps}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
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
      <td style={{ ...tdStyle, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--color-xama-muted)' }}>{c.id}</td>
      <td style={{ ...tdStyle, fontWeight: 600 }}>{c.name}</td>
      <td style={{ ...tdStyle, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{c.short_name}</td>
      <td style={{ ...tdStyle, color: 'var(--color-xama-muted)', fontSize: 12 }}>{c.shard}</td>
      <td style={{ ...tdStyle, color: 'var(--color-xama-muted)' }}>{c.tier_weight}</td>
      <td style={tdStyle}>
        {c.has_faceoff && !c.finished_at && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4, fontFamily: 'JetBrains Mono, monospace', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', color: '#f59e0b' }}>
            VOTAÇÃO ABERTA
          </span>
        )}
        {c.has_faceoff && c.finished_at && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4, fontFamily: 'JetBrains Mono, monospace', background: 'rgba(107,114,128,0.1)', border: '1px solid rgba(107,114,128,0.3)', color: 'var(--color-xama-muted)' }}>
            VOTAÇÃO ENCERRADA
          </span>
        )}
        {!c.has_faceoff && (
          <span style={{ fontSize: 10, color: 'var(--color-xama-muted)', fontFamily: 'JetBrains Mono, monospace' }}>—</span>
        )}
      </td>
      <td style={tdStyle}>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4,
          fontFamily: 'JetBrains Mono, monospace',
          background: c.is_active ? 'rgba(74,222,128,0.1)' : 'rgba(107,114,128,0.1)',
          border: c.is_active ? '1px solid rgba(74,222,128,0.3)' : '1px solid rgba(107,114,128,0.3)',
          color: c.is_active ? 'var(--color-xama-green)' : 'var(--color-xama-muted)',
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

      <div style={{ background: 'rgba(18,21,28,0.9)', border: '1px solid var(--color-xama-border)', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-xama-muted)' }}>Carregando...</div>
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
                        border: 'none', borderTop: '1px solid var(--color-xama-border)',
                        cursor: 'pointer', textAlign: 'center',
                        fontSize: 11, fontWeight: 700, letterSpacing: '0.14em',
                        fontFamily: 'JetBrains Mono, monospace',
                        color: 'var(--color-xama-muted)',
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
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--color-xama-text)' }}>
              <input type="checkbox" checked={!!form.has_faceoff} onChange={e => setForm(prev => ({ ...prev, has_faceoff: e.target.checked }))} />
              Habilitar Team Faceoff neste campeonato
            </label>
          </Field>
          {modal.mode === 'edit' && (
            <Field label="Status">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--color-xama-text)' }}>
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
