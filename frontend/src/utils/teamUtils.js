// frontend/src/utils/teamUtils.js
// Mapeamento centralizado de nome completo de time → tag curta.
// Usado em LineupBuilder, PlayerStatsPage e qualquer outro componente
// que precise resolver tags a partir de team_name da API.

export const TEAM_NAME_TO_TAG = {
  // PAS stages — playoff teams + regular season
  'Affinity':           'AFi',
  'Also Known As':      'AKA',
  'Also known as':      'AKA',  // variante DB (lowercase k)
  'Athletes of Christ': 'FE',    // alias histórico (Playoffs 1)
  'GodLike':            'GodL',  // renomeado para Playoffs 2
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
  'NEVERMIND':          'NVM',  // variante DB (all caps)
  'Newgen Allstars':    'NA',
  'No Way':             'NW',
  'Pest Control':       'PEST',
  'PEST Control':       'PEST',  // variante DB (PEST maiúsculo)
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
  // PGS S2 — Winners Stage (16 times)
  'eArena':               'eA',
  'T1':                   'T1',
  '17 Gaming':            '17',
  'Crazy Raccoon':        'CR',
  'Natus Vincere':        'NaVi',
  'JD Gaming':            'JDG',
  'Petrichor Road':       'pero',
  'Made in Thailand':     'mith',
  "Anyone's Legend":      'AL',
  'SOOPers':              'DNS',
  'Theerathon Five':      'T5',
  'Four Angry Men':       '4AM',
  // PGS S2 — Survival Stage (8 times diretos)
  'Gen.G Esports':        'GEN',
  'The Expendables':      'TE',
  'Finhay Cerberus':      'FCE',
  'CERBERUS Esports':     'FCE',  // variante DB Group Stage
  'Change the Game':      'CTG',
  'Change The Game':      'CTG',  // variante DB Group Stage (T maiúsculo)
  'Full Sense':           'FS',
  'FULL SENSE':           'FS',   // variante DB Group Stage (all caps)
  'S2G Esports':          'S2G',
}

/**
 * Resolve a tag curta do time.
 * 1. Lookup direto pelo nome completo (team_name da API)
 * 2. Extrai prefixo do person_name (formato TAG_PlayerName)
 * 3. Fallback: retorna team como estava
 */
export function formatTeamTag(personName, teamName) {
  if (teamName && TEAM_NAME_TO_TAG[teamName]) return TEAM_NAME_TO_TAG[teamName].toUpperCase()
  if (personName) {
    const idx = personName.indexOf('_')
    if (idx > 0 && idx < personName.length - 1 && !personName.slice(0, idx).includes('-')) {
      return personName.slice(0, idx).toUpperCase()
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
