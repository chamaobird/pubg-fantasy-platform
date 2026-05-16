// ui/Button.jsx — Botões reutilizáveis

/**
 * variant: 'primary' | 'ghost' | 'danger'
 * size:    'sm' | 'lg'  (omit for default)
 * full:    booleano (width 100%)
 */
export function Button({
  children,
  variant = 'ghost',
  size = null,
  full = false,
  loading = false,
  style,
  className = '',
  ...props
}) {
  const cls = [
    'xm-btn',
    `xm-btn--${variant}`,
    size ? `xm-btn--${size}` : '',
    full ? 'xm-btn--full' : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <button className={cls} style={style} disabled={loading || props.disabled} {...props}>
      {loading ? <span style={{ opacity: 0.6 }}>Aguarde...</span> : children}
    </button>
  )
}
