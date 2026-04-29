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

function CountdownBadge({ targetIso, mode = 'close' }) {
  // mode='close' → "Fecha em" (prazo de edição do lineup)
  // mode='open'  → "Abre em"  (seção preview — conta até o lineup abrir)
  const r = useCountdown(targetIso)
  if (!r) return null

  const verb = mode === 'open' ? 'Abre em' : 'Fecha em'
  let label, color, bg, border
  if (r.diff > 24 * 3_600_000) {
    label = `${verb} ${r.days}d ${r.hours}h`
    color = 'var(--color-xama-muted)'
    bg    = 'rgba(148,163,184,0.06)'
    border = 'rgba(148,163,184,0.15)'
  } else if (r.diff > 3_600_000) {
    label = `${verb} ${r.hours}h ${r.mins}min`
    color = 'var(--color-xama-orange)'
    bg    = 'rgba(249,115,22,0.08)'
    border = 'rgba(249,115,22,0.25)'
  } else {
    label = `⚠ ${verb} ${r.hours > 0 ? `${r.hours}h ` : ''}${r.mins}min`
    color = mode === 'open' ? 'var(--color-xama-orange)' : '#f87171'
    bg    = mode === 'open' ? 'rgba(249,115,22,0.08)' : 'rgba(248,113,113,0.08)'
    border = mode === 'open' ? 'rgba(249,115,22,0.25)' : 'rgba(248,113,113,0.25)'
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

// start_date / end_date são "datas de jogo" — armazenados como TIMESTAMPTZ midnight UTC.
// Ao usar new Date("2026-05-01T00:00:00Z") o browser converte para fuso local e mostra "30 abr".
// Solução: parsear a parte YYYY-MM-DD como data local (sem deslocamento UTC).
function parseDateLocal(iso) {
  if (!iso) return null
  const [y, m, d] = iso.substring(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d) // midnight local — sem shift de fuso
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

// Formata "21:00" no fuso local
function fmtTime(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

// "Qui, 1 mai · 21:00"
// start_date → se tem hora (não é meia-noite UTC), usa conversão UTC→local completa (data + hora)
//             se é meia-noite UTC (formato antigo, date-only), usa parseDateLocal para evitar shift
// lineup_open_at → datetime completo, mostra hora
function buildDateLabel(stage) {
  if (stage.start_date) {
    const d = new Date(stage.start_date)
    const isMidnightUtc = d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0
    if (isMidnightUtc) {
      // formato antigo (date-only): usa parseDateLocal para não deslocar o dia
      const ld = parseDateLocal(stage.start_date)
      return ld.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
    }
    // novo formato (datetime): usa UTC→local completo para data e hora ficarem alinhadas
    const datePart = d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
    const timePart = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    return `${datePart} · ${timePart}`
  }
  const src = stage.lineup_open_at
  if (!src) return null
  const date = fmtDateFull(src)
  const time = fmtTime(src)
  return time ? `${date} · ${time}` : date
}

// Range "1–3 mai" para stages multi-dia
function buildDateRange(stage) {
  const startD = stage.start_date ? parseDateLocal(stage.start_date) : null
  const endD   = stage.end_date   ? parseDateLocal(stage.end_date)   : null
  const start  = startD || (stage.lineup_open_at ? new Date(stage.lineup_open_at) : null)
  const end    = endD   || (stage.lineup_close_at ? new Date(stage.lineup_close_at) : null)
  if (!start) return null
  const d1 = start.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  if (!end) return d1
  const endDay    = end.toLocaleDateString('pt-BR', { day: '2-digit' })
  const endMonth  = end.toLocaleDateString('pt-BR', { month: 'short' })
  const startDay  = start.toLocaleDateString('pt-BR', { day: '2-digit' })
  const startMonth = start.toLocaleDateString('pt-BR', { month: 'short' })
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

// ── OffseasonGroupCard ───────────────────────────────────────────────────────

function OffseasonGroupCard({ group, userEntry, navigate }) {
  const rankColors = ['#f0c040', '#b4bcc8', '#cd7f50']
  const isTop3 = userEntry?.rank != null && userEntry.rank <= 3

  return (
    <div style={{
      background: 'var(--surface-1)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 'var(--radius-card)',
      padding: '18px 22px',
      position: 'relative', overflow: 'hidden',
      display: 'flex', alignItems: 'center', gap: '22px', flexWrap: 'wrap',
    }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 80% 50%, rgba(240,192,64,0.05) 0%, transparent 60%)', pointerEvents: 'none' }} />

      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '80px', height: '80px', opacity: 0.75 }}>
        <StageChampLogo champName={group.short_name || group.name} size={72} />
      </div>

      <div style={{ flex: 1, minWidth: '160px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--color-xama-muted)', fontFamily: 'JetBrains Mono, monospace', marginBottom: '5px' }}>
          Resultado final
        </div>
        <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-xama-text)', lineHeight: 1.15, letterSpacing: '-0.02em', marginBottom: '4px' }}>
          {group.name}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--color-xama-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
          {group.championship_ids?.length ?? '?'} fase{(group.championship_ids?.length ?? 0) !== 1 ? 's' : ''} · encerrado
        </div>
      </div>

      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
        <span style={{
          fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em',
          padding: '3px 10px', borderRadius: 4,
          background: 'rgba(107,114,128,0.1)', border: '1px solid rgba(107,114,128,0.2)',
          color: 'var(--color-xama-muted)', fontFamily: 'JetBrains Mono, monospace',
        }}>ENCERRADO</span>

        {userEntry ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
            {userEntry.rank && (
              <span style={{
                fontSize: '28px', fontWeight: 800, lineHeight: 1,
                fontFamily: 'JetBrains Mono, monospace',
                color: isTop3 ? rankColors[userEntry.rank - 1] : 'var(--color-xama-text)',
              }}>
                #{userEntry.rank}
              </span>
            )}
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-xama-orange)', fontFamily: 'JetBrains Mono, monospace' }}>
              {Number(userEntry.total_points).toFixed(2)} pts
            </span>
          </div>
        ) : (
          <span style={{ fontSize: '12px', color: 'var(--color-xama-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
            Sem participação
          </span>
        )}

        <Button variant="secondary" size="sm" onClick={() => navigate(`/group/${group.id}`)}>
          VER RANKING
        </Button>
      </div>
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
  const [apiGroups,      setApiGroups]      = useState([])
  const [profileHistory, setProfileHistory] = useState([])
  const [groupLeaderEntry, setGroupLeaderEntry] = useState(null)

  const toggleChamp = (champId) =>
    setExpandedChamps(prev => {
      const defaultExpanded = activeChampGroups.length === 1
      const current = prev[champId] !== undefined ? prev[champId] : defaultExpanded
      return { ...prev, [champId]: !current }
    })

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

  // Busca championship groups (para offseason card)
  useEffect(() => {
    fetch(`${API_BASE_URL}/championship-groups/`)
      .then(r => r.ok ? r.json() : [])
      .then(setApiGroups)
      .catch(() => {})
  }, [])

  // Busca histórico do usuário (para stat chips)
  useEffect(() => {
    if (!user?.id || !token) return
    fetch(`${API_BASE_URL}/profile/${user.id}/history`, { headers: H })
      .then(r => r.ok ? r.json() : [])
      .then(setProfileHistory)
      .catch(() => {})
  }, [user?.id, token])

  // Busca lineups para stages open E locked (para mostrar pontuação em Resultados)
  useEffect(() => {
    if (!token || stages.length === 0) return
    const relevantStages = stages.filter(s => s.lineup_status === 'open' || s.stage_phase === 'live' || s.stage_phase === 'finished')
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
  // stage_phase controla a seção do dashboard; lineup_status controla submissão
  const champGroups = useMemo(() => {
    const groups = {}
    stages.forEach(s => {
      const c = champMap[s.id]
      if (!c) return
      const cid = c.id
      if (!groups[cid]) groups[cid] = { champ: c, open: null, live: null, previews: [], upcomings: [] }
      if (s.lineup_status === 'open')        groups[cid].open = s
      else if (s.stage_phase === 'live') {
        const cur = groups[cid].live
        if (!cur || new Date(s.start_date) > new Date(cur.start_date)) groups[cid].live = s
      }
      else if (s.stage_phase === 'preview')  groups[cid].previews.push(s)
      else if (s.stage_phase === 'upcoming') groups[cid].upcomings.push(s)
    })
    Object.values(groups).forEach(g => {
      g.previews  = sortByDate(g.previews)
      g.upcomings = sortByDate(g.upcomings)
    })
    return groups
  }, [stages, champMap])

  // Stages em preview (lobby aberto, lineup fechado) — seção "Abrindo em Breve"
  // Exclui stages com lineup_status='open': essas já aparecem em "Lineup Aberta"
  const previewStages = useMemo(() =>
    sortByDate(stages.filter(s => s.stage_phase === 'preview' && s.lineup_status !== 'open')),
    [stages]
  )

  // Campeonatos com stage ativa: open (montando lineup) ou live (partida em andamento)
  const activeChampGroups = useMemo(() =>
    Object.values(champGroups)
      .filter(g => g.open || g.live)
      .sort((a, b) => {
        // open primeiro, depois live
        if (a.open && !b.open) return -1
        if (!a.open && b.open) return 1
        const sa = a.open || a.live
        const sb = b.open || b.live
        return new Date(sa?.start_date || '9999') - new Date(sb?.start_date || '9999')
      }),
    [champGroups]
  )

  // Championships com stages aguardando abertura (upcoming, sem open/live/preview)
  const closedChampGroupsList = useMemo(() => {
    const groups = Object.values(champGroups)
      .filter(g => !g.open && !g.live && g.upcomings.length > 0)
      .map(g => ({
        ...g,
        closeds: g.upcomings,
      }))
    return groups.sort((a, b) => {
      const da = new Date(a.closeds[0]?.start_date || a.closeds[0]?.lineup_open_at || '9999').getTime()
      const db = new Date(b.closeds[0]?.start_date || b.closeds[0]?.lineup_open_at || '9999').getTime()
      return da - db
    })
  }, [champGroups])

  // Stages upcoming soltas sem championship group
  // Exclui: championships em closedChampGroupsList (já têm card próprio)
  //         championships em activeChampGroups (upcoming já aparecem como sub-cards do OpenCard)
  const closedStages = useMemo(() => {
    const groupedChampIds = new Set(closedChampGroupsList.map(g => g.champ.id))
    const activeChampIds  = new Set(activeChampGroups.map(g => g.champ.id))
    return sortByDate(stages.filter(s => {
      if (s.stage_phase !== 'upcoming' || s.lineup_status === 'open') return false
      const c = champMap[s.id]
      if (!c) return true
      return !groupedChampIds.has(c.id) && !activeChampIds.has(c.id)
    }))
  }, [stages, champMap, closedChampGroupsList, activeChampGroups])

  // Stages finished → seção Resultados
  const pureLockedStages = useMemo(() =>
    sortByDate(stages.filter(s => s.stage_phase === 'finished'), true),
    [stages]
  )

  const hasActive = activeChampGroups.length > 0

  // Offseason: nenhum ativo, nenhum preview, dados carregados
  const isOffseason = !loading && !hasActive && previewStages.length === 0

  // Grupo mais recente para o card de offseason
  const offseasonGroup = useMemo(() => {
    if (apiGroups.length === 0) return null
    return [...apiGroups].sort((a, b) => b.id - a.id)[0]
  }, [apiGroups])

  // Busca posição do usuário no grupo offseason
  useEffect(() => {
    if (!isOffseason || !offseasonGroup || !user?.id) return
    setGroupLeaderEntry(null)
    fetch(`${API_BASE_URL}/championship-groups/${offseasonGroup.id}/leaderboard?limit=500`)
      .then(r => r.ok ? r.json() : [])
      .then(entries => {
        const entry = entries.find(e => e.user_id === user.id)
        setGroupLeaderEntry(entry || null)
      })
      .catch(() => {})
  }, [isOffseason, offseasonGroup?.id, user?.id])

  // Métricas do perfil para os stat chips
  const profileStats = useMemo(() => {
    if (!profileHistory.length) return null
    const withRank = profileHistory.filter(h => h.rank != null)
    const bestRank = withRank.length > 0 ? Math.min(...withRank.map(h => h.rank)) : null
    const last = profileHistory[0]
    return {
      bestRank,
      totalStages: profileHistory.length,
      lastPts: last?.total_points,
      lastRank: last?.rank,
      lastChampName: last?.championship_name,
    }
  }, [profileHistory])

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

          {/* Ideia 3 — Stat chips do perfil */}
          {profileStats && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '16px' }}>
              {profileStats.bestRank && (
                <span style={{
                  fontSize: '12px', fontWeight: 700, padding: '4px 12px', borderRadius: 20,
                  background: 'rgba(240,192,64,0.1)', border: '1px solid rgba(240,192,64,0.25)',
                  color: '#f0c040', fontFamily: 'JetBrains Mono, monospace',
                }}>
                  🏆 Melhor posição: #{profileStats.bestRank}
                </span>
              )}
              <span style={{
                fontSize: '12px', fontWeight: 700, padding: '4px 12px', borderRadius: 20,
                background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.15)',
                color: 'var(--color-xama-muted)', fontFamily: 'JetBrains Mono, monospace',
              }}>
                📅 {profileStats.totalStages} stage{profileStats.totalStages !== 1 ? 's' : ''} jogadas
              </span>
              {profileStats.lastPts != null && (
                <span style={{
                  fontSize: '12px', fontWeight: 700, padding: '4px 12px', borderRadius: 20,
                  background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)',
                  color: 'var(--color-xama-orange)', fontFamily: 'JetBrains Mono, monospace',
                }}>
                  🎯 Última: {profileStats.lastPts.toFixed(2)} pts{profileStats.lastRank ? ` · #${profileStats.lastRank}` : ''}
                </span>
              )}
            </div>
          )}
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
                // Com múltiplos campeonatos ativos, sub-cards começam recolhidos por padrão
                const defaultExpanded = activeChampGroups.length === 1
                const isExpanded = expandedChamps[g.champ.id] !== undefined
                  ? expandedChamps[g.champ.id]
                  : defaultExpanded
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
                        previewCount={g.upcomings.length}
                        expanded={isExpanded}
                        onToggle={toggle}
                      />
                    )}
                    {!g.open && g.live && (
                      <LockedActiveCard
                        s={g.live}
                        lineup={myLineups[g.live.id]}
                        champMap={champMap}
                        navigate={navigate}
                        previewCount={g.upcomings.length}
                        expanded={isExpanded}
                        onToggle={toggle}
                      />
                    )}

                    {/* Cards upcoming — próximos dias, compactos e recuados, colapsáveis */}
                    {g.upcomings.length > 0 && isExpanded && (
                      <div style={{ marginLeft: 'clamp(32px, 15%, 120px)', marginTop: '10px' }}>
                        <div style={{
                          paddingLeft: '16px',
                          paddingTop: '10px',
                          paddingBottom: '4px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}>
                          {g.upcomings.map(s => (
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

        {/* ── SEÇÃO OFFSEASON — ENTRE TEMPORADAS (Ideia 1) ── */}
        {isOffseason && (
          <div style={{ marginBottom: '48px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
              <span style={{ fontSize: '20px' }}>☕</span>
              <span style={{ fontSize: '19px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--color-xama-muted)', textTransform: 'uppercase' }}>
                Entre Temporadas
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Card do último championship group */}
              {offseasonGroup && (
                <OffseasonGroupCard
                  group={offseasonGroup}
                  userEntry={groupLeaderEntry}
                  navigate={navigate}
                />
              )}

              {/* Card da última stage jogada */}
              {pureLockedStages[0] && (() => {
                const lastStage  = pureLockedStages[0]
                const lastLineup = myLineups[lastStage.id]
                const champ      = champMap[lastStage.id]
                return (
                  <div
                    onClick={() => navigate(`/tournament/${lastStage.id}?tab=leaderboard`)}
                    style={{
                      background: 'var(--surface-1)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: 'var(--radius-card)',
                      padding: '14px 18px',
                      display: 'flex', alignItems: 'center', gap: '16px',
                      cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(249,115,22,0.3)'; e.currentTarget.style.background = 'rgba(249,115,22,0.03)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.background = 'var(--surface-1)' }}
                  >
                    <div style={{ flexShrink: 0, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.6 }}>
                      <StageChampLogo champName={champ?.name} size={32} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-xama-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {lastStage.name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-xama-muted)', fontFamily: 'JetBrains Mono, monospace', marginTop: '2px' }}>
                        {champ?.name ? <span style={{ color: 'rgba(249,115,22,0.6)' }}>{champ.name}</span> : null}
                        {champ?.name && ' · '}Último resultado
                      </div>
                    </div>
                    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                      {lastLineup?.total_points != null ? (
                        <>
                          <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-xama-orange)', fontFamily: 'JetBrains Mono, monospace' }}>
                            {fmt1(lastLineup.total_points)} pts
                          </span>
                          {lastLineup.rank && (
                            <span style={{ fontSize: '11px', color: 'var(--color-xama-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                              #{lastLineup.rank}
                            </span>
                          )}
                        </>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--color-xama-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                          Ver resultados
                        </span>
                      )}
                      <span style={{ color: 'var(--color-xama-muted)', fontSize: '16px' }}>›</span>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        )}

        {/* ── SEÇÃO 2 — ABRINDO EM BREVE (preview) ── */}
        {previewStages.length > 0 && (
          <div style={{ marginBottom: '48px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
              <span style={{ fontSize: '20px' }}>🔓</span>
              <span style={{ fontSize: '19px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--color-xama-orange)', textTransform: 'uppercase' }}>
                Abrindo em Breve
              </span>
              <span style={{
                fontSize: '16px', fontWeight: 700, padding: '2px 10px',
                borderRadius: '20px', background: 'rgba(249,115,22,0.15)',
                color: 'var(--color-xama-orange)', fontFamily: 'JetBrains Mono, monospace',
              }}>{previewStages.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {previewStages.map(s => {
                const champ = champMap[s.id]
                const dateLabel = buildDateLabel(s)
                return (
                  <div key={s.id} style={{
                    background: 'var(--surface-1)',
                    border: '1px solid rgba(249,115,22,0.3)',
                    borderTop: '2px solid rgba(249,115,22,0.55)',
                    borderRadius: 'var(--radius-card)',
                    padding: '18px 22px',
                    display: 'flex', alignItems: 'center', gap: '22px',
                    flexWrap: 'wrap',
                  }}>
                    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '80px', height: '80px', opacity: 0.8 }}>
                      <StageChampLogo champName={champ?.name} size={72} />
                    </div>
                    <div style={{ flex: 1, minWidth: '160px' }}>
                      <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-xama-text)', lineHeight: 1.15, letterSpacing: '-0.02em', marginBottom: '4px' }}>
                        {s.name}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--color-xama-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                        {champ && <span style={{ color: 'rgba(249,115,22,0.7)', fontWeight: 600 }}>{champ.name}</span>}
                        {champ && dateLabel && <span style={{ margin: '0 5px', opacity: 0.4 }}>·</span>}
                        {dateLabel && <span>{dateLabel}</span>}
                      </div>
                      <div style={{ marginTop: '6px' }}>
                        <CountdownBadge targetIso={s.lineup_open_at} mode="open" />
                      </div>
                    </div>
                    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                      <span style={{
                        fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em',
                        padding: '3px 10px', borderRadius: 4,
                        background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.35)',
                        color: 'var(--color-xama-orange)', fontFamily: 'JetBrains Mono, monospace',
                      }}>LOBBY ABERTO</span>
                      <button
                        onClick={() => navigate(`/tournament/${s.id}`)}
                        style={{
                          background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.35)',
                          borderRadius: 6, padding: '6px 14px',
                          fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em',
                          color: 'var(--color-xama-orange)', cursor: 'pointer',
                          fontFamily: 'JetBrains Mono, monospace', transition: 'background 0.15s, border-color 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(249,115,22,0.16)'; e.currentTarget.style.borderColor = 'rgba(249,115,22,0.6)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(249,115,22,0.08)'; e.currentTarget.style.borderColor = 'rgba(249,115,22,0.35)' }}
                      >
                        VER LOBBY
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── SEÇÃO 4 — AGUARDANDO ABERTURA ── */}
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

        {/* ── SEÇÃO 5 — RESULTADOS ── */}
        {pureLockedStages.length > 0 && (
          <CollapseSection title="Resultados" icon="📊" count={pureLockedStages.length} defaultOpen={isOffseason}>
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
