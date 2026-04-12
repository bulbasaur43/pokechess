/**
 * AI Engine for PokéChess — 10 Difficulty Levels
 *
 * Lv 1:  Pure random
 * Lv 2:  Random with slight capture preference
 * Lv 3:  Score-based, picks from top 5
 * Lv 4:  Score-based, picks from top 3
 * Lv 5:  Minimax depth 1, picks from top 2
 * Lv 6:  Minimax depth 2, picks from top 2
 * Lv 7:  Minimax depth 2, best move
 * Lv 8:  Minimax depth 3, best move
 * Lv 9:  Minimax depth 3, enhanced eval
 * Lv 10: Minimax depth 4, full aggression
 */

import { getLegalMoves } from './moves.js';
import { resolveBattle, getBattlePreview } from './battle.js';
import { POKEMON } from './types.js';
import { getPiece, cloneBoard, ROLES } from './board.js';

// ─── Difficulty Config ──────────────────────────────────────────────

const LEVEL_CONFIG = {
  1:  { depth: 0, topN: Infinity, posWeight: 0,    captureBonus: 0,   label: 'Lv 1',  emoji: '1️⃣',  desc: 'Complete beginner',  rating: 400  },
  2:  { depth: 0, topN: Infinity, posWeight: 0,    captureBonus: 0.5, label: 'Lv 2',  emoji: '2️⃣',  desc: 'Slightly aware',     rating: 550  },
  3:  { depth: 0, topN: 5,        posWeight: 0.3,  captureBonus: 1,   label: 'Lv 3',  emoji: '3️⃣',  desc: 'Basic strategy',     rating: 700  },
  4:  { depth: 0, topN: 3,        posWeight: 0.5,  captureBonus: 1.5, label: 'Lv 4',  emoji: '4️⃣',  desc: 'Developing player',  rating: 850  },
  5:  { depth: 1, topN: 2,        posWeight: 0.7,  captureBonus: 2,   label: 'Lv 5',  emoji: '5️⃣',  desc: 'Competent',          rating: 1000 },
  6:  { depth: 2, topN: 2,        posWeight: 0.8,  captureBonus: 2,   label: 'Lv 6',  emoji: '6️⃣',  desc: 'Skilled',            rating: 1150 },
  7:  { depth: 2, topN: 1,        posWeight: 1,    captureBonus: 2.5, label: 'Lv 7',  emoji: '7️⃣',  desc: 'Tough opponent',     rating: 1300 },
  8:  { depth: 3, topN: 1,        posWeight: 1,    captureBonus: 3,   label: 'Lv 8',  emoji: '8️⃣',  desc: 'Advanced',           rating: 1500 },
  9:  { depth: 3, topN: 1,        posWeight: 1.3,  captureBonus: 3.5, label: 'Lv 9',  emoji: '9️⃣',  desc: 'Expert tactician',   rating: 1700 },
  10: { depth: 4, topN: 1,        posWeight: 1.5,  captureBonus: 4,   label: 'Lv 10', emoji: '🔟', desc: 'Grandmaster',        rating: 2000 },
};

// ─── Piece value for evaluation ─────────────────────────────────────

function pieceValue(piece) {
  if (!piece) return 0;
  const roleValues = {
    TRUE_KING: 100,
    QUEEN: 9,
    ROOK: 5,
    BISHOP: 3.5,
    KNIGHT: 3,
    KING: 4,
    PAWN: 1,
  };
  const base = roleValues[piece.role] ?? 1;
  // Factor in actual HP — damaged pieces are worth less
  const hpFactor = piece.hp / piece.maxHp;
  // Also factor in damage output
  const dmgBonus = piece.damage * 0.15;
  return base * (0.5 + 0.5 * hpFactor) + dmgBonus;
}

// ─── Board evaluation ───────────────────────────────────────────────

function evaluateBoard(board, aiColor, posWeight) {
  let score = 0;
  const oppColor = aiColor === 'white' ? 'black' : 'white';
  let aiKingPos = null, oppKingPos = null;
  let aiPieceCount = 0, oppPieceCount = 0;

  // First pass: find kings, count pieces
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;
      if (piece.role === 'TRUE_KING') {
        if (piece.color === aiColor) aiKingPos = { r, c, piece };
        else oppKingPos = { r, c, piece };
      }
      if (piece.color === aiColor) aiPieceCount++;
      else oppPieceCount++;
    }
  }

  // If opponent king is dead, massive bonus
  if (!oppKingPos) return 9999;
  if (!aiKingPos) return -9999;

  // Second pass: full evaluation
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;

      const val = pieceValue(piece);

      if (piece.color === aiColor) {
        score += val;

        // Center control
        const centerDist = Math.abs(r - 3.5) + Math.abs(c - 3.5);
        score += (7 - centerDist) * 0.05 * posWeight;

        // Forward advancement (for pawns/attackers)
        if (piece.role === 'KING' || piece.role === 'PAWN') {
          const advancement = aiColor === 'white' ? (7 - r) : r;
          score += advancement * 0.1 * posWeight;
        }

        // Piece coordination — adjacent friendly pieces support each other
        if (posWeight >= 0.8) {
          for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
              const adj = board[nr][nc];
              if (adj && adj.color === aiColor) score += 0.03 * posWeight;
            }
          }
        }

        // Proximity to opponent king (attack pressure)
        if (posWeight >= 1 && oppKingPos) {
          const dist = Math.abs(r - oppKingPos.r) + Math.abs(c - oppKingPos.c);
          if (dist <= 3 && piece.role !== 'TRUE_KING') {
            score += (4 - dist) * 0.15 * posWeight;
          }
        }

        // Status penalty
        if (piece.statusEffect) score -= 1;
      } else {
        score -= val;

        // Opponent's TRUE_KING low HP — get aggressive!
        if (piece.role === 'TRUE_KING' && posWeight >= 0.7) {
          const hpPercent = piece.hp / piece.maxHp;
          if (hpPercent <= 0.5) score += (1 - hpPercent) * 5 * posWeight;
        }

        // Opponent piece threatening our king
        if (posWeight >= 1 && aiKingPos) {
          const dist = Math.abs(r - aiKingPos.r) + Math.abs(c - aiKingPos.c);
          if (dist <= 2) score -= (3 - dist) * 0.3 * posWeight;
        }

        if (piece.statusEffect) score += 0.5;
      }
    }
  }

  // Material advantage bonus (amplified at higher levels)
  if (posWeight >= 1) {
    const materialAdv = aiPieceCount - oppPieceCount;
    score += materialAdv * 0.5 * posWeight;
  }

  // King safety — penalize exposed king
  if (posWeight >= 1 && aiKingPos) {
    let defenders = 0;
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]) {
      const nr = aiKingPos.r + dr, nc = aiKingPos.c + dc;
      if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
        const adj = board[nr][nc];
        if (adj && adj.color === aiColor) defenders++;
      }
    }
    score += defenders * 0.2 * posWeight;
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

// ─── Score a single move (used for move ordering & low-depth) ────────

function scoreMove(board, fromRow, fromCol, toRow, toCol, move, aiColor, config) {
  let score = 0;
  const attacker = board[fromRow][fromCol];
  if (!attacker) return -Infinity;

  if (move.isCapture) {
    const defender = board[toRow][toCol];
    if (defender) {
      const preview = getBattlePreview(attacker, defender);

      if (preview.wouldKill) {
        // Killing a piece is great — more bonus for higher-value targets
        score += pieceValue(defender) * config.captureBonus;
        // Killing the TRUE_KING is instant-win priority
        if (defender.role === 'TRUE_KING') score += 1000;
      } else {
        // Dealing damage has some value
        score += (preview.baseDamage / defender.maxHp) * pieceValue(defender) * 0.5;
        // But don't throw away valuable pieces for chip damage
        if (pieceValue(attacker) > pieceValue(defender) * 1.5) {
          score -= pieceValue(attacker) * 0.2;
        }
      }

      // Avoid trading a high-value piece for a low-value one
      score -= pieceValue(attacker) * 0.05;

      // Check if attacker would be vulnerable after capturing
      if (config.posWeight >= 0.5) {
        const oppColor = aiColor === 'white' ? 'black' : 'white';
        for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]) {
          const nr = toRow + dr, nc = toCol + dc;
          if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
            const threat = board[nr][nc];
            if (threat && threat.color === oppColor && threat.damage >= attacker.hp) {
              score -= pieceValue(attacker) * 0.3; // risky capture
            }
          }
        }
      }
    }
  } else {
    // Non-capture: positional bonuses
    const centerDist = Math.abs(toRow - 3.5) + Math.abs(toCol - 3.5);
    score += (7 - centerDist) * 0.05 * config.posWeight;

    // Forward advancement for pawns
    if (attacker.role === 'KING' || attacker.role === 'PAWN') {
      const advancement = aiColor === 'white' ? (7 - toRow) : toRow;
      score += advancement * 0.15 * config.posWeight;
    }

    // Avoid moving into danger
    if (config.posWeight >= 0.5) {
      const oppColor = aiColor === 'white' ? 'black' : 'white';
      for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]) {
        const nr = toRow + dr, nc = toCol + dc;
        if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
          const threat = board[nr][nc];
          if (threat && threat.color === oppColor && threat.damage >= attacker.hp) {
            score -= pieceValue(attacker) * 0.15;
          }
        }
      }
    }

    // Development bonus: move pieces off starting row early
    if (config.posWeight >= 0.3) {
      const startRow = aiColor === 'white' ? 7 : 0;
      if (fromRow === startRow) score += 0.2 * config.posWeight;
    }
  }

  return score;
}

// ─── Minimax with alpha-beta ────────────────────────────────────────

function minimaxSearch(board, aiColor, enPassantTarget, config) {
  const moves = getAllMovesForColor(board, aiColor, enPassantTarget);
  if (moves.length === 0) return null;

  // For depth 0, just score moves directly
  if (config.depth === 0) {
    const scored = moves.map(m => ({
      ...m,
      score: scoreMove(board, m.fromRow, m.fromCol, m.toRow, m.toCol, m.move, aiColor, config)
        + Math.random() * 0.3,
    }));
    scored.sort((a, b) => b.score - a.score);

    const topN = Math.min(config.topN, scored.length);
    if (topN >= scored.length) {
      return scored[Math.floor(Math.random() * scored.length)];
    }
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

  // Pre-score all moves for ordering (captures first, then by heuristic score)
  const scored = moves.map(m => ({
    ...m,
    heuristic: scoreMove(board, m.fromRow, m.fromCol, m.toRow, m.toCol, m.move, aiColor, config),
  }));
  scored.sort((a, b) => b.heuristic - a.heuristic);

  let bestMove = null;
  let bestScore = -Infinity;

  for (const m of scored) {
    const simBoard = simulateMove(board, m.fromRow, m.fromCol, m.toRow, m.toCol, m.move);
    const score = minimax(
      simBoard, config.depth - 1, -Infinity, Infinity,
      false, aiColor, null, config.posWeight,
    );

    const noise = config.topN <= 1 ? 0.001 : 0.05;
    const noisyScore = score + Math.random() * noise;

    if (noisyScore > bestScore) {
      bestScore = noisyScore;
      bestMove = m;
    }
  }

  // For topN > 1, pick randomly from top candidates
  if (config.topN > 1 && scored.length > 1) {
    const allScored = scored.map(m => {
      const simBoard = simulateMove(board, m.fromRow, m.fromCol, m.toRow, m.toCol, m.move);
      return {
        ...m,
        score: minimax(simBoard, config.depth - 1, -Infinity, Infinity, false, aiColor, null, config.posWeight),
      };
    });
    allScored.sort((a, b) => b.score - a.score);
    const top = allScored.slice(0, Math.min(config.topN, allScored.length));
    return top[Math.floor(Math.random() * top.length)];
  }

  return bestMove;
}

function minimax(board, depth, alpha, beta, isMaximizing, aiColor, enPassantTarget, posWeight) {
  if (depth === 0) {
    return evaluateBoard(board, aiColor, posWeight);
  }

  const color = isMaximizing ? aiColor : (aiColor === 'white' ? 'black' : 'white');
  const moves = getAllMovesForColor(board, color, enPassantTarget);

  if (moves.length === 0) {
    return isMaximizing ? -50 : 50;
  }

  // Move ordering: captures first, prioritized by target value
  const ordered = [...moves].sort((a, b) => {
    const aVal = a.move.isCapture ? (pieceValue(board[a.toRow]?.[a.toCol]) + 10) : 0;
    const bVal = b.move.isCapture ? (pieceValue(board[b.toRow]?.[b.toCol]) + 10) : 0;
    return bVal - aVal;
  });

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const m of ordered) {
      const simBoard = simulateMove(board, m.fromRow, m.fromCol, m.toRow, m.toCol, m.move);
      const eval_ = minimax(simBoard, depth - 1, alpha, beta, false, aiColor, null, posWeight);
      maxEval = Math.max(maxEval, eval_);
      alpha = Math.max(alpha, eval_);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const m of ordered) {
      const simBoard = simulateMove(board, m.fromRow, m.fromCol, m.toRow, m.toCol, m.move);
      const eval_ = minimax(simBoard, depth - 1, alpha, beta, true, aiColor, null, posWeight);
      minEval = Math.min(minEval, eval_);
      beta = Math.min(beta, eval_);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

/**
 * Simulate a move on a cloned board (deterministic — assumes attacker damage)
 */
function simulateMove(board, fromRow, fromCol, toRow, toCol, move) {
  const newBoard = cloneBoard(board);
  const attacker = { ...newBoard[fromRow][fromCol] };

  if (move.isCapture) {
    const defender = newBoard[toRow][toCol];
    if (defender) {
      const dmg = attacker.damage;
      const newHp = defender.hp - dmg;

      if (newHp <= 0) {
        newBoard[fromRow][fromCol] = null;
        newBoard[toRow][toCol] = { ...attacker, hasMoved: true };
      } else {
        // Defender survives — attacker bounces back
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

/**
 * Get the AI's best move for the given difficulty level (1-10)
 * @returns {{ fromRow, fromCol, toRow, toCol, move }} or null
 */
export function getAIMove(board, color, difficulty, enPassantTarget) {
  const level = parseInt(difficulty, 10) || 5;
  const config = LEVEL_CONFIG[Math.max(1, Math.min(10, level))];
  return minimaxSearch(board, color, enPassantTarget, config);
}
