// pages/admin/AdminFaceoffs.jsx
import { useState, useEffect, useCallback } from 'react'
import { API_BASE_URL } from '../../config'
import { Modal, Field, Msg, ActBtn, SaveBtn, SectionHeader, inputStyle, selectStyle, tableStyle, thStyle, tdStyle } from './Modal'

const api = (token) => async (method, path, body) => {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body != null ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    const detail = Array.isArray(e.detail)
      ? e.detail.map(d => d.msg || JSON.stringify(d)).join('; ')
      : (e.detail || `HTTP ${res.status}`)
    throw new Error(detail)
  }
  return res.status === 204 ? null : res.json()
}

const STATUS_LABEL = { draft: 'DRAFT', open: 'ABERTO', closed: 'FECHADO', resolved: 'RESOLVIDO' }
const STATUS_COLOR = {
  draft:    'var(--color-xama-muted)',
  open:     'var(--color-xama-green)',
  closed:   'var(--color-xama-orange)',
  resolved: '#a5b4fc',
}
const NEXT_STATUS = { draft: 'open', open: 'closed', closed: null }

export default function AdminFaceoffs({ token }) {
  const call = useCallback(api(token), [token])

  const [championships, setChampionships] = useState([])
  const [champId, setChampId]             = useState('')
  const [faceoffs, setFaceoffs]           = useState([])
  const [suggested, setSuggested]         = useState([])
  const [sourceIds, setSourceIds]         = useState('')
  const [loading, setLoading]             = useState(false)
  const [suggesting, setSuggesting]       = useState(false)
  const [msg, setMsg]                     = useState('')
  const [editModal, setEditModal]         = useState(null)  // faceoff sendo editado
  const [editForm, setEditForm]           = useState({})
  const [saving, setSaving]               = useState(false)

  // Carrega championships
  useEffect(() => {
    call('GET', '/admin/championships?include_inactive=true')
      .then(d => setChampionships(Array.isArray(d) ? d.sort((a, b) => b.id - a.id) : []))
      .catch(() => {})
  }, [call])

  const loadFaceoffs = useCallback(async () => {
    if (!champId) return
    setLoading(true)
    try {
      const data = await call('GET', `/admin/faceoffs?championship_id=${champId}`)
      setFaceoffs(Array.isArray(data) ? data : [])
    } catch (e) { setMsg('!' + e.message) }
    finally { setLoading(false) }
  }, [call, champId])

  useEffect(() => { loadFaceoffs(); setSuggested([]) }, [loadFaceoffs])

  // Sugerir chaves
  const handleSuggest = async () => {
    if (!champId) return
    setSuggesting(true); setMsg(''); setSuggested([])
    try {
      const params = sourceIds.trim()
        ? `&source_stage_ids=${encodeURIComponent(sourceIds.trim())}`
        : ''
      const data = await call('GET', `/admin/faceoffs/suggest?championship_id=${champId}${params}`)
      setSuggested(Array.isArray(data) ? data : [])
    } catch (e) { setMsg('!' + e.message) }
    finally { setSuggesting(false) }
  }

  // Criar faceoffs a partir das sugestões
  const handleBulkCreate = async () => {
    if (!suggested.length) return
    setSaving(true); setMsg('')
    try {
      await call('POST', '/admin/faceoffs/bulk', {
        championship_id: parseInt(champId),
        pairs: suggested.map(p => ({
          team_a_name: p.team_a_name,
          team_b_name: p.team_b_name,
          seed_a: p.seed_a,
          seed_b: p.seed_b,
        })),
      })
      setSuggested([])
      setMsg('8 faceoffs criados em draft.')
      await loadFaceoffs()
    } catch (e) { setMsg('!' + e.message) }
    finally { setSaving(false) }
  }

  // Avançar status
  const handleAdvanceStatus = async (f) => {
    const next = NEXT_STATUS[f.status]
    if (!next) return
    try {
      await call('PATCH', `/admin/faceoffs/${f.id}`, { status: next })
      await loadFaceoffs()
    } catch (e) { setMsg('!' + e.message) }
  }

  // Resolver
  const handleResolve = async (f) => {
    if (!confirm(`Resolver faceoff ${f.team_a_name} vs ${f.team_b_name}?\nIsso calcula o vencedor pelo standing do campeonato.`)) return
    try {
      const res = await call('POST', `/admin/faceoffs/${f.id}/resolve`)
      setMsg(`Resolvido: vencedor = ${res.winner_team_name || 'empate'}`)
      await loadFaceoffs()
    } catch (e) { setMsg('!' + e.message) }
  }

  // Deletar draft
  const handleDelete = async (f) => {
    if (!confirm(`Deletar faceoff ${f.team_a_name} vs ${f.team_b_name}?`)) return
    try {
      await call('DELETE', `/admin/faceoffs/${f.id}`)
      await loadFaceoffs()
    } catch (e) { setMsg('!' + e.message) }
  }

  // Editar
  const openEdit = (f) => {
    setEditForm({ team_a_name: f.team_a_name, team_b_name: f.team_b_name })
    setEditModal(f)
  }
  const handleSaveEdit = async () => {
    setSaving(true); setMsg('')
    try {
      await call('PATCH', `/admin/faceoffs/${editModal.id}`, editForm)
      setEditModal(null)
      await loadFaceoffs()
    } catch (e) { setMsg('!' + e.message) }
    finally { setSaving(false) }
  }

  const champName = (id) => championships.find(c => c.id === parseInt(id))?.short_name || id

  return (
    <div>
      <SectionHeader title="Team Faceoff" />

      {/* Seletor de campeonato */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <select
          style={{ ...selectStyle, minWidth: 260 }}
          value={champId}
          onChange={e => setChampId(e.target.value)}
        >
          <option value="">Selecione um campeonato...</option>
          {championships.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {msg && (
        <div style={{
          marginBottom: 14, padding: '8px 14px', borderRadius: 8, fontSize: 13,
          background: msg.startsWith('!') ? 'rgba(239,68,68,0.1)' : 'rgba(74,222,128,0.1)',
          color: msg.startsWith('!') ? '#f87171' : 'var(--color-xama-green)',
          border: `1px solid ${msg.startsWith('!') ? 'rgba(239,68,68,0.3)' : 'rgba(74,222,128,0.3)'}`,
        }}>
          {msg.startsWith('!') ? msg.slice(1) : msg}
        </div>
      )}

      {/* Painel de sugestão */}
      {champId && (
        <div style={{
          marginBottom: 24, padding: '16px 20px',
          background: 'rgba(99,102,241,0.05)',
          border: '1px solid rgba(99,102,241,0.2)',
          borderRadius: 12,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-xama-text)', marginBottom: 12 }}>
            Sugerir Chaves por Performance
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 14 }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--color-xama-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Stages de origem para medir performance (IDs separados por vírgula)
              </label>
              <input
                style={{ ...inputStyle, width: '100%' }}
                placeholder="ex: 30,31,32 (playoffs anteriores) — vazio = usa stages do próprio campeonato"
                value={sourceIds}
                onChange={e => setSourceIds(e.target.value)}
              />
            </div>
            <ActBtn onClick={handleSuggest} disabled={suggesting}>
              {suggesting ? 'Calculando...' : '⚡ Sugerir Chaves'}
            </ActBtn>
          </div>

          {/* Sugestões */}
          {suggested.length > 0 && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8, marginBottom: 14 }}>
                {suggested.map((p, i) => (
                  <div key={i} style={{
                    padding: '10px 14px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    fontSize: 13,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: '#f97316', fontWeight: 700 }}>#{p.seed_a} {p.team_a_name}</span>
                      <span style={{ color: 'var(--color-xama-muted)', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
                        {p.pts_per_match_a?.toFixed(1)} pts/g
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-xama-muted)', textAlign: 'center', margin: '2px 0' }}>vs</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#6366f1', fontWeight: 700 }}>#{p.seed_b} {p.team_b_name}</span>
                      <span style={{ color: 'var(--color-xama-muted)', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
                        {p.pts_per_match_b?.toFixed(1)} pts/g
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <ActBtn onClick={handleBulkCreate} disabled={saving}>
                {saving ? 'Criando...' : `Criar ${suggested.length} Faceoffs (Draft)`}
              </ActBtn>
            </>
          )}
        </div>
      )}

      {/* Lista de faceoffs existentes */}
      {champId && (
        <div style={{ background: 'rgba(18,21,28,0.9)', border: '1px solid var(--color-xama-border)', borderRadius: 12, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-xama-muted)' }}>Carregando...</div>
          ) : faceoffs.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-xama-muted)' }}>
              Nenhum faceoff criado para este campeonato.
            </div>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Seeds</th>
                  <th style={thStyle}>Time A</th>
                  <th style={thStyle}>Time B</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Votos A / B</th>
                  <th style={thStyle}>Vencedor</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {faceoffs.map(f => (
                  <tr key={f.id}>
                    <td style={{ ...tdStyle, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--color-xama-muted)' }}>
                      #{f.seed_a} / #{f.seed_b}
                    </td>
                    <td style={{ ...tdStyle, color: '#f97316', fontWeight: 600 }}>{f.team_a_name}</td>
                    <td style={{ ...tdStyle, color: '#6366f1', fontWeight: 600 }}>{f.team_b_name}</td>
                    <td style={tdStyle}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                        color: STATUS_COLOR[f.status],
                        border: `1px solid ${STATUS_COLOR[f.status]}44`,
                        background: `${STATUS_COLOR[f.status]}11`,
                      }}>
                        {STATUS_LABEL[f.status] || f.status}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                      {f.votes_a} / {f.votes_b}
                      <span style={{ color: 'var(--color-xama-muted)', fontSize: 11, marginLeft: 6 }}>({f.total_votes})</span>
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--color-xama-green)' }}>
                      {f.winner_team_name || '—'}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {/* Avançar status */}
                        {NEXT_STATUS[f.status] && (
                          <ActBtn small onClick={() => handleAdvanceStatus(f)}>
                            → {STATUS_LABEL[NEXT_STATUS[f.status]]}
                          </ActBtn>
                        )}
                        {/* Resolver */}
                        {(f.status === 'closed' || f.status === 'open') && (
                          <ActBtn small onClick={() => handleResolve(f)}>
                            Resolver
                          </ActBtn>
                        )}
                        {/* Editar (só draft) */}
                        {f.status === 'draft' && (
                          <ActBtn small onClick={() => openEdit(f)}>Editar</ActBtn>
                        )}
                        {/* Deletar (só draft) */}
                        {f.status === 'draft' && (
                          <ActBtn small onClick={() => handleDelete(f)} style={{ color: '#f87171', borderColor: 'rgba(239,68,68,0.35)' }}>
                            ✕
                          </ActBtn>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modal de edição */}
      {editModal && (
        <Modal title={`Editar Faceoff #${editModal.id}`} onClose={() => setEditModal(null)} width={420}>
          <Msg msg={msg} />
          <Field label="Time A">
            <input
              style={inputStyle}
              value={editForm.team_a_name}
              onChange={e => setEditForm(f => ({ ...f, team_a_name: e.target.value }))}
            />
          </Field>
          <Field label="Time B">
            <input
              style={inputStyle}
              value={editForm.team_b_name}
              onChange={e => setEditForm(f => ({ ...f, team_b_name: e.target.value }))}
            />
          </Field>
          <SaveBtn loading={saving} onClick={handleSaveEdit} label="Salvar" />
        </Modal>
      )}
    </div>
  )
}
