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
import { POKEMON, getTypeMultiplier } from './types.js';
import { getPiece, cloneBoard, ROLES } from './board.js';

// ─── Difficulty Config ──────────────────────────────────────────────

const LEVEL_CONFIG = {
  1:  { depth: 0, topN: Infinity, posWeight: 0,    captureBonus: 0,   kingSafety: 0,   typeAware: false, label: 'Lv 1',  emoji: '1️⃣',  desc: 'Complete beginner',  rating: 400  },
  2:  { depth: 0, topN: Infinity, posWeight: 0,    captureBonus: 0.5, kingSafety: 0,   typeAware: false, label: 'Lv 2',  emoji: '2️⃣',  desc: 'Slightly aware',     rating: 550  },
  3:  { depth: 0, topN: 5,        posWeight: 0.3,  captureBonus: 1,   kingSafety: 0,   typeAware: false, label: 'Lv 3',  emoji: '3️⃣',  desc: 'Basic strategy',     rating: 700  },
  4:  { depth: 0, topN: 3,        posWeight: 0.5,  captureBonus: 1.5, kingSafety: 0.5, typeAware: true,  label: 'Lv 4',  emoji: '4️⃣',  desc: 'Developing player',  rating: 850  },
  5:  { depth: 1, topN: 2,        posWeight: 0.7,  captureBonus: 2,   kingSafety: 0.7, typeAware: true,  label: 'Lv 5',  emoji: '5️⃣',  desc: 'Competent',          rating: 1000 },
  6:  { depth: 2, topN: 2,        posWeight: 0.8,  captureBonus: 2,   kingSafety: 1,   typeAware: true,  label: 'Lv 6',  emoji: '6️⃣',  desc: 'Skilled',            rating: 1150 },
  7:  { depth: 2, topN: 1,        posWeight: 1,    captureBonus: 2.5, kingSafety: 1.2, typeAware: true,  label: 'Lv 7',  emoji: '7️⃣',  desc: 'Tough opponent',     rating: 1300 },
  8:  { depth: 3, topN: 1,        posWeight: 1,    captureBonus: 3,   kingSafety: 1.5, typeAware: true,  label: 'Lv 8',  emoji: '8️⃣',  desc: 'Advanced',           rating: 1500 },
  9:  { depth: 3, topN: 1,        posWeight: 1.3,  captureBonus: 3.5, kingSafety: 2,   typeAware: true,  label: 'Lv 9',  emoji: '9️⃣',  desc: 'Expert tactician',   rating: 1700 },
  10: { depth: 4, topN: 1,        posWeight: 1.5,  captureBonus: 4,   kingSafety: 2.5, typeAware: true,  label: 'Lv 10', emoji: '🔟', desc: 'Grandmaster',        rating: 2000 },
};

// ─── Piece value for evaluation ─────────────────────────────────────

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

// ─── Threat detection helpers ───────────────────────────────────────

/**
 * Check if a square is attacked by the given color.
 * Returns the total threat damage from all enemy pieces that can reach it.
 */
function getSquareThreats(board, row, col, attackerColor) {
  let totalThreat = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece || piece.color !== attackerColor) continue;
      if (piece.statusEffect) continue;

      const moves = getLegalMoves(board, r, c, null);
      for (const m of moves) {
        if (m.row === row && m.col === col && m.isCapture) {
          totalThreat += piece.damage;
          break;
        }
      }
    }
  }
  return totalThreat;
}

/**
 * Count how many pieces of a given color can attack a square
 */
function countAttackers(board, row, col, attackerColor) {
  let count = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece || piece.color !== attackerColor) continue;
      if (piece.statusEffect) continue;
      const moves = getLegalMoves(board, r, c, null);
      if (moves.some(m => m.row === row && m.col === col)) count++;
    }
  }
  return count;
}

/**
 * Check if a piece is hanging (can be captured with no defender nearby)
 */
function isHanging(board, row, col) {
  const piece = board[row]?.[col];
  if (!piece) return false;
  const oppColor = piece.color === 'white' ? 'black' : 'white';
  const threat = getSquareThreats(board, row, col, oppColor);
  if (threat <= 0) return false;
  // Check if any friendly piece defends this square
  const defenders = countAttackers(board, row, col, piece.color);
  return defenders <= 0;
}

// ─── Board evaluation ───────────────────────────────────────────────

function evaluateBoard(board, aiColor, config) {
  let score = 0;
  const oppColor = aiColor === 'white' ? 'black' : 'white';
  const posWeight = config.posWeight;
  const kingSafety = config.kingSafety;

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

  // If opponent king is dead, massive bonus
  if (!oppKingPos) return 9999;
  if (!aiKingPos) return -9999;

  // ── Phase detection: opening, midgame, endgame ──
  const totalPieces = aiPieceCount + oppPieceCount;
  const isEndgame = totalPieces <= 10;
  const isOpening = totalPieces >= 26;

  // Second pass: full evaluation
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;

      const val = pieceValue(piece);

      if (piece.color === aiColor) {
        score += val;

        // Center control (more important in opening/midgame)
        const centerDist = Math.abs(r - 3.5) + Math.abs(c - 3.5);
        const centerWeight = isEndgame ? 0.02 : 0.06;
        score += (7 - centerDist) * centerWeight * posWeight;

        // Forward advancement (pawns want to promote)
        if (piece.isPawn || piece.role === 'PAWN') {
          const advancement = aiColor === 'white' ? (7 - r) : r;
          score += advancement * 0.2 * posWeight;
          // Extra bonus for being close to promotion
          if (advancement >= 6) score += 2 * posWeight;
          if (advancement >= 5) score += 1 * posWeight;
        }

        // Piece coordination — adjacent friendly pieces
        if (posWeight >= 0.5) {
          for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
              const adj = board[nr][nc];
              if (adj && adj.color === aiColor) score += 0.04 * posWeight;
            }
          }
        }

        // Proximity to opponent king (attack pressure) — STRONGER in endgame
        if (posWeight >= 0.7 && oppKingPos) {
          const dist = Math.abs(r - oppKingPos.r) + Math.abs(c - oppKingPos.c);
          if (piece.role !== 'TRUE_KING') {
            const pressureWeight = isEndgame ? 0.35 : 0.18;
            if (dist <= 4) score += (5 - dist) * pressureWeight * posWeight;
          }
        }

        // Penalize hanging pieces (undefended pieces under threat)
        if (posWeight >= 0.7) {
          const threat = getSquareThreats(board, r, c, oppColor);
          if (threat > 0) {
            const defenders = countAttackers(board, r, c, aiColor);
            if (defenders <= 0) {
              // Piece is hanging — big penalty scaled by value
              score -= val * 0.6 * posWeight;
            } else if (threat >= piece.hp) {
              // Piece can be killed even with defenders
              score -= val * 0.3 * posWeight;
            }
          }
        }

        // Status penalty
        if (piece.statusEffect) score -= 1.5;
      } else {
        score -= val;

        // Opponent's TRUE_KING low HP — get very aggressive!
        if (piece.role === 'TRUE_KING' && posWeight >= 0.5) {
          const hpPercent = piece.hp / piece.maxHp;
          if (hpPercent <= 0.5) {
            score += (1 - hpPercent) * 8 * posWeight;
          }
        }

        // Opponent hanging pieces — attack opportunity
        if (posWeight >= 0.7) {
          const threat = getSquareThreats(board, r, c, aiColor);
          if (threat > 0) {
            const defenders = countAttackers(board, r, c, oppColor);
            if (defenders <= 0) {
              // Opponent piece is hanging — bonus for us
              score += val * 0.4 * posWeight;
            }
          }
        }

        // Opponent piece threatening our king
        if (kingSafety > 0 && aiKingPos) {
          const dist = Math.abs(r - aiKingPos.r) + Math.abs(c - aiKingPos.c);
          if (dist <= 2) score -= (3 - dist) * 0.5 * kingSafety;
          if (dist <= 1) score -= piece.damage * 0.3 * kingSafety;
        }

        if (piece.statusEffect) score += 0.7;
      }
    }
  }

  // ── King safety evaluation ──
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

    // King on edge is more dangerous in endgame
    if (isEndgame) {
      const edgeDist = Math.min(aiKingPos.r, 7 - aiKingPos.r, aiKingPos.c, 7 - aiKingPos.c);
      if (edgeDist <= 1) score -= 0.5 * kingSafety;
    }

    // King HP matters a lot
    const kingHpPercent = aiKingPos.piece.hp / aiKingPos.piece.maxHp;
    if (kingHpPercent <= 0.5) {
      score -= (1 - kingHpPercent) * 3 * kingSafety;
    }
  }

  // ── Material advantage amplification ──
  if (posWeight >= 0.5) {
    const materialAdv = aiPieceCount - oppPieceCount;
    score += materialAdv * 0.6 * posWeight;

    // HP advantage matters too
    const hpAdvantage = (aiTotalHp / Math.max(1, aiTotalMaxHp)) - (oppTotalHp / Math.max(1, oppTotalMaxHp));
    score += hpAdvantage * 2 * posWeight;
  }

  // ── Endgame: drive opponent king to corner ──
  if (isEndgame && posWeight >= 1 && oppKingPos) {
    const oppKingEdge = Math.min(oppKingPos.r, 7 - oppKingPos.r, oppKingPos.c, 7 - oppKingPos.c);
    score += (3 - oppKingEdge) * 0.4 * posWeight;

    // AI king should approach opponent king in endgame
    if (aiKingPos) {
      const kingDist = Math.abs(aiKingPos.r - oppKingPos.r) + Math.abs(aiKingPos.c - oppKingPos.c);
      score += (14 - kingDist) * 0.15 * posWeight;
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

// ─── Score a single move (used for move ordering & low-depth) ────────

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
        // Killing a piece is great — bonus scaled by target value
        score += pieceValue(defender) * config.captureBonus;
        // Killing TRUE_KING = instant-win priority
        if (defender.role === 'TRUE_KING') score += 1000;
        // MVV-LVA: prefer killing high-value targets with low-value attackers
        score += (pieceValue(defender) - pieceValue(attacker) * 0.3) * 0.5;
      } else {
        // Dealing damage — weighted by percentage of HP removed
        const hpPercent = preview.baseDamage / defender.maxHp;
        score += hpPercent * pieceValue(defender) * 0.6;

        // Don't throw valuable pieces into non-lethal trades
        if (pieceValue(attacker) > pieceValue(defender) * 1.5) {
          score -= pieceValue(attacker) * 0.3;
        }

        // TRUE_KING as attacker doing chip damage loses tempo — penalize
        if (attacker.role === 'TRUE_KING' && !preview.wouldKill) {
          score -= 2;
        }
      }

      // Type advantage awareness
      if (config.typeAware) {
        const typeMult = getTypeMultiplier(attacker.types, defender.types);
        if (typeMult >= 2) score += 1.5;
        else if (typeMult <= 0.5) score -= 1.5;
      }

      // After-capture vulnerability check
      if (config.posWeight >= 0.5) {
        // Check if we'd be vulnerable after capturing (for kills where we move to the square)
        if (preview.wouldKill) {
          const threatAfter = getSquareThreats(board, toRow, toCol, oppColor);
          if (threatAfter >= attacker.hp) {
            // We'll likely die after capturing — is the trade worth it?
            const tradeValue = pieceValue(defender) - pieceValue(attacker);
            if (tradeValue < -1) score -= Math.abs(tradeValue) * 0.5;
          }
        }
      }

      // Don't trade valuable pieces
      score -= pieceValue(attacker) * 0.05;
    }
  } else {
    // ── Non-capture moves ──

    // Center control
    const centerDist = Math.abs(toRow - 3.5) + Math.abs(toCol - 3.5);
    score += (7 - centerDist) * 0.05 * config.posWeight;

    // Pawn advancement (toward promotion)
    if (attacker.isPawn || attacker.role === 'PAWN') {
      const advancement = aiColor === 'white' ? (7 - toRow) : toRow;
      score += advancement * 0.2 * config.posWeight;
      if (advancement >= 6) score += 1.5 * config.posWeight;
    }

    // Development: move pieces off starting row
    if (config.posWeight >= 0.3) {
      const startRow = aiColor === 'white' ? 7 : 0;
      if (fromRow === startRow) score += 0.3 * config.posWeight;
    }

    // Avoid moving into danger
    if (config.posWeight >= 0.5) {
      const threatAtDest = getSquareThreats(board, toRow, toCol, oppColor);
      if (threatAtDest >= attacker.hp) {
        score -= pieceValue(attacker) * 0.5;
      } else if (threatAtDest > 0) {
        score -= pieceValue(attacker) * 0.15;
      }
    }

    // Move toward opponent king if we're aggressive pieces
    if (config.posWeight >= 0.7 && attacker.role !== 'TRUE_KING') {
      // Find opponent king
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = board[r][c];
          if (p && p.color === oppColor && p.role === 'TRUE_KING') {
            const oldDist = Math.abs(fromRow - r) + Math.abs(fromCol - c);
            const newDist = Math.abs(toRow - r) + Math.abs(toCol - c);
            if (newDist < oldDist) score += 0.3 * config.posWeight;
          }
        }
      }
    }

    // Don't move the king into danger
    if (attacker.role === 'TRUE_KING' && config.kingSafety > 0) {
      const threatAtDest = getSquareThreats(board, toRow, toCol, oppColor);
      if (threatAtDest > 0) {
        score -= 3 * config.kingSafety;
      }
    }

    // Rescue hanging pieces — moving a threatened piece to safety
    if (config.posWeight >= 0.5) {
      const currentThreat = getSquareThreats(board, fromRow, fromCol, oppColor);
      const destThreat = getSquareThreats(board, toRow, toCol, oppColor);
      if (currentThreat >= attacker.hp && destThreat < attacker.hp) {
        score += pieceValue(attacker) * 0.4;
      }
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

  // Pre-score all moves for ordering (better ordering = better pruning)
  const scored = moves.map(m => ({
    ...m,
    heuristic: scoreMove(board, m.fromRow, m.fromCol, m.toRow, m.toCol, m.move, aiColor, config),
  }));
  scored.sort((a, b) => b.heuristic - a.heuristic);

  // For higher depths, prune the move list to avoid timeout
  const maxMoves = config.depth >= 4 ? 15 : config.depth >= 3 ? 20 : scored.length;
  const prunedMoves = scored.slice(0, maxMoves);

  let bestMove = null;
  let bestScore = -Infinity;

  for (const m of prunedMoves) {
    const simBoard = simulateMove(board, m.fromRow, m.fromCol, m.toRow, m.toCol, m.move);
    const score = minimax(
      simBoard, config.depth - 1, -Infinity, Infinity,
      false, aiColor, null, config,
    );

    const noise = config.topN <= 1 ? 0.001 : 0.05;
    const noisyScore = score + Math.random() * noise;

    if (noisyScore > bestScore) {
      bestScore = noisyScore;
      bestMove = m;
    }
  }

  // For topN > 1, pick randomly from top candidates
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
    return evaluateBoard(board, aiColor, config);
  }

  const color = isMaximizing ? aiColor : (aiColor === 'white' ? 'black' : 'white');
  const moves = getAllMovesForColor(board, color, enPassantTarget);

  if (moves.length === 0) {
    return isMaximizing ? -50 : 50;
  }

  // Move ordering: captures first, prioritized by target value + type advantage
  const ordered = [...moves].sort((a, b) => {
    const aTarget = board[a.toRow]?.[a.toCol];
    const bTarget = board[b.toRow]?.[b.toCol];
    let aVal = a.move.isCapture && aTarget ? (pieceValue(aTarget) + 10) : 0;
    let bVal = b.move.isCapture && bTarget ? (pieceValue(bTarget) + 10) : 0;

    // King captures are highest priority
    if (aTarget?.role === 'TRUE_KING') aVal += 500;
    if (bTarget?.role === 'TRUE_KING') bVal += 500;

    return bVal - aVal;
  });

  // Prune at deeper levels to keep performance
  const maxWidth = depth >= 3 ? 12 : depth >= 2 ? 18 : ordered.length;
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
 * Simulate a move on a cloned board — uses type-aware damage
 */
function simulateMove(board, fromRow, fromCol, toRow, toCol, move) {
  const newBoard = cloneBoard(board);
  const attacker = { ...newBoard[fromRow][fromCol] };

  if (move.isCapture) {
    const defender = newBoard[toRow][toCol];
    if (defender) {
      // Use type-aware damage calculation (same as real battle)
      const typeMult = getTypeMultiplier(attacker.types, defender.types);
      const dmg = Math.max(1, Math.floor(attacker.damage * typeMult));
      const newHp = defender.hp - dmg;

      if (newHp <= 0) {
        newBoard[fromRow][fromCol] = null;
        newBoard[toRow][toCol] = { ...attacker, hasMoved: true };
      } else {
        // Defender survives — attacker bounces back, defender takes damage
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
