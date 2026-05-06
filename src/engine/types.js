/**
 * Pokémon Type System for PokéChess
 * Full 18-type effectiveness chart (Gen 6+)
 * Plus Pokémon data for all Paradox Pokémon used in the game
 */

// ─── Type Definitions ───────────────────────────────────────────────

export const TYPES = {
  NORMAL:   { name: 'Normal',   emoji: '⬜', color: '#A8A878', bg: '#A8A87822' },
  FIRE:     { name: 'Fire',     emoji: '🔥', color: '#F08030', bg: '#F0803022' },
  WATER:    { name: 'Water',    emoji: '💧', color: '#6890F0', bg: '#6890F022' },
  ELECTRIC: { name: 'Electric', emoji: '⚡', color: '#F8D030', bg: '#F8D03022' },
  GRASS:    { name: 'Grass',    emoji: '🌿', color: '#78C850', bg: '#78C85022' },
  ICE:      { name: 'Ice',      emoji: '❄️',  color: '#98D8D8', bg: '#98D8D822' },
  FIGHTING: { name: 'Fighting', emoji: '🥊', color: '#C03028', bg: '#C0302822' },
  POISON:   { name: 'Poison',   emoji: '☠️',  color: '#A040A0', bg: '#A040A022' },
  GROUND:   { name: 'Ground',   emoji: '🏔️', color: '#E0C068', bg: '#E0C06822' },
  FLYING:   { name: 'Flying',   emoji: '🕊️', color: '#A890F0', bg: '#A890F022' },
  PSYCHIC:  { name: 'Psychic',  emoji: '🔮', color: '#F85888', bg: '#F8588822' },
  BUG:      { name: 'Bug',      emoji: '🐛', color: '#A8B820', bg: '#A8B82022' },
  ROCK:     { name: 'Rock',     emoji: '🪨', color: '#B8A038', bg: '#B8A03822' },
  GHOST:    { name: 'Ghost',    emoji: '👻', color: '#705898', bg: '#70589822' },
  DRAGON:   { name: 'Dragon',   emoji: '🐉', color: '#7038F8', bg: '#7038F822' },
  DARK:     { name: 'Dark',     emoji: '🌑', color: '#705848', bg: '#70584822' },
  STEEL:    { name: 'Steel',    emoji: '⚙️',  color: '#B8B8D0', bg: '#B8B8D022' },
  FAIRY:    { name: 'Fairy',    emoji: '🧚', color: '#EE99AC', bg: '#EE99AC22' },
};

export const TYPE_KEYS = Object.keys(TYPES);

// ─── Full 18×18 Type Effectiveness Chart (Gen 6+) ──────────────────

const C = {
  NORMAL:   { NORMAL:1, FIRE:1,   WATER:1,   ELECTRIC:1,   GRASS:1,   ICE:1,   FIGHTING:1,   POISON:1,   GROUND:1,   FLYING:1,   PSYCHIC:1,   BUG:1,   ROCK:0.5, GHOST:0,   DRAGON:1, DARK:1,   STEEL:0.5, FAIRY:1   },
  FIRE:     { NORMAL:1, FIRE:0.5, WATER:0.5, ELECTRIC:1,   GRASS:2,   ICE:2,   FIGHTING:1,   POISON:1,   GROUND:1,   FLYING:1,   PSYCHIC:1,   BUG:2,   ROCK:0.5, GHOST:1,   DRAGON:0.5,DARK:1,   STEEL:2,   FAIRY:1   },
  WATER:    { NORMAL:1, FIRE:2,   WATER:0.5, ELECTRIC:1,   GRASS:0.5, ICE:1,   FIGHTING:1,   POISON:1,   GROUND:2,   FLYING:1,   PSYCHIC:1,   BUG:1,   ROCK:2,   GHOST:1,   DRAGON:0.5,DARK:1,   STEEL:1,   FAIRY:1   },
  ELECTRIC: { NORMAL:1, FIRE:1,   WATER:2,   ELECTRIC:0.5, GRASS:0.5, ICE:1,   FIGHTING:1,   POISON:1,   GROUND:0,   FLYING:2,   PSYCHIC:1,   BUG:1,   ROCK:1,   GHOST:1,   DRAGON:0.5,DARK:1,   STEEL:1,   FAIRY:1   },
  GRASS:    { NORMAL:1, FIRE:0.5, WATER:2,   ELECTRIC:1,   GRASS:0.5, ICE:1,   FIGHTING:1,   POISON:0.5, GROUND:2,   FLYING:0.5, PSYCHIC:1,   BUG:0.5, ROCK:2,   GHOST:1,   DRAGON:0.5,DARK:1,   STEEL:0.5, FAIRY:1   },
  ICE:      { NORMAL:1, FIRE:0.5, WATER:0.5, ELECTRIC:1,   GRASS:2,   ICE:0.5, FIGHTING:1,   POISON:1,   GROUND:2,   FLYING:2,   PSYCHIC:1,   BUG:1,   ROCK:1,   GHOST:1,   DRAGON:2,  DARK:1,   STEEL:0.5, FAIRY:1   },
  FIGHTING: { NORMAL:2, FIRE:1,   WATER:1,   ELECTRIC:1,   GRASS:1,   ICE:2,   FIGHTING:1,   POISON:0.5, GROUND:1,   FLYING:0.5, PSYCHIC:0.5, BUG:0.5, ROCK:2,   GHOST:0,   DRAGON:1,  DARK:2,   STEEL:2,   FAIRY:0.5 },
  POISON:   { NORMAL:1, FIRE:1,   WATER:1,   ELECTRIC:1,   GRASS:2,   ICE:1,   FIGHTING:1,   POISON:0.5, GROUND:0.5, FLYING:1,   PSYCHIC:1,   BUG:1,   ROCK:0.5, GHOST:0.5, DRAGON:1,  DARK:1,   STEEL:0,   FAIRY:2   },
  GROUND:   { NORMAL:1, FIRE:2,   WATER:1,   ELECTRIC:2,   GRASS:0.5, ICE:1,   FIGHTING:1,   POISON:2,   GROUND:1,   FLYING:0,   PSYCHIC:1,   BUG:0.5, ROCK:2,   GHOST:1,   DRAGON:1,  DARK:1,   STEEL:2,   FAIRY:1   },
  FLYING:   { NORMAL:1, FIRE:1,   WATER:1,   ELECTRIC:0.5, GRASS:2,   ICE:1,   FIGHTING:2,   POISON:1,   GROUND:1,   FLYING:1,   PSYCHIC:1,   BUG:2,   ROCK:0.5, GHOST:1,   DRAGON:1,  DARK:1,   STEEL:0.5, FAIRY:1   },
  PSYCHIC:  { NORMAL:1, FIRE:1,   WATER:1,   ELECTRIC:1,   GRASS:1,   ICE:1,   FIGHTING:2,   POISON:2,   GROUND:1,   FLYING:1,   PSYCHIC:0.5, BUG:1,   ROCK:1,   GHOST:1,   DRAGON:1,  DARK:0,   STEEL:0.5, FAIRY:1   },
  BUG:      { NORMAL:1, FIRE:0.5, WATER:1,   ELECTRIC:1,   GRASS:2,   ICE:1,   FIGHTING:0.5, POISON:0.5, GROUND:1,   FLYING:0.5, PSYCHIC:2,   BUG:1,   ROCK:1,   GHOST:0.5, DRAGON:1,  DARK:2,   STEEL:0.5, FAIRY:0.5 },
  ROCK:     { NORMAL:1, FIRE:2,   WATER:1,   ELECTRIC:1,   GRASS:1,   ICE:2,   FIGHTING:0.5, POISON:1,   GROUND:0.5, FLYING:2,   PSYCHIC:1,   BUG:2,   ROCK:1,   GHOST:1,   DRAGON:1,  DARK:1,   STEEL:0.5, FAIRY:1   },
  GHOST:    { NORMAL:0, FIRE:1,   WATER:1,   ELECTRIC:1,   GRASS:1,   ICE:1,   FIGHTING:1,   POISON:1,   GROUND:1,   FLYING:1,   PSYCHIC:2,   BUG:1,   ROCK:1,   GHOST:2,   DRAGON:1,  DARK:0.5, STEEL:1,   FAIRY:1   },
  DRAGON:   { NORMAL:1, FIRE:1,   WATER:1,   ELECTRIC:1,   GRASS:1,   ICE:1,   FIGHTING:1,   POISON:1,   GROUND:1,   FLYING:1,   PSYCHIC:1,   BUG:1,   ROCK:1,   GHOST:1,   DRAGON:2,  DARK:1,   STEEL:0.5, FAIRY:0   },
  DARK:     { NORMAL:1, FIRE:1,   WATER:1,   ELECTRIC:1,   GRASS:1,   ICE:1,   FIGHTING:0.5, POISON:1,   GROUND:1,   FLYING:1,   PSYCHIC:2,   BUG:1,   ROCK:1,   GHOST:2,   DRAGON:1,  DARK:0.5, STEEL:1,   FAIRY:0.5 },
  STEEL:    { NORMAL:1, FIRE:0.5, WATER:0.5, ELECTRIC:0.5, GRASS:1,   ICE:2,   FIGHTING:1,   POISON:1,   GROUND:1,   FLYING:1,   PSYCHIC:1,   BUG:1,   ROCK:2,   GHOST:1,   DRAGON:1,  DARK:1,   STEEL:0.5, FAIRY:2   },
  FAIRY:    { NORMAL:1, FIRE:0.5, WATER:1,   ELECTRIC:1,   GRASS:1,   ICE:1,   FIGHTING:2,   POISON:0.5, GROUND:1,   FLYING:1,   PSYCHIC:1,   BUG:1,   ROCK:1,   GHOST:1,   DRAGON:2,  DARK:2,   STEEL:0.5, FAIRY:1   },
};

export const TYPE_CHART = C;

/**
 * Get the type effectiveness multiplier.
 * Uses attacker's PRIMARY type vs ALL of defender's types.
 * Super effective = 2x, not very effective = 0.5x, immune = 0x
 */
export function getTypeMultiplier(attackerTypes, defenderTypes) {
  if (!attackerTypes?.length || !defenderTypes?.length) return 1;

  // Check each attacker type and use the best multiplier
  let bestMultiplier = 1;

  for (const atkType of attackerTypes) {
    const chart = C[atkType];
    if (!chart) continue;

    // Multiply against ALL defender types (allows 4x for dual weaknesses)
    let mult = 1;
    for (const defType of defenderTypes) {
      const eff = chart[defType];
      if (eff !== undefined) mult *= eff;
    }

    if (mult > bestMultiplier) bestMultiplier = mult;
    // Also track if this type is better even when resisted
    if (bestMultiplier <= 1 && mult > bestMultiplier) bestMultiplier = mult;
  }

  // Tiers: 4x, 2x, 1x, 0.5x, 0.25x — no full immunities in PokéChess
  if (bestMultiplier >= 4) return 4;
  if (bestMultiplier >= 2) return 2;
  if (bestMultiplier <= 0) return 0.25; // double immunity/resist → still does something
  if (bestMultiplier <= 0.25) return 0.25;
  if (bestMultiplier < 1) return 0.5;
  return 1;
}

// Sprite helper
const SPRITE = id => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;

export const POKEMON = {
  // ── Scarlet Team (White) — Default ──
  KORAIDON:     { name: 'Koraidon',     types: ['FIGHTING','DRAGON'],  team: 'scarlet', emoji: '🦎', img: SPRITE(1007), desc: 'The Winged King',       hp: 10, maxHp: 10, damage: 4, damageTier: 'heavy' },
  SANDY_SHOCKS: { name: 'Sandy Shocks', types: ['ELECTRIC','GROUND'],  team: 'scarlet', emoji: '🧲', img: SPRITE(989),  desc: 'Ancient Magneton',      hp: 8,  maxHp: 8,  damage: 2, damageTier: 'weak' },
  FLUTTER_MANE: { name: 'Flutter Mane', types: ['GHOST','FAIRY'],      team: 'scarlet', emoji: '👻', img: SPRITE(987),  desc: 'Ancient Misdreavus',    hp: 8,  maxHp: 8,  damage: 3, damageTier: 'standard' },
  RAGING_BOLT:  { name: 'Raging Bolt',  types: ['ELECTRIC','DRAGON'],  team: 'scarlet', emoji: '🦕', img: SPRITE(1021), desc: 'Ancient Raikou',        hp: 9,  maxHp: 9,  damage: 4, damageTier: 'heavy' },
  ROARING_MOON: { name: 'Roaring Moon', types: ['DRAGON','DARK'],      team: 'scarlet', emoji: '🌙', img: SPRITE(1005), desc: 'Ancient Salamence',     hp: 8,  maxHp: 8,  damage: 3, damageTier: 'standard' },
  SCREAM_TAIL:  { name: 'Scream Tail',  types: ['FAIRY','PSYCHIC'],    team: 'scarlet', emoji: '🎀', img: SPRITE(985),  desc: 'Ancient Jigglypuff',    hp: 8,  maxHp: 8,  damage: 2, damageTier: 'weak' },
  GREAT_TUSK:   { name: 'Great Tusk',   types: ['GROUND','FIGHTING'],  team: 'scarlet', emoji: '🐘', img: SPRITE(984),  desc: 'Ancient Donphan',       hp: 9,  maxHp: 9,  damage: 4, damageTier: 'heavy' },
  BRUTE_BONNET: { name: 'Brute Bonnet', types: ['GRASS','DARK'],       team: 'scarlet', emoji: '🍄', img: SPRITE(986),  desc: 'Ancient Amoonguss',     hp: 7,  maxHp: 7,  damage: 3, damageTier: 'standard' },
  SLITHER_WING: { name: 'Slither Wing', types: ['BUG','FIGHTING'],     team: 'scarlet', emoji: '🦗', img: SPRITE(988),  desc: 'Ancient Volcarona',     hp: 8,  maxHp: 8,  damage: 3, damageTier: 'standard' },
  WALKING_WAKE: { name: 'Walking Wake', types: ['WATER','DRAGON'],     team: 'scarlet', emoji: '🌊', img: SPRITE(1009), desc: 'Ancient Suicune',       hp: 8,  maxHp: 8,  damage: 3, damageTier: 'standard' },
  GOUGING_FIRE: { name: 'Gouging Fire', types: ['FIRE','DRAGON'],      team: 'scarlet', emoji: '🔥', img: SPRITE(1020), desc: 'Ancient Entei',         hp: 9,  maxHp: 9,  damage: 4, damageTier: 'heavy' },
  // Scarlet classics
  BULBASAUR:    { name: 'Bulbasaur',    types: ['GRASS','POISON'],     team: 'scarlet', emoji: '🌱', img: SPRITE(1),    desc: 'OP Ancient Seed',       hp: 12, maxHp: 12, damage: 5, damageTier: 'heavy' },
  CHARIZARD:    { name: 'Charizard',    types: ['FIRE','FLYING'],      team: 'scarlet', emoji: '🔥', img: SPRITE(6),    desc: 'Flame Pokémon',         hp: 4,  maxHp: 4,  damage: 1, damageTier: 'weak' },
  DRAGONITE:    { name: 'Dragonite',    types: ['DRAGON','FLYING'],    team: 'scarlet', emoji: '🐉', img: SPRITE(149),  desc: 'Dragon Pokémon',        hp: 9,  maxHp: 9,  damage: 3, damageTier: 'standard' },
  GARCHOMP:     { name: 'Garchomp',     types: ['DRAGON','GROUND'],    team: 'scarlet', emoji: '🦈', img: SPRITE(445),  desc: 'Mach Pokémon',          hp: 9,  maxHp: 9,  damage: 4, damageTier: 'heavy' },
  BLAZIKEN:     { name: 'Blaziken',     types: ['FIRE','FIGHTING'],    team: 'scarlet', emoji: '🐔', img: SPRITE(257),  desc: 'Blaze Pokémon',         hp: 8,  maxHp: 8,  damage: 3, damageTier: 'standard' },
  SCEPTILE:     { name: 'Sceptile',     types: ['GRASS','DRAGON'],     team: 'scarlet', emoji: '🦎', img: SPRITE(254),  desc: 'Forest Pokémon',        hp: 7,  maxHp: 7,  damage: 3, damageTier: 'standard' },
  GHOLDENGO:    { name: 'Gholdengo',    types: ['STEEL','GHOST'],      team: 'scarlet', emoji: '💰', img: SPRITE(1000), desc: 'Coin Entity Pokémon',    hp: 8,  maxHp: 8,  damage: 4, damageTier: 'heavy' },
  CHI_YU:       { name: 'Chi-Yu',       types: ['DARK','FIRE'],        team: 'scarlet', emoji: '🐟', img: SPRITE(1004), desc: 'Ruinous Pokémon',       hp: 7,  maxHp: 7,  damage: 5, damageTier: 'heavy' },
  INCINEROAR:   { name: 'Incineroar',   types: ['FIRE','DARK'],        team: 'violet',  emoji: '🐯', img: SPRITE(727),  desc: 'Heel Pokémon',          hp: 9,  maxHp: 9,  damage: 3, damageTier: 'standard' },
  MAGCARGO:     { name: 'Magcargo',     types: ['FIRE','ROCK'],        team: 'scarlet', emoji: '🐌', img: SPRITE(219),  desc: 'Lava Pokémon',          hp: 7,  maxHp: 7,  damage: 2, damageTier: 'weak' },
  COMFEY:       { name: 'Comfey',       types: ['FAIRY'],              team: 'scarlet', emoji: '🌼', img: SPRITE(764),  desc: 'Posy Picker Pokémon',   hp: 8,  maxHp: 8,  damage: 1, damageTier: 'weak' },
  BELLIBOLT:    { name: 'Bellibolt',    types: ['ELECTRIC'],           team: 'scarlet', emoji: '🔋', img: SPRITE(939),  desc: 'EleFrog Pokémon',       hp: 9,  maxHp: 9,  damage: 2, damageTier: 'weak' },
  ARCANINE:     { name: 'Arcanine',     types: ['FIRE'],               team: 'scarlet', emoji: '🐕', img: SPRITE(59),   desc: 'Legendary Pokémon',     hp: 9,  maxHp: 9,  damage: 3, damageTier: 'standard' },
  TYRANITAR:    { name: 'Tyranitar',    types: ['ROCK','DARK'],        team: 'scarlet', emoji: '🦖', img: SPRITE(248),  desc: 'Armor Pokémon',         hp: 10, maxHp: 10, damage: 4, damageTier: 'heavy' },
  SKELEDIRGE:   { name: 'Skeledirge',   types: ['FIRE','GHOST'],       team: 'scarlet', emoji: '🐊', img: SPRITE(911),  desc: 'Singer Pokémon',        hp: 9,  maxHp: 9,  damage: 3, damageTier: 'standard' },
  TINKATON:     { name: 'Tinkaton',     types: ['FAIRY','STEEL'],      team: 'scarlet', emoji: '🔨', img: SPRITE(959),  desc: 'Hammer Pokémon',        hp: 7,  maxHp: 7,  damage: 4, damageTier: 'heavy' },
  // Scarlet pack-only
  IVYSAUR:      { name: 'Ivysaur',      types: ['GRASS','POISON'],     team: 'scarlet', emoji: '🌿', img: SPRITE(2),    desc: 'Seed Pokémon',          hp: 8,  maxHp: 8,  damage: 3, damageTier: 'standard' },
  VENUSAUR:     { name: 'Venusaur',     types: ['GRASS','POISON'],     team: 'scarlet', emoji: '🌺', img: SPRITE(3),    desc: 'Seed Pokémon',          hp: 10, maxHp: 10, damage: 4, damageTier: 'heavy' },
  SCIZOR:       { name: 'Scizor',       types: ['BUG','STEEL'],        team: 'scarlet', emoji: '✂️', img: SPRITE(212),  desc: 'Pincer Pokémon',        hp: 9,  maxHp: 9,  damage: 4, damageTier: 'heavy' },
  VOLCANION:    { name: 'Volcanion',    types: ['FIRE','WATER'],       team: 'scarlet', emoji: '🌋', img: SPRITE(721),  desc: 'Steam Pokémon',         hp: 9,  maxHp: 9,  damage: 3, damageTier: 'standard' },
  LYCANROC:     { name: 'Lycanroc',     types: ['ROCK'],               team: 'scarlet', emoji: '🐺', img: SPRITE(745),  desc: 'Wolf Pokémon',          hp: 8,  maxHp: 8,  damage: 3, damageTier: 'standard' },

  // ── Violet Team (Black) ──
  MIRAIDON:     { name: 'Miraidon',     types: ['ELECTRIC','DRAGON'],  team: 'violet',  emoji: '🐲', img: SPRITE(1008), desc: 'The Iron Serpent',      hp: 10, maxHp: 10, damage: 4, damageTier: 'heavy' },
  IRON_MOTH:    { name: 'Iron Moth',    types: ['FIRE','POISON'],      team: 'violet',  emoji: '🦋', img: SPRITE(994),  desc: 'Future Volcarona',      hp: 8,  maxHp: 8,  damage: 2, damageTier: 'weak' },
  IRON_CROWN:   { name: 'Iron Crown',   types: ['STEEL','PSYCHIC'],    team: 'violet',  emoji: '👑', img: SPRITE(1023), desc: 'Future Cobalion',       hp: 8,  maxHp: 8,  damage: 4, damageTier: 'heavy' },
  IRON_BOULDER: { name: 'Iron Boulder', types: ['ROCK','PSYCHIC'],     team: 'violet',  emoji: '🗿', img: SPRITE(1022), desc: 'Future Terrakion',      hp: 9,  maxHp: 9,  damage: 4, damageTier: 'heavy' },
  IRON_JUGULIS: { name: 'Iron Jugulis', types: ['DARK','FLYING'],      team: 'violet',  emoji: '🦅', img: SPRITE(993),  desc: 'Future Hydreigon',      hp: 8,  maxHp: 8,  damage: 3, damageTier: 'standard' },
  IRON_BUNDLE:  { name: 'Iron Bundle',  types: ['ICE','WATER'],        team: 'violet',  emoji: '🐧', img: SPRITE(991),  desc: 'Future Delibird',       hp: 8,  maxHp: 8,  damage: 2, damageTier: 'weak' },
  IRON_TREADS:  { name: 'Iron Treads',  types: ['GROUND','STEEL'],     team: 'violet',  emoji: '🛞', img: SPRITE(990),  desc: 'Future Donphan',        hp: 9,  maxHp: 9,  damage: 4, damageTier: 'heavy' },
  IRON_HANDS:   { name: 'Iron Hands',   types: ['FIGHTING','ELECTRIC'],team: 'violet',  emoji: '🤖', img: SPRITE(992),  desc: 'Future Hariyama',       hp: 10, maxHp: 10, damage: 3, damageTier: 'standard' },
  IRON_THORNS:  { name: 'Iron Thorns',  types: ['ROCK','ELECTRIC'],    team: 'violet',  emoji: '⚡', img: SPRITE(995),  desc: 'Future Tyranitar',      hp: 9,  maxHp: 9,  damage: 3, damageTier: 'standard' },
  IRON_VALIANT: { name: 'Iron Valiant', types: ['FAIRY','FIGHTING'],   team: 'violet',  emoji: '⚔️', img: SPRITE(1006), desc: 'Future Gallade',        hp: 8,  maxHp: 8,  damage: 4, damageTier: 'heavy' },
  IRON_LEAVES:  { name: 'Iron Leaves',  types: ['GRASS','PSYCHIC'],    team: 'violet',  emoji: '🍃', img: SPRITE(1010), desc: 'Future Virizion',       hp: 8,  maxHp: 8,  damage: 3, damageTier: 'standard' },
  // Violet classics
  PIKACHU:      { name: 'Pikachu',      types: ['ELECTRIC','STEEL'],   team: 'violet',  emoji: '⚡', img: SPRITE(25),   desc: 'OP Future Mouse',       hp: 12, maxHp: 12, damage: 5, damageTier: 'heavy' },
  GENGAR:       { name: 'Gengar',       types: ['GHOST','POISON'],     team: 'violet',  emoji: '👻', img: SPRITE(94),   desc: 'Shadow Pokémon',        hp: 8,  maxHp: 8,  damage: 4, damageTier: 'heavy' },
  METAGROSS:    { name: 'Metagross',    types: ['STEEL','PSYCHIC'],    team: 'violet',  emoji: '🤖', img: SPRITE(376),  desc: 'Iron Leg Pokémon',      hp: 9,  maxHp: 9,  damage: 4, damageTier: 'heavy' },
  LUCARIO:      { name: 'Lucario',      types: ['FIGHTING','STEEL'],   team: 'violet',  emoji: '🐺', img: SPRITE(448),  desc: 'Aura Pokémon',          hp: 8,  maxHp: 8,  damage: 3, damageTier: 'standard' },
  GARDEVOIR:    { name: 'Gardevoir',    types: ['PSYCHIC','FAIRY'],    team: 'violet',  emoji: '💃', img: SPRITE(282),  desc: 'Embrace Pokémon',       hp: 7,  maxHp: 7,  damage: 3, damageTier: 'standard' },
  SYLVEON:      { name: 'Sylveon',      types: ['FAIRY','NORMAL'],     team: 'violet',  emoji: '🎀', img: SPRITE(700),  desc: 'Intertwining Pokémon',   hp: 8,  maxHp: 8,  damage: 2, damageTier: 'weak' },
  DRAGAPULT:    { name: 'Dragapult',    types: ['DRAGON','GHOST'],     team: 'violet',  emoji: '🐉', img: SPRITE(887),  desc: 'Stealth Pokémon',       hp: 7,  maxHp: 7,  damage: 4, damageTier: 'heavy' },
  CHIEN_PAO:    { name: 'Chien-Pao',    types: ['DARK','ICE'],         team: 'violet',  emoji: '🐆', img: SPRITE(1002), desc: 'Ruinous Pokémon',       hp: 7,  maxHp: 7,  damage: 5, damageTier: 'heavy' },
  ZAPDOS:       { name: 'Zapdos',       types: ['ELECTRIC','FLYING'],  team: 'scarlet', emoji: '⚡', img: SPRITE(145),  desc: 'Electric Pokémon',      hp: 8,  maxHp: 8,  damage: 3, damageTier: 'standard' },
  BRAMBLEGHAST: { name: 'Brambleghast', types: ['GRASS','GHOST'],      team: 'violet',  emoji: '🌿', img: SPRITE(947),  desc: 'Tumbleweed Pokémon',    hp: 7,  maxHp: 7,  damage: 2, damageTier: 'weak' },
  AUDINO:       { name: 'Audino',       types: ['NORMAL','FAIRY'],     team: 'violet',  emoji: '👂', img: SPRITE(531),  desc: 'Hearing Pokémon',       hp: 8,  maxHp: 8,  damage: 1, damageTier: 'weak' },
  MIMIKYU:      { name: 'Mimikyu',      types: ['GHOST','FAIRY'],      team: 'violet',  emoji: '👻', img: SPRITE(778),  desc: 'Disguise Pokémon',      hp: 7,  maxHp: 7,  damage: 3, damageTier: 'standard' },
  TOXTRICITY:   { name: 'Toxtricity',   types: ['ELECTRIC','POISON'],  team: 'violet',  emoji: '🎸', img: SPRITE(849),  desc: 'Punk Pokémon',          hp: 8,  maxHp: 8,  damage: 3, damageTier: 'standard' },
  CERULEDGE:    { name: 'Ceruledge',    types: ['FIRE','GHOST'],       team: 'violet',  emoji: '🗡️', img: SPRITE(937),  desc: 'Fire Blades Pokémon',   hp: 8,  maxHp: 8,  damage: 4, damageTier: 'heavy' },
  KINGAMBIT:    { name: 'Kingambit',    types: ['DARK','STEEL'],       team: 'violet',  emoji: '♚', img: SPRITE(983),  desc: 'Big Boss Pokémon',      hp: 10, maxHp: 10, damage: 4, damageTier: 'heavy' },
  HATTERENE:    { name: 'Hatterene',    types: ['PSYCHIC','FAIRY'],    team: 'violet',  emoji: '🧙', img: SPRITE(858),  desc: 'Silent Pokémon',        hp: 7,  maxHp: 7,  damage: 3, damageTier: 'standard' },
  // Violet pack-only
  PICHU:        { name: 'Pichu',        types: ['ELECTRIC'],           team: 'violet',  emoji: '⚡', img: SPRITE(172),  desc: 'Tiny Mouse Pokémon',    hp: 7,  maxHp: 7,  damage: 2, damageTier: 'weak' },
  RAICHU:       { name: 'Raichu',       types: ['ELECTRIC','PSYCHIC'], team: 'violet',  emoji: '⚡', img: SPRITE(26),   desc: 'Mouse Pokémon',         hp: 9,  maxHp: 9,  damage: 3, damageTier: 'standard' },
  AEGISLASH:    { name: 'Aegislash',    types: ['STEEL','GHOST'],      team: 'violet',  emoji: '🛡️', img: SPRITE(681),  desc: 'Royal Sword Pokémon',   hp: 8,  maxHp: 8,  damage: 4, damageTier: 'heavy' },
  ZOROARK:      { name: 'Zoroark',      types: ['DARK'],               team: 'violet',  emoji: '🦊', img: SPRITE(571),  desc: 'Illusion Fox Pokémon',  hp: 8,  maxHp: 8,  damage: 4, damageTier: 'heavy' },
  TOXAPEX:      { name: 'Toxapex',      types: ['POISON','WATER'],     team: 'violet',  emoji: '🌊', img: SPRITE(748),  desc: 'Brutal Star Pokémon',   hp: 8,  maxHp: 8,  damage: 2, damageTier: 'weak' },
};

// ─── Team Rosters ───────────────────────────────────────────────────

// Position-to-role mapping for back rank
export const BACK_RANK_ROLES = ['ROOK','KNIGHT','BISHOP','QUEEN','TRUE_KING','BISHOP','KNIGHT','ROOK'];

export const TEAMS = {
  scarlet: {
    name: 'Scarlet',
    color: '#E3350D',
    colorAlt: '#FF6B4A',
    bgGrad: 'linear-gradient(135deg, #E3350D22, #FF6B4A11)',
    backRank: ['RAGING_BOLT','SCREAM_TAIL','ROARING_MOON','FLUTTER_MANE','KORAIDON','ROARING_MOON','SCREAM_TAIL','RAGING_BOLT'],
    pawnPokemon: 'SANDY_SHOCKS',
    pawnRole: 'KING',
    pawnEmoji: '🧲',
    pawnName: 'Sandy Shocks',
  },
  violet: {
    name: 'Violet',
    color: '#6D28D9',
    colorAlt: '#A78BFA',
    bgGrad: 'linear-gradient(135deg, #6D28D922, #A78BFA11)',
    backRank: ['IRON_BOULDER','IRON_BUNDLE','IRON_JUGULIS','IRON_CROWN','MIRAIDON','IRON_JUGULIS','IRON_BUNDLE','IRON_BOULDER'],
    pawnPokemon: 'IRON_MOTH',
    pawnRole: 'KING',
    pawnEmoji: '🦋',
    pawnName: 'Iron Moth',
  },
};

// ─── Pokémon Pool (for individual slot swapping) ────────────────────
// Each entry: { key, requiredElo }

export const POKEMON_POOL = {
  scarlet: [
    { key: 'SANDY_SHOCKS', requiredElo: 0 },
    { key: 'FLUTTER_MANE', requiredElo: 0 },
    { key: 'RAGING_BOLT',  requiredElo: 0 },
    { key: 'ROARING_MOON', requiredElo: 0 },
    { key: 'SCREAM_TAIL',  requiredElo: 0 },
    { key: 'SCEPTILE',     requiredElo: 600 },
    { key: 'BLAZIKEN',     requiredElo: 700 },
    { key: 'GREAT_TUSK',   requiredElo: 800 },
    { key: 'BRUTE_BONNET', requiredElo: 800 },
    { key: 'CHARIZARD',    requiredElo: 900 },
    { key: 'SLITHER_WING', requiredElo: 1000 },
    { key: 'DRAGONITE',    requiredElo: 1000 },
    { key: 'WALKING_WAKE', requiredElo: 1100 },
    { key: 'GARCHOMP',     requiredElo: 1200 },
    { key: 'GOUGING_FIRE', requiredElo: 1300 },
    { key: 'GHOLDENGO',    requiredElo: 1400 },
    { key: 'CHI_YU',       requiredElo: 1600 },
    { key: 'MAGCARGO',     requiredElo: 1750 },
    { key: 'ZAPDOS',       requiredElo: 1900 },
    { key: 'COMFEY',       requiredElo: 1000 },
    { key: 'BELLIBOLT',    requiredElo: 700 },
    { key: 'ARCANINE',     requiredElo: 900 },
    { key: 'TYRANITAR',    requiredElo: 1400 },
    { key: 'SKELEDIRGE',   requiredElo: 1100 },
    { key: 'TINKATON',     requiredElo: 1200 },
    { key: 'IVYSAUR',      requiredElo: 800,  packOnly: true },
    { key: 'VENUSAUR',     requiredElo: 1300, packOnly: true },
    { key: 'SCIZOR',       requiredElo: 1200, packOnly: true },
    { key: 'VOLCANION',    requiredElo: 1000, packOnly: true },
    { key: 'LYCANROC',     requiredElo: 700,  packOnly: true },
  ],
  violet: [
    { key: 'IRON_MOTH',    requiredElo: 0 },
    { key: 'IRON_CROWN',   requiredElo: 0 },
    { key: 'IRON_BOULDER', requiredElo: 0 },
    { key: 'IRON_JUGULIS', requiredElo: 0 },
    { key: 'IRON_BUNDLE',  requiredElo: 0 },
    { key: 'SYLVEON',      requiredElo: 600 },
    { key: 'GARDEVOIR',    requiredElo: 700 },
    { key: 'IRON_TREADS',  requiredElo: 800 },
    { key: 'IRON_HANDS',   requiredElo: 800 },
    { key: 'GENGAR',       requiredElo: 900 },
    { key: 'IRON_THORNS',  requiredElo: 1000 },
    { key: 'METAGROSS',    requiredElo: 1000 },
    { key: 'IRON_VALIANT', requiredElo: 1100 },
    { key: 'LUCARIO',      requiredElo: 1200 },
    { key: 'IRON_LEAVES',  requiredElo: 1300 },
    { key: 'DRAGAPULT',    requiredElo: 1400 },
    { key: 'CHIEN_PAO',    requiredElo: 1600 },
    { key: 'BRAMBLEGHAST', requiredElo: 1750 },
    { key: 'INCINEROAR',   requiredElo: 1900 },
    { key: 'AUDINO',       requiredElo: 1000 },
    { key: 'MIMIKYU',      requiredElo: 700 },
    { key: 'TOXTRICITY',   requiredElo: 900 },
    { key: 'CERULEDGE',    requiredElo: 1100 },
    { key: 'KINGAMBIT',    requiredElo: 1400 },
    { key: 'HATTERENE',    requiredElo: 1200 },
    { key: 'PICHU',        requiredElo: 700,  packOnly: true },
    { key: 'RAICHU',       requiredElo: 1000, packOnly: true },
    { key: 'AEGISLASH',    requiredElo: 1200, packOnly: true },
    { key: 'ZOROARK',      requiredElo: 1000, packOnly: true },
    { key: 'TOXAPEX',      requiredElo: 1300, packOnly: true },
  ],
};

// ─── King Pool (alternative TRUE_KING Pokémon) ──────────────────────
// All True Kings are available on both teams
export const KING_POOL = {
  scarlet: [
    { key: 'KORAIDON',  requiredElo: 0 },
    { key: 'BULBASAUR', requiredElo: 2000 },
    { key: 'MIRAIDON',  requiredElo: 1000 },
    { key: 'PIKACHU',   requiredElo: 2000 },
  ],
  violet: [
    { key: 'MIRAIDON', requiredElo: 0 },
    { key: 'PIKACHU',  requiredElo: 2000 },
    { key: 'KORAIDON', requiredElo: 1000 },
    { key: 'BULBASAUR', requiredElo: 2000 },
  ],
};

// ─── Abilities (data-driven) ────────────────────────────────────────
// effect: 'damage' | 'status' | 'heal' | 'drain' | 'heal_allies'
// targets: 'adjacent_enemies' | 'random_1' | 'random_2' | 'self' | 'adjacent_allies' | 'adjacent_all'
// For 'drain': deals damage AND heals self. Negative heal = self-damage (Gengar Curse)

export const ABILITIES = {
  // ── Scarlet Team ──
  KORAIDON:     { name: 'Orichalcum Pulse', effect: 'damage',  damage: 3,         targets: 'adjacent_enemies', emoji: '☀️', color: '#e3350d' },
  SANDY_SHOCKS: { name: 'Electromagnet',   effect: 'status',  status: 'stunned', targets: 'random_1',         emoji: '🧲', color: '#f8d030' },
  FLUTTER_MANE: { name: 'Perish Song',     effect: 'damage',  damage: 2,         targets: 'adjacent_enemies', emoji: '💀', color: '#705898' },
  RAGING_BOLT:  { name: 'Thunderclap',     effect: 'damage',  damage: 3,         targets: 'random_1',         emoji: '⚡', color: '#f8d030' },
  ROARING_MOON: { name: 'Throat Chop',     effect: 'damage',  damage: 2,         targets: 'random_1',         emoji: '🌑', color: '#705848' },
  SCREAM_TAIL:  { name: 'Hyper Scream',    effect: 'status',  status: 'stunned', targets: 'adjacent_enemies', emoji: '😵', color: '#ff82c8' },
  GREAT_TUSK:   { name: 'Earthquake',      effect: 'damage',  damage: 1,         targets: 'adjacent_all',     emoji: '🏔️', color: '#e0c068' },
  BRUTE_BONNET: { name: 'Spore',           effect: 'status',  status: 'stunned', targets: 'random_1',         emoji: '🍄', color: '#a040a0' },
  SLITHER_WING: { name: 'First Impression',effect: 'damage',  damage: 3,         targets: 'random_1',         emoji: '💥', color: '#a8b820' },
  WALKING_WAKE: { name: 'Hydro Steam',     effect: 'drain',   damage: 1, heal: 1,targets: 'adjacent_enemies', emoji: '🌊', color: '#6890f0' },
  GOUGING_FIRE: { name: 'Burning Bulwark', effect: 'damage',  damage: 1,         targets: 'adjacent_enemies', emoji: '🔥', color: '#f08030' },
  BULBASAUR:    { name: 'Vine Drain',      effect: 'drain',   damage: 2, heal: 3,targets: 'adjacent_enemies', emoji: '☠️', color: '#50c030', bonusStatus: 'poisoned', bonusTargets: 'random_1' },
  CHARIZARD:    { name: 'Heat Wave',       effect: 'damage',  damage: 3,         targets: 'adjacent_enemies', emoji: '🔥', color: '#f08030' },
  DRAGONITE:    { name: 'Multiscale',      effect: 'heal',    heal: 2,           targets: 'self',             emoji: '💚', color: '#7038f8' },
  GARCHOMP:     { name: 'Rough Skin',      effect: 'damage',  damage: 1,         targets: 'adjacent_enemies', emoji: '🦈', color: '#e0c068' },
  BLAZIKEN:     { name: 'Blaze Kick',      effect: 'damage',  damage: 3,         targets: 'random_1',         emoji: '🦵', color: '#f08030' },
  SCEPTILE:     { name: 'Leech Seed',      effect: 'drain',   damage: 1, heal: 1,targets: 'adjacent_enemies', emoji: '🌿', color: '#78c850' },
  GHOLDENGO:    { name: 'Make It Rain',    effect: 'damage',  damage: 2,         targets: 'adjacent_enemies', emoji: '💰', color: '#f8d030' },
  CHI_YU:       { name: 'Ruination',       effect: 'damage',  damage: 4,         targets: 'random_1',         emoji: '🔥', color: '#f08030' },
  INCINEROAR:   { name: 'Intimidate',      effect: 'intimidate', duration: 5,    targets: 'adjacent_enemies', emoji: '💪', color: '#705848' },
  MAGCARGO:     { name: 'Lava Trail',      effect: 'lava_trail', damage: 3, duration: 5, targets: 'self',  emoji: '🌋', color: '#f08030' },
  COMFEY:       { name: 'Floral Healing',  effect: 'heal_allies', heal: 1,       targets: 'adjacent_allies',  emoji: '🌼', color: '#ee99ac' },
  BELLIBOLT:    { name: 'Electromorphosis',effect: 'status', status: 'paralyzed',targets: 'adjacent_enemies', emoji: '⚡', color: '#f8d030' },
  ARCANINE:     { name: 'Flamethrower',    effect: 'damage',  damage: 2,         targets: 'adjacent_enemies', emoji: '🔥', color: '#f08030' },
  TYRANITAR:    { name: 'Stone Edge',      effect: 'damage',  damage: 3,         targets: 'random_1',         emoji: '🪨', color: '#b8a038' },
  SKELEDIRGE:   { name: 'Torch Song',      effect: 'drain',   damage: 2, heal: 1,targets: 'adjacent_enemies', emoji: '🎵', color: '#f08030' },
  TINKATON:     { name: 'Gigaton Hammer',  effect: 'damage',  damage: 4,         targets: 'random_1',         emoji: '🔨', color: '#b8b8d0' },
  // Scarlet pack-only
  IVYSAUR:      { name: 'Razor Leaf',      effect: 'damage',  damage: 2,         targets: 'adjacent_enemies', emoji: '🍃', color: '#78c850' },
  VENUSAUR:     { name: 'Solar Beam',      effect: 'damage',  damage: 3,         targets: 'random_1',         emoji: '☀️', color: '#78c850', bonusStatus: 'poisoned', bonusTargets: 'random_1' },
  SCIZOR:       { name: 'Bullet Punch',    effect: 'damage',  damage: 3,         targets: 'random_1',         emoji: '👊', color: '#b8b8d0' },
  VOLCANION:    { name: 'Steam Eruption',  effect: 'damage',  damage: 2,         targets: 'adjacent_enemies', emoji: '💨', color: '#f08030' },
  LYCANROC:     { name: 'Accelerock',      effect: 'damage',  damage: 2,         targets: 'random_1',         emoji: '🪨', color: '#b8a038' },

  // ── Violet Team ──
  MIRAIDON:     { name: 'Hadron Engine',   effect: 'damage',  damage: 3,         targets: 'adjacent_enemies', emoji: '⚡', color: '#6d28d9' },
  IRON_MOTH:    { name: 'Fiery Dance',     effect: 'damage',  damage: 2,         targets: 'adjacent_enemies', emoji: '🔥', color: '#f08030' },
  IRON_CROWN:   { name: 'Tachyon Cutter',  effect: 'damage',  damage: 2,         targets: 'random_1',         emoji: '🔮', color: '#f85888' },
  IRON_BOULDER: { name: 'Mighty Cleave',   effect: 'damage',  damage: 2,         targets: 'random_1',         emoji: '⚔️', color: '#b8a038' },
  IRON_JUGULIS: { name: 'Dark Pulse',      effect: 'damage',  damage: 1,         targets: 'adjacent_enemies', emoji: '🌑', color: '#705848' },
  IRON_BUNDLE:  { name: 'Frost Breath',    effect: 'status',  status: 'frozen',  targets: 'adjacent_enemies', emoji: '❄️', color: '#64c8ff' },
  IRON_TREADS:  { name: 'Rapid Spin',      effect: 'heal',    heal: 1,           targets: 'self',             emoji: '💨', color: '#b8b8d0' },
  IRON_HANDS:   { name: 'Drain Punch',     effect: 'heal',    heal: 2,           targets: 'self',             emoji: '💪', color: '#c03028' },
  IRON_THORNS:  { name: 'Wild Charge',     effect: 'damage',  damage: 2,         targets: 'random_1',         emoji: '⚡', color: '#f8d030' },
  IRON_VALIANT: { name: 'Spirit Break',    effect: 'damage',  damage: 2,         targets: 'random_1',         emoji: '✨', color: '#ee99ac' },
  IRON_LEAVES:  { name: 'Psyblade',        effect: 'damage',  damage: 1,         targets: 'adjacent_enemies', emoji: '🍃', color: '#78c850' },
  PIKACHU:      { name: 'Thunder Shock',   effect: 'damage',  damage: 4,         targets: 'adjacent_enemies', emoji: '⚡', color: '#ffdc32', bonusStatus: 'paralyzed', bonusTargets: 'random_1' },
  GENGAR:       { name: 'Curse',           effect: 'drain',   damage: 2, heal:-1, targets: 'random_1',        emoji: '👻', color: '#705898' },
  METAGROSS:    { name: 'Meteor Mash',     effect: 'damage',  damage: 3,         targets: 'random_1',         emoji: '☄️', color: '#b8b8d0' },
  LUCARIO:      { name: 'Aura Sphere',     effect: 'damage',  damage: 2,         targets: 'random_1',         emoji: '💙', color: '#6890f0' },
  GARDEVOIR:    { name: 'Heal Pulse',      effect: 'heal_allies', heal: 2,       targets: 'adjacent_allies',  emoji: '💖', color: '#ee99ac' },
  SYLVEON:      { name: 'Draining Kiss',   effect: 'drain',   damage: 1, heal: 1,targets: 'random_1',         emoji: '💋', color: '#ee99ac' },
  DRAGAPULT:    { name: 'Phantom Force',   effect: 'damage',  damage: 2,         targets: 'adjacent_enemies', emoji: '👻', color: '#705898' },
  CHIEN_PAO:    { name: 'Sword of Ruin',   effect: 'damage',  damage: 3,         targets: 'random_1',         emoji: '❄️', color: '#64c8ff', bonusStatus: 'frozen', bonusTargets: 'random_1' },
  ZAPDOS:       { name: 'Static Storm',    effect: 'damage',  damage: 3,         targets: 'radius_2_enemies', emoji: '⚡', color: '#f8d030', bonusStatus: 'paralyzed', bonusTargets: 'random_1' },
  BRAMBLEGHAST: { name: 'Thorny Trap',     effect: 'counter', damage: 2,         targets: 'self',             emoji: '🌿', color: '#78c850' },
  AUDINO:       { name: 'Heal Pulse',      effect: 'heal_allies', heal: 1,       targets: 'adjacent_allies',  emoji: '💖', color: '#ee99ac' },
  MIMIKYU:      { name: 'Play Rough',      effect: 'damage',  damage: 2,         targets: 'random_1',         emoji: '🎭', color: '#ee99ac' },
  TOXTRICITY:   { name: 'Overdrive',       effect: 'damage',  damage: 2,         targets: 'adjacent_enemies', emoji: '🎸', color: '#a040a0' },
  CERULEDGE:    { name: 'Bitter Blade',    effect: 'drain',   damage: 3, heal: 1,targets: 'random_1',         emoji: '🗡️', color: '#705898' },
  KINGAMBIT:    { name: 'Kowtow Cleave',   effect: 'damage',  damage: 3,         targets: 'random_1',         emoji: '⚔️', color: '#705848' },
  HATTERENE:    { name: 'Psyshock',        effect: 'damage',  damage: 2,         targets: 'adjacent_enemies', emoji: '🔮', color: '#f85888' },
  // Violet pack-only
  PICHU:        { name: 'Charm',           effect: 'status',  status: 'stunned', targets: 'random_1',         emoji: '🥺', color: '#f8d030' },
  RAICHU:       { name: 'Thunderbolt',     effect: 'damage',  damage: 3,         targets: 'random_1',         emoji: '⚡', color: '#f8d030', bonusStatus: 'paralyzed', bonusTargets: 'random_1' },
  AEGISLASH:    { name: "King's Shield",   effect: 'heal',    heal: 2,           targets: 'self',             emoji: '🛡️', color: '#b8b8d0' },
  ZOROARK:      { name: 'Night Daze',      effect: 'damage',  damage: 2,         targets: 'adjacent_enemies', emoji: '🌑', color: '#705848' },
  TOXAPEX:      { name: 'Toxic',           effect: 'status',  status: 'poisoned',targets: 'adjacent_enemies', emoji: '☠️', color: '#a040a0' },
};

// White = Scarlet, Black = Violet
export const COLOR_TO_TEAM = { white: 'scarlet', black: 'violet' };

// ─── Effectiveness Helpers ──────────────────────────────────────────

/**
 * Get single-type effectiveness
 */
function singleTypeEff(atkType, defType) {
  return C[atkType]?.[defType] ?? 1;
}

/**
 * Calculate effectiveness of one attack type against a dual-typed defender
 * @returns {number} Combined multiplier (e.g., 4, 2, 1, 0.5, 0.25, 0)
 */
function calcEffVsDefender(atkType, defTypes) {
  let mult = 1;
  for (const dt of defTypes) {
    mult *= singleTypeEff(atkType, dt);
  }
  return mult;
}

/**
 * Get the best attack type and its effectiveness for an attacker vs defender
 * The attacker automatically uses whichever of its types is most effective.
 *
 * @param {string[]} attackerTypes - e.g. ['FIGHTING', 'DRAGON']
 * @param {string[]} defenderTypes - e.g. ['ICE', 'WATER']
 * @returns {{ attackType: string, multiplier: number, label: string, description: string }}
 */
export function getEffectiveness(attackerTypes, defenderTypes) {
  let bestType = attackerTypes[0];
  let bestMult = calcEffVsDefender(attackerTypes[0], defenderTypes);

  if (attackerTypes.length > 1) {
    const altMult = calcEffVsDefender(attackerTypes[1], defenderTypes);
    if (altMult > bestMult) {
      bestType = attackerTypes[1];
      bestMult = altMult;
    }
  }

  let label, description;
  if (bestMult >= 2) {
    label = 'super_effective';
    description = bestMult >= 4 ? "It's ultra effective!!" : "It's super effective!";
  } else if (bestMult === 1) {
    label = 'normal';
    description = 'A standard hit.';
  } else if (bestMult > 0) {
    label = 'not_very_effective';
    description = "It's not very effective...";
  } else {
    label = 'no_effect';
    description = 'It has no effect!';
  }

  return { attackType: bestType, multiplier: bestMult, label, description };
}

/**
 * Get type info
 */
export function getTypeInfo(typeKey) {
  return TYPES[typeKey] ?? null;
}

/**
 * Get the primary color for a Pokémon (uses first type color)
 */
export function getPokemonColor(pokemonKey) {
  const pkmn = POKEMON[pokemonKey];
  if (!pkmn) return '#888';
  return TYPES[pkmn.types[0]]?.color ?? '#888';
}
