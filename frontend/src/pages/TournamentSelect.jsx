// frontend/src/pages/TournamentSelect.jsx
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

// ── Tournament logo (same fallback logic as Dashboard) ─────────────────────
const LOGO_CANDIDATES = {
  PGS: ['/logos/Tournaments/PGS.png', '/logos/tournaments/PGS.png'],
  PAS: ['/logos/Tournaments/PAS.png', '/logos/tournaments/PAS.png'],
}

function TournamentLogo({ name = '', size = 48 }) {
  const upper = name.toUpperCase()
  const key = upper.includes('PGS') ? 'PGS' : upper.includes('PAS') ? 'PAS' : null
  const candidates = key ? LOGO_CANDIDATES[key] : []
  const [idx, setIdx] = useState(0)
  const [failed, setFailed] = useState(false)

  if (!key || failed || candidates.length === 0) {
    const isGlobal = name.toUpperCase().includes('PGS') || name.toUpperCase().includes('PGC')
    return <span style={{ fontSize: size * 0.7 + 'px', lineHeight: 1 }}>{isGlobal ? '🌍🏆' : '🏆'}</span>
  }

  return (
    <div style={{
      width: size + 'px', height: size + 'px',
      borderRadius: '10px',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', flexShrink: 0,
    }}>
      <img
        src={candidates[idx]}
        alt=""
        draggable={false}
        style={{ width: size * 0.78 + 'px', height: size * 0.78 + 'px', objectFit: 'contain' }}
        onError={() => {
          if (idx + 1 < candidates.length) setIdx(i => i + 1)
          else setFailed(true)
        }}
      />
    </div>
  )
}

// ── Standalone tournament card ──────────────────────────────────────────────
function TournamentCard({ t, navigate }) {
  const st = STATUS_STYLE[t.status] || STATUS_STYLE.finished

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
        gridColumn: '1 / -1',
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
        <TournamentLogo name={t.name} size={48} />
        <span style={{
          fontSize: '14px', fontWeight: 700, letterSpacing: '0.08em',
          padding: '4px 10px', borderRadius: '4px',
          background: st.bg, border: `1px solid ${st.border}`, color: st.color,
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {st.label}
        </span>
      </div>

      <div style={{ fontSize: '25px', fontWeight: 700, color: 'var(--color-xama-text)', marginBottom: '8px', lineHeight: 1.3, fontFamily: "'Rajdhani', sans-serif" }}>
        {t.name}
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
        <span style={{ fontSize: '16px', color: 'var(--color-xama-muted)' }}>{REGION_LABEL[t.region] || t.region}</span>
        {t.pubg_id && (
          <span style={{ fontSize: '14px', color: '#2a3046', fontFamily: "'JetBrains Mono', monospace" }}>
            {t.pubg_id}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '16px', color: 'var(--color-xama-muted)' }}>
          Budget: <span style={{ color: 'var(--color-xama-gold)', fontFamily: "'JetBrains Mono', monospace" }}>${t.budget_limit}</span>
        </span>
        <span style={{ fontSize: '17px', fontWeight: 700, color: 'var(--color-xama-orange)', letterSpacing: '0.04em' }}>
          Entrar →
        </span>
      </div>
    </div>
  )
}

// ── Championship block ──────────────────────────────────────────────────────
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
      {championship.status === 'active' && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, var(--color-xama-orange), transparent 70%)' }} />
      )}

      {/* Championship header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
        <TournamentLogo name={championship.name} size={56} />
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: '14px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase',
            color: 'var(--color-xama-orange)', fontFamily: "'JetBrains Mono', monospace", marginBottom: '4px',
          }}>
            Campeonato · {REGION_LABEL[championship.region] || championship.region}
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-xama-text)', lineHeight: 1.2, fontFamily: "'Rajdhani', sans-serif" }}>
            {championship.name}
          </div>
        </div>
        <span style={{
          fontSize: '14px', fontWeight: 700, letterSpacing: '0.08em',
          padding: '5px 12px', borderRadius: '4px', whiteSpace: 'nowrap',
          background: st.bg, border: `1px solid ${st.border}`, color: st.color,
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {st.label}
        </span>
      </div>

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
                background: isActive ? 'rgba(249,115,22,0.06)' : 'rgba(255,255,255,0.02)',
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
              <div style={{
                fontSize: '13px', fontWeight: 700, letterSpacing: '0.12em',
                color: 'var(--color-xama-muted)', fontFamily: "'JetBrains Mono', monospace",
                marginBottom: '4px', textTransform: 'uppercase',
              }}>
                Fase {phase.phase_order}
              </div>

              <div style={{
                fontSize: '19px', fontWeight: 700, color: 'var(--color-xama-text)',
                marginBottom: '12px', lineHeight: 1.3, fontFamily: "'Rajdhani', sans-serif",
              }}>
                {phase.phase}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{
                  fontSize: '13px', fontWeight: 700, letterSpacing: '0.08em',
                  padding: '3px 8px', borderRadius: '3px',
                  background: pst.bg, border: `1px solid ${pst.border}`, color: pst.color,
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  {pst.label}
                </span>
                <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-xama-orange)' }}>
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

// ── Main page ───────────────────────────────────────────────────────────────
export default function TournamentSelect() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const [tournaments, setTournaments]   = useState([])
  const [championships, setChampionships] = useState([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState('')
  const [showFinished, setShowFinished] = useState(false)
  const [showOnHold, setShowOnHold]     = useState(false)

  // IDs de torneios/campeonatos que devem aparecer em destaque (AO VIVO real)
  // Atualizar esta lista conforme novos torneios principais entram em cena
  const PRIORITY_IDS = new Set([19, 21])

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

  const tournById = Object.fromEntries(tournaments.map(t => [t.id, t]))
  const champTournamentIds = new Set(championships.flatMap(c => c.phases.map(p => p.tournament_id)))
  const standalone = tournaments.filter(t => !champTournamentIds.has(t.id))

  const statusOrder = { active: 0, upcoming: 1, finished: 2 }

  // Deriva status real do championship: se todas as fases estão finished → finished
  const champEffectiveStatus = (c) => {
    const statuses = c.phases.map(p => tournById[p.tournament_id]?.status || 'finished')
    if (statuses.every(s => s === 'finished')) return 'finished'
    if (statuses.some(s => s === 'active')) return 'active'
    return 'upcoming'
  }

  const isPriority = (item) => {
    if (item.type === 'championship') return item.data.phases.some(p => PRIORITY_IDS.has(p.tournament_id))
    return PRIORITY_IDS.has(item.data.id)
  }

  const allItems = [
    ...championships.map(c => {
      const eff = champEffectiveStatus(c)
      return { type: 'championship', data: { ...c, status: eff }, statusRank: statusOrder[eff] ?? 3 }
    }),
    ...standalone.map(t => ({ type: 'tournament', data: t, statusRank: statusOrder[t.status] ?? 3 })),
  ].sort((a, b) => a.statusRank - b.statusRank)

  const activeItems   = allItems.filter(i => i.data.status !== 'finished' && isPriority(i))
  const onHoldItems   = allItems.filter(i => i.data.status !== 'finished' && !isPriority(i))
  const finishedItems = allItems.filter(i => i.data.status === 'finished')

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-xama-black)', fontFamily: "'Rajdhani', sans-serif" }}>
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse 70% 40% at 50% 0%, rgba(249,115,22,0.05) 0%, transparent 60%)',
      }} />

      {/* ── Navbar (uses shared Navbar component) ── */}
      <header style={{ position: 'relative', zIndex: 1, background: 'var(--color-xama-surface)', borderBottom: '1px solid var(--color-xama-border)' }}>
        <div style={{ height: '2px', background: 'linear-gradient(90deg, var(--color-xama-orange), transparent 50%)' }} />
        <div style={{
          maxWidth: '1200px', margin: '0 auto', padding: '0 24px',
          display: 'flex', alignItems: 'center', gap: '16px', height: '70px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => navigate('/dashboard')}>
            <div style={{
              width: '40px', height: '40px', fontSize: '20px',
              background: 'linear-gradient(135deg, rgba(249,115,22,0.25), rgba(249,115,22,0.05))',
              border: '1px solid rgba(249,115,22,0.3)', borderRadius: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>🔥</div>
            <div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-xama-text)', letterSpacing: '0.06em', lineHeight: 1 }}>XAMA</div>
              <div style={{ fontSize: '11px', color: 'var(--color-xama-orange)', letterSpacing: '0.16em', textTransform: 'uppercase', lineHeight: 1 }}>Fantasy</div>
            </div>
          </div>

          <div style={{ flex: 1 }} />

          <nav style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                background: 'none', border: 'none', padding: '8px 16px',
                fontSize: '17px', fontWeight: 600, letterSpacing: '0.04em',
                color: 'var(--color-xama-muted)', cursor: 'pointer',
                fontFamily: "'Rajdhani', sans-serif", transition: 'color 0.15s',
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
                borderRadius: '6px', padding: '8px 16px',
                fontSize: '17px', fontWeight: 700, letterSpacing: '0.04em',
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
                borderRadius: '6px', padding: '8px 16px',
                fontSize: '17px', fontWeight: 600, letterSpacing: '0.04em',
                color: 'var(--color-xama-muted)', cursor: 'pointer',
                fontFamily: "'Rajdhani', sans-serif", transition: 'color 0.15s, border-color 0.15s',
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
                borderRadius: '6px', padding: '8px 18px',
                fontSize: '16px', fontWeight: 600, letterSpacing: '0.06em',
                color: 'var(--color-xama-muted)', cursor: 'pointer',
                fontFamily: "'Rajdhani', sans-serif",
              }}
            >
              Sair
            </button>
          </nav>
        </div>
      </header>

      {/* ── Content ── */}
      <main style={{ position: 'relative', zIndex: 1, maxWidth: '1200px', margin: '0 auto', padding: '48px 24px' }}>

        <div style={{ marginBottom: '40px' }}>
          <div style={{
            fontSize: '16px', fontWeight: 700, letterSpacing: '0.2em',
            color: 'var(--color-xama-orange)', textTransform: 'uppercase',
            marginBottom: '8px', fontFamily: "'JetBrains Mono', monospace",
          }}>
            Selecione o campeonato
          </div>
          <h1 style={{ fontSize: '48px', fontWeight: 700, color: 'var(--color-xama-text)', letterSpacing: '-0.01em', margin: 0, fontFamily: "'Rajdhani', sans-serif" }}>
            Torneios Disponíveis
          </h1>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '80px', color: 'var(--color-xama-muted)', fontSize: '19px' }}>
            Carregando torneios…
          </div>
        )}
        {error && <div className="msg-error" style={{ maxWidth: '400px' }}>{error}</div>}

        {!loading && !error && (
          <>
            {activeItems.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
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
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--color-xama-muted)', fontSize: '19px' }}>
                Nenhum campeonato ativo no momento.
              </div>
            )}

            {/* ── Seção Em Espera ── */}
            {onHoldItems.length > 0 && (
              <div style={{ marginTop: '48px' }}>
                <button
                  onClick={() => setShowOnHold(v => !v)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '0 0 16px 0', width: '100%', textAlign: 'left',
                  }}
                >
                  <div style={{ flex: 1, height: '1px', background: 'var(--color-xama-border)' }} />
                  <span style={{
                    fontSize: '16px', fontWeight: 700, letterSpacing: '0.16em',
                    textTransform: 'uppercase', color: '#f97316',
                    fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap',
                  }}>
                    {showOnHold ? '▲' : '▼'} &nbsp;Em Espera ({onHoldItems.length})
                  </span>
                  <div style={{ flex: 1, height: '1px', background: 'var(--color-xama-border)' }} />
                </button>

                {showOnHold && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px', opacity: 0.75 }}>
                    {onHoldItems.map((item) =>
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

            {/* ── Seção Encerrados ── */}
            {finishedItems.length > 0 && (
              <div style={{ marginTop: '24px' }}>
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
                    fontSize: '16px', fontWeight: 700, letterSpacing: '0.16em',
                    textTransform: 'uppercase', color: 'var(--color-xama-muted)',
                    fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap',
                  }}>
                    {showFinished ? '▲' : '▼'} &nbsp;Encerrados ({finishedItems.length})
                  </span>
                  <div style={{ flex: 1, height: '1px', background: 'var(--color-xama-border)' }} />
                </button>

                {showFinished && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px', opacity: 0.65 }}>
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
