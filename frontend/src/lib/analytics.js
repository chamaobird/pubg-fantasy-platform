// frontend/src/lib/analytics.js
// Utilitário de analytics — encapsula PostHog para facilitar troca futura.
// Guard: nenhum evento/replay é disparado fora de produção.

import posthog from 'posthog-js'

/**
 * Registra um evento nomeado com propriedades opcionais.
 * Early-return em desenvolvimento para não poluir métricas.
 *
 * @param {string} event  - nome do evento, ex: "lineup_saved"
 * @param {object} props  - propriedades adicionais opcionais
 */
export function track(event, props = {}) {
  if (!import.meta.env.PROD) return
  posthog.capture(event, props)
}

/**
 * Identifica o usuário autenticado no PostHog.
 * Chamar após login bem-sucedido.
 */
export function identifyUser(userId, traits = {}) {
  if (!import.meta.env.PROD) return
  posthog.identify(String(userId), traits)
}

/**
 * Reseta a identidade do usuário no PostHog.
 * Chamar após logout.
 */
export function resetUser() {
  if (!import.meta.env.PROD) return
  posthog.reset()
}
