/**
 * Battle Modal for PokéChess
 * Animated modal showing Pokémon battle resolution with bike mode transform
 */

import { TYPES, POKEMON, TEAMS, COLOR_TO_TEAM } from '../engine/types.js';
import { ROLES } from '../engine/board.js';

export function showBattleModal(battleResult, onComplete) {
  const existing = document.getElementById('battle-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'battle-modal-overlay';
  overlay.id = 'battle-modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'battle-modal';
  modal.id = 'battle-modal';

  const { attacker, defender, outcome, isCritical, damageDealt, defenderHpBefore, defenderHpAfter, messages } = battleResult;

  const atkPkmn = attacker.pokemon ? POKEMON[attacker.pokemon] : null;
  const defPkmn = defender.pokemon ? POKEMON[defender.pokemon] : null;
  const atkTeam = TEAMS[COLOR_TO_TEAM[attacker.color]];
  const defTeam = TEAMS[COLOR_TO_TEAM[defender.color]];

  const atkName = atkPkmn?.name ?? atkTeam.pawnName;
  const defName = defPkmn?.name ?? defTeam.pawnName;
  const atkEmoji = atkPkmn?.emoji ?? atkTeam.pawnEmoji;
  const defEmoji = defPkmn?.emoji ?? defTeam.pawnEmoji;
  const atkImg = atkPkmn?.img;
  const defImg = defPkmn?.img;

  let outcomeClass = '', outcomeIcon = '';
  switch (outcome) {
    case 'kill':
      outcomeClass = isCritical ? 'outcome--critical' : 'outcome--capture';
      outcomeIcon = isCritical ? '💥' : '💀';
      break;
    case 'damage':
      outcomeClass = 'outcome--damage';
      outcomeIcon = '⚔️';
      break;
  }

  const atkTypeBadges = attacker.types.map(t =>
    `<span class="modal-type-badge" style="--tc:${TYPES[t]?.color}">${TYPES[t]?.emoji} ${TYPES[t]?.name}</span>`
  ).join('');
  const defTypeBadges = defender.types.map(t =>
    `<span class="modal-type-badge" style="--tc:${TYPES[t]?.color}">${TYPES[t]?.emoji} ${TYPES[t]?.name}</span>`
  ).join('');

  const atkVisual = atkImg
    ? `<img class="battle-modal__fighter-img${attacker.role === 'TRUE_KING' ? ' battle-modal__bike-transform' : ''}" src="${atkImg}" alt="${atkName}" />`
    : `<div class="battle-modal__fighter-emoji">${atkEmoji}</div>`;

  const defVisual = defImg
    ? `<img class="battle-modal__fighter-img" src="${defImg}" alt="${defName}" />`
    : `<div class="battle-modal__fighter-emoji">${defEmoji}</div>`;

  const defHpPercent = Math.max(0, (defenderHpAfter / defender.maxHp) * 100);
  const defHpClass = defHpPercent > 60 ? 'hp--high' : defHpPercent > 30 ? 'hp--mid' : 'hp--low';

  modal.innerHTML = `
    <div class="battle-modal__flash ${outcomeClass}"></div>
    <h2 class="battle-modal__title">⚔️ BATTLE!</h2>

    <div class="battle-modal__fighters">
      <div class="battle-modal__fighter" style="--fighter-color:${atkTeam.color}">
        ${atkVisual}
        <div class="battle-modal__fighter-name">${atkName}</div>
        <div class="battle-modal__fighter-types">${atkTypeBadges}</div>
        <div class="battle-modal__fighter-stat">⚔️ DMG: ${damageDealt}${isCritical ? ' (CRIT!)' : ''}</div>
        <div class="battle-modal__fighter-side ${attacker.color}">${atkTeam.name}</div>
      </div>

      <div class="battle-modal__vs">
        <span class="battle-modal__vs-text" id="battle-vs-text">VS</span>
      </div>

      <div class="battle-modal__fighter" style="--fighter-color:${defTeam.color}">
        ${defVisual}
        <div class="battle-modal__fighter-name">${defName}</div>
        <div class="battle-modal__fighter-types">${defTypeBadges}</div>
        <div class="battle-modal__fighter-hp">
          <div class="modal-hp-bar">
            <div class="modal-hp-fill ${defHpClass}" style="width:${defHpPercent}%"></div>
          </div>
          <div class="modal-hp-text">❤️ ${defenderHpBefore} → ${defenderHpAfter} / ${defender.maxHp}</div>
        </div>
        <div class="battle-modal__fighter-side ${defender.color}">${defTeam.name}</div>
      </div>
    </div>

    <div class="battle-modal__result ${outcomeClass}" id="battle-result">
      <div class="battle-modal__outcome-icon">${outcomeIcon}</div>
      <div class="battle-modal__messages" id="battle-messages"></div>
    </div>

    <div class="battle-modal__continue" id="battle-continue">Click anywhere to continue</div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const messagesEl = document.getElementById('battle-messages');
  const resultEl = document.getElementById('battle-result');
  const continueEl = document.getElementById('battle-continue');

  resultEl.style.opacity = '0';
  continueEl.style.opacity = '0';

  // Animate VS
  setTimeout(() => {
    const vs = document.getElementById('battle-vs-text');
    if (vs) vs.classList.add('battle-modal__vs-text--animate');
  }, 200);

  // Bike transform animation for True Kings
  setTimeout(() => {
    const bikeEl = modal.querySelector('.battle-modal__bike-transform');
    if (bikeEl) bikeEl.classList.add('battle-modal__bike-transform--active');
  }, 400);

  // Show result
  setTimeout(() => {
    resultEl.style.opacity = '1';
    resultEl.classList.add('battle-modal__result--show');

    messages.forEach((msg, i) => {
      setTimeout(() => {
        const msgEl = document.createElement('div');
        msgEl.className = 'battle-modal__message';
        msgEl.textContent = msg;
        messagesEl.appendChild(msgEl);
        requestAnimationFrame(() => msgEl.classList.add('battle-modal__message--show'));
      }, i * 350);
    });

    setTimeout(() => { continueEl.style.opacity = '1'; }, messages.length * 350 + 300);
  }, 900);

  // Dismiss
  let canClose = false;
  setTimeout(() => { canClose = true; }, 1400);

  const closeHandler = () => {
    if (!canClose) return;
    overlay.classList.add('battle-modal-overlay--closing');
    setTimeout(() => {
      overlay.remove();
      onComplete?.();
    }, 300);
  };

  overlay.addEventListener('click', closeHandler);
  setTimeout(() => {
    if (document.getElementById('battle-modal-overlay')) closeHandler();
  }, 6000);
}

/**
 * Promotion dialog
 */
export function showPromotionDialog(piece, onChoice) {
  const existing = document.getElementById('promotion-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'battle-modal-overlay';
  overlay.id = 'promotion-overlay';

  const modal = document.createElement('div');
  modal.className = 'promotion-modal';

  const team = TEAMS[COLOR_TO_TEAM[piece.color]];
  const typeNames = piece.types.map(t => `${TYPES[t]?.emoji} ${TYPES[t]?.name}`).join(' / ');

  modal.innerHTML = `
    <h2 class="promotion-modal__title">🌟 Evolution!</h2>
    <p class="promotion-modal__subtitle">Your Pokémon evolves into a new form!</p>
    <div class="promotion-modal__choices" id="promotion-choices"></div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const choicesEl = document.getElementById('promotion-choices');
  // Can promote to: Queen, Rook, Bishop, Knight (not King or True King)
  const promoOptions = [
    { role: 'QUEEN',  label: 'Queen' },
    { role: 'ROOK',   label: 'Rook' },
    { role: 'BISHOP', label: 'Bishop' },
    { role: 'KNIGHT', label: 'Knight' },
  ];

  for (const opt of promoOptions) {
    // Find the Pokémon for this role on this team
    const pkmn = Object.values(POKEMON).find(p => p.team === COLOR_TO_TEAM[piece.color] && p.role === opt.role);
    const btn = document.createElement('button');
    btn.className = 'promotion-btn';
    btn.id = `promo-${opt.role}`;
    btn.innerHTML = `
      <span class="promotion-btn__emoji">${pkmn?.emoji ?? '?'}</span>
      <span class="promotion-btn__name">${pkmn?.name ?? opt.label}</span>
      <span class="promotion-btn__types">${pkmn?.types.map(t => TYPES[t]?.emoji).join(' ') ?? ''}</span>
    `;
    btn.addEventListener('click', () => {
      overlay.classList.add('battle-modal-overlay--closing');
      setTimeout(() => { overlay.remove(); onChoice(opt.role); }, 300);
    });
    choicesEl.appendChild(btn);
  }
}
