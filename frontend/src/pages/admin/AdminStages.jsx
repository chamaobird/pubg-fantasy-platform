// pages/admin/AdminStages.jsx — Stages com mudança de status inline + criação/edição
import { useState, useEffect, useCallback } from 'react'
import { API_BASE_URL } from '../../config'
import {
  Modal, Field, Msg, ActBtn, SaveBtn, SectionHeader, StatusBadge,
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
                <tr key={s.id}>
                  <td style={{ ...tdStyle, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--color-xama-muted)' }}>{s.id}</td>
                  <td style={{ ...tdStyle, color: 'var(--color-xama-muted)', fontSize: 12 }}>{champName(s.championship_id)}</td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{s.name}</td>
                  <td style={{ ...tdStyle, color: 'var(--color-xama-muted)', fontSize: 12 }}>{fmtDate(s.start_date || s.lineup_open_at)}</td>
                  <td style={tdStyle}>
                    {/* Status dropdown inline */}
                    <select
                      value={s.lineup_status}
                      disabled={statusChanging === s.id}
                      onChange={e => changeStatus(s, e.target.value)}
                      style={{
                        padding: '4px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                        fontFamily: 'JetBrains Mono, monospace', cursor: 'pointer',
                        border: '1px solid rgba(249,115,22,0.35)',
                        background: 'rgba(249,115,22,0.08)', color: 'var(--color-xama-orange)',
                        outline: 'none',
                      }}
                    >
                      {STATUS_OPTIONS.map(st => (
                        <option key={st} value={st}>{st.toUpperCase()}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <ActBtn small onClick={() => openEdit(s)}>Editar</ActBtn>
                  </td>
                </tr>
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
