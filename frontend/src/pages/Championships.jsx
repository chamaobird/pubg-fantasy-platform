// frontend/src/pages/Championships.jsx
// XAMA Fantasy — Listagem de championships com stages aninhadas
// Consome: GET /championships/?include_inactive=true
// Navega para: /tournament/:stageId (TournamentHub)

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { API_BASE_URL } from '../config'
import Navbar from '../components/Navbar'
import { STATUS_COLOR, statusConfig } from '../utils/statusColors'

// ── Tournament Groups Config ───────────────────────────────────────────────────
// Championships cujos nomes contenham os padrões abaixo são agrupados num
// card pai. Os que não baterem em nenhum grupo ficam standalone (comportamento antigo).

const TOURNAMENT_GROUPS = [
  {
    key: 'pas-2026-s1',
    displayName: 'PUBG Americas Series 1 2026',
    shortName: 'PAS',
    matches: name => name.toUpperCase().includes('PAS') || /americas series/i.test(name),
  },
  {
    key: 'pec-2026-spring',
    displayName: 'PUBG EMEA Championship: 2026 Spring',
    shortName: 'PEC',
    matches: name => name.toUpperCase().includes('PEC') || /emea/i.test(name),
  },
]

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

// ── Helpers de ordenação de stages ────────────────────────────────────────────

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
  // Mostra o mais recente encerrado quando há próximos dias aguardando, mas sem lineup aberta
  if (!hasOpen && !hasLive && hasUpcoming) {
    return stages
      .filter(s => s.stage_phase === 'finished')
      .sort((a, b) => b.id - a.id)[0]?.id ?? null
  }
  return null
}

// ── Tournament Logo ───────────────────────────────────────────────────────────

const LOGO_CANDIDATES = {
  PGS: ['/logos/Tournaments/PGS.webp', '/logos/Tournaments/PGS.png'],
  PAS: ['/logos/Tournaments/PASshort.png', '/logos/Tournaments/PAS.png'],
  PEC: ['/logos/Tournaments/PECshort.png'],
}

function ChampLogo({ name = '', size = 48 }) {
  const upper = name.toUpperCase()
  const key = (upper.includes('PAS') || upper.includes('AMERICAS')) ? 'PAS'
    : (upper.includes('PEC') || upper.includes('EMEA')) ? 'PEC'
    : (upper.includes('PGS') || upper.includes('PGC') || upper.includes('PUBG') || upper.includes('GLOBAL SERIES')) ? 'PGS'
    : null
  const candidates = key ? LOGO_CANDIDATES[key] : []
  const [idx, setIdx] = useState(0)
  const [failed, setFailed] = useState(false)

  const fallbackEmoji = upper.includes('PAS') ? '🥇' : upper.includes('PEC') ? '🌍' : '🏆'

  if (!key || failed || candidates.length === 0) {
    return <span style={{ fontSize: size * 0.7, lineHeight: 1 }}>{fallbackEmoji}</span>
  }

  return (
    <div style={{
      width: size, height: size, borderRadius: 10, flexShrink: 0,
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    }}>
      <img
        src={candidates[idx]}
        alt=""
        draggable={false}
        style={{ width: size * 0.78, height: size * 0.78, objectFit: 'contain' }}
        onError={() => idx + 1 < candidates.length ? setIdx(i => i + 1) : setFailed(true)}
      />
    </div>
  )
}

// ── StageRow ──────────────────────────────────────────────────────────────────

function StageRow({ stage, champName, navigate, isLive = false, compact = false }) {
  const isOpen    = stage.lineup_status === 'open'
  const rawSt = statusConfig(stage.lineup_status)
  const st = isLive
    ? { color: 'var(--color-xama-orange)', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.35)', label: 'EM JOGO' }
    : rawSt
  const dateStr = stageDateStr(stage)

  const borderDefault  = isOpen ? 'rgba(74,222,128,0.15)' : 'var(--color-xama-border)'
  const bgDefault      = isOpen ? 'rgba(74,222,128,0.03)'  : 'rgba(255,255,255,0.01)'
  const borderHover    = isOpen ? 'rgba(74,222,128,0.4)'   : 'rgba(249,115,22,0.3)'
  const bgHover        = isOpen ? 'rgba(74,222,128,0.06)'  : 'rgba(249,115,22,0.04)'

  return (
    <div
      onClick={() => navigate(`/tournament/${stage.id}`)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: compact ? '7px 12px' : '10px 14px', gap: 12,
        background: bgDefault,
        border: `1px solid ${borderDefault}`,
        borderRadius: 8, cursor: 'pointer',
        transition: 'border-color 0.15s, background 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = borderHover
        e.currentTarget.style.background  = bgHover
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = borderDefault
        e.currentTarget.style.background  = bgDefault
      }}
    >
      {/* Left: nome + data */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          fontSize: compact ? 13 : 15, fontWeight: 600,
          color: 'var(--color-xama-text)',
          display: 'block',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {stage.name}
        </span>
        {dateStr && (
          <span style={{
            fontSize: 11, color: 'var(--color-xama-muted)',
            fontFamily: "'JetBrains Mono', monospace",
            display: 'block', marginTop: 2,
          }}>
            {dateStr}
          </span>
        )}
      </div>

      {/* Right: short_name, badge status, seta */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {stage.short_name && (
          <span style={{
            fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
            fontFamily: "'JetBrains Mono', monospace",
            color: 'var(--color-xama-muted)',
          }}>
            {stage.short_name}
          </span>
        )}
        <span style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
          padding: '3px 8px', borderRadius: 4,
          background: st.bg, border: `1px solid ${st.border}`, color: st.color,
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {st.label}
        </span>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-xama-orange)' }}>→</span>
      </div>
    </div>
  )
}

// ── FeaturedSubCard ───────────────────────────────────────────────────────────
// Championship ativo/em andamento dentro de um grupo — card maior e destacado

function FeaturedSubCard({ championship, navigate }) {
  const hasOpen    = championship.stages.some(s => s.lineup_status === 'open')
  const hasLive    = championship.stages.some(s => s.stage_phase === 'live')
  const hasPreview = false // removido: preview não é mais um status de lineup

  const sortedStages       = getSortedStages(championship.stages)
  const mostRecentLockedId = getMostRecentLockedId(championship.stages)

  const accentColor = hasOpen
    ? 'rgba(74,222,128,0.22)'
    : hasLive ? 'rgba(249,115,22,0.18)'
    : 'rgba(255,255,255,0.07)'

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid ${accentColor}`,
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      {hasOpen && (
        <div style={{ height: 2, background: `linear-gradient(90deg, ${STATUS_COLOR.open}, transparent 65%)` }} />
      )}
      {!hasOpen && (hasPreview || hasLive) && (
        <div style={{ height: 2, background: 'linear-gradient(90deg, rgba(249,115,22,0.55), transparent 65%)' }} />
      )}

      {/* Sub-header */}
      <div style={{ padding: '14px 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-xama-text)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {championship.name}
        </span>
        <span style={{ fontSize: 11, color: 'var(--color-xama-muted)', fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>
          {championship.stages.length} stage{championship.stages.length !== 1 ? 's' : ''}
          {hasOpen && <span style={{ marginLeft: 6, color: STATUS_COLOR.open, fontWeight: 700 }}>• aberto</span>}
          {hasLive && !hasOpen && <span style={{ marginLeft: 6, color: STATUS_COLOR.live, fontWeight: 700 }}>• em jogo</span>}
          {!hasOpen && !hasLive && hasPreview && <span style={{ marginLeft: 6, color: STATUS_COLOR.preview, fontWeight: 700 }}>• preview</span>}
        </span>
      </div>

      {/* Stages */}
      {sortedStages.length > 0 && (
        <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
          {sortedStages.map(stage => (
            <StageRow
              key={stage.id}
              stage={stage}
              champName={championship.name}
              navigate={navigate}
              isLive={stage.lineup_status === 'live' || stage.id === mostRecentLockedId}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── ArchivedSubCard ───────────────────────────────────────────────────────────
// Championship encerrado dentro de um grupo — card compacto, stages colapsáveis

function ArchivedSubCard({ championship, navigate }) {
  const [expanded, setExpanded] = useState(false)
  const sortedStages = getSortedStages(championship.stages)

  return (
    <div style={{
      background: 'rgba(255,255,255,0.015)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 8,
      overflow: 'hidden',
      opacity: 0.82,
    }}>
      {/* Header compacto — clicável para expandir */}
      <div
        onClick={() => setExpanded(v => !v)}
        style={{
          padding: '9px 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          cursor: 'pointer',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <span style={{
          fontSize: 13, fontWeight: 600, color: 'var(--color-xama-muted)',
          minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {championship.name}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
            padding: '2px 7px', borderRadius: 4,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)',
            color: 'var(--color-xama-muted)', fontFamily: "'JetBrains Mono', monospace",
          }}>
            ENCERRADO
          </span>
          <span style={{
            fontSize: 10, color: 'var(--color-xama-muted)',
            display: 'inline-block',
            transform: expanded ? 'rotate(90deg)' : 'none',
            transition: 'transform 0.2s',
          }}>
            ▶
          </span>
        </div>
      </div>

      {/* Stages colapsáveis */}
      {expanded && sortedStages.length > 0 && (
        <div style={{ padding: '0 12px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {sortedStages.map(stage => (
            <StageRow
              key={stage.id}
              stage={stage}
              champName={championship.name}
              navigate={navigate}
              isLive={false}
              compact
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── TournamentGroupCard ───────────────────────────────────────────────────────
// Card pai que agrupa championships de um mesmo torneio

function TournamentGroupCard({ group, championships, navigate }) {
  const hasOpen     = championships.some(c => c.stages.some(s => s.lineup_status === 'open'))
  const hasLive     = championships.some(c => c.stages.some(s => s.stage_phase === 'live'))
  const hasPreview  = false // removido: preview não é mais um status de lineup
  const allFinished = championships.every(c =>
    c.stages.length === 0 || c.stages.every(s => s.stage_phase === 'finished')
  )

  // Featured = tem ao menos uma stage não-encerrada (upcoming ou live ou open)
  const featured = championships.filter(c =>
    c.stages.some(s => s.stage_phase !== 'finished')
  )
  // Archived = todas as stages encerradas
  const archived = championships.filter(c =>
    c.stages.length === 0 || c.stages.every(s => s.stage_phase === 'finished')
  )

  // Ordena featured: open primeiro, depois live, depois upcoming
  const sortedFeatured = [...featured].sort((a, b) => {
    const aOpen = a.stages.some(s => s.lineup_status === 'open') ? 0 : 1
    const bOpen = b.stages.some(s => s.lineup_status === 'open') ? 0 : 1
    return aOpen - bOpen
  })

  const borderColor = hasOpen
    ? 'rgba(74,222,128,0.2)'
    : hasLive ? 'rgba(249,115,22,0.2)'
    : 'rgba(249,115,22,0.1)'
  const topAccent = hasOpen
    ? STATUS_COLOR.open
    : (hasPreview || hasLive) ? 'rgba(249,115,22,0.6)'
    : 'rgba(255,255,255,0.15)'

  const totalStages = championships.reduce((sum, c) => sum + c.stages.length, 0)

  return (
    <div style={{
      background: 'rgba(14, 17, 24, 0.92)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      border: `1px solid ${borderColor}`,
      boxShadow: '0 4px 28px rgba(0,0,0,0.35)',
      borderRadius: 14,
      overflow: 'hidden',
    }}>
      {/* Linha de destaque no topo */}
      <div style={{ height: hasOpen ? 3 : 1, background: `linear-gradient(90deg, ${topAccent}, transparent 55%)` }} />

      {/* Cabeçalho do torneio pai */}
      <div style={{ padding: '22px 22px 14px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <ChampLogo name={group.shortName} size={52} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 22, fontWeight: 800, color: 'var(--color-xama-text)',
            lineHeight: 1.2,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {group.displayName}
          </div>
          <div style={{
            fontSize: 12, color: 'var(--color-xama-muted)', marginTop: 4,
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            {championships.length} fase{championships.length !== 1 ? 's' : ''}
            {' · '}
            {totalStages} stage{totalStages !== 1 ? 's' : ''}
            {hasOpen && <span style={{ marginLeft: 8, color: STATUS_COLOR.open, fontWeight: 700 }}>• lineup aberto</span>}
            {hasLive && !hasOpen && <span style={{ marginLeft: 8, color: STATUS_COLOR.live, fontWeight: 700 }}>• em jogo</span>}
            {!hasOpen && !hasLive && hasPreview && <span style={{ marginLeft: 8, color: STATUS_COLOR.preview, fontWeight: 700 }}>• em preview</span>}
            {allFinished && <span style={{ marginLeft: 8, color: 'var(--color-xama-muted)' }}>• encerrado</span>}
          </div>
        </div>
      </div>

      {/* Conteúdo interno */}
      <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Featured — cards maiores */}
        {sortedFeatured.map(c => (
          <FeaturedSubCard key={c.id} championship={c} navigate={navigate} />
        ))}

        {/* Archived — cards compactos colapsáveis */}
        {archived.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: sortedFeatured.length > 0 ? 2 : 0 }}>
            {archived.map(c => (
              <ArchivedSubCard key={c.id} championship={c} navigate={navigate} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── ChampionshipCard (standalone — championships sem grupo) ───────────────────

function ChampionshipCard({ championship, navigate }) {
  const hasOpen       = championship.stages.some(s => s.lineup_status === 'open')
  const hasInProgress = championship.stages.some(s => s.stage_phase === 'live')
  const hasPreview    = false // removido: preview não é mais um status de lineup
  const allLocked     = championship.stages.every(s => s.stage_phase === 'finished')

  const sortedStages       = getSortedStages(championship.stages)
  const mostRecentLockedId = getMostRecentLockedId(championship.stages)

  return (
    <div style={{
      background: 'rgba(18, 21, 28, 0.82)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      border: `1px solid ${hasOpen ? 'rgba(74,222,128,0.2)' : hasInProgress ? 'rgba(249,115,22,0.2)' : 'rgba(249,115,22,0.12)'}`,
      boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
      borderRadius: 12, overflow: 'hidden',
      position: 'relative',
    }}>
      {hasOpen && (
        <div style={{ height: 2, background: `linear-gradient(90deg, ${STATUS_COLOR.open}, transparent 60%)` }} />
      )}
      {!hasOpen && (
        <div style={{ height: 1, background: 'linear-gradient(90deg, rgba(249,115,22,0.35), transparent 50%)' }} />
      )}

      {/* Header */}
      <div style={{ padding: '20px 20px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <ChampLogo name={championship.name} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 22, fontWeight: 700, color: 'var(--color-xama-text)',
            lineHeight: 1.2,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {championship.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-xama-muted)', marginTop: 3 }}>
            {championship.stages.length} stage{championship.stages.length !== 1 ? 's' : ''}
            {hasOpen && (
              <span style={{ marginLeft: 8, color: STATUS_COLOR.open, fontWeight: 700 }}>• lineup aberto</span>
            )}
            {hasInProgress && !hasOpen && (
              <span style={{ marginLeft: 8, color: STATUS_COLOR.live, fontWeight: 700 }}>• em jogo</span>
            )}
            {!hasOpen && !hasInProgress && hasPreview && (
              <span style={{ marginLeft: 8, color: STATUS_COLOR.preview, fontWeight: 700 }}>• em preview</span>
            )}
            {allLocked && (
              <span style={{ marginLeft: 8, color: STATUS_COLOR.locked }}>• encerrado</span>
            )}
          </div>
        </div>
      </div>

      {/* Stages */}
      {sortedStages.length > 0 ? (
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sortedStages.map(stage => (
            <StageRow
              key={stage.id}
              stage={stage}
              champName={championship.name}
              navigate={navigate}
              isLive={stage.lineup_status === 'live' || stage.id === mostRecentLockedId}
            />
          ))}
        </div>
      ) : (
        <div style={{ padding: '0 16px 16px', color: 'var(--color-xama-muted)', fontSize: 13, fontStyle: 'italic' }}>
          Nenhuma stage cadastrada.
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Championships() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const [championships, setChampionships] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`${API_BASE_URL}/championships/?include_inactive=true`)
      .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then(data => { setChampionships(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => { setError('Erro ao carregar campeonatos'); setLoading(false) })
  }, [])

  // ── Agrupamento ──────────────────────────────────────────────────────────────

  const groupMap = {}   // key -> { group, championships: [] }
  const ungrouped = []

  championships.forEach(c => {
    const group = TOURNAMENT_GROUPS.find(g => g.matches(c.name))
    if (group) {
      if (!groupMap[group.key]) groupMap[group.key] = { group, championships: [] }
      groupMap[group.key].championships.push(c)
    } else {
      ungrouped.push(c)
    }
  })

  const isGroupActive = entry =>
    entry.championships.some(c =>
      c.stages.some(s => s.stage_phase !== 'finished')
    )

  const activeGroups   = Object.values(groupMap).filter(isGroupActive)
  const finishedGroups = Object.values(groupMap).filter(e => !isGroupActive(e))

  // Ordena grupos ativos: aqueles com lineup open primeiro
  const sortedActiveGroups = [...activeGroups].sort((a, b) => {
    const aOpen = a.championships.some(c => c.stages.some(s => s.lineup_status === 'open')) ? 0 : 1
    const bOpen = b.championships.some(c => c.stages.some(s => s.lineup_status === 'open')) ? 0 : 1
    return aOpen - bOpen
  })

  // Ungrouped — mesmo comportamento de antes
  const activeUngrouped   = ungrouped.filter(c => c.stages.some(s => s.stage_phase !== 'finished'))
  const finishedUngrouped = ungrouped.filter(c => c.stages.length === 0 || c.stages.every(s => s.stage_phase === 'finished'))

  const sortedActiveUngrouped = [...activeUngrouped].sort((a, b) => {
    const aOpen = a.stages.some(s => s.lineup_status === 'open') ? 0 : 1
    const bOpen = b.stages.some(s => s.lineup_status === 'open') ? 0 : 1
    if (aOpen !== bOpen) return aOpen - bOpen
    return a.id - b.id
  })

  const hasAnythingActive = sortedActiveGroups.length > 0 || sortedActiveUngrouped.length > 0
  const finishedCount = finishedGroups.length + finishedUngrouped.length

  return (
    <div style={{ minHeight: '100vh', background: 'transparent', position: 'relative' }}>
      <Navbar />

      <main style={{ position: 'relative', zIndex: 1, maxWidth: 1000, margin: '0 auto', padding: '48px 24px' }}>
        <div style={{ marginBottom: 36 }}>
          <div style={{
            fontSize: 13, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase',
            color: 'var(--color-xama-orange)', fontFamily: "'JetBrains Mono', monospace", marginBottom: 6,
          }}>
            XAMA Fantasy
          </div>
          <h1 style={{ fontSize: 42, fontWeight: 700, color: 'var(--color-xama-text)', margin: 0, letterSpacing: '-0.01em' }}>
            Campeonatos
          </h1>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: 80, color: 'var(--color-xama-muted)', fontSize: 18 }}>
            Carregando campeonatos…
          </div>
        )}
        {error && <div className="msg-error">{error}</div>}

        {!loading && !error && (
          <>
            {/* ── Seção Ativa ─────────────────────────────────────────────── */}
            {hasAnythingActive ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 48 }}>
                {/* Grupos com championships ativos */}
                {sortedActiveGroups.map(({ group, championships: champs }) => (
                  <TournamentGroupCard
                    key={group.key}
                    group={group}
                    championships={champs}
                    navigate={navigate}
                  />
                ))}
                {/* Championships standalone ativos */}
                {sortedActiveUngrouped.map(c => (
                  <ChampionshipCard key={c.id} championship={c} navigate={navigate} />
                ))}
              </div>
            ) : (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--color-xama-muted)', fontSize: 18 }}>
                Nenhum campeonato ativo no momento.
              </div>
            )}

            {/* ── Seção Encerrados ────────────────────────────────────────── */}
            {finishedCount > 0 && (
              <div>
                <button
                  onClick={() => setShowInactive(v => !v)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '0 0 16px 0', width: '100%',
                  }}
                >
                  <div style={{ flex: 1, height: 1, background: 'var(--color-xama-border)' }} />
                  <span style={{
                    fontSize: 13, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase',
                    color: 'var(--color-xama-muted)', fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap',
                  }}>
                    {showInactive ? '▲' : '▼'} &nbsp;Encerrados ({finishedCount})
                  </span>
                  <div style={{ flex: 1, height: 1, background: 'var(--color-xama-border)' }} />
                </button>

                {showInactive && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: 0.65 }}>
                    {finishedGroups.map(({ group, championships: champs }) => (
                      <TournamentGroupCard
                        key={group.key}
                        group={group}
                        championships={champs}
                        navigate={navigate}
                      />
                    ))}
                    {finishedUngrouped.map(c => (
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
