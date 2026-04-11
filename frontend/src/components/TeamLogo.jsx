// frontend/src/components/TeamLogo.jsx
import { useState } from 'react'

// Tentativas de resolução em ordem:
//   1. logoUrl explícita (vinda da API)
//   2. /logos/{folder}/{tag}.png  (folder derivado do shortName)
//   3. /logos/PAS/{tag}.png       (fallback PAS)
//   4. /logos/PGS/{tag}.png       (fallback PGS)
//   5. /logos/PAS/{tag}.jpeg      (alguns times usam jpeg)
//   6. /logos/PGS/{tag}.jpeg
//   7. Initials badge

const JPEG_TEAMS = new Set(['afi', 'op'])   // times com .jpeg em vez de .png

function buildCandidates(teamName, shortName, logoUrlProp) {
  if (!teamName) return []

  const tag = teamName.toLowerCase()

  // Determina pasta principal pelo shortName da stage
  let primaryFolder = null
  if (shortName) {
    const upper = shortName.toUpperCase()
    if (upper.startsWith('PAS')) primaryFolder = 'PAS'
    else if (upper.startsWith('PGS')) primaryFolder = 'PGS'
  }

  const ext = (folder) => JPEG_TEAMS.has(tag) ? 'jpeg' : 'png'

  const candidates = []

  if (logoUrlProp) candidates.push(logoUrlProp)

  if (primaryFolder) {
    candidates.push(`/logos/${primaryFolder}/${tag}.webp`)
    candidates.push(`/logos/${primaryFolder}/${tag}.${ext(primaryFolder)}`)
  }

  // Fallbacks nas outras pastas
  for (const folder of ['PAS', 'PGS']) {
    if (folder === primaryFolder) continue
    candidates.push(`/logos/${folder}/${tag}.webp`)
    candidates.push(`/logos/${folder}/${tag}.${ext(folder)}`)
  }

  // Fallback jpeg explícito se png falhar
  if (!JPEG_TEAMS.has(tag)) {
    if (primaryFolder) candidates.push(`/logos/${primaryFolder}/${tag}.jpeg`)
    for (const folder of ['PAS', 'PGS']) {
      if (folder === primaryFolder) continue
      candidates.push(`/logos/${folder}/${tag}.jpeg`)
    }
  }

  return candidates
}

export default function TeamLogo({ teamName, logoUrl: logoUrlProp, shortName = '', size = 28 }) {
  const candidates = buildCandidates(teamName, shortName, logoUrlProp)
  const [attemptIdx, setAttemptIdx] = useState(0)

  const currentUrl = candidates[attemptIdx] ?? null

  const handleError = () => {
    if (attemptIdx + 1 < candidates.length) {
      setAttemptIdx((i) => i + 1)
    } else {
      setAttemptIdx(candidates.length) // esgotou todas as tentativas
    }
  }

  if (currentUrl && attemptIdx < candidates.length) {
    return (
      <img
        src={currentUrl}
        alt={teamName}
        onError={handleError}
        style={{
          width: size, height: size,
          objectFit: 'contain',
          borderRadius: '3px',
          flexShrink: 0,
          display: 'block',
        }}
      />
    )
  }

  // Fallback: initials badge
  const initials = teamName ? teamName.slice(0, 3).toUpperCase() : '?'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size, height: size,
      background: 'rgba(249,115,22,0.08)',
      border: '1px solid rgba(249,115,22,0.18)',
      borderRadius: '4px',
      fontSize: Math.max(7, Math.floor(size * 0.34)),
      fontWeight: 700,
      color: 'var(--color-xama-orange)',
      fontFamily: "'JetBrains Mono', monospace",
      letterSpacing: '-0.02em',
      flexShrink: 0,
      lineHeight: 1,
    }}>
      {initials}
    </span>
  )
}
