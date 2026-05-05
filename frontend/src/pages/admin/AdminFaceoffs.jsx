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

  const [championships, setChampionships]   = useState([])
  const [champId, setChampId]               = useState('')
  const [selectedChamp, setSelectedChamp]   = useState(null)
  const [faceoffs, setFaceoffs]             = useState([])
  const [suggested, setSuggested]           = useState([])
  // stages disponíveis como fonte (com partidas), agrupadas por championship
  const [availableStages, setAvailableStages] = useState([])
  const [selectedSourceIds, setSelectedSourceIds] = useState(new Set())
  const [loadingStages, setLoadingStages]   = useState(false)
  const [loading, setLoading]               = useState(false)
  const [suggesting, setSuggesting]         = useState(false)
  const [msg, setMsg]                       = useState('')
  const [editModal, setEditModal]           = useState(null)
  const [editForm, setEditForm]             = useState({})
  const [saving, setSaving]                 = useState(false)

  // Carrega championships
  useEffect(() => {
    call('GET', '/admin/championships?include_inactive=true')
      .then(d => setChampionships(Array.isArray(d) ? d.sort((a, b) => b.id - a.id) : []))
      .catch(() => {})
  }, [call])

  // Ao trocar campeonato: carrega faceoffs + stages disponíveis como fonte
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

  // Busca stages com partidas importadas — filtra pelo mesmo shard do campeonato selecionado
  const loadAvailableStages = async (champ) => {
    setLoadingStages(true)
    try {
      const allStages = await call('GET', '/admin/stages')
      if (!Array.isArray(allStages)) return

      // Filtra stages do mesmo shard que têm stage_phase finished ou live (têm dados)
      const shard = champ?.shard
      const relevant = allStages
        .filter(s =>
          s.id !== parseInt(champId) &&
          (!shard || s.shard === shard) &&
          (s.stage_phase === 'finished' || s.stage_phase === 'live')
        )
        .sort((a, b) => b.id - a.id)  // mais recentes primeiro
        .slice(0, 20)

      // Agrupa por championship name
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

  // Sugerir chaves
  const handleSuggest = async () => {
    if (!champId) return
    if (selectedSourceIds.size === 0) {
      setMsg('!Selecione ao menos uma stage de referência abaixo.')
      return
    }
    setSuggesting(true); setMsg(''); setSuggested([])
    try {
      const ids = [...selectedSourceIds].join(',')
      const data = await call('GET', `/admin/faceoffs/suggest?championship_id=${champId}&source_stage_ids=${ids}`)
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
      setMsg(`${suggested.length} faceoffs criados em draft.`)
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
            Selecione as stages anteriores (playoffs, regular season) que serão usadas como base de performance.
            O sistema ranqueia os times por pontos XAMA/partida e cria os pares <strong style={{ color: 'var(--color-xama-text)' }}>#1 vs #2, #3 vs #4...</strong>
          </div>

          {/* Checklist de stages */}
          {loadingStages ? (
            <div style={{ fontSize: 12, color: 'var(--color-xama-muted)', marginBottom: 14 }}>Carregando stages disponíveis...</div>
          ) : groupKeys.length === 0 ? (
            <div style={{ fontSize: 12, color: '#f87171', marginBottom: 14 }}>
              Nenhuma stage com partidas importadas encontrada para o shard <strong>{selectedChamp?.shard}</strong>.
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
                        <button
                          onClick={() => selectAllGroup(stages)}
                          style={{ fontSize: 10, color: 'var(--color-xama-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                        >
                          selecionar todos
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {stages.map(s => {
                        const checked = selectedSourceIds.has(s.id)
                        return (
                          <label
                            key={s.id}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 6,
                              padding: '5px 10px', borderRadius: 6, cursor: 'pointer',
                              border: `1px solid ${checked ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.08)'}`,
                              background: checked ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.02)',
                              fontSize: 12, transition: 'all 0.12s',
                              userSelect: 'none',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleSourceId(s.id)}
                              style={{ accentColor: '#6366f1', width: 13, height: 13 }}
                            />
                            <span style={{ color: checked ? '#a5b4fc' : 'var(--color-xama-text)' }}>
                              {s.name}
                            </span>
                            <span style={{ fontSize: 10, color: 'var(--color-xama-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                              #{s.id}
                            </span>
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

          {/* Sugestões geradas */}
          {suggested.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-xama-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Pares sugeridos — revise e ajuste se necessário
              </div>
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
            </div>
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
                        {NEXT_STATUS[f.status] && (
                          <ActBtn small onClick={() => handleAdvanceStatus(f)}>
                            → {STATUS_LABEL[NEXT_STATUS[f.status]]}
                          </ActBtn>
                        )}
                        {(f.status === 'closed' || f.status === 'open') && (
                          <ActBtn small onClick={() => handleResolve(f)}>Resolver</ActBtn>
                        )}
                        {f.status === 'draft' && (
                          <ActBtn small onClick={() => openEdit(f)}>Editar</ActBtn>
                        )}
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
