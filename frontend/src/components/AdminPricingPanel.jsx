// frontend/src/components/AdminPricingPanel.jsx
// Painel admin de override de custo — #063

import { useEffect, useState } from 'react'
import { API_BASE_URL } from '../config'

export default function AdminPricingPanel({ stageId, token }) {
  const [roster,       setRoster]       = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState('')
  const [overrides,    setOverrides]    = useState({})   // { [roster_id]: string }
  const [saving,       setSaving]       = useState({})   // { [roster_id]: bool }
  const [feedback,     setFeedback]     = useState({})   // { [roster_id]: {ok, msg} }
  const [recalcLoading, setRecalcLoading] = useState(false)
  const [recalcMsg,    setRecalcMsg]    = useState('')

  useEffect(() => {
    if (!stageId) return
    setLoading(true)
    fetch(`${API_BASE_URL}/stages/${stageId}/roster`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => {
        const list = Array.isArray(data) ? data : []
        setRoster(list)
        // Pré-preenche campos com override existente
        const init = {}
        list.forEach(r => {
          if (r.cost_override != null) init[r.id] = String(r.cost_override)
        })
        setOverrides(init)
      })
      .catch(() => setError('Erro ao carregar roster'))
      .finally(() => setLoading(false))
  }, [stageId])

  async function saveOverride(rosterId) {
    setSaving(prev => ({ ...prev, [rosterId]: true }))
    setFeedback(prev => ({ ...prev, [rosterId]: null }))
    try {
      const val = overrides[rosterId]
      const cost = val === '' || val == null ? null : parseInt(val, 10)
      if (cost !== null && (isNaN(cost) || cost < 1 || cost > 999)) {
        throw new Error('Valor inválido (1–999)')
      }
      const res = await fetch(
        `${API_BASE_URL}/admin/pricing/rosters/${rosterId}/cost-override`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ cost }),
        }
      )
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.detail || `HTTP ${res.status}`)

      // Atualiza o roster local com o novo effective_cost
      setRoster(prev => prev.map(r =>
        r.id === rosterId
          ? { ...r, cost_override: data.cost_override, effective_cost: data.effective_cost }
          : r
      ))
      setFeedback(prev => ({ ...prev, [rosterId]: { ok: true, msg: cost === null ? 'Override removido' : 'Salvo' } }))
    } catch (e) {
      setFeedback(prev => ({ ...prev, [rosterId]: { ok: false, msg: e.message } }))
    } finally {
      setSaving(prev => ({ ...prev, [rosterId]: false }))
      setTimeout(() => setFeedback(prev => ({ ...prev, [rosterId]: null })), 3000)
    }
  }

  async function recalculate() {
    setRecalcLoading(true)
    setRecalcMsg('')
    try {
      const res = await fetch(
        `${API_BASE_URL}/admin/pricing/stages/${stageId}/recalculate-pricing`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      )
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.detail || `HTTP ${res.status}`)
      setRecalcMsg(`✅ Recalculado — ${data.updated} atualizados, ${data.skipped} sem mudança`)
      // Recarrega roster para refletir novos preços
      const r2 = await fetch(`${API_BASE_URL}/stages/${stageId}/roster`)
      if (r2.ok) {
        const list = await r2.json()
        setRoster(Array.isArray(list) ? list : [])
      }
    } catch (e) {
      setRecalcMsg(`❌ ${e.message}`)
    } finally {
      setRecalcLoading(false)
      setTimeout(() => setRecalcMsg(''), 5000)
    }
  }

  const formatName = (name) => {
    if (!name) return '—'
    const idx = name.indexOf('_')
    return idx !== -1 ? name.slice(idx + 1) : name
  }

  return (
    <div style={{ padding: '24px 0' }}>

      {/* Header do painel */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '20px',
      }}>
        <div>
          <h2 style={{
            fontSize: '20px', fontWeight: 700, color: 'var(--color-xama-text)',
            fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.04em',
            margin: 0,
          }}>Pricing Admin</h2>
          <p style={{ fontSize: '13px', color: 'var(--color-xama-muted)', margin: '4px 0 0' }}>
            Defina overrides manuais de custo. Deixe em branco para usar o preço calculado automaticamente.
          </p>
        </div>
        <button
          onClick={recalculate}
          disabled={recalcLoading}
          style={{
            padding: '8px 16px', borderRadius: '6px', border: '1px solid rgba(249,115,22,0.3)',
            background: 'rgba(249,115,22,0.08)', color: 'var(--color-xama-orange)',
            fontSize: '12px', fontWeight: 700, cursor: recalcLoading ? 'not-allowed' : 'pointer',
            fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>
          {recalcLoading ? '⏳ Recalculando...' : '⚡ Recalcular Pricing'}
        </button>
      </div>

      {recalcMsg && (
        <div style={{
          marginBottom: '16px', padding: '10px 16px', borderRadius: '8px',
          background: recalcMsg.startsWith('✅') ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)',
          border: `1px solid ${recalcMsg.startsWith('✅') ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`,
          color: recalcMsg.startsWith('✅') ? '#4ade80' : '#f87171',
          fontSize: '13px', fontWeight: 600,
        }}>
          {recalcMsg}
        </div>
      )}

      {loading && <p style={{ color: 'var(--color-xama-muted)', fontSize: '13px' }}>Carregando jogadores...</p>}
      {error   && <p style={{ color: '#f87171', fontSize: '13px' }}>{error}</p>}

      {!loading && !error && (
        <div style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--color-xama-border)',
          borderRadius: '10px', overflow: 'hidden',
        }}>
          {/* Cabeçalho da tabela */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px 140px 80px',
            padding: '10px 16px',
            borderBottom: '1px solid var(--color-xama-border)',
            background: 'var(--surface-2)',
          }}>
            {['Jogador', 'Time', 'Auto', 'Override', 'Novo valor', ''].map(h => (
              <span key={h} style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-xama-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {h}
              </span>
            ))}
          </div>

          {roster.map((r, i) => {
            const fb = feedback[r.id]
            return (
              <div key={r.id} style={{
                display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px 140px 80px',
                padding: '12px 16px', alignItems: 'center',
                borderBottom: i < roster.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
              }}>
                {/* Nome */}
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-xama-text)', fontFamily: "'Rajdhani', sans-serif" }}>
                  {formatName(r.person_name)}
                  {r.newcomer_to_tier && (
                    <span style={{ marginLeft: '6px', fontSize: '9px', color: '#60a5fa', fontWeight: 700 }}>NEW</span>
                  )}
                </span>

                {/* Time */}
                <span style={{ fontSize: '12px', color: 'var(--color-xama-muted)' }}>
                  {r.team_name || '—'}
                </span>

                {/* Preço auto */}
                <span style={{ fontSize: '14px', fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-xama-muted)' }}>
                  {r.fantasy_cost ?? '—'}
                </span>

                {/* Override atual */}
                <span style={{
                  fontSize: '14px', fontFamily: "'JetBrains Mono', monospace",
                  color: r.cost_override != null ? 'var(--color-xama-gold)' : 'var(--color-xama-muted)',
                  fontWeight: r.cost_override != null ? 700 : 400,
                }}>
                  {r.cost_override ?? '—'}
                </span>

                {/* Input novo valor */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="number"
                    min="1" max="999"
                    placeholder={r.cost_override != null ? String(r.cost_override) : 'sem override'}
                    value={overrides[r.id] ?? ''}
                    onChange={e => setOverrides(prev => ({ ...prev, [r.id]: e.target.value }))}
                    style={{
                      width: '80px', padding: '5px 8px', borderRadius: '6px',
                      background: 'var(--surface-2)', border: '1px solid var(--color-xama-border)',
                      color: 'var(--color-xama-text)', fontSize: '13px',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  />
                  {fb && (
                    <span style={{ fontSize: '11px', color: fb.ok ? '#4ade80' : '#f87171', whiteSpace: 'nowrap' }}>
                      {fb.msg}
                    </span>
                  )}
                </div>

                {/* Botão salvar */}
                <button
                  onClick={() => saveOverride(r.id)}
                  disabled={saving[r.id]}
                  style={{
                    padding: '5px 12px', borderRadius: '6px', border: 'none',
                    background: saving[r.id] ? 'var(--surface-3)' : 'var(--color-xama-orange)',
                    color: saving[r.id] ? 'var(--color-xama-muted)' : '#fff',
                    fontSize: '11px', fontWeight: 700, cursor: saving[r.id] ? 'not-allowed' : 'pointer',
                    fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.06em', textTransform: 'uppercase',
                  }}>
                  {saving[r.id] ? '...' : 'Salvar'}
                </button>
              </div>
            )
          })}

          {roster.length === 0 && (
            <p style={{ padding: '24px', textAlign: 'center', color: 'var(--color-xama-muted)', fontSize: '13px' }}>
              Nenhum jogador no roster desta stage
            </p>
          )}
        </div>
      )}
    </div>
  )
}
