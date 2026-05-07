/**
 * PokéChess — Main Entry Point
 * Handles AI, Online, and Local game modes
 */

import './style.css';
import { createGame, startGame, selectPiece, deselectPiece, executeMove, executeOptionalAttack, skipOptionalAttack, tickClock, applyPromotion, PHASES } from './engine/game.js';
import { renderBoard, animateCell, showDamageNumber, playAttackEffect } from './ui/renderer.js';
import { renderTitleScreen } from './ui/setup.js';
import { renderHUD } from './ui/hud.js';
import { getAIMove } from './engine/ai.js';
import { connectToServer, findMatch, sendMove, cancelSearch, resign, disconnect, isConnected, sendGameChat } from './engine/online.js';
import { reportGameResult, loadPlayerStats, getRankTitle } from './engine/elo.js';
import { isLoggedIn, reportGameResultToServer, getUsername } from './engine/auth.js';
import { POKEMON, POKEMON_POOL, KING_POOL, TEAMS, COLOR_TO_TEAM } from './engine/types.js';
import { openShop, closeShop, consumeItem, incrementBattleCount, awardDailyCoins, SHOP_ITEMS } from './ui/shop.js';

let game = createGame();
let clockInterval = null;
let aiThinking = false;
let gameMode = 'ai'; // 'ai' | 'online' | 'local'
let eloReported = false; // Track if we've already reported ELO for this game
let processingMove = false; // Block input during opponent's move animation
let animatingBattle = false; // Block input during battle animations
let opponentMoveQueue = []; // Queue for incoming opponent moves
let activeItem = null; // Currently selected item to use

// Capture all Math.random() calls during move execution for online sync
function withRandomCapture(fn) {
  const values = [];
  const orig = Math.random;
  Math.random = () => { const v = orig.call(Math); values.push(v); return v; };
  const result = fn();
  Math.random = orig;
  return { result, randomValues: values };
}

// Replay captured random values during opponent's move
function withRandomReplay(values, fn) {
  let idx = 0;
  const orig = Math.random;
  Math.random = () => idx < values.length ? values[idx++] : orig.call(Math);
  const result = fn();
  Math.random = orig;
  return result;
}

function init() {
  // Handle Stripe payment return
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('payment') === 'success') {
    const sessionId = urlParams.get('session_id');
    // Clean up URL immediately
    window.history.replaceState({}, '', window.location.pathname);

    if (sessionId) {
      // Verify payment and grant coins
      const token = localStorage.getItem('pokechess_token');
      const isDev = window.location.port === '5173' || window.location.port === '5174';
      const apiBase = isDev ? `http://${window.location.hostname}:3001/api` : `${window.location.origin}/api`;
      fetch(`${apiBase}/shop/verify-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sessionId }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.granted || data.alreadyFulfilled) {
            showStatusToast(`💳 Payment successful! Balance: ${data.coins} PokéCoins`, 'buff');
            import('./ui/shop.js').then(m => m.loadFromServer?.());
          } else {
            showStatusToast(data.error || 'Could not verify payment', 'error');
          }
        })
        .catch(() => showStatusToast('Payment received — coins will appear shortly', 'buff'));
    } else {
      setTimeout(() => showStatusToast('💳 Payment processed!', 'buff'), 500);
      import('./ui/shop.js').then(m => m.loadFromServer?.());
    }
  } else if (urlParams.get('payment') === 'cancelled') {
    setTimeout(() => showStatusToast('Payment cancelled', 'error'), 500);
    window.history.replaceState({}, '', window.location.pathname);
  }

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

  // Generate AI team based on difficulty
  const teamPresets = options.teamPresets ? { ...options.teamPresets } : {};
  if (gameMode === 'ai') {
    const aiDiff = parseInt(options.aiDifficulty, 10) || 5;
    const playerTeam = options.playerColor === 'white' ? 'scarlet' : 'violet';
    const aiTeam = playerTeam === 'scarlet' ? 'violet' : 'scarlet';
    teamPresets[aiTeam] = generateAITeam(aiTeam, aiDiff);
  }

  game = startGame(game, clockPreset, {
    playerColor: options.playerColor ?? 'white',
    aiDifficulty: options.aiDifficulty ?? 'medium',
    isAIGame: gameMode === 'ai',
    teamPresets,
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
      // Merge player's team presets with opponent's team presets from the server
      const teamPresets = options.teamPresets ? { ...options.teamPresets } : {};
      const opponentPresets = msg.opponentTeamPresets || {};
      // Determine which team is the opponent's
      const opponentTeamKey = msg.yourColor === 'white' ? 'violet' : 'scarlet';
      const playerTeamKey = msg.yourColor === 'white' ? 'scarlet' : 'violet';
      // If opponent sent their team data, use it for their side
      if (opponentPresets[opponentTeamKey]) {
        teamPresets[opponentTeamKey] = opponentPresets[opponentTeamKey];
      }
      game = startGame(game, clockPreset, {
        playerColor: msg.yourColor,
        isAIGame: false,
        teamPresets,
      });
      game.isOnline = true;
      game.onlineColor = msg.yourColor;
      game.opponentName = msg.opponentName || null;
      startClock();
      renderGameView();
      const oppDisplay = game.opponentName && game.opponentName !== 'Unknown' && game.opponentName !== 'Guest'
        ? game.opponentName
        : (msg.yourColor === 'white' ? 'Team Violet' : 'Team Scarlet');
      showStatusToast(`Match found! Playing vs ${oppDisplay}`, 'default');
    },
    onOpponentMove: (msg) => {
      // Queue the move and process sequentially
      opponentMoveQueue.push(msg);
      if (!processingMove) processNextOpponentMove();
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
    onGameChat: (msg) => {
      appendGameChatMessage(msg.username, msg.text, msg.timestamp);
    },
    onLobbyChat: () => {}, // ignore lobby chat during game
    onDisconnected: () => {
      removeSearchingOverlay();
    },
  }).then(() => {
    findMatch(options.preferredTeam, clockPreset, options.teamPresets, getUsername() || 'Guest');
  }).catch(() => {
    removeSearchingOverlay();
    showStatusToast('⚠️ Could not connect to server. Try again later.', 'error');
  });
}

// Process opponent moves one at a time from the queue
function processNextOpponentMove() {
  if (opponentMoveQueue.length === 0) {
    processingMove = false;
    return;
  }

  processingMove = true;
  const msg = opponentMoveQueue.shift();

  // Replay the sender's random values so both clients get the same results
  withRandomReplay(msg.randomValues || [], () => {
    game = selectPiece(game, msg.fromRow, msg.fromCol);
    const { game: newGame, battleResult } = executeMove(game, msg.toRow, msg.toCol);
    game = newGame;

    const finishOpponentMove = () => {
      // Skip optional attacks for online opponent
      if (game.pendingOptionalAttack && game.currentPlayer !== game.onlineColor) {
        game = skipOptionalAttack(game);
      }
      renderAll();
      // Process next queued move (or unlock input)
      processNextOpponentMove();
    };

    if (battleResult) {
      renderAll();
      handleBattleInline(battleResult, msg.toRow, msg.toCol, () => {
        if (game.lastAbility) {
          setTimeout(() => {
            playAbilityAnimation(game.lastAbility);
            setTimeout(finishOpponentMove, 600);
          }, 100);
        } else {
          finishOpponentMove();
        }
      });
    } else {
      renderAll();
      if (game.lastAbility) {
        setTimeout(() => {
          playAbilityAnimation(game.lastAbility);
          setTimeout(finishOpponentMove, 600);
        }, 100);
      } else {
        finishOpponentMove();
      }
    }
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
  const isOnlineGame = gameMode === 'online';
  app.innerHTML = `
    <div class="game-layout">
      <div class="game-layout__board">
        <div id="board-container"></div>
      </div>
      <div class="game-layout__hud">
        <div id="hud"></div>
      </div>
      ${isOnlineGame ? `
      <div class="game-chat" id="game-chat">
        <button class="game-chat__toggle" id="game-chat-toggle">💬</button>
        <div class="game-chat__panel" id="game-chat-panel" style="display:none">
          <div class="game-chat__header">
            <span>💬 Game Chat</span>
            <button class="game-chat__close" id="game-chat-close">✕</button>
          </div>
          <div class="game-chat__messages" id="game-chat-messages"></div>
          <div class="game-chat__input-row">
            <input type="text" id="game-chat-input" class="game-chat__input" placeholder="Message opponent..." maxlength="200" autocomplete="off" />
            <button class="game-chat__send" id="game-chat-send">➤</button>
          </div>
        </div>
      </div>
      ` : ''}
    </div>
  `;

  if (isOnlineGame) wireGameChat();
  renderAll();
}

function wireGameChat() {
  let chatOpen = false;

  document.getElementById('game-chat-toggle')?.addEventListener('click', () => {
    chatOpen = !chatOpen;
    const panel = document.getElementById('game-chat-panel');
    if (panel) panel.style.display = chatOpen ? 'flex' : 'none';
    if (chatOpen) document.getElementById('game-chat-input')?.focus();
  });

  document.getElementById('game-chat-close')?.addEventListener('click', () => {
    chatOpen = false;
    const panel = document.getElementById('game-chat-panel');
    if (panel) panel.style.display = 'none';
  });

  function doSend() {
    const input = document.getElementById('game-chat-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    sendGameChat(text);
    appendGameChatMessage(getUsername() || 'You', text, Date.now());
    input.value = '';
  }

  document.getElementById('game-chat-send')?.addEventListener('click', doSend);
  document.getElementById('game-chat-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); doSend(); }
  });
}

function appendGameChatMessage(username, text, timestamp) {
  const msgs = document.getElementById('game-chat-messages');
  if (!msgs) return;
  const el = document.createElement('div');
  el.className = 'game-chat__msg';
  const time = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const isMe = username === (getUsername() || 'You');
  el.innerHTML = `<span class="game-chat__time">${time}</span> <strong class="game-chat__user" style="color:${isMe ? '#4ade80' : '#60a5fa'}">${username}</strong>: ${text}`;
  msgs.appendChild(el);
  msgs.scrollTop = msgs.scrollHeight;

  // Flash the toggle button if chat is closed
  const panel = document.getElementById('game-chat-panel');
  if (panel && panel.style.display === 'none' && !isMe) {
    const toggle = document.getElementById('game-chat-toggle');
    if (toggle) { toggle.classList.add('game-chat__toggle--flash'); setTimeout(() => toggle.classList.remove('game-chat__toggle--flash'), 2000); }
  }
}

function renderAll() {
  if (!game.board) return;
  renderBoard(game, { onCellClick: handleCellClick });
  renderHUD(game, { onNewGame: handleNewGame, onOpenShop: handleOpenShop, onUseItem: handleItemUse });
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
  animatingBattle = true;
  playAttackEffect(targetRow, targetCol, battleResult);
  showDamageNumber(targetRow, targetCol, battleResult.damageDealt, battleResult.isCritical);
  if (battleResult.outcome === 'kill') showStatusToast(battleResult.message, 'kill');
  else if (battleResult.isCritical) showStatusToast('💥 CRITICAL HIT!', 'crit');
  setTimeout(() => { animatingBattle = false; renderAll(); callback?.(); }, 500);
}

// ─── Can the current human player act? ──────────────────────────────

function canPlayerAct() {
  if (game.phase !== PHASES.PLAY) return false;
  if (aiThinking) return false;
  if (processingMove) return false;
  if (animatingBattle) return false;
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
  const delay = game.aiDifficulty === 'easy' ? 300 :
                game.aiDifficulty === 'medium' ? 450 :
                game.aiDifficulty === 'hard' ? 600 : 750;
  setTimeout(() => {
    aiThinking = false;
    document.querySelector('.ai-thinking')?.remove();
    performAIMove();
  }, delay);
}

function performAIMove() {
  if (!isAITurn()) return;
  const aiMove = getAIMove(game.board, game.aiColor, game.aiDifficulty, game.enPassantTarget);
  if (!aiMove) {
    // No valid moves — pass turn so game doesn't freeze
    console.warn('[AI] No valid moves found, passing turn');
    game = { ...game, currentPlayer: game.currentPlayer === 'white' ? 'black' : 'white' };
    renderAll();
    return;
  }

  game = selectPiece(game, aiMove.fromRow, aiMove.fromCol);
  // Safety: if selectPiece didn't select (e.g. stunned piece), skip
  if (!game.selectedPiece) {
    console.warn('[AI] selectPiece failed, retrying in 300ms');
    setTimeout(() => scheduleAIMove(), 300);
    return;
  }
  const { game: newGame, battleResult } = executeMove(game, aiMove.toRow, aiMove.toCol);
  game = newGame;

  if (battleResult) {
    renderAll();
    handleBattleInline(battleResult, aiMove.toRow, aiMove.toCol, () => {
      if (game.lastAbility) {
        setTimeout(() => playAbilityAnimation(game.lastAbility), 300);
        // Wait for ability animation to finish before next move
        if (isAITurn()) setTimeout(() => scheduleAIMove(), 1100);
      } else {
        if (isAITurn()) scheduleAIMove();
      }
    });
  } else {
    renderAll();
    if (game.lastAbility) {
      setTimeout(() => playAbilityAnimation(game.lastAbility), 300);
      // Wait for ability animation to finish before next move
      if (isAITurn()) setTimeout(() => scheduleAIMove(), 1100);
    } else {
      if (isAITurn()) setTimeout(() => scheduleAIMove(), 350);
    }
    if (game.statusMessage) showStatusToast(game.statusMessage, 'promoted');
    if (game.pendingOptionalAttack && game.currentPlayer === game.aiColor) {
      game = skipOptionalAttack(game);
      renderAll();
    }
  }
}

// ─── Player input ───────────────────────────────────────────────────

function handleCellClick(row, col, isLegalMove, moveData) {
  // Item usage mode: apply item to cell
  if (activeItem) {
    applyItemToCell(activeItem, row, col);
    return;
  }
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

    // Capture random values during move for online sync
    let battleResult, randomValues;
    if (gameMode === 'online') {
      const captured = withRandomCapture(() => {
        const result = executeMove(game, row, col);
        return result;
      });
      battleResult = captured.result.battleResult;
      game = captured.result.game;
      randomValues = captured.randomValues;
    } else {
      const result = executeMove(game, row, col);
      battleResult = result.battleResult;
      game = result.game;
    }

    // Send move to server if online
    if (gameMode === 'online' && isConnected()) {
      sendMove(fromRow, fromCol, row, col, randomValues);
    }

    if (battleResult) {
      renderAll();
      handleBattleInline(battleResult, row, col, () => {
        if (game.lastAbility) {
          setTimeout(() => playAbilityAnimation(game.lastAbility), 300);
          if (isAITurn()) setTimeout(() => scheduleAIMove(), 1100);
        } else {
          if (isAITurn()) scheduleAIMove();
        }
      });
    } else {
      renderAll();
      if (game.lastAbility) {
        setTimeout(() => playAbilityAnimation(game.lastAbility), 300);
        if (isAITurn()) setTimeout(() => scheduleAIMove(), 1100);
      } else {
        if (isAITurn()) scheduleAIMove();
      }
      if (game.statusMessage) showStatusToast(game.statusMessage, 'promoted');
    }
    return;
  }

  // Select piece — in local mode, any current player's piece; otherwise only your color
  const piece = game.board[row]?.[col];
  if (piece) {
    // Determine which color this player controls
    const myColor = gameMode === 'online' ? game.onlineColor
                  : gameMode === 'ai' ? game.playerColor
                  : game.currentPlayer; // local: whoever's turn it is

    // Only allow selecting your own pieces
    if (piece.color !== myColor) {
      // Clicked opponent piece — deselect any current selection
      if (game.selectedPiece) {
        game = deselectPiece(game);
        renderAll();
      }
      return;
    }

    // Must be your turn to select
    if (piece.color !== game.currentPlayer) return;

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

// ─── AI Team Generation (scales with difficulty) ────────────────────

/**
 * Generate an AI team that gets stronger with higher difficulty.
 * Lv 1-3: Default team (basic Pokémon)
 * Lv 4-5: Mix some stronger Pokémon in
 * Lv 6-7: Mostly strong Pokémon
 * Lv 8-9: Best available Pokémon
 * Lv 10:  Absolute best team + best king
 */
function generateAITeam(teamKey, difficulty) {
  const pool = POKEMON_POOL[teamKey] || [];
  const kingPool = KING_POOL[teamKey] || [];
  const defaultTeam = TEAMS[teamKey];

  // Lv 1-3: just use defaults
  if (difficulty <= 3) {
    return {
      backRank: [...defaultTeam.backRank],
      pawnPokemon: defaultTeam.pawnPokemon,
    };
  }

  // Sort pool by requiredElo (strongest last)
  const sorted = [...pool].sort((a, b) => a.requiredElo - b.requiredElo);

  // How many "upgrades" to apply based on difficulty
  // Lv4: 2 upgrades, Lv5: 3, Lv6: 4, Lv7: 5, Lv8: 6, Lv9-10: all 8
  const upgradeSlots = difficulty <= 5 ? difficulty - 2 :
                       difficulty <= 7 ? difficulty - 1 :
                       8;

  // Pick the strongest Pokémon available for the upgrades
  const strongPokemon = sorted.slice(-Math.min(upgradeSlots + 3, sorted.length));

  // Build back rank
  const backRank = [...defaultTeam.backRank];
  const slotOrder = [3, 0, 7, 2, 5, 1, 6]; // Queen first, then rooks, bishops, knights (skip index 4 = king)
  let usedKeys = new Set();

  for (let i = 0; i < Math.min(upgradeSlots, slotOrder.length); i++) {
    const slot = slotOrder[i];
    // Pick a strong Pokémon we haven't used yet
    for (let j = strongPokemon.length - 1; j >= 0; j--) {
      const key = strongPokemon[j].key;
      if (!usedKeys.has(key) && key !== backRank[4]) { // don't replace king
        backRank[slot] = key;
        usedKeys.add(key);
        break;
      }
    }
  }

  // Pick best pawn for higher difficulties
  let pawnPokemon = defaultTeam.pawnPokemon;
  if (difficulty >= 6) {
    // Use a mid-tier Pokémon as pawn
    const midTier = sorted[Math.min(Math.floor(sorted.length * 0.6), sorted.length - 1)];
    if (midTier) pawnPokemon = midTier.key;
  }

  // Best king for Lv 9-10
  const result = { backRank, pawnPokemon };
  if (difficulty >= 9 && kingPool.length > 1) {
    // Use the highest-ELO king
    const bestKing = kingPool.reduce((a, b) => a.requiredElo > b.requiredElo ? a : b);
    backRank[4] = bestKing.key;
  }

  return result;
}

// ─── Shop ───────────────────────────────────────────────────────────

function handleOpenShop() {
  openShop(handleItemUse);
}

function handleItemUse(itemId) {
  if (game.phase !== PHASES.PLAY) return;
  // Block items in online matches to prevent desync
  if (gameMode === 'online') {
    showStatusToast('❌ Items are disabled in online matches!', 'error');
    return;
  }
  // Set active item — next cell click will apply it
  activeItem = itemId;
  showStatusToast(`${SHOP_ITEMS[itemId]?.emoji} Select a target... (ESC to cancel)`, 'item');
}

function applyItemToCell(itemId, row, col) {
  const piece = game.board[row][col];
  const playerColor = gameMode === 'online' ? game.onlineColor : (gameMode === 'ai' ? game.playerColor : game.currentPlayer);

  // Helper: cancel targeting on bad click
  function cancelItem(msg) {
    showStatusToast(msg, 'error');
    activeItem = null;
    renderAll();
    return false;
  }

  // Check if this item was already used on this piece (for piece-targeting items)
  const pieceTargetItems = ['MAX_POTION','X_ATTACK','X_DEFENSE','FOCUS_SASH','LEFTOVERS','SMOKE_BALL','DESTINY_BOND','OBLITERATOR','RAZOR_LEAF','AGILITY_BAND','SHADOW_CLOAK','TOXIC_ORB'];
  if (pieceTargetItems.includes(itemId) && piece) {
    const applied = piece.appliedItems || [];
    if (applied.includes(itemId)) {
      return cancelItem(`Already used ${SHOP_ITEMS[itemId]?.name} on this Pokémon!`);
    }
  }

  switch (itemId) {
    case 'MAX_POTION': {
      if (!piece || piece.color !== playerColor) return cancelItem('Select a friendly piece!');
      if (piece.hp >= piece.maxHp) return cancelItem('Already at full HP!');
      game.board[row][col] = { ...piece, hp: piece.maxHp, appliedItems: [...(piece.appliedItems || []), itemId] };
      showStatusToast(`🧪 ${POKEMON[piece.pokemon]?.name || 'Piece'} healed to full!`, 'heal');
      break;
    }
    case 'X_ATTACK': {
      if (!piece || piece.color !== playerColor) return cancelItem('Select a friendly piece!');
      game.board[row][col] = { ...piece, damage: piece.damage + 1, appliedItems: [...(piece.appliedItems || []), itemId] };
      showStatusToast(`⚔️ ${POKEMON[piece.pokemon]?.name || 'Piece'} +1 damage!`, 'buff');
      break;
    }
    case 'X_DEFENSE': {
      if (!piece || piece.color !== playerColor) return cancelItem('Select a friendly piece!');
      game.board[row][col] = { ...piece, maxHp: piece.maxHp + 2, hp: piece.hp + 2, appliedItems: [...(piece.appliedItems || []), itemId] };
      showStatusToast(`🔰 ${POKEMON[piece.pokemon]?.name || 'Piece'} +2 HP!`, 'buff');
      break;
    }
    case 'FOCUS_SASH': {
      if (!piece || piece.color !== playerColor) return cancelItem('Select a friendly piece!');
      game.board[row][col] = { ...piece, focusSash: true, appliedItems: [...(piece.appliedItems || []), itemId] };
      showStatusToast(`🛡️ ${POKEMON[piece.pokemon]?.name || 'Piece'} protected by Focus Sash!`, 'buff');
      break;
    }
    case 'LEFTOVERS': {
      if (!piece || piece.color !== playerColor) return cancelItem('Select a friendly piece!');
      game.board[row][col] = { ...piece, leftovers: true, appliedItems: [...(piece.appliedItems || []), itemId] };
      showStatusToast(`🍎 ${POKEMON[piece.pokemon]?.name || 'Piece'} got Leftovers!`, 'heal');
      break;
    }
    case 'SMOKE_BALL': {
      if (!piece || piece.color !== playerColor) return cancelItem('Select a friendly piece!');
      game.board[row][col] = { ...piece, smokeBall: 5, appliedItems: [...(piece.appliedItems || []), itemId] };
      showStatusToast(`💨 ${POKEMON[piece.pokemon]?.name || 'Piece'} immune to abilities for 5 turns!`, 'buff');
      break;
    }
    case 'DESTINY_BOND': {
      if (!piece || piece.color !== playerColor) return cancelItem('Select a friendly piece!');
      game.board[row][col] = { ...piece, destinyBond: true, appliedItems: [...(piece.appliedItems || []), itemId] };
      showStatusToast(`💀 ${POKEMON[piece.pokemon]?.name || 'Piece'} bound by destiny!`, 'status');
      break;
    }
    case 'OBLITERATOR': {
      if (!piece || piece.color !== playerColor) return cancelItem('Select a friendly piece!');
      game.board[row][col] = { ...piece, obliterator: true, appliedItems: [...(piece.appliedItems || []), itemId] };
      showStatusToast(`🗡️ ${POKEMON[piece.pokemon]?.name || 'Piece'} armed with the Obliterator! Next attack is a one-hit KO!`, 'buff');
      break;
    }
    case 'RAZOR_LEAF': {
      if (!piece || piece.color !== playerColor) return cancelItem('Select a friendly piece!');
      const bonusDmg = piece.pokemon === 'BULBASAUR' ? 2 : 1;
      game.board[row][col] = { ...piece, razorLeaf: true, razorLeafDmg: bonusDmg, appliedItems: [...(piece.appliedItems || []), itemId] };
      const pokeName = POKEMON[piece.pokemon]?.name || 'Piece';
      showStatusToast(`🍃 ${pokeName} gained Razor Leaf Storm! +${bonusDmg} AOE damage on abilities!`, 'buff');
      break;
    }
    case 'AGILITY_BAND': {
      if (!piece || piece.color !== playerColor) return cancelItem('Select a friendly piece!');
      game.board[row][col] = { ...piece, agilityBand: 5, appliedItems: [...(piece.appliedItems || []), itemId] };
      showStatusToast(`💨 ${POKEMON[piece.pokemon]?.name || 'Piece'} equipped Agility Band! +1 move range for 5 turns!`, 'buff');
      break;
    }
    case 'SHADOW_CLOAK': {
      if (!piece || piece.color !== playerColor) return cancelItem('Select a friendly piece!');
      game.board[row][col] = { ...piece, shadowCloak: true, appliedItems: [...(piece.appliedItems || []), itemId] };
      showStatusToast(`🌑 ${POKEMON[piece.pokemon]?.name || 'Piece'} cloaked in shadow! Immune to abilities!`, 'buff');
      break;
    }
    case 'TOXIC_ORB': {
      if (!piece) return cancelItem('Select an enemy piece!');
      if (piece.color === playerColor) return cancelItem('Target an enemy piece!');
      game.board[row][col] = { ...piece, toxicOrb: 3, appliedItems: [...(piece.appliedItems || []), 'TOXIC_ORB'] };
      showStatusToast(`☠️ ${POKEMON[piece.pokemon]?.name || 'Piece'} poisoned by Toxic Orb! -1 HP per turn for 3 turns!`, 'status');
      break;
    }
    case 'QUICK_CLAW': {
      game.quickClaw = playerColor;
      showStatusToast(`⚡ Quick Claw active — your next move grants an extra turn!`, 'buff');
      break;
    }
    case 'SHINY_CHARM': {
      showStatusToast(`👑 Shiny Charm active for 10 games!`, 'buff');
      break;
    }
    case 'TEAM_REROLL': {
      return cancelItem('Use Team Reroll during team select!');
    }
    case 'RARE_CANDY': {
      if (!piece || piece.color !== playerColor) return cancelItem('Select a friendly pawn!');
      if (!piece.isPawn) return cancelItem('Can only promote pawns!');
      game = applyPromotion(game, row, col);
      showStatusToast(`⚡ ${POKEMON[piece.pokemon]?.name || 'Pawn'} promoted with Rare Candy!`, 'buff');
      break;
    }
    case 'REVIVE': {
      return cancelItem('Use Revive from captured pieces list!');
    }
    case 'WIDE_LENS': {
      if (!piece || piece.color !== playerColor) return cancelItem('Select a friendly piece!');
      game.board[row][col] = { ...piece, wideLens: true, appliedItems: [...(piece.appliedItems || []), itemId] };
      showStatusToast(`🔍 ${POKEMON[piece.pokemon]?.name || 'Piece'} got Wide Lens! Ability damage doubled!`, 'buff');
      break;
    }
    case 'LIFE_ORB': {
      if (!piece || piece.color !== playerColor) return cancelItem('Select a friendly piece!');
      game.board[row][col] = { ...piece, lifeOrb: true, damage: piece.damage + 3, appliedItems: [...(piece.appliedItems || []), itemId] };
      showStatusToast(`🔮 ${POKEMON[piece.pokemon]?.name || 'Piece'} powered by Life Orb! +3 DMG but costs 2 HP per attack!`, 'buff');
      break;
    }
    case 'SHIELD_DUST': {
      if (!piece || piece.color !== playerColor) return cancelItem('Select a friendly piece!');
      game.board[row][col] = { ...piece, shieldDust: true, appliedItems: [...(piece.appliedItems || []), itemId] };
      showStatusToast(`🛡️ ${POKEMON[piece.pokemon]?.name || 'Piece'} is immune to status effects!`, 'buff');
      break;
    }
    case 'CHOICE_SCARF': {
      if (!piece || piece.color !== playerColor) return cancelItem('Select a friendly piece!');
      if (!window._choiceScarfFirst) {
        window._choiceScarfFirst = { row, col };
        showStatusToast(`🧣 Now click the second friendly piece to swap with!`, 'buff');
        return true; // Don't consume yet
      } else {
        const first = window._choiceScarfFirst;
        const piece1 = game.board[first.row][first.col];
        if (!piece1 || piece1.color !== playerColor) {
          window._choiceScarfFirst = null;
          return cancelItem('First piece is gone! Try again.');
        }
        // Swap positions
        game.board[first.row][first.col] = piece;
        game.board[row][col] = piece1;
        window._choiceScarfFirst = null;
        showStatusToast(`🧣 Swapped ${POKEMON[piece1.pokemon]?.name} and ${POKEMON[piece.pokemon]?.name}!`, 'buff');
        break;
      }
    }
    case 'EJECT_BUTTON': {
      if (!window._ejectPiece) {
        if (!piece || piece.color !== playerColor) return cancelItem('Select a friendly piece!');
        window._ejectPiece = { row, col };
        showStatusToast(`🔘 Now click an empty square to teleport to!`, 'buff');
        return true; // Don't consume yet
      } else {
        if (piece) {
          window._ejectPiece = null;
          return cancelItem('That square is occupied! Try again.');
        }
        const src = window._ejectPiece;
        const srcPiece = game.board[src.row][src.col];
        if (!srcPiece) {
          window._ejectPiece = null;
          return cancelItem('Piece is gone! Try again.');
        }
        game.board[row][col] = srcPiece;
        game.board[src.row][src.col] = null;
        window._ejectPiece = null;
        showStatusToast(`🔘 ${POKEMON[srcPiece.pokemon]?.name} teleported!`, 'buff');
        break;
      }
    }
    default:
      return cancelItem('Item not yet implemented');
  }

  consumeItem(itemId);
  activeItem = null;
  renderAll();
  return true;
}

function handleNewGame() {
  // If game is still in progress, count as a forfeit (loss)
  if (game.phase !== PHASES.GAME_OVER && !eloReported && gameMode !== 'local') {
    const playerColor = gameMode === 'online' ? game.onlineColor : game.playerColor;
    game.winner = playerColor === 'white' ? 'black' : 'white'; // opponent wins
    eloReported = true;
    handleEloUpdate();
  }

  if (clockInterval) clearInterval(clockInterval);
  aiThinking = false;
  eloReported = false;
  document.querySelector('.ai-thinking')?.remove();
  document.querySelector('.gameover-overlay')?.remove();
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

  // Daily coin reward
  const earned = awardDailyCoins();
  if (earned) {
    setTimeout(() => showStatusToast(`🪙 +${earned} PokéCoin${earned > 1 ? 's' : ''} earned! (daily reward)`, 'heal'), 1500);
  }
}

function showEloChangeToast(eloResult) {
  const { change, oldRating, newRating, stats } = eloResult;
  const rank = getRankTitle(newRating);
  const changeText = change >= 0 ? `+${change}` : `${change}`;
  const changeClass = change >= 0 ? 'elo-up' : 'elo-down';

  // Determine winner info
  const playerColor = gameMode === 'online' ? game.onlineColor : game.playerColor;
  let resultText, resultEmoji, resultClass;
  if (game.winner === 'draw') {
    resultText = 'Draw';
    resultEmoji = '🤝';
    resultClass = 'gameover--draw';
  } else if (game.winner === playerColor) {
    resultText = 'Victory!';
    resultEmoji = '👑';
    resultClass = 'gameover--win';
  } else {
    resultText = 'Defeat';
    resultEmoji = '💀';
    resultClass = 'gameover--loss';
  }

  const winnerTeam = game.winner && game.winner !== 'draw'
    ? TEAMS[COLOR_TO_TEAM[game.winner]]
    : null;

  // Remove existing overlay if any
  document.querySelector('.gameover-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'gameover-overlay';
  overlay.innerHTML = `
    <div class="gameover-panel ${resultClass}">
      <div class="gameover-result">
        <span class="gameover-emoji">${resultEmoji}</span>
        <h2 class="gameover-title">${resultText}</h2>
        ${winnerTeam ? `<p class="gameover-team" style="color:${winnerTeam.color}">${winnerTeam.name} wins</p>` : ''}
      </div>
      <div class="gameover-elo">
        <div class="gameover-elo__rank">${rank.emoji} ${rank.title}</div>
        <div class="gameover-elo__rating">
          <span class="gameover-elo__old">${oldRating}</span>
          <span class="gameover-elo__arrow">→</span>
          <span class="gameover-elo__new">${newRating}</span>
          <span class="gameover-elo__change ${changeClass}">${changeText}</span>
        </div>
        <div class="gameover-elo__stats">
          ${stats.wins}W / ${stats.losses}L / ${stats.draws}D
          ${stats.streak > 1 ? ` 🔥 ${stats.streak} streak` : ''}
        </div>
      </div>
      <button class="btn btn--start gameover-btn" id="gameover-new-game">
        ⚔️ Play Again
      </button>
    </div>
  `;
  document.body.appendChild(overlay);

  // Animate in
  requestAnimationFrame(() => overlay.classList.add('gameover-overlay--show'));

  // Wire play again button
  document.getElementById('gameover-new-game')?.addEventListener('click', () => {
    overlay.classList.remove('gameover-overlay--show');
    setTimeout(() => overlay.remove(), 300);
    document.getElementById('btn-new-game')?.click();
  });
}

// Boot
document.addEventListener('DOMContentLoaded', init);

// Cancel item targeting with ESC or right-click
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && activeItem) {
    activeItem = null;
    showStatusToast('Item cancelled', 'error');
    renderAll();
  }
});
document.addEventListener('contextmenu', (e) => {
  if (activeItem) {
    e.preventDefault();
    activeItem = null;
    showStatusToast('Item cancelled', 'error');
    renderAll();
  }
});

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

  // Center point — use actual cell positions (works with flipped board)
  const getCellCenter = (r, c) => {
    const cell = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
    if (cell) {
      const cr = cell.getBoundingClientRect();
      return { x: cr.left + cr.width / 2, y: cr.top + cr.height / 2 };
    }
    // Fallback to calculated position
    return { x: rect.left + c * cs + cs / 2, y: rect.top + r * cs + cs / 2 };
  };
  const centers = a.map(t => getCellCenter(t.row, t.col));
  const cx = centers.reduce((s, c) => s + c.x, 0) / centers.length;
  const cy = centers.reduce((s, c) => s + c.y, 0) / centers.length;

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
        setTimeout(() => w.remove(), 600);
      }, i * 100);
    }
  } else {
    // Beam lines to each target
    a.forEach(t => {
      const tc = getCellCenter(t.row, t.col);
      const tx = tc.x;
      const ty = tc.y;
      const ang = Math.atan2(ty - cy, tx - cx);
      const d = Math.hypot(tx - cx, ty - cy);
      const b = document.createElement('div');
      b.className = `ability-beam-generic ability-beam--${fx.shape}`;
      b.style.left = `${cx}px`; b.style.top = `${cy}px`;
      b.style.width = `${d}px`; b.style.transform = `rotate(${ang}rad)`;
      b.style.setProperty('--beam-color', color);
      document.body.appendChild(b);
      setTimeout(() => b.remove(), 450);

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
            setTimeout(() => tp.remove(), 500);
          }, 80 + i * 80);
        }
      }
    });
  }

  // ── Type-specific particles on each affected square ──
  a.forEach(t => {
    const tc = getCellCenter(t.row, t.col);
    const tx = tc.x;
    const ty = tc.y;

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
          e.style.animationDelay = `${i * 40}ms`;
          document.body.appendChild(e);
          setTimeout(() => e.remove(), 550);
        } else {
          // Dot particle (colored)
          const p = document.createElement('div');
          p.className = `ability-particle-generic ability-particle--${fx.shape}`;
          p.style.left = `${tx}px`; p.style.top = `${ty}px`;
          p.style.setProperty('--angle', `${Math.random() * 360}deg`);
          p.style.setProperty('--dist', `${18 + Math.random() * 28}px`);
          p.style.setProperty('--particle-color', color);
          document.body.appendChild(p);
          setTimeout(() => p.remove(), 450);
        }
      }
    }, isStatus ? 0 : 250);

    // Cell flash
    const c = document.querySelector(`.cell[data-row="${t.row}"][data-col="${t.col}"]`);
    if (c) {
      c.style.setProperty('--flash-color', color);
      c.classList.add('cell--ability-flash');
      setTimeout(() => c.classList.remove('cell--ability-flash'), 700);
    }
  });
}
