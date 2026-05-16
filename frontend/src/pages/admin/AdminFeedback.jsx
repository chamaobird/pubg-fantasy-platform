// frontend/src/pages/admin/AdminFeedback.jsx
// Lista feedbacks recebidos (admin only).

import { useEffect, useState } from 'react'
import { listFeedback } from '../../api/feedback'

const CARD = {
  background: 'rgba(18,21,28,0.9)',
  border: '1px solid var(--xm-border, #2d3148)',
  borderRadius: 10,
  padding: '14px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
}

const LABEL = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.15em',
  color: '#64748b',
  textTransform: 'uppercase',
  fontFamily: 'JetBrains Mono, monospace',
}

const VALUE = {
  fontSize: 14,
  color: '#e2e8f0',
  wordBreak: 'break-word',
}

function Stars({ rating }) {
  if (!rating) return <span style={{ color: '#334155', fontSize: 13 }}>—</span>
  return (
    <span style={{ color: '#f59e0b', fontSize: 14, letterSpacing: 1 }}>
      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
    </span>
  )
}

function FeedbackCard({ fb }) {
  const date = new Date(fb.created_at).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <div style={CARD}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={LABEL}>Usuário</span>
          <span style={{ ...VALUE, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
            {fb.user_id || <em style={{ color: '#475569' }}>anônimo</em>}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end' }}>
          <span style={LABEL}>Data</span>
          <span style={{ ...VALUE, fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8' }}>{date}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <span style={LABEL}>Avaliação</span>
          <div><Stars rating={fb.rating} /></div>
        </div>
        {fb.page && (
          <div>
            <span style={LABEL}>Página</span>
            <div style={{ ...VALUE, fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: '#7dd3fc' }}>{fb.page}</div>
          </div>
        )}
      </div>

      <div>
        <span style={LABEL}>Mensagem</span>
        <p style={{ ...VALUE, margin: '4px 0 0', lineHeight: 1.5 }}>{fb.message}</p>
      </div>
    </div>
  )
}

export default function AdminFeedback({ token }) {
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [skip,    setSkip]    = useState(0)
  const LIMIT = 50

  useEffect(() => {
    setLoading(true); setError('')
    listFeedback(token, { skip, limit: LIMIT })
      .then(setItems)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [token, skip])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <h2 style={{
          margin: 0, fontFamily: "'Rajdhani', sans-serif", fontWeight: 700,
          fontSize: 18, letterSpacing: '0.06em', color: '#f97316',
        }}>
          Feedbacks
        </h2>
        {!loading && (
          <span style={{ fontSize: 12, color: '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>
            {items.length} resultado{items.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {loading && <p style={{ color: '#64748b', fontSize: 14 }}>Carregando…</p>}
      {error   && <p style={{ color: '#f87171', fontSize: 13 }}>{error}</p>}

      {!loading && !error && items.length === 0 && (
        <p style={{ color: '#475569', fontSize: 14 }}>Nenhum feedback recebido ainda.</p>
      )}

      {items.map(fb => <FeedbackCard key={fb.id} fb={fb} />)}

      {!loading && items.length === LIMIT && (
        <button
          onClick={() => setSkip(s => s + LIMIT)}
          style={{
            background: 'none', border: '1px solid var(--xm-border, #2d3148)',
            borderRadius: 8, color: '#94a3b8', cursor: 'pointer', padding: '8px 18px',
            fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: 13,
            letterSpacing: '0.06em', alignSelf: 'center',
          }}
        >
          Carregar mais
        </button>
      )}
    </div>
  )
}
