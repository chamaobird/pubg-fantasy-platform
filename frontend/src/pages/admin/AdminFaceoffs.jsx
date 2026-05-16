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
  draft:    'var(--xm-muted)',
  open:     'var(--xm-green)',
  closed:   'var(--xm-orange)',
  resolved: '#a5b4fc',
}
const NEXT_STATUS = { draft: 'open', open: 'closed', closed: null }
const PREV_STATUS = { open: 'draft', closed: 'open', resolved: 'closed' }

export default function AdminFaceoffs({ token }) {
  const call = useCallback(api(token), [token])

  // Dados globais (carregados uma vez)
  const [allChampionships, setAllChampionships] = useState([])
  const [allStages, setAllStages]               = useState([])
  const [allFaceoffs, setAllFaceoffs]           = useState([])  // todos os faceoffs para badge
  const [globalLoading, setGlobalLoading]       = useState(true)

  // Estado do campeonato selecionado
  const [champId, setChampId]           = useState('')
  const [faceoffs, setFaceoffs]         = useState([])
  const [suggested, setSuggested]       = useState([])
  const [selectedSourceIds, setSelectedSourceIds] = useState(new Set())
  const [loading, setLoading]           = useState(false)
  const [suggesting, setSuggesting]     = useState(false)
  const [msg, setMsg]                   = useState('')
  const [editModal, setEditModal]       = useState(null)
  const [editForm, setEditForm]         = useState({})
  const [saving, setSaving]             = useState(false)

  // Criação manual de pares
  const [manualPairs, setManualPairs]   = useState([])
  const [manualForm, setManualForm]     = useState({ team_a_name: '', team_b_name: '', seed_a: '', seed_b: '' })

  // Carrega tudo de uma vez ao montar
  useEffect(() => {
    setGlobalLoading(true)
    Promise.all([
      call('GET', '/admin/championships?include_inactive=true'),
      call('GET', '/admin/stages'),
      call('GET', '/admin/faceoffs'),
    ])
      .then(([champs, stages, faceoffs]) => {
        setAllChampionships(Array.isArray(champs) ? champs.sort((a, b) => b.id - a.id) : [])
        setAllStages(Array.isArray(stages) ? stages : [])
        setAllFaceoffs(Array.isArray(faceoffs) ? faceoffs : [])
      })
      .catch(() => {})
      .finally(() => setGlobalLoading(false))
  }, [call])

  // Championships elegíveis: têm ao menos uma stage com phase != 'finished'
  const eligibleChampionships = allChampionships.filter(c => {
    const champStages = allStages.filter(s => s.championship_id === c.id)
    // Se não tem stages, ainda assim mostra (pode ser novo)
    if (champStages.length === 0) return true
    // Mostra se ao menos uma stage não está finished
    return champStages.some(s => s.stage_phase !== 'finished')
  })

  // Conta de faceoffs por championship (para badge)
  const faceoffCountByChamp = allFaceoffs.reduce((acc, f) => {
    acc[f.championship_id] = (acc[f.championship_id] || 0) + 1
    return acc
  }, {})

  const selectedChamp = allChampionships.find(c => c.id === parseInt(champId))

  // Stages disponíveis como fonte (mesma região, não pertence ao championship alvo, fase finished ou live)
  const availableStages = (() => {
    if (!champId) return {}
    const shard = selectedChamp?.shard
    const relevant = allStages
      .filter(s =>
        s.championship_id !== parseInt(champId) &&   // exclui stages do campeonato alvo
        (!shard || s.shard === shard) &&              // mesma região
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
    return grouped
  })()
  const groupKeys = Object.keys(availableStages)

  // Ao trocar campeonato: recarrega faceoffs do campeonato selecionado
  useEffect(() => {
    if (!champId) { setFaceoffs([]); return }
    setSuggested([])
    setSelectedSourceIds(new Set())
    setManualPairs([])
    setManualForm({ team_a_name: '', team_b_name: '', seed_a: '', seed_b: '' })
    loadFaceoffs()
  }, [champId])

  const loadFaceoffs = useCallback(async () => {
    if (!champId) return
    setLoading(true)
    try {
      const data = await call('GET', `/admin/faceoffs?championship_id=${champId}`)
      setFaceoffs(Array.isArray(data) ? data : [])
      // Atualiza o allFaceoffs para manter o badge atualizado
      setAllFaceoffs(prev => {
        const others = prev.filter(f => f.championship_id !== parseInt(champId))
        return [...others, ...(Array.isArray(data) ? data : [])]
      })
    } catch (e) { setMsg('!' + e.message) }
    finally { setLoading(false) }
  }, [call, champId])

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

  const handleAddManualPair = () => {
    const { team_a_name, team_b_name, seed_a, seed_b } = manualForm
    if (!team_a_name.trim() || !team_b_name.trim()) { setMsg('!Informe os dois times.'); return }
    if (team_a_name.trim().toLowerCase() === team_b_name.trim().toLowerCase()) { setMsg('!Times devem ser diferentes.'); return }
    setManualPairs(prev => [...prev, {
      team_a_name: team_a_name.trim(),
      team_b_name: team_b_name.trim(),
      seed_a: seed_a !== '' ? parseInt(seed_a) : prev.length * 2 + 1,
      seed_b: seed_b !== '' ? parseInt(seed_b) : prev.length * 2 + 2,
    }])
    setManualForm({ team_a_name: '', team_b_name: '', seed_a: '', seed_b: '' })
    setMsg('')
  }

  const handleRemoveManualPair = (idx) => {
    setManualPairs(prev => prev.filter((_, i) => i !== idx))
  }

  const handleCreateManualPairs = async () => {
    if (!manualPairs.length) return
    setSaving(true); setMsg('')
    try {
      await call('POST', '/admin/faceoffs/bulk', {
        championship_id: parseInt(champId),
        pairs: manualPairs,
      })
      setManualPairs([])
      setMsg(`${manualPairs.length} faceoff(s) criado(s) em draft.`)
      await loadFaceoffs()
    } catch (e) { setMsg('!' + e.message) }
    finally { setSaving(false) }
  }

  const handleAdvanceStatus = async (f) => {
    const next = NEXT_STATUS[f.status]
    if (!next) return
    try {
      await call('PATCH', `/admin/faceoffs/${f.id}`, { status: next })
      await loadFaceoffs()
    } catch (e) { setMsg('!' + e.message) }
  }

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

  const handleResolve = async (f) => {
    if (!confirm(`Resolver automaticamente "${f.team_a_name} vs ${f.team_b_name}" pelo standing do campeonato?`)) return
    try {
      const res = await call('POST', `/admin/faceoffs/${f.id}/resolve`)
      setMsg(`Resolvido: vencedor = ${res.winner_team_name || 'empate'}`)
      await loadFaceoffs()
    } catch (e) { setMsg('!' + e.message) }
  }

  const handleBulkResolve = async () => {
    const closedCount = faceoffs.filter(f => f.status === 'closed').length
    if (!confirm(`Resolver automaticamente ${closedCount} faceoff(s) fechado(s) pelo standing do campeonato?`)) return
    setSaving(true); setMsg('')
    try {
      const res = await call('POST', `/admin/faceoffs/bulk-resolve?championship_id=${champId}`)
      const skippedMsg = res.skipped?.length > 0 ? ` · ${res.skipped.length} não resolvidos` : ''
      setMsg(`${res.resolved?.length} faceoffs resolvidos${skippedMsg}`)
      await loadFaceoffs()
    } catch (e) { setMsg('!' + e.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async (f) => {
    if (!confirm(`Deletar "${f.team_a_name} vs ${f.team_b_name}"?`)) return
    try {
      await call('DELETE', `/admin/faceoffs/${f.id}`)
      await loadFaceoffs()
    } catch (e) { setMsg('!' + e.message) }
  }

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
      if (editModal.status === 'resolved') {
        payload.winner_team_name = editForm.winner_team_name || null
      }
      await call('PATCH', `/admin/faceoffs/${editModal.id}`, payload)
      setEditModal(null)
      await loadFaceoffs()
    } catch (e) { setMsg('!' + e.message) }
    finally { setSaving(false) }
  }

  if (globalLoading) {
    return (
      <div>
        <SectionHeader title="Team Faceoff" />
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--xm-muted)' }}>Carregando...</div>
      </div>
    )
  }

  return (
    <div>
      <SectionHeader title="Team Faceoff" />

      {/* Seletor de campeonato */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--xm-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Campeonato das Finals (alvo)
        </label>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {eligibleChampionships.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--xm-muted)' }}>
              Nenhum campeonato com stages em andamento ou futuras.
            </p>
          ) : (
            eligibleChampionships.map(c => {
              const count = faceoffCountByChamp[c.id] || 0
              const isSelected = String(c.id) === champId
              return (
                <button
                  key={c.id}
                  onClick={() => { setChampId(String(c.id)); setMsg('') }}
                  style={{
                    padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
                    background: isSelected ? 'rgba(249,115,22,0.12)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isSelected ? 'rgba(249,115,22,0.5)' : 'rgba(255,255,255,0.1)'}`,
                    color: isSelected ? 'var(--xm-orange)' : 'var(--xm-text)',
                    fontWeight: isSelected ? 700 : 400,
                    fontSize: 13,
                    display: 'flex', alignItems: 'center', gap: 8,
                    transition: 'all 0.12s',
                  }}
                >
                  <span>{c.name}</span>
                  {count > 0 && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10,
                      background: isSelected ? 'rgba(249,115,22,0.2)' : 'rgba(99,102,241,0.15)',
                      color: isSelected ? 'var(--xm-orange)' : '#a5b4fc',
                      border: `1px solid ${isSelected ? 'rgba(249,115,22,0.3)' : 'rgba(99,102,241,0.3)'}`,
                    }}>
                      {count} faceoff{count !== 1 ? 's' : ''}
                    </span>
                  )}
                </button>
              )
            })
          )}
        </div>
      </div>

      {msg && (
        <div style={{
          marginBottom: 14, padding: '8px 14px', borderRadius: 8, fontSize: 13,
          background: msg.startsWith('!') ? 'rgba(239,68,68,0.1)' : 'rgba(74,222,128,0.1)',
          color: msg.startsWith('!') ? '#f87171' : 'var(--xm-green)',
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
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--xm-text)', marginBottom: 4 }}>
            Sugerir Chaves por Performance
          </div>
          <div style={{ fontSize: 12, color: 'var(--xm-muted)', marginBottom: 16, lineHeight: 1.5 }}>
            Selecione stages anteriores da <strong style={{ color: '#a5b4fc' }}>mesma região ({selectedChamp?.shard})</strong> como base de performance.
            O sistema cria os pares <strong style={{ color: 'var(--xm-text)' }}>#1 vs #2, #3 vs #4...</strong>
          </div>

          {groupKeys.length === 0 ? (
            <div style={{ fontSize: 12, color: '#f87171', marginBottom: 14 }}>
              Nenhuma stage com partidas encontrada para a região <strong>{selectedChamp?.shard}</strong>.
            </div>
          ) : (
            <div style={{ marginBottom: 16 }}>
              {groupKeys.map(groupName => {
                const stages = availableStages[groupName]
                const allSelected = stages.every(s => selectedSourceIds.has(s.id))
                return (
                  <div key={groupName} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--xm-orange)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                        {groupName}
                      </span>
                      {!allSelected && (
                        <button onClick={() => selectAllGroup(stages)} style={{ fontSize: 10, color: 'var(--xm-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
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
                            <span style={{ color: checked ? '#a5b4fc' : 'var(--xm-text)' }}>{s.name}</span>
                            <span style={{ fontSize: 10, color: 'var(--xm-muted)', fontFamily: "'JetBrains Mono', monospace" }}>#{s.id}</span>
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
          </div>

          {suggested.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--xm-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
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
                      <span style={{ color: 'var(--xm-muted)', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>{p.pts_per_match_a?.toFixed(1)} pts/g</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--xm-muted)', textAlign: 'center', margin: '2px 0' }}>vs</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#6366f1', fontWeight: 700 }}>#{p.seed_b} {p.team_b_name}</span>
                      <span style={{ color: 'var(--xm-muted)', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>{p.pts_per_match_b?.toFixed(1)} pts/g</span>
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

      {/* Criação manual de pares */}
      {champId && (
        <div style={{
          marginBottom: 24, padding: '16px 20px',
          background: 'rgba(249,115,22,0.04)',
          border: '1px solid rgba(249,115,22,0.18)',
          borderRadius: 12,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--xm-text)', marginBottom: 4 }}>
            Criar Chaves Manualmente
          </div>
          <div style={{ fontSize: 12, color: 'var(--xm-muted)', marginBottom: 14, lineHeight: 1.5 }}>
            Para torneios sem stages de referência (ex: PGS global). Informe os nomes exatos dos times conforme o roster.
          </div>

          {/* Form para adicionar um par */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--xm-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Time A</div>
              <input
                value={manualForm.team_a_name}
                onChange={e => setManualForm(f => ({ ...f, team_a_name: e.target.value }))}
                placeholder="ex: Virtus.pro"
                style={{ ...inputStyle, width: 180 }}
              />
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--xm-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Time B</div>
              <input
                value={manualForm.team_b_name}
                onChange={e => setManualForm(f => ({ ...f, team_b_name: e.target.value }))}
                placeholder="ex: Natus Vincere"
                style={{ ...inputStyle, width: 180 }}
              />
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--xm-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Seed A</div>
              <input
                type="number" min="1"
                value={manualForm.seed_a}
                onChange={e => setManualForm(f => ({ ...f, seed_a: e.target.value }))}
                placeholder="auto"
                style={{ ...inputStyle, width: 70 }}
              />
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--xm-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Seed B</div>
              <input
                type="number" min="1"
                value={manualForm.seed_b}
                onChange={e => setManualForm(f => ({ ...f, seed_b: e.target.value }))}
                placeholder="auto"
                style={{ ...inputStyle, width: 70 }}
              />
            </div>
            <ActBtn onClick={handleAddManualPair}>+ Adicionar Par</ActBtn>
          </div>

          {/* Lista de pares adicionados */}
          {manualPairs.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--xm-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Fila ({manualPairs.length} par{manualPairs.length !== 1 ? 'es' : ''})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                {manualPairs.map((p, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '7px 12px', borderRadius: 8, fontSize: 13,
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                  }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--xm-muted)', width: 50 }}>
                      #{p.seed_a}/#{p.seed_b}
                    </span>
                    <span style={{ color: '#f97316', fontWeight: 600, flex: 1 }}>{p.team_a_name}</span>
                    <span style={{ color: 'var(--xm-muted)', fontSize: 11 }}>vs</span>
                    <span style={{ color: '#6366f1', fontWeight: 600, flex: 1 }}>{p.team_b_name}</span>
                    <button
                      onClick={() => handleRemoveManualPair(i)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', fontSize: 14, padding: '0 4px', lineHeight: 1 }}
                    >×</button>
                  </div>
                ))}
              </div>
              <ActBtn onClick={handleCreateManualPairs} disabled={saving}>
                {saving ? 'Criando...' : `Criar ${manualPairs.length} Faceoff${manualPairs.length !== 1 ? 's' : ''} (Draft)`}
              </ActBtn>
            </div>
          )}
        </div>
      )}

      {/* Lista de faceoffs do campeonato selecionado */}
      {champId && (
        <div style={{ background: 'rgba(18,21,28,0.9)', border: '1px solid var(--xm-border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--xm-border)', display: 'flex', alignItems: 'center', gap: 16, fontSize: 11, color: 'var(--xm-muted)', flexWrap: 'wrap' }}>
            <span><strong style={{ color: 'var(--xm-text)' }}>→</strong> Avança status</span>
            <span><strong style={{ color: '#a5b4fc' }}>←</strong> Reverte status</span>
            <span><strong style={{ color: 'var(--xm-green)' }}>⚡</strong> Resolve pelo standing</span>
            <span><strong>✏</strong> Edita nomes/seeds/winner</span>
            {faceoffs.some(f => f.status === 'closed') && (
              <button
                onClick={handleBulkResolve}
                disabled={saving}
                style={{
                  marginLeft: 'auto', fontSize: 11, padding: '4px 12px', borderRadius: 6, cursor: 'pointer',
                  background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.35)',
                  color: 'var(--xm-green)', fontWeight: 700,
                }}
              >
                ⚡ Auto-resolver todos ({faceoffs.filter(f => f.status === 'closed').length})
              </button>
            )}
          </div>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--xm-muted)' }}>Carregando...</div>
          ) : faceoffs.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--xm-muted)' }}>
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
                  <th style={thStyle}>Ações</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {faceoffs.map(f => (
                  <tr key={f.id}>
                    <td style={{ ...tdStyle, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--xm-muted)' }}>
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
                      <span style={{ color: 'var(--xm-muted)', fontSize: 11, marginLeft: 6 }}>({f.total_votes})</span>
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--xm-green)' }}>
                      {f.winner_team_name || '—'}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {PREV_STATUS[f.status] && (
                          <button onClick={() => handleRevertStatus(f)} style={{
                            fontSize: 11, padding: '3px 8px', borderRadius: 6, cursor: 'pointer',
                            background: 'rgba(165,180,252,0.08)', border: '1px solid rgba(165,180,252,0.3)',
                            color: '#a5b4fc', fontWeight: 700,
                          }}>
                            ← {STATUS_LABEL[PREV_STATUS[f.status]]}
                          </button>
                        )}
                        {NEXT_STATUS[f.status] && (
                          <button onClick={() => handleAdvanceStatus(f)} style={{
                            fontSize: 11, padding: '3px 8px', borderRadius: 6, cursor: 'pointer',
                            background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.3)',
                            color: 'var(--xm-orange)', fontWeight: 700,
                          }}>
                            → {STATUS_LABEL[NEXT_STATUS[f.status]]}
                          </button>
                        )}
                        {f.status === 'closed' && (
                          <button onClick={() => handleResolve(f)} style={{
                            fontSize: 11, padding: '3px 8px', borderRadius: 6, cursor: 'pointer',
                            background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.3)',
                            color: 'var(--xm-green)', fontWeight: 700,
                          }}>
                            ⚡ Resolver
                          </button>
                        )}
                      </div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button onClick={() => openEdit(f)} style={{
                          fontSize: 11, padding: '3px 8px', borderRadius: 6, cursor: 'pointer',
                          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)',
                          color: 'var(--xm-text)', fontWeight: 700,
                        }}>✏</button>
                        {f.status === 'draft' && (
                          <button onClick={() => handleDelete(f)} style={{
                            fontSize: 11, padding: '3px 8px', borderRadius: 6, cursor: 'pointer',
                            background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.3)',
                            color: '#f87171', fontWeight: 700,
                          }}>✕</button>
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
