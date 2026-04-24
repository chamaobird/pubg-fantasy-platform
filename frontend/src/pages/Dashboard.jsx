// frontend/src/pages/Dashboard.jsx
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { API_BASE_URL } from '../config'
import Navbar from '../components/Navbar'
import { Card, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'

if (!document.getElementById('xama-fonts')) {
  const link = document.createElement('link')
  link.id = 'xama-fonts'; link.rel = 'stylesheet'
  link.href = 'https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=JetBrains+Mono:wght@400;600&display=swap'
  document.head.appendChild(link)
}

if (!document.getElementById('xama-dash-anim')) {
  const s = document.createElement('style')
  s.id = 'xama-dash-anim'
  s.textContent = `
    @keyframes xamaPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
    @keyframes xamaFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes xamaPreviewPulse { 0%, 100% { border-color: rgba(249,115,22,0.3); } 50% { border-color: rgba(249,115,22,0.6); } }
    .xama-pulse { animation: xamaPulse 1.8s ease-in-out infinite; }
    .xama-preview-card { animation: xamaPreviewPulse 2.5s ease-in-out infinite; }
    .xama-open-card { transition: border-color 0.15s, transform 0.15s, box-shadow 0.15s; }
    .xama-open-card:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(249,115,22,0.15); }
    .xama-collapse-btn { background: none; border: none; cursor: pointer; display: flex; align-items: center; gap: 8px; padding: 0; color: var(--color-xama-muted); font-size: 21px; font-weight: 600; letter-spacing: 0.04em; transition: color 0.15s; }
    .xama-collapse-btn:hover { color: var(--color-xama-text); }
    .xama-collapse-chevron { transition: transform 0.2s ease; display: inline-block; }
    .xama-row-item { display: flex; align-items: center; gap: 14px; padding: 14px 20px; border-radius: var(--radius-inner); background: var(--surface-1); border: 1px solid var(--color-xama-border); transition: border-color 0.15s, background 0.15s; cursor: default; }
    .xama-row-item:hover { border-color: rgba(249,115,22,0.25); background: rgba(249,115,22,0.03); }
    .xama-row-item-clickable { cursor: pointer; }
    .xama-row-item-clickable:hover { border-color: rgba(249,115,22,0.35); background: rgba(249,115,22,0.05); }
    .xama-section-fade { animation: xamaFadeIn 0.25s ease both; }
  `
  document.head.appendChild(s)
}

const fmt1 = (v) => v != null ? Number(v).toFixed(1) : '—'

// ── Countdown ─────────────────────────────────────────────────────────────────

function computeRemaining(targetIso) {
  if (!targetIso) return null
  const diff = new Date(targetIso).getTime() - Date.now()
  if (diff <= 0) return null
  const totalMins = Math.floor(diff / 60_000)
  const hours = Math.floor(totalMins / 60)
  const mins = totalMins % 60
  const days = Math.floor(hours / 24)
  return { diff, days, hours: hours % 24, mins }
}

function useCountdown(targetIso) {
  const [remaining, setRemaining] = useState(() => computeRemaining(targetIso))
  useEffect(() => {
    setRemaining(computeRemaining(targetIso))
    const timer = setInterval(() => setRemaining(computeRemaining(targetIso)), 30_000)
    return () => clearInterval(timer)
  }, [targetIso])
  return remaining
}

function CountdownBadge({ targetIso }) {
  const r = useCountdown(targetIso)
  if (!r) return null

  let label, color, bg, border
  if (r.diff > 24 * 3_600_000) {
    label = `Fecha em ${r.days}d ${r.hours}h`
    color = 'var(--color-xama-muted)'
    bg    = 'rgba(148,163,184,0.06)'
    border = 'rgba(148,163,184,0.15)'
  } else if (r.diff > 3_600_000) {
    label = `Fecha em ${r.hours}h ${r.mins}min`
    color = 'var(--color-xama-orange)'
    bg    = 'rgba(249,115,22,0.08)'
    border = 'rgba(249,115,22,0.25)'
  } else {
    label = `⚠ Fecha em ${r.hours > 0 ? `${r.hours}h ` : ''}${r.mins}min`
    color = '#f87171'
    bg    = 'rgba(248,113,113,0.08)'
    border = 'rgba(248,113,113,0.25)'
  }

  return (
    <span style={{
      fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em',
      fontFamily: 'JetBrains Mono, monospace',
      padding: '2px 8px', borderRadius: 4,
      background: bg, border: `1px solid ${border}`, color,
    }}>
      {label}
    </span>
  )
}

// Formata "Qui, 17 abr" a partir de ISO string
function fmtDateFull(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  })
}

// Formata "21:00" no fuso de Brasília
function fmtTime(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

// "Qui, 17 abr · 21:00" — usa start_date preferencial, fallback lineup_open_at
function buildDateLabel(stage) {
  const src = stage.start_date || stage.lineup_open_at
  if (!src) return null
  const date = fmtDateFull(src)
  const time = fmtTime(src)
  return time ? `${date} · ${time}` : date
}

// Range "17–19 abr" para stages multi-dia
function buildDateRange(stage) {
  const start = stage.start_date || stage.lineup_open_at
  const end   = stage.end_date   || stage.lineup_close_at
  if (!start) return null
  const d1 = new Date(start).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  if (!end) return d1
  const endDay   = new Date(end).toLocaleDateString('pt-BR', { day: '2-digit' })
  const endMonth = new Date(end).toLocaleDateString('pt-BR', { month: 'short' })
  const startDay = new Date(start).toLocaleDateString('pt-BR', { day: '2-digit' })
  const startMonth = new Date(start).toLocaleDateString('pt-BR', { month: 'short' })
  if (startMonth === endMonth) return `${startDay}–${endDay} ${startMonth}`
  return `${startDay} ${startMonth} – ${endDay} ${endMonth}`
}

// ── ChampLogo ────────────────────────────────────────────────────────────────

const LOGO_CANDIDATES = {
  PGS: ['/logos/Tournaments/PGS.webp', '/logos/Tournaments/PGS.png'],
  PAS: ['/logos/Tournaments/PASshort.png', '/logos/Tournaments/PAS.png'],
  PEC: ['/logos/Tournaments/PECshort.png'],
}

function StageChampLogo({ champName = '', size = 28 }) {
  const upper = (champName || '').toUpperCase()
  const key = (upper.includes('PAS') || upper.includes('AMERICAS')) ? 'PAS'
    : (upper.includes('PGS') || upper.includes('GLOBAL SERIES') || upper.includes('PGC')) ? 'PGS'
    : (upper.includes('PEC') || upper.includes('EMEA')) ? 'PEC'
    : null
  const candidates = key ? LOGO_CANDIDATES[key] : []
  const [idx, setIdx] = useState(0)
  const [failed, setFailed] = useState(false)

  if (!key || failed || candidates.length === 0) {
    return <span style={{ fontSize: size * 0.75 }}>{upper.includes('PAS') ? '🥇' : '🏆'}</span>
  }

  return (
    <img
      src={candidates[idx]}
      alt=""
      draggable={false}
      onError={() => idx + 1 < candidates.length ? setIdx(i => i + 1) : setFailed(true)}
      style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }}
    />
  )
}

// ── CollapseSection ──────────────────────────────────────────────────────────

function CollapseSection({ title, icon, count, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ marginBottom: '36px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: open ? '16px' : '0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>{icon}</span>
          <span style={{
            fontSize: '19px', fontWeight: 700, letterSpacing: '0.07em',
            color: 'var(--color-xama-muted)', textTransform: 'uppercase',
          }}>{title}</span>
          <span style={{
            fontSize: '16px', fontWeight: 700, padding: '2px 10px',
            borderRadius: '20px', background: 'var(--surface-3)',
            color: 'var(--color-xama-muted)', fontFamily: 'JetBrains Mono, monospace',
          }}>{count}</span>
        </div>
        <button className="xama-collapse-btn" onClick={() => setOpen(o => !o)}>
          {open ? 'Recolher' : 'Expandir'}
          <span className="xama-collapse-chevron" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', fontSize: '14px' }}>▼</span>
        </button>
      </div>
      {open && <div className="xama-section-fade">{children}</div>}
    </div>
  )
}

// ── StageRow ─────────────────────────────────────────────────────────────────

function StageRow({ stage, onClick, champName, userScore, userRank }) {
  const dateLabel = buildDateLabel(stage)
  const isResult = !!onClick

  return (
    <div
      className={onClick ? 'xama-row-item xama-row-item-clickable' : 'xama-row-item'}
      onClick={onClick}
      style={{ gap: '14px' }}
    >
      {/* Logo */}
      <div style={{ flexShrink: 0, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <StageChampLogo champName={champName} size={32} />
      </div>

      {/* Texto */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '16px', fontWeight: 600, color: 'var(--color-xama-text)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{stage.name}</div>
        <div style={{ fontSize: '12px', color: 'var(--color-xama-muted)', marginTop: '2px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {champName && (
            <span style={{ color: 'rgba(249,115,22,0.7)', fontWeight: 500 }}>{champName}</span>
          )}
          {dateLabel && (
            <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{dateLabel}</span>
          )}
          {!dateLabel && <span>Em breve</span>}
        </div>
      </div>

      {/* Lado direito */}
      {isResult ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', flexShrink: 0 }}>
          {userScore != null ? (
            <>
              <span style={{
                fontSize: '16px', fontWeight: 700, color: 'var(--color-xama-orange)',
                fontFamily: 'JetBrains Mono, monospace',
              }}>{fmt1(userScore)} pts</span>
              {userRank && (
                <span style={{ fontSize: '11px', color: 'var(--color-xama-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                  #{userRank}
                </span>
              )}
            </>
          ) : (
            <span style={{
              fontSize: '12px', fontWeight: 600, letterSpacing: '0.06em',
              padding: '3px 9px', borderRadius: 4,
              background: 'rgba(107,114,128,0.12)', border: '1px solid rgba(107,114,128,0.2)',
              color: 'var(--color-xama-muted)', fontFamily: 'JetBrains Mono, monospace',
            }}>SEM LINEUP</span>
          )}
          <span style={{ color: 'var(--color-xama-muted)', fontSize: '18px' }}>›</span>
        </div>
      ) : (
        <span style={{
          fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em',
          padding: '3px 10px', borderRadius: 4, flexShrink: 0,
          background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)',
          color: 'var(--color-xama-orange)', fontFamily: 'JetBrains Mono, monospace',
        }}>⏳ EM BREVE</span>
      )}
    </div>
  )
}

// ── PreviewCard — card compacto para stages em preview (hierarquia abaixo do open) ─
function PreviewCard({ s, champMap, navigate }) {
  const champ     = champMap[s.id]
  const dateLabel = buildDateLabel(s)

  return (
    <div style={{
      background: 'var(--surface-1)',
      border: '1px solid rgba(249,115,22,0.18)',
      borderLeft: '2px solid rgba(249,115,22,0.35)',
      borderRadius: 'var(--radius-card)',
      padding: '11px 14px 11px 16px',
      display: 'flex',
      gap: '12px',
      alignItems: 'center',
    }}>
      {/* Logo pequena */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, opacity: 0.7 }}>
        <StageChampLogo champName={champ?.name} size={28} />
      </div>

      {/* Info central */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '10px', fontWeight: 700, letterSpacing: '0.07em',
            padding: '1px 6px', borderRadius: 3,
            background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.18)',
            color: 'rgba(249,115,22,0.65)', fontFamily: 'JetBrains Mono, monospace',
          }}>EM BREVE</span>
          {champ && (
            <span style={{ fontSize: '10px', color: 'var(--color-xama-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
              {champ.name}
            </span>
          )}
        </div>

        <div style={{
          fontSize: '15px', fontWeight: 600, color: 'var(--color-xama-text)',
          opacity: 0.75, lineHeight: 1.2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{s.name}</div>

        {dateLabel && (
          <div style={{ fontSize: '11px', color: 'var(--color-xama-muted)', fontFamily: 'JetBrains Mono, monospace', marginTop: '2px' }}>
            {dateLabel}
          </div>
        )}
      </div>

      {/* Botão discreto */}
      <div style={{ flexShrink: 0 }}>
        <button
          onClick={() => navigate(`/tournament/${s.id}`)}
          style={{
            background: 'none', border: '1px solid rgba(249,115,22,0.2)',
            borderRadius: 6, padding: '4px 10px',
            fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em',
            color: 'rgba(249,115,22,0.55)', cursor: 'pointer',
            fontFamily: 'JetBrains Mono, monospace', transition: 'border-color 0.15s, color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(249,115,22,0.45)'; e.currentTarget.style.color = 'var(--color-xama-orange)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(249,115,22,0.2)'; e.currentTarget.style.color = 'rgba(249,115,22,0.55)' }}
        >
          VER LOBBY
        </button>
      </div>
    </div>
  )
}

// ── OpenCard — card grande para stages com lineup aberta ─────────────────────

function OpenCard({ s, lineup, champMap, navigate, previewCount = 0, expanded = true, onToggle }) {
  const hasLineup = !!lineup
  const champ     = champMap[s.id]
  const dateLabel = buildDateLabel(s)

  const borderColor = hasLineup ? 'rgba(74,222,128,0.25)' : 'rgba(249,115,22,0.35)'
  const glowBg      = hasLineup
    ? 'radial-gradient(circle at 80% 50%, rgba(74,222,128,0.07) 0%, transparent 65%)'
    : 'radial-gradient(circle at 80% 50%, rgba(249,115,22,0.09) 0%, transparent 65%)'

  const subtitle = [champ?.name, dateLabel].filter(Boolean).join(' · ')

  return (
    <div className="xama-open-card" style={{
      background: 'var(--surface-1)',
      border: `1px solid ${borderColor}`,
      borderRadius: 'var(--radius-card)',
      padding: '18px 22px',
      position: 'relative', overflow: 'hidden',
      display: 'flex', alignItems: 'center', gap: '22px',
      flexWrap: 'wrap',
    }}>
      <div style={{ position: 'absolute', inset: 0, background: glowBg, pointerEvents: 'none' }} />

      {/* Coluna 1 — Logo âncora */}
      <div className="dash-open-logo" style={{
        flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '108px', height: '108px',
      }}>
        <StageChampLogo champName={champ?.name} size={100} />
      </div>

      {/* Coluna 2 — Título + subtítulo */}
      <div style={{ flex: 1, minWidth: '160px' }}>
        <div style={{
          fontSize: '26px', fontWeight: 700,
          color: 'var(--color-xama-text)',
          lineHeight: 1.15, letterSpacing: '-0.02em',
          marginBottom: '6px',
        }}>
          {s.name}
        </div>
        {subtitle && (
          <div style={{
            fontSize: '12px', color: 'var(--color-xama-muted)',
            fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.5,
          }}>
            {champ && (
              <span style={{ color: 'rgba(249,115,22,0.7)', fontWeight: 600 }}>{champ.name}</span>
            )}
            {champ && dateLabel && <span style={{ margin: '0 5px', opacity: 0.4 }}>·</span>}
            {dateLabel && <span>{dateLabel}</span>}
          </div>
        )}
        <div style={{ marginTop: '8px' }}>
          <CountdownBadge targetIso={s.start_date || s.lineup_open_at} />
        </div>
      </div>

      {/* Coluna 3 — Status + CTA */}
      <div className="dash-open-col3" style={{
        flexShrink: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px',
      }}>
        {/* Badge ABERTA — discreto */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span className="xama-pulse" style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: 'var(--color-xama-orange)', display: 'inline-block',
          }} />
          <span style={{
            fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em',
            color: 'var(--color-xama-orange)', textTransform: 'uppercase',
            fontFamily: 'JetBrains Mono, monospace',
          }}>ABERTA</span>
        </div>

        {/* Chip "Montada" ou pts */}
        {hasLineup && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
            <span style={{
              fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em',
              padding: '3px 10px', borderRadius: '20px',
              background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)',
              color: 'var(--color-xama-green)',
            }}>✓ Montada</span>
            {lineup.total_points != null && (
              <span style={{
                fontSize: '20px', fontWeight: 700,
                color: 'var(--color-xama-orange)',
                fontFamily: 'JetBrains Mono, monospace',
              }}>{fmt1(lineup.total_points)} pts</span>
            )}
          </div>
        )}

        {/* Botão */}
        <Button variant="primary" size="sm" onClick={() => navigate(`/tournament/${s.id}`)}>
          {hasLineup ? 'VER TORNEIO' : 'MONTAR LINEUP'}
        </Button>
      </div>

      {/* Linha expand/collapse — só aparece se houver etapas em preview */}
      {previewCount > 0 && (
        <div style={{
          flexBasis: '100%', width: '100%',
          borderTop: '1px solid rgba(249,115,22,0.12)',
          paddingTop: '10px', marginTop: '2px',
        }}>
          <button
            onClick={e => { e.stopPropagation(); onToggle && onToggle() }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '7px',
              color: 'var(--color-xama-muted)', fontSize: '12px',
              fontWeight: 600, letterSpacing: '0.05em',
              fontFamily: 'JetBrains Mono, monospace',
              padding: '0', transition: 'color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--color-xama-orange)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--color-xama-muted)'}
          >
            <span style={{ transition: 'transform 0.2s ease', display: 'inline-block', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
            {expanded
              ? 'Ocultar etapas seguintes'
              : `Ver ${previewCount} etapa${previewCount > 1 ? 's' : ''} seguinte${previewCount > 1 ? 's' : ''}`}
          </button>
        </div>
      )}
    </div>
  )
}

// ── LockedActiveCard — card grande para stage locked com dias em preview ──────

function LockedActiveCard({ s, lineup, champMap, navigate, previewCount = 0, expanded = true, onToggle }) {
  const champ     = champMap[s.id]
  const dateLabel = buildDateLabel(s)
  const hasLineup = !!lineup

  return (
    <div className="xama-open-card" style={{
      background: 'var(--surface-1)',
      border: '1px solid rgba(249,115,22,0.30)',
      borderRadius: 'var(--radius-card)',
      padding: '18px 22px',
      position: 'relative', overflow: 'hidden',
      display: 'flex', alignItems: 'center', gap: '22px',
      flexWrap: 'wrap',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(circle at 80% 50%, rgba(249,115,22,0.07) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />

      {/* Coluna 1 — Logo */}
      <div className="dash-open-logo" style={{
        flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '108px', height: '108px',
      }}>
        <StageChampLogo champName={champ?.name} size={100} />
      </div>

      {/* Coluna 2 — Título + subtítulo */}
      <div style={{ flex: 1, minWidth: '160px' }}>
        <div style={{
          fontSize: '26px', fontWeight: 700,
          color: 'var(--color-xama-text)',
          lineHeight: 1.15, letterSpacing: '-0.02em',
          marginBottom: '6px',
        }}>
          {s.name}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--color-xama-muted)', fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.5 }}>
          {champ && <span style={{ color: 'rgba(249,115,22,0.7)', fontWeight: 600 }}>{champ.name}</span>}
          {champ && dateLabel && <span style={{ margin: '0 5px', opacity: 0.4 }}>·</span>}
          {dateLabel && <span>{dateLabel}</span>}
        </div>
      </div>

      {/* Coluna 3 — Status + CTA */}
      <div className="dash-open-col3" style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
        {/* Badge EM JOGO */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span className="xama-pulse" style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: 'var(--color-xama-orange)', display: 'inline-block',
          }} />
          <span style={{
            fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em',
            color: 'var(--color-xama-orange)', textTransform: 'uppercase',
            fontFamily: 'JetBrains Mono, monospace',
          }}>EM JOGO</span>
        </div>

        {hasLineup && lineup.total_points != null && (
          <span style={{
            fontSize: '20px', fontWeight: 700,
            color: 'var(--color-xama-orange)',
            fontFamily: 'JetBrains Mono, monospace',
          }}>{fmt1(lineup.total_points)} pts</span>
        )}
        {!hasLineup && (
          <span style={{
            fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em',
            padding: '3px 10px', borderRadius: '20px',
            background: 'rgba(107,114,128,0.12)', border: '1px solid rgba(107,114,128,0.2)',
            color: 'var(--color-xama-muted)', fontFamily: 'JetBrains Mono, monospace',
          }}>SEM LINEUP</span>
        )}

        <Button variant="primary" size="sm" onClick={() => navigate(`/tournament/${s.id}?tab=leaderboard`)}>
          VER RESULTADO
        </Button>
      </div>

      {/* Linha expand/collapse — só aparece se houver etapas em preview */}
      {previewCount > 0 && (
        <div style={{
          flexBasis: '100%', width: '100%',
          borderTop: '1px solid rgba(249,115,22,0.12)',
          paddingTop: '10px', marginTop: '2px',
        }}>
          <button
            onClick={e => { e.stopPropagation(); onToggle && onToggle() }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '7px',
              color: 'var(--color-xama-muted)', fontSize: '12px',
              fontWeight: 600, letterSpacing: '0.05em',
              fontFamily: 'JetBrains Mono, monospace',
              padding: '0', transition: 'color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--color-xama-orange)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--color-xama-muted)'}
          >
            <span style={{ transition: 'transform 0.2s ease', display: 'inline-block', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
            {expanded
              ? 'Ocultar etapas seguintes'
              : `Ver ${previewCount} etapa${previewCount > 1 ? 's' : ''} seguinte${previewCount > 1 ? 's' : ''}`}
          </button>
        </div>
      )}
    </div>
  )
}

// ── ClosedPrimaryCard — card destaque para o 1º dia de uma championship em breve ─

function ClosedPrimaryCard({ s, champMap, navigate, nextCount = 0, expanded = true, onToggle }) {
  const champ     = champMap[s.id]
  const dateLabel = buildDateLabel(s)

  return (
    <div style={{
      background: 'var(--surface-1)',
      border: '1px solid rgba(148,163,184,0.14)',
      borderRadius: 'var(--radius-card)',
      padding: '18px 22px',
      position: 'relative', overflow: 'hidden',
      display: 'flex', alignItems: 'center', gap: '22px',
      flexWrap: 'wrap',
    }}>
      {/* Logo */}
      <div style={{
        flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '80px', height: '80px', opacity: 0.55,
      }}>
        <StageChampLogo champName={champ?.name} size={72} />
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: '160px' }}>
        <div style={{
          fontSize: '22px', fontWeight: 700,
          color: 'var(--color-xama-text)', opacity: 0.75,
          lineHeight: 1.15, letterSpacing: '-0.02em',
          marginBottom: '4px',
        }}>
          {s.name}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--color-xama-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
          {champ && <span style={{ color: 'rgba(249,115,22,0.5)', fontWeight: 600 }}>{champ.name}</span>}
          {champ && dateLabel && <span style={{ margin: '0 5px', opacity: 0.4 }}>·</span>}
          {dateLabel && <span>{dateLabel}</span>}
        </div>
        <div style={{ marginTop: '6px' }}>
          <CountdownBadge targetIso={s.start_date || s.lineup_open_at} />
        </div>
      </div>

      {/* Badge + botão */}
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
        <span style={{
          fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em',
          padding: '3px 10px', borderRadius: 4,
          background: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.15)',
          color: 'var(--color-xama-muted)', fontFamily: 'JetBrains Mono, monospace',
        }}>EM BREVE</span>
        <button
          onClick={() => navigate(`/tournament/${s.id}`)}
          style={{
            background: 'none', border: '1px solid rgba(148,163,184,0.2)',
            borderRadius: 6, padding: '5px 12px',
            fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em',
            color: 'var(--color-xama-muted)', cursor: 'pointer',
            fontFamily: 'JetBrains Mono, monospace', transition: 'border-color 0.15s, color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(249,115,22,0.35)'; e.currentTarget.style.color = 'var(--color-xama-orange)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(148,163,184,0.2)'; e.currentTarget.style.color = 'var(--color-xama-muted)' }}
        >
          VER LOBBY
        </button>
      </div>

      {/* Expand/collapse próximos dias */}
      {nextCount > 0 && (
        <div style={{
          flexBasis: '100%', width: '100%',
          borderTop: '1px solid rgba(148,163,184,0.08)',
          paddingTop: '10px', marginTop: '2px',
        }}>
          <button
            onClick={e => { e.stopPropagation(); onToggle?.() }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '7px',
              color: 'var(--color-xama-muted)', fontSize: '12px',
              fontWeight: 600, letterSpacing: '0.05em',
              fontFamily: 'JetBrains Mono, monospace',
              padding: '0', transition: 'color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--color-xama-orange)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--color-xama-muted)'}
          >
            <span style={{ transition: 'transform 0.2s ease', display: 'inline-block', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
            {expanded
              ? 'Ocultar próximas etapas'
              : `Ver ${nextCount} próxima${nextCount > 1 ? 's' : ''} etapa${nextCount > 1 ? 's' : ''}`}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { token } = useAuth()
  const navigate  = useNavigate()
  const H = { Authorization: `Bearer ${token}` }

  const [user,           setUser]           = useState(null)
  const [stages,         setStages]         = useState([])
  const [champMap,       setChampMap]       = useState({})
  const [myLineups,      setMyLineups]      = useState({})
  const [loading,        setLoading]        = useState(true)
  const [expandedChamps, setExpandedChamps] = useState({})

  const toggleChamp = (champId) =>
    setExpandedChamps(prev => ({ ...prev, [champId]: !(prev[champId] !== false) }))

  useEffect(() => {
    if (!token) return
    fetch(`${API_BASE_URL}/auth/me`, { headers: H })
      .then(r => {
        if (r.status === 401) { window.dispatchEvent(new Event('auth:session-expired')); return null }
        return r.ok ? r.json() : null
      })
      .then(setUser)
      .catch(() => {})
  }, [token])

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE_URL}/stages/`).then(r => r.json()),
      fetch(`${API_BASE_URL}/championships/?include_inactive=true`).then(r => r.json()),
    ])
      .then(([stagesData, champsData]) => {
        setStages(Array.isArray(stagesData) ? stagesData : [])
        const map = {}
        if (Array.isArray(champsData)) {
          champsData.forEach(c => {
            if (Array.isArray(c.stages)) {
              c.stages.forEach(s => { map[s.id] = { id: c.id, name: c.name } })
            }
          })
        }
        setChampMap(map)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Busca lineups para stages open E locked (para mostrar pontuação em Resultados)
  useEffect(() => {
    if (!token || stages.length === 0) return
    const relevantStages = stages.filter(s => ['open', 'locked', 'live'].includes(s.lineup_status))
    relevantStages.forEach(s => {
      fetch(`${API_BASE_URL}/lineups/stage/${s.id}`, { headers: H })
        .then(r => {
          if (r.status === 401) { window.dispatchEvent(new Event('auth:session-expired')); return [] }
          return r.ok ? r.json() : []
        })
        .then(lineups => {
          if (lineups.length > 0)
            setMyLineups(prev => ({ ...prev, [s.id]: lineups[0] }))
        })
        .catch(() => {})
    })
  }, [stages, token])

  const sortByDate = (arr, desc = false) => [...arr].sort((a, b) => {
    const da = new Date(a.start_date || a.lineup_open_at || '9999').getTime()
    const db = new Date(b.start_date || b.lineup_open_at || '9999').getTime()
    return desc ? db - da : da - db
  })

  // Agrupa stages por campeonato para exibição hierárquica
  const champGroups = useMemo(() => {
    const groups = {}
    stages.forEach(s => {
      const c = champMap[s.id]
      if (!c) return
      const cid = c.id
      if (!groups[cid]) groups[cid] = { champ: c, open: null, locked: null, previews: [], closeds: [] }
      if (s.lineup_status === 'open')         groups[cid].open = s
      else if (s.lineup_status === 'locked' || s.lineup_status === 'live') {
        // Manter sempre o locked/live mais recente (maior start_date) como "ativo"
        const cur = groups[cid].locked
        if (!cur || new Date(s.start_date) > new Date(cur.start_date)) groups[cid].locked = s
      }
      else if (s.lineup_status === 'preview') groups[cid].previews.push(s)
      else if (s.lineup_status === 'closed')  groups[cid].closeds.push(s)
    })
    Object.values(groups).forEach(g => {
      g.previews = sortByDate(g.previews)
    })
    return groups
  }, [stages, champMap])

  // Championships em breve com múltiplos dias — agrupados hierarquicamente
  // Inclui grupos com previews (Dia 2, 3…) quando o Dia 1 já está locked (encerrado, não live)
  const closedChampGroupsList = useMemo(() => {
    const groups = Object.values(champGroups)
      .filter(g =>
        !g.open &&
        !(g.locked?.lineup_status === 'live') &&
        (g.closeds.length > 0 || g.previews.length > 0)
      )
      .map(g => ({
        ...g,
        // Mescla previews + closeds como "dias aguardando abertura"
        closeds: sortByDate([...g.previews, ...g.closeds]),
      }))
    return groups.sort((a, b) => {
      const da = new Date(a.closeds[0]?.start_date || a.closeds[0]?.lineup_open_at || '9999').getTime()
      const db = new Date(b.closeds[0]?.start_date || b.closeds[0]?.lineup_open_at || '9999').getTime()
      return da - db
    })
  }, [champGroups])

  // Closed sem championship group (stages soltas sem agrupamento)
  const closedStages = useMemo(() => {
    const groupedChampIds = new Set(closedChampGroupsList.map(g => g.champ.id))
    return sortByDate(stages.filter(s => {
      if (s.lineup_status !== 'closed') return false
      const c = champMap[s.id]
      return !c || !groupedChampIds.has(c.id)
    }))
  }, [stages, champMap, closedChampGroupsList])

  // Campeonatos com stage "ativa": open ou live (locked encerrado nunca aparece aqui)
  const activeChampGroups = useMemo(() =>
    Object.values(champGroups)
      .filter(g => g.open || g.locked?.lineup_status === 'live')
      .sort((a, b) => {
        // open primeiro, depois locked
        if (a.open && !b.open) return -1
        if (!a.open && b.open) return 1
        const sa = a.open || a.locked
        const sb = b.open || b.locked
        return new Date(sa?.start_date || '9999') - new Date(sb?.start_date || '9999')
      }),
    [champGroups]
  )

  // Locked sem preview filhos → vai para Resultados (live nunca vai para Resultados)
  const pureLockedStages = useMemo(() => {
    const activeLockedIds = new Set(
      activeChampGroups.filter(g => g.locked && !g.open).map(g => g.locked.id)
    )
    return sortByDate(
      stages.filter(s => s.lineup_status === 'locked' && !activeLockedIds.has(s.id)),
      true
    )
  }, [stages, activeChampGroups])

  const hasActive = activeChampGroups.length > 0

  const displayName = user?.display_name || user?.username
    || (user?.email ? user.email.split('@')[0] : 'jogador')

  if (loading) return (
    <div className="xama-page">
      <Navbar />
      <div className="xama-loading" style={{ flex: 1 }}>Carregando dashboard...</div>
    </div>
  )

  return (
    <div className="xama-page">
      <Navbar />
      <div className="xama-container" style={{ flex: 1, paddingTop: '36px', paddingBottom: '64px' }}>

        {/* Saudação */}
        <div style={{ marginBottom: '44px' }}>
          <h1 style={{
            fontSize: '42px', fontWeight: 800, color: 'var(--color-xama-text)',
            margin: '0 0 10px', letterSpacing: '-0.02em',
            lineHeight: 1.1,
          }}>
            Olá, {displayName.toUpperCase()} 👋
          </h1>
          <p style={{ fontSize: '22px', color: 'var(--color-xama-muted)', margin: 0 }}>
            Bem-vindo ao XAMA Fantasy — aqui está o resumo do seu fantasy.
          </p>
        </div>

        {/* ── SEÇÃO 1 — CAMPEONATOS ATIVOS ── */}
        {hasActive && (
          <div style={{ marginBottom: '48px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
              <span style={{ fontSize: '20px' }}>⚡</span>
              <span style={{ fontSize: '19px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--color-xama-orange)', textTransform: 'uppercase' }}>
                Lineup Aberta
              </span>
              <span style={{
                fontSize: '16px', fontWeight: 700, padding: '2px 10px',
                borderRadius: '20px', background: 'rgba(249,115,22,0.15)',
                color: 'var(--color-xama-orange)', fontFamily: 'JetBrains Mono, monospace',
              }}>{activeChampGroups.length}</span>
            </div>

            {/* Um bloco por campeonato ativo */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {activeChampGroups.map(g => {
                const isExpanded = expandedChamps[g.champ.id] !== false  // default: expanded
                const toggle = () => toggleChamp(g.champ.id)
                return (
                  <div key={g.champ.id}>
                    {/* Card principal — grande */}
                    {g.open && (
                      <OpenCard
                        s={g.open}
                        lineup={myLineups[g.open.id]}
                        champMap={champMap}
                        navigate={navigate}
                        previewCount={g.previews.length}
                        expanded={isExpanded}
                        onToggle={toggle}
                      />
                    )}
                    {!g.open && g.locked && (
                      <LockedActiveCard
                        s={g.locked}
                        lineup={myLineups[g.locked.id]}
                        champMap={champMap}
                        navigate={navigate}
                        previewCount={g.previews.length}
                        expanded={isExpanded}
                        onToggle={toggle}
                      />
                    )}

                    {/* Cards preview — compactos e recuados, colapsáveis */}
                    {g.previews.length > 0 && isExpanded && (
                      <div style={{ marginLeft: 'clamp(32px, 15%, 120px)', marginTop: '10px' }}>
                        <div style={{
                          paddingLeft: '16px',
                          paddingTop: '10px',
                          paddingBottom: '4px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}>
                          {g.previews.map(s => (
                            <PreviewCard key={s.id} s={s} champMap={champMap} navigate={navigate} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── SEÇÃO 2 — AGUARDANDO ABERTURA ── */}
        {(closedChampGroupsList.length > 0 || closedStages.length > 0) && (
          <CollapseSection
            title="Aguardando Abertura"
            icon="📅"
            count={closedChampGroupsList.length + closedStages.length}
            defaultOpen={true}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

              {/* Championships agrupadas — D1 em destaque, D2/D3 como sub-cards */}
              {closedChampGroupsList.map(g => {
                const [primary, ...rest] = g.closeds
                const key = `closed_${g.champ.id}`
                const isExpanded = expandedChamps[key] !== false
                const toggle = () => setExpandedChamps(prev => ({ ...prev, [key]: !isExpanded }))
                return (
                  <div key={g.champ.id}>
                    <ClosedPrimaryCard
                      s={primary}
                      champMap={champMap}
                      navigate={navigate}
                      nextCount={rest.length}
                      expanded={isExpanded}
                      onToggle={toggle}
                    />
                    {rest.length > 0 && isExpanded && (
                      <div style={{ marginLeft: 'clamp(32px, 15%, 120px)', marginTop: '10px' }}>
                        <div style={{ paddingLeft: '16px', paddingTop: '10px', paddingBottom: '4px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {rest.map(s => (
                            <PreviewCard key={s.id} s={s} champMap={champMap} navigate={navigate} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Stages soltas sem agrupamento */}
              {closedStages.map(s => (
                <StageRow
                  key={s.id}
                  stage={s}
                  champName={champMap[s.id]?.name}
                  onClick={null}
                />
              ))}
            </div>
          </CollapseSection>
        )}

        {/* ── SEÇÃO 3 — RESULTADOS (locked sem previews filhos) ── */}
        {pureLockedStages.length > 0 && (
          <CollapseSection title="Resultados" icon="📊" count={pureLockedStages.length} defaultOpen={false}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {pureLockedStages.map(s => {
                const lineup = myLineups[s.id]
                return (
                  <StageRow
                    key={s.id}
                    stage={s}
                    champName={champMap[s.id]?.name}
                    onClick={() => navigate(`/tournament/${s.id}?tab=leaderboard`)}
                    userScore={lineup?.total_points}
                    userRank={lineup?.rank}
                  />
                )
              })}
            </div>
          </CollapseSection>
        )}

        {stages.length === 0 && (
          <Card variant="ghost" style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎮</div>
            <CardTitle>Nenhum torneio ativo no momento</CardTitle>
            <p style={{ color: 'var(--color-xama-muted)', marginTop: '8px' }}>
              Em breve novos torneios estarão disponíveis. Fique ligado!
            </p>
          </Card>
        )}

      </div>
    </div>
  )
}
