// frontend/src/pages/admin/AdminChampionshipGroups.jsx
// Gerenciamento de Championship Groups — CRUD + membros

import { useEffect, useState } from 'react'
import { API_BASE_URL } from '../../config'

const BASE = `${API_BASE_URL}/admin/championship-groups`

function authHeaders(token) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Row({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-xama-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace" }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle = {
  padding: '8px 10px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid var(--color-xama-border)',
  borderRadius: 6,
  color: 'var(--color-xama-text)',
  fontSize: 13,
  width: '100%',
  boxSizing: 'border-box',
}

function Msg({ type, text }) {
  if (!text) return null
  const styles = {
    success: { background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80' },
    error:   { background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' },
  }
  return (
    <div style={{
      ...styles[type] ?? styles.error,
      padding: '8px 12px', borderRadius: 6, fontSize: 13, marginTop: 8,
    }}>
      {text}
    </div>
  )
}

// ── Formulário de grupo ───────────────────────────────────────────────────────

function GroupForm({ token, onSaved, initial = null }) {
  const editing = !!initial
  const [form, setForm] = useState(
    initial
      ? { name: initial.name, short_name: initial.short_name, display_order: initial.display_order }
      : { name: '', short_name: '', display_order: 0 }
  )
  const [saving, setSaving] = useState(false)
  const [msg, setMsg]       = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setMsg(null)
    const url    = editing ? `${BASE}/${initial.id}` : BASE
    const method = editing ? 'PATCH' : 'POST'
    try {
      const r = await fetch(url, {
        method,
        headers: authHeaders(token),
        body: JSON.stringify({ ...form, display_order: Number(form.display_order) }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.detail ?? `HTTP ${r.status}`)
      setMsg({ type: 'success', text: editing ? 'Grupo atualizado.' : 'Grupo criado.' })
      onSaved(data)
    } catch (err) {
      setMsg({ type: 'error', text: String(err.message) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Row label="Nome completo">
        <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} required placeholder="PUBG EMEA Championship: 2026 Spring" />
      </Row>
      <Row label="Short name">
        <input style={inputStyle} value={form.short_name} onChange={e => set('short_name', e.target.value)} required placeholder="PEC" maxLength={30} />
      </Row>
      <Row label="Display order">
        <input style={{ ...inputStyle, width: 80 }} type="number" min={0} value={form.display_order} onChange={e => set('display_order', e.target.value)} />
      </Row>
      <Msg type={msg?.type} text={msg?.text} />
      <button
        type="submit"
        disabled={saving}
        style={{
          padding: '9px 20px', borderRadius: 7, cursor: saving ? 'not-allowed' : 'pointer',
          background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.4)',
          color: 'var(--color-xama-orange)', fontWeight: 700, fontSize: 13, alignSelf: 'flex-start',
        }}
      >
        {saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Criar grupo'}
      </button>
    </form>
  )
}

// ── Gerenciador de membros ────────────────────────────────────────────────────

function MemberManager({ token, group, allChampionships, onChanged }) {
  const [addId, setAddId]   = useState('')
  const [addOrder, setAddOrder] = useState(0)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg]       = useState(null)

  const memberIds = group.championship_ids ?? []
  const available = allChampionships.filter(c => !memberIds.includes(c.id))

  async function addMember() {
    if (!addId) return
    setSaving(true)
    setMsg(null)
    try {
      const r = await fetch(`${BASE}/${group.id}/members`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ championship_id: Number(addId), display_order: Number(addOrder) }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.detail ?? `HTTP ${r.status}`)
      setMsg({ type: 'success', text: 'Championship adicionado.' })
      setAddId('')
      onChanged(data)
    } catch (err) {
      setMsg({ type: 'error', text: String(err.message) })
    } finally {
      setSaving(false)
    }
  }

  async function removeMember(champId) {
    setSaving(true)
    setMsg(null)
    try {
      const r = await fetch(`${BASE}/${group.id}/members/${champId}`, {
        method: 'DELETE',
        headers: authHeaders(token),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.detail ?? `HTTP ${r.status}`)
      setMsg({ type: 'success', text: 'Championship removido.' })
      onChanged(data)
    } catch (err) {
      setMsg({ type: 'error', text: String(err.message) })
    } finally {
      setSaving(false)
    }
  }

  const memberChamps = allChampionships.filter(c => memberIds.includes(c.id))

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-xama-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace", marginBottom: 10 }}>
        Fases ({memberChamps.length})
      </div>

      {/* Lista de membros */}
      {memberChamps.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--color-xama-muted)', fontStyle: 'italic', marginBottom: 12 }}>
          Nenhum championship no grupo.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14 }}>
          {memberChamps.map(c => (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 12px',
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 7, gap: 12,
            }}>
              <div>
                <span style={{ fontSize: 13, color: 'var(--color-xama-text)', fontWeight: 500 }}>{c.name}</span>
                <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--color-xama-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                  #{c.id}
                </span>
              </div>
              <button
                onClick={() => removeMember(c.id)}
                disabled={saving}
                style={{
                  padding: '4px 10px', borderRadius: 5, cursor: 'pointer',
                  background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)',
                  color: '#f87171', fontSize: 12, fontWeight: 700, flexShrink: 0,
                }}
              >
                Remover
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Adicionar */}
      {available.length > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={addId}
            onChange={e => setAddId(e.target.value)}
            style={{ ...inputStyle, width: 'auto', flex: 1, minWidth: 200 }}
          >
            <option value="">Selecionar championship…</option>
            {available.map(c => (
              <option key={c.id} value={c.id}>{c.name} (#{c.id})</option>
            ))}
          </select>
          <input
            type="number" min={0} value={addOrder}
            onChange={e => setAddOrder(e.target.value)}
            placeholder="Ordem"
            style={{ ...inputStyle, width: 80 }}
          />
          <button
            onClick={addMember}
            disabled={saving || !addId}
            style={{
              padding: '8px 16px', borderRadius: 6, cursor: saving || !addId ? 'not-allowed' : 'pointer',
              background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)',
              color: '#4ade80', fontSize: 12, fontWeight: 700, flexShrink: 0,
            }}
          >
            + Adicionar
          </button>
        </div>
      )}

      <Msg type={msg?.type} text={msg?.text} />
    </div>
  )
}

// ── Card de grupo ─────────────────────────────────────────────────────────────

function GroupCard({ token, group: initialGroup, allChampionships, onDeactivated, onUpdated }) {
  const [group, setGroup]       = useState(initialGroup)
  const [editing, setEditing]   = useState(false)
  const [deactivating, setDeact]= useState(false)
  const [msg, setMsg]           = useState(null)

  async function deactivate() {
    if (!confirm(`Desativar o grupo "${group.name}"?`)) return
    setDeact(true)
    try {
      const r = await fetch(`${BASE}/${group.id}`, {
        method: 'DELETE',
        headers: authHeaders(token),
      })
      if (!r.ok) {
        const d = await r.json()
        throw new Error(d.detail ?? `HTTP ${r.status}`)
      }
      onDeactivated(group.id)
    } catch (err) {
      setMsg({ type: 'error', text: String(err.message) })
    } finally {
      setDeact(false)
    }
  }

  function handleUpdated(data) {
    setGroup(data)
    setEditing(false)
    onUpdated(data)
  }

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 10,
      padding: '18px 20px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-xama-text)' }}>{group.name}</div>
          <div style={{ fontSize: 11, color: 'var(--color-xama-muted)', fontFamily: "'JetBrains Mono', monospace", marginTop: 3 }}>
            {group.short_name} · id={group.id} · order={group.display_order}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button
            onClick={() => setEditing(v => !v)}
            style={{
              padding: '5px 12px', borderRadius: 5, cursor: 'pointer',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
              color: 'var(--color-xama-text)', fontSize: 12,
            }}
          >
            {editing ? 'Cancelar' : 'Editar'}
          </button>
          <button
            onClick={deactivate}
            disabled={deactivating}
            style={{
              padding: '5px 12px', borderRadius: 5, cursor: 'pointer',
              background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)',
              color: '#f87171', fontSize: 12,
            }}
          >
            Desativar
          </button>
        </div>
      </div>

      {/* Formulário de edição */}
      {editing && (
        <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <GroupForm token={token} initial={group} onSaved={handleUpdated} />
        </div>
      )}

      <Msg type={msg?.type} text={msg?.text} />

      {/* Membros */}
      <MemberManager
        token={token}
        group={group}
        allChampionships={allChampionships}
        onChanged={updated => setGroup(updated)}
      />
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function AdminChampionshipGroups({ token }) {
  const [groups, setGroups]                 = useState([])
  const [allChampionships, setAllChampionships] = useState([])
  const [loading, setLoading]               = useState(true)
  const [showCreate, setShowCreate]         = useState(false)
  const [error, setError]                   = useState('')

  async function load() {
    setLoading(true)
    try {
      const [gRes, cRes] = await Promise.all([
        fetch(`${BASE}?include_inactive=false`, { headers: authHeaders(token) }),
        fetch(`${API_BASE_URL}/admin/championships?include_inactive=true`, { headers: authHeaders(token) }),
      ])
      const [gData, cData] = await Promise.all([gRes.json(), cRes.json()])
      setGroups(Array.isArray(gData) ? gData : [])
      setAllChampionships(Array.isArray(cData) ? cData : [])
    } catch {
      setError('Erro ao carregar dados.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function handleCreated(data) {
    setGroups(gs => [data, ...gs])
    setShowCreate(false)
  }

  function handleDeactivated(id) {
    setGroups(gs => gs.filter(g => g.id !== id))
  }

  function handleUpdated(data) {
    setGroups(gs => gs.map(g => g.id === data.id ? data : g))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-xama-text)' }}>Championship Groups</div>
          <div style={{ fontSize: 12, color: 'var(--color-xama-muted)', marginTop: 2 }}>
            Agrupa championships de um mesmo torneio para rankings e stats unificadas
          </div>
        </div>
        <button
          onClick={() => setShowCreate(v => !v)}
          style={{
            padding: '9px 18px', borderRadius: 7, cursor: 'pointer',
            background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.35)',
            color: '#4ade80', fontWeight: 700, fontSize: 13,
          }}
        >
          {showCreate ? '× Cancelar' : '+ Novo grupo'}
        </button>
      </div>

      {/* Formulário de criação */}
      {showCreate && (
        <div style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10, padding: '18px 20px',
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-xama-text)', marginBottom: 14 }}>
            Novo grupo
          </div>
          <GroupForm token={token} onSaved={handleCreated} />
        </div>
      )}

      {loading && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-xama-muted)' }}>Carregando…</div>
      )}
      {error && <div className="msg-error">{error}</div>}

      {!loading && !error && groups.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-xama-muted)', fontSize: 14, fontStyle: 'italic' }}>
          Nenhum grupo criado ainda.
        </div>
      )}

      {/* Lista de grupos */}
      {groups.map(g => (
        <GroupCard
          key={g.id}
          token={token}
          group={g}
          allChampionships={allChampionships}
          onDeactivated={handleDeactivated}
          onUpdated={handleUpdated}
        />
      ))}
    </div>
  )
}
