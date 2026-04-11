// frontend/src/components/PlayerHistoryModal.jsx
// Modal com gráfico de barras mostrando histórico de pontos por partida de um jogador
// Usado no LineupBuilder e PlayerStatsPage

import { useState, useEffect, useRef } from 'react'
import { API_BASE_URL } from '../config'

const MAP_DISPLAY = {
  Baltic_Main:  { icon: '🌿', name: 'Erangel' },
  Desert_Main:  { icon: '🏜️', name: 'Miramar' },
  Tiger_Main:   { icon: '🌾', name: 'Taego' },
  Neon_Main:    { icon: '🌀', name: 'Rondo' },
  Vikendi_Main: { icon: '❄️', name: 'Vikendi' },
  Kiki_Main:    { icon: '🌊', name: 'Deston' },
  Savage_Main:  { icon: '🌴', name: 'Sanhok' },
}

const placementColor = (p) => {
  if (!p) return '#6b7280'
  if (p === 1) return '#f0c040'
  if (p <= 5) return '#4ade80'
  if (p <= 12) return '#f97316'
  return '#f87171'
}

function BarChart({ data }) {
  if (!data || data.length === 0) return null

  const max = Math.max(...data.map(d => d.xama_points), 0.01)
  const BAR_W = 36
  const BAR_GAP = 8
  const CHART_H = 140
  const LABEL_H = 52
  const totalW = data.length * (BAR_W + BAR_GAP) - BAR_GAP

  return (
    <div style={{ overflowX: 'auto', paddingBottom: '4px' }}>
      <svg
        width={Math.max(totalW, 300)}
        height={CHART_H + LABEL_H}
        style={{ display: 'block', minWidth: totalW }}
      >
        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1].map(t => {
          const y = CHART_H - t * CHART_H
          return (
            <g key={t}>
              <line x1={0} y1={y} x2={totalW} y2={y} stroke="#1e2330" strokeWidth={1} />
              <text x={0} y={y - 3} fontSize={9} fill="#4b5563" fontFamily="JetBrains Mono, monospace">
                {Math.round(max * t)}
              </text>
            </g>
          )
        })}

        {/* Bars */}
        {data.map((d, i) => {
          const x = i * (BAR_W + BAR_GAP)
          const barH = Math.max(4, (d.xama_points / max) * CHART_H)
          const y = CHART_H - barH
          const map = d.map_name ? (MAP_DISPLAY[d.map_name] ?? { icon: '🗺️', name: d.map_name.replace('_Main', '') }) : null
          const isTop = d.xama_points === max

          return (
            <g key={d.match_id}>
              {/* Bar */}
              <rect
                x={x} y={y} width={BAR_W} height={barH}
                rx={4}
                fill={isTop ? '#f0c040' : 'var(--color-xama-orange, #f97316)'}
                opacity={isTop ? 1 : 0.75}
              />

              {/* Points label on bar */}
              <text
                x={x + BAR_W / 2} y={y - 5}
                textAnchor="middle" fontSize={10} fontWeight={700}
                fill={isTop ? '#f0c040' : '#f97316'}
                fontFamily="JetBrains Mono, monospace"
              >
                {d.xama_points.toFixed(1)}
              </text>

              {/* Map icon */}
              <text
                x={x + BAR_W / 2} y={CHART_H + 16}
                textAnchor="middle" fontSize={14}
              >
                {map?.icon ?? '🗺️'}
              </text>

              {/* Stage short name */}
              <text
                x={x + BAR_W / 2} y={CHART_H + 32}
                textAnchor="middle" fontSize={9} fontWeight={700}
                fill="#6b7280" fontFamily="JetBrains Mono, monospace"
              >
                {d.stage_short_name}
              </text>

              {/* Day number */}
              <text
                x={x + BAR_W / 2} y={CHART_H + 46}
                textAnchor="middle" fontSize={9}
                fill="#4b5563" fontFamily="JetBrains Mono, monospace"
              >
                D{d.day_number}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export default function PlayerHistoryModal({ personId, personName, teamName, onClose }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const overlayRef = useRef(null)

  useEffect(() => {
    if (!personId) return
    setLoading(true)
    setError(null)
    fetch(`${API_BASE_URL}/stages/persons/${personId}/match-history?limit=15`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(d => { setData(d.reverse()); setLoading(false) })  // reverso = cronológico
      .catch(e => { setError(e.message); setLoading(false) })
  }, [personId])

  // Fechar ao clicar fora
  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose()
  }

  // Fechar com ESC
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Stats resumidas
  const avgPts = data.length > 0
    ? (data.reduce((s, d) => s + d.xama_points, 0) / data.length).toFixed(1)
    : '—'
  const bestPts = data.length > 0
    ? Math.max(...data.map(d => d.xama_points)).toFixed(1)
    : '—'
  const totalKills = data.reduce((s, d) => s + d.kills, 0)

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div style={{
        background: 'var(--color-xama-surface)',
        border: '1px solid var(--color-xama-border)',
        borderRadius: '14px',
        width: '100%', maxWidth: '720px',
        maxHeight: '90vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--color-xama-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {teamName && (
                <span style={{
                  fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em',
                  color: 'var(--color-xama-muted)',
                  fontFamily: "'JetBrains Mono', monospace",
                  background: 'var(--surface-3)',
                  padding: '2px 8px', borderRadius: '4px',
                }}>
                  {teamName}
                </span>
              )}
              <span style={{
                fontSize: '22px', fontWeight: 700,
                color: 'var(--color-xama-text)',
                fontFamily: "'Rajdhani', sans-serif",
              }}>
                {personName}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-xama-muted)', marginTop: '4px' }}>
              Últimas {data.length} partidas registradas
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--color-xama-muted)', fontSize: '22px', lineHeight: 1,
              padding: '4px 8px', borderRadius: '6px',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--color-xama-text)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--color-xama-muted)'}
          >
            ✕
          </button>
        </div>

        {/* Stats resumidas */}
        {!loading && !error && data.length > 0 && (
          <div style={{
            padding: '12px 24px',
            display: 'flex', gap: '24px',
            borderBottom: '1px solid var(--color-xama-border)',
            background: 'var(--surface-2)',
          }}>
            {[
              { label: 'Média pts', value: avgPts, color: 'var(--color-xama-orange)' },
              { label: 'Melhor partida', value: bestPts, color: '#f0c040' },
              { label: 'Total kills', value: totalKills, color: 'var(--color-xama-text)' },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div style={{ fontSize: '11px', color: 'var(--color-xama-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {label}
                </div>
                <div style={{ fontSize: '20px', fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace" }}>
                  {value}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Conteúdo */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-xama-muted)' }}>
              Carregando histórico...
            </div>
          )}
          {error && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#f87171' }}>
              Erro ao carregar histórico.
            </div>
          )}
          {!loading && !error && data.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-xama-muted)' }}>
              Nenhuma partida registrada para este jogador.
            </div>
          )}
          {!loading && !error && data.length > 0 && (
            <BarChart data={data} />
          )}
        </div>
      </div>
    </div>
  )
}
