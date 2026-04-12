/**
 * Legal Move Generation for PokéChess
 * Includes TRUE_KING (knight+bishop+rook) and standard chess pieces
 */

import { getPiece } from './board.js';

const ROOK_DIRS = [[-1,0],[1,0],[0,-1],[0,1]];
const BISHOP_DIRS = [[-1,-1],[-1,1],[1,-1],[1,1]];
const KNIGHT_JUMPS = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];

function inBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }

/**
 * Get all legal moves for a piece at (row, col)
 * @returns {Array<{row, col, isCapture, special?, moveType?}>}
 */
export function getLegalMoves(board, row, col, enPassantTarget = null) {
  const piece = getPiece(board, row, col);
  if (!piece) return [];

  // Flying bishops: Roaring Moon and Iron Jugulis ALWAYS fly, regardless of role
  if (piece.pokemon === 'ROARING_MOON' || piece.pokemon === 'IRON_JUGULIS') {
    return getFlyingBishopMoves(board, row, col, piece);
  }

  switch (piece.role) {
    case 'PAWN':      return getPawnMoves(board, row, col, piece, enPassantTarget);
    case 'ROOK':      return getSlidingMoves(board, row, col, piece, ROOK_DIRS);
    case 'BISHOP':    return getFlyingBishopMoves(board, row, col, piece);
    case 'QUEEN':     return getSlidingMoves(board, row, col, piece, [...ROOK_DIRS, ...BISHOP_DIRS]);
    case 'KNIGHT':    return getKnightMoves(board, row, col, piece);
    case 'KING':      return getKingMoves(board, row, col, piece);
    case 'TRUE_KING': return getTrueKingMoves(board, row, col, piece);
    default:          return [];
  }
}

// ─── Pawn ───────────────────────────────────────────────────────────

function getPawnMoves(board, row, col, piece, enPassantTarget) {
  const moves = [];
  const dir = piece.color === 'white' ? -1 : 1;
  const startRow = piece.color === 'white' ? 6 : 1;
  const promoRow = piece.color === 'white' ? 0 : 7;

  // Forward 1
  const f1 = row + dir;
  if (inBounds(f1, col) && !board[f1][col]) {
    moves.push({ row: f1, col, isCapture: false, special: f1 === promoRow ? 'promotion' : undefined });
    // Forward 2
    if (row === startRow) {
      const f2 = row + dir * 2;
      if (inBounds(f2, col) && !board[f2][col]) {
        moves.push({ row: f2, col, isCapture: false, special: 'double_push' });
      }
    }
  }

  // Diagonal captures
  for (const dc of [-1, 1]) {
    const cr = row + dir, cc = col + dc;
    if (!inBounds(cr, cc)) continue;
    const target = board[cr][cc];
    if (target && target.color !== piece.color) {
      moves.push({ row: cr, col: cc, isCapture: true, special: cr === promoRow ? 'promotion' : undefined });
    }
    // En passant
    if (enPassantTarget && enPassantTarget.row === cr && enPassantTarget.col === cc) {
      moves.push({ row: cr, col: cc, isCapture: true, special: 'en_passant' });
    }
  }
  return moves;
}

// ─── Sliding Pieces (Rook, Bishop, Queen) ───────────────────────────

function getSlidingMoves(board, row, col, piece, directions) {
  const moves = [];
  for (const [dr, dc] of directions) {
    let r = row + dr, c = col + dc;
    while (inBounds(r, c)) {
      const target = board[r][c];
      if (!target) {
        moves.push({ row: r, col: c, isCapture: false });
      } else {
        if (target.color !== piece.color) moves.push({ row: r, col: c, isCapture: true });
        break;
      }
      r += dr; c += dc;
    }
  }
  return moves;
}

// ─── Flying Bishop (Roaring Moon / Iron Jugulis) ────────────────────
// Can fly over pieces to reach empty squares beyond them.
// Can ONLY capture if the path to the target is completely clear.

function getFlyingBishopMoves(board, row, col, piece) {
  const moves = [];
  for (const [dr, dc] of BISHOP_DIRS) {
    let r = row + dr, c = col + dc;
    let jumped = false; // Have we flown over any piece?
    while (inBounds(r, c)) {
      const target = board[r][c];
      if (!target) {
        // Empty square — can always move here (even after jumping)
        moves.push({ row: r, col: c, isCapture: false });
      } else if (target.color !== piece.color) {
        // Enemy — can only capture if we haven't jumped over anything
        if (!jumped) {
          moves.push({ row: r, col: c, isCapture: true });
        }
        // Either way, this piece is now "jumped over" for squares beyond
        jumped = true;
      } else {
        // Friendly piece — mark as jumped, continue flying
        jumped = true;
      }
      r += dr; c += dc;
    }
  }
  return moves;
}

// ─── Knight ─────────────────────────────────────────────────────────

function getKnightMoves(board, row, col, piece) {
  const moves = [];
  for (const [dr, dc] of KNIGHT_JUMPS) {
    const r = row + dr, c = col + dc;
    if (!inBounds(r, c)) continue;
    const target = board[r][c];
    if (!target) moves.push({ row: r, col: c, isCapture: false });
    else if (target.color !== piece.color) moves.push({ row: r, col: c, isCapture: true });
  }
  return moves;
}

// ─── King (non-losing, moves like standard king) ────────────────────

function getKingMoves(board, row, col, piece) {
  const moves = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const r = row + dr, c = col + dc;
      if (!inBounds(r, c)) continue;
      const target = board[r][c];
      if (!target) moves.push({ row: r, col: c, isCapture: false });
      else if (target.color !== piece.color) moves.push({ row: r, col: c, isCapture: true });
    }
  }

  // Castling (True King castles, not the non-losing King)
  // Non-losing King does NOT castle

  return moves;
}

// ─── True King (Koraidon/Miraidon: knight + bishop + rook) ─────────
// Sliding moves (bishop + rook) cannot jump over pieces.
// Knight moves CAN jump.
// The True King can also castle from the king's starting position.

function getTrueKingMoves(board, row, col, piece) {
  const moves = [];
  const seen = new Set(); // Prevent duplicate squares

  const addMove = (r, c, isCapture, moveType) => {
    const key = `${r},${c}`;
    if (!seen.has(key)) {
      seen.add(key);
      moves.push({ row: r, col: c, isCapture, moveType });
    }
  };

  // Rook-like sliding (straight lines, blocked by pieces)
  for (const [dr, dc] of ROOK_DIRS) {
    let r = row + dr, c = col + dc;
    while (inBounds(r, c)) {
      const target = board[r][c];
      if (!target) { addMove(r, c, false, 'rook'); }
      else {
        if (target.color !== piece.color) addMove(r, c, true, 'rook');
        break;
      }
      r += dr; c += dc;
    }
  }

  // Bishop-like sliding (diagonals, blocked by pieces)
  for (const [dr, dc] of BISHOP_DIRS) {
    let r = row + dr, c = col + dc;
    while (inBounds(r, c)) {
      const target = board[r][c];
      if (!target) { addMove(r, c, false, 'bishop'); }
      else {
        if (target.color !== piece.color) addMove(r, c, true, 'bishop');
        break;
      }
      r += dr; c += dc;
    }
  }

  // Knight-like jumps (can jump over pieces)
  for (const [dr, dc] of KNIGHT_JUMPS) {
    const r = row + dr, c = col + dc;
    if (!inBounds(r, c)) continue;
    const target = board[r][c];
    if (!target) addMove(r, c, false, 'knight');
    else if (target.color !== piece.color) addMove(r, c, true, 'knight');
  }

  // Castling for True King
  if (!piece.hasMoved) {
    // Kingside
    const kRook = board[row][7];
    if (kRook && kRook.role === 'ROOK' && !kRook.hasMoved && kRook.color === piece.color) {
      if (!board[row][5] && !board[row][6]) {
        addMove(row, 6, false, 'castle_king');
      }
    }
    // Queenside
    const qRook = board[row][0];
    if (qRook && qRook.role === 'ROOK' && !qRook.hasMoved && qRook.color === piece.color) {
      if (!board[row][1] && !board[row][2] && !board[row][3]) {
        addMove(row, 2, false, 'castle_queen');
      }
    }
  }

  return moves;
}
