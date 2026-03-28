// ui/PageHeader.jsx — Cabeçalho principal de página

/**
 * eyebrow: texto pequeno acima do título (ex: "PGS 2026")
 * title:   título principal grande
 * subtitle: texto de apoio abaixo
 * action:  nó React opcional no lado direito (botão, badge, etc.)
 */
export function PageHeader({ eyebrow, title, subtitle, action, style }) {
  return (
    <div className="xh-header" style={style}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          {eyebrow && <p className="xh-eyebrow">{eyebrow}</p>}
          <h1 className="xh-title">{title}</h1>
          {subtitle && <p className="xh-subtitle">{subtitle}</p>}
        </div>
        {action && <div style={{ flexShrink: 0 }}>{action}</div>}
      </div>
    </div>
  )
}
