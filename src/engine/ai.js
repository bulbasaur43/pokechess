/**
 * AI Engine for PokéChess — 10 Difficulty Levels
 *
 * Lv 1-2:  Random / slight capture preference
 * Lv 3-4:  Heuristic scoring, picks from top N
 * Lv 5-6:  Minimax depth 1-2 with alpha-beta
 * Lv 7-8:  Minimax depth 2-3, full eval
 * Lv 9-10: Minimax depth 3-4, quiescence search, full tactics
 */

import { getLegalMoves } from './moves.js';
import { resolveBattle, getBattlePreview } from './battle.js';
import { POKEMON, getTypeMultiplier } from './types.js';
import { getPiece, cloneBoard, ROLES } from './board.js';

// ─── Difficulty Config ──────────────────────────────────────────────

const LEVEL_CONFIG = {
  1:  { depth: 0, topN: Infinity, posWeight: 0,    captureBonus: 0,   kingSafety: 0,   typeAware: false, quiesce: false, label: 'Lv 1',  emoji: '1️⃣',  desc: 'Complete beginner',  rating: 400  },
  2:  { depth: 0, topN: Infinity, posWeight: 0,    captureBonus: 0.5, kingSafety: 0,   typeAware: false, quiesce: false, label: 'Lv 2',  emoji: '2️⃣',  desc: 'Slightly aware',     rating: 550  },
  3:  { depth: 0, topN: 5,        posWeight: 0.3,  captureBonus: 1,   kingSafety: 0,   typeAware: false, quiesce: false, label: 'Lv 3',  emoji: '3️⃣',  desc: 'Basic strategy',     rating: 700  },
  4:  { depth: 0, topN: 3,        posWeight: 0.5,  captureBonus: 1.5, kingSafety: 0.5, typeAware: true,  quiesce: false, label: 'Lv 4',  emoji: '4️⃣',  desc: 'Developing player',  rating: 850  },
  5:  { depth: 1, topN: 2,        posWeight: 0.7,  captureBonus: 2,   kingSafety: 0.7, typeAware: true,  quiesce: false, label: 'Lv 5',  emoji: '5️⃣',  desc: 'Competent',          rating: 1000 },
  6:  { depth: 2, topN: 2,        posWeight: 0.8,  captureBonus: 2,   kingSafety: 1,   typeAware: true,  quiesce: false, label: 'Lv 6',  emoji: '6️⃣',  desc: 'Skilled',            rating: 1150 },
  7:  { depth: 2, topN: 1,        posWeight: 1,    captureBonus: 2.5, kingSafety: 1.2, typeAware: true,  quiesce: true,  label: 'Lv 7',  emoji: '7️⃣',  desc: 'Tough opponent',     rating: 1300 },
  8:  { depth: 3, topN: 1,        posWeight: 1,    captureBonus: 3,   kingSafety: 1.5, typeAware: true,  quiesce: true,  label: 'Lv 8',  emoji: '8️⃣',  desc: 'Advanced',           rating: 1500 },
  9:  { depth: 3, topN: 1,        posWeight: 1.3,  captureBonus: 3.5, kingSafety: 2,   typeAware: true,  quiesce: true,  label: 'Lv 9',  emoji: '9️⃣',  desc: 'Expert tactician',   rating: 1700 },
  10: { depth: 4, topN: 1,        posWeight: 1.5,  captureBonus: 4,   kingSafety: 2.5, typeAware: true,  quiesce: true,  label: 'Lv 10', emoji: '🔟', desc: 'Grandmaster',        rating: 2000 },
};

// ─── Piece values ───────────────────────────────────────────────────

const ROLE_VALUES = {
  TRUE_KING: 100, QUEEN: 9, ROOK: 5, BISHOP: 3.5, KNIGHT: 3, KING: 4, PAWN: 1,
};

function pieceValue(piece) {
  if (!piece) return 0;
  const base = ROLE_VALUES[piece.role] ?? 1;
  const hpFactor = piece.hp / piece.maxHp;
  const dmgBonus = piece.damage * 0.2;
  return base * (0.4 + 0.6 * hpFactor) + dmgBonus;
}

// ─── Fast threat map (computed once per board state) ─────────────────

/**
 * Build a threat map: for each square, total damage from attackerColor pieces.
 * Much faster than calling getSquareThreats per-square.
 */
function buildThreatMap(board, attackerColor) {
  const map = Array.from({ length: 8 }, () => new Float32Array(8));

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece || piece.color !== attackerColor || piece.statusEffect) continue;

      const moves = getLegalMoves(board, r, c, null);
      for (const m of moves) {
        if (m.isCapture) {
          map[m.row][m.col] += piece.damage;
        }
      }
    }
  }
  return map;
}

/**
 * Build an attack count map: how many pieces of attackerColor can reach each square
 */
function buildAttackCountMap(board, attackerColor) {
  const map = Array.from({ length: 8 }, () => new Uint8Array(8));

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece || piece.color !== attackerColor || piece.statusEffect) continue;

      const moves = getLegalMoves(board, r, c, null);
      for (const m of moves) {
        map[m.row][m.col]++;
      }
    }
  }
  return map;
}

// ─── Piece-Square Tables (positional bonuses) ───────────────────────

// Pawns want to advance and control center
const PAWN_TABLE = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [5, 5, 5, 5, 5, 5, 5, 5],
  [1, 1, 2, 3, 3, 2, 1, 1],
  [0.5, 0.5, 1, 2.5, 2.5, 1, 0.5, 0.5],
  [0, 0, 0, 2, 2, 0, 0, 0],
  [0.5, -0.5, -1, 0, 0, -1, -0.5, 0.5],
  [0.5, 1, 1, -2, -2, 1, 1, 0.5],
  [0, 0, 0, 0, 0, 0, 0, 0],
];

// Knights want center, avoid edges
const KNIGHT_TABLE = [
  [-5, -4, -3, -3, -3, -3, -4, -5],
  [-4, -2, 0, 0, 0, 0, -2, -4],
  [-3, 0, 1, 1.5, 1.5, 1, 0, -3],
  [-3, 0.5, 1.5, 2, 2, 1.5, 0.5, -3],
  [-3, 0, 1.5, 2, 2, 1.5, 0, -3],
  [-3, 0.5, 1, 1.5, 1.5, 1, 0.5, -3],
  [-4, -2, 0, 0.5, 0.5, 0, -2, -4],
  [-5, -4, -3, -3, -3, -3, -4, -5],
];

// General piece center control
const CENTER_TABLE = [
  [-2, -1, -1, -1, -1, -1, -1, -2],
  [-1, 0, 0, 0, 0, 0, 0, -1],
  [-1, 0, 0.5, 1, 1, 0.5, 0, -1],
  [-1, 0, 1, 1.5, 1.5, 1, 0, -1],
  [-1, 0, 1, 1.5, 1.5, 1, 0, -1],
  [-1, 0, 0.5, 1, 1, 0.5, 0, -1],
  [-1, 0, 0, 0, 0, 0, 0, -1],
  [-2, -1, -1, -1, -1, -1, -1, -2],
];

function getPST(piece, row, col, isWhite) {
  // Mirror row for black (PSTs are from white's perspective)
  const r = isWhite ? row : 7 - row;
  if (piece.isPawn || piece.role === 'PAWN') return PAWN_TABLE[r][col] * 0.1;
  if (piece.role === 'KNIGHT' || piece.role === 'KING') return KNIGHT_TABLE[r][col] * 0.1;
  return CENTER_TABLE[r][col] * 0.08;
}

// ─── Board evaluation ───────────────────────────────────────────────

function evaluateBoard(board, aiColor, config) {
  let score = 0;
  const oppColor = aiColor === 'white' ? 'black' : 'white';
  const posWeight = config.posWeight;
  const kingSafety = config.kingSafety;
  const isWhite = aiColor === 'white';

  let aiKingPos = null, oppKingPos = null;
  let aiPieceCount = 0, oppPieceCount = 0;
  let aiTotalHp = 0, oppTotalHp = 0;
  let aiTotalMaxHp = 0, oppTotalMaxHp = 0;

  // First pass: find kings, count pieces, total HP
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;
      if (piece.role === 'TRUE_KING') {
        if (piece.color === aiColor) aiKingPos = { r, c, piece };
        else oppKingPos = { r, c, piece };
      }
      if (piece.color === aiColor) {
        aiPieceCount++;
        aiTotalHp += piece.hp;
        aiTotalMaxHp += piece.maxHp;
      } else {
        oppPieceCount++;
        oppTotalHp += piece.hp;
        oppTotalMaxHp += piece.maxHp;
      }
    }
  }

  if (!oppKingPos) return 9999;
  if (!aiKingPos) return -9999;

  // Phase detection
  const totalPieces = aiPieceCount + oppPieceCount;
  const isEndgame = totalPieces <= 10;

  // Build threat maps (once, not per-square)
  let aiThreatMap = null, oppThreatMap = null;
  let aiAttackMap = null, oppAttackMap = null;
  if (posWeight >= 0.5) {
    oppThreatMap = buildThreatMap(board, oppColor);
    aiThreatMap = buildThreatMap(board, aiColor);
    oppAttackMap = buildAttackCountMap(board, oppColor);
    aiAttackMap = buildAttackCountMap(board, aiColor);
  }

  // Second pass: full evaluation
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;

      const val = pieceValue(piece);

      if (piece.color === aiColor) {
        score += val;

        // Piece-square table bonus
        score += getPST(piece, r, c, isWhite) * posWeight;

        // Pawn advancement + promotion threat
        if (piece.isPawn || piece.role === 'PAWN') {
          const advancement = isWhite ? (7 - r) : r;
          score += advancement * 0.15 * posWeight;
          if (advancement >= 6) score += 3 * posWeight;
          if (advancement >= 5) score += 1.5 * posWeight;
        }

        // Piece coordination
        if (posWeight >= 0.5) {
          for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
              const adj = board[nr][nc];
              if (adj && adj.color === aiColor) score += 0.05 * posWeight;
            }
          }
        }

        // Proximity to opponent king — attack pressure
        if (posWeight >= 0.7 && oppKingPos && piece.role !== 'TRUE_KING') {
          const dist = Math.abs(r - oppKingPos.r) + Math.abs(c - oppKingPos.c);
          const pressureWeight = isEndgame ? 0.4 : 0.2;
          if (dist <= 4) score += (5 - dist) * pressureWeight * posWeight;
        }

        // Penalize hanging/threatened pieces
        if (oppThreatMap && oppThreatMap[r][c] > 0) {
          const defenders = aiAttackMap ? aiAttackMap[r][c] : 0;
          if (defenders <= 0) {
            score -= val * 0.7 * posWeight; // hanging — big penalty
          } else if (oppThreatMap[r][c] >= piece.hp) {
            score -= val * 0.35 * posWeight; // can be killed
          }
        }

        if (piece.statusEffect) score -= 1.5;
      } else {
        score -= val;

        // Opponent TRUE_KING low HP — get aggressive
        if (piece.role === 'TRUE_KING' && posWeight >= 0.5) {
          const hpPercent = piece.hp / piece.maxHp;
          if (hpPercent <= 0.5) score += (1 - hpPercent) * 10 * posWeight;
        }

        // Opponent hanging pieces — attack opportunity
        if (aiThreatMap && aiThreatMap[r][c] > 0) {
          const defenders = oppAttackMap ? oppAttackMap[r][c] : 0;
          if (defenders <= 0) score += val * 0.5 * posWeight;
        }

        // Opponent near our king — dangerous
        if (kingSafety > 0 && aiKingPos) {
          const dist = Math.abs(r - aiKingPos.r) + Math.abs(c - aiKingPos.c);
          if (dist <= 2) score -= (3 - dist) * 0.5 * kingSafety;
          if (dist <= 1) score -= piece.damage * 0.3 * kingSafety;
        }

        if (piece.statusEffect) score += 0.7;
      }
    }
  }

  // King safety
  if (kingSafety > 0 && aiKingPos) {
    let defenders = 0;
    let enemyPressure = 0;
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]) {
      const nr = aiKingPos.r + dr, nc = aiKingPos.c + dc;
      if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
        const adj = board[nr][nc];
        if (adj) {
          if (adj.color === aiColor) defenders++;
          else enemyPressure += adj.damage;
        }
      }
    }
    score += defenders * 0.3 * kingSafety;
    score -= enemyPressure * 0.15 * kingSafety;

    // Exposed king is bad
    if (oppThreatMap && oppThreatMap[aiKingPos.r][aiKingPos.c] > 0) {
      score -= 2 * kingSafety;
    }

    const kingHpPercent = aiKingPos.piece.hp / aiKingPos.piece.maxHp;
    if (kingHpPercent <= 0.5) score -= (1 - kingHpPercent) * 4 * kingSafety;

    if (isEndgame) {
      const edgeDist = Math.min(aiKingPos.r, 7 - aiKingPos.r, aiKingPos.c, 7 - aiKingPos.c);
      if (edgeDist <= 1) score -= 0.5 * kingSafety;
    }
  }

  // Material + HP advantage
  if (posWeight >= 0.5) {
    score += (aiPieceCount - oppPieceCount) * 0.6 * posWeight;
    const hpAdv = (aiTotalHp / Math.max(1, aiTotalMaxHp)) - (oppTotalHp / Math.max(1, oppTotalMaxHp));
    score += hpAdv * 2 * posWeight;
  }

  // Endgame: drive opponent king to corner
  if (isEndgame && posWeight >= 1 && oppKingPos) {
    const oppKingEdge = Math.min(oppKingPos.r, 7 - oppKingPos.r, oppKingPos.c, 7 - oppKingPos.c);
    score += (3 - oppKingEdge) * 0.5 * posWeight;
    if (aiKingPos) {
      const kingDist = Math.abs(aiKingPos.r - oppKingPos.r) + Math.abs(aiKingPos.c - oppKingPos.c);
      score += (14 - kingDist) * 0.2 * posWeight;
    }
  }

  return score;
}

// ─── Get all moves for a color ──────────────────────────────────────

function getAllMovesForColor(board, color, enPassantTarget) {
  const moves = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece || piece.color !== color) continue;
      if (piece.statusEffect) continue;
      const pieceMoves = getLegalMoves(board, r, c, enPassantTarget);
      for (const move of pieceMoves) {
        moves.push({ fromRow: r, fromCol: c, toRow: move.row, toCol: move.col, move });
      }
    }
  }
  return moves;
}

// ─── Score a single move (for ordering + low-depth levels) ──────────

function scoreMove(board, fromRow, fromCol, toRow, toCol, move, aiColor, config) {
  let score = 0;
  const attacker = board[fromRow][fromCol];
  if (!attacker) return -Infinity;
  const oppColor = aiColor === 'white' ? 'black' : 'white';

  if (move.isCapture) {
    const defender = board[toRow][toCol];
    if (defender) {
      const preview = getBattlePreview(attacker, defender);

      if (preview.wouldKill) {
        score += pieceValue(defender) * config.captureBonus;
        if (defender.role === 'TRUE_KING') score += 1000;
        // MVV-LVA: high value target with low value attacker = good
        score += (pieceValue(defender) - pieceValue(attacker) * 0.3) * 0.5;
      } else {
        const hpPercent = preview.baseDamage / defender.maxHp;
        score += hpPercent * pieceValue(defender) * 0.6;
        if (pieceValue(attacker) > pieceValue(defender) * 1.5) {
          score -= pieceValue(attacker) * 0.3;
        }
        if (attacker.role === 'TRUE_KING' && !preview.wouldKill) score -= 2;
      }

      // Type advantage
      if (config.typeAware) {
        const typeMult = getTypeMultiplier(attacker.types, defender.types);
        if (typeMult >= 2) score += 2;
        else if (typeMult <= 0.5) score -= 2;
      }

      // Bad trade detection (Lv 6+): avoid capturing if we'd lose a more valuable piece
      if (config.kingSafety >= 1 && preview.wouldKill) {
        // After capturing, attacker moves to target square — check if enemy can hit back
        let dangerAfter = 0;
        for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1],[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
          const nr = toRow + dr, nc = toCol + dc;
          if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
            const threat = board[nr][nc];
            if (threat && threat.color === oppColor && !threat.statusEffect) {
              dangerAfter += threat.damage;
            }
          }
        }
        if (dangerAfter >= attacker.hp && pieceValue(attacker) > pieceValue(defender) * 1.2) {
          // Bad trade — we'd lose a more valuable piece
          const tradeLoss = pieceValue(attacker) - pieceValue(defender);
          score -= tradeLoss * 1.5;
        }
      }

      score -= pieceValue(attacker) * 0.05;
    }
  } else {
    // Non-captures
    const isWhite = aiColor === 'white';

    // PST bonus at destination
    score += getPST(attacker, toRow, toCol, isWhite) * config.posWeight * 2;

    // Pawn advancement
    if (attacker.isPawn || attacker.role === 'PAWN') {
      const advancement = isWhite ? (7 - toRow) : toRow;
      score += advancement * 0.2 * config.posWeight;
      if (advancement >= 6) score += 2 * config.posWeight;
    }

    // Development
    if (config.posWeight >= 0.3) {
      const startRow = isWhite ? 7 : 0;
      if (fromRow === startRow) score += 0.3 * config.posWeight;
    }

    // Move toward opponent king
    if (config.posWeight >= 0.7 && attacker.role !== 'TRUE_KING') {
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = board[r][c];
          if (p && p.color === oppColor && p.role === 'TRUE_KING') {
            const oldDist = Math.abs(fromRow - r) + Math.abs(fromCol - c);
            const newDist = Math.abs(toRow - r) + Math.abs(toCol - c);
            if (newDist < oldDist) score += 0.4 * config.posWeight;
          }
        }
      }
    }

    // Don't move king into danger
    if (attacker.role === 'TRUE_KING' && config.kingSafety > 0) {
      // Quick adjacency check for enemy pieces
      for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]) {
        const nr = toRow + dr, nc = toCol + dc;
        if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
          const adj = board[nr][nc];
          if (adj && adj.color === oppColor) score -= 1.5 * config.kingSafety;
        }
      }
    }
  }

  return score;
}

// ─── Minimax with alpha-beta + quiescence ───────────────────────────

function minimaxSearch(board, aiColor, enPassantTarget, config) {
  const moves = getAllMovesForColor(board, aiColor, enPassantTarget);
  if (moves.length === 0) return null;

  // Depth 0: just score moves directly
  if (config.depth === 0) {
    const scored = moves.map(m => ({
      ...m,
      score: scoreMove(board, m.fromRow, m.fromCol, m.toRow, m.toCol, m.move, aiColor, config)
        + Math.random() * 0.3,
    }));
    scored.sort((a, b) => b.score - a.score);

    const topN = Math.min(config.topN, scored.length);
    if (topN >= scored.length) return scored[Math.floor(Math.random() * scored.length)];
    const top = scored.slice(0, topN);
    const weights = top.map((_, i) => Math.max(1, topN + 1 - i));
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let rand = Math.random() * totalWeight;
    for (let i = 0; i < top.length; i++) {
      rand -= weights[i];
      if (rand <= 0) return top[i];
    }
    return top[0];
  }

  // Pre-score for ordering
  const scored = moves.map(m => ({
    ...m,
    heuristic: scoreMove(board, m.fromRow, m.fromCol, m.toRow, m.toCol, m.move, aiColor, config),
  }));
  scored.sort((a, b) => b.heuristic - a.heuristic);

  // Prune move list for performance at higher depths
  const maxMoves = config.depth >= 4 ? 12 : config.depth >= 3 ? 18 : scored.length;
  const prunedMoves = scored.slice(0, maxMoves);

  let bestMove = null;
  let bestScore = -Infinity;

  for (const m of prunedMoves) {
    const simBoard = simulateMove(board, m.fromRow, m.fromCol, m.toRow, m.toCol, m.move);
    const score = minimax(simBoard, config.depth - 1, -Infinity, Infinity, false, aiColor, null, config);

    const noise = config.topN <= 1 ? 0.001 : 0.05;
    const noisyScore = score + Math.random() * noise;

    if (noisyScore > bestScore) {
      bestScore = noisyScore;
      bestMove = m;
    }
  }

  // For topN > 1, randomize among top candidates
  if (config.topN > 1 && prunedMoves.length > 1) {
    const allScored = prunedMoves.map(m => {
      const simBoard = simulateMove(board, m.fromRow, m.fromCol, m.toRow, m.toCol, m.move);
      return {
        ...m,
        score: minimax(simBoard, config.depth - 1, -Infinity, Infinity, false, aiColor, null, config),
      };
    });
    allScored.sort((a, b) => b.score - a.score);
    const top = allScored.slice(0, Math.min(config.topN, allScored.length));
    return top[Math.floor(Math.random() * top.length)];
  }

  return bestMove;
}

function minimax(board, depth, alpha, beta, isMaximizing, aiColor, enPassantTarget, config) {
  if (depth === 0) {
    // Quiescence search: continue looking at captures to avoid horizon effect
    if (config.quiesce) {
      return quiescence(board, alpha, beta, isMaximizing, aiColor, config, 4);
    }
    return evaluateBoard(board, aiColor, config);
  }

  const color = isMaximizing ? aiColor : (aiColor === 'white' ? 'black' : 'white');
  const moves = getAllMovesForColor(board, color, enPassantTarget);

  if (moves.length === 0) return isMaximizing ? -50 : 50;

  // Move ordering: king captures first, then by target value
  const ordered = [...moves].sort((a, b) => {
    const aTarget = board[a.toRow]?.[a.toCol];
    const bTarget = board[b.toRow]?.[b.toCol];
    let aVal = a.move.isCapture && aTarget ? (pieceValue(aTarget) + 10) : 0;
    let bVal = b.move.isCapture && bTarget ? (pieceValue(bTarget) + 10) : 0;
    if (aTarget?.role === 'TRUE_KING') aVal += 500;
    if (bTarget?.role === 'TRUE_KING') bVal += 500;
    return bVal - aVal;
  });

  // Width pruning at deeper levels
  const maxWidth = depth >= 3 ? 10 : depth >= 2 ? 16 : ordered.length;
  const searchMoves = ordered.slice(0, maxWidth);

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const m of searchMoves) {
      const simBoard = simulateMove(board, m.fromRow, m.fromCol, m.toRow, m.toCol, m.move);
      const eval_ = minimax(simBoard, depth - 1, alpha, beta, false, aiColor, null, config);
      maxEval = Math.max(maxEval, eval_);
      alpha = Math.max(alpha, eval_);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const m of searchMoves) {
      const simBoard = simulateMove(board, m.fromRow, m.fromCol, m.toRow, m.toCol, m.move);
      const eval_ = minimax(simBoard, depth - 1, alpha, beta, true, aiColor, null, config);
      minEval = Math.min(minEval, eval_);
      beta = Math.min(beta, eval_);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

/**
 * Quiescence search: only evaluate capture moves to avoid the horizon effect.
 * This prevents the AI from thinking it's safe because it stopped searching
 * right before a piece gets captured.
 */
function quiescence(board, alpha, beta, isMaximizing, aiColor, config, maxDepth) {
  const standPat = evaluateBoard(board, aiColor, config);

  if (maxDepth <= 0) return standPat;

  if (isMaximizing) {
    if (standPat >= beta) return beta;
    alpha = Math.max(alpha, standPat);
  } else {
    if (standPat <= alpha) return alpha;
    beta = Math.min(beta, standPat);
  }

  const color = isMaximizing ? aiColor : (aiColor === 'white' ? 'black' : 'white');
  const moves = getAllMovesForColor(board, color, null);

  // Only look at captures, ordered by target value (highest first)
  const captures = moves
    .filter(m => m.move.isCapture && board[m.toRow]?.[m.toCol])
    .sort((a, b) => pieceValue(board[b.toRow][b.toCol]) - pieceValue(board[a.toRow][a.toCol]));

  if (captures.length === 0) return standPat;

  // Only search the most valuable captures (up to 6)
  const topCaptures = captures.slice(0, 6);

  if (isMaximizing) {
    let val = standPat;
    for (const m of topCaptures) {
      const simBoard = simulateMove(board, m.fromRow, m.fromCol, m.toRow, m.toCol, m.move);
      const eval_ = quiescence(simBoard, alpha, beta, false, aiColor, config, maxDepth - 1);
      val = Math.max(val, eval_);
      alpha = Math.max(alpha, eval_);
      if (beta <= alpha) break;
    }
    return val;
  } else {
    let val = standPat;
    for (const m of topCaptures) {
      const simBoard = simulateMove(board, m.fromRow, m.fromCol, m.toRow, m.toCol, m.move);
      const eval_ = quiescence(simBoard, alpha, beta, true, aiColor, config, maxDepth - 1);
      val = Math.min(val, eval_);
      beta = Math.min(beta, eval_);
      if (beta <= alpha) break;
    }
    return val;
  }
}

/**
 * Simulate a move — type-aware damage
 */
function simulateMove(board, fromRow, fromCol, toRow, toCol, move) {
  const newBoard = cloneBoard(board);
  const attacker = { ...newBoard[fromRow][fromCol] };

  if (move.isCapture) {
    const defender = newBoard[toRow][toCol];
    if (defender) {
      const typeMult = getTypeMultiplier(attacker.types, defender.types);
      const dmg = Math.max(1, Math.floor(attacker.damage * typeMult));
      const newHp = defender.hp - dmg;

      if (newHp <= 0) {
        newBoard[fromRow][fromCol] = null;
        newBoard[toRow][toCol] = { ...attacker, hasMoved: true };
      } else {
        newBoard[toRow][toCol] = { ...defender, hp: newHp };
      }
    } else {
      newBoard[fromRow][fromCol] = null;
      newBoard[toRow][toCol] = { ...attacker, hasMoved: true };
    }
  } else {
    newBoard[fromRow][fromCol] = null;
    newBoard[toRow][toCol] = { ...attacker, hasMoved: true };
  }

  return newBoard;
}

// ─── Main AI Interface ──────────────────────────────────────────────

export const AI_DIFFICULTIES = {};
for (let i = 1; i <= 10; i++) {
  AI_DIFFICULTIES[String(i)] = LEVEL_CONFIG[i];
}

export function getAIMove(board, color, difficulty, enPassantTarget) {
  const level = parseInt(difficulty, 10) || 5;
  const config = LEVEL_CONFIG[Math.max(1, Math.min(10, level))];
  return minimaxSearch(board, color, enPassantTarget, config);
}
