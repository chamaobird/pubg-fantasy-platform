// frontend/src/pages/HeadToHeadPage.jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { API_BASE_URL } from '../config'
import { useAuth } from '../App'

export default function HeadToHeadPage() {
  const { stageId, user1Id, user2Id } = useParams()
  const navigate = useNavigate()
  const { token } = useAuth()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!stageId || !user1Id || !user2Id) return
    setLoading(true)
    fetch(`${API_BASE_URL}/stages/${stageId}/compare/${user1Id}/${user2Id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [stageId, user1Id, user2Id, token])

  if (loading) return (
    <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--color-xama-muted)' }}>
      Carregando comparação...
    </div>
  )
  if (error || !data) return (
    <div style={{ padding: '48px 24px', textAlign: 'center', color: '#f87171' }}>
      Erro ao carregar comparação.
    </div>
  )

  const { user1, user2 } = data

  // players both picked
  const u1Names = new Set(user1.players.map(p => p.person_name))
  const u2Names = new Set(user2.players.map(p => p.person_name))

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 16px' }}>
      {/* back */}
      <button
        onClick={() => navigate(-1)}
        style={{
          background: 'none', border: 'none', color: 'var(--color-xama-muted)',
          cursor: 'pointer', fontSize: 13, padding: '0 0 20px', display: 'flex',
          alignItems: 'center', gap: 6,
        }}
      >
        ← Voltar
      </button>

      <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-xama-text)', margin: '0 0 24px' }}>
        Head-to-Head
      </h2>

      {/* score bar */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
        <UserScoreCard user={user1} isLeft />
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, color: 'var(--color-xama-muted)', letterSpacing: '0.06em',
          textTransform: 'uppercase', minWidth: 32,
        }}>VS</div>
        <UserScoreCard user={user2} isLeft={false} />
      </div>

      {/* player comparison table */}
      <div style={{
        background: 'var(--surface-2)', border: '1px solid var(--surface-3)',
        borderRadius: 10, overflow: 'hidden',
      }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 80px 1fr',
          background: 'var(--surface-3)', padding: '10px 16px',
          fontSize: 11, fontWeight: 700, color: 'var(--color-xama-muted)',
          letterSpacing: '0.07em', textTransform: 'uppercase',
        }}>
          <span>{user1.username}</span>
          <span style={{ textAlign: 'center' }}>pts</span>
          <span style={{ textAlign: 'right' }}>{user2.username}</span>
        </div>

        <PlayerComparisonRows user1={user1} user2={user2} u1Names={u1Names} u2Names={u2Names} />
      </div>

      {/* shared players note */}
      {[...u1Names].filter(n => u2Names.has(n)).length > 0 && (
        <p style={{ marginTop: 12, fontSize: 12, color: 'var(--color-xama-muted)' }}>
          <span style={{
            display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
            background: 'var(--color-xama-gold)', marginRight: 6,
          }} />
          Jogadores escolhidos por ambos
        </p>
      )}
    </div>
  )
}

function UserScoreCard({ user, isLeft }) {
  const higher = user.total_points > 0
  return (
    <div style={{
      flex: 1, background: 'var(--surface-2)', border: '1px solid var(--surface-3)',
      borderRadius: 10, padding: '20px 24px',
      textAlign: isLeft ? 'left' : 'right',
    }}>
      <p style={{ margin: '0 0 4px', fontSize: 13, color: 'var(--color-xama-muted)', fontWeight: 600 }}>
        {user.username}
      </p>
      <p style={{
        margin: '0 0 2px', fontSize: 30, fontWeight: 800,
        color: 'var(--color-xama-gold)', fontFamily: "'JetBrains Mono', monospace",
        fontVariantNumeric: 'tabular-nums',
      }}>
        {user.total_points.toFixed(1)}
      </p>
      {user.rank && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--color-xama-muted)' }}>
          #{user.rank} no ranking
        </p>
      )}
    </div>
  )
}

function PlayerComparisonRows({ user1, user2, u1Names, u2Names }) {
  // merge all player names from both sides
  const allNames = [...new Set([
    ...user1.players.map(p => p.person_name),
    ...user2.players.map(p => p.person_name),
  ])]

  const u1Map = Object.fromEntries(user1.players.map(p => [p.person_name, p]))
  const u2Map = Object.fromEntries(user2.players.map(p => [p.person_name, p]))

  return (
    <>
      {allNames.map((name, i) => {
        const p1 = u1Map[name]
        const p2 = u2Map[name]
        const shared = u1Names.has(name) && u2Names.has(name)

        return (
          <div key={name} style={{
            display: 'grid', gridTemplateColumns: '1fr 80px 1fr',
            padding: '10px 16px',
            borderTop: i === 0 ? 'none' : '1px solid var(--surface-3)',
            background: shared ? 'rgba(250,204,21,0.04)' : 'transparent',
          }}>
            {/* left user */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {shared && (
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', background: 'var(--color-xama-gold)',
                  flexShrink: 0,
                }} />
              )}
              {p1 ? (
                <span style={{ fontSize: 13, color: 'var(--color-xama-text)' }}>
                  {p1.person_name}
                  <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--color-xama-muted)' }}>
                    {p1.team_name}
                  </span>
                  {p1.was_captain && (
                    <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--color-xama-gold)', fontWeight: 700 }}>C</span>
                  )}
                </span>
              ) : <span style={{ fontSize: 12, color: 'var(--surface-4)' }}>—</span>}
            </div>

            {/* pts in middle */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
              <span style={{
                fontSize: 12, fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums',
                color: p1 ? 'var(--color-xama-gold)' : 'var(--surface-4)',
              }}>
                {p1?.total_pts != null ? p1.total_pts.toFixed(1) : '—'}
              </span>
              <span style={{ fontSize: 10, color: 'var(--surface-4)' }}>|</span>
              <span style={{
                fontSize: 12, fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums',
                color: p2 ? 'var(--color-xama-gold)' : 'var(--surface-4)',
              }}>
                {p2?.total_pts != null ? p2.total_pts.toFixed(1) : '—'}
              </span>
            </div>

            {/* right user */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
              {p2 ? (
                <span style={{ fontSize: 13, color: 'var(--color-xama-text)', textAlign: 'right' }}>
                  {p2.was_captain && (
                    <span style={{ marginRight: 6, fontSize: 10, color: 'var(--color-xama-gold)', fontWeight: 700 }}>C</span>
                  )}
                  <span style={{ marginRight: 6, fontSize: 11, color: 'var(--color-xama-muted)' }}>
                    {p2.team_name}
                  </span>
                  {p2.person_name}
                </span>
              ) : <span style={{ fontSize: 12, color: 'var(--surface-4)' }}>—</span>}
              {shared && (
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', background: 'var(--color-xama-gold)',
                  flexShrink: 0,
                }} />
              )}
            </div>
          </div>
        )
      })}
    </>
  )
}
