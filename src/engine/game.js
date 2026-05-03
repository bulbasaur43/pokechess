/**
 * Game State Machine for PokéChess — HP-Based Combat
 * Phases: TITLE → PLAY → GAME_OVER
 * Features: HP combat, bike mode cooldown, optional attacks, chess clock, promotions
 */

import { initBoard, movePiece, removePiece, promotePawn, trueKingExists, cloneBoard, getPiece, ROLES } from './board.js';
import { getLegalMoves } from './moves.js';
import { resolveBattle, getBattlePreview } from './battle.js';
import { POKEMON, TEAMS, COLOR_TO_TEAM, ABILITIES, getTypeMultiplier } from './types.js';

export const PHASES = {
  TITLE: 'TITLE',
  PLAY: 'PLAY',
  GAME_OVER: 'GAME_OVER',
};

export const TIME_PRESETS = {
  short:  { label: 'Short (10 min)',  ms: 10 * 60 * 1000 },
  medium: { label: 'Medium (25 min)', ms: 25 * 60 * 1000 },
  long:   { label: 'Long (45 min)',   ms: 45 * 60 * 1000 },
};

/**
 * Create a new game
 */
export function createGame() {
  return {
    phase: PHASES.TITLE,
    currentPlayer: 'white',
    board: null,
    capturedPieces: { white: [], black: [] },
    moveLog: [],
    enPassantTarget: null,
    bonusMoveActive: false,
    selectedPiece: null,
    legalMoves: [],
    winner: null,
    turnCount: 0,
    pendingPromotion: null,
    lastBattleResult: null,
    lastMove: null,
    lastAbility: null,
    statusMessage: null,
    // Chess clock
    clock: { white: 0, black: 0 },
    clockPreset: 'medium',
    clockRunning: false,
    // Optional attack state (Flutter Mane / Iron Crown)
    pendingOptionalAttack: null,
    // Lava trail hazards (Magcargo)
    lavaTrails: [],
    // Player & AI config
    playerColor: 'white',   // 'white' = scarlet/ancient, 'black' = violet/future
    aiColor: 'black',
    aiDifficulty: 'medium', // 'easy' | 'medium' | 'hard' | 'expert'
    isAIGame: false,
  };
}

/**
 * Start the game with a given time preset
 */
export function startGame(game, clockPreset = 'medium', options = {}) {
  const timeMs = TIME_PRESETS[clockPreset]?.ms ?? TIME_PRESETS.medium.ms;
  const playerColor = options.playerColor ?? 'white';
  const aiColor = playerColor === 'white' ? 'black' : 'white';
  const aiDifficulty = options.aiDifficulty ?? 'medium';
  const isAIGame = options.isAIGame ?? false;
  const teamPresets = options.teamPresets ?? {};
  const upgradeLevels = options.upgradeLevels ?? {};

  return {
    ...game,
    phase: PHASES.PLAY,
    board: initBoard(teamPresets, upgradeLevels),
    currentPlayer: 'white',
    turnCount: 1,
    capturedPieces: { white: [], black: [] },
    moveLog: [],
    enPassantTarget: null,
    bonusMoveActive: false,
    selectedPiece: null,
    legalMoves: [],
    winner: null,
    pendingPromotion: null,
    lastBattleResult: null,
    lastMove: null,
    lastAbility: null,
    statusMessage: null,
    clock: { white: timeMs, black: timeMs },
    clockPreset,
    clockRunning: true,
    pendingOptionalAttack: null,
    lavaTrails: [],
    playerColor,
    aiColor,
    aiDifficulty,
    isAIGame,
  };
}

/**
 * Select a piece on the board
 */
export function selectPiece(game, row, col) {
  const piece = game.board[row]?.[col];
  if (!piece || piece.color !== game.currentPlayer) {
    return { ...game, selectedPiece: null, legalMoves: [], statusMessage: null };
  }

  // Frozen or stunned pieces cannot move (poisoned/paralyzed CAN move)
  if (piece.statusEffect === 'frozen' || piece.statusEffect === 'stunned') {
    return {
      ...game,
      selectedPiece: null,
      legalMoves: [],
      statusMessage: `${POKEMON[piece.pokemon]?.name ?? 'This piece'} is ${piece.statusEffect}! It can't move this turn.`,
    };
  }

  return {
    ...game,
    selectedPiece: { row, col },
    legalMoves: getLegalMoves(game.board, row, col, game.enPassantTarget),
    statusMessage: null,
  };
}

export function deselectPiece(game) {
  return { ...game, selectedPiece: null, legalMoves: [], statusMessage: null };
}

/**
 * Execute a move (may trigger HP-based battle)
 * @returns {{ game: Object, battleResult?: Object }}
 */
export function executeMove(game, toRow, toCol) {
  if (!game.selectedPiece) return { game };

  const { row: fromRow, col: fromCol } = game.selectedPiece;
  const move = game.legalMoves.find(m => m.row === toRow && m.col === toCol);
  if (!move) return { game };

  let newGame = {
    ...game,
    capturedPieces: { white: [...game.capturedPieces.white], black: [...game.capturedPieces.black] },
    moveLog: [...game.moveLog],
    selectedPiece: null,
    legalMoves: [],
    lastBattleResult: null,
    lastAbility: null,
    lastMove: { from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol } },
    pendingOptionalAttack: null,
  };

  const attacker = { ...game.board[fromRow][fromCol] };
  let battleResult = null;

  // ── Castling ──
  if (move.moveType === 'castle_king' || move.moveType === 'castle_queen' ||
      move.special === 'castle_king' || move.special === 'castle_queen') {
    const castleType = move.moveType || move.special;
    newGame = executeCastle(newGame, fromRow, fromCol, castleType);
    newGame = endTurn(newGame);
    return { game: newGame };
  }

  // ── Capture (HP-based combat) ──
  if (move.isCapture) {
    let defRow = toRow, defCol = toCol;
    if (move.special === 'en_passant') {
      defRow = fromRow;
      defCol = toCol;
    }

    const defender = game.board[defRow][defCol];
    if (!defender) {
      newGame.board = movePiece(game.board, fromRow, fromCol, toRow, toCol);
      newGame = endTurn(newGame);
      return { game: newGame };
    }

    // Toggle bike mode for True Kings when they attack
    if (attacker.role === 'TRUE_KING') {
      attacker.bikeMode = !attacker.bikeMode;
    }

    // ── HP Battle Resolution ──
    battleResult = resolveBattle(attacker, defender);
    newGame.lastBattleResult = battleResult;
    newGame.moveLog.push({
      turn: game.turnCount,
      player: game.currentPlayer,
      from: { row: fromRow, col: fromCol },
      to: { row: toRow, col: toCol },
      attacker: { ...attacker },
      defender: { ...defender },
      result: battleResult,
    });

    if (battleResult.outcome === 'kill') {
      // Defender eliminated — attacker takes the square
      newGame.capturedPieces[defender.color].push(defender);

      if (move.special === 'en_passant') {
        newGame.board = removePiece(game.board, defRow, defCol);
        newGame.board = movePiece(newGame.board, fromRow, fromCol, toRow, toCol);
      } else {
        newGame.board = movePiece(game.board, fromRow, fromCol, toRow, toCol);
      }

      // Update attacker's bike mode on the board
      if (attacker.role === 'TRUE_KING') {
        const movedPiece = newGame.board[toRow][toCol];
        if (movedPiece) {
          newGame.board[toRow][toCol] = { ...movedPiece, bikeMode: attacker.bikeMode };
        }
      }

      // True King killed → game over
      if (defender.role === 'TRUE_KING') {
        newGame.phase = PHASES.GAME_OVER;
        newGame.winner = attacker.color;
        newGame.clockRunning = false;
        return { game: newGame, battleResult };
      }

      // Pawn promotion (any isPawn piece reaching the end)
      const promoRow = attacker.color === 'white' ? 0 : 7;
      if (newGame.board[toRow]?.[toCol]?.isPawn && toRow === promoRow) {
        newGame = applyPromotion(newGame, toRow, toCol);
      }

      newGame = endTurn(newGame);

      // Magcargo lava trail: place lava on the square it left
      newGame = placeLavaTrail(newGame, fromRow, fromCol, toRow, toCol, attacker);

      // Apply lava damage if attacker landed on a lava trail
      newGame = applyLavaDamage(newGame, toRow, toCol);

      // Apply special abilities
      newGame = applySpecialAbilities(newGame, toRow, toCol, fromRow, fromCol);

      // Apply counter damage (Brambleghast thorns)
      if (battleResult.counterDamage > 0) {
        newGame = applyCounterDamage(newGame, toRow, toCol, battleResult.counterDamage, attacker);
      }

      // Check if ability or counter killed a TRUE_KING
      if (!trueKingExists(newGame.board, 'white')) {
        newGame.phase = PHASES.GAME_OVER;
        newGame.winner = 'black';
        newGame.clockRunning = false;
      } else if (!trueKingExists(newGame.board, 'black')) {
        newGame.phase = PHASES.GAME_OVER;
        newGame.winner = 'white';
        newGame.clockRunning = false;
      }

    } else if (battleResult.outcome === 'damage') {
      // Defender survives — update defender HP, attacker stays in place
      newGame.board = cloneBoard(game.board);
      // Update defender HP on the board
      const updatedDefender = { ...defender, hp: battleResult.defenderHpAfter };
      // Consume Focus Sash if it triggered
      if (battleResult.focusSashTriggered) updatedDefender.focusSash = false;
      newGame.board[defRow][defCol] = updatedDefender;
      // Update attacker bike mode
      if (attacker.role === 'TRUE_KING') {
        newGame.board[fromRow][fromCol] = { ...attacker, hasMoved: true };
      }
      newGame = endTurn(newGame);

      // Attacker still triggers ability from their position on attack
      newGame = applySpecialAbilities(newGame, fromRow, fromCol, fromRow, fromCol);

      // Apply counter damage (Brambleghast thorns)
      if (battleResult.counterDamage > 0) {
        newGame = applyCounterDamage(newGame, fromRow, fromCol, battleResult.counterDamage, attacker);
      }

      // Check if ability or counter killed a TRUE_KING
      if (!trueKingExists(newGame.board, 'white')) {
        newGame.phase = PHASES.GAME_OVER;
        newGame.winner = 'black';
        newGame.clockRunning = false;
      } else if (!trueKingExists(newGame.board, 'black')) {
        newGame.phase = PHASES.GAME_OVER;
        newGame.winner = 'white';
        newGame.clockRunning = false;
      }
    }

  } else {
    // ── Non-capture move ──
    if (attacker.role === 'TRUE_KING') {
      attacker.bikeMode = !attacker.bikeMode;
    }

    newGame.board = movePiece(game.board, fromRow, fromCol, toRow, toCol);

    // Update bike mode on moved piece
    if (attacker.role === 'TRUE_KING') {
      newGame.board[toRow][toCol] = { ...newGame.board[toRow][toCol], bikeMode: attacker.bikeMode };
    }

    if (move.special === 'double_push') {
      const epRow = attacker.color === 'white' ? toRow + 1 : toRow - 1;
      newGame.enPassantTarget = { row: epRow, col: toCol };
    } else {
      newGame.enPassantTarget = null;
    }

    // Pawn promotion (any isPawn piece reaching the end)
    const promoRow = attacker.color === 'white' ? 0 : 7;
    if (newGame.board[toRow]?.[toCol]?.isPawn && toRow === promoRow) {
      newGame = applyPromotion(newGame, toRow, toCol);
    }

    newGame = endTurn(newGame);

    // Magcargo lava trail: place lava on the square it left
    newGame = placeLavaTrail(newGame, fromRow, fromCol, toRow, toCol, attacker);

    // Apply lava damage if piece landed on a lava trail
    newGame = applyLavaDamage(newGame, toRow, toCol);

    // Apply special abilities
    newGame = applySpecialAbilities(newGame, toRow, toCol, fromRow, fromCol);

    // Check if ability killed a TRUE_KING
    if (!trueKingExists(newGame.board, 'white')) {
      newGame.phase = PHASES.GAME_OVER;
      newGame.winner = 'black';
      newGame.clockRunning = false;
    } else if (!trueKingExists(newGame.board, 'black')) {
      newGame.phase = PHASES.GAME_OVER;
      newGame.winner = 'white';
      newGame.clockRunning = false;
    }

    // Check for optional attack (Flutter Mane / Iron Crown)
    newGame = checkOptionalAttack(newGame, toRow, toCol);
  }

  return { game: newGame, battleResult };
}

/**
 * Execute an optional attack (Flutter Mane / Iron Crown)
 */
export function executeOptionalAttack(game, targetRow, targetCol) {
  if (!game.pendingOptionalAttack) return { game };

  const { row, col } = game.pendingOptionalAttack;
  const attacker = game.board[row]?.[col];
  const defender = game.board[targetRow]?.[targetCol];

  if (!attacker || !defender) return { game: { ...game, pendingOptionalAttack: null } };

  const battleResult = resolveBattle(attacker, defender);
  let newGame = {
    ...game,
    pendingOptionalAttack: null,
    lastBattleResult: battleResult,
    moveLog: [...game.moveLog, {
      turn: game.turnCount,
      player: game.currentPlayer,
      from: { row, col },
      to: { row: targetRow, col: targetCol },
      attacker: { ...attacker },
      defender: { ...defender },
      result: battleResult,
    }],
  };

  // Set cooldown on the attacker
  const updatedAttacker = { ...attacker, optionalAttackCooldown: 1 };

  if (battleResult.outcome === 'kill') {
    newGame.capturedPieces = {
      ...newGame.capturedPieces,
      [defender.color]: [...newGame.capturedPieces[defender.color], defender],
    };
    newGame.board = cloneBoard(game.board);
    newGame.board[targetRow][targetCol] = null;
    newGame.board[row][col] = updatedAttacker;

    if (defender.role === 'TRUE_KING') {
      newGame.phase = PHASES.GAME_OVER;
      newGame.winner = attacker.color;
      newGame.clockRunning = false;
    }
  } else {
    // Damage only — defender survives
    newGame.board = cloneBoard(game.board);
    newGame.board[targetRow][targetCol] = {
      ...defender,
      hp: battleResult.defenderHpAfter,
      ...(battleResult.focusSashTriggered ? { focusSash: false } : {}),
    };
    newGame.board[row][col] = updatedAttacker;
  }

  return { game: newGame, battleResult };
}

export function skipOptionalAttack(game) {
  return { ...game, pendingOptionalAttack: null };
}

/**
 * Apply pawn promotion: +4 HP, +2 damage, full heal, role → QUEEN
 */
export function applyPromotion(game, row, col) {
  const newBoard = cloneBoard(game.board);
  const piece = newBoard[row][col];
  if (!piece) return game;

  const newMaxHp = piece.maxHp + 4;
  newBoard[row][col] = {
    ...piece,
    maxHp: newMaxHp,
    hp: newMaxHp,              // Full heal
    damage: piece.damage + 2,
    role: 'QUEEN',             // Gains queen movement
    promoted: true,
    isPawn: false,             // No longer a pawn
  };

  return {
    ...game,
    board: newBoard,
    statusMessage: `👑 ${POKEMON[piece.pokemon]?.name} promoted! +4 HP, +2 Damage, moves like a Queen!`,
  };
}

/**
 * Check if a Flutter Mane / Iron Crown can perform an optional attack
 */
function checkOptionalAttack(game, row, col) {
  const piece = game.board[row]?.[col];
  if (!piece) return game;
  if (piece.pokemon !== 'FLUTTER_MANE' && piece.pokemon !== 'IRON_CROWN') return game;
  if (piece.optionalAttackCooldown && piece.optionalAttackCooldown > 0) return game;

  // Find adjacent enemies
  const dirs = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  const targets = [];
  for (const [dr, dc] of dirs) {
    const r = row + dr, c = col + dc;
    if (r < 0 || r > 7 || c < 0 || c > 7) continue;
    const target = game.board[r][c];
    if (target && target.color !== piece.color) {
      targets.push({ row: r, col: c });
    }
  }

  if (targets.length > 0) {
    return { ...game, pendingOptionalAttack: { row, col, targets } };
  }
  return game;
}

/**
 * Handle castling
 */
function executeCastle(game, kingRow, kingCol, castleType) {
  let newBoard = cloneBoard(game.board);
  const king = { ...newBoard[kingRow][kingCol], hasMoved: true };

  if (castleType === 'castle_king') {
    const rook = { ...newBoard[kingRow][7], hasMoved: true };
    newBoard[kingRow][kingCol] = null;
    newBoard[kingRow][7] = null;
    newBoard[kingRow][6] = king;
    newBoard[kingRow][5] = rook;
  } else {
    const rook = { ...newBoard[kingRow][0], hasMoved: true };
    newBoard[kingRow][kingCol] = null;
    newBoard[kingRow][0] = null;
    newBoard[kingRow][2] = king;
    newBoard[kingRow][3] = rook;
  }
  return { ...game, board: newBoard, enPassantTarget: null };
}

/**
 * End the current turn
 */
function endTurn(game) {
  const newGame = { ...game };

  // Quick Claw: skip turn swap (extra turn), then consume
  if (newGame.quickClaw && newGame.quickClaw === game.currentPlayer) {
    newGame.quickClaw = null;
    newGame.statusMessage = '⚡ Quick Claw! Extra turn!';
    // Don't swap turns — same player goes again
  } else {
    newGame.currentPlayer = game.currentPlayer === 'white' ? 'black' : 'white';
    if (newGame.currentPlayer === 'white') {
      newGame.turnCount = game.turnCount + 1;
    }
  }

  // Clear status effects from pieces of the player who is NOW taking their turn
  newGame.board = clearStatusEffects(newGame.board, newGame.currentPlayer);

  // Decrement bike cooldowns and optional attack cooldowns
  newGame.board = tickCooldowns(newGame.board, newGame.currentPlayer);

  // Tick down intimidate timers on ALL pieces (not color-specific)
  newGame.board = tickIntimidateTimers(newGame.board);

  // Tick down lava trails (only once per full round, not every half-turn)
  if (newGame.currentPlayer === 'white') {
    newGame.lavaTrails = tickLavaTrails(newGame.lavaTrails);
    // Tick poison & paralysis damage on all affected pieces (once per full round)
    newGame.board = tickStatusDamage(newGame.board);
  }

  return newGame;
}

/**
 * Tick down cooldowns for pieces of the given color
 */
function tickCooldowns(board, color) {
  const newBoard = cloneBoard(board);
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = newBoard[r][c];
      if (p && p.color === color) {
        if (p.bikeCooldown > 0) {
          newBoard[r][c] = { ...p, bikeCooldown: p.bikeCooldown - 1 };
        }
        if (p.optionalAttackCooldown > 0) {
          newBoard[r][c] = { ...newBoard[r][c], optionalAttackCooldown: p.optionalAttackCooldown - 1 };
        }
      }
    }
  }
  return newBoard;
}

// ─── Special Abilities (data-driven) ────────────────────────────────

const ADJACENT_DIRS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];

function applySpecialAbilities(game, row, col, fromRow, fromCol) {
  const piece = game.board[row]?.[col];
  if (!piece) return game;

  const ability = ABILITIES[piece.pokemon];
  if (!ability) return game;

  // Counter and lava_trail are passive — don't trigger on move
  if (ability.effect === 'counter' || ability.effect === 'lava_trail') return game;

  const newBoard = cloneBoard(game.board);
  const self = newBoard[row][col];
  const affected = [];

  // Gather adjacent targets
  const adjEnemies = [];
  const adjAllies = [];
  const adjAll = [];
  for (const [dr, dc] of ADJACENT_DIRS) {
    const r = row + dr, c = col + dc;
    if (r < 0 || r > 7 || c < 0 || c > 7) continue;
    const target = newBoard[r][c];
    if (!target) continue;
    adjAll.push({ r, c, target });
    if (target.color !== piece.color) adjEnemies.push({ r, c, target });
    else adjAllies.push({ r, c, target });
  }

  // Gather radius-2 enemies (Chebyshev distance <= 2)
  const radius2Enemies = [];
  if (ability.targets === 'radius_2_enemies') {
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        if (dr === 0 && dc === 0) continue;
        const r = row + dr, c = col + dc;
        if (r < 0 || r > 7 || c < 0 || c > 7) continue;
        const target = newBoard[r][c];
        if (target && target.color !== piece.color) {
          radius2Enemies.push({ r, c, target });
        }
      }
    }
  }

  // Select targets based on targeting mode
  let targets = [];
  if (ability.targets === 'adjacent_enemies') targets = adjEnemies;
  else if (ability.targets === 'adjacent_all') targets = adjAll;
  else if (ability.targets === 'adjacent_allies') targets = adjAllies;
  else if (ability.targets === 'random_1') targets = pickRandom(adjEnemies, 1);
  else if (ability.targets === 'random_2') targets = pickRandom(adjEnemies, 2);
  else if (ability.targets === 'radius_2_enemies') targets = radius2Enemies;
  else if (ability.targets === 'self') targets = [];

  // Apply effects
  if (ability.effect === 'damage') {
    for (const t of targets) {
      const newHp = Math.max(0, t.target.hp - ability.damage);
      if (newHp <= 0) { newBoard[t.r][t.c] = null; }
      else { newBoard[t.r][t.c] = { ...t.target, hp: newHp }; }
      affected.push({ row: t.r, col: t.c, name: t.target.pokemon, damage: ability.damage });
    }
  } else if (ability.effect === 'status') {
    for (const t of targets) {
      if (!t.target.statusEffect) {
        newBoard[t.r][t.c] = { ...t.target, statusEffect: ability.status };
        affected.push({ row: t.r, col: t.c, name: t.target.pokemon });
      }
    }
  } else if (ability.effect === 'heal') {
    // Heal self
    const newHp = Math.min(self.maxHp, self.hp + ability.heal);
    if (newHp !== self.hp) {
      newBoard[row][col] = { ...self, hp: newHp };
      affected.push({ row, col, name: self.pokemon, healed: newHp - self.hp });
    }
  } else if (ability.effect === 'drain') {
    // Damage targets + heal self
    for (const t of targets) {
      const newHp = Math.max(0, t.target.hp - ability.damage);
      if (newHp <= 0) { newBoard[t.r][t.c] = null; }
      else { newBoard[t.r][t.c] = { ...t.target, hp: newHp }; }
      affected.push({ row: t.r, col: t.c, name: t.target.pokemon, damage: ability.damage });
    }
    // Heal (or self-damage if negative, e.g. Gengar Curse)
    const healAmt = ability.heal ?? 0;
    const selfPiece = newBoard[row][col] || self;
    const newSelfHp = healAmt >= 0
      ? Math.min(selfPiece.maxHp, selfPiece.hp + healAmt)
      : Math.max(1, selfPiece.hp + healAmt); // can't kill itself
    if (newSelfHp !== selfPiece.hp) {
      newBoard[row][col] = { ...selfPiece, hp: newSelfHp };
    }
  } else if (ability.effect === 'heal_allies') {
    for (const t of targets) {
      const newHp = Math.min(t.target.maxHp, t.target.hp + ability.heal);
      if (newHp !== t.target.hp) {
        newBoard[t.r][t.c] = { ...t.target, hp: newHp };
        affected.push({ row: t.r, col: t.c, name: t.target.pokemon, healed: newHp - t.target.hp });
      }
    }
  } else if (ability.effect === 'intimidate') {
    // Apply intimidate debuff: -1 damage for N turns
    for (const t of targets) {
      if (!t.target.intimidated) {
        newBoard[t.r][t.c] = { ...t.target, intimidated: true, intimidateTimer: ability.duration || 3 };
        affected.push({ row: t.r, col: t.c, name: t.target.pokemon });
      }
    }
  }

  // Bonus status effect (e.g. Pikachu: damage + stun)
  if (ability.bonusStatus && ability.bonusTargets) {
    let bonusPool = adjEnemies.filter(e => newBoard[e.r]?.[e.c]); // only alive targets
    let bonusTargets = [];
    if (ability.bonusTargets === 'random_1') bonusTargets = pickRandom(bonusPool, 1);
    else if (ability.bonusTargets === 'random_2') bonusTargets = pickRandom(bonusPool, 2);
    else if (ability.bonusTargets === 'adjacent_enemies') bonusTargets = bonusPool;

    for (const t of bonusTargets) {
      const cur = newBoard[t.r][t.c];
      if (cur && !cur.statusEffect) {
        newBoard[t.r][t.c] = { ...cur, statusEffect: ability.bonusStatus };
        affected.push({ row: t.r, col: t.c, name: cur.pokemon });
      }
    }
  }

  const newGame = { ...game, board: newBoard };

  // Report ability if anything happened
  if (affected.length > 0 || ability.effect === 'heal' || ability.effect === 'drain') {
    newGame.lastAbility = {
      user: piece.pokemon,
      abilityName: ability.name,
      effectName: ability.status || ability.effect,
      effectEmoji: ability.emoji,
      color: ability.color,
      affected,
    };
  }
  return newGame;
}

function pickRandom(arr, count) {
  if (arr.length <= count) return [...arr];
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function clearStatusEffects(board, color) {
  const newBoard = cloneBoard(board);
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = newBoard[r][c];
      // Clear temporary status effects (frozen, stunned) but NOT permanent ones (poisoned, paralyzed)
      if (p && p.color === color && p.statusEffect && p.statusEffect !== 'poisoned' && p.statusEffect !== 'paralyzed') {
        newBoard[r][c] = { ...p, statusEffect: null };
      }
    }
  }
  return newBoard;
}

/**
 * Apply counter-damage to the attacker (Brambleghast thorns)
 * Also deal 2 type-effective damage to a random enemy anywhere on the board
 */
function applyCounterDamage(game, attackerRow, attackerCol, counterDmg, attackerPiece) {
  const piece = game.board[attackerRow]?.[attackerCol];
  if (!piece) return game;
  // Only apply to the actual attacker
  if (piece.id !== attackerPiece.id) return game;

  const newBoard = cloneBoard(game.board);
  const newHp = Math.max(0, piece.hp - counterDmg);

  if (newHp <= 0) {
    newBoard[attackerRow][attackerCol] = null;
  } else {
    newBoard[attackerRow][attackerCol] = { ...piece, hp: newHp };
  }

  // Find Brambleghast's types for type effectiveness calc
  const brambleTypes = POKEMON.BRAMBLEGHAST?.types || ['GRASS', 'GHOST'];

  // Find all enemies on the board (enemies of Brambleghast = same color as attacker)
  const enemies = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = newBoard[r][c];
      if (p && p.color === attackerPiece.color && !(r === attackerRow && c === attackerCol)) {
        enemies.push({ r, c, target: p });
      }
    }
  }

  // Pick a random enemy and deal 2 type-effective damage
  let statusMsg = '';
  if (enemies.length > 0) {
    const chosen = enemies[Math.floor(Math.random() * enemies.length)];
    const typeMult = getTypeMultiplier(brambleTypes, chosen.target.types);
    const baseDmg = 2;
    const finalDmg = Math.max(1, Math.floor(baseDmg * typeMult));
    const targetHp = Math.max(0, chosen.target.hp - finalDmg);
    const targetName = POKEMON[chosen.target.pokemon]?.name || 'enemy';

    if (targetHp <= 0) {
      newBoard[chosen.r][chosen.c] = null;
      statusMsg = `\n🌿 Thorny Trap also eliminated ${targetName}!`;
    } else {
      newBoard[chosen.r][chosen.c] = { ...chosen.target, hp: targetHp };
      statusMsg = `\n🌿 Thorny Trap also hit ${targetName} for ${finalDmg} DMG!`;
    }
  }

  let newGame = { ...game, board: newBoard };
  if (statusMsg) {
    newGame.statusMessage = (game.statusMessage || '') + statusMsg;
  }

  // Handle attacker death
  if (newHp <= 0) {
    newGame.capturedPieces = {
      ...newGame.capturedPieces,
      [piece.color]: [...newGame.capturedPieces[piece.color], piece],
    };
  }

  return newGame;
}

/**
 * Tick status damage: poison (1 DMG/turn) and paralysis (1 DMG every 3 turns)
 */
function tickStatusDamage(board) {
  const newBoard = cloneBoard(board);
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = newBoard[r][c];
      if (!p) continue;

      // Poison: 1 damage every full turn
      if (p.statusEffect === 'poisoned') {
        const newHp = p.hp - 1;
        if (newHp <= 0) {
          newBoard[r][c] = null;
        } else {
          newBoard[r][c] = { ...p, hp: newHp };
        }
      }

      // Paralysis: 1 damage every 3 full turns
      if (p.statusEffect === 'paralyzed') {
        const tick = (p.paralyzeTick || 0) + 1;
        if (tick >= 3) {
          const newHp = p.hp - 1;
          if (newHp <= 0) {
            newBoard[r][c] = null;
          } else {
            newBoard[r][c] = { ...p, hp: newHp, paralyzeTick: 0 };
          }
        } else {
          newBoard[r][c] = { ...p, paralyzeTick: tick };
        }
      }
    }
  }
  return newBoard;
}

/**
 * Tick down intimidate timers on all pieces (every turn switch)
 */
function tickIntimidateTimers(board) {
  const newBoard = cloneBoard(board);
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = newBoard[r][c];
      if (p && p.intimidated) {
        const newTimer = (p.intimidateTimer || 1) - 1;
        if (newTimer <= 0) {
          newBoard[r][c] = { ...p, intimidated: false, intimidateTimer: 0 };
        } else {
          newBoard[r][c] = { ...p, intimidateTimer: newTimer };
        }
      }
    }
  }
  return newBoard;
}

/**
 * Tick down lava trail durations, remove expired ones
 */
function tickLavaTrails(trails) {
  if (!trails || trails.length === 0) return [];
  return trails
    .map(t => ({ ...t, turnsLeft: t.turnsLeft - 1 }))
    .filter(t => t.turnsLeft > 0);
}

/**
 * Place a lava trail along the path from (fromRow,fromCol) to (toRow,toCol)
 * Straight-line moves (rank, file, diagonal) get full trail
 * Knight (L-shape) moves just place lava on the origin square
 */
function placeLavaTrail(game, fromRow, fromCol, toRow, toCol, piece) {
  if (piece.pokemon !== 'MAGCARGO') return game;
  const ability = ABILITIES[piece.pokemon];
  if (!ability || ability.effect !== 'lava_trail') return game;

  const rowDiff = toRow - fromRow;
  const colDiff = toCol - fromCol;
  const absR = Math.abs(rowDiff);
  const absC = Math.abs(colDiff);

  // Determine if this is a straight-line move (rank, file, or diagonal)
  const isStraightLine = absR === 0 || absC === 0 || absR === absC;

  const pathSquares = [];

  if (isStraightLine && (absR + absC > 0)) {
    // Trace the straight-line path (excluding destination)
    const dr = Math.sign(rowDiff);
    const dc = Math.sign(colDiff);
    let r = fromRow, c = fromCol;
    while (r !== toRow || c !== toCol) {
      // Skip squares that have a piece on them
      if (!game.board[r]?.[c]) {
        pathSquares.push({ row: r, col: c });
      }
      r += dr;
      c += dc;
    }
  } else {
    // Knight or other non-straight move — just place on origin
    if (!game.board[fromRow]?.[fromCol]) {
      pathSquares.push({ row: fromRow, col: fromCol });
    }
  }

  if (pathSquares.length === 0) return game;

  let newTrails = [...(game.lavaTrails || [])];

  for (const sq of pathSquares) {
    // Don't double-stack lava on same square
    if (newTrails.some(t => t.row === sq.row && t.col === sq.col)) continue;
    newTrails.push({
      row: sq.row,
      col: sq.col,
      turnsLeft: ability.duration || 5,
      damage: ability.damage || 2,
      ownerColor: piece.color,
    });
  }

  return { ...game, lavaTrails: newTrails };
}

/**
 * Apply lava damage to a piece that landed on a lava trail square
 */
function applyLavaDamage(game, row, col) {
  if (!game.lavaTrails || game.lavaTrails.length === 0) return game;
  const piece = game.board[row]?.[col];
  if (!piece) return game;

  // Find lava at this position owned by the enemy
  const lavaIdx = game.lavaTrails.findIndex(t => t.row === row && t.col === col && t.ownerColor !== piece.color);
  if (lavaIdx === -1) return game;

  const lava = game.lavaTrails[lavaIdx];
  const newBoard = cloneBoard(game.board);
  const newHp = Math.max(0, piece.hp - lava.damage);

  if (newHp <= 0) {
    newBoard[row][col] = null;
  } else {
    newBoard[row][col] = { ...piece, hp: newHp };
  }

  // Remove the lava trail that was triggered
  const newTrails = [...game.lavaTrails];
  newTrails.splice(lavaIdx, 1);

  const newGame = {
    ...game,
    board: newBoard,
    lavaTrails: newTrails,
    statusMessage: `🌋 ${POKEMON[piece.pokemon]?.name || 'A piece'} stepped on lava! -${lava.damage} HP!`,
  };

  return newGame;
}

/**
 * Update clock — call this every second
 */
export function tickClock(game, deltaMs) {
  if (!game.clockRunning || game.phase !== PHASES.PLAY) return game;

  const newClock = { ...game.clock };
  newClock[game.currentPlayer] = Math.max(0, newClock[game.currentPlayer] - deltaMs);

  if (newClock[game.currentPlayer] <= 0) {
    return {
      ...game,
      clock: newClock,
      phase: PHASES.GAME_OVER,
      winner: game.currentPlayer === 'white' ? 'black' : 'white',
      clockRunning: false,
    };
  }

  return { ...game, clock: newClock };
}

/**
 * Get all pieces of a color
 */
export function getPiecesOfColor(board, color) {
  const pieces = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c]?.color === color) {
        pieces.push({ ...board[r][c], row: r, col: c });
      }
    }
  }
  return pieces;
}
