// ui/StatRow.jsx — Linha de stat para cards (label / value)

/**
 * color: 'default' | 'orange' | 'green' | 'gold'
 */
export function StatRow({ label, value, color = 'default' }) {
  return (
    <div className="xstat-row">
      <span className="xstat-label">{label}</span>
      <span className={`xstat-value ${color !== 'default' ? color : ''}`}>{value}</span>
    </div>
  )
}
