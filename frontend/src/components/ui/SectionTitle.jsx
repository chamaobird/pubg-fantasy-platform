// ui/SectionTitle.jsx — Título de seção com linha decorativa

/**
 * icon: emoji ou string opcional antes do texto
 * Renderiza uma linha divisória depois do texto (via CSS ::after)
 */
export function SectionTitle({ children, icon, style }) {
  return (
    <p className="xs-title" style={{ marginTop: 'var(--space-section)', ...style }}>
      {icon && <span style={{ fontSize: '13px' }}>{icon}</span>}
      {children}
    </p>
  )
}
