/**
 * Board State Management for PokéChess
 * 8×8 board with Paradox Pokémon pieces
 */

import { POKEMON, TEAMS, COLOR_TO_TEAM, BACK_RANK_ROLES } from './types.js';

// ─── Piece Roles ────────────────────────────────────────────────────

export const ROLES = {
  TRUE_KING: { name: 'True King', value: 999, isLoseCondition: true },
  KING:      { name: 'King',      value: 5,   isLoseCondition: false },
  QUEEN:     { name: 'Queen',     value: 9,   isLoseCondition: false },
  ROOK:      { name: 'Rook',      value: 5,   isLoseCondition: false },
  BISHOP:    { name: 'Bishop',    value: 3,   isLoseCondition: false },
  KNIGHT:    { name: 'Knight',    value: 3,   isLoseCondition: false },
  PAWN:      { name: 'Pawn',      value: 1,   isLoseCondition: false },
};

export const ROLE_KEYS = Object.keys(ROLES);

// ─── Piece Creation ─────────────────────────────────────────────────

/**
 * Create a piece with full Pokémon data
 * Role is determined by board position, NOT by the Pokémon's default role.
 */
export function createPiece(color, roleKey, pokemonKey, id, upgradeLevels = {}) {
  const pkmn = POKEMON[pokemonKey];

  // Calculate upgrade bonuses (progressive: each level gives more)
  const level = upgradeLevels[pokemonKey] || 1;
  const HP_TABLE =  [0, 1, 3, 5, 8];
  const DMG_TABLE = [0, 1, 2, 4, 6];
  const idx = Math.min(level, 5) - 1;
  const hpBonus = HP_TABLE[idx] || 0;
  const dmgBonus = DMG_TABLE[idx] || 0;

  const baseHp = (pkmn?.hp ?? 5) + hpBonus;
  const baseDmg = (pkmn?.damage ?? 2) + dmgBonus;

  const piece = {
    color,
    role: roleKey,
    pokemon: pokemonKey,
    types: pkmn ? [...pkmn.types] : ['NORMAL'],
    id,
    hasMoved: false,
    bikeMode: false,
    // HP-based combat stats (with upgrades applied)
    hp: baseHp,
    maxHp: baseHp,
    damage: baseDmg,
    damageTier: pkmn?.damageTier ?? 'weak',
    // Status effects
    statusEffect: null,     // 'frozen' | 'stunned' | null
    // Track upgrade level for display
    upgradeLevel: upgradeBonus.hp > 0 ? (upgradeBonus.hp + 1) : 0,
  };
  // True Kings get bike mode cooldown
  if (roleKey === 'TRUE_KING') {
    piece.bikeCooldown = 0;
  }
  // Flutter Mane / Iron Crown get optional attack cooldown
  if (pokemonKey === 'FLUTTER_MANE' || pokemonKey === 'IRON_CROWN') {
    piece.optionalAttackCooldown = 0;
  }
  return piece;
}

// ─── Board Setup ────────────────────────────────────────────────────

export function createEmptyBoard() {
  return Array.from({ length: 8 }, () => Array(8).fill(null));
}

/**
 * Initialize the board with Scarlet (white) vs Violet (black) teams
 * Roles are assigned by POSITION (BACK_RANK_ROLES), not by Pokémon data.
 * @param {object} presets - Optional { scarlet: preset, violet: preset } to override team rosters
 */
export function initBoard(presets = {}, upgradeLevels = {}) {
  const board = createEmptyBoard();
  let id = 0;

  // Resolve team configs (preset overrides > defaults)
  const violetConfig = {
    backRank: presets.violet?.backRank ?? TEAMS.violet.backRank,
    pawnPokemon: presets.violet?.pawnPokemon ?? TEAMS.violet.pawnPokemon,
    pawnRole: presets.violet?.pawnRole ?? TEAMS.violet.pawnRole ?? 'PAWN',
  };
  const scarletConfig = {
    backRank: presets.scarlet?.backRank ?? TEAMS.scarlet.backRank,
    pawnPokemon: presets.scarlet?.pawnPokemon ?? TEAMS.scarlet.pawnPokemon,
    pawnRole: presets.scarlet?.pawnRole ?? TEAMS.scarlet.pawnRole ?? 'PAWN',
  };

  // ── Black / Violet back rank (row 0) ──
  for (let col = 0; col < 8; col++) {
    const pokemonKey = violetConfig.backRank[col];
    const role = BACK_RANK_ROLES[col];
    board[0][col] = createPiece('black', role, pokemonKey, `b${id++}`, upgradeLevels);
  }

  // ── Black front rank (row 1) ──
  for (let col = 0; col < 8; col++) {
    const p = createPiece('black', violetConfig.pawnRole, violetConfig.pawnPokemon, `b${id++}`, upgradeLevels);
    p.isPawn = true;
    board[1][col] = p;
  }

  // ── White front rank (row 6) ──
  for (let col = 0; col < 8; col++) {
    const p = createPiece('white', scarletConfig.pawnRole, scarletConfig.pawnPokemon, `w${id++}`, upgradeLevels);
    p.isPawn = true;
    board[6][col] = p;
  }

  // ── White / Scarlet back rank (row 7) ──
  for (let col = 0; col < 8; col++) {
    const pokemonKey = scarletConfig.backRank[col];
    const role = BACK_RANK_ROLES[col];
    board[7][col] = createPiece('white', role, pokemonKey, `w${id++}`, upgradeLevels);
  }

  return board;
}

// ─── Board Operations (immutable) ───────────────────────────────────

export function getPiece(board, row, col) {
  if (row < 0 || row > 7 || col < 0 || col > 7) return null;
  return board[row][col];
}

export function movePiece(board, fromRow, fromCol, toRow, toCol) {
  const newBoard = cloneBoard(board);
  const piece = { ...newBoard[fromRow][fromCol], hasMoved: true };
  newBoard[fromRow][fromCol] = null;
  newBoard[toRow][toCol] = piece;
  return newBoard;
}

export function removePiece(board, row, col) {
  const newBoard = cloneBoard(board);
  newBoard[row][col] = null;
  return newBoard;
}

export function cloneBoard(board) {
  return board.map(row => row.map(cell => cell ? { ...cell } : null));
}

export function findTrueKing(board, color) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.color === color && p.role === 'TRUE_KING') {
        return { row: r, col: c };
      }
    }
  }
  return null;
}

export function trueKingExists(board, color) {
  return findTrueKing(board, color) !== null;
}

/**
 * Promote a pawn to a new role.
 * The promoted piece takes on the Pokémon identity of that role for its team.
 */
export function promotePawn(board, row, col, newRole) {
  const newBoard = cloneBoard(board);
  const piece = newBoard[row][col];
  if (!piece || piece.role !== 'PAWN') return newBoard;

  const team = TEAMS[COLOR_TO_TEAM[piece.color]];
  // Find the Pokémon that matches this role for this team
  const pokemonKey = findPokemonForRole(piece.color, newRole);
  const pkmn = POKEMON[pokemonKey];

  newBoard[row][col] = {
    ...piece,
    role: newRole,
    pokemon: pokemonKey,
    types: pkmn ? [...pkmn.types] : piece.types,
  };

  return newBoard;
}

/**
 * Find the Pokémon key for a given role and color.
 * Uses the BACK_RANK_ROLES mapping to find which Pokémon fills that role.
 */
function findPokemonForRole(color, role) {
  const teamKey = COLOR_TO_TEAM[color];
  const team = TEAMS[teamKey];
  // Find the first position in the back rank with this role
  for (let i = 0; i < BACK_RANK_ROLES.length; i++) {
    if (BACK_RANK_ROLES[i] === role) {
      return team.backRank[i];
    }
  }
  return null;
}
