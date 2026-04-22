// pages/admin/AdminTeams.jsx — Times: CRUD + membros + importar para stage
import { useState, useEffect, useCallback } from 'react'
import { API_BASE_URL } from '../../config'
import {
  Modal, Field, Msg, ActBtn, SaveBtn, SectionHeader, SearchBar,
  inputStyle, selectStyle, tableStyle, thStyle, tdStyle,
  useSorting, SortableHeader, TeamLogo,
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

const REGIONS = ['Americas', 'EMEA', 'Asia', 'Oceania', 'Global']
const BLANK = { name: '', tag: '', region: 'Americas', logo_path: '', is_active: true }

export default function AdminTeams({ token }) {
  const call = useCallback(api(token), [token])

  const [teams, setTeams] = useState([])
  const [stages, setStages] = useState([])
  const [persons, setPersons] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [regionFilter, setRegionFilter] = useState('')

  // Modais
  const [modal, setModal] = useState(null)    // null | {mode: 'create'|'edit', data?}
  const [detailModal, setDetailModal] = useState(null) // time selecionado para gerenciar membros

  const [form, setForm] = useState(BLANK)
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)

  // Subform membros
  const [memberSearch, setMemberSearch] = useState('')
  const [memberResults, setMemberResults] = useState([])
  const [memberMsg, setMemberMsg] = useState('')
  const [memberSaving, setMemberSaving] = useState(null) // person_id em operação

  // Import para stage
  const [importStageId, setImportStageId] = useState('')
  const [importResult, setImportResult] = useState(null)
  const [importing, setImporting] = useState(false)

  const { sort, toggle, apply } = useSorting('name')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (regionFilter) params.set('region', regionFilter)
      const data = await call('GET', `/admin/teams?${params}`)
      setTeams(Array.isArray(data) ? data : [])
    } catch { setTeams([]) }
    finally { setLoading(false) }
  }, [call, search, regionFilter])

  const loadStages = useCallback(async () => {
    try {
      const data = await call('GET', '/admin/stages')
      setStages(Array.isArray(data) ? data.filter(s => s.lineup_status !== 'locked').sort((a, b) => b.id - a.id) : [])
    } catch {}
  }, [call])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadStages() }, [loadStages])

  // Busca persons para adicionar como membro
  useEffect(() => {
    if (!memberSearch.trim() || !detailModal) { setMemberResults([]); return }
    const timer = setTimeout(async () => {
      try {
        const data = await call('GET', `/admin/persons?search=${encodeURIComponent(memberSearch)}&include_inactive=false`)
        setMemberResults(Array.isArray(data) ? data.slice(0, 10) : [])
      } catch { setMemberResults([]) }
    }, 300)
    return () => clearTimeout(timer)
  }, [memberSearch, detailModal, call])

  const openCreate = () => { setForm(BLANK); setMsg(''); setModal({ mode: 'create' }) }
  const openEdit = (t) => {
    setForm({ name: t.name, tag: t.tag, region: t.region, logo_path: t.logo_path || '', is_active: t.is_active })
    setMsg(''); setModal({ mode: 'edit', data: t })
  }

  const openDetail = async (t) => {
    setMemberMsg(''); setMemberSearch(''); setMemberResults([])
    setImportResult(null); setImportStageId('')
    const fresh = await call('GET', `/admin/teams/${t.id}`)
    setDetailModal(fresh)
  }

  const handleSave = async () => {
    setSaving(true); setMsg('')
    try {
      const body = { ...form, logo_path: form.logo_path || null }
      if (modal.mode === 'create') {
        await call('POST', '/admin/teams', body)
        setMsg('Time criado.')
        setModal(null)
      } else {
        await call('PATCH', `/admin/teams/${modal.data.id}`, body)
        setMsg('Time atualizado.')
      }
      await load()
    } catch (e) { setMsg('!' + e.message) }
    finally { setSaving(false) }
  }

  const handleAddMember = async (person) => {
    setMemberSaving(person.id)
    setMemberMsg('')
    try {
      const updated = await call('POST', `/admin/teams/${detailModal.id}/members`, { person_id: person.id })
      setDetailModal(updated)
      setMemberSearch(''); setMemberResults([])
      setMemberMsg(`${person.display_name} adicionado ao time.`)
      await load()
    } catch (e) { setMemberMsg('!' + e.message) }
    finally { setMemberSaving(null) }
  }

  const handleRemoveMember = async (personId, personName) => {
    if (!confirm(`Remover ${personName} do time?`)) return
    setMemberSaving(personId)
    setMemberMsg('')
    try {
      const updated = await call('DELETE', `/admin/teams/${detailModal.id}/members/${personId}`)
      setDetailModal(updated)
      setMemberMsg(`${personName} removido.`)
      await load()
    } catch (e) { setMemberMsg('!' + e.message) }
    finally { setMemberSaving(null) }
  }

  const handleImport = async () => {
    if (!importStageId) { setImportResult({ error: 'Selecione uma stage.' }); return }
    setImporting(true); setImportResult(null)
    try {
      const result = await call('POST', `/admin/stages/${importStageId}/roster/import-team`, { team_id: detailModal.id })
      setImportResult(result)
    } catch (e) { setImportResult({ error: e.message }) }
    finally { setImporting(false) }
  }

  const f = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }))

  return (
    <div>
      <SectionHeader
        title="Times"
        action={<ActBtn onClick={openCreate}>+ Novo Time</ActBtn>}
      />

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Buscar por nome ou tag..." />
        <select style={{ ...selectStyle, minWidth: 160 }} value={regionFilter} onChange={e => setRegionFilter(e.target.value)}>
          <option value="">Todas as regiões</option>
          {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      <div style={{ background: 'rgba(18,21,28,0.9)', border: '1px solid var(--color-xama-border)', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-xama-muted)' }}>Carregando...</div>
        ) : teams.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-xama-muted)' }}>Nenhum time encontrado.</div>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <SortableHeader label="Tag" col="tag" sort={sort} onSort={toggle} />
                <th style={thStyle}>Logo</th>
                <SortableHeader label="Nome" col="name" sort={sort} onSort={toggle} />
                <SortableHeader label="Região" col="region" sort={sort} onSort={toggle} />
                <SortableHeader label="Membros" col="members" sort={sort} onSort={toggle} />
                <SortableHeader label="Status" col="status" sort={sort} onSort={toggle} />
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {apply(teams, {
                tag: t => t.tag,
                name: t => t.name,
                region: t => t.region,
                members: t => t.active_member_count,
                status: t => t.is_active ? 0 : 1,
              }).map(t => (
                <tr key={t.id} style={{ opacity: t.is_active ? 1 : 0.5 }}>
                  <td style={{ ...tdStyle, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 13 }}>{t.tag}</td>
                  <td style={{ ...tdStyle, padding: '6px 14px' }}>
                    <TeamLogo tag={t.tag} region={t.region} size={26} />
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{t.name}</td>
                  <td style={{ ...tdStyle, color: 'var(--color-xama-muted)', fontSize: 12 }}>{t.region}</td>
                  <td style={{ ...tdStyle, color: 'var(--color-xama-muted)' }}>{t.active_member_count} jogador{t.active_member_count !== 1 ? 'es' : ''}</td>
                  <td style={tdStyle}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4,
                      fontFamily: 'JetBrains Mono, monospace',
                      background: t.is_active ? 'rgba(74,222,128,0.1)' : 'rgba(107,114,128,0.1)',
                      border: t.is_active ? '1px solid rgba(74,222,128,0.3)' : '1px solid rgba(107,114,128,0.3)',
                      color: t.is_active ? 'var(--color-xama-green)' : 'var(--color-xama-muted)',
                    }}>
                      {t.is_active ? 'ATIVO' : 'INATIVO'}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <ActBtn small onClick={() => openDetail(t)}>Gerenciar</ActBtn>
                      <ActBtn small onClick={() => openEdit(t)}>Editar</ActBtn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal criar/editar time */}
      {modal && (
        <Modal
          title={modal.mode === 'create' ? 'Novo Time' : `Editar — ${modal.data?.name}`}
          onClose={() => setModal(null)}
        >
          <Msg msg={msg} />
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <Field label="Nome do time">
              <input style={inputStyle} value={form.name} onChange={f('name')} placeholder="ex: LOUD" />
            </Field>
            <Field label="Tag (sigla)">
              <input style={inputStyle} value={form.tag} onChange={f('tag')} placeholder="ex: LOUD" maxLength={10} />
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Região">
              <select style={selectStyle} value={form.region} onChange={f('region')}>
                {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Logo (arquivo local)" hint="ex: LOUD.png — deve estar em /logos/Teams/">
              <input style={inputStyle} value={form.logo_path} onChange={f('logo_path')} placeholder="LOUD.png" />
            </Field>
          </div>
          {modal.mode === 'edit' && (
            <Field label="Status">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--color-xama-text)' }}>
                <input type="checkbox" checked={!!form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />
                Ativo
              </label>
            </Field>
          )}
          <SaveBtn loading={saving} onClick={handleSave} label={modal.mode === 'create' ? 'Criar Time' : 'Salvar'} />
        </Modal>
      )}

      {/* Modal gerenciar membros */}
      {detailModal && (
        <Modal
          title={`${detailModal.tag} — ${detailModal.name}`}
          onClose={() => setDetailModal(null)}
          width={600}
        >
          {/* Membros atuais */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-xama-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Membros ativos ({detailModal.active_members?.length ?? 0})
            </div>
            <Msg msg={memberMsg} />
            {detailModal.active_members?.length === 0 ? (
              <div style={{ color: 'var(--color-xama-muted)', fontSize: 13 }}>Nenhum membro ativo.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {detailModal.active_members.map(m => (
                  <div key={m.person_id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '9px 14px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                  }}>
                    <div>
                      <span style={{ fontWeight: 600, color: 'var(--color-xama-text)' }}>{m.person_name}</span>
                      <span style={{ fontSize: 11, color: 'var(--color-xama-muted)', marginLeft: 8 }}>
                        desde {new Date(m.joined_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <ActBtn
                      small danger
                      onClick={() => handleRemoveMember(m.person_id, m.person_name)}
                      disabled={memberSaving === m.person_id}
                    >
                      {memberSaving === m.person_id ? '...' : 'Remover'}
                    </ActBtn>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Adicionar membro */}
          <div style={{ paddingTop: 16, borderTop: '1px solid var(--color-xama-border)', marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-xama-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Adicionar Jogador
            </div>
            <input
              style={inputStyle}
              value={memberSearch}
              onChange={e => setMemberSearch(e.target.value)}
              placeholder="Digite o nome do jogador para buscar..."
            />
            {memberResults.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {memberResults.map(p => {
                  const alreadyMember = detailModal.active_members?.some(m => m.person_id === p.id)
                  return (
                    <div key={p.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 12px', borderRadius: 8,
                      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                    }}>
                      <span style={{ fontSize: 13, color: alreadyMember ? 'var(--color-xama-muted)' : 'var(--color-xama-text)' }}>
                        {p.display_name}
                        {alreadyMember && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--color-xama-muted)' }}>já é membro</span>}
                      </span>
                      {!alreadyMember && (
                        <ActBtn small onClick={() => handleAddMember(p)} disabled={memberSaving === p.id}>
                          {memberSaving === p.id ? '...' : '+ Add'}
                        </ActBtn>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Importar para stage */}
          <div style={{ paddingTop: 16, borderTop: '1px solid var(--color-xama-border)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-xama-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Importar para Roster de Stage
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <select style={selectStyle} value={importStageId} onChange={e => { setImportStageId(e.target.value); setImportResult(null) }}>
                  <option value="">Selecione a stage...</option>
                  {stages.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <ActBtn onClick={handleImport} disabled={importing || !importStageId}>
                {importing ? 'Importando...' : 'Importar Time'}
              </ActBtn>
            </div>

            {/* Resultado do import */}
            {importResult && (
              <div style={{ fontSize: 13 }}>
                {importResult.error ? (
                  <div style={{ color: '#f87171', padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
                    {importResult.error}
                  </div>
                ) : (
                  <div>
                    {importResult.added?.length > 0 && (
                      <div style={{ marginBottom: 8, padding: '10px 14px', borderRadius: 8, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)' }}>
                        <div style={{ fontWeight: 700, color: 'var(--color-xama-green)', marginBottom: 4 }}>
                          {importResult.added.length} adicionado{importResult.added.length !== 1 ? 's' : ''}
                        </div>
                        {importResult.added.map(p => <div key={p.person_id} style={{ color: 'var(--color-xama-text)' }}>• {p.person_name}</div>)}
                      </div>
                    )}
                    {importResult.skipped?.length > 0 && (
                      <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)' }}>
                        <div style={{ fontWeight: 700, color: 'var(--color-xama-orange)', marginBottom: 4 }}>
                          {importResult.skipped.length} pulado{importResult.skipped.length !== 1 ? 's' : ''}
                        </div>
                        {importResult.skipped.map(p => (
                          <div key={p.person_id} style={{ color: 'var(--color-xama-muted)', fontSize: 12 }}>
                            • {p.person_name} — {p.reason}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
