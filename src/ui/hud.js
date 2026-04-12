/**
 * HUD for PokéChess
 * Turn indicator, captured Pokémon, battle log, type chart, and controls
 */

import { TYPES, POKEMON, TEAMS, COLOR_TO_TEAM, TYPE_KEYS, getEffectiveness } from '../engine/types.js';
import { ROLES } from '../engine/board.js';
import { PHASES } from '../engine/game.js';
import { loadPlayerStats, getRankTitle, getWinRate } from '../engine/elo.js';

export function renderHUD(game, callbacks) {
  const hud = document.getElementById('hud');
  if (!hud) return;
  hud.innerHTML = '';

  // ── Turn Indicator ──
  const turn = document.createElement('div');
  turn.className = 'hud__section hud__turn';
  turn.id = 'hud-turn';

  if (game.phase === PHASES.PLAY) {
    const team = TEAMS[COLOR_TO_TEAM[game.currentPlayer]];
    const isPlayerTurn = !game.isAIGame || game.currentPlayer === game.playerColor;
    const turnLabel = isPlayerTurn ? 'Your Turn' : '🤖 AI Turn';
    turn.innerHTML = `
      <div class="hud__turn-indicator">
        <span class="hud__turn-dot" style="background:${team.color}"></span>
        <span class="hud__turn-label">
          ${team.name} — ${turnLabel}
        </span>
      </div>
      <span class="hud__turn-num">Turn ${game.turnCount}</span>
    `;
  } else if (game.phase === PHASES.GAME_OVER) {
    if (game.winner === 'draw') {
      turn.innerHTML = `<div class="hud__turn-gameover">🤝 Draw — Both True Kings fell!</div>`;
    } else {
      const winTeam = TEAMS[COLOR_TO_TEAM[game.winner]];
      turn.innerHTML = `<div class="hud__turn-gameover" style="color:${winTeam.color}">
        👑 ${winTeam.name} Wins!
      </div>`;
    }
  }
  hud.appendChild(turn);

  // ── Chess Clock ──
  if (game.phase === PHASES.PLAY || game.phase === PHASES.GAME_OVER) {
    const clock = document.createElement('div');
    clock.className = 'hud__section hud__clock';
    clock.id = 'hud-clock';

    const formatTime = (ms) => {
      const totalSec = Math.ceil(ms / 1000);
      const min = Math.floor(totalSec / 60);
      const sec = totalSec % 60;
      return `${min}:${sec.toString().padStart(2, '0')}`;
    };

    const whiteTeam = TEAMS[COLOR_TO_TEAM['white']];
    const blackTeam = TEAMS[COLOR_TO_TEAM['black']];
    const wTime = game.clock?.white ?? 0;
    const bTime = game.clock?.black ?? 0;
    const wUrgent = wTime < 60000 ? 'clock--urgent' : '';
    const bUrgent = bTime < 60000 ? 'clock--urgent' : '';

    clock.innerHTML = `
      <div class="clock__row ${game.currentPlayer === 'white' ? 'clock--active' : ''} ${wUrgent}">
        <span class="clock__label" style="color:${whiteTeam.color}">${whiteTeam.name}</span>
        <span class="clock__time">${formatTime(wTime)}</span>
      </div>
      <div class="clock__row ${game.currentPlayer === 'black' ? 'clock--active' : ''} ${bUrgent}">
        <span class="clock__label" style="color:${blackTeam.color}">${blackTeam.name}</span>
        <span class="clock__time">${formatTime(bTime)}</span>
      </div>
    `;
    hud.appendChild(clock);
  }

  // ── Captured Pokémon ──
  const captured = document.createElement('div');
  captured.className = 'hud__section hud__captured';
  captured.appendChild(renderCaptured('white', game.capturedPieces.white));
  captured.appendChild(renderCaptured('black', game.capturedPieces.black));
  hud.appendChild(captured);

  // ── Battle Log ──
  const log = document.createElement('div');
  log.className = 'hud__section hud__log';
  log.innerHTML = `<h3 class="hud__log-title">📜 Battle Log</h3>`;

  const logList = document.createElement('div');
  logList.className = 'hud__log-list';
  logList.id = 'log-list';

  if (game.moveLog.length === 0) {
    logList.innerHTML = '<div class="hud__log-empty">No battles yet...</div>';
  } else {
    for (const entry of game.moveLog.slice(-10).reverse()) {
      logList.appendChild(createLogEntry(entry));
    }
  }
  log.appendChild(logList);
  hud.appendChild(log);

  // ── ELO Rating Display ──
  const stats = loadPlayerStats();
  const rank = getRankTitle(stats.rating);
  const winRate = getWinRate(stats);

  const eloSection = document.createElement('div');
  eloSection.className = 'hud__section hud__elo';
  eloSection.innerHTML = `
    <div class="hud__elo-header">
      <span class="hud__elo-rank" style="color:${rank.color}">${rank.emoji} ${stats.username ? stats.username : rank.title}</span>
      <span class="hud__elo-rating">${stats.rating}</span>
    </div>
    <div class="hud__elo-bar">
      <div class="hud__elo-fill" style="width:${Math.min(100, (stats.rating / 2200) * 100)}%; background:${rank.color}"></div>
    </div>
    <div class="hud__elo-stats">
      <span class="hud__elo-stat hud__elo-stat--win">${stats.wins}W</span>
      <span class="hud__elo-stat hud__elo-stat--loss">${stats.losses}L</span>
      <span class="hud__elo-stat hud__elo-stat--draw">${stats.draws}D</span>
      <span class="hud__elo-stat">${winRate}% WR</span>
      ${stats.streak > 1 ? `<span class="hud__elo-streak">🔥${stats.streak}</span>` : ''}
      ${stats.peak > stats.rating ? `<span class="hud__elo-peak">Peak: ${stats.peak}</span>` : ''}
    </div>
  `;
  hud.appendChild(eloSection);

  // ── Controls ──
  const controls = document.createElement('div');
  controls.className = 'hud__section hud__controls';

  const newBtn = document.createElement('button');
  newBtn.className = 'btn btn--danger';
  newBtn.id = 'btn-new-game';
  newBtn.textContent = '🔄 New Game';
  newBtn.addEventListener('click', () => callbacks?.onNewGame?.());
  controls.appendChild(newBtn);

  const chartBtn = document.createElement('button');
  chartBtn.className = 'btn btn--secondary';
  chartBtn.id = 'btn-type-chart';
  chartBtn.textContent = '📊 Type Chart';
  chartBtn.addEventListener('click', toggleTypeChart);
  controls.appendChild(chartBtn);

  hud.appendChild(controls);
  renderTypeChartOverlay();
}

function renderCaptured(color, pieces) {
  const team = TEAMS[COLOR_TO_TEAM[color]];
  const el = document.createElement('div');
  el.className = `hud__captured-side hud__captured-side--${color}`;

  const label = document.createElement('div');
  label.className = 'hud__captured-label';
  label.innerHTML = `<span style="color:${team.color}">${team.name}</span> losses:`;
  el.appendChild(label);

  const list = document.createElement('div');
  list.className = 'hud__captured-list';

  if (pieces.length === 0) {
    list.innerHTML = '<span class="hud__none">—</span>';
  } else {
    const sorted = [...pieces].sort((a, b) => (ROLES[b.role]?.value ?? 0) - (ROLES[a.role]?.value ?? 0));
    for (const p of sorted) {
      const pkmn = p.pokemon ? POKEMON[p.pokemon] : null;
      const span = document.createElement('span');
      span.className = 'hud__cap-piece';
      span.textContent = pkmn?.emoji ?? TEAMS[COLOR_TO_TEAM[p.color]].pawnEmoji;
      span.title = pkmn?.name ?? TEAMS[COLOR_TO_TEAM[p.color]].pawnName;
      span.style.setProperty('--tc', TYPES[p.types[0]]?.color ?? '#888');
      list.appendChild(span);
    }
  }
  el.appendChild(list);
  return el;
}

function createLogEntry(entry) {
  const el = document.createElement('div');
  el.className = 'hud__log-entry';

  const r = entry.result;
  const atkPkmn = entry.attacker.pokemon ? POKEMON[entry.attacker.pokemon] : null;
  const defPkmn = entry.defender.pokemon ? POKEMON[entry.defender.pokemon] : null;
  const atkName = atkPkmn?.emoji ?? TEAMS[COLOR_TO_TEAM[entry.attacker.color]].pawnEmoji;
  const defName = defPkmn?.emoji ?? TEAMS[COLOR_TO_TEAM[entry.defender.color]].pawnEmoji;

  let icon = '';
  let cls = '';
  switch (r.outcome) {
    case 'kill': icon = r.isCritical ? '💥' : '💀'; cls = 'log--capture'; break;
    case 'damage': icon = '⚔️'; cls = 'log--damage'; break;
  }

  const dmgText = `-${r.damageDealt}`;

  el.classList.add(cls);
  el.innerHTML = `
    <span class="log-turn">T${entry.turn}</span>
    <span class="log-matchup">${atkName} → ${defName}</span>
    <span class="log-damage">${dmgText}</span>
    <span class="log-outcome">${icon}</span>
  `;
  el.title = r.messages.join(' | ');
  return el;
}

// ─── Type Chart Overlay ─────────────────────────────────────────────

function renderTypeChartOverlay() {
  if (document.getElementById('type-chart-overlay')) return;

  const overlay = document.createElement('div');
  overlay.className = 'type-chart-overlay';
  overlay.id = 'type-chart-overlay';
  overlay.style.display = 'none';

  // Only show types used by our Pokémon
  const usedTypes = new Set();
  for (const p of Object.values(POKEMON)) {
    p.types.forEach(t => usedTypes.add(t));
  }
  usedTypes.add('NORMAL'); // pawns
  const typeList = TYPE_KEYS.filter(t => usedTypes.has(t));

  const panel = document.createElement('div');
  panel.className = 'type-chart-panel';

  let html = `
    <button class="type-chart-close" id="tc-close">✕</button>
    <h2 class="type-chart-title">📊 Type Chart</h2>
    <div class="type-chart-grid">
      <div class="type-chart-row type-chart-row--header">
        <span class="type-chart-cell type-chart-cell--corner">ATK↓ DEF→</span>
        ${typeList.map(k => `<span class="type-chart-cell type-chart-cell--header" title="${TYPES[k].name}">${TYPES[k].emoji}</span>`).join('')}
      </div>
  `;

  for (const atk of typeList) {
    html += `<div class="type-chart-row"><span class="type-chart-cell type-chart-cell--label" style="color:${TYPES[atk].color}">${TYPES[atk].emoji} ${TYPES[atk].name}</span>`;
    for (const def of typeList) {
      const eff = getEffectiveness([atk], [def]);
      let text = '—', cls = 'eff-normal';
      if (eff.multiplier >= 2) { text = '2×'; cls = 'eff-super'; }
      else if (eff.multiplier === 0) { text = '0'; cls = 'eff-zero'; }
      else if (eff.multiplier < 1) { text = '½'; cls = 'eff-not'; }
      html += `<span class="type-chart-cell ${cls}" title="${TYPES[atk].name} → ${TYPES[def].name}: ${eff.description}">${text}</span>`;
    }
    html += `</div>`;
  }

  html += `</div>
    <div class="type-chart-legend">
      <span class="eff-super">2× Super Effective</span>
      <span class="eff-normal">— Normal</span>
      <span class="eff-not">½ Not Very Effective</span>
      <span class="eff-zero">0 No Effect</span>
    </div>`;

  panel.innerHTML = html;
  overlay.appendChild(panel);
  overlay.addEventListener('click', e => { if (e.target === overlay) toggleTypeChart(); });
  document.body.appendChild(overlay);

  // Defer event binding
  setTimeout(() => {
    document.getElementById('tc-close')?.addEventListener('click', toggleTypeChart);
  }, 0);
}

function toggleTypeChart() {
  const ol = document.getElementById('type-chart-overlay');
  if (!ol) return;
  if (ol.style.display === 'none') {
    ol.style.display = 'flex';
    requestAnimationFrame(() => ol.classList.add('type-chart-overlay--show'));
  } else {
    ol.classList.remove('type-chart-overlay--show');
    setTimeout(() => { ol.style.display = 'none'; }, 300);
  }
}
