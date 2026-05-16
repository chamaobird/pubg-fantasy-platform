// frontend/src/pages/Championships.jsx
// XAMA Fantasy — Listagem de championships com stages aninhadas
// Consome: GET /championships/?include_inactive=true
//          GET /championship-groups/
// Navega para: /tournament/:stageId · /group/:id

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { API_BASE_URL } from '../config'
import Navbar from '../components/Navbar'
import { DashIcon } from '../components/DashIcon'
import { STATUS_COLOR, statusConfig } from '../utils/statusColors'

// ── Helpers de data ───────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}
function stageDateStr(stage) {
  const open  = stage.lineup_open_at || stage.start_date
  const close = stage.lineup_close_at || stage.end_date
  if (open && close) return `${fmtDate(open)} – ${fmtDate(close)}`
  if (open) return fmtDate(open)
  return null
}

const STAGE_ORDER = { open: 0, live: 0, preview: 1, closed: 2, locked: 3 }
function getSortedStages(stages) {
  return [...stages].sort((a, b) => {
    const statusDiff = (STAGE_ORDER[a.lineup_status] ?? 3) - (STAGE_ORDER[b.lineup_status] ?? 3)
    if (statusDiff !== 0) return statusDiff
    const da = new Date(a.lineup_open_at || a.start_date || '9999').getTime()
    const db = new Date(b.lineup_open_at || b.start_date || '9999').getTime()
    if (da !== db) return da - db
    return a.id - b.id
  })
}
function getMostRecentLockedId(stages) {
  const hasOpen     = stages.some(s => s.lineup_status === 'open')
  const hasLive     = stages.some(s => s.stage_phase === 'live')
  const hasUpcoming = stages.some(s => s.stage_phase === 'upcoming')
  if (!hasOpen && !hasLive && hasUpcoming) {
    return stages.filter(s => s.stage_phase === 'finished').sort((a, b) => b.id - a.id)[0]?.id ?? null
  }
  return null
}

// ── Tournament Logo (64px) ────────────────────────────────────────────────────

const LOGO_CANDIDATES = {
  PGS: ['/logos/Tournaments/PGS.webp', '/logos/Tournaments/PGS.png'],
  PAS: ['/logos/Tournaments/PASshort.png', '/logos/Tournaments/PAS.png'],
  PEC: ['/logos/Tournaments/PECshort.png'],
}
function ChampLogo({ name = '', size = 64 }) {
  const upper = name.toUpperCase()
  const key = (upper.includes('PAS') || upper.includes('AMERICAS')) ? 'PAS'
    : (upper.includes('PEC') || upper.includes('EMEA')) ? 'PEC'
    : (upper.includes('PGS') || upper.includes('PGC') || upper.includes('PUBG') || upper.includes('GLOBAL SERIES')) ? 'PGS'
    : null
  const candidates = key ? LOGO_CANDIDATES[key] : []
  const [idx, setIdx] = useState(0)
  const [failed, setFailed] = useState(false)

  // Fallback: hex glyph laranja em vez de emoji (mantém vocabulário visual)
  if (!key || failed || candidates.length === 0) {
    return (
      <div style={{
        width: size, height: size, borderRadius: 10, flexShrink: 0,
        background: 'rgba(249,115,22,0.05)', border: '1px solid rgba(249,115,22,0.18)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'rgba(249,115,22,0.55)', fontSize: size * 0.5, fontWeight: 700,
      }}>⬡</div>
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: 10, flexShrink: 0,
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    }}>
      <img src={candidates[idx]} alt="" draggable={false}
        style={{ width: size * 0.78, height: size * 0.78, objectFit: 'contain' }}
        onError={() => idx + 1 < candidates.length ? setIdx(i => i + 1) : setFailed(true)} />
    </div>
  )
}

// ── StageRow (com micro-data à esquerda do badge) ─────────────────────────────

function StageRow({ stage, navigate, isLive = false, compact = false }) {
  const isOpen = stage.lineup_status === 'open'
  const rawSt  = statusConfig(stage.lineup_status)
  const st = isLive
    ? { color: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.4)', label: 'EM JOGO' }
    : rawSt
  const dateStr = stageDateStr(stage)

  const borderDefault = isOpen ? 'rgba(74,222,128,0.18)' : 'rgba(255,255,255,0.05)'
  const bgDefault     = isOpen ? 'rgba(74,222,128,0.03)' : 'rgba(255,255,255,0.01)'
  const borderHover   = isOpen ? 'rgba(74,222,128,0.4)'  : 'rgba(249,115,22,0.35)'
  const bgHover       = isOpen ? 'rgba(74,222,128,0.06)' : 'rgba(249,115,22,0.05)'

  return (
    <div
      className="xm-stage-row"
      onClick={() => navigate(`/tournament/${stage.id}`)}
      style={{
        padding: compact ? '8px 12px' : '11px 14px',
        background: bgDefault, border: `1px solid ${borderDefault}`,
        '--hover-border': borderHover, '--hover-bg': bgHover,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          fontSize: compact ? 13 : 14, fontWeight: 600,
          color: 'var(--xm-text, #dce1ea)',
          display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{stage.name}</span>
        {dateStr && (
          <span style={{
            fontSize: 11, color: 'var(--xm-muted, #6b7280)',
            fontFamily: "'JetBrains Mono', monospace",
            display: 'block', marginTop: 2, letterSpacing: '0.03em',
          }}>{dateStr}</span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {/* Micro-data: short_name à esquerda do badge */}
        {stage.short_name && (
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
            fontFamily: "'JetBrains Mono', monospace",
            color: 'var(--xm-muted-soft, #4b5563)',
            padding: '2px 6px', borderRadius: 3,
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(255,255,255,0.04)',
          }}>{stage.short_name}</span>
        )}
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
          padding: '3px 8px', borderRadius: 4,
          background: st.bg, border: `1px solid ${st.border}`, color: st.color,
          fontFamily: "'JetBrains Mono', monospace",
        }}>{st.label}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--xm-orange, #f97316)' }}>→</span>
      </div>
    </div>
  )
}

// ── FeaturedSubCard ───────────────────────────────────────────────────────────

function FeaturedSubCard({ championship, navigate }) {
  const hasOpen    = championship.stages.some(s => s.lineup_status === 'open')
  const hasLive    = championship.stages.some(s => s.stage_phase === 'live')
  const hasPreview = championship.stages.some(s => s.stage_phase === 'preview')

  const sortedStages       = getSortedStages(championship.stages)
  const mostRecentLockedId = getMostRecentLockedId(championship.stages)
  const accentColor = hasOpen ? 'rgba(74,222,128,0.22)' : (hasLive || hasPreview) ? 'rgba(249,115,22,0.18)' : 'rgba(255,255,255,0.07)'

  return (
    <div style={{
      background: 'rgba(255,255,255,0.025)',
      border: `1px solid ${accentColor}`,
      borderRadius: 10, overflow: 'hidden',
    }}>
      {hasOpen && <div style={{ height: 2, background: `linear-gradient(90deg, ${STATUS_COLOR.open}, transparent 65%)` }} />}
      {!hasOpen && (hasPreview || hasLive) && (
        <div style={{ height: 2, background: 'linear-gradient(90deg, rgba(249,115,22,0.55), transparent 65%)' }} />
      )}

      <div style={{ padding: '14px 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--xm-text)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {championship.name}
        </span>
        <span style={{ fontSize: 11, color: 'var(--xm-muted)', fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>
          {championship.stages.length} stage{championship.stages.length !== 1 ? 's' : ''}
          {hasOpen && <span style={{ marginLeft: 6, color: STATUS_COLOR.open, fontWeight: 700 }}>• aberto</span>}
          {hasLive && !hasOpen && <span style={{ marginLeft: 6, color: STATUS_COLOR.live, fontWeight: 700 }}>• em jogo</span>}
          {!hasOpen && !hasLive && hasPreview && <span style={{ marginLeft: 6, color: STATUS_COLOR.preview, fontWeight: 700 }}>• preview</span>}
        </span>
      </div>

      {sortedStages.length > 0 && (
        <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
          {sortedStages.map(stage => (
            <StageRow key={stage.id} stage={stage} navigate={navigate}
              isLive={stage.lineup_status === 'live' || stage.id === mostRecentLockedId} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── ArchivedSubCard ───────────────────────────────────────────────────────────

function ArchivedSubCard({ championship, navigate }) {
  const [expanded, setExpanded] = useState(false)
  const sortedStages = getSortedStages(championship.stages)

  return (
    <div style={{
      background: 'rgba(255,255,255,0.015)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 8, overflow: 'hidden', opacity: 0.82,
    }}>
      <div onClick={() => setExpanded(v => !v)}
        style={{
          padding: '9px 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          cursor: 'pointer', transition: 'background 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
        <span style={{
          fontSize: 13, fontWeight: 600, color: 'var(--xm-muted)',
          minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{championship.name}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
            padding: '2px 7px', borderRadius: 4,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)',
            color: 'var(--xm-muted)', fontFamily: "'JetBrains Mono', monospace",
          }}>ENCERRADO</span>
          <span style={{
            fontSize: 10, color: 'var(--xm-muted)',
            display: 'inline-block',
            transform: expanded ? 'rotate(90deg)' : 'none',
            transition: 'transform 0.2s',
          }}>▶</span>
        </div>
      </div>
      {expanded && sortedStages.length > 0 && (
        <div style={{ padding: '0 12px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {sortedStages.map(stage => (
            <StageRow key={stage.id} stage={stage} navigate={navigate} isLive={false} compact />
          ))}
        </div>
      )}
    </div>
  )
}

// ── TournamentGroupCard ───────────────────────────────────────────────────────

function TournamentGroupCard({ group, championships, navigate }) {
  const groupId = group.id ?? null
  const hasOpen     = championships.some(c => c.stages.some(s => s.lineup_status === 'open'))
  const hasLive     = championships.some(c => c.stages.some(s => s.stage_phase === 'live'))
  const hasPreview  = championships.some(c => c.stages.some(s => s.stage_phase === 'preview'))
  const allFinished = championships.every(c => c.stages.length === 0 || c.stages.every(s => s.stage_phase === 'finished'))

  const featured = championships.filter(c => c.stages.some(s => s.stage_phase !== 'finished'))
  const archived = championships.filter(c => c.stages.length === 0 || c.stages.every(s => s.stage_phase === 'finished'))
  const sortedFeatured = [...featured].sort((a, b) => {
    const aOpen = a.stages.some(s => s.lineup_status === 'open') ? 0 : 1
    const bOpen = b.stages.some(s => s.lineup_status === 'open') ? 0 : 1
    return aOpen - bOpen
  })

  const displayName = group.displayName ?? group.name
  const shortName   = group.shortName   ?? group.short_name
  const borderColor = hasOpen ? 'rgba(74,222,128,0.22)' : hasLive ? 'rgba(249,115,22,0.22)' : 'rgba(249,115,22,0.1)'
  // Accent bar mais visível (3px sempre, gradiente mais saturado)
  const topAccent = hasOpen
    ? `linear-gradient(90deg, ${STATUS_COLOR.open}, rgba(74,222,128,0.2) 40%, transparent 75%)`
    : (hasPreview || hasLive)
      ? 'linear-gradient(90deg, #f97316, rgba(249,115,22,0.35) 40%, transparent 75%)'
      : 'linear-gradient(90deg, rgba(255,255,255,0.18), transparent 60%)'

  const totalStages = championships.reduce((sum, c) => sum + c.stages.length, 0)

  return (
    <div style={{
      background: 'rgba(14, 17, 24, 0.92)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      border: `1px solid ${borderColor}`,
      boxShadow: 'var(--xm-shadow-card, 0 4px 28px rgba(0,0,0,0.35))',
      borderRadius: 14, overflow: 'hidden',
    }}>
      {/* Accent bar mais visível — 3px sempre, com gradiente saturado */}
      <div style={{ height: 3, background: topAccent }} />

      <div style={{ padding: '22px 22px 14px', display: 'flex', alignItems: 'center', gap: 18 }}>
        {/* Logo 64px (era 52px) */}
        <ChampLogo name={shortName} size={64} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 24, fontWeight: 700,
            color: 'var(--xm-text-bright, #f1f5f9)',
            fontFamily: 'var(--xm-font-display, Rajdhani), Rajdhani, sans-serif',
            lineHeight: 1.15, letterSpacing: '-0.005em',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{displayName}</div>
          <div style={{
            fontSize: 12, color: 'var(--xm-muted)', marginTop: 5,
            fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.03em',
          }}>
            {championships.length} fase{championships.length !== 1 ? 's' : ''}
            {' · '}{totalStages} stage{totalStages !== 1 ? 's' : ''}
            {hasOpen && <span style={{ marginLeft: 8, color: STATUS_COLOR.open, fontWeight: 700 }}>• lineup aberto</span>}
            {hasLive && !hasOpen && <span style={{ marginLeft: 8, color: STATUS_COLOR.live, fontWeight: 700 }}>• em jogo</span>}
            {!hasOpen && !hasLive && hasPreview && <span style={{ marginLeft: 8, color: STATUS_COLOR.preview, fontWeight: 700 }}>• em preview</span>}
            {allFinished && <span style={{ marginLeft: 8, color: 'var(--xm-muted)' }}>• encerrado</span>}
          </div>
        </div>

        {/* CTA Ranking — DashIcon trophy + slide-on-hover */}
        {groupId && (
          <button
            onClick={e => { e.stopPropagation(); navigate(`/group/${groupId}`) }}
            style={{
              flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '9px 14px 9px 12px',
              background: 'rgba(249,115,22,0.1)',
              border: '1px solid rgba(249,115,22,0.35)',
              borderRadius: 8, color: 'var(--xm-orange)',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: '0.06em', textTransform: 'uppercase',
              transition: 'background 0.15s, border-color 0.15s, transform 0.15s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(249,115,22,0.2)'
              e.currentTarget.style.borderColor = 'rgba(249,115,22,0.6)'
              const arrow = e.currentTarget.querySelector('.rk-arrow')
              if (arrow) arrow.style.transform = 'translateX(3px)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(249,115,22,0.1)'
              e.currentTarget.style.borderColor = 'rgba(249,115,22,0.35)'
              const arrow = e.currentTarget.querySelector('.rk-arrow')
              if (arrow) arrow.style.transform = 'none'
            }}
          >
            <DashIcon name="trophy" size={14} />
            <span>Ranking</span>
            <span className="rk-arrow" style={{ transition: 'transform 0.15s', display: 'inline-flex' }}>
              <DashIcon name="arrow-right" size={12} />
            </span>
          </button>
        )}
      </div>

      <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sortedFeatured.map(c => <FeaturedSubCard key={c.id} championship={c} navigate={navigate} />)}
        {archived.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: sortedFeatured.length > 0 ? 2 : 0 }}>
            {archived.map(c => <ArchivedSubCard key={c.id} championship={c} navigate={navigate} />)}
          </div>
        )}
      </div>
    </div>
  )
}

// ── ChampionshipCard (standalone) ─────────────────────────────────────────────

function ChampionshipCard({ championship, navigate }) {
  const hasOpen       = championship.stages.some(s => s.lineup_status === 'open')
  const hasInProgress = championship.stages.some(s => s.stage_phase === 'live')
  const hasPreview    = championship.stages.some(s => s.stage_phase === 'preview')
  const allLocked     = championship.stages.every(s => s.stage_phase === 'finished')
  const sortedStages       = getSortedStages(championship.stages)
  const mostRecentLockedId = getMostRecentLockedId(championship.stages)

  return (
    <div style={{
      background: 'rgba(18, 21, 28, 0.82)',
      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      border: `1px solid ${hasOpen ? 'rgba(74,222,128,0.2)' : hasInProgress ? 'rgba(249,115,22,0.2)' : 'rgba(249,115,22,0.12)'}`,
      boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
      borderRadius: 12, overflow: 'hidden', position: 'relative',
    }}>
      <div style={{
        height: hasOpen ? 2 : 2,
        background: hasOpen
          ? `linear-gradient(90deg, ${STATUS_COLOR.open}, transparent 60%)`
          : 'linear-gradient(90deg, rgba(249,115,22,0.45), transparent 60%)',
      }} />
      <div style={{ padding: '20px 20px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <ChampLogo name={championship.name} size={48} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 22, fontWeight: 700, color: 'var(--xm-text-bright)',
            fontFamily: 'var(--xm-font-display, Rajdhani), sans-serif',
            lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{championship.name}</div>
          <div style={{ fontSize: 11, color: 'var(--xm-muted)', marginTop: 3, fontFamily: "'JetBrains Mono', monospace" }}>
            {championship.stages.length} stage{championship.stages.length !== 1 ? 's' : ''}
            {hasOpen && <span style={{ marginLeft: 8, color: STATUS_COLOR.open, fontWeight: 700 }}>• lineup aberto</span>}
            {hasInProgress && !hasOpen && <span style={{ marginLeft: 8, color: STATUS_COLOR.live, fontWeight: 700 }}>• em jogo</span>}
            {!hasOpen && !hasInProgress && hasPreview && <span style={{ marginLeft: 8, color: STATUS_COLOR.preview, fontWeight: 700 }}>• em preview</span>}
            {allLocked && <span style={{ marginLeft: 8, color: STATUS_COLOR.locked }}>• encerrado</span>}
          </div>
        </div>
      </div>
      {sortedStages.length > 0 ? (
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sortedStages.map(stage => (
            <StageRow key={stage.id} stage={stage} navigate={navigate}
              isLive={stage.lineup_status === 'live' || stage.id === mostRecentLockedId} />
          ))}
        </div>
      ) : (
        <div style={{ padding: '0 16px 16px', color: 'var(--xm-muted)', fontSize: 13, fontStyle: 'italic' }}>
          Nenhuma stage cadastrada.
        </div>
      )}
    </div>
  )
}

// ── Offseason Hero (substitui o ☕ emoji) ──────────────────────────────────────
// Inspirado em AchievementHero: eyebrow + ícone SVG + H2 + subtitle mono

function OffseasonHero({ recentCount, totalFinished }) {
  return (
    <div style={{
      position: 'relative',
      background: 'linear-gradient(180deg, rgba(249,115,22,0.04), rgba(249,115,22,0))',
      border: '1px solid rgba(249,115,22,0.18)',
      borderRadius: 14, overflow: 'hidden',
      padding: '32px 28px',
      display: 'flex', alignItems: 'center', gap: 22,
      marginBottom: 28,
    }}>
      <div style={{ height: 2, background: 'linear-gradient(90deg, #f97316, transparent 60%)', position: 'absolute', top: 0, left: 0, right: 0 }} />

      {/* Glyph hexagonal — vocabulário XAMA (não emoji) */}
      <div style={{
        width: 72, height: 72, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(249,115,22,0.06)',
        border: '1px solid rgba(249,115,22,0.25)',
        borderRadius: 14,
        position: 'relative',
      }}>
        <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
          <polygon points="22,3 40,13 40,31 22,41 4,31 4,13" stroke="#f97316" strokeWidth="1.5" fill="rgba(249,115,22,0.05)"/>
          <polygon points="22,11 33,17 33,29 22,35 11,29 11,17" stroke="rgba(249,115,22,0.5)" strokeWidth="1"/>
          <circle cx="22" cy="23" r="2.5" fill="#f97316"/>
        </svg>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
          color: '#f97316', letterSpacing: '0.22em', fontWeight: 700,
          textTransform: 'uppercase', marginBottom: 8,
        }}>XAMA · Status do circuito</div>
        <h2 style={{
          fontSize: 28, fontWeight: 800, margin: 0, lineHeight: 1.1,
          color: 'var(--xm-text-bright, #f1f5f9)',
          fontFamily: 'var(--xm-font-display, Rajdhani), Rajdhani, sans-serif',
          letterSpacing: '-0.005em',
        }}>
          Entre temporadas
        </h2>
        <div style={{
          fontSize: 12, color: 'var(--xm-muted, #6b7280)', marginTop: 8,
          fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.04em',
        }}>
          Nenhum campeonato ativo — confira os resultados abaixo.
        </div>
      </div>

      {/* Stat pills resumindo o que tem encerrado */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
        {recentCount > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 12px', borderRadius: 6,
            background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.22)',
            fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700,
            color: '#f59e0b', letterSpacing: '0.04em',
          }}>
            <span style={{ fontSize: 9, color: 'rgba(245,158,11,0.6)' }}>RECENTES</span>
            <span>{recentCount}</span>
          </div>
        )}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 12px', borderRadius: 6,
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
          fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700,
          color: 'var(--xm-muted)', letterSpacing: '0.04em',
        }}>
          <span style={{ fontSize: 9, color: 'var(--xm-muted-soft, #4b5563)' }}>TOTAL</span>
          <span>{totalFinished}</span>
        </div>
      </div>
    </div>
  )
}

// ── HeroStatChips — chips horizontais (padrão DashHero) ───────────────────────

function HeroStatChips({ activeCount, finishedCount, openLineupCount }) {
  const Icon = ({ name, size = 14 }) => <DashIcon name={name} size={size} />

  const chip = (variant) => ({
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '7px 12px', borderRadius: 7,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
    border: '1px solid',
    ...({
      orange: { color: '#f97316', background: 'rgba(249,115,22,0.08)', borderColor: 'rgba(249,115,22,0.3)' },
      gold:   { color: '#f0c040', background: 'rgba(240,192,64,0.06)', borderColor: 'rgba(240,192,64,0.25)' },
      muted:  { color: 'var(--xm-muted)', background: 'rgba(255,255,255,0.025)', borderColor: 'rgba(255,255,255,0.08)' },
      green:  { color: '#4ade80', background: 'rgba(74,222,128,0.06)', borderColor: 'rgba(74,222,128,0.25)' },
    }[variant] || {}),
  })

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>
      {openLineupCount > 0 && (
        <span style={chip('green')}>
          <Icon name="zap" />
          <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>LINEUP ABERTO</span>
          <span style={{ fontSize: 13, fontWeight: 800 }}>{openLineupCount}</span>
        </span>
      )}
      <span style={chip('orange')}>
        <Icon name="swords" />
        <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>ATIVOS</span>
        <span style={{ fontSize: 13, fontWeight: 800 }}>{activeCount}</span>
      </span>
      <span style={chip('muted')}>
        <Icon name="trophy" />
        <span style={{ color: 'var(--xm-muted-soft, #4b5563)', fontWeight: 600 }}>ENCERRADOS</span>
        <span style={{ fontSize: 13, fontWeight: 800 }}>{finishedCount}</span>
      </span>
    </div>
  )
}

// ── Section Head reutilizando padrão Dashboard ────────────────────────────────

function SectionHead({ icon, label, count, tone = 'muted' }) {
  const Icon = DashIcon
  const color = tone === 'gold' ? '#f59e0b' : tone === 'orange' ? '#f97316' : 'var(--xm-muted)'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '0 0 18px 0', marginTop: 8,
    }}>
      <span style={{
        width: 28, height: 28, borderRadius: 7,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: `${color === '#f59e0b' ? 'rgba(245,158,11,0.1)' : color === '#f97316' ? 'rgba(249,115,22,0.1)' : 'rgba(255,255,255,0.03)'}`,
        border: `1px solid ${color === '#f59e0b' ? 'rgba(245,158,11,0.28)' : color === '#f97316' ? 'rgba(249,115,22,0.3)' : 'rgba(255,255,255,0.08)'}`,
        color,
      }}>
        {Icon ? <Icon name={icon} size={14} /> : null}
      </span>
      <span style={{
        fontSize: 12, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
        color, fontFamily: "'JetBrains Mono', monospace",
      }}>{label}</span>
      {count != null && (
        <span style={{
          fontSize: 11, fontWeight: 700,
          color: 'var(--xm-muted-soft, #4b5563)',
          fontFamily: "'JetBrains Mono', monospace",
          padding: '2px 8px', borderRadius: 4,
          background: 'rgba(255,255,255,0.025)',
          border: '1px solid rgba(255,255,255,0.06)',
          letterSpacing: '0.06em',
        }}>{String(count).padStart(2, '0')}</span>
      )}
      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)', marginLeft: 4 }} />
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Championships() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const [championships, setChampionships] = useState([])
  const [apiGroups, setApiGroups]         = useState([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState('')
  const [showInactive, setShowInactive]   = useState(false)
  const [autoExpanded, setAutoExpanded]   = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`${API_BASE_URL}/championships/?include_inactive=true`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE_URL}/championship-groups/`).then(r => r.ok ? r.json() : []),
    ])
      .then(([champsData, groupsData]) => {
        setChampionships(Array.isArray(champsData) ? champsData : [])
        setApiGroups(Array.isArray(groupsData) ? groupsData : [])
        setLoading(false)
      })
      .catch(() => { setError('Erro ao carregar campeonatos'); setLoading(false) })
  }, [])

  const groupedChampionshipIds = new Set(apiGroups.flatMap(g => g.championship_ids ?? []))
  const groupMap = {}
  apiGroups.forEach(g => {
    const groupChamps = championships.filter(c => (g.championship_ids ?? []).includes(c.id))
    if (groupChamps.length > 0) groupMap[`api-${g.id}`] = { group: g, championships: groupChamps }
  })
  const ungrouped = championships.filter(c => !groupedChampionshipIds.has(c.id))

  const isGroupActive = entry =>
    entry.championships.some(c =>
      c.stages.some(s => s.stage_phase !== 'finished' && s.stage_phase !== undefined)
    )
  const activeGroups   = Object.values(groupMap).filter(isGroupActive)
  const finishedGroups = Object.values(groupMap).filter(e => !isGroupActive(e))

  const sortedActiveGroups = [...activeGroups].sort((a, b) => {
    const aOrder = a.group.display_order ?? 99
    const bOrder = b.group.display_order ?? 99
    if (aOrder !== bOrder) return aOrder - bOrder
    const aOpen = a.championships.some(c => c.stages.some(s => s.lineup_status === 'open')) ? 0 : 1
    const bOpen = b.championships.some(c => c.stages.some(s => s.lineup_status === 'open')) ? 0 : 1
    return aOpen - bOpen
  })

  const activeUngrouped   = ungrouped.filter(c => c.stages.some(s => s.stage_phase !== 'finished'))
  const finishedUngrouped = ungrouped.filter(c => c.stages.length === 0 || c.stages.every(s => s.stage_phase === 'finished'))
  const sortedActiveUngrouped = [...activeUngrouped].sort((a, b) => {
    const aOpen = a.stages.some(s => s.lineup_status === 'open') ? 0 : 1
    const bOpen = b.stages.some(s => s.lineup_status === 'open') ? 0 : 1
    if (aOpen !== bOpen) return aOpen - bOpen
    return a.id - b.id
  })

  const hasAnythingActive = sortedActiveGroups.length > 0 || sortedActiveUngrouped.length > 0
  const activeCount = sortedActiveGroups.length + sortedActiveUngrouped.length
  const finishedCount = finishedGroups.length + finishedUngrouped.length

  // Chip "LINEUP ABERTO" — soma de championships com pelo menos uma stage open
  const openLineupCount =
    sortedActiveGroups.reduce((sum, e) => sum + e.championships.filter(c => c.stages.some(s => s.lineup_status === 'open')).length, 0)
    + sortedActiveUngrouped.filter(c => c.stages.some(s => s.lineup_status === 'open')).length

  const recentCutoff = Date.now() - 14 * 24 * 3600 * 1000
  const isGroupRecent = entry =>
    entry.championships.some(c => c.finished_at && new Date(c.finished_at).getTime() > recentCutoff)
  const isChampRecent = c => c.finished_at && new Date(c.finished_at).getTime() > recentCutoff

  const recentFinishedGroups    = finishedGroups.filter(isGroupRecent)
  const oldFinishedGroups       = finishedGroups.filter(e => !isGroupRecent(e))
  const recentFinishedUngrouped = finishedUngrouped.filter(isChampRecent)
  const oldFinishedUngrouped    = finishedUngrouped.filter(c => !isChampRecent(c))

  const recentFinishedCount = recentFinishedGroups.length + recentFinishedUngrouped.length
  const oldFinishedCount    = oldFinishedGroups.length + oldFinishedUngrouped.length

  useEffect(() => {
    if (!loading && !hasAnythingActive && finishedCount > 0 && !autoExpanded) {
      setShowInactive(true); setAutoExpanded(true)
    }
  }, [loading, hasAnythingActive, finishedCount, autoExpanded])

  return (
    <div className="xm-page">
      <Navbar />
      <main className="xm-page__container xm-page__container--xl">
        {/* Hero da página com eyebrow + H1 + stat chips */}
        <div style={{ marginBottom: 36 }}>
          <div className="xm-eyebrow" style={{
            fontSize: 13, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase',
            color: 'var(--xm-orange)', fontFamily: "'JetBrains Mono', monospace", marginBottom: 8,
          }}>
            XAMA Fantasy
          </div>
          <h1 style={{
            fontSize: 44, fontWeight: 700, color: 'var(--xm-text-bright, #f1f5f9)',
            margin: 0, letterSpacing: '-0.01em',
            fontFamily: 'var(--xm-font-display, Rajdhani), Rajdhani, sans-serif',
            lineHeight: 1.05,
          }}>
            Campeonatos
          </h1>
          {!loading && !error && (
            <HeroStatChips
              activeCount={activeCount}
              finishedCount={finishedCount}
              openLineupCount={openLineupCount}
            />
          )}
        </div>

        {loading && (
          <div className="xm-empty" style={{ paddingTop: 80, paddingBottom: 80 }}>
            <p className="xm-empty__body">Carregando campeonatos…</p>
          </div>
        )}
        {error && <p className="xm-msg xm-msg--err" style={{ marginBottom: 24 }}>{error}</p>}

        {!loading && !error && (
          <>
            {/* Seção ativa OU OffseasonHero */}
            {hasAnythingActive ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 40 }}>
                {sortedActiveGroups.map(({ group, championships: champs }) => (
                  <TournamentGroupCard key={group.key ?? `g-${group.id}`} group={group} championships={champs} navigate={navigate} />
                ))}
                {sortedActiveUngrouped.map(c => (
                  <ChampionshipCard key={c.id} championship={c} navigate={navigate} />
                ))}
              </div>
            ) : (
              <OffseasonHero recentCount={recentFinishedCount} totalFinished={finishedCount} />
            )}

            {/* Encerrados recentemente — SectionHead em vez de linhas */}
            {recentFinishedCount > 0 && (
              <div style={{ marginBottom: 28 }}>
                <SectionHead icon="trophy" label="Encerrados recentemente" count={recentFinishedCount} tone="gold" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: 0.9 }}>
                  {recentFinishedGroups.map(({ group, championships: champs }) => (
                    <TournamentGroupCard key={group.key ?? `g-${group.id}`} group={group} championships={champs} navigate={navigate} />
                  ))}
                  {recentFinishedUngrouped.map(c => (
                    <ChampionshipCard key={c.id} championship={c} navigate={navigate} />
                  ))}
                </div>
              </div>
            )}

            {/* Encerrados antigos — SectionHead clicável */}
            {oldFinishedCount > 0 && (
              <div>
                <button onClick={() => setShowInactive(v => !v)}
                  style={{ display: 'block', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
                  <SectionHead
                    icon={showInactive ? 'chevron-up' : 'chevron-down'}
                    label={`Encerrados${showInactive ? ' · expandido' : ''}`}
                    count={oldFinishedCount} tone="muted" />
                </button>
                {showInactive && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: 0.65 }}>
                    {oldFinishedGroups.map(({ group, championships: champs }) => (
                      <TournamentGroupCard key={group.key ?? `g-${group.id}`} group={group} championships={champs} navigate={navigate} />
                    ))}
                    {oldFinishedUngrouped.map(c => (
                      <ChampionshipCard key={c.id} championship={c} navigate={navigate} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
