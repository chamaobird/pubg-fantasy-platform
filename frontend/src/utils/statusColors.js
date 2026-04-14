// frontend/src/utils/statusColors.js
// Mapa centralizado de cores e labels por status de lineup/torneio.
// Usa CSS design tokens (var(--color-xama-*)) em vez de hex direto.

export const STATUS_COLOR = {
  // lineup_status
  open:     'var(--color-xama-green)',
  preview:  'var(--color-xama-orange)',
  closed:   'var(--color-xama-orange)',
  locked:   'var(--color-xama-muted)',
  // tournament status (legado Navbar)
  active:   'var(--color-xama-green)',
  upcoming: 'var(--color-xama-orange)',
  finished: 'var(--color-xama-muted)',
}

export const STATUS_LABEL = {
  active:   'AO VIVO',
  upcoming: 'EM BREVE',
  finished: 'ENCERRADO',
  open:     'ABERTA',
  preview:  'EM PREVIEW',
  closed:   'EM BREVE',
  locked:   'ENCERRADO',
}

// Configuração completa para cards e badges.
// bg/border usam rgba derivado das cores dos tokens (CSS vars puras não suportam canal
// alpha sem color-mix, que requer suporte explícito de browser).
export const STATUS_CONFIG = {
  open:    { color: 'var(--color-xama-green)',  bg: 'rgba(74,222,128,0.1)',   border: 'rgba(74,222,128,0.3)',   label: 'ABERTO'     },
  preview: { color: 'var(--color-xama-orange)', bg: 'rgba(249,115,22,0.1)',   border: 'rgba(249,115,22,0.35)',  label: 'EM PREVIEW' },
  locked:  { color: 'var(--color-xama-muted)',  bg: 'rgba(107,114,128,0.1)',  border: 'rgba(107,114,128,0.3)',  label: 'ENCERRADO'  },
  closed:  { color: 'var(--color-xama-muted)',  bg: 'rgba(107,114,128,0.07)', border: 'rgba(107,114,128,0.2)',  label: 'EM BREVE'   },
}

export function statusConfig(status) {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG.closed
}
