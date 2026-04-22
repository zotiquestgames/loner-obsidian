// All tables are 6×6, row-major, 0-indexed (die values 1–6 map to index 0–5)

// ─── Inspiration Tables ───────────────────────────────────────────────────────

export const VERB_TABLE: string[][] = [
  ['inject',   'pass',   'own',     'divide',   'bury',    'borrow'],
  ['continue', 'learn',  'ask',     'multiply', 'receive', 'imagine'],
  ['develop',  'behave', 'replace', 'damage',   'collect', 'turn'],
  ['share',    'hand',   'play',    'explain',  'improve', 'cough'],
  ['face',     'expand', 'found',   'gather',   'prefer',  'belong'],
  ['trip',     'want',   'miss',    'dry',      'employ',  'destroy'],
];

export const ADJECTIVE_TABLE: string[][] = [
  ['frequent',     'faulty',        'obscene',    'scarce',        'rigid',       'long-term'],
  ['ethereal',     'sophisticated', 'rightful',   'knowledgeable', 'astonishing', 'ordinary'],
  ['descriptive',  'insidious',     'poor',       'proud',         'reflective',  'amusing'],
  ['silky',        'worthless',     'fixed',      'loose',         'willing',     'cold'],
  ['quiet',        'stormy',        'spooky',     'delirious',     'innate',      'late'],
  ['magnificent',  'arrogant',      'unhealthy',  'enormous',      'truculent',   'charming'],
];

export const NOUN_TABLE: string[][] = [
  ['cause',      'stage',   'change', 'verse',  'thrill',    'spot'],
  ['front',      'event',   'home',   'bag',    'measure',   'birth'],
  ['prose',      'motion',  'trade',  'memory', 'chance',    'drop'],
  ['instrument', 'friend',  'talk',   'liquid', 'fact',      'price'],
  ['word',       'morning', 'edge',   'room',   'system',    'camp'],
  ['key',        'income',  'use',    'humor',  'statement', 'argument'],
];

export function lookupInspiration(
  table: 'verb' | 'noun' | 'adjective',
  row: number,
  col: number
): string {
  const t = table === 'verb' ? VERB_TABLE : table === 'noun' ? NOUN_TABLE : ADJECTIVE_TABLE;
  return t[row - 1]?.[col - 1] ?? '?';
}

// ─── Adventure Maker Tables ───────────────────────────────────────────────────

// Table 1: Settings
export const SETTINGS_TABLE: string[][] = [
  ['Action Adventure',      'Post-apocalyptic',    'Fantasy',         'Science Fiction',  'Horror',           'Mystery'],
  ['Space Opera',           'Western',             'Cyberpunk',       'Historical',       'Superhero',        'Military'],
  ['Urban Fantasy',         'Steampunk',           'Noir',            'Dystopian',        'Survival',         'Espionage'],
  ['Mythological',          'Political Thriller',  'Slice of Life',   'Gothic',           'Heist',            'Cosmic Horror'],
  ['Isekai',                'Time Travel',         'Pirate',          'Lost World',       'Road Trip',        'Prison Break'],
  ['Post-human',            'Solarpunk',           'Dark Fantasy',    'Space Western',    'Dieselpunk',       'Weird West'],
];

// Table 2: Tones
export const TONES_TABLE: string[][] = [
  ['Gritty and realistic',       'Light-hearted',        'Darkly comic',       'Epic and grand',       'Intimate and personal',   'Surreal'],
  ['Suspenseful and thrilling',  'Melancholic',          'Hopeful',            'Bleak',                'Satirical',               'Whimsical'],
  ['Tense and claustrophobic',   'Operatic',             'Philosophical',      'Action-packed',        'Quiet and introspective', 'Chaotic'],
  ['Romantic',                   'Political',            'Nihilistic',         'Pulpy and lurid',      'Heartwarming',            'Dreamlike'],
  ['Paranoid',                   'Tragic',               'Comedic',            'Mysterious',           'Heroic',                  'Bitter'],
  ['Cynical',                    'Reverent',             'Savage',             'Ethereal',             'Tense',                   'Hopeless'],
];

// Table 3: Things (used in both Setting and Premise)
export const THINGS_TABLE: string[][] = [
  ['Ancient relics',        'Lost civilizations',  'Forbidden knowledge',  'Powerful factions',     'Strange creatures',       'Hidden passages'],
  ['Vast empires',          'Different factions',  'Dark secrets',         'Dangerous technology',  'Mystical artifacts',      'Underground networks'],
  ['Alien environments',    'Rebel movements',     'Corrupt institutions', 'Rare resources',         'Dimensional rifts',       'Ancient prophecies'],
  ['Corporate entities',    'Abandoned places',    'Mysterious strangers', 'Experimental subjects', 'Political intrigue',      'Natural disasters'],
  ['Criminal organizations','Powerful leaders',    'Ritual magic',         'Time anomalies',        'Stolen identities',       'Viral outbreaks'],
  ['Resistance fighters',   'Haunted locations',   'Memory manipulation',  'Artificial beings',     'Interstellar travel',     'Cultural clashes'],
];

// Table 4: Actions (used in Premise)
export const ACTIONS_TABLE: string[][] = [
  ['Seek',      'Uncover',    'Escape',    'Protect',   'Destroy',  'Create'],
  ['Retrieve',  'Infiltrate', 'Negotiate', 'Expose',    'Survive',  'Discover'],
  ['Overthrow', 'Rescue',     'Prevent',   'Investigate','Rebuild', 'Betray'],
  ['Confront',  'Steal',      'Deliver',   'Decode',    'Sabotage', 'Convince'],
  ['Cleanse',   'Awaken',     'Reclaim',   'Forge',     'Track',    'Unmask'],
  ['Transcend', 'Liberate',   'Contain',   'Restore',   'Exploit',  'Challenge'],
];

// Table 5: Opposition
export const OPPOSITION_TABLE: string[][] = [
  ['Ruthless mercenaries',      'Corrupt authorities',   'Ancient evil',         'Rival organization',     'Rogue AI',              'Fanatical cult'],
  ['Sinister organizations',    'Powerful noble',        'Natural force',        'Rival adventurer',       'Monster horde',         'Crime syndicate'],
  ['Tyrannical government',     'Alien invaders',        'Cursed entity',        'Corporate conspiracy',   'Rebel faction',         'Shadow organization'],
  ['Vengeful spirit',           'Traitorous ally',       'Dark wizard',          'Military commander',     'Mutant collective',     'Secret society'],
  ['Dimensional entity',        'Plague-bringer',        'Mad scientist',        'Warlord',                'Pirate fleet',          'Supernatural force'],
  ['Fallen hero',               'Hive mind',             'Time traveler',        'Assassin guild',         'Elemental power',       'Legendary beast'],
];

// 5W+H Table: each column is a d6 table (1–6 entries per column)
export const FIVEWH_TABLE: Record<string, string[]> = {
  Who: ['A lone wanderer', 'A secret organization', 'An unlikely hero', 'A fallen noble', 'A forgotten god', 'A desperate survivor'],
  What: ['Must retrieve a lost artifact', 'Must stop an ancient ritual', 'Seeks a missing person', 'Must expose a conspiracy', 'Needs to escape captivity', 'Must broker an alliance'],
  Why: ['To save their home', 'To atone for past sins', 'For wealth and glory', 'To fulfill a prophecy', 'To protect an innocent', 'Out of pure vengeance'],
  Where: ['In a dying city', 'Across an alien frontier', 'Inside a forbidden archive', 'Through enemy territory', 'On a generation ship', 'In the ruins of an empire'],
  How: ['With forbidden knowledge', 'Through cunning and deception', 'By making unlikely allies', 'With only wits and determination', 'Wielding a dangerous power', 'Following cryptic clues'],
  Obstacle: ['Time is running out', 'A powerful enemy hunts them', 'They cannot trust anyone', 'They lack critical information', 'Their past haunts them', 'The odds are impossible'],
};

export function lookupAdventureMaker(table: string[][], row: number, col: number): string {
  return table[row - 1]?.[col - 1] ?? '?';
}
