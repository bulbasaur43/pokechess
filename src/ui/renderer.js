/**
 * Board Renderer for PokéChess — HP-Based Combat
 * Renders the 8×8 board with Pokémon pieces, HP bars, type badges, and damage tooltips
 * Uses in-place cell updates to avoid full DOM rebuilds and animation glitches
 */

import { ROLES } from '../engine/board.js';
import { TYPES, POKEMON, TEAMS, COLOR_TO_TEAM } from '../engine/types.js';
import { getBattlePreview } from '../engine/battle.js';
import { getEquippedCosmetic, COSMETICS } from './shop.js';

// ── Per-Pokémon head positions (from sprite anatomy analysis) ──
// headTop: % from top to face center, headLeft: % horizontal head center, headScale: size multiplier
const POKEMON_HEAD_MAP = {
  // Scarlet Paradox
  KORAIDON:     { headTop: 12, headLeft: 50, headScale: 1.1 },  // tall bipedal, head at very top
  SANDY_SHOCKS: { headTop: 25, headLeft: 50, headScale: 0.9 },  // floating, round head center-top
  FLUTTER_MANE: { headTop: 18, headLeft: 48, headScale: 1.0 },  // ghostly, face in upper area
  RAGING_BOLT:  { headTop: 10, headLeft: 50, headScale: 1.0 },  // very tall neck, tiny head at top
  ROARING_MOON: { headTop: 15, headLeft: 45, headScale: 1.1 },  // dragon, head top-left
  SCREAM_TAIL:  { headTop: 22, headLeft: 50, headScale: 1.2 },  // round jigglypuff, big face
  GREAT_TUSK:   { headTop: 18, headLeft: 55, headScale: 1.1 },  // elephant, head center-right
  BRUTE_BONNET: { headTop: 15, headLeft: 50, headScale: 1.2 },  // mushroom, cap is head area
  SLITHER_WING: { headTop: 15, headLeft: 50, headScale: 1.0 },  // bug, head at top center
  WALKING_WAKE: { headTop: 12, headLeft: 45, headScale: 1.0 },  // suicune, head top-left
  GOUGING_FIRE: { headTop: 12, headLeft: 48, headScale: 1.0 },  // entei, head at top
  // Scarlet Classics
  BULBASAUR:    { headTop: 30, headLeft: 55, headScale: 1.0 },  // short quadruped, face center
  CHARIZARD:    { headTop: 10, headLeft: 50, headScale: 0.9 },  // tall dragon, small head at top
  DRAGONITE:    { headTop: 12, headLeft: 50, headScale: 1.0 },  // tall bipedal, head at top
  GARCHOMP:     { headTop: 10, headLeft: 50, headScale: 1.0 },  // tall shark dragon
  BLAZIKEN:     { headTop: 8,  headLeft: 50, headScale: 0.9 },  // tall fighter, small head
  SCEPTILE:     { headTop: 10, headLeft: 48, headScale: 1.0 },  // tall lizard
  GHOLDENGO:    { headTop: 12, headLeft: 50, headScale: 1.0 },  // humanoid ghost
  CHI_YU:       { headTop: 20, headLeft: 50, headScale: 1.1 },  // small fish, big face
  INCINEROAR:   { headTop: 10, headLeft: 50, headScale: 1.0 },  // tall bipedal wrestler
  MAGCARGO:     { headTop: 22, headLeft: 50, headScale: 1.0 },  // snail, head in middle
  COMFEY:       { headTop: 25, headLeft: 50, headScale: 0.8 },  // tiny flower ring
  // Violet Paradox
  MIRAIDON:     { headTop: 10, headLeft: 50, headScale: 1.0 },  // tall mech dragon
  IRON_MOTH:    { headTop: 20, headLeft: 50, headScale: 1.1 },  // moth, center face
  IRON_CROWN:   { headTop: 10, headLeft: 50, headScale: 1.0 },  // tall mech deer
  IRON_BOULDER: { headTop: 12, headLeft: 50, headScale: 1.0 },  // mech bull
  IRON_JUGULIS: { headTop: 12, headLeft: 50, headScale: 1.0 },  // 3-headed flyer
  IRON_BUNDLE:  { headTop: 15, headLeft: 50, headScale: 1.1 },  // mech penguin
  IRON_TREADS:  { headTop: 18, headLeft: 55, headScale: 1.0 },  // mech elephant
  IRON_HANDS:   { headTop: 10, headLeft: 50, headScale: 1.1 },  // big mech fighter
  IRON_THORNS:  { headTop: 10, headLeft: 50, headScale: 1.0 },  // mech tyranitar
  IRON_VALIANT: { headTop: 8,  headLeft: 50, headScale: 0.9 },  // slim mech gallade
  IRON_LEAVES:  { headTop: 10, headLeft: 50, headScale: 1.0 },  // mech virizion
  // Violet Classics
  PIKACHU:      { headTop: 18, headLeft: 50, headScale: 1.2 },  // short, big head
  GENGAR:       { headTop: 15, headLeft: 50, headScale: 1.3 },  // round ghost, huge face
  METAGROSS:    { headTop: 20, headLeft: 50, headScale: 1.2 },  // flat mech spider, face fills center
  LUCARIO:      { headTop: 10, headLeft: 50, headScale: 1.0 },  // bipedal, head at top
  GARDEVOIR:    { headTop: 8,  headLeft: 50, headScale: 0.9 },  // tall fairy, small head
  SYLVEON:      { headTop: 15, headLeft: 50, headScale: 1.0 },  // quad fairy
  DRAGAPULT:    { headTop: 12, headLeft: 45, headScale: 1.0 },  // long dragon
  CHIEN_PAO:    { headTop: 15, headLeft: 50, headScale: 1.0 },  // mech leopard
  ZAPDOS:       { headTop: 10, headLeft: 50, headScale: 0.9 },  // tall bird
  BRAMBLEGHAST: { headTop: 20, headLeft: 50, headScale: 1.1 },  // tumbleweed
  AUDINO:       { headTop: 15, headLeft: 50, headScale: 1.2 },  // round, big head
};
const DEFAULT_HEAD = { headTop: 15, headLeft: 50, headScale: 1.0 };

// Persistent board grid — built once, updated in-place
let _cells = null; // Map<"row,col", HTMLElement>
let _boardEl = null;
let _lastViewColor = null;

// Rainbow trail state (cosmetic only)
let _rainbowTrails = []; // { row, col, age }
let _lastBoard = null;  // snapshot to detect moves

/**
 * Render the board to the DOM
 */
export function renderBoard(game, callbacks) {
  const container = document.getElementById('board-container');
  if (!container) return;

  const viewColor = game.onlineColor ?? game.playerColor ?? 'white';
  const flipped = viewColor === 'black';
  const files = ['a','b','c','d','e','f','g','h'];

  // Build grid skeleton once (or when perspective flips or board was detached)
  if (!_boardEl || !document.contains(_boardEl) || _lastViewColor !== viewColor) {
    const oldBoard = container.querySelector('.chess-board');
    if (oldBoard) oldBoard.remove();

    _cells = new Map();
    _boardEl = document.createElement('div');
    _boardEl.className = 'chess-board';
    _boardEl.id = 'chess-board';

    for (let ri = 0; ri < 8; ri++) {
      for (let ci = 0; ci < 8; ci++) {
        const row = flipped ? (7 - ri) : ri;
        const col = flipped ? (7 - ci) : ci;
        const cell = document.createElement('div');
        const isLight = (row + col) % 2 === 0;
        cell.className = `cell ${isLight ? 'cell--light' : 'cell--dark'}`;
        cell.dataset.row = row;
        cell.dataset.col = col;

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

        _cells.set(`${row},${col}`, cell);
        _boardEl.appendChild(cell);
      }
    }

    container.prepend(_boardEl);
    _lastViewColor = viewColor;
  }

  // ── Rainbow trail detection ──
  if (getEquippedCosmetic() === 'RAINBOW' && _lastBoard) {
    const playerColor = game.onlineColor ?? game.playerColor ?? 'white';
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const prev = _lastBoard[r]?.[c];
        const curr = game.board[r][c];
        // A player piece left this cell
        if (prev && prev.color === playerColor && (!curr || curr !== prev)) {
          // Don't add duplicate
          if (!_rainbowTrails.some(t => t.row === r && t.col === c)) {
            _rainbowTrails.push({ row: r, col: c, age: 0 });
          }
        }
      }
    }
    // Age all trails and remove old ones
    _rainbowTrails = _rainbowTrails
      .map(t => ({ ...t, age: t.age + 1 }))
      .filter(t => t.age <= 10);
  } else if (getEquippedCosmetic() !== 'RAINBOW') {
    _rainbowTrails = [];
  }
  // Snapshot board for next comparison
  _lastBoard = game.board.map(row => row.map(cell => cell));

  // Update each cell in-place (no DOM destroy/rebuild)
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const cell = _cells.get(`${row},${col}`);
      if (!cell) continue;

      // Reset dynamic classes
      const isLight = (row + col) % 2 === 0;
      cell.className = `cell ${isLight ? 'cell--light' : 'cell--dark'}`;

      // Remove dynamic children (pieces, dots, tooltips, lava) but keep coords
      for (let i = cell.children.length - 1; i >= 0; i--) {
        const child = cell.children[i];
        if (child.classList.contains('cell__coord')) continue;
        child.remove();
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

      // Lava trail overlay
      if (game.lavaTrails && game.lavaTrails.length > 0) {
        const lava = game.lavaTrails.find(t => t.row === row && t.col === col);
        if (lava) {
          cell.classList.add('cell--lava-trail');
          const lavaPool = document.createElement('div');
          lavaPool.className = 'cell__lava-pool';
          for (let b = 0; b < 4; b++) {
            const bubble = document.createElement('div');
            bubble.className = 'cell__lava-bubble';
            bubble.style.setProperty('--bx', `${15 + Math.random() * 70}%`);
            bubble.style.setProperty('--by', `${20 + Math.random() * 60}%`);
            bubble.style.setProperty('--bd', `${0.6 + Math.random() * 1.2}s`);
            bubble.style.setProperty('--bdelay', `${Math.random() * 1.5}s`);
            lavaPool.appendChild(bubble);
          }
          cell.appendChild(lavaPool);
        }
      }

      // Rainbow trail overlay (cosmetic — only when RAINBOW equipped)
      if (getEquippedCosmetic() === 'RAINBOW') {
        const trail = _rainbowTrails.find(t => t.row === row && t.col === col);
        if (trail) {
          cell.classList.add('cell--rainbow-trail');
          cell.style.setProperty('--rainbow-age', trail.age);
        }
      }

      // Piece
      const piece = game.board[row][col];
      if (piece) {
        const playerColor = game.onlineColor ?? game.playerColor ?? 'white';
        const pieceEl = createPieceElement(piece, playerColor);
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

      // Update click handler via data attribute
      cell.onclick = () => {
        callbacks?.onCellClick?.(row, col, !!legalMove, legalMove);
      };
    }
  }
}

/**
 * Create a piece element with Pokémon identity and HP bar
 */
function createPieceElement(piece, playerColor) {
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

  // Cosmetic overlay — only on the PLAYER's pieces
  const isPlayerPiece = piece.color === playerColor;
  const cosmeticId = isPlayerPiece ? getEquippedCosmetic() : null;
  if (cosmeticId) {
    const cosmetic = COSMETICS[cosmeticId];
    if (cosmetic) {
      // Get per-Pokémon head data for positioning
      const headData = (piece.pokemon && POKEMON_HEAD_MAP[piece.pokemon]) || DEFAULT_HEAD;

      if (cosmeticId === 'SPARKLE') {
        for (let i = 0; i < 5; i++) {
          const spark = document.createElement('span');
          spark.className = 'piece__sparkle';
          spark.textContent = '✨';
          spark.style.setProperty('--sx', `${10 + Math.random() * 80}%`);
          spark.style.setProperty('--sy', `${10 + Math.random() * 80}%`);
          spark.style.setProperty('--sd', `${0.5 + Math.random() * 1.5}s`);
          spark.style.setProperty('--sdelay', `${Math.random() * 2}s`);
          el.appendChild(spark);
        }
      } else if (cosmeticId === 'FLAME_AURA') {
        el.classList.add('piece__aura--flame');
        for (let i = 0; i < 4; i++) {
          const flame = document.createElement('span');
          flame.className = 'piece__flame-particle';
          flame.textContent = '🔥';
          flame.style.setProperty('--fx', `${10 + Math.random() * 80}%`);
          flame.style.setProperty('--fd', `${0.6 + Math.random() * 1}s`);
          flame.style.setProperty('--fdelay', `${Math.random() * 1.5}s`);
          el.appendChild(flame);
        }
      } else if (cosmeticId === 'ICE_AURA') {
        el.classList.add('piece__aura--ice');
        for (let i = 0; i < 4; i++) {
          const frost = document.createElement('span');
          frost.className = 'piece__frost-particle';
          frost.textContent = '❄️';
          frost.style.setProperty('--ix', `${10 + Math.random() * 80}%`);
          frost.style.setProperty('--id', `${0.8 + Math.random() * 1.2}s`);
          frost.style.setProperty('--idelay', `${Math.random() * 2}s`);
          el.appendChild(frost);
        }
      } else if (cosmetic.img) {
        const img = document.createElement('img');
        img.className = `piece__cosmetic piece__cosmetic--${cosmetic.position} piece__cosmetic--img`;
        img.src = cosmetic.img;
        img.draggable = false;
        // Dynamic per-Pokémon positioning via inline styles
        const baseSize = cosmetic.position === 'middle' ? 55 : cosmetic.position === 'top' ? 60 : 40;
        const size = Math.round(baseSize * headData.headScale);
        img.style.width = `${size}%`;
        if (cosmetic.position === 'top') {
          img.style.top = `${headData.headTop - 12}%`;
          img.style.left = `${headData.headLeft}%`;
          img.style.transform = 'translateX(-50%)';
        } else if (cosmetic.position === 'middle') {
          img.style.top = `${headData.headTop}%`;
          img.style.left = `${headData.headLeft}%`;
          img.style.transform = 'translate(-50%, -15%)';
        } else if (cosmetic.position === 'aura') {
          img.style.bottom = '5%';
          img.style.right = '-8px';
          img.style.top = 'auto';
          img.style.left = 'auto';
        }
        el.appendChild(img);
      } else {
        const overlay = document.createElement('span');
        overlay.className = `piece__cosmetic piece__cosmetic--${cosmetic.position}`;
        overlay.textContent = cosmetic.overlay;
        if (cosmetic.position === 'top') {
          overlay.style.top = `${headData.headTop - 10}%`;
          overlay.style.left = `${headData.headLeft}%`;
          overlay.style.transform = 'translateX(-50%)';
        } else if (cosmetic.position === 'middle') {
          overlay.style.top = `${headData.headTop}%`;
          overlay.style.left = `${headData.headLeft}%`;
          overlay.style.transform = 'translate(-50%, -15%)';
        }
        el.appendChild(overlay);
      }
    }
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

  // Status effects (frozen / stunned / poisoned / paralyzed)
  if (piece.statusEffect) {
    el.classList.add(`piece--${piece.statusEffect}`);
    const statusIcon = document.createElement('div');
    statusIcon.className = 'piece__status';
    const iconMap = { frozen: '❄️', stunned: '😵', poisoned: '☠️', paralyzed: '⚡' };
    statusIcon.textContent = iconMap[piece.statusEffect] || '❓';
    el.appendChild(statusIcon);
  }

  // Intimidate debuff indicator
  if (piece.intimidated) {
    el.classList.add('piece--intimidated');
    const intimIcon = document.createElement('div');
    intimIcon.className = 'piece__status piece__status--intimidate';
    intimIcon.textContent = '💪';
    intimIcon.title = `Intimidated! -1 DMG (${piece.intimidateTimer || 0} turns left)`;
    el.appendChild(intimIcon);
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
    ${preview.isIntimidated ? '<div class="battle-tooltip__debuff">💪 Intimidated (-2 DMG)</div>' : ''}
    <div class="battle-tooltip__damage">
      ${tierEmoji[tier] ?? '⚔️'} ${tierLabel[tier] ?? 'Standard'} — ${preview.baseDamage} DMG
    </div>
    <div class="battle-tooltip__hp">
      ❤️ ${defender.hp}/${defender.maxHp} HP → ${preview.defenderHpAfter} HP
    </div>
    <div class="battle-tooltip__eff ${preview.wouldKill ? 'super-effective' : 'normal'}">${killText}</div>
    ${preview.counterDamage > 0 ? `<div class="battle-tooltip__counter">🌿 Thorns: ${preview.counterDamage} DMG reflected!</div>` : ''}
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
