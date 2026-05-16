// frontend/src/utils/statusColors.js
// Mapa centralizado de cores e labels por status de lineup/torneio.
// Usa CSS design tokens (var(--xm-*)) em vez de hex direto.

export const STATUS_COLOR = {
  // lineup_status
  open:        'var(--xm-green)',
  preview:     'var(--xm-orange)',
  live: 'var(--xm-orange)',
  closed:      'var(--xm-orange)',
  locked:      'var(--xm-muted)',
  // tournament status (legado Navbar)
  active:   'var(--xm-green)',
  upcoming: 'var(--xm-orange)',
  finished: 'var(--xm-muted)',
}

export const STATUS_LABEL = {
  active:      'AO VIVO',
  upcoming:    'EM BREVE',
  finished:    'ENCERRADO',
  open:        'ABERTA',
  preview:     'EM PREVIEW',
  live: 'EM JOGO',
  closed:      'EM BREVE',
  locked:      'ENCERRADO',
}

// Configuração completa para cards e badges.
// bg/border usam rgba derivado das cores dos tokens (CSS vars puras não suportam canal
// alpha sem color-mix, que requer suporte explícito de browser).
export const STATUS_CONFIG = {
  open:        { color: 'var(--xm-green)',  bg: 'rgba(74,222,128,0.1)',   border: 'rgba(74,222,128,0.3)',   label: 'ABERTO'     },
  preview:     { color: 'var(--xm-orange)', bg: 'rgba(249,115,22,0.1)',   border: 'rgba(249,115,22,0.35)',  label: 'EM PREVIEW' },
  live: { color: 'var(--xm-orange)', bg: 'rgba(249,115,22,0.1)',   border: 'rgba(249,115,22,0.35)',  label: 'EM JOGO'    },
  locked:      { color: 'var(--xm-muted)',  bg: 'rgba(107,114,128,0.1)',  border: 'rgba(107,114,128,0.3)',  label: 'ENCERRADO'  },
  closed:      { color: 'var(--xm-muted)',  bg: 'rgba(107,114,128,0.07)', border: 'rgba(107,114,128,0.2)',  label: 'EM BREVE'   },
}

export function statusConfig(status) {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG.closed
}
