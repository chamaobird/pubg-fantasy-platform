// components/FaceoffCard.jsx
// Layout: sem header strip, times centrados verticalmente, nomes sem corte,
// ACERTOU/ERROU na coluna VS, SEU VOTO em linha dedicada abaixo do nome.

import { useState } from 'react'
import TeamLogo from './TeamLogo'
import { formatTeamTag } from '../utils/teamUtils'
import { API_BASE_URL } from '../config'
import { DashIcon } from './DashIcon'

// ── VoteBar ───────────────────────────────────────────────────────────────────
function VoteBar({ pctA, pctB, tagA, tagB, winnerSide }) {
  if (pctA == null) return null
  const colorA = winnerSide === 'a' ? '#f97316' : winnerSide === 'b' ? 'rgba(255,255,255,0.18)' : '#f97316'
  const colorB = winnerSide === 'b' ? '#f97316' : winnerSide === 'a' ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.32)'

  return (
    <div style={{ padding: '4px 18px 16px' }}>
      <div style={{
        display: 'flex', borderRadius: 5, overflow: 'hidden',
        height: 10, background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
        {pctA > 0 && <div style={{ width: `${pctA}%`, background: colorA, transition: 'width 0.7s ease' }} />}
        {pctB > 0 && <div style={{ width: `${pctB}%`, background: colorB, transition: 'width 0.7s ease' }} />}
      </div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', marginTop: 8,
        fontSize: 13, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
        letterSpacing: '0.04em',
      }}>
        <span style={{ color: colorA, display: 'flex', gap: 8, alignItems: 'baseline' }}>
          <span style={{ fontSize: 11, color: 'var(--xm-muted)' }}>{tagA}</span>
          <span>{pctA}%</span>
        </span>
        <span style={{ color: colorB, display: 'flex', gap: 8, alignItems: 'baseline' }}>
          <span>{pctB}%</span>
          <span style={{ fontSize: 11, color: 'var(--xm-muted)' }}>{tagB}</span>
        </span>
      </div>
    </div>
  )
}

// ── TeamSide — centrado verticalmente, nome sem truncagem ─────────────────────
function TeamSide({ tag, name, isWinner, isLoser, isVoted, onClick, canVote, voting }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!canVote || voting}
      style={{
        flex: 1, minWidth: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        textAlign: 'center',
        padding: '20px 12px 16px',
        background: isWinner
          ? 'rgba(74,222,128,0.06)'
          : isVoted ? 'rgba(249,115,22,0.08)'
          : 'rgba(255,255,255,0.02)',
        border: `1px solid ${
          isWinner ? 'rgba(74,222,128,0.4)' :
          isVoted  ? 'rgba(249,115,22,0.4)' :
                     'rgba(255,255,255,0.06)'
        }`,
        borderRadius: 10,
        opacity: isLoser ? 0.4 : 1,
        cursor: canVote ? 'pointer' : 'default',
        transition: 'border-color 0.15s, background 0.15s, transform 0.15s',
        font: 'inherit', color: 'inherit',
        gap: 0,
      }}
      onMouseEnter={e => {
        if (canVote && !isVoted && !isWinner) {
          e.currentTarget.style.borderColor = 'rgba(249,115,22,0.35)'
          e.currentTarget.style.transform = 'translateY(-1px)'
        }
      }}
      onMouseLeave={e => {
        if (canVote && !isVoted && !isWinner) {
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
          e.currentTarget.style.transform = 'none'
        }
      }}
    >
      {/* Logo */}
      <TeamLogo teamName={tag} size={72} />

      {/* Tag + trophy */}
      <div style={{
        marginTop: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      }}>
        <span style={{
          fontSize: 22, fontWeight: 800, color: 'var(--xm-text-bright, #f1f5f9)',
          fontFamily: 'var(--xm-font-display, Rajdhani), Rajdhani, sans-serif',
          letterSpacing: '0.02em', lineHeight: 1,
        }}>
          {tag}
        </span>
        {isWinner && (
          <span style={{ color: '#4ade80', display: 'inline-flex' }}>
            <DashIcon name="trophy" size={14} />
          </span>
        )}
      </div>

      {/* Nome completo — wrap permitido, sem ellipsis */}
      <div style={{
        marginTop: 5,
        fontSize: 11, color: 'var(--xm-muted, #6b7280)',
        lineHeight: 1.4,
        fontFamily: "'JetBrains Mono', monospace",
        wordBreak: 'break-word',
        maxWidth: '100%',
      }}>
        {name}
      </div>

      {/* SEU VOTO — espaço reservado para simetria entre os dois lados */}
      <div style={{ height: 22, marginTop: 8, display: 'flex', alignItems: 'center' }}>
        {isVoted && (
          <span style={{
            fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
            padding: '2px 7px', borderRadius: 3,
            background: 'rgba(249,115,22,0.18)', color: '#f97316',
            fontFamily: "'JetBrains Mono', monospace",
            border: '1px solid rgba(249,115,22,0.35)',
          }}>
            ✓ SEU VOTO
          </span>
        )}
      </div>
    </button>
  )
}

// ── FaceoffCard ───────────────────────────────────────────────────────────────
export default function FaceoffCard({ faceoff, token, onVoted }) {
  const [voting, setVoting] = useState(false)
  const [error, setError]   = useState('')

  const { id, team_a_name, team_b_name,
          status, winner_team_name, pct_a, pct_b, total_votes, my_vote } = faceoff

  const canVote    = status === 'open' && !!token
  const isResolved = status === 'resolved'
  const showPct    = status === 'closed' || status === 'resolved'

  const tagA = formatTeamTag('', team_a_name) || team_a_name
  const tagB = formatTeamTag('', team_b_name) || team_b_name

  const isWinnerA = isResolved && winner_team_name === team_a_name
  const isWinnerB = isResolved && winner_team_name === team_b_name
  const isLoserA  = isResolved && winner_team_name && !isWinnerA
  const isLoserB  = isResolved && winner_team_name && !isWinnerB
  const winnerSide = isWinnerA ? 'a' : isWinnerB ? 'b' : null

  const votedA = my_vote === 'a'
  const votedB = my_vote === 'b'

  // ACERTOU/ERROU — apenas resolved com voto registrado
  let personalResult = null
  if (isResolved && my_vote && winner_team_name) {
    const myWin = (votedA && isWinnerA) || (votedB && isWinnerB)
    personalResult = myWin
      ? { label: 'ACERTOU', symbol: '✓', color: '#4ade80', bg: 'rgba(74,222,128,0.12)', border: 'rgba(74,222,128,0.35)' }
      : { label: 'ERROU',   symbol: '✗', color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.35)' }
  }

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
    } catch (e) { setError(e.message) }
    finally { setVoting(false) }
  }

  return (
    <div style={{
      background: 'rgba(14,17,24,0.92)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 12, overflow: 'hidden',
      boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
    }}>
      {/* Confronto: TIME A | coluna central | TIME B — sem header strip */}
      <div style={{
        display: 'flex', alignItems: 'stretch', gap: 10,
        padding: '16px 16px 12px',
      }}>
        <TeamSide
          tag={tagA} name={team_a_name}
          isWinner={isWinnerA} isLoser={isLoserA} isVoted={votedA}
          canVote={canVote && !votedA} voting={voting}
          onClick={() => vote('a')}
        />

        {/* Coluna central: VS + ACERTOU/ERROU */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          minWidth: 36, flexShrink: 0, gap: 10,
        }}>
          <span style={{
            fontSize: 11, fontWeight: 900, color: 'rgba(255,255,255,0.25)',
            fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.1em',
            padding: '4px 7px',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 4,
            background: 'rgba(255,255,255,0.02)',
          }}>
            VS
          </span>
          {personalResult && (
            <span style={{
              fontSize: 9, fontWeight: 800, letterSpacing: '0.08em',
              padding: '3px 6px', borderRadius: 4,
              background: personalResult.bg,
              color: personalResult.color,
              border: `1px solid ${personalResult.border}`,
              fontFamily: "'JetBrains Mono', monospace",
              textAlign: 'center', lineHeight: 1.3,
              writingMode: 'horizontal-tb',
            }}>
              {personalResult.symbol}<br />{personalResult.label}
            </span>
          )}
        </div>

        <TeamSide
          tag={tagB} name={team_b_name}
          isWinner={isWinnerB} isLoser={isLoserB} isVoted={votedB}
          canVote={canVote && !votedB} voting={voting}
          onClick={() => vote('b')}
        />
      </div>

      {/* Barra de votos — apenas após fechar/resolver */}
      {showPct && <VoteBar pctA={pct_a} pctB={pct_b} tagA={tagA} tagB={tagB} winnerSide={winnerSide} />}

      {/* Footer discreto — contagem e aviso de % */}
      {!showPct && (
        <div style={{
          padding: '4px 16px 12px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 11, color: 'var(--xm-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
            {total_votes} {total_votes === 1 ? 'voto' : 'votos'}
          </span>
          {status === 'open' && (
            <span style={{ fontSize: 10, color: 'var(--xm-muted-soft, #4b5563)', fontStyle: 'italic' }}>
              % revelada ao fechar
            </span>
          )}
        </div>
      )}

      {error && (
        <p style={{
          fontSize: 11, color: '#f87171', margin: '0 16px 12px',
          padding: '6px 10px', background: 'rgba(239,68,68,0.08)', borderRadius: 6,
        }}>
          {error}
        </p>
      )}
    </div>
  )
}
