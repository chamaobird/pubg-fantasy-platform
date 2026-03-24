// frontend/src/pages/TournamentSelect.jsx
// XAMA Fantasy — Tournament Selection
// Shows standalone tournaments as cards + championship groups as phase blocks

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { API_BASE_URL } from '../config'

const STATUS_STYLE = {
  active:   { bg: 'rgba(74,222,128,0.1)',  border: 'rgba(74,222,128,0.3)',  color: '#4ade80', label: 'AO VIVO' },
  upcoming: { bg: 'rgba(249,115,22,0.1)',  border: 'rgba(249,115,22,0.3)',  color: '#f97316', label: 'EM BREVE' },
  finished: { bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.3)', color: '#6b7280', label: 'ENCERRADO' },
}

const REGION_LABEL = { KR: 'Coreia do Sul', CN: 'China', SEA: 'Sudeste Asiático', AS: 'Ásia', AM: 'Américas', EU: 'Europa', GLOBAL: 'Global' }

// ── Standalone tournament card (unchanged visual) ──────────────────────────
function TournamentCard({ t, navigate }) {
  const st = STATUS_STYLE[t.status] || STATUS_STYLE.finished
  const isGlobal = t.pubg_id && (t.pubg_id.startsWith('as-pgs') || t.pubg_id.startsWith('kr-pgs') || t.pubg_id.startsWith('as-pgc'))
  const flag = isGlobal ? '🌍🏆' : '🏆'

  return (
    <div
      onClick={() => navigate(`/tournament/${t.id}`)}
      style={{
        background: 'var(--color-xama-surface)',
        border: '1px solid var(--color-xama-border)',
        borderRadius: '12px',
        padding: '24px',
        cursor: 'pointer',
        transition: 'border-color 0.15s, transform 0.15s',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(249,115,22,0.4)'
        e.currentTarget.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-xama-border)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {t.status === 'active' && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, var(--color-xama-orange), transparent 70%)' }} />
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
        <span style={{ fontSize: '28px', lineHeight: 1 }}>{flag}</span>
        <span style={{
          fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em',
          padding: '3px 8px', borderRadius: '4px',
          background: st.bg, border: `1px solid ${st.border}`, color: st.color,
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {st.label}
        </span>
      </div>

      <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--color-xama-text)', marginBottom: '6px', lineHeight: 1.3 }}>
        {t.name}
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
        <span style={{ fontSize: '12px', color: 'var(--color-xama-muted)' }}>{REGION_LABEL[t.region] || t.region}</span>
        {t.pubg_id && (
          <span style={{ fontSize: '11px', color: '#2a3046', fontFamily: "'JetBrains Mono', monospace" }}>
            {t.pubg_id}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '12px', color: 'var(--color-xama-muted)' }}>
          Budget: <span style={{ color: 'var(--color-xama-gold)', fontFamily: "'JetBrains Mono', monospace" }}>${t.budget_limit}</span>
        </span>
        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-xama-orange)', letterSpacing: '0.04em' }}>
          Entrar →
        </span>
      </div>
    </div>
  )
}

// ── Championship block (full-width, phases inside) ─────────────────────────
function ChampionshipBlock({ championship, tournById, navigate }) {
  const st = STATUS_STYLE[championship.status] || STATUS_STYLE.finished
  const sortedPhases = [...championship.phases].sort((a, b) => a.phase_order - b.phase_order)

  return (
    <div style={{
      gridColumn: '1 / -1',
      background: 'var(--color-xama-surface)',
      border: '1px solid var(--color-xama-border)',
      borderRadius: '12px',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Top accent */}
      {championship.status === 'active' && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, var(--color-xama-orange), transparent 70%)' }} />
      )}

      {/* Championship header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
        <span style={{ fontSize: '28px', lineHeight: 1 }}>🌍🏆</span>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: '10px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase',
            color: 'var(--color-xama-orange)', fontFamily: "'JetBrains Mono', monospace", marginBottom: '2px',
          }}>
            Campeonato · {REGION_LABEL[championship.region] || championship.region}
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-xama-text)', lineHeight: 1.2 }}>
            {championship.name}
          </div>
        </div>
        <span style={{
          fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em',
          padding: '3px 10px', borderRadius: '4px', whiteSpace: 'nowrap',
          background: st.bg, border: `1px solid ${st.border}`, color: st.color,
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {st.label}
        </span>
      </div>

      {/* Divider */}
      <div style={{ height: '1px', background: 'var(--color-xama-border)', marginBottom: '16px' }} />

      {/* Phase cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '12px',
      }}>
        {sortedPhases.map((phase) => {
          const t = tournById[phase.tournament_id]
          const pst = STATUS_STYLE[t?.status || 'upcoming'] || STATUS_STYLE.upcoming
          const isActive = t?.status === 'active'

          return (
            <div
              key={phase.tournament_id}
              onClick={() => navigate(`/tournament/${phase.tournament_id}`)}
              style={{
                background: isActive
                  ? 'rgba(249,115,22,0.06)'
                  : 'rgba(255,255,255,0.02)',
                border: `1px solid ${isActive ? 'rgba(249,115,22,0.25)' : 'var(--color-xama-border)'}`,
                borderRadius: '8px',
                padding: '14px 16px',
                cursor: 'pointer',
                transition: 'border-color 0.15s, background 0.15s',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(249,115,22,0.5)'
                e.currentTarget.style.background = 'rgba(249,115,22,0.1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = isActive ? 'rgba(249,115,22,0.25)' : 'var(--color-xama-border)'
                e.currentTarget.style.background = isActive ? 'rgba(249,115,22,0.06)' : 'rgba(255,255,255,0.02)'
              }}
            >
              {/* Phase order indicator */}
              <div style={{
                fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em',
                color: 'var(--color-xama-muted)', fontFamily: "'JetBrains Mono', monospace",
                marginBottom: '4px', textTransform: 'uppercase',
              }}>
                Fase {phase.phase_order}
              </div>

              {/* Phase name */}
              <div style={{
                fontSize: '14px', fontWeight: 700, color: 'var(--color-xama-text)',
                marginBottom: '10px', lineHeight: 1.3,
              }}>
                {phase.phase}
              </div>

              {/* Footer */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{
                  fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em',
                  padding: '2px 6px', borderRadius: '3px',
                  background: pst.bg, border: `1px solid ${pst.border}`, color: pst.color,
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  {pst.label}
                </span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-xama-orange)' }}>
                  Entrar →
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function TournamentSelect() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const [tournaments, setTournaments]         = useState([])
  const [championships, setChampionships]     = useState([])
  const [loading, setLoading]                 = useState(true)
  const [error, setError]                     = useState('')
  const [showFinished, setShowFinished]       = useState(false)

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE_URL}/tournaments/?skip=0&limit=50`, { headers: { Accept: 'application/json' } }).then(r => r.json()),
      fetch(`${API_BASE_URL}/championship-phases/`, { headers: { Accept: 'application/json' } }).then(r => r.json()),
    ])
      .then(([tournsData, champsData]) => {
        setTournaments(Array.isArray(tournsData) ? tournsData : [])
        setChampionships(Array.isArray(champsData) ? champsData : [])
        setLoading(false)
      })
      .catch(() => { setError('Erro ao carregar torneios'); setLoading(false) })
  }, [])

  // Build lookup: tournament_id → tournament object
  const tournById = Object.fromEntries(tournaments.map(t => [t.id, t]))

  // Tournament IDs that belong to a championship
  const champTournamentIds = new Set(championships.flatMap(c => c.phases.map(p => p.tournament_id)))

  // Standalone tournaments (not part of any championship)
  const standalone = tournaments.filter(t => !champTournamentIds.has(t.id))

  // Build mixed render list sorted by status
  const statusOrder = { active: 0, upcoming: 1, finished: 2 }
  const allItems = [
    ...championships.map(c => ({ type: 'championship', data: c, statusRank: statusOrder[c.status] ?? 3 })),
    ...standalone.map(t => ({ type: 'tournament', data: t, statusRank: statusOrder[t.status] ?? 3 })),
  ].sort((a, b) => a.statusRank - b.statusRank)

  const activeItems   = allItems.filter(i => i.data.status !== 'finished')
  const finishedItems = allItems.filter(i => i.data.status === 'finished')

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-xama-black)', fontFamily: "'Rajdhani', sans-serif" }}>
      {/* Background */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse 70% 40% at 50% 0%, rgba(249,115,22,0.05) 0%, transparent 60%)',
      }} />

      {/* ── Navbar ── */}
<header style={{ position: 'relative', zIndex: 1, background: 'var(--color-xama-surface)', borderBottom: '1px solid var(--color-xama-border)' }}>
  <div style={{ height: '2px', background: 'linear-gradient(90deg, var(--color-xama-orange), transparent 50%)' }} />
  <div style={{
    maxWidth: '1200px', margin: '0 auto', padding: '0 24px',
    display: 'flex', alignItems: 'center', gap: '16px', height: '60px',
  }}>
    {/* Logo */}
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => navigate('/dashboard')}>
      <div style={{
        width: '32px', height: '32px', fontSize: '16px',
        background: 'linear-gradient(135deg, rgba(249,115,22,0.25), rgba(249,115,22,0.05))',
        border: '1px solid rgba(249,115,22,0.3)', borderRadius: '8px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>🔥</div>
      <div>
        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-xama-text)', letterSpacing: '0.06em', lineHeight: 1 }}>XAMA</div>
        <div style={{ fontSize: '8px', color: 'var(--color-xama-orange)', letterSpacing: '0.16em', textTransform: 'uppercase', lineHeight: 1 }}>Fantasy</div>
      </div>
    </div>

    <div style={{ flex: 1 }} />

    {/* Nav links */}
    <nav style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <button
        onClick={() => navigate('/dashboard')}
        style={{
          background: 'none', border: 'none', padding: '6px 12px',
          fontSize: '13px', fontWeight: 600, letterSpacing: '0.04em',
          color: 'var(--color-xama-muted)', cursor: 'pointer',
          fontFamily: "'Rajdhani', sans-serif",
          transition: 'color 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--color-xama-text)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--color-xama-muted)'}
      >
        Dashboard
      </button>
      <button
        onClick={() => navigate('/tournaments')}
        style={{
          background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.3)',
          borderRadius: '6px', padding: '6px 12px',
          fontSize: '13px', fontWeight: 700, letterSpacing: '0.04em',
          color: 'var(--color-xama-orange)', cursor: 'pointer',
          fontFamily: "'Rajdhani', sans-serif",
        }}
      >
        Torneios
      </button>
      <button
        onClick={() => navigate('/profile')}
        style={{
          background: 'none', border: '1px solid var(--color-xama-border)',
          borderRadius: '6px', padding: '6px 12px',
          fontSize: '13px', fontWeight: 600, letterSpacing: '0.04em',
          color: 'var(--color-xama-muted)', cursor: 'pointer',
          fontFamily: "'Rajdhani', sans-serif",
          transition: 'color 0.15s, border-color 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-xama-text)'; e.currentTarget.style.borderColor = 'var(--color-xama-muted)' }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-xama-muted)'; e.currentTarget.style.borderColor = 'var(--color-xama-border)' }}
      >
        👤 Perfil
      </button>
      <button
        onClick={logout}
        style={{
          background: 'none', border: '1px solid var(--color-xama-border)',
          borderRadius: '6px', padding: '6px 14px',
          fontSize: '12px', fontWeight: 600, letterSpacing: '0.06em',
          color: 'var(--color-xama-muted)', cursor: 'pointer',
          fontFamily: "'Rajdhani', sans-serif",
        }}
      >
        Sair
      </button>
    </nav>
  </div>
</header>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <main style={{ position: 'relative', zIndex: 1, maxWidth: '1200px', margin: '0 auto', padding: '48px 24px' }}>

        <div style={{ marginBottom: '40px' }}>
          <div style={{
            fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em',
            color: 'var(--color-xama-orange)', textTransform: 'uppercase',
            marginBottom: '8px', fontFamily: "'JetBrains Mono', monospace",
          }}>
            Selecione o campeonato
          </div>
          <h1 style={{ fontSize: '32px', fontWeight: 700, color: 'var(--color-xama-text)', letterSpacing: '-0.01em', margin: 0 }}>
            Torneios Disponíveis
          </h1>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '80px', color: 'var(--color-xama-muted)', fontSize: '14px' }}>
            Carregando torneios…
          </div>
        )}
        {error && <div className="msg-error" style={{ maxWidth: '400px' }}>{error}</div>}

        {!loading && !error && (
          <>
            {/* ── Ativos / Em breve ── */}
            {activeItems.length > 0 ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: '16px',
              }}>
                {activeItems.map((item) =>
                  item.type === 'championship' ? (
                    <ChampionshipBlock
                      key={`champ-${item.data.id}`}
                      championship={item.data}
                      tournById={tournById}
                      navigate={navigate}
                    />
                  ) : (
                    <TournamentCard
                      key={`tourn-${item.data.id}`}
                      t={item.data}
                      navigate={navigate}
                    />
                  )
                )}
              </div>
            ) : (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--color-xama-muted)', fontSize: '14px' }}>
                Nenhum campeonato ativo no momento.
              </div>
            )}

            {/* ── Encerrados (colapsável) ── */}
            {finishedItems.length > 0 && (
              <div style={{ marginTop: '48px' }}>
                {/* Header da seção */}
                <button
                  onClick={() => setShowFinished(v => !v)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '0 0 16px 0', width: '100%', textAlign: 'left',
                  }}
                >
                  <div style={{ flex: 1, height: '1px', background: 'var(--color-xama-border)' }} />
                  <span style={{
                    fontSize: '11px', fontWeight: 700, letterSpacing: '0.16em',
                    textTransform: 'uppercase', color: 'var(--color-xama-muted)',
                    fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap',
                  }}>
                    {showFinished ? '▲' : '▼'} &nbsp;Encerrados ({finishedItems.length})
                  </span>
                  <div style={{ flex: 1, height: '1px', background: 'var(--color-xama-border)' }} />
                </button>

                {/* Grid encerrados */}
                {showFinished && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                    gap: '16px',
                    opacity: 0.65,
                  }}>
                    {finishedItems.map((item) =>
                      item.type === 'championship' ? (
                        <ChampionshipBlock
                          key={`champ-${item.data.id}`}
                          championship={item.data}
                          tournById={tournById}
                          navigate={navigate}
                        />
                      ) : (
                        <TournamentCard
                          key={`tourn-${item.data.id}`}
                          t={item.data}
                          navigate={navigate}
                        />
                      )
                    )}
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
