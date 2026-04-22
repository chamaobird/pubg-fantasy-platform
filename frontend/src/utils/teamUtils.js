// frontend/src/utils/teamUtils.js
// Mapeamento centralizado de nome completo de time → tag curta.
// Usado em LineupBuilder, PlayerStatsPage e qualquer outro componente
// que precise resolver tags a partir de team_name da API.

export const TEAM_NAME_TO_TAG = {
  // PAS stages — playoff teams + regular season
  'Affinity':           'AFi',
  'Also Known As':      'AKA',
  'Athletes of Christ': 'FE',
  'BESTIA':             'BST',
  'Chupinskys':         'INSK',
  'Collector':          'CLR',
  'Copenhagen Wolves':  'WOLF',
  'DOTS':               'DOTS',
  'Dream One':          'ONE',
  'DUEL':               'DUEL',
  'EUFAREIX10':         'X10',
  'For Nothing':        'FN',
  'FURIA':              'FUR',
  'IAM BOLIVIA':        'BO',
  'Injected':           'INJ',
  'Last Breath':        'LB',
  'Nevermind':          'NVM',
  'Newgen Allstars':    'NA',
  'No Way':             'NW',
  'Pest Control':       'PEST',
  'RENT FREE':          'FR',
  'ROC Esports':        'ROC',
  'Team FATE':          'FATE',
  'Team Falcons':       'FLC',
  'Team Liquid':        'TL',
  'Tempest':            'TMP',
  'TOYO Esports':       'TOYO',
  'What It Takes':      'WIT',
  '55 e-Sports':        '55PD',
  // PEC Spring Playoffs
  'Redline':              'RL',
  'Vuptrox':              'VPX',
  'GoNext Esports':       'GN',
  'PBRU':                 'PBRU',
  'Everlong':             'EVER',
  'YOOO':                 'YO',
  'NoTag Team':           'NOT',
  'BORZ':                 'BORZ',
  'PGG':                  'PGG',
  'Baldinini':            'BAL',
  'Ghetto Gang':          'GTG',
  'Storm on Request':     'SQU',
  'Starry SKY':           'STS',
  'Team Nemesis':         'NMSS',
  'HiVE':                 'HIVE',
  'Twisted Minds':        'TWIS',
  'Bushido Wildcats':     'BW',
  'noslack':              'SLCK',
  'Joga Bonito':          'JB',
  'S2G Esports':          'S2G',
  'Vis':                  'VIS',
  'Construction Workers': 'WORK',
  'exhowl':               'HOWL',
  'NATUS VINCERE':        'NAVI',
  'The Myth of':          'TMO',
  'Virtus.pro':           'VP',
  'ACEND Club':           'ACE',
  'Team Vitality':        'VIT',
  'S8UL':                 'S8UL',
}

/**
 * Resolve a tag curta do time.
 * 1. Lookup direto pelo nome completo (team_name da API)
 * 2. Extrai prefixo do person_name (formato TAG_PlayerName)
 * 3. Fallback: retorna team como estava
 */
export function formatTeamTag(personName, teamName) {
  if (teamName && TEAM_NAME_TO_TAG[teamName]) return TEAM_NAME_TO_TAG[teamName]
  if (personName) {
    const idx = personName.indexOf('_')
    if (idx > 0 && idx < personName.length - 1 && !personName.slice(0, idx).includes('-')) {
      return personName.slice(0, idx)
    }
  }
  return teamName || ''
}

/**
 * Resolve o nome de exibição do jogador removendo o prefixo TAG_.
 */
export function formatPlayerName(personName, teamName) {
  if (!personName) return ''
  if (personName.endsWith('_')) return personName.slice(0, -1)
  const idx = personName.indexOf('_')
  if (idx > 0 && idx < personName.length - 1) {
    const prefix = personName.slice(0, idx)
    if (!prefix.includes('-')) {
      const expectedTag = teamName ? TEAM_NAME_TO_TAG[teamName] : null
      if (!expectedTag || prefix.toUpperCase() === expectedTag.toUpperCase()) {
        return personName.slice(idx + 1)
      }
    }
  }
  return personName
}
