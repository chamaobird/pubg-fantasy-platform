// components/FaceoffCard.jsx
// XAMA Fantasy — Faceoff card redesenhado: layout HORIZONTAL compacto
// Antes: cards verticais empilhados, logos 96px, visual pesado
// Agora: row horizontal com logos 48px, vs central, barra de votos proeminente

import { useState } from 'react'
import TeamLogo from './TeamLogo'
import { formatTeamTag } from '../utils/teamUtils'
import { API_BASE_URL } from '../config'
import { DashIcon } from './DashIcon'

// Status pill — usado tanto no header quanto no badge "ACERTOU/ERROU"
const STATUS_PILL = {
  open:     { label: 'VOTANDO',   color: '#4ade80', bg: 'rgba(74,222,128,0.12)', border: 'rgba(74,222,128,0.35)' },
  closed:   { label: 'ENCERRADO', color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.2)' },
  resolved: { label: 'RESOLVIDO', color: '#a5b4fc', bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.35)' },
  draft:    { label: 'DRAFT',     color: '#64748b', bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.2)' },
}

// ── VoteBar (mais proeminente — 10px de altura, labels maiores) ───────────────
function VoteBar({ pctA, pctB, tagA, tagB, winnerSide }) {
  if (pctA == null) return null
  // Cinza neutro do lado perdedor, laranja do vencedor — sem mais azul/indigo
  const colorA = winnerSide === 'a' ? '#f97316' : winnerSide === 'b' ? 'rgba(255,255,255,0.18)' : '#f97316'
  const colorB = winnerSide === 'b' ? '#f97316' : winnerSide === 'a' ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.32)'

  return (
    <div style={{ padding: '4px 18px 16px' }}>
      <div style={{
        display: 'flex', borderRadius: 5, overflow: 'hidden',
        height: 10, background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
        {pctA > 0 && <div style={{ width: `${pctA}%`, background: colorA, transition: 'width 0.7s var(--xm-ease, ease)' }} />}
        {pctB > 0 && <div style={{ width: `${pctB}%`, background: colorB, transition: 'width 0.7s var(--xm-ease, ease)' }} />}
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

// ── TeamSide (compacto, horizontal — logo 48px) ───────────────────────────────
function TeamSide({ tag, name, isWinner, isLoser, isVoted, align, onClick, canVote, voting }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!canVote || voting}
      style={{
        flex: 1, minWidth: 0,
        display: 'flex', alignItems: 'center', gap: 12,
        flexDirection: align === 'right' ? 'row-reverse' : 'row',
        textAlign: align === 'right' ? 'right' : 'left',
        padding: '12px 14px',
        background: isWinner
          ? 'rgba(74,222,128,0.06)'                      // vencedor — verde sutil
          : isVoted ? 'rgba(249,115,22,0.08)'            // seu voto — laranja
          : 'rgba(255,255,255,0.02)',
        border: `1px solid ${
          isWinner ? 'rgba(74,222,128,0.4)' :
          isVoted  ? 'rgba(249,115,22,0.4)' :
                     'rgba(255,255,255,0.06)'
        }`,
        borderRadius: 10,
        opacity: isLoser ? 0.45 : 1,
        cursor: canVote ? 'pointer' : 'default',
        transition: 'border-color 0.15s, background 0.15s, transform 0.15s',
        position: 'relative',
        font: 'inherit', color: 'inherit',
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
      <TeamLogo teamName={tag} size={48} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Tag + badge "SEU VOTO" + trophy (vencedor) inline com o nome */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7,
          justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
        }}>
          <span style={{
            fontSize: 18, fontWeight: 800, color: 'var(--xm-text-bright, #f1f5f9)',
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
          {isVoted && (
            <span style={{
              fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
              padding: '2px 6px', borderRadius: 3,
              background: 'rgba(249,115,22,0.18)', color: '#f97316',
              fontFamily: "'JetBrains Mono', monospace",
              border: '1px solid rgba(249,115,22,0.35)',
              whiteSpace: 'nowrap',
            }}>
              ✓ SEU VOTO
            </span>
          )}
        </div>
        {/* Nome completo, em mono e muted */}
        <div style={{
          fontSize: 11, color: 'var(--xm-muted, #6b7280)',
          marginTop: 4, lineHeight: 1.3,
          fontFamily: "'JetBrains Mono', monospace",
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {name}
        </div>
      </div>
    </button>
  )
}

// ── FaceoffCard ───────────────────────────────────────────────────────────────
export default function FaceoffCard({ faceoff, token, onVoted }) {
  const [voting, setVoting] = useState(false)
  const [error, setError]   = useState('')

  const { id, team_a_name, team_b_name, seed_a, seed_b,
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

  // Resultado pessoal (acertou/errou) — apenas em faceoffs resolved com voto
  let personalResult = null
  if (isResolved && my_vote && winner_team_name) {
    const myWin = (votedA && isWinnerA) || (votedB && isWinnerB)
    personalResult = myWin
      ? { label: 'ACERTOU', symbol: '✓', color: '#4ade80', bg: 'rgba(74,222,128,0.12)', border: 'rgba(74,222,128,0.35)' }
      : { label: 'ERROU',   symbol: '✗', color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.35)' }
  }

  const pill = STATUS_PILL[status] || { label: status.toUpperCase(), color: '#94a3b8', bg: 'transparent', border: 'transparent' }

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
      {/* Header: seeds + status + resultado pessoal (canto superior direito) */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', gap: 10,
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        background: 'rgba(255,255,255,0.015)',
      }}>
        <span style={{
          fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
          color: 'var(--xm-muted, #6b7280)', letterSpacing: '0.12em', fontWeight: 700,
        }}>
          #{seed_a}&nbsp;VS&nbsp;#{seed_b}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {personalResult && (
            // Badge "ACERTOU/ERROU" — destaque pessoal no canto sup. direito
            <span style={{
              fontSize: 10, fontWeight: 800, letterSpacing: '0.1em',
              padding: '3px 9px', borderRadius: 4,
              background: personalResult.bg,
              color: personalResult.color,
              border: `1px solid ${personalResult.border}`,
              fontFamily: "'JetBrains Mono', monospace",
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}>
              {personalResult.label} {personalResult.symbol}
            </span>
          )}
          <span style={{
            fontSize: 10, fontWeight: 800, letterSpacing: '0.12em',
            padding: '3px 9px', borderRadius: 4,
            background: pill.bg, color: pill.color, border: `1px solid ${pill.border}`,
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            {pill.label}
          </span>
        </div>
      </div>

      {/* Confronto horizontal: TIME A | vs | TIME B */}
      <div style={{
        display: 'flex', alignItems: 'stretch', gap: 10,
        padding: '14px 16px 12px',
      }}>
        <TeamSide
          tag={tagA} name={team_a_name}
          isWinner={isWinnerA} isLoser={isLoserA} isVoted={votedA}
          align="left"
          canVote={canVote && !votedA} voting={voting}
          onClick={() => vote('a')}
        />
        {/* VS central */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minWidth: 32, flexShrink: 0,
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
        </div>
        <TeamSide
          tag={tagB} name={team_b_name}
          isWinner={isWinnerB} isLoser={isLoserB} isVoted={votedB}
          align="right"
          canVote={canVote && !votedB} voting={voting}
          onClick={() => vote('b')}
        />
      </div>

      {/* Barra de votos — só após fechar ou resolver */}
      {showPct && <VoteBar pctA={pct_a} pctB={pct_b} tagA={tagA} tagB={tagB} winnerSide={winnerSide} />}

      {/* Footer (apenas se ainda não há %) */}
      {!showPct && (
        <div style={{
          padding: '8px 16px 12px',
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
