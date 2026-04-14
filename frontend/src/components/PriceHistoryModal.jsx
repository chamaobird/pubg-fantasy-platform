// frontend/src/components/PriceHistoryModal.jsx
// Modal de histórico de preços de um jogador — #062

import { useEffect, useState } from 'react'
import { API_BASE_URL } from '../config'

const fmt = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) +
    ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function PriceHistoryModal({ stageId, roster, onClose }) {
  const [history, setHistory]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [error,   setError]     = useState('')

  useEffect(() => {
    if (!roster) return
    setLoading(true)
    fetch(`${API_BASE_URL}/stages/${stageId}/roster/${roster.id}/price-history?limit=30`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => setHistory(Array.isArray(data) ? data : []))
      .catch(() => setError('Erro ao carregar histórico'))
      .finally(() => setLoading(false))
  }, [roster, stageId])

  if (!roster) return null

  const playerName = (() => {
    const name = roster.person_name || ''
    const idx = name.indexOf('_')
    return idx !== -1 ? name.slice(idx + 1) : name
  })()

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(2px)',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', zIndex: 1001,
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '100%', maxWidth: '480px',
        background: 'var(--surface-1)',
        border: '1px solid var(--color-xama-border)',
        borderRadius: '12px', overflow: 'hidden',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 20px',
          borderBottom: '1px solid var(--color-xama-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{
              fontSize: '16px', fontWeight: 700,
              color: 'var(--color-xama-text)',
              letterSpacing: '0.04em',
            }}>
              {playerName}
              {roster.team_name && (
                <span style={{ fontSize: '12px', color: 'var(--color-xama-muted)', marginLeft: '8px', fontWeight: 600 }}>
                  {roster.team_name}
                </span>
              )}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-xama-muted)', marginTop: '2px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Histórico de preços
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{
              fontSize: '20px', fontWeight: 700,
              fontFamily: "'JetBrains Mono', monospace",
              color: 'var(--color-xama-gold)',
            }}>
              {roster.effective_cost ?? '—'}
            </span>
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--color-xama-muted)', fontSize: '20px',
                lineHeight: 1, padding: '4px',
              }}>×</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ maxHeight: '360px', overflowY: 'auto', padding: '8px 0' }}>
          {loading && (
            <p style={{ padding: '24px', textAlign: 'center', color: 'var(--color-xama-muted)', fontSize: '13px' }}>
              Carregando...
            </p>
          )}
          {error && (
            <p style={{ padding: '16px', textAlign: 'center', color: 'var(--color-xama-red)', fontSize: '13px' }}>
              {error}
            </p>
          )}
          {!loading && !error && history.length === 0 && (
            <p style={{ padding: '24px', textAlign: 'center', color: 'var(--color-xama-muted)', fontSize: '13px' }}>
              Nenhum registro encontrado
            </p>
          )}
          {!loading && !error && history.map((h, i) => (
            <div key={h.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 20px',
              background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{
                  fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em',
                  textTransform: 'uppercase', padding: '2px 8px', borderRadius: '4px',
                  background: h.source === 'override'
                    ? 'rgba(250,204,21,0.12)'
                    : 'rgba(249,115,22,0.1)',
                  color: h.source === 'override'
                    ? 'var(--color-xama-gold)'
                    : 'var(--color-xama-orange)',
                }}>
                  {h.source === 'override' ? '✏️ override' : '⚡ auto'}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--color-xama-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                  {fmt(h.recorded_at)}
                </span>
              </div>
              <span style={{
                fontSize: '16px', fontWeight: 700,
                fontFamily: "'JetBrains Mono', monospace",
                color: 'var(--color-xama-text)',
              }}>
                {h.cost}
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--color-xama-border)',
          display: 'flex', justifyContent: 'flex-end',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px', borderRadius: '6px', border: '1px solid var(--color-xama-border)',
              background: 'var(--surface-2)', color: 'var(--color-xama-muted)',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              letterSpacing: '0.04em',
            }}>
            Fechar
          </button>
        </div>
      </div>
    </>
  )
}
