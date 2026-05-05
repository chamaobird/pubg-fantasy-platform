// pages/FaceoffPage.jsx
import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import FaceoffCard from '../components/FaceoffCard'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

export default function FaceoffPage({ token, championshipId: championshipIdProp }) {
  const params = useParams()
  const championshipId = championshipIdProp ?? params.championshipId
  const [faceoffs, setFaceoffs] = useState([])
  const [champ, setChamp]       = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  const headers = token ? { Authorization: `Bearer ${token}` } : {}

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [fo, ch] = await Promise.all([
        fetch(`${API_BASE_URL}/faceoffs?championship_id=${championshipId}`, { headers }).then(r => r.json()),
        fetch(`${API_BASE_URL}/championships/${championshipId}`).then(r => r.json()),
      ])
      setFaceoffs(Array.isArray(fo) ? fo : [])
      setChamp(ch?.id ? ch : null)
    } catch {
      setError('Erro ao carregar faceoffs.')
    } finally {
      setLoading(false)
    }
  }, [championshipId, token])

  useEffect(() => { load() }, [load])

  const openFaceoffs     = faceoffs.filter(f => f.status === 'open')
  const resolvedFaceoffs = faceoffs.filter(f => f.status === 'resolved')
  const allVoted         = openFaceoffs.length > 0 && openFaceoffs.every(f => f.my_vote)
  const myVotedOpen      = openFaceoffs.filter(f => f.my_vote).length
  const myCorrect        = resolvedFaceoffs.filter(f => f.my_vote && f.winner_team_name === (f.my_vote === 'a' ? f.team_a_name : f.team_b_name)).length
  const myResolved       = resolvedFaceoffs.filter(f => f.my_vote).length

  // Embedded = inside TournamentHub tab (no back link, no page wrapper)
  const isEmbedded = !!championshipIdProp

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', padding: isEmbedded ? '8px 0 40px' : '28px 16px 60px' }}>

      {/* Back link — só na rota standalone */}
      {!isEmbedded && (
        <Link to="/championships" style={{ fontSize: 12, color: 'var(--color-xama-muted)', textDecoration: 'none', display: 'inline-block', marginBottom: 20 }}>
          ← Campeonatos
        </Link>
      )}

      {/* Hero header */}
      <div style={{
        marginBottom: 28,
        padding: '28px 28px 24px',
        background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(249,115,22,0.06) 100%)',
        border: '1px solid rgba(99,102,241,0.25)',
        borderRadius: 16,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorativo */}
        <div style={{
          position: 'absolute', top: -20, right: -20,
          width: 120, height: 120, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -30, left: '40%',
          width: 160, height: 160, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(249,115,22,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', position: 'relative' }}>
          <div style={{
            fontSize: 40, width: 64, height: 64, borderRadius: 14,
            background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(249,115,22,0.15))',
            border: '1px solid rgba(99,102,241,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            ⚔️
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: '#a5b4fc', textTransform: 'uppercase', marginBottom: 4 }}>
              Team Faceoff
            </div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: 'var(--color-xama-text)', lineHeight: 1.15, letterSpacing: '0.02em' }}>
              Quem vai longe nas Finals?
            </h1>
            {champ && (
              <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--color-xama-muted)' }}>
                {champ.name}
              </p>
            )}
          </div>

          {/* Stats box */}
          {token && faceoffs.length > 0 && (
            <div style={{
              display: 'flex', gap: 16, flexShrink: 0,
              background: 'rgba(0,0,0,0.2)', borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.06)',
              padding: '12px 18px',
            }}>
              {openFaceoffs.length > 0 && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: myVotedOpen === openFaceoffs.length ? '#4ade80' : 'var(--color-xama-orange)', lineHeight: 1 }}>
                    {myVotedOpen}/{openFaceoffs.length}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--color-xama-muted)', marginTop: 2, whiteSpace: 'nowrap' }}>votados</div>
                </div>
              )}
              {myResolved > 0 && (
                <>
                  <div style={{ width: 1, background: 'rgba(255,255,255,0.08)' }} />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: myCorrect === myResolved ? '#4ade80' : 'var(--color-xama-text)', lineHeight: 1 }}>
                      {myCorrect}/{myResolved}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--color-xama-muted)', marginTop: 2, whiteSpace: 'nowrap' }}>acertos</div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* How it works */}
        <div style={{ marginTop: 18, fontSize: 12, color: 'var(--color-xama-muted)', lineHeight: 1.65, position: 'relative' }}>
          Escolha qual time você acha que vai terminar as Finals <strong style={{ color: 'var(--color-xama-text)' }}>melhor posicionado</strong> em cada confronto.
          Os percentuais ficam ocultos até fechar as votações.
          O vencedor é determinado pelo <strong style={{ color: 'var(--color-xama-text)' }}>ranking acumulado das 3 rodadas</strong>.
        </div>
      </div>

      {/* CTAs */}
      {!token && openFaceoffs.length > 0 && (
        <div style={{
          marginBottom: 20, padding: '13px 18px',
          background: 'rgba(249,115,22,0.06)',
          border: '1px solid rgba(249,115,22,0.2)',
          borderRadius: 10, fontSize: 13, color: 'var(--color-xama-muted)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 20 }}>🔒</span>
          <span>
            <Link to="/login" style={{ color: 'var(--color-xama-orange)', fontWeight: 700 }}>Faça login</Link>
            {' '}para participar das votações.
          </span>
        </div>
      )}

      {token && allVoted && (
        <div style={{
          marginBottom: 20, padding: '13px 18px',
          background: 'rgba(74,222,128,0.05)',
          border: '1px solid rgba(74,222,128,0.2)',
          borderRadius: 10, fontSize: 13, color: '#4ade80',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 20 }}>🎯</span>
          <span>Você votou em todos os confrontos! Resultado revelado ao encerrar as votações.</span>
        </div>
      )}

      {loading && (
        <p style={{ color: 'var(--color-xama-muted)', textAlign: 'center', padding: 60 }}>
          Carregando confrontos...
        </p>
      )}
      {error && (
        <p style={{ color: '#f87171', textAlign: 'center', padding: 40 }}>{error}</p>
      )}

      {!loading && !error && faceoffs.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          color: 'var(--color-xama-muted)', fontSize: 14,
        }}>
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>⚔️</div>
          Nenhum confronto disponível para este campeonato ainda.
        </div>
      )}

      {/* Grid de cards */}
      {!loading && faceoffs.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16,
        }}>
          {faceoffs.map(f => (
            <FaceoffCard
              key={f.id}
              faceoff={f}
              token={token}
              onVoted={load}
            />
          ))}
        </div>
      )}

      {/* Footer info */}
      {!loading && faceoffs.length > 0 && (
        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--color-xama-muted)', marginTop: 32, opacity: 0.5 }}>
          {faceoffs.reduce((s, f) => s + f.total_votes, 0)} votos registrados no total
        </p>
      )}
    </div>
  )
}
