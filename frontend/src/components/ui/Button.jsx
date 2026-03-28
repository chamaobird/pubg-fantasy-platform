// ui/Button.jsx — Botões reutilizáveis

/**
 * variant: 'primary' | 'gold' | 'ghost' | 'outline' | 'danger'
 * size:    'sm' | 'md' | 'lg'
 * full:    booleano (width 100%)
 */
export function Button({
  children,
  variant = 'ghost',
  size = 'md',
  full = false,
  loading = false,
  style,
  className = '',
  ...props
}) {
  const cls = [
    'xbtn',
    `xbtn-${variant}`,
    `xbtn-${size}`,
    full ? 'xbtn-full' : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <button className={cls} style={style} disabled={loading || props.disabled} {...props}>
      {loading ? <span style={{ opacity: 0.6 }}>Aguarde...</span> : children}
    </button>
  )
}
