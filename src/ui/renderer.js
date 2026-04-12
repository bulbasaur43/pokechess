/**
 * Board Renderer for PokéChess — HP-Based Combat
 * Renders the 8×8 board with Pokémon pieces, HP bars, type badges, and damage tooltips
 */

import { ROLES } from '../engine/board.js';
import { TYPES, POKEMON, TEAMS, COLOR_TO_TEAM } from '../engine/types.js';
import { getBattlePreview } from '../engine/battle.js';

/**
 * Render the board to the DOM
 */
export function renderBoard(game, callbacks) {
  const container = document.getElementById('board-container');
  if (!container) return;
  container.innerHTML = '';

  const boardEl = document.createElement('div');
  boardEl.className = 'chess-board';
  boardEl.id = 'chess-board';

  const files = ['a','b','c','d','e','f','g','h'];
  const viewColor = game.onlineColor ?? game.playerColor ?? 'white';
  const flipped = viewColor === 'black';

  for (let ri = 0; ri < 8; ri++) {
    for (let ci = 0; ci < 8; ci++) {
      const row = flipped ? (7 - ri) : ri;
      const col = flipped ? (7 - ci) : ci;
      const cell = document.createElement('div');
      const isLight = (row + col) % 2 === 0;
      cell.className = `cell ${isLight ? 'cell--light' : 'cell--dark'}`;
      cell.dataset.row = row;
      cell.dataset.col = col;

      // Coords
      if (ci === 0) {
        const rl = document.createElement('span');
        rl.className = 'cell__coord cell__coord--rank';
        rl.textContent = 8 - row;
        cell.appendChild(rl);
      }
      if (ri === 7) {
        const fl = document.createElement('span');
        fl.className = 'cell__coord cell__coord--file';
        fl.textContent = files[col];
        cell.appendChild(fl);
      }

      // Selected
      if (game.selectedPiece?.row === row && game.selectedPiece?.col === col) {
        cell.classList.add('cell--selected');
      }

      // Last move highlights
      if (game.lastMove) {
        if ((game.lastMove.from.row === row && game.lastMove.from.col === col) ||
            (game.lastMove.to.row === row && game.lastMove.to.col === col)) {
          cell.classList.add('cell--last-move');
        }
      }

      // Legal moves
      const legalMove = game.legalMoves.find(m => m.row === row && m.col === col);
      if (legalMove) {
        if (legalMove.isCapture) {
          cell.classList.add('cell--capture');
        } else {
          const dot = document.createElement('div');
          dot.className = 'cell__move-dot';
          cell.appendChild(dot);
        }
      }

      // Optional attack targets
      if (game.pendingOptionalAttack) {
        const isTarget = game.pendingOptionalAttack.targets.some(t => t.row === row && t.col === col);
        if (isTarget) {
          cell.classList.add('cell--optional-attack');
        }
      }

      // Piece
      const piece = game.board[row][col];
      if (piece) {
        const pieceEl = createPieceElement(piece);
        cell.appendChild(pieceEl);

        // Battle tooltip on capture targets
        if (legalMove?.isCapture && game.selectedPiece) {
          const atk = game.board[game.selectedPiece.row][game.selectedPiece.col];
          if (atk) {
            const preview = getBattlePreview(atk, piece);
            const tooltip = createBattleTooltip(preview, atk, piece);
            cell.appendChild(tooltip);
            cell.classList.add('cell--has-tooltip');
          }
        }
      }

      // Click handler
      cell.addEventListener('click', () => {
        callbacks?.onCellClick?.(row, col, !!legalMove, legalMove);
      });

      boardEl.appendChild(cell);
    }
  }

  container.appendChild(boardEl);
}

/**
 * Create a piece element with Pokémon identity and HP bar
 */
function createPieceElement(piece) {
  const el = document.createElement('div');
  el.className = `piece piece--${piece.color}`;
  if (piece.role === 'TRUE_KING') el.classList.add('piece--true-king');
  if (piece.bikeMode) el.classList.add('piece--bike-mode');
  if (piece.promoted) el.classList.add('piece--promoted');
  el.dataset.pieceId = piece.id;
  el.dataset.role = piece.role;

  const team = TEAMS[COLOR_TO_TEAM[piece.color]];

  // Main visual — show image for any Pokémon that has one
  const pkmn = piece.pokemon ? POKEMON[piece.pokemon] : null;
  if (pkmn?.img) {
    const img = document.createElement('img');
    img.className = 'piece__img';
    if (piece.role === 'TRUE_KING') img.classList.add('piece__img--legendary');
    img.src = pkmn.img;
    img.alt = pkmn.name;
    img.draggable = false;
    el.appendChild(img);
  } else if (pkmn) {
    const symbol = document.createElement('span');
    symbol.className = 'piece__emoji';
    symbol.textContent = pkmn.emoji;
    el.appendChild(symbol);
  } else {
    const symbol = document.createElement('span');
    symbol.className = 'piece__emoji piece__emoji--pawn';
    symbol.textContent = team.pawnEmoji;
    el.appendChild(symbol);
  }

  // HP Bar
  const hpBar = document.createElement('div');
  hpBar.className = 'piece__hp-bar';
  const hpFill = document.createElement('div');
  hpFill.className = 'piece__hp-fill';
  const hpPercent = Math.max(0, (piece.hp / piece.maxHp) * 100);
  hpFill.style.width = `${hpPercent}%`;
  // Color based on HP percentage
  if (hpPercent > 60) hpFill.classList.add('hp--high');
  else if (hpPercent > 30) hpFill.classList.add('hp--mid');
  else hpFill.classList.add('hp--low');
  hpBar.appendChild(hpFill);
  el.appendChild(hpBar);

  // HP text (shown on hover)
  const hpText = document.createElement('span');
  hpText.className = 'piece__hp-text';
  hpText.textContent = `${piece.hp}/${piece.maxHp}`;
  el.appendChild(hpText);

  // Name label (on hover)
  const name = document.createElement('span');
  name.className = 'piece__name';
  if (pkmn) {
    name.textContent = `${pkmn.name} (DMG:${piece.damage})`;
  } else {
    name.textContent = team.pawnName;
  }
  el.appendChild(name);

  // Type color glow
  const primaryColor = TYPES[piece.types[0]]?.color ?? '#888';
  el.style.setProperty('--piece-type-color', primaryColor);
  el.style.setProperty('--piece-team-color', team.color);

  // Status effects (frozen / stunned)
  if (piece.statusEffect) {
    el.classList.add(`piece--${piece.statusEffect}`);
    const statusIcon = document.createElement('div');
    statusIcon.className = 'piece__status';
    statusIcon.textContent = piece.statusEffect === 'frozen' ? '❄️' : '😵';
    el.appendChild(statusIcon);
  }

  return el;
}

/**
 * Battle preview tooltip — HP-based
 */
function createBattleTooltip(preview, attacker, defender) {
  const tooltip = document.createElement('div');
  tooltip.className = 'battle-tooltip';

  const atkName = POKEMON[attacker.pokemon]?.name ?? 'Attacker';
  const defName = POKEMON[defender.pokemon]?.name ?? 'Defender';

  const tierEmoji = { weak: '🔹', standard: '⚔️', heavy: '💥' };
  const tierLabel = { weak: 'Weak', standard: 'Standard', heavy: 'Heavy' };
  const tier = preview.attackerDamageTier;

  const killText = preview.wouldKill
    ? '<span class="tooltip-kill">💀 WILL KILL</span>'
    : `<span class="tooltip-survive">❤️ Survives (${preview.defenderHpAfter} HP left)</span>`;

  const typeEffLabel = preview.typeMultiplier >= 2
    ? '<span class="tooltip-super-eff">🔥 Super Effective! (2x)</span>'
    : preview.typeMultiplier <= 0.5
    ? '<span class="tooltip-not-eff">🛡️ Not Very Effective (½x)</span>'
    : '';

  tooltip.innerHTML = `
    <div class="battle-tooltip__matchup">
      <span>${atkName}</span>
      <span class="battle-tooltip__arrow">→</span>
      <span>${defName}</span>
    </div>
    ${typeEffLabel ? `<div class="battle-tooltip__type-eff">${typeEffLabel}</div>` : ''}
    <div class="battle-tooltip__damage">
      ${tierEmoji[tier] ?? '⚔️'} ${tierLabel[tier] ?? 'Standard'} — ${preview.baseDamage} DMG
    </div>
    <div class="battle-tooltip__hp">
      ❤️ ${defender.hp}/${defender.maxHp} HP → ${preview.defenderHpAfter} HP
    </div>
    <div class="battle-tooltip__eff ${preview.wouldKill ? 'super-effective' : 'normal'}">${killText}</div>
    <div class="battle-tooltip__stats">${preview.critPercent}% crit (${preview.critDamage} DMG)</div>
  `;

  return tooltip;
}

export function animateCell(row, col, animClass, duration = 600) {
  const cell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
  if (cell) {
    cell.classList.add(animClass);
    setTimeout(() => cell.classList.remove(animClass), duration);
  }
}

/**
 * Show floating damage number on a cell
 */
export function showDamageNumber(row, col, damage, isCrit) {
  const cell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
  if (!cell) return;

  const dmgEl = document.createElement('div');
  dmgEl.className = `damage-number ${isCrit ? 'damage-number--crit' : ''}`;
  dmgEl.textContent = `-${damage}`;
  cell.appendChild(dmgEl);
  setTimeout(() => dmgEl.remove(), 1200);
}

/**
 * Play attack particle effect on a cell
 */
export function playAttackEffect(row, col, battleResult) {
  const cell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
  if (!cell) return;

  const rect = cell.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  const isKill = battleResult.outcome === 'kill';
  const isCrit = battleResult.isCritical;

  // Flash the cell
  const flashClass = isKill ? 'cell--flash-kill' : (isCrit ? 'cell--flash-crit' : 'cell--flash-hit');
  cell.classList.add(flashClass);
  setTimeout(() => cell.classList.remove(flashClass), 400);

  // Spawn impact particles
  const particleCount = isKill ? 16 : (isCrit ? 12 : 8);
  const hue = isKill ? '0' : (isCrit ? '45' : '30');

  for (let i = 0; i < particleCount; i++) {
    const p = document.createElement('div');
    p.className = `attack-particle ${isKill ? 'attack-particle--kill' : ''} ${isCrit ? 'attack-particle--crit' : ''}`;
    const angle = (Math.PI * 2 / particleCount) * i + (Math.random() - 0.5) * 0.5;
    const dist = 20 + Math.random() * 35;
    const size = 3 + Math.random() * 4;

    p.style.left = `${cx}px`;
    p.style.top = `${cy}px`;
    p.style.width = `${size}px`;
    p.style.height = `${size}px`;
    p.style.setProperty('--px', `${Math.cos(angle) * dist}px`);
    p.style.setProperty('--py', `${Math.sin(angle) * dist}px`);
    p.style.setProperty('--hue', hue);
    p.style.animationDelay = `${Math.random() * 80}ms`;

    document.body.appendChild(p);
    setTimeout(() => p.remove(), 700);
  }

  // Slash line effect
  const slash = document.createElement('div');
  slash.className = `attack-slash ${isKill ? 'attack-slash--kill' : ''}`;
  slash.style.left = `${cx}px`;
  slash.style.top = `${cy}px`;
  document.body.appendChild(slash);
  setTimeout(() => slash.remove(), 500);

  // Screen shake on kill
  if (isKill) {
    const board = document.getElementById('chess-board');
    if (board) {
      board.classList.add('board--shake');
      setTimeout(() => board.classList.remove('board--shake'), 300);
    }
  }
}
