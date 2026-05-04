// components/FaceoffCard.jsx
import { useState } from 'react'
import TeamLogo from './TeamLogo'
import { formatTeamTag } from '../utils/teamUtils'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

function VoteBar({ pctA, pctB, winner }) {
  if (pctA == null) return null
  const aWon = winner && winner !== null && pctA !== null
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', height: 8, background: 'rgba(255,255,255,0.06)' }}>
        {pctA > 0 && (
          <div style={{
            width: `${pctA}%`, background: '#f97316',
            transition: 'width 0.6s ease',
          }} />
        )}
        {pctB > 0 && (
          <div style={{
            width: `${pctB}%`, background: '#6366f1',
            transition: 'width 0.6s ease',
          }} />
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-xama-muted)' }}>
        <span style={{ color: '#f97316', fontWeight: 700 }}>{pctA}%</span>
        <span style={{ color: '#6366f1', fontWeight: 700 }}>{pctB}%</span>
      </div>
    </div>
  )
}

export default function FaceoffCard({ faceoff, token, onVoted }) {
  const [voting, setVoting] = useState(false)
  const [error, setError] = useState('')

  const { id, team_a_name, team_b_name, seed_a, seed_b,
          status, winner_team_name, pct_a, pct_b, total_votes, my_vote } = faceoff

  const canVote = status === 'open' && !!token
  const isResolved = status === 'resolved'
  const showPct = status === 'closed' || status === 'resolved'

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

  const teamStyle = (side) => {
    const isWinner = isResolved && winner_team_name === (side === 'a' ? team_a_name : team_b_name)
    const isLoser  = isResolved && winner_team_name && winner_team_name !== (side === 'a' ? team_a_name : team_b_name)
    const voted    = my_vote === side
    const accent   = side === 'a' ? '#f97316' : '#6366f1'
    return {
      flex: 1,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      padding: '16px 12px',
      borderRadius: 10,
      border: `1px solid ${voted ? accent : isWinner ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.06)'}`,
      background: voted
        ? `${accent}14`
        : isWinner ? 'rgba(74,222,128,0.05)'
        : 'rgba(255,255,255,0.02)',
      opacity: isLoser ? 0.45 : 1,
      cursor: canVote ? 'pointer' : 'default',
      transition: 'all 0.15s',
      position: 'relative',
    }
  }

  return (
    <div style={{
      background: 'rgba(18,21,28,0.95)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 14,
      padding: '18px 16px 14px',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      {/* Seeds + status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-xama-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          #{seed_a} vs #{seed_b}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
          textTransform: 'uppercase', letterSpacing: '0.08em',
          background: status === 'open' ? 'rgba(74,222,128,0.12)' : status === 'resolved' ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.06)',
          color: status === 'open' ? 'var(--color-xama-green)' : status === 'resolved' ? '#a5b4fc' : 'var(--color-xama-muted)',
          border: `1px solid ${status === 'open' ? 'rgba(74,222,128,0.3)' : status === 'resolved' ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.1)'}`,
        }}>
          {status === 'open' ? 'Votando' : status === 'closed' ? 'Encerrado' : status === 'resolved' ? 'Resolvido' : status}
        </span>
      </div>

      {/* Times */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
        {/* Time A */}
        <div style={teamStyle('a')} onClick={() => vote('a')}>
          {isResolved && winner_team_name === team_a_name && (
            <span style={{ position: 'absolute', top: 6, right: 8, fontSize: 14 }}>🏆</span>
          )}
          {my_vote === 'a' && status === 'open' && (
            <span style={{ position: 'absolute', top: 6, left: 8, fontSize: 10, color: '#f97316', fontWeight: 700 }}>✓ seu voto</span>
          )}
          <TeamLogo teamName={tagA} size={36} />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-xama-text)', textAlign: 'center', lineHeight: 1.3 }}>
            {tagA}
          </span>
          <span style={{ fontSize: 11, color: 'var(--color-xama-muted)', textAlign: 'center', lineHeight: 1.3 }}>
            {team_a_name}
          </span>
          {canVote && my_vote !== 'a' && (
            <span style={{ fontSize: 11, color: '#f97316', marginTop: 2 }}>
              {voting ? '...' : 'Votar →'}
            </span>
          )}
        </div>

        {/* VS */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 28 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-xama-muted)', fontFamily: "'JetBrains Mono', monospace" }}>VS</span>
        </div>

        {/* Time B */}
        <div style={teamStyle('b')} onClick={() => vote('b')}>
          {isResolved && winner_team_name === team_b_name && (
            <span style={{ position: 'absolute', top: 6, right: 8, fontSize: 14 }}>🏆</span>
          )}
          {my_vote === 'b' && status === 'open' && (
            <span style={{ position: 'absolute', top: 6, left: 8, fontSize: 10, color: '#6366f1', fontWeight: 700 }}>✓ seu voto</span>
          )}
          <TeamLogo teamName={tagB} size={36} />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-xama-text)', textAlign: 'center', lineHeight: 1.3 }}>
            {tagB}
          </span>
          <span style={{ fontSize: 11, color: 'var(--color-xama-muted)', textAlign: 'center', lineHeight: 1.3 }}>
            {team_b_name}
          </span>
          {canVote && my_vote !== 'b' && (
            <span style={{ fontSize: 11, color: '#6366f1', marginTop: 2 }}>
              {voting ? '...' : '← Votar'}
            </span>
          )}
        </div>
      </div>

      {/* Barra de votos (revelada ao fechar) */}
      {showPct && <VoteBar pctA={pct_a} pctB={pct_b} winner={winner_team_name} />}

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--color-xama-muted)' }}>
          {total_votes} {total_votes === 1 ? 'voto' : 'votos'}
          {!showPct && status === 'open' && ' · resultado revelado ao fechar'}
        </span>
        {!token && status === 'open' && (
          <span style={{ fontSize: 11, color: 'var(--color-xama-muted)' }}>Login para votar</span>
        )}
      </div>

      {error && (
        <p style={{ fontSize: 11, color: '#f87171', margin: '4px 0 0' }}>{error}</p>
      )}
    </div>
  )
}
