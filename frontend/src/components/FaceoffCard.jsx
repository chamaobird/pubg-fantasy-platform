// components/FaceoffCard.jsx
import { useState } from 'react'
import TeamLogo from './TeamLogo'
import { formatTeamTag } from '../utils/teamUtils'
import { API_BASE_URL } from '../config'

function VoteBar({ pctA, pctB }) {
  if (pctA == null) return null
  return (
    <div style={{ padding: '0 20px 16px' }}>
      <div style={{ display: 'flex', borderRadius: 4, overflow: 'hidden', height: 6, background: 'rgba(255,255,255,0.06)' }}>
        {pctA > 0 && <div style={{ width: `${pctA}%`, background: 'linear-gradient(90deg,#f97316,#fb923c)', transition: 'width 0.7s ease' }} />}
        {pctB > 0 && <div style={{ width: `${pctB}%`, background: 'linear-gradient(90deg,#818cf8,#6366f1)', transition: 'width 0.7s ease' }} />}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: 12, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
        <span style={{ color: '#f97316' }}>{pctA}%</span>
        <span style={{ color: '#818cf8' }}>{pctB}%</span>
      </div>
    </div>
  )
}

export default function FaceoffCard({ faceoff, token, onVoted }) {
  const [voting, setVoting] = useState(false)
  const [error, setError] = useState('')

  const { id, team_a_name, team_b_name, seed_a, seed_b,
          status, winner_team_name, pct_a, pct_b, total_votes, my_vote } = faceoff

  const canVote    = status === 'open' && !!token
  const isResolved = status === 'resolved'
  const showPct    = status === 'closed' || status === 'resolved'

  async function vote(side) {
    if (!canVote || voting) return
    setVoting(true); setError('')
    try {
      const res = await fetch(`${API_BASE_URL}/faceoffs/${id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ voted_for: side }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.detail || `HTTP ${res.status}`)
      }
      onVoted?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setVoting(false)
    }
  }

  const tagA = formatTeamTag('', team_a_name) || team_a_name
  const tagB = formatTeamTag('', team_b_name) || team_b_name

  const isWinnerA = isResolved && winner_team_name === team_a_name
  const isWinnerB = isResolved && winner_team_name === team_b_name
  const isLoserA  = isResolved && winner_team_name && !isWinnerA
  const isLoserB  = isResolved && winner_team_name && !isWinnerB

  const votedA = my_vote === 'a'
  const votedB = my_vote === 'b'

  const statusConfig = {
    open:     { label: 'VOTANDO', color: '#4ade80', bg: 'rgba(74,222,128,0.12)', border: 'rgba(74,222,128,0.35)' },
    closed:   { label: 'ENCERRADO', color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.2)' },
    resolved: { label: 'RESOLVIDO', color: '#a5b4fc', bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.35)' },
    draft:    { label: 'DRAFT', color: '#64748b', bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.2)' },
  }[status] || { label: status.toUpperCase(), color: '#94a3b8', bg: 'transparent', border: 'transparent' }

  const sideStyle = (isWinner, isLoser, isVoted, accentColor) => ({
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    padding: '20px 14px 16px',
    borderRadius: 12,
    background: isWinner
      ? 'rgba(74,222,128,0.07)'
      : isVoted
      ? `${accentColor}12`
      : 'rgba(255,255,255,0.02)',
    border: `1.5px solid ${isWinner ? 'rgba(74,222,128,0.4)' : isVoted ? `${accentColor}55` : 'rgba(255,255,255,0.06)'}`,
    opacity: isLoser ? 0.4 : 1,
    cursor: canVote ? 'pointer' : 'default',
    transition: 'all 0.18s',
    position: 'relative',
  })

  return (
    <div style={{
      background: 'rgba(14,17,24,0.97)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 16,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header: seeds + status */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 18px 10px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <span style={{
          fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
          color: 'var(--color-xama-muted)', letterSpacing: '0.08em',
        }}>
          #{seed_a} vs #{seed_b}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20,
          letterSpacing: '0.12em', background: statusConfig.bg,
          color: statusConfig.color, border: `1px solid ${statusConfig.border}`,
        }}>
          {statusConfig.label}
        </span>
      </div>

      {/* Confronto */}
      <div style={{ display: 'flex', gap: 10, padding: '20px 16px 16px', alignItems: 'stretch' }}>
        {/* Time A */}
        <div
          style={sideStyle(isWinnerA, isLoserA, votedA, '#f97316')}
          onClick={() => vote('a')}
          onMouseEnter={e => { if (canVote && !votedA) e.currentTarget.style.borderColor = 'rgba(249,115,22,0.35)' }}
          onMouseLeave={e => { if (canVote && !votedA) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}
        >
          {isWinnerA && (
            <div style={{
              position: 'absolute', top: -1, left: -1, right: -1,
              height: 3, borderRadius: '12px 12px 0 0',
              background: 'linear-gradient(90deg, #4ade80, #22c55e)',
            }} />
          )}
          {votedA && (
            <div style={{
              position: 'absolute', top: -1, left: -1, right: -1,
              height: 3, borderRadius: '12px 12px 0 0',
              background: 'linear-gradient(90deg, #f97316, #fb923c)',
            }} />
          )}
          {votedA && (
            <span style={{ position: 'absolute', top: 8, left: 10, fontSize: 9, color: '#f97316', fontWeight: 800, letterSpacing: '0.1em' }}>
              ✓ SEU VOTO
            </span>
          )}
          {isWinnerA && (
            <span style={{ position: 'absolute', top: 8, right: 10, fontSize: 18 }}>🏆</span>
          )}
          <TeamLogo teamName={tagA} size={96} />
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: 22, fontWeight: 900, color: 'var(--color-xama-text)',
              lineHeight: 1.2, letterSpacing: '0.01em',
            }}>
              {tagA}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-xama-muted)', marginTop: 4, lineHeight: 1.3 }}>
              {team_a_name}
            </div>
          </div>
          {canVote && !my_vote && (
            <div style={{
              fontSize: 12, fontWeight: 700, color: '#f97316',
              padding: '6px 16px', borderRadius: 20,
              background: 'rgba(249,115,22,0.1)',
              border: '1px solid rgba(249,115,22,0.25)',
              cursor: 'pointer',
            }}>
              {voting ? '...' : 'Votar'}
            </div>
          )}
        </div>

        {/* VS divider */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minWidth: 32, gap: 4,
        }}>
          <div style={{ width: 1, flex: 1, background: 'rgba(255,255,255,0.05)' }} />
          <span style={{
            fontSize: 13, fontWeight: 900, color: 'rgba(255,255,255,0.2)',
            fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.05em',
          }}>VS</span>
          <div style={{ width: 1, flex: 1, background: 'rgba(255,255,255,0.05)' }} />
        </div>

        {/* Time B */}
        <div
          style={sideStyle(isWinnerB, isLoserB, votedB, '#6366f1')}
          onClick={() => vote('b')}
          onMouseEnter={e => { if (canVote && !votedB) e.currentTarget.style.borderColor = 'rgba(99,102,241,0.35)' }}
          onMouseLeave={e => { if (canVote && !votedB) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}
        >
          {isWinnerB && (
            <div style={{
              position: 'absolute', top: -1, left: -1, right: -1,
              height: 3, borderRadius: '12px 12px 0 0',
              background: 'linear-gradient(90deg, #4ade80, #22c55e)',
            }} />
          )}
          {votedB && (
            <div style={{
              position: 'absolute', top: -1, left: -1, right: -1,
              height: 3, borderRadius: '12px 12px 0 0',
              background: 'linear-gradient(90deg, #6366f1, #818cf8)',
            }} />
          )}
          {votedB && (
            <span style={{ position: 'absolute', top: 8, right: 10, fontSize: 9, color: '#818cf8', fontWeight: 800, letterSpacing: '0.1em' }}>
              SEU VOTO ✓
            </span>
          )}
          {isWinnerB && (
            <span style={{ position: 'absolute', top: 8, left: 10, fontSize: 18 }}>🏆</span>
          )}
          <TeamLogo teamName={tagB} size={96} />
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: 22, fontWeight: 900, color: 'var(--color-xama-text)',
              lineHeight: 1.2, letterSpacing: '0.01em',
            }}>
              {tagB}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-xama-muted)', marginTop: 4, lineHeight: 1.3 }}>
              {team_b_name}
            </div>
          </div>
          {canVote && !my_vote && (
            <div style={{
              fontSize: 12, fontWeight: 700, color: '#818cf8',
              padding: '6px 16px', borderRadius: 20,
              background: 'rgba(99,102,241,0.1)',
              border: '1px solid rgba(99,102,241,0.25)',
              cursor: 'pointer',
            }}>
              {voting ? '...' : 'Votar'}
            </div>
          )}
        </div>
      </div>

      {/* Barra de votos */}
      {showPct && <VoteBar pctA={pct_a} pctB={pct_b} />}

      {/* Footer */}
      {!showPct && (
        <div style={{ padding: '0 18px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--color-xama-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
            {total_votes} {total_votes === 1 ? 'voto' : 'votos'}
          </span>
          {status === 'open' && (
            <span style={{ fontSize: 10, color: 'var(--color-xama-muted)', fontStyle: 'italic' }}>
              % revelada ao fechar
            </span>
          )}
        </div>
      )}

      {error && (
        <p style={{ fontSize: 11, color: '#f87171', margin: '0 18px 12px', padding: '6px 10px', background: 'rgba(239,68,68,0.08)', borderRadius: 6 }}>
          {error}
        </p>
      )}
    </div>
  )
}
