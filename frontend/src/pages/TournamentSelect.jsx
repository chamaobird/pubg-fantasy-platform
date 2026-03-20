// frontend/src/pages/TournamentSelect.jsx
// XAMA Fantasy — Tournament Selection
// Shows all available tournaments as cards, user picks one to enter

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { API_BASE_URL } from '../config'

const REGION_FLAGS = {
  AM:  '🏆',
  SEA: '🏆',
  AS:  '🏆',
  EU:  '🏆',
  KR:  '🏆',
  CN:  '🏆',
}

const STATUS_STYLE = {
  active:   { bg: 'rgba(74,222,128,0.1)',  border: 'rgba(74,222,128,0.3)',  color: '#4ade80', label: 'AO VIVO' },
  upcoming: { bg: 'rgba(249,115,22,0.1)',  border: 'rgba(249,115,22,0.3)',  color: '#f97316', label: 'EM BREVE' },
  finished: { bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.3)', color: '#6b7280', label: 'ENCERRADO' },
}

export default function TournamentSelect() {
  const { token, logout } = useAuth()
  const navigate = useNavigate()

  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')

  useEffect(() => {
    fetch(`${API_BASE_URL}/tournaments/?skip=0&limit=50`, {
      headers: { Accept: 'application/json' },
    })
      .then((r) => r.json())
      .then((data) => { setTournaments(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => { setError('Erro ao carregar torneios'); setLoading(false) })
  }, [])

  // Group by status: active first, then upcoming, then finished
  const sorted = [...tournaments].sort((a, b) => {
    const order = { active: 0, upcoming: 1, finished: 2 }
    return (order[a.status] ?? 3) - (order[b.status] ?? 3)
  })

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--color-xama-black)',
      fontFamily: "'Rajdhani', sans-serif",
    }}>
      {/* Background */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse 70% 40% at 50% 0%, rgba(249,115,22,0.05) 0%, transparent 60%)',
      }} />

      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <header style={{
        position: 'relative', zIndex: 1,
        background: 'var(--color-xama-surface)',
        borderBottom: '1px solid var(--color-xama-border)',
      }}>
        <div style={{ height: '2px', background: 'linear-gradient(90deg, var(--color-xama-orange), transparent 50%)' }} />
        <div style={{
          maxWidth: '1200px', margin: '0 auto', padding: '0 24px',
          display: 'flex', alignItems: 'center', gap: '16px', height: '60px',
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
               onClick={() => navigate('/tournaments')}>
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
        </div>
      </header>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <main style={{ position: 'relative', zIndex: 1, maxWidth: '1200px', margin: '0 auto', padding: '48px 24px' }}>

        {/* Page header */}
        <div style={{ marginBottom: '40px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', color: 'var(--color-xama-orange)', textTransform: 'uppercase', marginBottom: '8px', fontFamily: "'JetBrains Mono', monospace" }}>
            Selecione o campeonato
          </div>
          <h1 style={{ fontSize: '32px', fontWeight: 700, color: 'var(--color-xama-text)', letterSpacing: '-0.01em', margin: 0 }}>
            Torneios Disponíveis
          </h1>
        </div>

        {/* States */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '80px', color: 'var(--color-xama-muted)', fontSize: '14px' }}>
            Carregando torneios…
          </div>
        )}
        {error && <div className="msg-error" style={{ maxWidth: '400px' }}>{error}</div>}

        {/* Tournament grid */}
        {!loading && !error && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '16px',
          }}>
            {sorted.map((t) => {
              const st = STATUS_STYLE[t.status] || STATUS_STYLE.finished
              const isGlobal = t.pubg_id && (t.pubg_id.startsWith('as-pgs') || t.pubg_id.startsWith('kr-pgs') || t.pubg_id.startsWith('as-pgc'))
              const flag = isGlobal ? '🌍🏆' : (REGION_FLAGS[t.region] || '🏆')
              const regionLabel = { KR: 'Coreia do Sul', CN: 'China', SEA: 'Sudeste Asiático', AS: 'Ásia', AM: 'Américas', EU: 'Europa' }

              return (
                <div
                  key={t.id}
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
                  {/* Top accent on active */}
                  {t.status === 'active' && (
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, var(--color-xama-orange), transparent 70%)' }} />
                  )}

                  {/* Header row */}
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

                  {/* Name */}
                  <div style={{
                    fontSize: '17px', fontWeight: 700,
                    color: 'var(--color-xama-text)',
                    marginBottom: '6px', lineHeight: 1.3,
                  }}>
                    {t.name}
                  </div>

                  {/* Meta */}
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--color-xama-muted)' }}>{regionLabel[t.region] || t.region}</span>
                    {t.pubg_id && (
                      <span style={{ fontSize: '11px', color: '#2a3046', fontFamily: "'JetBrains Mono', monospace" }}>
                        {t.pubg_id}
                      </span>
                    )}
                  </div>

                  {/* Footer */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{
                      fontSize: '12px', color: 'var(--color-xama-muted)',
                    }}>
                      Budget: <span style={{ color: 'var(--color-xama-gold)', fontFamily: "'JetBrains Mono', monospace" }}>${t.budget_limit}</span>
                    </span>
                    <span style={{
                      fontSize: '12px', fontWeight: 700, color: 'var(--color-xama-orange)',
                      letterSpacing: '0.04em',
                    }}>
                      Entrar →
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
