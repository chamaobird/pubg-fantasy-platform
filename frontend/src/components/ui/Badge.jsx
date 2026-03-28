// ui/Badge.jsx — Badges de status e labels

const PRESETS = {
  live:    'xb xb-live',
  soon:    'xb xb-soon',
  done:    'xb xb-done',
  open:    'xb xb-open',
  gold:    'xb xb-gold',
  teal:    'xb xb-teal',
}

/**
 * preset: 'live' | 'soon' | 'done' | 'open' | 'gold' | 'teal'
 * Ou use `style` + `className` para customizar
 */
export function Badge({ children, preset, dot = false, style, className = '' }) {
  const cls = preset ? PRESETS[preset] ?? 'xb' : 'xb'
  return (
    <span className={`${cls} ${className}`} style={style}>
      {dot && <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />}
      {children}
    </span>
  )
}

/** Badge de status do torneio (active/upcoming/finished) */
export function StatusBadge({ status }) {
  const MAP = {
    active:   { preset: 'live',  label: 'AO VIVO',  dot: true },
    upcoming: { preset: 'soon',  label: 'EM BREVE', dot: false },
    finished: { preset: 'done',  label: 'ENCERRADO',dot: false },
  }
  const cfg = MAP[status] ?? MAP.upcoming
  return <Badge preset={cfg.preset} dot={cfg.dot}>{cfg.label}</Badge>
}

/** Badge inline "EU" de região */
export function RegionBadge({ region }) {
  const color = region === 'EU' ? '#818cf8' : region === 'AM' ? '#fb923c' : '#6b7280'
  return (
    <span style={{
      display: 'inline-block', padding: '1px 6px',
      background: `${color}1a`, border: `1px solid ${color}44`,
      borderRadius: '4px', color, fontSize: '10px', fontWeight: 700,
      letterSpacing: '0.08em', verticalAlign: 'middle', marginLeft: '6px',
    }}>
      {region}
    </span>
  )
}
