// frontend/src/utils/teamLogo.js
// Resolve o caminho da logo de um time dado o tag e o short_name da stage.
//
// Estrutura de arquivos:
//   /logos/PAS/{tag}.png  ou  .jpeg
//   /logos/PGS/{tag}.png
//   /logos/Tournaments/PAS.png
//   /logos/Tournaments/PGS.png
//
// Uso:
//   import { resolveTeamLogoUrl } from '../utils/teamLogo'
//   const url = resolveTeamLogoUrl('NAVI', 'PAS26')   // → '/logos/PAS/navi.png'
//   const url = resolveTeamLogoUrl('T1',   'PGS25')   // → '/logos/PGS/t1.png'

// Mapeamento short_name prefix → pasta
const SHORT_NAME_TO_FOLDER = {
  PAS: 'PAS',
  PGS: 'PGS',
}

// Times que usam .jpeg em vez de .png (lista manual dos arquivos)
const JPEG_TEAMS = {
  PAS: new Set(['afi', 'op']),
  PGS: new Set([]),
}

/**
 * Retorna o caminho público da logo de um time.
 *
 * @param {string} teamTag   - Tag do time em qualquer case (ex: 'NAVI', 'navi', 'T1')
 * @param {string} shortName - short_name da Stage (ex: 'PAS26', 'PGS25')
 * @returns {string|null}    - URL pública ou null se não encontrado
 */
export function resolveTeamLogoUrl(teamTag, shortName) {
  if (!teamTag) return null

  const tag = teamTag.toLowerCase()

  // Determina a pasta pela prefix do short_name
  const folder = _folderFromShortName(shortName)

  if (folder) {
    return _buildUrl(folder, tag)
  }

  // Fallback: tenta PAS depois PGS
  return _buildUrl('PAS', tag)
}

/**
 * Retorna a logo do torneio (ex: PAS.png, PGS.png).
 *
 * @param {string} shortName - short_name da Stage
 * @returns {string|null}
 */
export function resolveTournamentLogoUrl(shortName) {
  if (!shortName) return null
  const prefix = _prefixFromShortName(shortName)
  if (!prefix) return null
  return `/logos/Tournaments/${prefix}.png`
}

// ── Internos ───────────────────────────────────────────────────────────────

function _prefixFromShortName(shortName) {
  if (!shortName) return null
  const upper = shortName.toUpperCase()
  for (const prefix of Object.keys(SHORT_NAME_TO_FOLDER)) {
    if (upper.startsWith(prefix)) return prefix
  }
  return null
}

function _folderFromShortName(shortName) {
  const prefix = _prefixFromShortName(shortName)
  return prefix ? SHORT_NAME_TO_FOLDER[prefix] : null
}

function _buildUrl(folder, tag) {
  const isJpeg = (JPEG_TEAMS[folder] ?? new Set()).has(tag)
  // Preferir .webp quando disponível, senão .png, exceto times com .jpeg
  if (isJpeg) return `/logos/${folder}/${tag}.jpeg`
  // Retorna .webp como preferência — TeamLogo.jsx faz cascading automático
  return `/logos/${folder}/${tag}.webp`
}
