// pages/admin/AdminPersons.jsx — CRUD de Persons (jogadores)
import { useState, useEffect, useCallback } from 'react'
import { API_BASE_URL } from '../../config'
import {
  Modal, Field, Msg, ActBtn, SaveBtn, SectionHeader, SearchBar,
  inputStyle, selectStyle, tableStyle, thStyle, tdStyle, StatusBadge,
  useSorting, SortableHeader,
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

const SHARDS = ['steam', 'pc-tournament']

export default function AdminPersons({ token }) {
  const call = useCallback(api(token), [token])

  const [persons, setPersons] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)
  const [modal, setModal] = useState(null) // null | { mode: 'create'|'edit', data: {} }
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({})
  // Accounts subform
  const [accForm, setAccForm] = useState({ account_id: '', shard: 'steam', alias: '' })
  const [accMsg, setAccMsg] = useState('')
  const [accSaving, setAccSaving] = useState(false)

  const { sort, toggle, apply } = useSorting('display_name')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (includeInactive) params.set('include_inactive', 'true')
      const data = await call('GET', `/admin/persons?${params}`)
      setPersons(Array.isArray(data) ? data : [])
    } catch (e) { setPersons([]) }
    finally { setLoading(false) }
  }, [call, search, includeInactive])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setForm({ display_name: '' })
    setMsg('')
    setModal({ mode: 'create' })
  }

  const openEdit = (p) => {
    setForm({ display_name: p.display_name, is_active: p.is_active })
    setAccForm({ account_id: '', shard: 'steam', alias: '' })
    setMsg(''); setAccMsg('')
    setModal({ mode: 'edit', data: p })
  }

  const handleSave = async () => {
    setSaving(true); setMsg('')
    try {
      if (modal.mode === 'create') {
        await call('POST', '/admin/persons', { display_name: form.display_name })
        setMsg('Jogador criado com sucesso.')
      } else {
        await call('PATCH', `/admin/persons/${modal.data.id}`, {
          display_name: form.display_name,
          is_active: form.is_active,
        })
        setMsg('Jogador atualizado.')
      }
      await load()
      if (modal.mode === 'create') setModal(null)
    } catch (e) { setMsg('!' + e.message) }
    finally { setSaving(false) }
  }

  const handleAddAccount = async () => {
    if (!accForm.account_id.trim()) { setAccMsg('!account_id obrigatório.'); return }
    setAccSaving(true); setAccMsg('')
    try {
      await call('POST', `/admin/persons/${modal.data.id}/accounts`, accForm)
      setAccMsg('Conta adicionada.')
      setAccForm({ account_id: '', shard: 'steam', alias: '' })
      // Reload person data
      const updated = await call('GET', `/admin/persons/${modal.data.id}`)
      setModal(m => ({ ...m, data: updated }))
    } catch (e) { setAccMsg('!' + e.message) }
    finally { setAccSaving(false) }
  }

  return (
    <div>
      <SectionHeader
        title="Jogadores"
        action={<ActBtn onClick={openCreate}>+ Novo Jogador</ActBtn>}
      />

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Buscar por nome..." />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--color-xama-muted)', whiteSpace: 'nowrap', cursor: 'pointer' }}>
          <input type="checkbox" checked={includeInactive} onChange={e => setIncludeInactive(e.target.checked)} />
          Incluir inativos
        </label>
      </div>

      {/* Tabela */}
      <div style={{ background: 'rgba(18,21,28,0.9)', border: '1px solid var(--color-xama-border)', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-xama-muted)' }}>Carregando...</div>
        ) : persons.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-xama-muted)' }}>Nenhum jogador encontrado.</div>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <SortableHeader label="ID" col="id" sort={sort} onSort={toggle} />
                <SortableHeader label="Nome" col="display_name" sort={sort} onSort={toggle} />
                <SortableHeader label="Status" col="status" sort={sort} onSort={toggle} />
                <SortableHeader label="Contas" col="accounts" sort={sort} onSort={toggle} />
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {apply(persons, {
                id: p => p.id,
                display_name: p => p.display_name,
                status: p => p.is_active ? 0 : 1,
                accounts: p => p.accounts?.length ?? 0,
              }).map(p => (
                <tr key={p.id} style={{ opacity: p.is_active ? 1 : 0.5 }}>
                  <td style={{ ...tdStyle, color: 'var(--color-xama-muted)', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{p.id}</td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{p.display_name}</td>
                  <td style={tdStyle}>
                    <StatusBadge status={p.is_active ? 'open' : 'locked'} />
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--color-xama-muted)' }}>
                    {p.accounts?.length ?? 0} conta{(p.accounts?.length ?? 0) !== 1 ? 's' : ''}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <ActBtn small onClick={() => openEdit(p)}>Editar</ActBtn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <Modal
          title={modal.mode === 'create' ? 'Novo Jogador' : `Editar — ${modal.data?.display_name}`}
          onClose={() => setModal(null)}
          width={560}
        >
          <Msg msg={msg} />
          <Field label="Nome de exibição">
            <input
              style={inputStyle}
              value={form.display_name || ''}
              onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
              placeholder="ex: frz"
            />
          </Field>
          {modal.mode === 'edit' && (
            <Field label="Status">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--color-xama-text)' }}>
                <input type="checkbox" checked={!!form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                Ativo
              </label>
            </Field>
          )}
          <SaveBtn loading={saving} onClick={handleSave} label={modal.mode === 'create' ? 'Criar Jogador' : 'Salvar'} />

          {/* Accounts — só no edit */}
          {modal.mode === 'edit' && (
            <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--color-xama-border)' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-xama-text)', marginBottom: 14 }}>Contas PUBG</div>

              {/* Accounts existentes */}
              {modal.data?.accounts?.length > 0 ? (
                <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {modal.data.accounts.map(acc => (
                    <div key={acc.account_id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 12px', borderRadius: 8,
                      background: acc.active_until ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.07)', fontSize: 12,
                    }}>
                      <div>
                        <span style={{ fontWeight: 600, color: 'var(--color-xama-text)' }}>{acc.alias || acc.account_id}</span>
                        <span style={{ color: 'var(--color-xama-muted)', marginLeft: 8 }}>{acc.shard}</span>
                      </div>
                      {acc.active_until
                        ? <span style={{ fontSize: 10, color: '#f87171' }}>INATIVA</span>
                        : <span style={{ fontSize: 10, color: 'var(--color-xama-green)' }}>ATIVA</span>
                      }
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: 'var(--color-xama-muted)', fontSize: 13, marginBottom: 16 }}>Nenhuma conta cadastrada.</div>
              )}

              {/* Adicionar conta */}
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-xama-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Adicionar Conta</div>
              <Msg msg={accMsg} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Account ID">
                  <input style={inputStyle} value={accForm.account_id} onChange={e => setAccForm(f => ({ ...f, account_id: e.target.value }))} placeholder="account_xxx..." />
                </Field>
                <Field label="Shard">
                  <select style={selectStyle} value={accForm.shard} onChange={e => setAccForm(f => ({ ...f, shard: e.target.value }))}>
                    {SHARDS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Alias (nick atual)">
                <input style={inputStyle} value={accForm.alias} onChange={e => setAccForm(f => ({ ...f, alias: e.target.value }))} placeholder="ex: frz" />
              </Field>
              <ActBtn onClick={handleAddAccount} disabled={accSaving}>
                {accSaving ? 'Adicionando...' : '+ Adicionar Conta'}
              </ActBtn>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
