/**
 * PokéChess — Main Entry Point
 * Handles AI, Online, and Local game modes
 */

import './style.css';
import { createGame, startGame, selectPiece, deselectPiece, executeMove, executeOptionalAttack, skipOptionalAttack, tickClock, PHASES } from './engine/game.js';
import { renderBoard, animateCell, showDamageNumber, playAttackEffect } from './ui/renderer.js';
import { renderTitleScreen } from './ui/setup.js';
import { renderHUD } from './ui/hud.js';
import { getAIMove } from './engine/ai.js';
import { connectToServer, findMatch, sendMove, cancelSearch, resign, disconnect, isConnected } from './engine/online.js';
import { reportGameResult, loadPlayerStats, getRankTitle } from './engine/elo.js';
import { isLoggedIn, reportGameResultToServer } from './engine/auth.js';
import { POKEMON } from './engine/types.js';

let game = createGame();
let clockInterval = null;
let aiThinking = false;
let gameMode = 'ai'; // 'ai' | 'online' | 'local'
let eloReported = false; // Track if we've already reported ELO for this game

function init() {
  renderTitleScreen((clockPreset, options) => {
    gameMode = options.mode || 'ai';

    if (gameMode === 'online') {
      startOnlineMatch(clockPreset, options);
    } else {
      startLocalOrAI(clockPreset, options);
    }
  });
}

function startLocalOrAI(clockPreset, options) {
  eloReported = false;
  game = startGame(game, clockPreset, {
    playerColor: options.playerColor ?? 'white',
    aiDifficulty: options.aiDifficulty ?? 'medium',
    isAIGame: gameMode === 'ai',
    teamPresets: options.teamPresets ?? {},
  });
  // For local mode, allow both colors
  if (gameMode === 'local') {
    game.playerColor = null; // null = both players control
  }
  startClock();
  renderGameView();
  if (game.isAIGame && game.currentPlayer === game.aiColor) {
    scheduleAIMove();
  }
}

// ─── Online Mode ────────────────────────────────────────────────────

function startOnlineMatch(clockPreset, options) {
  showSearchingOverlay();

  connectToServer({
    onSearching: () => {
      updateSearchStatus('🔍 Searching for opponent...');
    },
    onMatchFound: (msg) => {
      removeSearchingOverlay();
      game = startGame(game, clockPreset, {
        playerColor: msg.yourColor,
        isAIGame: false,
      });
      game.isOnline = true;
      game.onlineColor = msg.yourColor;
      startClock();
      renderGameView();
      showStatusToast(`Match found! You are ${msg.yourColor === 'white' ? 'Team Scarlet' : 'Team Violet'}`, 'default');
    },
    onOpponentMove: (msg) => {
      // Execute opponent's move
      game = selectPiece(game, msg.fromRow, msg.fromCol);
      const { game: newGame, battleResult } = executeMove(game, msg.toRow, msg.toCol);
      game = newGame;
      if (battleResult) {
        renderAll();
        handleBattleInline(battleResult, msg.toRow, msg.toCol, () => {
          if (game.lastAbility) setTimeout(() => playAbilityAnimation(game.lastAbility), 100);
        });
      } else {
        renderAll();
        if (game.lastAbility) setTimeout(() => playAbilityAnimation(game.lastAbility), 100);
      }
      // Skip AI optional attacks for online opponent
      if (game.pendingOptionalAttack && game.currentPlayer !== game.onlineColor) {
        game = skipOptionalAttack(game);
        renderAll();
      }
    },
    onOpponentResigned: () => {
      game.phase = PHASES.GAME_OVER;
      game.winner = game.onlineColor;
      game.clockRunning = false;
      showStatusToast('Opponent resigned! You win!', 'kill');
      renderAll();
    },
    onOpponentDisconnected: () => {
      game.phase = PHASES.GAME_OVER;
      game.winner = game.onlineColor;
      game.clockRunning = false;
      showStatusToast('Opponent disconnected. You win!', 'kill');
      renderAll();
    },
    onDisconnected: () => {
      removeSearchingOverlay();
    },
  }).then(() => {
    findMatch(options.preferredTeam, clockPreset);
  }).catch(() => {
    removeSearchingOverlay();
    showStatusToast('⚠️ Could not connect to server. Start server with: node server.js', 'default');
    // Fall back to AI
    gameMode = 'ai';
    startLocalOrAI(clockPreset, { ...options, isAIGame: true });
  });
}

function showSearchingOverlay() {
  removeSearchingOverlay();
  const overlay = document.createElement('div');
  overlay.className = 'searching-overlay';
  overlay.id = 'searching-overlay';
  overlay.innerHTML = `
    <div class="searching-overlay__content">
      <div class="searching-overlay__spinner"></div>
      <h2>🌐 Finding Match...</h2>
      <p id="search-status">Connecting to server...</p>
      <button class="btn btn--secondary" id="btn-cancel-search">Cancel</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('btn-cancel-search')?.addEventListener('click', () => {
    cancelSearch();
    disconnect();
    removeSearchingOverlay();
    game = createGame();
    init();
  });
}

function updateSearchStatus(text) {
  const el = document.getElementById('search-status');
  if (el) el.textContent = text;
}

function removeSearchingOverlay() {
  document.getElementById('searching-overlay')?.remove();
}

// ─── Clock ──────────────────────────────────────────────────────────

function startClock() {
  if (clockInterval) clearInterval(clockInterval);
  clockInterval = setInterval(() => {
    if (game.phase !== PHASES.PLAY || !game.clockRunning) return;
    game = tickClock(game, 1000);
    updateClockDisplay();
    if (game.phase === PHASES.GAME_OVER) renderAll();
  }, 1000);
}

function updateClockDisplay() {
  const clockEl = document.getElementById('hud-clock');
  if (!clockEl) return;
  const formatTime = (ms) => {
    const totalSec = Math.ceil(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };
  const rows = clockEl.querySelectorAll('.clock__row');
  if (rows.length >= 2) {
    const wTime = game.clock?.white ?? 0;
    const bTime = game.clock?.black ?? 0;
    rows[0].querySelector('.clock__time').textContent = formatTime(wTime);
    rows[1].querySelector('.clock__time').textContent = formatTime(bTime);
    rows[0].classList.toggle('clock--active', game.currentPlayer === 'white');
    rows[1].classList.toggle('clock--active', game.currentPlayer === 'black');
    rows[0].classList.toggle('clock--urgent', wTime < 60000);
    rows[1].classList.toggle('clock--urgent', bTime < 60000);
  }
}

// ─── Render ─────────────────────────────────────────────────────────

function renderGameView() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="game-layout">
      <div class="game-layout__board">
        <div id="board-container"></div>
      </div>
      <div class="game-layout__hud">
        <div id="hud"></div>
      </div>
    </div>
  `;
  renderAll();
}

function renderAll() {
  if (!game.board) return;
  renderBoard(game, { onCellClick: handleCellClick });
  renderHUD(game, { onNewGame: handleNewGame });
  if (game.pendingOptionalAttack && canPlayerAct()) showOptionalAttackPrompt();
  if (aiThinking) showAIThinking();
  // Report ELO when game ends
  if (game.phase === PHASES.GAME_OVER && !eloReported) {
    eloReported = true;
    handleEloUpdate();
  }
}

// ─── Battle inline ──────────────────────────────────────────────────

function handleBattleInline(battleResult, targetRow, targetCol, callback) {
  playAttackEffect(targetRow, targetCol, battleResult);
  showDamageNumber(targetRow, targetCol, battleResult.damageDealt, battleResult.isCritical);
  if (battleResult.outcome === 'kill') showStatusToast(battleResult.message, 'kill');
  else if (battleResult.isCritical) showStatusToast('💥 CRITICAL HIT!', 'crit');
  setTimeout(() => { renderAll(); callback?.(); }, 350);
}

// ─── Can the current human player act? ──────────────────────────────

function canPlayerAct() {
  if (game.phase !== PHASES.PLAY) return false;
  if (aiThinking) return false;
  if (gameMode === 'local') return true; // Both can play
  if (gameMode === 'ai') return game.currentPlayer === game.playerColor;
  if (gameMode === 'online') return game.currentPlayer === game.onlineColor;
  return true;
}

// ─── AI ─────────────────────────────────────────────────────────────

function isAITurn() {
  return gameMode === 'ai' && game.isAIGame && game.currentPlayer === game.aiColor && game.phase === PHASES.PLAY;
}

function scheduleAIMove() {
  if (!isAITurn()) return;
  aiThinking = true;
  renderAll();
  const delay = game.aiDifficulty === 'easy' ? 500 :
                game.aiDifficulty === 'medium' ? 800 :
                game.aiDifficulty === 'hard' ? 1200 : 1500;
  setTimeout(() => {
    aiThinking = false;
    document.querySelector('.ai-thinking')?.remove();
    performAIMove();
  }, delay);
}

function performAIMove() {
  if (!isAITurn()) return;
  const aiMove = getAIMove(game.board, game.aiColor, game.aiDifficulty, game.enPassantTarget);
  if (!aiMove) return;

  game = selectPiece(game, aiMove.fromRow, aiMove.fromCol);
  const { game: newGame, battleResult } = executeMove(game, aiMove.toRow, aiMove.toCol);
  game = newGame;

  if (battleResult) {
    renderAll();
    handleBattleInline(battleResult, aiMove.toRow, aiMove.toCol, () => {
      if (game.lastAbility) setTimeout(() => playAbilityAnimation(game.lastAbility), 100);
      if (isAITurn()) scheduleAIMove();
    });
  } else {
    renderAll();
    if (game.lastAbility) setTimeout(() => playAbilityAnimation(game.lastAbility), 100);
    if (game.statusMessage) showStatusToast(game.statusMessage, 'promoted');
    if (game.pendingOptionalAttack && game.currentPlayer === game.aiColor) {
      game = skipOptionalAttack(game);
      renderAll();
    }
    if (isAITurn()) scheduleAIMove();
  }
}

// ─── Player input ───────────────────────────────────────────────────

function handleCellClick(row, col, isLegalMove, moveData) {
  if (!canPlayerAct()) return;
  if (game.pendingPromotion) return;

  // Optional attack
  if (game.pendingOptionalAttack) {
    const isTarget = game.pendingOptionalAttack.targets.some(t => t.row === row && t.col === col);
    if (isTarget) {
      const { game: newGame, battleResult } = executeOptionalAttack(game, row, col);
      game = newGame;
      if (battleResult) {
        handleBattleInline(battleResult, row, col, () => {
          if (isAITurn()) scheduleAIMove();
        });
      } else {
        renderAll();
        if (isAITurn()) scheduleAIMove();
      }
      return;
    }
    game = skipOptionalAttack(game);
    renderAll();
    if (isAITurn()) scheduleAIMove();
    return;
  }

  // Legal move
  if (isLegalMove && game.selectedPiece) {
    const fromRow = game.selectedPiece.row;
    const fromCol = game.selectedPiece.col;
    const { game: newGame, battleResult } = executeMove(game, row, col);
    game = newGame;

    // Send move to server if online
    if (gameMode === 'online' && isConnected()) {
      sendMove(fromRow, fromCol, row, col);
    }

    if (battleResult) {
      renderAll();
      handleBattleInline(battleResult, row, col, () => {
        if (game.lastAbility) setTimeout(() => playAbilityAnimation(game.lastAbility), 100);
        if (isAITurn()) scheduleAIMove();
      });
    } else {
      renderAll();
      if (game.lastAbility) setTimeout(() => playAbilityAnimation(game.lastAbility), 100);
      if (game.statusMessage) showStatusToast(game.statusMessage, 'promoted');
      if (isAITurn()) scheduleAIMove();
    }
    return;
  }

  // Select piece — in local mode, any current player's piece; otherwise only your color
  const piece = game.board[row]?.[col];
  if (piece && piece.color === game.currentPlayer) {
    // In AI/online, can only select your color
    if (gameMode !== 'local') {
      const myColor = gameMode === 'online' ? game.onlineColor : game.playerColor;
      if (piece.color !== myColor) return;
    }
    if (game.selectedPiece?.row === row && game.selectedPiece?.col === col) {
      game = deselectPiece(game);
    } else {
      game = selectPiece(game, row, col);
      if (game.statusMessage) showStatusToast(game.statusMessage, piece.statusEffect);
    }
    renderAll();
    return;
  }

  if (game.selectedPiece) {
    game = deselectPiece(game);
    renderAll();
  }
}

// ─── UI Helpers ─────────────────────────────────────────────────────

function showOptionalAttackPrompt() {
  if (document.querySelector('.optional-attack-prompt')) return;
  const prompt = document.createElement('div');
  prompt.className = 'optional-attack-prompt';
  prompt.innerHTML = `
    <div class="optional-attack-prompt__content">
      <span>✨ Optional Attack!</span>
      <span>Click an adjacent enemy or skip.</span>
      <button class="btn btn--secondary btn--small" id="btn-skip-attack">Skip</button>
    </div>
  `;
  document.body.appendChild(prompt);
  document.getElementById('btn-skip-attack')?.addEventListener('click', () => {
    game = skipOptionalAttack(game);
    prompt.remove();
    renderAll();
    if (isAITurn()) scheduleAIMove();
  });
}

function showAIThinking() {
  if (document.querySelector('.ai-thinking')) return;
  const ind = document.createElement('div');
  ind.className = 'ai-thinking';
  ind.innerHTML = `<div class="ai-thinking__content"><div class="ai-thinking__spinner"></div><span>🤖 AI is thinking...</span></div>`;
  document.body.appendChild(ind);
}

function handleNewGame() {
  if (clockInterval) clearInterval(clockInterval);
  aiThinking = false;
  document.querySelector('.ai-thinking')?.remove();
  if (gameMode === 'online') { resign(); disconnect(); }
  game = createGame();
  init();
}

function showStatusToast(message, effectType) {
  document.querySelector('.status-toast')?.remove();
  const toast = document.createElement('div');
  toast.className = `status-toast status-toast--${effectType || 'default'}`;
  const emojiMap = { frozen: '❄️', stunned: '😵', kill: '💀', crit: '💥', promoted: '🌟' };
  toast.textContent = `${emojiMap[effectType] ?? '⚔️'} ${message}`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

// ─── ELO Rating ─────────────────────────────────────────────────────

function handleEloUpdate() {
  if (gameMode === 'local') return; // No ELO for local games

  const playerColor = gameMode === 'online' ? game.onlineColor : game.playerColor;
  let result;
  if (game.winner === 'draw') {
    result = 'draw';
  } else if (game.winner === playerColor) {
    result = 'win';
  } else {
    result = 'loss';
  }

  // Try server-side first if logged in
  if (isLoggedIn()) {
    reportGameResultToServer(result, gameMode, {
      aiDifficulty: game.aiDifficulty,
    }).then(serverResult => {
      if (serverResult) {
        setTimeout(() => showEloChangeToast(serverResult), 800);
      } else {
        // Fallback to local
        const eloResult = reportGameResult(result, gameMode, { aiDifficulty: game.aiDifficulty });
        setTimeout(() => showEloChangeToast(eloResult), 800);
      }
    });
  } else {
    const eloResult = reportGameResult(result, gameMode, { aiDifficulty: game.aiDifficulty });
    setTimeout(() => showEloChangeToast(eloResult), 800);
  }
}

function showEloChangeToast(eloResult) {
  const { change, oldRating, newRating, stats } = eloResult;
  const rank = getRankTitle(newRating);
  const changeText = change >= 0 ? `+${change}` : `${change}`;
  const changeClass = change >= 0 ? 'elo-up' : 'elo-down';

  const toast = document.createElement('div');
  toast.className = 'elo-toast';
  toast.innerHTML = `
    <div class="elo-toast__content">
      <div class="elo-toast__rank">${rank.emoji} ${rank.title}</div>
      <div class="elo-toast__rating">
        <span class="elo-toast__old">${oldRating}</span>
        <span class="elo-toast__arrow">→</span>
        <span class="elo-toast__new">${newRating}</span>
        <span class="elo-toast__change ${changeClass}">${changeText}</span>
      </div>
      <div class="elo-toast__stats">
        ${stats.wins}W / ${stats.losses}L / ${stats.draws}D
        ${stats.streak > 1 ? ` 🔥 ${stats.streak} streak` : ''}
      </div>
    </div>
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

// Boot
document.addEventListener('DOMContentLoaded', init);

// ─── Ability Animations (generic, color-driven) ─────────────────────

function playAbilityAnimation(ability) {
  const board = document.getElementById('chess-board');
  if (!board || !ability) return;

  const rect = board.getBoundingClientRect();
  const cs = rect.width / 8;
  const a = ability.affected || [];
  const color = ability.color || '#ffffff';

  if (a.length === 0) return;

  // Get the Pokémon's primary type for unique animation
  const pkmn = POKEMON[ability.user];
  const primaryType = pkmn?.types?.[0] || 'NORMAL';

  // Type-specific particle configs
  const TYPE_FX = {
    FIRE:     { emoji: '🔥', particles: ['🔥','✨','💥'], shape: 'flame',   trail: true,  count: 7 },
    WATER:    { emoji: '💧', particles: ['💧','🌊','💦'], shape: 'droplet', trail: false, count: 6 },
    ELECTRIC: { emoji: '⚡', particles: ['⚡','💛','✦'],  shape: 'bolt',    trail: true,  count: 8 },
    GRASS:    { emoji: '🍃', particles: ['🍃','🌿','✨'], shape: 'leaf',    trail: false, count: 6 },
    ICE:      { emoji: '❄️', particles: ['❄️','💎','✧'],  shape: 'crystal', trail: false, count: 6 },
    PSYCHIC:  { emoji: '🔮', particles: ['🔮','💜','✨'], shape: 'ring',    trail: true,  count: 5 },
    GHOST:    { emoji: '👻', particles: ['👻','💀','🌑'], shape: 'wisp',    trail: true,  count: 5 },
    DARK:     { emoji: '🌑', particles: ['🌑','💜','✦'],  shape: 'wisp',    trail: true,  count: 5 },
    FIGHTING: { emoji: '👊', particles: ['💥','⭐','✦'],  shape: 'burst',   trail: false, count: 7 },
    DRAGON:   { emoji: '🐉', particles: ['🐉','💜','🔥'], shape: 'flame',   trail: true,  count: 7 },
    STEEL:    { emoji: '⚙️', particles: ['⚙️','✦','💫'],  shape: 'spark',   trail: false, count: 6 },
    FAIRY:    { emoji: '✨', particles: ['✨','💖','🌸'], shape: 'sparkle', trail: false, count: 6 },
    ROCK:     { emoji: '🪨', particles: ['🪨','💥','✦'],  shape: 'burst',   trail: false, count: 5 },
    GROUND:   { emoji: '🌍', particles: ['🪨','💨','✦'],  shape: 'burst',   trail: false, count: 5 },
    POISON:   { emoji: '☠️', particles: ['☠️','💜','💀'], shape: 'wisp',    trail: true,  count: 5 },
    BUG:      { emoji: '🦗', particles: ['🦗','✨','💚'], shape: 'sparkle', trail: false, count: 5 },
    FLYING:   { emoji: '🌪️', particles: ['🌪️','💨','✨'], shape: 'ring',    trail: false, count: 5 },
    NORMAL:   { emoji: '⭐', particles: ['⭐','✦','✨'],  shape: 'burst',   trail: false, count: 5 },
  };

  const fx = TYPE_FX[primaryType] || TYPE_FX.NORMAL;

  // Center point
  const cr = a.reduce((s, x) => s + x.row, 0) / a.length;
  const cc = a.reduce((s, x) => s + x.col, 0) / a.length;
  const cx = rect.left + cc * cs + cs / 2;
  const cy = rect.top + cr * cs + cs / 2;

  const isStatus = ability.effectName === 'frozen' || ability.effectName === 'stunned';
  const isHeal = ability.effectName === 'heal' || ability.effectName === 'heal_allies';

  // ── Type-specific wave / beam ──
  if (isStatus || a.length >= 3) {
    // Expanding wave rings with type color
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        const w = document.createElement('div');
        w.className = `ability-wave-generic ability-wave--${fx.shape}`;
        w.style.left = `${cx}px`;
        w.style.top = `${cy}px`;
        w.style.setProperty('--wave-color', color);
        document.body.appendChild(w);
        setTimeout(() => w.remove(), 1000);
      }, i * 180);
    }
  } else {
    // Beam lines to each target
    a.forEach(t => {
      const tx = rect.left + t.col * cs + cs / 2;
      const ty = rect.top + t.row * cs + cs / 2;
      const ang = Math.atan2(ty - cy, tx - cx);
      const d = Math.hypot(tx - cx, ty - cy);
      const b = document.createElement('div');
      b.className = `ability-beam-generic ability-beam--${fx.shape}`;
      b.style.left = `${cx}px`; b.style.top = `${cy}px`;
      b.style.width = `${d}px`; b.style.transform = `rotate(${ang}rad)`;
      b.style.setProperty('--beam-color', color);
      document.body.appendChild(b);
      setTimeout(() => b.remove(), 700);

      // Type trail particles along beam
      if (fx.trail) {
        for (let i = 0; i < 3; i++) {
          setTimeout(() => {
            const frac = (i + 1) / 4;
            const px = cx + (tx - cx) * frac;
            const py = cy + (ty - cy) * frac;
            const tp = document.createElement('div');
            tp.className = 'ability-type-emoji';
            tp.textContent = fx.particles[i % fx.particles.length];
            tp.style.left = `${px}px`; tp.style.top = `${py}px`;
            tp.style.setProperty('--rise', `${-20 - Math.random() * 30}px`);
            document.body.appendChild(tp);
            setTimeout(() => tp.remove(), 800);
          }, 100 + i * 120);
        }
      }
    });
  }

  // ── Type-specific particles on each affected square ──
  a.forEach(t => {
    const tx = rect.left + t.col * cs + cs / 2;
    const ty = rect.top + t.row * cs + cs / 2;

    const particleCount = isHeal ? 3 : fx.count;
    setTimeout(() => {
      for (let i = 0; i < particleCount; i++) {
        const isEmoji = Math.random() < 0.5;

        if (isEmoji) {
          // Emoji particle (type-specific)
          const e = document.createElement('div');
          e.className = `ability-type-emoji ability-type-emoji--${fx.shape}`;
          e.textContent = fx.particles[Math.floor(Math.random() * fx.particles.length)];
          e.style.left = `${tx + (Math.random() - 0.5) * 20}px`;
          e.style.top = `${ty + (Math.random() - 0.5) * 20}px`;
          e.style.setProperty('--rise', `${-25 - Math.random() * 40}px`);
          e.style.setProperty('--drift', `${(Math.random() - 0.5) * 50}px`);
          e.style.animationDelay = `${i * 60}ms`;
          document.body.appendChild(e);
          setTimeout(() => e.remove(), 900);
        } else {
          // Dot particle (colored)
          const p = document.createElement('div');
          p.className = `ability-particle-generic ability-particle--${fx.shape}`;
          p.style.left = `${tx}px`; p.style.top = `${ty}px`;
          p.style.setProperty('--angle', `${Math.random() * 360}deg`);
          p.style.setProperty('--dist', `${18 + Math.random() * 28}px`);
          p.style.setProperty('--particle-color', color);
          document.body.appendChild(p);
          setTimeout(() => p.remove(), 700);
        }
      }
    }, isStatus ? 0 : 250);

    // Cell flash
    const c = document.querySelector(`.cell[data-row="${t.row}"][data-col="${t.col}"]`);
    if (c) {
      c.style.setProperty('--flash-color', color);
      c.classList.add('cell--ability-flash');
      setTimeout(() => c.classList.remove('cell--ability-flash'), 1200);
    }
  });
}
