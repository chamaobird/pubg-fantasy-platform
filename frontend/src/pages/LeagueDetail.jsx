import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { API_BASE_URL as API } from '../config'
import Navbar from '../components/Navbar'

function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => {})
  }
}

export default function LeagueDetail() {
  const { id } = useParams()
  const { token } = useAuth()
  const navigate = useNavigate()
  const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const [league, setLeague] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [stages, setStages] = useState([])
  const [selectedStage, setSelectedStage] = useState('')
  const [leaderboard, setLeaderboard] = useState([])
  const [lbLoading, setLbLoading] = useState(false)

  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`${API}/leagues/${id}`, { headers: H })
      .then(r => {
        if (r.status === 401) { window.dispatchEvent(new Event('auth:session-expired')); return null }
        if (!r.ok) throw new Error('Liga não encontrada')
        return r.json()
      })
      .then(d => {
        if (!d) return
        setLeague(d)
        return fetch(`${API}/championships/${d.championship_id}`)
          .then(r => r.ok ? r.json() : null)
          .then(ch => {
            if (ch?.stages) {
              const locked = ch.stages.filter(s => s.lineup_status === 'locked')
              setStages(locked)
              if (locked.length > 0) setSelectedStage(String(locked[locked.length - 1].id))
            }
          })
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [id, token])

  useEffect(() => {
    if (!selectedStage || !id) return
    setLbLoading(true)
    fetch(`${API}/leagues/${id}/leaderboard/${selectedStage}`, { headers: H })
      .then(r => r.ok ? r.json() : [])
      .then(d => setLeaderboard(Array.isArray(d) ? d : []))
      .catch(() => setLeaderboard([]))
      .finally(() => setLbLoading(false))
  }, [selectedStage, id, token])

  function handleCopyCode() {
    if (!league) return
    copyToClipboard(league.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleRemoveMember(userId) {
    if (!window.confirm('Remover este membro da liga?')) return
    const r = await fetch(`${API}/leagues/${id}/members/${userId}`, { method: 'DELETE', headers: H })
    if (r.ok) {
      setLeague(prev => ({ ...prev, members: prev.members.filter(m => m.user_id !== userId), member_count: prev.member_count - 1 }))
    }
  }

  async function handleDeleteLeague() {
    if (!window.confirm('Tem certeza que deseja deletar esta liga? Esta ação não pode ser desfeita.')) return
    const r = await fetch(`${API}/leagues/${id}`, { method: 'DELETE', headers: H })
    if (r.ok) navigate('/leagues')
  }

  if (loading) return (
    <div className="xm-page">
      <Navbar />
      <p className="xm-empty">Carregando...</p>
    </div>
  )

  if (error || !league) return (
    <div className="xm-page">
      <Navbar />
      <div className="xm-empty">
        <p style={{ color: 'var(--xm-red)', fontSize: 18, marginBottom: 16 }}>
          {error || 'Liga não encontrada'}
        </p>
        <button className="xm-btn xm-btn--ghost" onClick={() => navigate('/leagues')}>
          Voltar
        </button>
      </div>
    </div>
  )

  return (
    <div className="xm-page">
      <Navbar />
      <div className="xm-page__container xm-page__container--lg">

        <header style={{ marginBottom: 28 }}>
          <button className="xm-page-header__back" onClick={() => navigate('/leagues')}>
            ← Minhas Ligas
          </button>
          <div className="xm-page-header">
            <div>
              <h1 className="xm-page-header__title">{league.name}</h1>
              <p className="xm-page-header__subtitle">
                {league.championship_name} · {league.member_count} membros
              </p>
            </div>
            <div className="xm-invite">
              <div className="xm-invite__code">
                <div className="xm-invite__label">Código de Convite</div>
                <div className="xm-invite__value">{league.invite_code}</div>
              </div>
              <button
                onClick={handleCopyCode}
                className={`xm-invite__copy ${copied ? 'xm-invite__copy--copied' : ''}`}
              >
                {copied ? '✓ Copiado' : 'Copiar'}
              </button>
            </div>
          </div>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, alignItems: 'start' }}>

          <section className="xm-card xm-card--glass xm-card--compact">
            <div className="xm-card__title-row">
              <h2 className="xm-card__title xm-card__title--inline">Leaderboard</h2>
              {stages.length > 0 && (
                <select
                  className="xm-select"
                  style={{ width: 'auto', fontSize: 13, padding: '6px 32px 6px 10px' }}
                  value={selectedStage}
                  onChange={e => setSelectedStage(e.target.value)}
                >
                  {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
            </div>

            {stages.length === 0 ? (
              <p className="xm-empty__body" style={{ padding: '24px 0' }}>
                Nenhuma stage encerrada ainda. O leaderboard aparecerá após o scoring.
              </p>
            ) : lbLoading ? (
              <p className="xm-empty__body" style={{ padding: '24px 0' }}>Carregando...</p>
            ) : leaderboard.length === 0 ? (
              <p className="xm-empty__body" style={{ padding: '24px 0' }}>
                Nenhum membro pontuou nesta stage ainda.
              </p>
            ) : (
              <div>
                {leaderboard.map((entry, i) => (
                  <div
                    key={entry.user_id}
                    className={`xm-lb-row ${i === 0 ? 'xm-lb-row--first' : ''}`}
                  >
                    <span className={`xm-lb-row__rank xm-lb-row__rank--${i + 1 <= 3 ? i + 1 : 'n'}`}>
                      #{entry.rank}
                    </span>
                    <span className="xm-lb-row__name">
                      {entry.username || entry.user_id.slice(0, 8)}
                    </span>
                    <div>
                      <div className="xm-lb-row__pts">{entry.total_points.toFixed(2)}</div>
                      {entry.global_rank && (
                        <div className="xm-lb-row__sub">#{entry.global_rank} global</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <aside>
            <section className="xm-card xm-card--glass xm-card--compact">
              <h2 className="xm-card__title">Membros ({league.member_count})</h2>
              {league.members.map(m => (
                <div key={m.user_id} className="xm-row" style={{ padding: '8px 0' }}>
                  <span className="xm-row__title" style={{ fontSize: 14 }}>
                    {m.username || m.user_id.slice(0, 8)}
                    {m.is_owner && <span className="xm-pill xm-pill--owner xm-pill--sm">DONO</span>}
                  </span>
                  {league.is_owner && !m.is_owner && (
                    <button
                      className="xm-btn xm-btn--ghost xm-btn--sm"
                      onClick={() => handleRemoveMember(m.user_id)}
                      title="Remover membro"
                      style={{ padding: '2px 8px' }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </section>

            {league.is_owner && (
              <button
                className="xm-btn xm-btn--danger xm-btn--full"
                onClick={handleDeleteLeague}
              >
                Deletar Liga
              </button>
            )}
          </aside>
        </div>

      </div>
    </div>
  )
}
