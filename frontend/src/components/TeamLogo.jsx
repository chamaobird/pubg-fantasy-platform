import { useState } from 'react'
export default function TeamLogo({ teamName, size = 28 }) {
  const [imgError, setImgError] = useState(false)
  const logoUrl = teamName ? `/logos/${teamName.toLowerCase()}.png` : null
  if (logoUrl && !imgError) {
    return (
      <img src={logoUrl} alt={teamName} onError={() => setImgError(true)}
        style={{ width: size, height: size, objectFit: 'contain', borderRadius: '3px', flexShrink: 0, display: 'block' }} />
    )
  }
  const initials = teamName ? teamName.slice(0, 3).toUpperCase() : '?'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size, height: size, background: 'rgba(249,115,22,0.08)',
      border: '1px solid rgba(249,115,22,0.18)', borderRadius: '4px',
      fontSize: Math.max(7, Math.floor(size * 0.34)), fontWeight: 700,
      color: 'var(--color-xama-orange)', fontFamily: "'JetBrains Mono', monospace",
      letterSpacing: '-0.02em', flexShrink: 0, lineHeight: 1 }}>
      {initials}
    </span>
  )
}
