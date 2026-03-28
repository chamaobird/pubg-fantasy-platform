// ui/Card.jsx — Componente base de card reutilizável

/**
 * variant: 'default' | 'highlight' | 'ghost' | 'elevated'
 * padding: 'sm' | 'md' | 'lg' | número em px
 */
export function Card({ children, variant = 'default', padding = 'md', style, onClick, className = '', ...props }) {
  const padMap = { sm: '14px 16px', md: '20px 22px', lg: '24px 28px' }
  const variantMap = {
    default:  { background: 'var(--surface-1)', border: '1px solid var(--color-xama-border)' },
    elevated: { background: '#13161d', border: '1px solid var(--color-xama-border)', boxShadow: '0 4px 20px rgba(0,0,0,0.35)' },
    highlight:{ background: '#13161d', border: '1px solid rgba(249,115,22,0.35)', boxShadow: '0 0 24px rgba(249,115,22,0.07)' },
    ghost:    { background: 'transparent', border: '1px dashed var(--color-xama-border)', opacity: 0.8 },
  }

  return (
    <div
      onClick={onClick}
      style={{
        borderRadius: 'var(--radius-card)',
        padding: padMap[padding] ?? padding,
        transition: 'border-color 0.15s, transform 0.15s, box-shadow 0.15s',
        cursor: onClick ? 'pointer' : undefined,
        ...variantMap[variant],
        ...style,
      }}
      className={className}
      {...props}
    >
      {children}
    </div>
  )
}

/** Linha divisória dentro de um card */
export function CardDivider({ style }) {
  return <hr style={{ border: 'none', borderTop: '1px solid var(--color-xama-border)', margin: '12px 0', ...style }} />
}

/** Título de card */
export function CardTitle({ children, style }) {
  return (
    <div style={{ fontSize: 'var(--fs-card-title)', fontWeight: 700, color: '#fff', marginBottom: '3px', lineHeight: 1.3, ...style }}>
      {children}
    </div>
  )
}

/** Subtítulo/região de card */
export function CardSub({ children, style }) {
  return (
    <div style={{ fontSize: '12px', color: 'var(--color-xama-muted)', marginBottom: '0', ...style }}>
      {children}
    </div>
  )
}
