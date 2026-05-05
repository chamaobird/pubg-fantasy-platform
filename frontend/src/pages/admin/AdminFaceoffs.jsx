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
// Transições possíveis (espelha o backend)
const NEXT_STATUS = { draft: 'open', open: 'closed', closed: null }
const PREV_STATUS = { open: 'draft', closed: 'open', resolved: 'closed' }

export default function AdminFaceoffs({ token }) {
  const call = useCallback(api(token), [token])

  const [championships, setChampionships]   = useState([])
  const [champId, setChampId]               = useState('')
  const [selectedChamp, setSelectedChamp]   = useState(null)
  const [faceoffs, setFaceoffs]             = useState([])
  const [suggested, setSuggested]           = useState([])
  const [availableStages, setAvailableStages] = useState([])
  const [selectedSourceIds, setSelectedSourceIds] = useState(new Set())
  const [loadingStages, setLoadingStages]   = useState(false)
  const [loading, setLoading]               = useState(false)
  const [suggesting, setSuggesting]         = useState(false)
  const [msg, setMsg]                       = useState('')
  const [editModal, setEditModal]           = useState(null)
  const [editForm, setEditForm]             = useState({})
  const [saving, setSaving]                 = useState(false)

  useEffect(() => {
    call('GET', '/admin/championships?include_inactive=true')
      .then(d => setChampionships(Array.isArray(d) ? d.sort((a, b) => b.id - a.id) : []))
      .catch(() => {})
  }, [call])

  useEffect(() => {
    if (!champId) return
    const champ = championships.find(c => c.id === parseInt(champId))
    setSelectedChamp(champ || null)
    setSuggested([])
    setSelectedSourceIds(new Set())
    loadFaceoffs()
    loadAvailableStages(champ)
  }, [champId, championships])

  const loadFaceoffs = useCallback(async () => {
    if (!champId) return
    setLoading(true)
    try {
      const data = await call('GET', `/admin/faceoffs?championship_id=${champId}`)
      setFaceoffs(Array.isArray(data) ? data : [])
    } catch (e) { setMsg('!' + e.message) }
    finally { setLoading(false) }
  }, [call, champId])

  const loadAvailableStages = async (champ) => {
    setLoadingStages(true)
    try {
      const allStages = await call('GET', '/admin/stages')
      if (!Array.isArray(allStages)) return
      const shard = champ?.shard
      const relevant = allStages
        .filter(s =>
          (!shard || s.shard === shard) &&
          (s.stage_phase === 'finished' || s.stage_phase === 'live')
        )
        .sort((a, b) => b.id - a.id)
        .slice(0, 20)
      const grouped = {}
      for (const s of relevant) {
        const key = s.championship_name || s.championship_id || 'Outro'
        if (!grouped[key]) grouped[key] = []
        grouped[key].push(s)
      }
      setAvailableStages(grouped)
    } catch {
      setAvailableStages({})
    } finally {
      setLoadingStages(false)
    }
  }

  const toggleSourceId = (id) => {
    setSelectedSourceIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllGroup = (stages) => {
    setSelectedSourceIds(prev => {
      const next = new Set(prev)
      stages.forEach(s => next.add(s.id))
      return next
    })
  }

  const handleSuggest = async () => {
    if (!champId) return
    if (selectedSourceIds.size === 0) { setMsg('!Selecione ao menos uma stage de referência.'); return }
    setSuggesting(true); setMsg(''); setSuggested([])
    try {
      const ids = [...selectedSourceIds].join(',')
      const data = await call('GET', `/admin/faceoffs/suggest?championship_id=${champId}&source_stage_ids=${ids}`)
      setSuggested(Array.isArray(data) ? data : [])
    } catch (e) { setMsg('!' + e.message) }
    finally { setSuggesting(false) }
  }

  const handleBulkCreate = async () => {
    if (!suggested.length) return
    setSaving(true); setMsg('')
    try {
      await call('POST', '/admin/faceoffs/bulk', {
        championship_id: parseInt(champId),
        pairs: suggested.map(p => ({
          team_a_name: p.team_a_name, team_b_name: p.team_b_name,
          seed_a: p.seed_a, seed_b: p.seed_b,
        })),
      })
      setSuggested([])
      setMsg(`${suggested.length} faceoffs criados em draft.`)
      await loadFaceoffs()
    } catch (e) { setMsg('!' + e.message) }
    finally { setSaving(false) }
  }

  // Avançar status (→)
  const handleAdvanceStatus = async (f) => {
    const next = NEXT_STATUS[f.status]
    if (!next) return
    try {
      await call('PATCH', `/admin/faceoffs/${f.id}`, { status: next })
      await loadFaceoffs()
    } catch (e) { setMsg('!' + e.message) }
  }

  // Reverter status (←)
  const handleRevertStatus = async (f) => {
    const prev = PREV_STATUS[f.status]
    if (!prev) return
    if (!confirm(`Reverter "${f.team_a_name} vs ${f.team_b_name}" de ${STATUS_LABEL[f.status]} → ${STATUS_LABEL[prev]}?`)) return
    try {
      await call('PATCH', `/admin/faceoffs/${f.id}`, { status: prev })
      await loadFaceoffs()
      setMsg(`Revertido para ${STATUS_LABEL[prev]}`)
    } catch (e) { setMsg('!' + e.message) }
  }

  // Resolver automaticamente pelo standing
  const handleResolve = async (f) => {
    if (!confirm(`Resolver automaticamente "${f.team_a_name} vs ${f.team_b_name}" pelo standing do campeonato?`)) return
    try {
      const res = await call('POST', `/admin/faceoffs/${f.id}/resolve`)
      setMsg(`Resolvido: vencedor = ${res.winner_team_name || 'empate'}`)
      await loadFaceoffs()
    } catch (e) { setMsg('!' + e.message) }
  }

  // Deletar (só draft)
  const handleDelete = async (f) => {
    if (!confirm(`Deletar "${f.team_a_name} vs ${f.team_b_name}"?`)) return
    try {
      await call('DELETE', `/admin/faceoffs/${f.id}`)
      await loadFaceoffs()
    } catch (e) { setMsg('!' + e.message) }
  }

  // Editar — abre modal com todos os campos
  const openEdit = (f) => {
    setEditForm({
      team_a_name: f.team_a_name,
      team_b_name: f.team_b_name,
      seed_a: f.seed_a ?? '',
      seed_b: f.seed_b ?? '',
      winner_team_name: f.winner_team_name ?? '',
    })
    setEditModal(f)
  }

  const handleSaveEdit = async () => {
    setSaving(true); setMsg('')
    try {
      const payload = {
        team_a_name: editForm.team_a_name,
        team_b_name: editForm.team_b_name,
        seed_a: editForm.seed_a !== '' ? parseInt(editForm.seed_a) : null,
        seed_b: editForm.seed_b !== '' ? parseInt(editForm.seed_b) : null,
      }
      // winner só incluído se resolved
      if (editModal.status === 'resolved') {
        payload.winner_team_name = editForm.winner_team_name || null
      }
      await call('PATCH', `/admin/faceoffs/${editModal.id}`, payload)
      setEditModal(null)
      await loadFaceoffs()
    } catch (e) { setMsg('!' + e.message) }
    finally { setSaving(false) }
  }

  const groupKeys = Object.keys(availableStages)

  return (
    <div>
      <SectionHeader title="Team Faceoff" />

      {/* Seletor de campeonato */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-xama-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Campeonato das Finals (alvo)
        </label>
        <select
          style={{ ...selectStyle, minWidth: 320 }}
          value={champId}
          onChange={e => { setChampId(e.target.value); setMsg('') }}
        >
          <option value="">Selecione o campeonato das Finals...</option>
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
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-xama-text)', marginBottom: 4 }}>
            Sugerir Chaves por Performance
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-xama-muted)', marginBottom: 16, lineHeight: 1.5 }}>
            Selecione as stages anteriores (playoffs, regular season) como base de performance.
            O sistema ranqueia os times por pontos XAMA/partida e cria os pares{' '}
            <strong style={{ color: 'var(--color-xama-text)' }}>#1 vs #2, #3 vs #4...</strong>
          </div>

          {loadingStages ? (
            <div style={{ fontSize: 12, color: 'var(--color-xama-muted)', marginBottom: 14 }}>Carregando stages...</div>
          ) : groupKeys.length === 0 ? (
            <div style={{ fontSize: 12, color: '#f87171', marginBottom: 14 }}>
              Nenhuma stage com partidas encontrada para o shard <strong>{selectedChamp?.shard}</strong>.
            </div>
          ) : (
            <div style={{ marginBottom: 16 }}>
              {groupKeys.map(groupName => {
                const stages = availableStages[groupName]
                const allSelected = stages.every(s => selectedSourceIds.has(s.id))
                return (
                  <div key={groupName} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-xama-orange)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                        {groupName}
                      </span>
                      {!allSelected && (
                        <button onClick={() => selectAllGroup(stages)} style={{ fontSize: 10, color: 'var(--color-xama-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                          selecionar todos
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {stages.map(s => {
                        const checked = selectedSourceIds.has(s.id)
                        return (
                          <label key={s.id} style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '5px 10px', borderRadius: 6, cursor: 'pointer',
                            border: `1px solid ${checked ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.08)'}`,
                            background: checked ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.02)',
                            fontSize: 12, transition: 'all 0.12s', userSelect: 'none',
                          }}>
                            <input type="checkbox" checked={checked} onChange={() => toggleSourceId(s.id)} style={{ accentColor: '#6366f1', width: 13, height: 13 }} />
                            <span style={{ color: checked ? '#a5b4fc' : 'var(--color-xama-text)' }}>{s.name}</span>
                            <span style={{ fontSize: 10, color: 'var(--color-xama-muted)', fontFamily: "'JetBrains Mono', monospace" }}>#{s.id}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ActBtn onClick={handleSuggest} disabled={suggesting || selectedSourceIds.size === 0}>
              {suggesting ? 'Calculando...' : `⚡ Sugerir Chaves${selectedSourceIds.size > 0 ? ` (${selectedSourceIds.size} stages)` : ''}`}
            </ActBtn>
            {selectedSourceIds.size > 0 && (
              <span style={{ fontSize: 11, color: 'var(--color-xama-muted)' }}>
                Stages: {[...selectedSourceIds].sort((a, b) => a - b).join(', ')}
              </span>
            )}
          </div>

          {suggested.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-xama-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Pares sugeridos — revise e ajuste se necessário
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8, marginBottom: 14 }}>
                {suggested.map((p, i) => (
                  <div key={i} style={{
                    padding: '10px 14px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', fontSize: 13,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: '#f97316', fontWeight: 700 }}>#{p.seed_a} {p.team_a_name}</span>
                      <span style={{ color: 'var(--color-xama-muted)', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>{p.pts_per_match_a?.toFixed(1)} pts/g</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-xama-muted)', textAlign: 'center', margin: '2px 0' }}>vs</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#6366f1', fontWeight: 700 }}>#{p.seed_b} {p.team_b_name}</span>
                      <span style={{ color: 'var(--color-xama-muted)', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>{p.pts_per_match_b?.toFixed(1)} pts/g</span>
                    </div>
                  </div>
                ))}
              </div>
              <ActBtn onClick={handleBulkCreate} disabled={saving}>
                {saving ? 'Criando...' : `Criar ${suggested.length} Faceoffs (Draft)`}
              </ActBtn>
            </div>
          )}
        </div>
      )}

      {/* Lista de faceoffs */}
      {champId && (
        <div style={{ background: 'rgba(18,21,28,0.9)', border: '1px solid var(--color-xama-border)', borderRadius: 12, overflow: 'hidden' }}>
          {/* Legenda de controles */}
          <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--color-xama-border)', display: 'flex', gap: 16, fontSize: 11, color: 'var(--color-xama-muted)' }}>
            <span><strong style={{ color: 'var(--color-xama-text)' }}>→</strong> Avança status</span>
            <span><strong style={{ color: '#a5b4fc' }}>←</strong> Reverte status</span>
            <span><strong style={{ color: 'var(--color-xama-green)' }}>⚡</strong> Resolve pelo standing</span>
            <span><strong style={{ color: 'var(--color-xama-text)' }}>✏</strong> Edita nomes/seeds/winner</span>
          </div>
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
                  <th style={thStyle}>Time A (🟠)</th>
                  <th style={thStyle}>Time B (🟣)</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Votos A / B</th>
                  <th style={thStyle}>Vencedor</th>
                  <th style={thStyle} colSpan={2}>Ações</th>
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
                    {/* Ações de avanço */}
                    <td style={{ ...tdStyle }}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {/* Reverter */}
                        {PREV_STATUS[f.status] && (
                          <button
                            onClick={() => handleRevertStatus(f)}
                            title={`Reverter para ${STATUS_LABEL[PREV_STATUS[f.status]]}`}
                            style={{
                              fontSize: 11, padding: '3px 8px', borderRadius: 6, cursor: 'pointer',
                              background: 'rgba(165,180,252,0.08)', border: '1px solid rgba(165,180,252,0.3)',
                              color: '#a5b4fc', fontWeight: 700,
                            }}
                          >
                            ← {STATUS_LABEL[PREV_STATUS[f.status]]}
                          </button>
                        )}
                        {/* Avançar */}
                        {NEXT_STATUS[f.status] && (
                          <button
                            onClick={() => handleAdvanceStatus(f)}
                            title={`Avançar para ${STATUS_LABEL[NEXT_STATUS[f.status]]}`}
                            style={{
                              fontSize: 11, padding: '3px 8px', borderRadius: 6, cursor: 'pointer',
                              background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.3)',
                              color: 'var(--color-xama-orange)', fontWeight: 700,
                            }}
                          >
                            → {STATUS_LABEL[NEXT_STATUS[f.status]]}
                          </button>
                        )}
                        {/* Resolver automaticamente */}
                        {f.status === 'closed' && (
                          <button
                            onClick={() => handleResolve(f)}
                            title="Resolver pelo standing do campeonato"
                            style={{
                              fontSize: 11, padding: '3px 8px', borderRadius: 6, cursor: 'pointer',
                              background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.3)',
                              color: 'var(--color-xama-green)', fontWeight: 700,
                            }}
                          >
                            ⚡ Resolver
                          </button>
                        )}
                      </div>
                    </td>
                    {/* Editar / Deletar */}
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => openEdit(f)}
                          title="Editar"
                          style={{
                            fontSize: 11, padding: '3px 8px', borderRadius: 6, cursor: 'pointer',
                            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)',
                            color: 'var(--color-xama-text)', fontWeight: 700,
                          }}
                        >
                          ✏
                        </button>
                        {f.status === 'draft' && (
                          <button
                            onClick={() => handleDelete(f)}
                            title="Deletar"
                            style={{
                              fontSize: 11, padding: '3px 8px', borderRadius: 6, cursor: 'pointer',
                              background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.3)',
                              color: '#f87171', fontWeight: 700,
                            }}
                          >
                            ✕
                          </button>
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
        <Modal title={`Editar Faceoff #${editModal.id}`} onClose={() => setEditModal(null)} width={440}>
          <Msg msg={msg} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Seed A">
              <input style={inputStyle} type="number" value={editForm.seed_a}
                onChange={e => setEditForm(f => ({ ...f, seed_a: e.target.value }))} />
            </Field>
            <Field label="Seed B">
              <input style={inputStyle} type="number" value={editForm.seed_b}
                onChange={e => setEditForm(f => ({ ...f, seed_b: e.target.value }))} />
            </Field>
          </div>
          <Field label="Time A (laranja)">
            <input style={inputStyle} value={editForm.team_a_name}
              onChange={e => setEditForm(f => ({ ...f, team_a_name: e.target.value }))} />
          </Field>
          <Field label="Time B (roxo)">
            <input style={inputStyle} value={editForm.team_b_name}
              onChange={e => setEditForm(f => ({ ...f, team_b_name: e.target.value }))} />
          </Field>
          {editModal.status === 'resolved' && (
            <Field label="Vencedor (override manual)">
              <select style={selectStyle} value={editForm.winner_team_name}
                onChange={e => setEditForm(f => ({ ...f, winner_team_name: e.target.value }))}>
                <option value="">— empate / nenhum —</option>
                <option value={editModal.team_a_name}>{editModal.team_a_name}</option>
                <option value={editModal.team_b_name}>{editModal.team_b_name}</option>
              </select>
            </Field>
          )}
          <SaveBtn loading={saving} onClick={handleSaveEdit} label="Salvar" />
        </Modal>
      )}
    </div>
  )
}
