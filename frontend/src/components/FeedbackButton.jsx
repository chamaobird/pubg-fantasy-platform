// frontend/src/components/FeedbackButton.jsx
// Botão fixo (bottom-right) que abre modal de feedback.
// Montado dentro de RequireAuth para que o token esteja sempre disponível.

import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../App'
import { submitFeedback } from '../api/feedback'

const STYLE = {
  btn: {
    position: 'fixed',
    bottom: 24,
    right: 24,
    zIndex: 9000,
    background: 'rgba(249,115,22,0.15)',
    border: '1px solid rgba(249,115,22,0.4)',
    borderRadius: 20,
    color: '#f97316',
    fontFamily: "'Rajdhani', sans-serif",
    fontWeight: 700,
    fontSize: 13,
    letterSpacing: '0.06em',
    padding: '8px 16px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    backdropFilter: 'blur(8px)',
    transition: 'background 0.15s, border-color 0.15s',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 9001,
    background: 'rgba(0,0,0,0.55)',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    padding: '0 24px 80px 0',
  },
  modal: {
    background: 'rgba(18,21,28,0.97)',
    border: '1px solid var(--color-xama-border, #2d3148)',
    borderRadius: 14,
    padding: '22px 20px',
    width: 340,
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  title: {
    fontFamily: "'Rajdhani', sans-serif",
    fontWeight: 700,
    fontSize: 15,
    letterSpacing: '0.08em',
    color: '#f97316',
    textTransform: 'uppercase',
    margin: 0,
  },
  textarea: {
    width: '100%',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    color: '#e2e8f0',
    fontSize: 14,
    padding: '10px 12px',
    resize: 'vertical',
    minHeight: 90,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  },
  starsRow: {
    display: 'flex',
    gap: 4,
    alignItems: 'center',
  },
  starLabel: {
    fontSize: 11,
    color: '#64748b',
    fontFamily: "'Rajdhani', sans-serif",
    letterSpacing: '0.05em',
    marginRight: 6,
  },
  star: (active) => ({
    fontSize: 22,
    cursor: 'pointer',
    color: active ? '#f59e0b' : '#334155',
    transition: 'color 0.1s',
    background: 'none',
    border: 'none',
    padding: 0,
    lineHeight: 1,
  }),
  submitBtn: (disabled) => ({
    background: disabled ? 'rgba(249,115,22,0.25)' : '#f97316',
    border: 'none',
    borderRadius: 8,
    color: disabled ? 'rgba(255,255,255,0.4)' : '#fff',
    fontFamily: "'Rajdhani', sans-serif",
    fontWeight: 700,
    fontSize: 14,
    letterSpacing: '0.08em',
    padding: '10px 0',
    cursor: disabled ? 'default' : 'pointer',
    width: '100%',
    transition: 'background 0.15s',
  }),
  successMsg: {
    fontSize: 13,
    color: '#4ade80',
    textAlign: 'center',
    fontFamily: "'Rajdhani', sans-serif",
    letterSpacing: '0.05em',
  },
  errMsg: {
    fontSize: 12,
    color: '#f87171',
    fontFamily: "'Rajdhani', sans-serif",
  },
  closeRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#64748b',
    cursor: 'pointer',
    fontSize: 18,
    lineHeight: 1,
    padding: 0,
  },
}

export default function FeedbackButton() {
  const { token } = useAuth()
  const location = useLocation()

  const [open, setOpen]       = useState(false)
  const [message, setMessage] = useState('')
  const [rating, setRating]   = useState(0)
  const [hover, setHover]     = useState(0)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError]     = useState('')

  function openModal() {
    setOpen(true)
    setMessage(''); setRating(0); setHover(0)
    setSuccess(false); setError('')
  }

  function closeModal() { setOpen(false) }

  async function handleSubmit() {
    if (!message.trim()) return
    setLoading(true); setError('')
    try {
      await submitFeedback(
        { message: message.trim(), rating: rating || null, page: location.pathname },
        token,
      )
      setSuccess(true)
      setTimeout(() => setOpen(false), 1800)
    } catch (e) {
      setError(e.message || 'Erro ao enviar feedback.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button style={STYLE.btn} onClick={openModal} title="Enviar feedback">
        <span style={{ fontSize: 14 }}>💬</span>
        Feedback
      </button>

      {open && (
        <div style={STYLE.overlay} onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}>
          <div style={STYLE.modal}>
            <div style={STYLE.closeRow}>
              <p style={STYLE.title}>Feedback</p>
              <button style={STYLE.closeBtn} onClick={closeModal}>✕</button>
            </div>

            {success ? (
              <p style={STYLE.successMsg}>Obrigado pelo seu feedback!</p>
            ) : (
              <>
                <textarea
                  style={STYLE.textarea}
                  placeholder="O que você achou? Encontrou algum bug?"
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  maxLength={2000}
                  autoFocus
                />

                <div style={STYLE.starsRow}>
                  <span style={STYLE.starLabel}>Avaliação</span>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      style={STYLE.star((hover || rating) >= n)}
                      onMouseEnter={() => setHover(n)}
                      onMouseLeave={() => setHover(0)}
                      onClick={() => setRating(r => r === n ? 0 : n)}
                      type="button"
                    >
                      ★
                    </button>
                  ))}
                </div>

                {error && <p style={STYLE.errMsg}>{error}</p>}

                <button
                  style={STYLE.submitBtn(loading || !message.trim())}
                  onClick={handleSubmit}
                  disabled={loading || !message.trim()}
                  type="button"
                >
                  {loading ? 'Enviando…' : 'Enviar'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
