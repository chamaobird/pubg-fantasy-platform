import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { API_BASE_URL as API } from '../config'
import Navbar from '../components/Navbar'

const CS = {
  background: 'rgba(19,22,29,0.82)', backdropFilter: 'blur(8px)',
  border: '1px solid rgba(249,115,22,0.10)', borderRadius: '12px',
  padding: '24px', marginBottom: '16px',
}
const ST = {
  fontSize: '12px', fontWeight: 700, letterSpacing: '0.12em',
  textTransform: 'uppercase', color: 'var(--color-xama-muted)', marginBottom: '16px',
}

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

  // Leaderboard
  const [stages, setStages] = useState([])
  const [selectedStage, setSelectedStage] = useState('')
  const [leaderboard, setLeaderboard] = useState([])
  const [lbLoading, setLbLoading] = useState(false)

  // Copied indicator
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
        // Busca stages do campeonato desta liga
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
    <div style={{ background: 'transparent', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ textAlign: 'center', padding: '80px 24px', color: 'var(--color-xama-muted)' }}>Carregando...</div>
    </div>
  )

  if (error || !league) return (
    <div style={{ background: 'transparent', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ textAlign: 'center', padding: '80px 24px' }}>
        <div style={{ fontSize: '18px', color: 'var(--color-xama-red)', marginBottom: '16px' }}>{error || 'Liga não encontrada'}</div>
        <button onClick={() => navigate('/leagues')} style={{ padding: '10px 24px', borderRadius: '7px', border: '1px solid var(--color-xama-border)', background: 'transparent', color: 'var(--color-xama-muted)', cursor: 'pointer', fontWeight: 700 }}>Voltar</button>
      </div>
    </div>
  )

  return (
    <div style={{ background: 'transparent', color: 'var(--color-xama-text)', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: '820px', margin: '0 auto', padding: '40px 24px' }}>

        {/* Header */}
        <div style={{ marginBottom: '28px' }}>
          <button onClick={() => navigate('/leagues')} style={{ background: 'none', border: 'none', color: 'var(--color-xama-muted)', cursor: 'pointer', fontSize: '14px', padding: 0, marginBottom: '12px' }}>← Minhas Ligas</button>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#fff' }}>{league.name}</div>
              <div style={{ fontSize: '14px', color: 'var(--color-xama-muted)', marginTop: '4px' }}>{league.championship_name} · {league.member_count} membros</div>
            </div>
            {/* Invite code */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ padding: '8px 16px', borderRadius: '8px', background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)' }}>
                <div style={{ fontSize: '11px', color: 'var(--color-xama-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '2px' }}>Código de Convite</div>
                <div style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '0.25em', color: 'var(--color-xama-orange)', fontFamily: 'monospace' }}>{league.invite_code}</div>
              </div>
              <button onClick={handleCopyCode} style={{
                padding: '8px 14px', borderRadius: '7px', border: '1px solid var(--color-xama-border)',
                background: copied ? 'rgba(74,222,128,0.1)' : 'transparent',
                color: copied ? 'var(--color-xama-green)' : 'var(--color-xama-muted)',
                cursor: 'pointer', fontWeight: 700, fontSize: '13px', transition: 'all 0.15s',
              }}>
                {copied ? '✓ Copiado' : 'Copiar'}
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '16px', alignItems: 'start' }}>

          {/* Leaderboard */}
          <div style={CS}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={ST} style={{ marginBottom: 0 }}>Leaderboard</div>
              {stages.length > 0 && (
                <select
                  value={selectedStage}
                  onChange={e => setSelectedStage(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: '6px', background: '#0a0c11', border: '1px solid var(--color-xama-border)', color: 'var(--color-xama-text)', fontSize: '13px', cursor: 'pointer' }}
                >
                  {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
            </div>

            {stages.length === 0 ? (
              <div style={{ color: 'var(--color-xama-muted)', fontSize: '14px', textAlign: 'center', padding: '24px 0' }}>
                Nenhuma stage encerrada ainda. O leaderboard aparecerá após o scoring.
              </div>
            ) : lbLoading ? (
              <div style={{ color: 'var(--color-xama-muted)', textAlign: 'center', padding: '24px 0' }}>Carregando...</div>
            ) : leaderboard.length === 0 ? (
              <div style={{ color: 'var(--color-xama-muted)', fontSize: '14px', textAlign: 'center', padding: '24px 0' }}>
                Nenhum membro pontuou nesta stage ainda.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {leaderboard.map((entry, i) => (
                  <div key={entry.user_id} style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '10px 12px', borderRadius: '8px',
                    background: i === 0 ? 'rgba(249,115,22,0.08)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${i === 0 ? 'rgba(249,115,22,0.2)' : 'var(--color-xama-border)'}`,
                  }}>
                    <span style={{
                      fontSize: '14px', fontWeight: 700, minWidth: '28px', textAlign: 'center',
                      color: i === 0 ? 'var(--color-xama-orange)' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : 'var(--color-xama-muted)',
                    }}>#{entry.rank}</span>
                    <span style={{ flex: 1, fontSize: '15px', fontWeight: 600, color: 'var(--color-xama-text)' }}>
                      {entry.username || entry.user_id.slice(0, 8)}
                    </span>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-xama-text)' }}>{entry.total_points.toFixed(2)}</div>
                      {entry.global_rank && (
                        <div style={{ fontSize: '11px', color: 'var(--color-xama-muted)' }}>#{entry.global_rank} global</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Membros */}
          <div>
            <div style={CS}>
              <div style={ST}>Membros ({league.member_count})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {league.members.map(m => (
                  <div key={m.user_id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 0',
                    borderBottom: '1px solid var(--color-xama-border)',
                  }}>
                    <div>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-xama-text)' }}>
                        {m.username || m.user_id.slice(0, 8)}
                      </span>
                      {m.is_owner && (
                        <span style={{ marginLeft: '6px', fontSize: '10px', padding: '2px 6px', borderRadius: '8px', background: 'rgba(249,115,22,0.15)', color: 'var(--color-xama-orange)', fontWeight: 700 }}>DONO</span>
                      )}
                    </div>
                    {league.is_owner && !m.is_owner && (
                      <button
                        onClick={() => handleRemoveMember(m.user_id)}
                        style={{ background: 'none', border: 'none', color: 'var(--color-xama-muted)', cursor: 'pointer', fontSize: '16px', padding: '2px 6px' }}
                        title="Remover membro"
                      >×</button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {league.is_owner && (
              <button
                onClick={handleDeleteLeague}
                style={{
                  width: '100%', padding: '10px', borderRadius: '7px',
                  background: 'transparent', border: '1px solid rgba(248,113,113,0.2)',
                  color: 'var(--color-xama-red)', fontWeight: 700, fontSize: '13px',
                  letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer',
                }}
              >
                Deletar Liga
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
