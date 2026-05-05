// DashIcon — wrapper semântico sobre paths SVG do XAMA Design System.
// Aceita nomes semânticos definidos em icons.js.
// Para trocar o icon set proprietário XAMA no futuro: alterar apenas icons.js.

import { ICON_PATHS } from './icons'

export function DashIcon({ name, size = 16, strokeWidth = 2, style, className }) {
  const IconContent = ICON_PATHS[name]
  if (!IconContent) return null
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0, display: 'inline-block', verticalAlign: 'middle', ...style }}
      className={className}
    >
      <IconContent />
    </svg>
  )
}
