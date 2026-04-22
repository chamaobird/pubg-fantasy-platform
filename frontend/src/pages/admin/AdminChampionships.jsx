// pages/admin/AdminChampionships.jsx — CRUD de Championships
import { useState, useEffect, useCallback } from 'react'
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

const BLANK = { name: '', short_name: '', shard: 'steam', tier_weight: 1.0, is_active: true }

export default function AdminChampionships({ token }) {
  const call = useCallback(api(token), [token])

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)

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
    setForm({ name: c.name, short_name: c.short_name, shard: c.shard, tier_weight: c.tier_weight, is_active: c.is_active })
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

  const f = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }))

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
                <th style={thStyle}>ID</th>
                <th style={thStyle}>Nome</th>
                <th style={thStyle}>Tag</th>
                <th style={thStyle}>Shard</th>
                <th style={thStyle}>Peso</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {items.map(c => (
                <tr key={c.id} style={{ opacity: c.is_active ? 1 : 0.5 }}>
                  <td style={{ ...tdStyle, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--color-xama-muted)' }}>{c.id}</td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{c.name}</td>
                  <td style={{ ...tdStyle, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{c.short_name}</td>
                  <td style={{ ...tdStyle, color: 'var(--color-xama-muted)', fontSize: 12 }}>{c.shard}</td>
                  <td style={{ ...tdStyle, color: 'var(--color-xama-muted)' }}>{c.tier_weight}</td>
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
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <ActBtn small onClick={() => openEdit(c)}>Editar</ActBtn>
                      <ActBtn small danger onClick={() => toggleActive(c)}>
                        {c.is_active ? 'Desativar' : 'Ativar'}
                      </ActBtn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

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
