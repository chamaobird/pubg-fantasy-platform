import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { API_BASE_URL as API } from '../config'
import Navbar from '../components/Navbar'

const CS = {
  background: 'rgba(19,22,29,0.82)', backdropFilter: 'blur(8px)',
  border: '1px solid rgba(249,115,22,0.10)', borderRadius: '12px',
  padding: '28px', marginBottom: '16px',
}
const ST = {
  fontSize: '12px', fontWeight: 700, letterSpacing: '0.12em',
  textTransform: 'uppercase', color: 'var(--color-xama-muted)', marginBottom: '20px',
}
const IS = {
  width: '100%', padding: '12px 14px', borderRadius: '7px',
  background: '#0a0c11', border: '1px solid var(--color-xama-border, #1e2330)',
  color: 'var(--color-xama-text, #dce1ea)', fontSize: '16px',
  outline: 'none', boxSizing: 'border-box',
}
const btnOrange = (disabled) => ({
  padding: '11px 24px', borderRadius: '7px', border: 'none',
  background: disabled ? 'var(--surface-3)' : 'var(--color-xama-orange, #f97316)',
  color: disabled ? 'var(--color-xama-muted)' : '#fff',
  fontWeight: 700, fontSize: '14px', letterSpacing: '0.06em', textTransform: 'uppercase',
  cursor: disabled ? 'default' : 'pointer', transition: 'all 0.15s',
})
const btnGhost = {
  padding: '11px 24px', borderRadius: '7px', border: '1px solid var(--color-xama-border)',
  background: 'transparent', color: 'var(--color-xama-muted)',
  fontWeight: 700, fontSize: '14px', letterSpacing: '0.06em', textTransform: 'uppercase',
  cursor: 'pointer',
}

export default function Leagues() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const [leagues, setLeagues] = useState([])
  const [loading, setLoading] = useState(true)

  // Create form
  const [showCreate, setShowCreate] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createChampId, setCreateChampId] = useState('')
  const [championships, setChampionships] = useState([])
  const [creating, setCreating] = useState(false)
  const [createMsg, setCreateMsg] = useState(null)

  // Join form
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
    <div style={{ background: 'transparent', color: 'var(--color-xama-text)', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '40px 24px' }}>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '32px' }}>
          <div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#fff' }}>Ligas Privadas</div>
            <div style={{ fontSize: '15px', color: 'var(--color-xama-muted)', marginTop: '4px' }}>Compete com seus amigos no mesmo campeonato</div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button style={btnGhost} onClick={() => { setShowJoin(!showJoin); setShowCreate(false) }}>Entrar com código</button>
            <button style={btnOrange(false)} onClick={() => { setShowCreate(!showCreate); setShowJoin(false) }}>+ Criar Liga</button>
          </div>
        </div>

        {/* Form criar */}
        {showCreate && (
          <div style={CS}>
            <div style={ST}>Nova Liga</div>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-xama-muted)', display: 'block', marginBottom: '6px' }}>Nome da Liga</label>
                <input style={IS} value={createName} onChange={e => setCreateName(e.target.value)} placeholder="Ex: Galera do Discord" maxLength={100} autoFocus />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-xama-muted)', display: 'block', marginBottom: '6px' }}>Campeonato</label>
                <select style={{ ...IS, cursor: 'pointer' }} value={createChampId} onChange={e => setCreateChampId(e.target.value)}>
                  {championships.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {createMsg && (
                <div style={{ fontSize: '13px', color: createMsg.type === 'err' ? 'var(--color-xama-red)' : 'var(--color-xama-green)' }}>
                  {createMsg.text}
                </div>
              )}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" style={btnGhost} onClick={() => setShowCreate(false)}>Cancelar</button>
                <button type="submit" disabled={!createName.trim() || creating} style={btnOrange(!createName.trim() || creating)}>
                  {creating ? 'Criando...' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Form entrar */}
        {showJoin && (
          <div style={CS}>
            <div style={ST}>Entrar em uma Liga</div>
            <form onSubmit={handleJoin} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <input
                  style={{ ...IS, textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: 700 }}
                  value={joinCode} onChange={e => setJoinCode(e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 8))}
                  placeholder="XXXXXXXX" maxLength={8} autoFocus
                />
                {joinMsg && (
                  <div style={{ fontSize: '13px', marginTop: '6px', color: joinMsg.type === 'err' ? 'var(--color-xama-red)' : 'var(--color-xama-green)' }}>
                    {joinMsg.text}
                  </div>
                )}
              </div>
              <button type="submit" disabled={joinCode.length < 8 || joining} style={{ ...btnOrange(joinCode.length < 8 || joining), whiteSpace: 'nowrap' }}>
                {joining ? 'Entrando...' : 'Entrar'}
              </button>
            </form>
          </div>
        )}

        {/* Lista de ligas */}
        {loading ? (
          <div style={{ color: 'var(--color-xama-muted)', textAlign: 'center', padding: '40px 0' }}>Carregando...</div>
        ) : leagues.length === 0 ? (
          <div style={{ ...CS, textAlign: 'center', padding: '48px 28px' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>🏆</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-xama-text)', marginBottom: '8px' }}>Nenhuma liga ainda</div>
            <div style={{ fontSize: '14px', color: 'var(--color-xama-muted)' }}>Crie uma liga e convide seus amigos, ou entre em uma liga com um código.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {leagues.map(lg => (
              <div key={lg.id} onClick={() => navigate(`/leagues/${lg.id}`)}
                style={{
                  ...CS, cursor: 'pointer', marginBottom: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(249,115,22,0.35)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(249,115,22,0.10)'}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {lg.name}
                    {lg.is_owner && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: 'rgba(249,115,22,0.15)', color: 'var(--color-xama-orange)', fontWeight: 700, letterSpacing: '0.1em' }}>DONO</span>}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--color-xama-muted)', marginTop: '3px' }}>{lg.championship_name}</div>
                </div>
                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-xama-text)' }}>{lg.member_count} / {lg.max_members}</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-xama-muted)' }}>membros</div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
