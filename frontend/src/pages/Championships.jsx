// frontend/src/pages/Championships.jsx
// XAMA Fantasy — Listagem de championships com stages aninhadas
// Consome: GET /championships/?include_inactive=true
// Navega para: /tournament/:stageId (TournamentHub)

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { API_BASE_URL } from '../config'
import TeamLogo from '../components/TeamLogo'
import Navbar from '../components/Navbar'
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

// ── Tournament Logo ───────────────────────────────────────────────────────────

const LOGO_CANDIDATES = {
  PGS: ['/logos/Tournaments/PGS.webp', '/logos/Tournaments/PGS.png'],
  PAS: ['/logos/Tournaments/PASshort.png', '/logos/Tournaments/PAS.png'],
  PEC: ['/logos/Tournaments/PECshort.png'],
}

function ChampLogo({ name = '', size = 48 }) {
  const upper = name.toUpperCase()
  const key = (upper.includes('PAS') || upper.includes('AMERICAS')) ? 'PAS'
    : (upper.includes('PGS') || upper.includes('PGC') || upper.includes('PUBG') || upper.includes('GLOBAL SERIES')) ? 'PGS'
    : (upper.includes('PEC') || upper.includes('EMEA')) ? 'PEC'
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

function StageRow({ stage, champName, navigate, isLive = false }) {
  const isOpen    = stage.lineup_status === 'open'
  const isPreview = stage.lineup_status === 'preview'
  const rawSt = statusConfig(stage.lineup_status)
  const st = isLive
    ? { color: 'var(--color-xama-orange)', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.35)', label: 'EM JOGO' }
    : rawSt
  const dateStr = stageDateStr(stage)

  const borderDefault  = isOpen ? 'rgba(74,222,128,0.15)' : isPreview ? 'rgba(249,115,22,0.2)' : 'var(--color-xama-border)'
  const bgDefault      = isOpen ? 'rgba(74,222,128,0.03)'  : isPreview ? 'rgba(249,115,22,0.03)' : 'rgba(255,255,255,0.01)'
  const borderHover    = isOpen ? 'rgba(74,222,128,0.4)'   : isPreview ? 'rgba(249,115,22,0.45)' : 'rgba(249,115,22,0.3)'
  const bgHover        = isOpen ? 'rgba(74,222,128,0.06)'  : isPreview ? 'rgba(249,115,22,0.07)' : 'rgba(249,115,22,0.04)'

  // Derivar tag do time a partir do shortName do campeonato para o TeamLogo
  // O shortName da stage é usado para resolver a pasta de logos correta
  const stageShortName = stage.short_name || ''

  return (
    <div
      onClick={() => navigate(`/tournament/${stage.id}`)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', gap: 12,
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
          fontSize: 15, fontWeight: 600,
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

// ── ChampionshipCard ──────────────────────────────────────────────────────────

function ChampionshipCard({ championship, navigate }) {
  const hasOpen    = championship.stages.some(s => s.lineup_status === 'open')
  const hasPreview = championship.stages.some(s => s.lineup_status === 'preview')
  const allLocked  = championship.stages.every(s => s.lineup_status === 'locked')
  // Um stage locked com stages irmãs em preview = está "EM JOGO" agora
  const hasLive    = hasPreview && championship.stages.some(s => s.lineup_status === 'locked')

  // Ordena: open primeiro, preview, depois por data de abertura (cronológico), depois por id
  const stageOrder = { open: 0, preview: 1, closed: 2, locked: 3 }
  const sortedStages = [...championship.stages].sort((a, b) => {
    const statusDiff = (stageOrder[a.lineup_status] ?? 3) - (stageOrder[b.lineup_status] ?? 3)
    if (statusDiff !== 0) return statusDiff
    // Dentro do mesmo status, ordena cronologicamente (menor data no topo = acontece primeiro)
    const da = new Date(a.lineup_open_at || a.start_date || '9999').getTime()
    const db = new Date(b.lineup_open_at || b.start_date || '9999').getTime()
    if (da !== db) return da - db
    return a.id - b.id
  })

  return (
    <div style={{
      background: 'rgba(18, 21, 28, 0.82)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      border: `1px solid ${hasOpen ? 'rgba(74,222,128,0.2)' : hasPreview ? 'rgba(249,115,22,0.2)' : 'rgba(249,115,22,0.12)'}`,
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
            {!hasOpen && hasPreview && (
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
              isLive={hasLive && stage.lineup_status === 'locked'}
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

  const active   = championships.filter(c => c.stages.some(s => ['open', 'preview', 'closed'].includes(s.lineup_status)))
  const finished = championships.filter(c => c.stages.length === 0 || c.stages.every(s => s.lineup_status === 'locked'))

  return (
    <div style={{ minHeight: '100vh', background: 'transparent', position: 'relative' }}>
      {/* Navbar */}
      <Navbar />

      {/* Content */}
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
            {active.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 48 }}>
                {[...active]
                  .sort((a, b) => {
                    // Campeonatos com stage open primeiro, depois por ID crescente
                    const aOpen = a.stages.some(s => s.lineup_status === 'open') ? 0 : 1
                    const bOpen = b.stages.some(s => s.lineup_status === 'open') ? 0 : 1
                    if (aOpen !== bOpen) return aOpen - bOpen
                    return a.id - b.id
                  })
                  .map(c => (
                  <ChampionshipCard key={c.id} championship={c} navigate={navigate} />
                ))}
              </div>
            ) : (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--color-xama-muted)', fontSize: 18 }}>
                Nenhum campeonato ativo no momento.
              </div>
            )}

            {finished.length > 0 && (
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
                    {showInactive ? '▲' : '▼'} &nbsp;Encerrados ({finished.length})
                  </span>
                  <div style={{ flex: 1, height: 1, background: 'var(--color-xama-border)' }} />
                </button>

                {showInactive && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: 0.65 }}>
                    {finished.map(c => (
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
