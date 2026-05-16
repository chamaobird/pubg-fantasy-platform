import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { API_BASE_URL as API } from '../config'
import Navbar from '../components/Navbar'

export default function Leagues() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const [leagues, setLeagues] = useState([])
  const [loading, setLoading] = useState(true)

  const [showCreate, setShowCreate] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createChampId, setCreateChampId] = useState('')
  const [championships, setChampionships] = useState([])
  const [creating, setCreating] = useState(false)
  const [createMsg, setCreateMsg] = useState(null)

  const [showJoin, setShowJoin] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinMsg, setJoinMsg] = useState(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`${API}/leagues`, { headers: H }).then(r => r.ok ? r.json() : []),
      fetch(`${API}/championships/?include_inactive=true`).then(r => r.ok ? r.json() : []),
    ]).then(([lg, ch]) => {
      setLeagues(Array.isArray(lg) ? lg : [])
      setChampionships(Array.isArray(ch) ? ch : [])
      if (ch.length > 0) setCreateChampId(String(ch[0].id))
    }).catch(() => {}).finally(() => setLoading(false))
  }, [token])

  async function handleCreate(e) {
    e.preventDefault()
    if (!createName.trim() || !createChampId) return
    setCreating(true); setCreateMsg(null)
    try {
      const r = await fetch(`${API}/leagues`, {
        method: 'POST', headers: H,
        body: JSON.stringify({ name: createName.trim(), championship_id: parseInt(createChampId), max_members: 50 }),
      })
      const d = await r.json()
      if (!r.ok) { setCreateMsg({ type: 'err', text: d?.detail || 'Erro ao criar liga' }); return }
      setLeagues(prev => [d, ...prev])
      setShowCreate(false); setCreateName('')
      navigate(`/leagues/${d.id}`)
    } catch (err) {
      setCreateMsg({ type: 'err', text: err.message })
    } finally { setCreating(false) }
  }

  async function handleJoin(e) {
    e.preventDefault()
    if (!joinCode.trim()) return
    setJoining(true); setJoinMsg(null)
    try {
      const r = await fetch(`${API}/leagues/join/${joinCode.trim().toUpperCase()}`, {
        method: 'POST', headers: H,
      })
      const d = await r.json()
      if (!r.ok) { setJoinMsg({ type: 'err', text: d?.detail || 'Código inválido' }); return }
      navigate(`/leagues/${d.id}`)
    } catch (err) {
      setJoinMsg({ type: 'err', text: err.message })
    } finally { setJoining(false) }
  }

  return (
    <div className="xm-page">
      <Navbar />
      <div className="xm-page__container xm-page__container--md">

        <header className="xm-page-header">
          <div>
            <h1 className="xm-page-header__title">Ligas Privadas</h1>
            <p className="xm-page-header__subtitle">Compete com seus amigos no mesmo campeonato</p>
          </div>
          <div className="xm-page-header__actions">
            <button
              className="xm-btn xm-btn--ghost"
              onClick={() => { setShowJoin(!showJoin); setShowCreate(false) }}
            >
              Entrar com código
            </button>
            <button
              className="xm-btn xm-btn--primary"
              onClick={() => { setShowCreate(!showCreate); setShowJoin(false) }}
            >
              + Criar Liga
            </button>
          </div>
        </header>

        {showCreate && (
          <section className="xm-card xm-card--glass">
            <h2 className="xm-card__title">Nova Liga</h2>
            <form onSubmit={handleCreate}>
              <div className="xm-field">
                <label className="xm-label">Nome da Liga</label>
                <input
                  className="xm-input"
                  value={createName}
                  onChange={e => setCreateName(e.target.value)}
                  placeholder="Ex: Galera do Discord"
                  maxLength={100}
                  autoFocus
                />
              </div>
              <div className="xm-field">
                <label className="xm-label">Campeonato</label>
                <select
                  className="xm-select"
                  value={createChampId}
                  onChange={e => setCreateChampId(e.target.value)}
                >
                  {championships.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              {createMsg && (
                <p className={`xm-msg xm-msg--${createMsg.type === 'err' ? 'err' : 'ok'}`}>
                  {createMsg.text}
                </p>
              )}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
                <button type="button" className="xm-btn xm-btn--ghost" onClick={() => setShowCreate(false)}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="xm-btn xm-btn--primary"
                  disabled={!createName.trim() || creating}
                >
                  {creating ? 'Criando...' : 'Criar'}
                </button>
              </div>
            </form>
          </section>
        )}

        {showJoin && (
          <section className="xm-card xm-card--glass">
            <h2 className="xm-card__title">Entrar em uma Liga</h2>
            <form onSubmit={handleJoin} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <input
                  className="xm-input xm-input--code"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 8))}
                  placeholder="XXXXXXXX"
                  maxLength={8}
                  autoFocus
                />
                {joinMsg && (
                  <p className={`xm-msg xm-msg--${joinMsg.type === 'err' ? 'err' : 'ok'}`}>
                    {joinMsg.text}
                  </p>
                )}
              </div>
              <button
                type="submit"
                className="xm-btn xm-btn--primary"
                disabled={joinCode.length < 8 || joining}
              >
                {joining ? 'Entrando...' : 'Entrar'}
              </button>
            </form>
          </section>
        )}

        {loading ? (
          <p className="xm-empty">Carregando...</p>
        ) : leagues.length === 0 ? (
          <section className="xm-card xm-card--glass xm-card--empty">
            <div className="xm-empty__icon">🏆</div>
            <h3 className="xm-empty__title">Nenhuma liga ainda</h3>
            <p className="xm-empty__body">
              Crie uma liga e convide seus amigos, ou entre em uma liga com um código.
            </p>
          </section>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {leagues.map(lg => (
              <section
                key={lg.id}
                className="xm-card xm-card--glass xm-card--clickable"
                style={{ marginBottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}
                onClick={() => navigate(`/leagues/${lg.id}`)}
              >
                <div className="xm-row__main">
                  <div className="xm-row__title" style={{ fontSize: 18, color: '#fff' }}>
                    {lg.name}
                    {lg.is_owner && <span className="xm-pill xm-pill--owner xm-pill--sm">DONO</span>}
                  </div>
                  <div className="xm-row__meta">{lg.championship_name}</div>
                </div>
                <div className="xm-stat xm-stat--right">
                  <span className="xm-stat__value xm-stat__value--md">
                    {lg.member_count} / {lg.max_members}
                  </span>
                  <span className="xm-stat__label">membros</span>
                </div>
              </section>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
