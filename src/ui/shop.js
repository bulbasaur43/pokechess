/**
 * Shop Module for PokéChess
 * In-game item shop with PokéCoins currency
 * 
 * - Items cost PokéCoins
 * - PokéCoins bought with real money (Stripe: Google Pay / Apple Pay)
 * - Admin can gift coins to any player
 * - Each item purchase grants 10 uses, usable once every 3 battles
 */

import { isLoggedIn, getProfile } from '../engine/auth.js';
import { POKEMON, POKEMON_POOL, KING_POOL } from '../engine/types.js';

const isDev = window.location.port === '5173' || window.location.port === '5174';
const API_BASE = isDev
  ? `http://${window.location.hostname}:3001/api`
  : `${window.location.origin}/api`;

// ─── Coin Packs (buy with real money) ───────────────────────────────

export const COIN_PACKS = [
  { id: 'pack_100',  coins: 100,  price: 99,   priceLabel: '$0.99',  bonus: '' },
  { id: 'pack_500',  coins: 500,  price: 399,  priceLabel: '$3.99',  bonus: '🔥 Best Value' },
  { id: 'pack_1200', coins: 1200, price: 699,  priceLabel: '$6.99',  bonus: '💎 Premium' },
];

// ─── Shop Items (cost PokéCoins) ────────────────────────────────────

export const SHOP_ITEMS = {
  MAX_POTION: {
    id: 'MAX_POTION',
    name: 'Max Potion',
    emoji: '🧪',
    coinCost: 50,
    description: 'Fully heal one piece to max HP',
    useDescription: 'Click a friendly piece to heal it',
    color: '#4ade80',
    usesPerPurchase: 10,
    cooldownBattles: 3,
  },
  RARE_CANDY: {
    id: 'RARE_CANDY',
    name: 'Rare Candy',
    emoji: '⚡',
    coinCost: 150,
    description: 'Instantly promote any pawn',
    useDescription: 'Click a friendly pawn to evolve it',
    color: '#facc15',
    usesPerPurchase: 10,
    cooldownBattles: 3,
  },
  FOCUS_SASH: {
    id: 'FOCUS_SASH',
    name: 'Focus Sash',
    emoji: '🛡️',
    coinCost: 100,
    description: 'Piece survives a fatal blow with 1 HP',
    useDescription: 'Click a piece to protect it',
    color: '#60a5fa',
    usesPerPurchase: 10,
    cooldownBattles: 3,
  },
  TEAM_REROLL: {
    id: 'TEAM_REROLL',
    name: 'Team Reroll',
    emoji: '🔄',
    coinCost: 25,
    description: 'Reroll your team before a match',
    useDescription: 'Used during team select',
    color: '#a78bfa',
    usesPerPurchase: 10,
    cooldownBattles: 3,
  },
  SHINY_CHARM: {
    id: 'SHINY_CHARM',
    name: 'Shiny Charm',
    emoji: '👑',
    coinCost: 50,
    description: 'Golden glow on all pieces for 10 games',
    useDescription: 'Auto-applied',
    color: '#fbbf24',
    usesPerPurchase: 10,
    cooldownBattles: 0,
  },
  X_ATTACK: {
    id: 'X_ATTACK',
    name: 'X Attack',
    emoji: '⚔️',
    coinCost: 75,
    description: '+1 damage to one piece for the game',
    useDescription: 'Click a piece to power up',
    color: '#ef4444',
    usesPerPurchase: 10,
    cooldownBattles: 3,
  },
  X_DEFENSE: {
    id: 'X_DEFENSE',
    name: 'X Defense',
    emoji: '🔰',
    coinCost: 75,
    description: '+2 max HP to one piece for the game',
    useDescription: 'Click a piece to toughen up',
    color: '#3b82f6',
    usesPerPurchase: 10,
    cooldownBattles: 3,
  },
  REVIVE: {
    id: 'REVIVE',
    name: 'Revive',
    emoji: '💎',
    coinCost: 200,
    description: 'Bring back a captured piece at half HP',
    useDescription: 'Select from captured list',
    color: '#c084fc',
    usesPerPurchase: 10,
    cooldownBattles: 3,
  },
  QUICK_CLAW: {
    id: 'QUICK_CLAW',
    name: 'Quick Claw',
    emoji: '⚡',
    coinCost: 125,
    description: 'Move again immediately (extra turn)',
    useDescription: 'Activates after your next move',
    color: '#fcd34d',
    usesPerPurchase: 10,
    cooldownBattles: 3,
  },
  LEFTOVERS: {
    id: 'LEFTOVERS',
    name: 'Leftovers',
    emoji: '🍎',
    coinCost: 100,
    description: 'One piece heals 1 HP each turn',
    useDescription: 'Click a piece to give Leftovers',
    color: '#86efac',
    usesPerPurchase: 10,
    cooldownBattles: 3,
  },
  SMOKE_BALL: {
    id: 'SMOKE_BALL',
    name: 'Smoke Ball',
    emoji: '💨',
    coinCost: 80,
    description: 'One piece becomes immune to abilities for 5 turns',
    useDescription: 'Click a piece to protect',
    color: '#94a3b8',
    usesPerPurchase: 10,
    cooldownBattles: 3,
  },
  DESTINY_BOND: {
    id: 'DESTINY_BOND',
    name: 'Destiny Bond',
    emoji: '💀',
    coinCost: 175,
    description: 'When this piece dies, the killer dies too',
    useDescription: 'Click a piece to bind',
    color: '#a855f7',
    usesPerPurchase: 10,
    cooldownBattles: 3,
  },
};

// ─── State ──────────────────────────────────────────────────────────
// Load immediately so getCoins() works before shop is opened

let _coins = 0;
let _inventory = {};
let _battleCount = 0;
let _unlockedPokemon = [];
let _lastDailyReward = ''; // ISO date string e.g. '2026-04-27'
const STATE_KEY = 'pokechess_shop';

function loadState() {
  try {
    const cached = localStorage.getItem(STATE_KEY);
    if (cached) {
      const data = JSON.parse(cached);
      _coins = data.coins || 0;
      _inventory = data.inventory || {};
      _battleCount = data.battleCount || 0;
      _unlockedPokemon = data.unlockedPokemon || [];
      _lastDailyReward = data.lastDailyReward || '';
    }
  } catch { _coins = 0; _inventory = {}; _battleCount = 0; _unlockedPokemon = []; _lastDailyReward = ''; }
}

function saveState() {
  localStorage.setItem(STATE_KEY, JSON.stringify({
    coins: _coins,
    inventory: _inventory,
    battleCount: _battleCount,
    unlockedPokemon: _unlockedPokemon,
    lastDailyReward: _lastDailyReward,
  }));
}

// Load from localStorage immediately at module init
loadState();

/** Call on app start to sync from server (picks up admin coin changes) */
export async function initShop() {
  loadState();
  await loadFromServer();
}

// ─── Pokémon Purchase ───────────────────────────────────────────────

/** Coin cost scales with ELO requirement */
export function getPokemonCoinCost(requiredElo) {
  if (requiredElo <= 0) return 0; // Free Pokémon can't be bought
  if (requiredElo <= 700) return 50;
  if (requiredElo <= 1000) return 100;
  if (requiredElo <= 1300) return 200;
  if (requiredElo <= 1600) return 350;
  if (requiredElo <= 1900) return 500;
  return 750; // 2000+ (legendaries)
}

export function isPokemonUnlocked(key) {
  return _unlockedPokemon.includes(key);
}

export function unlockPokemon(key, cost) {
  if (_coins < cost) return false;
  if (_unlockedPokemon.includes(key)) return false;
  _coins -= cost;
  _unlockedPokemon.push(key);
  saveState();
  syncToServer();
  return true;
}

export function getUnlockedPokemon() { return [..._unlockedPokemon]; }

// ─── Public API ─────────────────────────────────────────────────────

export function getCoins() { return _coins; }

/** Call after completing a game — awards 1-3 coins once per day */
export function awardDailyCoins() {
  const today = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
  if (_lastDailyReward === today) return null; // already claimed today
  const earned = Math.floor(Math.random() * 3) + 1; // 1-3
  _coins += earned;
  _lastDailyReward = today;
  saveState();
  syncToServer();
  return earned;
}

export function canEarnDaily() {
  const today = new Date().toISOString().slice(0, 10);
  return _lastDailyReward !== today;
}

export function getItemUses(itemId) {
  const entry = _inventory[itemId];
  return entry ? entry.uses || 0 : 0;
}

export function isItemReady(itemId) {
  const entry = _inventory[itemId];
  if (!entry || entry.uses <= 0) return false;
  const item = SHOP_ITEMS[itemId];
  if (!item) return false;
  if (item.cooldownBattles <= 0) return true;
  return (_battleCount - (entry.lastUsedBattle || 0)) >= item.cooldownBattles;
}

export function getCooldownRemaining(itemId) {
  const entry = _inventory[itemId];
  if (!entry) return 0;
  const item = SHOP_ITEMS[itemId];
  if (!item || item.cooldownBattles <= 0) return 0;
  return Math.max(0, item.cooldownBattles - (_battleCount - (entry.lastUsedBattle || 0)));
}

export function consumeItem(itemId) {
  const entry = _inventory[itemId];
  if (!entry || entry.uses <= 0 || !isItemReady(itemId)) return false;
  entry.uses--;
  entry.lastUsedBattle = _battleCount;
  if (entry.uses <= 0) delete _inventory[itemId];
  saveState();
  syncToServer();
  return true;
}

export function incrementBattleCount() {
  _battleCount++;
  saveState();
}

export function getBattleCount() { return _battleCount; }

export function getInventory() {
  if (_coins === 0 && Object.keys(_inventory).length === 0) loadState();
  return { ..._inventory };
}

// ─── Buy item with coins ────────────────────────────────────────────

function buyItemWithCoins(itemId) {
  const item = SHOP_ITEMS[itemId];
  if (!item) return { error: 'Unknown item' };
  if (_coins < item.coinCost) return { error: `Need ${item.coinCost} coins (you have ${_coins})` };

  _coins -= item.coinCost;
  if (_inventory[itemId]) {
    _inventory[itemId].uses += item.usesPerPurchase;
  } else {
    _inventory[itemId] = { uses: item.usesPerPurchase, lastUsedBattle: 0 };
  }
  saveState();
  syncToServer();
  return { success: true };
}

// ─── Buy coins with real money ──────────────────────────────────────

async function buyCoins(packId) {
  const pack = COIN_PACKS.find(p => p.id === packId);
  if (!pack) return { error: 'Unknown pack' };

  const token = localStorage.getItem('pokechess_token');
  if (!token) return { error: 'Please log in first' };

  try {
    const res = await fetch(`${API_BASE}/shop/buy-coins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ packId }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error || 'Payment failed' };

    // Test mode: server grants coins directly
    if (data.granted) {
      _coins += pack.coins;
      saveState();
      return { success: true, testMode: true };
    }

    // Real Stripe flow
    const stripe = await loadStripeJS();
    if (!stripe) return { error: 'Payment system unavailable' };

    const { clientSecret } = data;

    const paymentRequest = stripe.paymentRequest({
      country: 'US',
      currency: 'usd',
      total: { label: `${pack.coins} PokéCoins`, amount: pack.price },
      requestPayerName: true,
    });

    const canMakePayment = await paymentRequest.canMakePayment();
    if (canMakePayment) {
      return new Promise((resolve) => {
        paymentRequest.on('paymentmethod', async (ev) => {
          const { error: err } = await stripe.confirmCardPayment(
            clientSecret, { payment_method: ev.paymentMethod.id }, { handleActions: false }
          );
          if (err) { ev.complete('fail'); resolve({ error: err.message }); }
          else { ev.complete('success'); _coins += pack.coins; saveState(); resolve({ success: true }); }
        });
        paymentRequest.show();
      });
    } else {
      const { error } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: { token: 'tok_visa' } },
      });
      if (error) return { error: error.message };
      _coins += pack.coins;
      saveState();
      return { success: true };
    }
  } catch (e) {
    return { error: e.message || 'Payment failed' };
  }
}

// ─── Server sync ────────────────────────────────────────────────────

async function syncToServer() {
  const token = localStorage.getItem('pokechess_token');
  if (!token) return;
  try {
    await fetch(`${API_BASE}/shop/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ coins: _coins, inventory: _inventory, battleCount: _battleCount, unlockedPokemon: _unlockedPokemon }),
    });
  } catch { /* silent */ }
}

async function loadFromServer() {
  const token = localStorage.getItem('pokechess_token');
  if (!token) return;
  try {
    const res = await fetch(`${API_BASE}/shop/sync`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.coins != null) _coins = data.coins;
      if (data.inventory) _inventory = data.inventory;
      if (data.battleCount != null) _battleCount = data.battleCount;
      if (data.unlockedPokemon) _unlockedPokemon = data.unlockedPokemon;
      saveState();
    }
  } catch { /* silent */ }
}

// Lazy-load Stripe.js
let _stripe = null;
async function loadStripeJS() {
  if (_stripe) return _stripe;
  const key = window.__STRIPE_PK__;
  if (!key) return null;
  try {
    if (!window.Stripe) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://js.stripe.com/v3/';
        s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    _stripe = window.Stripe(key);
    return _stripe;
  } catch { return null; }
}

// ─── Shop UI ────────────────────────────────────────────────────────

let _shopOpen = false;
let _onItemUse = null;

export function openShop(onItemUse) {
  if (_shopOpen) return;
  _shopOpen = true;
  _onItemUse = onItemUse;

  loadState();
  if (isLoggedIn()) loadFromServer();

  const overlay = document.createElement('div');
  overlay.className = 'shop-overlay';
  overlay.id = 'shop-overlay';

  const panel = document.createElement('div');
  panel.className = 'shop-panel';

  panel.innerHTML = `
    <button class="shop-close" id="shop-close">✕</button>
    <h2 class="shop-title">🛒 PokéShop</h2>

    <div class="shop-coming-soon">
      <span class="shop-coming-soon__icon">🚧</span>
      <div class="shop-coming-soon__text">
        <strong>Coming Soon!</strong>
        <p>Purchasing will be available in a future update. Browse what's coming below!</p>
      </div>
    </div>

    <div class="shop-section">
      <h3 class="shop-section-title">💰 PokéCoin Packs <span class="shop-section-hint">Coming soon</span></h3>
      <div class="shop-packs" id="shop-packs"></div>
    </div>

    <div class="shop-section">
      <h3 class="shop-section-title">🎒 Items <span class="shop-section-hint">10 uses per purchase • 3 battle cooldown</span></h3>
      <div class="shop-items" id="shop-items"></div>
    </div>

    <div class="shop-section">
      <h3 class="shop-section-title">🐾 Pokémon <span class="shop-section-hint">Unlock without ELO requirement</span></h3>
      <div class="shop-pokemon" id="shop-pokemon"></div>
    </div>
  `;

  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('shop-overlay--show'));

  renderCoinPacks();
  renderShopItems();
  renderPokemonShop();
  renderInventory();

  document.getElementById('shop-close').addEventListener('click', closeShop);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeShop(); });
}

export function closeShop() {
  const overlay = document.getElementById('shop-overlay');
  if (!overlay) return;
  overlay.classList.remove('shop-overlay--show');
  setTimeout(() => overlay.remove(), 300);
  _shopOpen = false;
}

function updateCoinsDisplay() {
  const el = document.querySelector('.shop-coins-amount');
  if (el) el.textContent = _coins;
}

function renderCoinPacks() {
  const container = document.getElementById('shop-packs');
  if (!container) return;
  container.innerHTML = '';

  for (const pack of COIN_PACKS) {
    const card = document.createElement('button');
    card.className = 'shop-pack shop-pack--disabled';
    card.disabled = true;
    card.title = 'Coming soon!';
    card.innerHTML = `
      <div class="shop-pack__coins">🪙 ${pack.coins}</div>
      <div class="shop-pack__price">${pack.priceLabel}</div>
      ${pack.bonus ? `<div class="shop-pack__bonus">${pack.bonus}</div>` : ''}
    `;
    container.appendChild(card);
  }
}

function renderShopItems() {
  const container = document.getElementById('shop-items');
  if (!container) return;
  container.innerHTML = '';

  for (const item of Object.values(SHOP_ITEMS)) {
    const card = document.createElement('div');
    card.className = 'shop-card';
    card.style.setProperty('--item-color', item.color);

    card.innerHTML = `
      <div class="shop-card__icon">${item.emoji}</div>
      <div class="shop-card__info">
        <div class="shop-card__name">${item.name}</div>
        <div class="shop-card__desc">${item.description}</div>
      </div>
      <div class="shop-card__buy shop-card__buy--disabled" title="Coming soon">
        <span class="shop-card__price">🪙 ${item.coinCost}</span>
      </div>
    `;

    container.appendChild(card);
  }
}

function renderInventory() {
  const container = document.getElementById('shop-inventory');
  if (!container) return;

  const items = Object.entries(_inventory).filter(([_, v]) => v && v.uses > 0);
  if (items.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = '<h3 class="shop-inv-title">📦 Your Items</h3>';
  const grid = document.createElement('div');
  grid.className = 'shop-inv-grid';

  for (const [itemId, entry] of items) {
    const item = SHOP_ITEMS[itemId];
    if (!item) continue;

    const ready = isItemReady(itemId);
    const cd = getCooldownRemaining(itemId);

    const el = document.createElement('button');
    el.className = `shop-inv-item ${!ready ? 'shop-inv-item--cooldown' : ''}`;
    el.style.setProperty('--item-color', item.color);
    el.innerHTML = `
      <span class="shop-inv-emoji">${item.emoji}</span>
      <span class="shop-inv-qty">${entry.uses} left</span>
      <span class="shop-inv-name">${item.name}</span>
      ${cd > 0 ? `<span class="shop-inv-cd">⏳${cd}</span>` : ''}
    `;
    el.title = ready ? `Use: ${item.useDescription}` : `Cooldown: ${cd} battle(s)`;
    el.disabled = !ready;
    el.addEventListener('click', () => {
      if (!ready) return;
      closeShop();
      _onItemUse?.(itemId);
    });
    grid.appendChild(el);
  }
  container.appendChild(grid);
}
function renderPokemonShop() {
  const container = document.getElementById('shop-pokemon');
  if (!container) return;
  container.innerHTML = '';

  // Collect all ELO-locked Pokémon from both teams
  const allPokemon = [];
  for (const teamKey of ['scarlet', 'violet']) {
    const pool = POKEMON_POOL[teamKey] || [];
    for (const entry of pool) {
      if (entry.requiredElo > 0) {
        allPokemon.push({ ...entry, team: teamKey });
      }
    }
    const kings = KING_POOL[teamKey] || [];
    for (const entry of kings) {
      if (entry.requiredElo > 0) {
        allPokemon.push({ ...entry, team: teamKey, isKing: true });
      }
    }
  }

  // Sort by cost (ELO requirement)
  allPokemon.sort((a, b) => a.requiredElo - b.requiredElo);

  if (allPokemon.length === 0) {
    container.innerHTML = '<div class="shop-inv-empty">No Pokémon available</div>';
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'shop-pokemon-grid';

  for (const entry of allPokemon) {
    const pkmn = POKEMON[entry.key];
    if (!pkmn) continue;

    const cost = getPokemonCoinCost(entry.requiredElo);

    const card = document.createElement('div');
    card.className = 'shop-pkmn-card shop-pkmn-card--locked';
    card.title = `${pkmn.name} — 🪙 ${cost} coins (Coming soon!)`;
    card.innerHTML = `
      <img class="shop-pkmn-img" src="${pkmn.img || ''}" alt="${pkmn.name}" />
      <div class="shop-pkmn-name">${pkmn.name}</div>
      <div class="shop-pkmn-stats">❤️${pkmn.hp} ⚔️${pkmn.damage}</div>
      <div class="shop-pkmn-cost">🪙 ${cost}</div>
    `;

    grid.appendChild(card);
  }

  container.appendChild(grid);
}

function showShopToast(message, type) {
  const toast = document.createElement('div');
  toast.className = `shop-toast shop-toast--${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('shop-toast--show'));
  setTimeout(() => {
    toast.classList.remove('shop-toast--show');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// Init
loadState();
