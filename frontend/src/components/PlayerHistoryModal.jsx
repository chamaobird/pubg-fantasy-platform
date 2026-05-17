// frontend/src/components/PlayerHistoryModal.jsx
import { useState, useEffect, useRef } from 'react'
import { API_BASE_URL } from '../config'
import TeamLogo from './TeamLogo'
import PriceBreakdown from './PriceBreakdown'

const MAP_DISPLAY = {
  Baltic_Main:  { icon: '🌿', name: 'Erangel' },
  Desert_Main:  { icon: '🏜️', name: 'Miramar' },
  Tiger_Main:   { icon: '🌾', name: 'Taego' },
  Neon_Main:    { icon: '🌀', name: 'Rondo' },
  Vikendi_Main: { icon: '❄️', name: 'Vikendi' },
  Kiki_Main:    { icon: '🌊', name: 'Deston' },
  Savage_Main:  { icon: '🌴', name: 'Sanhok' },
}

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function BarChart({ data }) {
  const [hovered, setHovered] = useState(null)
  if (!data || data.length === 0) return null

  const maxPts = Math.max(...data.map(d => d.xama_points), 0.01)
  const minPts = Math.min(...data.map(d => d.xama_points), 0)
  const hasNeg = minPts < 0

  const BAR_W    = 36
  const BAR_GAP  = 8
  // Escala unificada — mesma proporção px/pt para positivo e negativo
  const TOTAL_RANGE   = maxPts + Math.abs(minPts)
  const CHART_H_TOTAL = 160
  const PX_PER_PT     = CHART_H_TOTAL / TOTAL_RANGE
  const POS_H         = Math.round(maxPts * PX_PER_PT)
  const NEG_H         = Math.round(Math.abs(minPts) * PX_PER_PT)
  const ZERO_Y        = POS_H
  const CHART_H       = POS_H + NEG_H
  const LABEL_H  = 64
  const totalW   = data.length * (BAR_W + BAR_GAP) - BAR_GAP
  const TOOLTIP_W = 150
  const TOOLTIP_H = 64

  return (
    <div style={{ overflowX: 'auto', paddingBottom: '4px' }}>
      <svg
        width={Math.max(totalW, 300)}
        height={CHART_H + LABEL_H}
        style={{ display: 'block', minWidth: totalW, overflow: 'visible' }}
      >
        {/* Grid positivo */}
        {[0.25, 0.5, 0.75, 1].map(t => {
          const y = ZERO_Y - t * POS_H
          return (
            <g key={t}>
              <line x1={0} y1={y} x2={totalW} y2={y} stroke="#1e2330" strokeWidth={1} />
              <text x={2} y={y - 3} fontSize={9} fill="#4b5563" fontFamily="JetBrains Mono, monospace">
                {Math.round(maxPts * t)}
              </text>
            </g>
          )
        })}

        {/* Linha do zero */}
        <line x1={0} y1={ZERO_Y} x2={totalW} y2={ZERO_Y} stroke="#374151" strokeWidth={1.5} />

        {/* Bars */}
        {data.map((d, i) => {
          const x     = i * (BAR_W + BAR_GAP)
          const pts   = d.xama_points
          const isPos = pts >= 0
          const isTop = pts === maxPts
          const isHov = hovered === i

          const barH    = Math.max(4, Math.abs(pts) * PX_PER_PT)
          const barY    = isPos ? ZERO_Y - barH : ZERO_Y
          const barFill = isTop ? '#f0c040' : isPos ? (isHov ? '#fb923c' : '#f97316') : (isHov ? '#fca5a5' : '#f87171')

          const map  = d.map_name ? (MAP_DISPLAY[d.map_name] ?? { icon: '🗺️' }) : { icon: '🗺️' }

          const tipX = x + BAR_W / 2 + TOOLTIP_W > totalW
            ? x + BAR_W / 2 - TOOLTIP_W - 4
            : x + BAR_W / 2 + 4
          // Tooltip sempre aparece acima da linha do zero
          const tipY = Math.max(0, ZERO_Y - TOOLTIP_H - 8)

          return (
            <g key={d.match_id}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: 'default' }}
            >
              <rect x={x} y={0} width={BAR_W} height={CHART_H + LABEL_H} fill="transparent" />

              <rect x={x} y={barY} width={BAR_W} height={barH} rx={4}
                fill={barFill} opacity={isTop ? 1 : isHov ? 1 : 0.75} />

              {/* Label acima de barras positivas, abaixo de negativas */}
              <text
                x={x + BAR_W / 2}
                y={isPos ? barY - 5 : ZERO_Y + barH + 12}
                textAnchor="middle" fontSize={10} fontWeight={700}
                fill={isPos ? (isTop ? '#f0c040' : '#f97316') : '#f87171'}
                fontFamily="JetBrains Mono, monospace"
              >
                {pts.toFixed(1)}
              </text>

              <text x={x + BAR_W / 2} y={CHART_H + 16} textAnchor="middle" fontSize={13}>
                {map.icon}
              </text>
              <text x={x + BAR_W / 2} y={CHART_H + 30} textAnchor="middle"
                fontSize={9} fontWeight={700} fill="#6b7280" fontFamily="JetBrains Mono, monospace">
                {d.stage_short_name}
              </text>
              <text x={x + BAR_W / 2} y={CHART_H + 43} textAnchor="middle"
                fontSize={9} fill="#4b5563" fontFamily="JetBrains Mono, monospace">
                D{d.day_number}
              </text>
              <text x={x + BAR_W / 2} y={CHART_H + 57} textAnchor="middle"
                fontSize={8} fill="#374151" fontFamily="JetBrains Mono, monospace">
                {fmtDate(d.played_at)}
              </text>

              {isHov && (
                <g>
                  <rect x={tipX} y={tipY} width={TOOLTIP_W} height={TOOLTIP_H}
                    rx={6} fill="#0f1219" stroke="#1e2330" strokeWidth={1} />
                  <text x={tipX + 8} y={tipY + 16} fontSize={10} fill="#dce1ea"
                    fontFamily="JetBrains Mono, monospace">
                    {d.kills}k {d.assists}a {d.knocks ?? 0}kd
                  </text>
                  <text x={tipX + 8} y={tipY + 30} fontSize={10} fill="#dce1ea"
                    fontFamily="JetBrains Mono, monospace">
                    {Math.round(d.damage)} dmg
                  </text>
                  <text x={tipX + 8} y={tipY + 44} fontSize={10}
                    fill={d.placement === 1 ? '#f0c040' : d.placement <= 5 ? '#4ade80' : '#dce1ea'}
                    fontFamily="JetBrains Mono, monospace">
                    {d.placement ? `#${d.placement} lugar` : '—'}
                  </text>
                  <text x={tipX + 8} y={tipY + 58} fontSize={9} fill="#6b7280"
                    fontFamily="JetBrains Mono, monospace">
                    {d.map_name ? (MAP_DISPLAY[d.map_name]?.name ?? d.map_name.replace('_Main','')) : '—'}
                  </text>
                </g>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function PriceLineChart({ data }) {
  const [hovered, setHovered] = useState(null)
  if (!data || data.length === 0) return null

  const CHART_W  = 600
  const CHART_H  = 100
  const PAD_L    = 36
  const PAD_R    = 16
  const PAD_T    = 14
  const PAD_B    = 36
  const W        = CHART_W - PAD_L - PAD_R
  const H        = CHART_H - PAD_T - PAD_B

  const prices   = data.map(d => d.cost)
  const minP     = Math.min(...prices)
  const maxP     = Math.max(...prices)
  const range    = maxP - minP || 1

  const xOf = i  => PAD_L + (i / Math.max(data.length - 1, 1)) * W
  const yOf = v  => PAD_T + H - ((v - minP) / range) * H

  const pts = data.map((d, i) => `${xOf(i).toFixed(1)},${yOf(d.cost).toFixed(1)}`).join(' ')

  const sourceColor = s => s === 'manual' ? '#a78bfa' : s === 'new_player' ? '#4ade80' : '#f97316'

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={CHART_W} height={CHART_H} style={{ display: 'block' }}>
        {/* Grid lines */}
        {[0, 0.5, 1].map(t => {
          const y = PAD_T + H - t * H
          const val = minP + t * range
          return (
            <g key={t}>
              <line x1={PAD_L} y1={y} x2={PAD_L + W} y2={y} stroke="#1e2330" strokeWidth={1} />
              <text x={PAD_L - 4} y={y + 4} textAnchor="end" fontSize={9}
                fill="#4b5563" fontFamily="JetBrains Mono, monospace">
                {val.toFixed(0)}
              </text>
            </g>
          )
        })}

        {/* Line */}
        <polyline points={pts} fill="none" stroke="#f97316" strokeWidth={2} strokeLinejoin="round" />

        {/* Dots + labels */}
        {data.map((d, i) => {
          const cx   = xOf(i)
          const cy   = yOf(d.cost)
          const isHov = hovered === i
          const sc   = sourceColor(d.source)
          const stageName = d.stage_name?.replace(/playoffs?/i, 'PO').replace(/qualif\w+/i, 'Q') ?? ''
          const shortLabel = stageName.length > 8 ? stageName.slice(0, 7) + '…' : stageName

          // tooltip position
          const tipW = 130
          const tipH = 52
          const tipX = cx + tipW + 4 > CHART_W ? cx - tipW - 4 : cx + 4
          const tipY = cy - tipH - 4 < 0 ? cy + 8 : cy - tipH - 4

          return (
            <g key={d.stage_id ?? i}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: 'default' }}
            >
              {/* hover hit area */}
              <rect x={cx - 14} y={0} width={28} height={CHART_H} fill="transparent" />

              <circle cx={cx} cy={cy} r={isHov ? 5 : 3.5} fill={sc} stroke="#0a0c11" strokeWidth={1.5} />

              {/* X-axis label */}
              <text x={cx} y={CHART_H - 4} textAnchor="middle" fontSize={8}
                fill={isHov ? '#dce1ea' : '#6b7280'} fontFamily="JetBrains Mono, monospace">
                {shortLabel}
              </text>

              {isHov && (
                <g>
                  <rect x={tipX} y={tipY} width={tipW} height={tipH}
                    rx={5} fill="#0f1219" stroke="#1e2330" strokeWidth={1} />
                  <text x={tipX + 8} y={tipY + 15} fontSize={10} fill="#dce1ea"
                    fontFamily="JetBrains Mono, monospace" fontWeight={700}>
                    {d.cost} pts
                  </text>
                  <text x={tipX + 8} y={tipY + 28} fontSize={9} fill={sc}
                    fontFamily="JetBrains Mono, monospace">
                    {d.source ?? '—'}
                  </text>
                  <text x={tipX + 8} y={tipY + 41} fontSize={8} fill="#6b7280"
                    fontFamily="JetBrains Mono, monospace">
                    {d.stage_name}
                  </text>
                </g>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export default function PlayerHistoryModal({
  player,         // objeto roster completo (com price_components)
  personId,
  personName,
  teamName,
  shortName,      // shortName da stage atual (para TeamLogo)
  beforeDate,     // ISO string — mostrar histórico até esta data
  onClose,
}) {
  const [data, setData]             = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [priceHistory, setPriceHistory] = useState([])
  const [crossStats, setCrossStats] = useState(null)
  const overlayRef                  = useRef(null)

  useEffect(() => {
    if (!personId) return
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ limit: 15 })
    if (beforeDate) params.set('before_date', beforeDate)
    fetch(`${API_BASE_URL}/stages/persons/${personId}/match-history?${params}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(d => { setData([...d].reverse()); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [personId, beforeDate])

  useEffect(() => {
    if (!personId) return
    fetch(`${API_BASE_URL}/stages/persons/${personId}/price-history?limit=20`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setPriceHistory(Array.isArray(d) ? d : []))
      .catch(() => setPriceHistory([]))
  }, [personId])

  useEffect(() => {
    if (!personId) return
    fetch(`${API_BASE_URL}/stages/persons/${personId}/stats-cross-stages`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setCrossStats(d))
      .catch(() => setCrossStats(null))
  }, [personId])

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const handleOverlay = (e) => { if (e.target === overlayRef.current) onClose() }

  const avgPts    = data.length ? (data.reduce((s,d) => s + d.xama_points, 0) / data.length).toFixed(1) : '—'
  const bestPts   = data.length ? Math.max(...data.map(d => d.xama_points)).toFixed(1) : '—'
  const totalKills = data.reduce((s,d) => s + d.kills, 0)

  const contextLabel = beforeDate
    ? `até ${new Date(beforeDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}`
    : 'últimas partidas registradas'

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlay}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div style={{
        background: 'var(--xm-surface-1)',
        border: '1px solid var(--xm-border)',
        borderRadius: '14px',
        width: '100%', maxWidth: '740px',
        maxHeight: '90vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px 14px',
          borderBottom: '1px solid var(--xm-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Logo do time */}
            <TeamLogo teamName={teamName} shortName={shortName || ''} size={36} />

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {teamName && (
                  <span style={{
                    fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em',
                    color: 'var(--xm-muted)', fontFamily: "'JetBrains Mono', monospace",
                    background: 'var(--surface-3)', padding: '2px 8px', borderRadius: '4px',
                  }}>
                    {teamName}
                  </span>
                )}
                <span style={{
                  fontSize: '22px', fontWeight: 700,
                  color: 'var(--xm-text)',
                }}>
                  {personName}
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--xm-muted)', marginTop: '3px' }}>
                {data.length} partidas · {contextLabel}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--xm-muted)', fontSize: '22px', lineHeight: 1,
              padding: '4px 8px', borderRadius: '6px',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--xm-text)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--xm-muted)'}
          >
            ✕
          </button>
        </div>

        {/* Stats resumidas */}
        {!loading && !error && data.length > 0 && (
          <div style={{
            padding: '10px 24px',
            display: 'flex', gap: '28px',
            borderBottom: '1px solid var(--xm-border)',
            background: 'var(--surface-2)',
          }}>
            {[
              { label: 'Média pts',      value: avgPts,     color: 'var(--xm-orange)' },
              { label: 'Melhor partida', value: bestPts,    color: 'var(--xm-gold)' },
              { label: 'Total kills',    value: totalKills, color: 'var(--xm-text)' },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div style={{ fontSize: '10px', color: 'var(--xm-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  {label}
                </div>
                <div style={{ fontSize: '20px', fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace" }}>
                  {value}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Stats cross-stage */}
        {crossStats && crossStats.total_matches > 0 && (
          <div style={{
            padding: '8px 24px 10px',
            borderBottom: '1px solid var(--xm-border)',
            background: 'var(--surface-2)',
            display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap',
          }}>
            <div style={{ fontSize: 10, color: 'var(--xm-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, whiteSpace: 'nowrap' }}>
              Histórico total
            </div>
            {[
              { label: 'pts totais', value: crossStats.total_pts?.toFixed(1) },
              { label: 'partidas', value: crossStats.total_matches },
              { label: 'pts/match', value: crossStats.avg_pts_per_match?.toFixed(2) },
              { label: 'campeonatos', value: crossStats.by_championship?.length },
            ].map(({ label, value }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'var(--xm-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--xm-text)', fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Composição do preço */}
        {player && (
          <div style={{
            padding: '8px 24px 10px',
            borderBottom: '1px solid var(--xm-border)',
            background: 'var(--surface-2)',
          }}>
            <PriceBreakdown player={player} />
          </div>
        )}

        {/* Gráfico */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--xm-muted)' }}>
              Carregando histórico...
            </div>
          )}
          {error && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--xm-red)' }}>
              Erro ao carregar histórico.
            </div>
          )}
          {!loading && !error && data.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--xm-muted)' }}>
              Nenhuma partida registrada para este jogador{beforeDate ? ' até esta data' : ''}.
            </div>
          )}
          {!loading && !error && data.length > 0 && <BarChart data={data} />}

          {priceHistory.length > 0 && (
            <div style={{ marginTop: '24px' }}>
              <div style={{
                fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em',
                textTransform: 'uppercase', color: 'var(--xm-muted)',
                marginBottom: '10px',
              }}>
                Evolução de Preço
              </div>
              <PriceLineChart data={priceHistory} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
