// pages/admin/AdminStages.jsx — Stages com mudança de status inline + criação/edição
import { useState, useEffect, useCallback, Fragment } from 'react'
import { API_BASE_URL } from '../../config'
import {
  Modal, Field, Msg, ActBtn, SaveBtn, SectionHeader,
  inputStyle, selectStyle, tableStyle, thStyle, tdStyle,
} from './Modal'

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

const STATUS_OPTIONS = ['closed', 'open', 'preview', 'live', 'locked']
const BLANK = {
  championship_id: '', name: '', short_name: '', shard: 'steam',
  lineup_status: 'closed', lineup_open_at: '', lineup_close_at: '',
  start_date: '', end_date: '',
  lineup_size: 4, captain_multiplier: 1.3,
  price_min: 12, price_max: 35,
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

// ── Painel de importação de times ─────────────────────────────────────────────

function ImportPanel({ stage, stages, token }) {
  const call = useCallback(api(token), [token])
  const [sourceId, setSourceId] = useState('')
  const [sourceTeams, setSourceTeams] = useState([])
  const [targetTeamNames, setTargetTeamNames] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [loadingSource, setLoadingSource] = useState(false)
  const [importing, setImporting] = useState(false)
  const [msg, setMsg] = useState('')

  // Carrega times já no roster destino
  const refreshTarget = useCallback(() => {
    call('GET', `/admin/stages/${stage.id}/roster/teams`)
      .then(data => setTargetTeamNames(data.map(t => t.team_name)))
      .catch(() => {})
  }, [call, stage.id])

  useEffect(() => { refreshTarget() }, [refreshTarget])

  // Carrega times da stage de origem quando selecionada
  useEffect(() => {
    if (!sourceId) { setSourceTeams([]); setSelected(new Set()); return }
    setLoadingSource(true)
    call('GET', `/admin/stages/${sourceId}/roster/teams`)
      .then(data => { setSourceTeams(data); setSelected(new Set()) })
      .catch(() => setSourceTeams([]))
      .finally(() => setLoadingSource(false))
  }, [call, sourceId])

  const toggle = (name) => setSelected(prev => {
    const next = new Set(prev)
    if (next.has(name)) next.delete(name) else next.add(name)
    return next
  })

  const selectAll = () => {
    const notYetIn = sourceTeams.filter(t => !targetTeamNames.includes(t.team_name))
    setSelected(new Set(notYetIn.map(t => t.team_name)))
  }

  const handleImport = async () => {
    if (!selected.size) return
    setImporting(true); setMsg('')
    try {
      const res = await call('POST', `/admin/stages/${stage.id}/roster/copy-from-stage`, {
        source_stage_id: parseInt(sourceId),
        team_names: [...selected],
      })
      setMsg(`${res.added_teams} times importados — ${res.added_players} jogadores adicionados` +
        (res.skipped_players ? `, ${res.skipped_players} já existiam` : ''))
      setSelected(new Set())
      refreshTarget()
    } catch (e) {
      setMsg('!' + e.message)
    } finally {
      setImporting(false)
    }
  }

  const newCount = selected.size
  const availableToSelect = sourceTeams.filter(t => !targetTeamNames.includes(t.team_name))

  return (
    <div style={{
      padding: '18px 24px 20px',
      background: 'rgba(249,115,22,0.03)',
      borderTop: '1px solid rgba(249,115,22,0.15)',
    }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-xama-text)' }}>
          Importar Times
        </span>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20,
          background: targetTeamNames.length >= 16 ? 'rgba(74,222,128,0.12)' : 'rgba(249,115,22,0.12)',
          color: targetTeamNames.length >= 16 ? 'var(--color-xama-green)' : 'var(--color-xama-orange)',
          border: `1px solid ${targetTeamNames.length >= 16 ? 'rgba(74,222,128,0.3)' : 'rgba(249,115,22,0.3)'}`,
          fontFamily: 'JetBrains Mono, monospace',
        }}>
          {targetTeamNames.length} / 16 times no roster
        </span>
      </div>

      {/* Seletor de stage de origem */}
      <div style={{ maxWidth: 440, marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-xama-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Stage de origem
        </label>
        <select
          style={{ ...selectStyle, colorScheme: 'dark' }}
          value={sourceId}
          onChange={e => setSourceId(e.target.value)}
        >
          <option value="">Selecione uma stage...</option>
          {stages.filter(s => s.id !== stage.id).map(s => (
            <option key={s.id} value={s.id}>{s.id} — {s.name}</option>
          ))}
        </select>
      </div>

      {/* Lista de times */}
      {loadingSource && (
        <div style={{ fontSize: 13, color: 'var(--color-xama-muted)', marginBottom: 12 }}>Carregando times...</div>
      )}
      {sourceTeams.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: 'var(--color-xama-muted)' }}>
              {sourceTeams.length} times na stage de origem
            </span>
            {availableToSelect.length > 0 && (
              <button
                onClick={selectAll}
                style={{ fontSize: 11, color: 'var(--color-xama-orange)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
              >
                selecionar todos disponíveis
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 7, marginBottom: 16 }}>
            {sourceTeams.map(t => {
              const alreadyIn = targetTeamNames.includes(t.team_name)
              const isSel = selected.has(t.team_name)
              return (
                <label
                  key={t.team_name}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    padding: '8px 11px', borderRadius: 8,
                    cursor: alreadyIn ? 'default' : 'pointer',
                    border: `1px solid ${alreadyIn ? 'rgba(74,222,128,0.3)' : isSel ? 'rgba(249,115,22,0.5)' : 'rgba(255,255,255,0.07)'}`,
                    background: alreadyIn ? 'rgba(74,222,128,0.05)' : isSel ? 'rgba(249,115,22,0.07)' : 'rgba(255,255,255,0.02)',
                    transition: 'all 0.12s',
                    userSelect: 'none',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={alreadyIn || isSel}
                    disabled={alreadyIn}
                    onChange={() => !alreadyIn && toggle(t.team_name)}
                    style={{ accentColor: 'var(--color-xama-orange)', width: 14, height: 14, flexShrink: 0 }}
                  />
                  <span style={{ fontSize: 13, flex: 1, color: alreadyIn ? 'var(--color-xama-green)' : 'var(--color-xama-text)' }}>
                    {t.team_name}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--color-xama-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {alreadyIn ? '✓' : `${t.player_count}j`}
                  </span>
                </label>
              )
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <ActBtn onClick={handleImport} disabled={!newCount || importing}>
              {importing ? 'Importando...' : newCount > 0 ? `Importar ${newCount} time${newCount !== 1 ? 's' : ''}` : 'Selecione times'}
            </ActBtn>
            {msg && (
              <span style={{
                fontSize: 12, padding: '4px 10px', borderRadius: 6,
                background: msg.startsWith('!') ? 'rgba(239,68,68,0.1)' : 'rgba(74,222,128,0.1)',
                color: msg.startsWith('!') ? '#f87171' : 'var(--color-xama-green)',
                border: `1px solid ${msg.startsWith('!') ? 'rgba(239,68,68,0.3)' : 'rgba(74,222,128,0.3)'}`,
              }}>
                {msg.startsWith('!') ? msg.slice(1) : msg}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────────────────

export default function AdminStages({ token }) {
  const call = useCallback(api(token), [token])

  const [stages, setStages] = useState([])
  const [championships, setChampionships] = useState([])
  const [champFilter, setChampFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const [statusChanging, setStatusChanging] = useState(null) // stage id
  const [expandedStage, setExpandedStage] = useState(null)

  const loadChampionships = useCallback(async () => {
    try {
      const data = await call('GET', '/admin/championships?include_inactive=true')
      setChampionships(Array.isArray(data) ? data.sort((a, b) => b.id - a.id) : [])
    } catch {}
  }, [call])

  const loadStages = useCallback(async () => {
    setLoading(true)
    try {
      const params = champFilter ? `?championship_id=${champFilter}` : ''
      const data = await call('GET', `/admin/stages${params}`)
      setStages(Array.isArray(data) ? data.sort((a, b) => b.id - a.id) : [])
    } catch { setStages([]) }
    finally { setLoading(false) }
  }, [call, champFilter])

  useEffect(() => { loadChampionships() }, [loadChampionships])
  useEffect(() => { loadStages() }, [loadStages])

  const openCreate = () => {
    setForm({ ...BLANK, championship_id: champFilter || '' })
    setMsg(''); setModal({ mode: 'create' })
  }
  const openEdit = (s) => {
    setForm({
      championship_id: s.championship_id,
      name: s.name, short_name: s.short_name || '', shard: s.shard,
      lineup_status: s.lineup_status,
      lineup_open_at: s.lineup_open_at ? s.lineup_open_at.slice(0, 16) : '',
      lineup_close_at: s.lineup_close_at ? s.lineup_close_at.slice(0, 16) : '',
      start_date: s.start_date ? s.start_date.slice(0, 10) : '',
      end_date: s.end_date ? s.end_date.slice(0, 10) : '',
      lineup_size: s.lineup_size ?? 4,
      captain_multiplier: s.captain_multiplier ?? 1.3,
      price_min: s.price_min ?? 12,
      price_max: s.price_max ?? 35,
    })
    setMsg(''); setModal({ mode: 'edit', data: s })
  }

  const handleSave = async () => {
    setSaving(true); setMsg('')
    try {
      const body = {
        ...form,
        championship_id: parseInt(form.championship_id),
        lineup_size: parseInt(form.lineup_size),
        captain_multiplier: parseFloat(form.captain_multiplier),
        price_min: parseFloat(form.price_min),
        price_max: parseFloat(form.price_max),
        lineup_open_at: form.lineup_open_at || null,
        lineup_close_at: form.lineup_close_at || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      }
      if (modal.mode === 'create') {
        await call('POST', '/admin/stages', body)
        setMsg('Stage criada.')
        setModal(null)
      } else {
        await call('PATCH', `/admin/stages/${modal.data.id}`, body)
        setMsg('Stage atualizada.')
      }
      await loadStages()
    } catch (e) { setMsg('!' + e.message) }
    finally { setSaving(false) }
  }

  const changeStatus = async (stage, newStatus) => {
    setStatusChanging(stage.id)
    try {
      await call('PATCH', `/admin/stages/${stage.id}`, { lineup_status: newStatus })
      await loadStages()
    } catch (e) { alert('Erro: ' + e.message) }
    finally { setStatusChanging(null) }
  }

  const champName = (id) => championships.find(c => c.id === id)?.short_name || id
  const f = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }))

  return (
    <div>
      <SectionHeader
        title="Stages"
        action={<ActBtn onClick={openCreate}>+ Nova Stage</ActBtn>}
      />

      {/* Filtro por championship */}
      <select
        style={{ ...selectStyle, marginBottom: 14, maxWidth: 320 }}
        value={champFilter}
        onChange={e => setChampFilter(e.target.value)}
      >
        <option value="">Todos os championships</option>
        {championships.map(c => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      <div style={{ background: 'rgba(18,21,28,0.9)', border: '1px solid var(--color-xama-border)', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-xama-muted)' }}>Carregando...</div>
        ) : stages.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-xama-muted)' }}>Nenhuma stage encontrada.</div>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>ID</th>
                <th style={thStyle}>Champ.</th>
                <th style={thStyle}>Nome</th>
                <th style={thStyle}>Início</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {stages.map(s => (
                <Fragment key={s.id}>
                  <tr>
                    <td style={{ ...tdStyle, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--color-xama-muted)' }}>{s.id}</td>
                    <td style={{ ...tdStyle, color: 'var(--color-xama-muted)', fontSize: 12 }}>{champName(s.championship_id)}</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{s.name}</td>
                    <td style={{ ...tdStyle, color: 'var(--color-xama-muted)', fontSize: 12 }}>{fmtDate(s.start_date || s.lineup_open_at)}</td>
                    <td style={tdStyle}>
                      <select
                        value={s.lineup_status}
                        disabled={statusChanging === s.id}
                        onChange={e => changeStatus(s, e.target.value)}
                        style={{
                          padding: '4px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                          fontFamily: 'JetBrains Mono, monospace', cursor: 'pointer',
                          border: '1px solid rgba(249,115,22,0.35)',
                          background: 'rgba(249,115,22,0.08)', color: 'var(--color-xama-orange)',
                          outline: 'none', colorScheme: 'dark',
                        }}
                      >
                        {STATUS_OPTIONS.map(st => (
                          <option key={st} value={st}>{st.toUpperCase()}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <ActBtn small onClick={() => setExpandedStage(expandedStage === s.id ? null : s.id)}>
                          {expandedStage === s.id ? '▲ Fechar' : '↓ Importar'}
                        </ActBtn>
                        <ActBtn small onClick={() => openEdit(s)}>Editar</ActBtn>
                      </div>
                    </td>
                  </tr>
                  {expandedStage === s.id && (
                    <tr>
                      <td colSpan={6} style={{ padding: 0, borderBottom: '1px solid var(--color-xama-border)' }}>
                        <ImportPanel stage={s} stages={stages} token={token} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <Modal
          title={modal.mode === 'create' ? 'Nova Stage' : `Editar — ${modal.data?.name}`}
          onClose={() => setModal(null)}
          width={620}
        >
          <Msg msg={msg} />

          <Field label="Championship">
            <select style={selectStyle} value={form.championship_id} onChange={f('championship_id')}>
              <option value="">Selecione...</option>
              {championships.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <Field label="Nome">
              <input style={inputStyle} value={form.name} onChange={f('name')} placeholder="ex: PAS1 2026 - Day 1" />
            </Field>
            <Field label="Short name">
              <input style={inputStyle} value={form.short_name} onChange={f('short_name')} placeholder="ex: D1" />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Shard">
              <select style={selectStyle} value={form.shard} onChange={f('shard')}>
                <option value="steam">steam</option>
                <option value="pc-tournament">pc-tournament</option>
              </select>
            </Field>
            <Field label="Status">
              <select style={selectStyle} value={form.lineup_status} onChange={f('lineup_status')}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Lineup abre em">
              <input style={inputStyle} type="datetime-local" value={form.lineup_open_at} onChange={f('lineup_open_at')} />
            </Field>
            <Field label="Lineup fecha em">
              <input style={inputStyle} type="datetime-local" value={form.lineup_close_at} onChange={f('lineup_close_at')} />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Data de início">
              <input style={inputStyle} type="date" value={form.start_date} onChange={f('start_date')} />
            </Field>
            <Field label="Data de fim">
              <input style={inputStyle} type="date" value={form.end_date} onChange={f('end_date')} />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
            <Field label="Jogadores (lineup_size)">
              <input style={inputStyle} type="number" min="1" max="10" value={form.lineup_size} onChange={f('lineup_size')} />
            </Field>
            <Field label="Mult. capitão">
              <input style={inputStyle} type="number" step="0.05" min="1" max="3" value={form.captain_multiplier} onChange={f('captain_multiplier')} />
            </Field>
            <Field label="Preço mín.">
              <input style={inputStyle} type="number" min="1" value={form.price_min} onChange={f('price_min')} />
            </Field>
            <Field label="Preço máx.">
              <input style={inputStyle} type="number" min="1" value={form.price_max} onChange={f('price_max')} />
            </Field>
          </div>

          <SaveBtn loading={saving} onClick={handleSave} label={modal.mode === 'create' ? 'Criar Stage' : 'Salvar'} />
        </Modal>
      )}
    </div>
  )
}
