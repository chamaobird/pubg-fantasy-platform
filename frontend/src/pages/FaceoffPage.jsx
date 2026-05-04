// pages/FaceoffPage.jsx
import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import FaceoffCard from '../components/FaceoffCard'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

export default function FaceoffPage({ token, championshipId: championshipIdProp }) {
  const params = useParams()
  const championshipId = championshipIdProp ?? params.championshipId
  const [faceoffs, setFaceoffs]   = useState([])
  const [champ, setChamp]         = useState(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')

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

  const allVoted   = faceoffs.filter(f => f.status === 'open').every(f => f.my_vote)
  const myCorrect  = faceoffs.filter(f => f.status === 'resolved' && f.my_vote && f.winner_team_name === (f.my_vote === 'a' ? f.team_a_name : f.team_b_name)).length
  const myResolved = faceoffs.filter(f => f.status === 'resolved' && f.my_vote).length

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 16px 60px' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <Link to="/championships" style={{ fontSize: 12, color: 'var(--color-xama-muted)', textDecoration: 'none' }}>
          ← Campeonatos
        </Link>
        <h1 style={{ margin: '10px 0 4px', fontSize: 22, fontWeight: 800, color: 'var(--color-xama-text)' }}>
          Team Faceoff
        </h1>
        {champ && (
          <p style={{ margin: 0, fontSize: 14, color: 'var(--color-xama-muted)' }}>
            {champ.name}
          </p>
        )}
      </div>

      {/* Banner explicativo */}
      <div style={{
        marginBottom: 24, padding: '14px 18px',
        background: 'rgba(99,102,241,0.06)',
        border: '1px solid rgba(99,102,241,0.2)',
        borderRadius: 12, fontSize: 13, color: 'var(--color-xama-muted)', lineHeight: 1.7,
      }}>
        <strong style={{ color: 'var(--color-xama-text)' }}>Como funciona:</strong>{' '}
        Escolha qual time você acha que vai terminar as Finals melhor posicionado em cada confronto.
        Os votos ficam ocultos até o encerramento das votações — depois revelamos o que a galera achou.
        O vencedor é determinado pelo ranking acumulado das 3 rodadas das Finals.
      </div>

      {/* Taxa de acerto (se há resolvidos) */}
      {token && myResolved > 0 && (
        <div style={{
          marginBottom: 20, padding: '12px 16px',
          background: 'rgba(74,222,128,0.05)',
          border: '1px solid rgba(74,222,128,0.2)',
          borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 22 }}>🎯</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-xama-text)' }}>
              Sua taxa de acerto: {myCorrect}/{myResolved}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-xama-muted)' }}>
              {myResolved === myCorrect && myResolved > 0
                ? 'Acertou tudo! 🔥'
                : myCorrect === 0
                ? 'Nenhum acerto por enquanto.'
                : `${Math.round(myCorrect / myResolved * 100)}% de aproveitamento`}
            </div>
          </div>
        </div>
      )}

      {/* CTA login */}
      {!token && faceoffs.some(f => f.status === 'open') && (
        <div style={{
          marginBottom: 20, padding: '12px 16px',
          background: 'rgba(249,115,22,0.06)',
          border: '1px solid rgba(249,115,22,0.2)',
          borderRadius: 10, fontSize: 13, color: 'var(--color-xama-muted)',
        }}>
          <Link to="/login" style={{ color: 'var(--color-xama-orange)', fontWeight: 700 }}>Faça login</Link>
          {' '}para participar das votações.
        </div>
      )}

      {/* CTA todos votados */}
      {token && allVoted && faceoffs.some(f => f.status === 'open') && (
        <div style={{
          marginBottom: 20, padding: '12px 16px',
          background: 'rgba(74,222,128,0.05)',
          border: '1px solid rgba(74,222,128,0.2)',
          borderRadius: 10, fontSize: 13, color: 'var(--color-xama-green)',
        }}>
          ✓ Você votou em todos os confrontos! Resultados revelados ao encerrar as votações.
        </div>
      )}

      {loading && (
        <p style={{ color: 'var(--color-xama-muted)', textAlign: 'center', padding: 40 }}>
          Carregando...
        </p>
      )}
      {error && (
        <p style={{ color: '#f87171', textAlign: 'center', padding: 40 }}>{error}</p>
      )}

      {!loading && !error && faceoffs.length === 0 && (
        <p style={{ color: 'var(--color-xama-muted)', textAlign: 'center', padding: 40 }}>
          Nenhum faceoff disponível para este campeonato ainda.
        </p>
      )}

      {/* Grid de cards */}
      {!loading && faceoffs.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 14,
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
    </div>
  )
}
