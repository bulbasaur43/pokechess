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

// ─── Pokémon Packs ──────────────────────────────────────────────────
// Each pack costs 50 coins and contains 1 random Pokémon.
// Rarer Pokémon have lower drop weights.

const PACK_COST = 50;

/** Map requiredElo → rarity tier & drop weight */
function getPackWeight(requiredElo) {
  if (requiredElo <= 0)    return { tier: 'starter',   weight: 0 }; // starters can't drop
  if (requiredElo <= 700)  return { tier: 'common',    weight: 50 };
  if (requiredElo <= 1000) return { tier: 'uncommon',  weight: 25 };
  if (requiredElo <= 1300) return { tier: 'rare',      weight: 10 };
  if (requiredElo <= 1600) return { tier: 'epic',      weight: 5 };
  if (requiredElo <= 1900) return { tier: 'legendary', weight: 2 };
  return                            { tier: 'mythic',   weight: 1 };
}

const TIER_COLORS = {
  common:    '#9ca3af',
  uncommon:  '#22c55e',
  rare:      '#3b82f6',
  epic:      '#a855f7',
  legendary: '#f59e0b',
  mythic:    '#ef4444',
};

const TIER_LABELS = {
  common:    '★',
  uncommon:  '★★',
  rare:      '★★★',
  epic:      '★★★★',
  legendary: '★★★★★',
  mythic:    '★★★★★★',
};

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

// ─── Cosmetics ──────────────────────────────────────────────────────

export const COSMETICS = {
  PARTY_HAT:   { id: 'PARTY_HAT',   name: 'Party Hat',     emoji: '🎉', overlay: '🥳', coinCost: 5,  position: 'top',    color: '#f472b6' },
  CROWN:       { id: 'CROWN',       name: 'Crown',         emoji: '👑', overlay: '👑', coinCost: 15, position: 'top',    color: '#fbbf24' },
  SUNGLASSES:  { id: 'SUNGLASSES',  name: 'Sunglasses',    emoji: '🕶️', overlay: '🕶️', coinCost: 10, position: 'middle', color: '#1e293b' },
  BOW:         { id: 'BOW',         name: 'Bow',           emoji: '🎀', overlay: '🎀', coinCost: 5,  position: 'top',    color: '#fb7185' },
  FLAME_AURA:  { id: 'FLAME_AURA',  name: 'Flame Aura',   emoji: '🔥', overlay: '🔥', coinCost: 20, position: 'aura',   color: '#ef4444' },
  ICE_AURA:    { id: 'ICE_AURA',    name: 'Ice Aura',     emoji: '❄️', overlay: '❄️', coinCost: 20, position: 'aura',   color: '#38bdf8' },
  SPARKLE:     { id: 'SPARKLE',     name: 'Sparkle',       emoji: '✨', overlay: '✨', coinCost: 12, position: 'aura',   color: '#fcd34d' },
  RAINBOW:     { id: 'RAINBOW',     name: 'Rainbow Trail', emoji: '🌈', overlay: '🌈', coinCost: 25, position: 'bottom', color: '#a78bfa' },
  // Premium Gaming Cosmetics — actual pixel art images
  MAJORAS_MASK:  { id: 'MAJORAS_MASK',  name: "Majora's Mask",  emoji: '🎭', overlay: '🎭', img: '/assets/cosmetics/majoras_mask.png', coinCost: 75, position: 'middle', color: '#7c3aed' },
  LINKS_HAT:     { id: 'LINKS_HAT',     name: "Link's Hat",     emoji: '🧝', overlay: '🧝', img: '/assets/cosmetics/links_hat.png',   coinCost: 75, position: 'top',    color: '#22c55e' },
  MARIOS_HAT:    { id: 'MARIOS_HAT',    name: "Mario's Hat",    emoji: '🍄', overlay: '🍄', img: '/assets/cosmetics/marios_hat.png',  coinCost: 75, position: 'top',    color: '#ef4444' },
  PIKACHU_EARS:  { id: 'PIKACHU_EARS',  name: 'Pikachu Ears',   emoji: '⚡', overlay: '⚡', img: '/assets/cosmetics/pikachu_ears.png', coinCost: 75, position: 'top',    color: '#facc15' },
  MASTER_SWORD:  { id: 'MASTER_SWORD',  name: 'Master Sword',   emoji: '⚔️', overlay: '⚔️', img: '/assets/cosmetics/master_sword.png', coinCost: 75, position: 'aura',   color: '#60a5fa' },
  POKEBALL:      { id: 'POKEBALL',      name: 'Poké Ball',      emoji: '🔴', overlay: '🔴', img: '/assets/cosmetics/pokeball.png',    coinCost: 75, position: 'bottom', color: '#dc2626' },
};

// ─── State ──────────────────────────────────────────────────────────
// Load immediately so getCoins() works before shop is opened

let _coins = 0;
let _inventory = {};
let _battleCount = 0;
let _unlockedPokemon = [];
let _lastDailyReward = '';
let _ownedCosmetics = [];   // cosmetic IDs owned
let _equippedCosmetic = ''; // currently active cosmetic ID
const STATE_KEY = 'pokechess_shop';

// Pre-process cosmetic images that need background removal.
// Only MASTER_SWORD has a dark background — all others already have transparency.
const NEEDS_BG_REMOVAL = new Set(['MASTER_SWORD']);

(function initCosmeticImages() {
  for (const [key, c] of Object.entries(COSMETICS)) {
    if (!c.img || !NEEDS_BG_REMOVAL.has(key)) continue;
    const origSrc = c.img;
    const imgEl = new Image();
    imgEl.crossOrigin = 'anonymous';
    imgEl.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = imgEl.naturalWidth;
      canvas.height = imgEl.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imgEl, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = data.data;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i+1], b = d[i+2];
        // Remove near-black pixels only (the sword's dark background)
        if (r < 35 && g < 35 && b < 35) {
          d[i+3] = 0;
        }
        // Soften dark edges
        else if (r < 55 && g < 55 && b < 55) {
          d[i+3] = Math.min(d[i+3], Math.round(((r + g + b) / 3 - 35) / 20 * 255));
        }
      }
      ctx.putImageData(data, 0, 0);
      c.img = canvas.toDataURL('image/png');
    };
    imgEl.src = origSrc;
  }
})();

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
      _ownedCosmetics = data.ownedCosmetics || [];
      _equippedCosmetic = data.equippedCosmetic || '';
    }
  } catch { _coins = 0; _inventory = {}; _battleCount = 0; _unlockedPokemon = []; _lastDailyReward = ''; _ownedCosmetics = []; _equippedCosmetic = ''; }
}

function saveState() {
  localStorage.setItem(STATE_KEY, JSON.stringify({
    coins: _coins,
    inventory: _inventory,
    battleCount: _battleCount,
    unlockedPokemon: _unlockedPokemon,
    lastDailyReward: _lastDailyReward,
    ownedCosmetics: _ownedCosmetics,
    equippedCosmetic: _equippedCosmetic,
  }));
}

// Load from localStorage immediately at module init
loadState();

/** Call on app start to sync from server (picks up admin coin changes) */
export async function initShop() {
  loadState();
  await loadFromServer();
}

// ─── Cosmetic API ───────────────────────────────────────────────────

export function buyCosmetic(cosmeticId) {
  const c = COSMETICS[cosmeticId];
  if (!c) return false;
  if (_ownedCosmetics.includes(cosmeticId)) return false;
  if (_coins < c.coinCost) return false;
  _coins -= c.coinCost;
  _ownedCosmetics.push(cosmeticId);
  saveState();
  syncToServer();
  return true;
}

export function equipCosmetic(cosmeticId) {
  if (cosmeticId && !_ownedCosmetics.includes(cosmeticId)) return;
  _equippedCosmetic = cosmeticId || '';
  saveState();
  syncToServer();
}

export function getEquippedCosmetic() { return _equippedCosmetic; }
export function getOwnedCosmetics() { return [..._ownedCosmetics]; }

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
    <div class="shop-coins-display" id="shop-coins">
      <span class="shop-coins-icon">🪙</span>
      <span class="shop-coins-amount">${_coins}</span>
      <span class="shop-coins-label">PokéCoins</span>
    </div>

    <div class="shop-section">
      <h3 class="shop-section-title">📦 Pokémon Packs <span class="shop-section-hint">🪙 ${PACK_COST} each — unlock random Pokémon!</span></h3>
      <div class="shop-packs-pokemon" id="shop-packs-pokemon"></div>
    </div>

    <div class="shop-section">
      <h3 class="shop-section-title">🎨 Cosmetics <span class="shop-section-hint">Customize your Pokémon!</span></h3>
      <div class="shop-cosmetics" id="shop-cosmetics"></div>
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

  renderPokemonPacks();
  renderCosmetics();
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
  const titleEl = document.getElementById('title-coin-count');
  if (titleEl) titleEl.textContent = _coins;
}

function renderCosmetics() {
  const container = document.getElementById('shop-cosmetics');
  if (!container) return;
  container.innerHTML = '';

  const grid = document.createElement('div');
  grid.className = 'shop-cosmetic-grid';

  for (const c of Object.values(COSMETICS)) {
    const owned = _ownedCosmetics.includes(c.id);
    const equipped = _equippedCosmetic === c.id;
    const canAfford = _coins >= c.coinCost;

    const card = document.createElement('button');
    card.className = `shop-cosmetic-card ${owned ? 'shop-cosmetic-card--owned' : ''} ${equipped ? 'shop-cosmetic-card--equipped' : ''}`;
    card.style.setProperty('--cosmetic-color', c.color);
    const preview = c.img
      ? `<img class="shop-cosmetic-preview-img" src="${c.img}" alt="${c.name}" />`
      : `<div class="shop-cosmetic-preview">${c.overlay}</div>`;
    card.innerHTML = `
      ${preview}
      <div class="shop-cosmetic-name">${c.name}</div>
      ${owned
        ? `<div class="shop-cosmetic-action">${equipped ? '✓ Equipped' : 'Equip'}</div>`
        : `<div class="shop-cosmetic-price ${!canAfford ? 'shop-cosmetic-price--cant' : ''}">🪙 ${c.coinCost}</div>`
      }
    `;

    card.addEventListener('click', () => {
      if (owned) {
        equipCosmetic(equipped ? '' : c.id);
        renderCosmetics();
      } else if (canAfford) {
        if (buyCosmetic(c.id)) {
          equipCosmetic(c.id);
          showShopToast(`🎨 ${c.name} purchased & equipped!`, 'success');
          updateCoinsDisplay();
          renderCosmetics();
        }
      } else {
        showShopToast(`Need ${c.coinCost} coins (you have ${_coins})`, 'error');
      }
    });

    grid.appendChild(card);
  }

  container.appendChild(grid);
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
    const owned = _inventory[item.id]?.uses || 0;
    const canAfford = _coins >= item.coinCost;

    const card = document.createElement('div');
    card.className = 'shop-card';
    card.style.setProperty('--item-color', item.color);

    card.innerHTML = `
      <div class="shop-card__icon">${item.emoji}</div>
      <div class="shop-card__info">
        <div class="shop-card__name">${item.name}${owned > 0 ? ` <span class="shop-card__owned">${owned} left</span>` : ''}</div>
        <div class="shop-card__desc">${item.description}</div>
      </div>
      <button class="shop-card__buy ${!canAfford ? 'shop-card__buy--disabled' : ''}" ${!canAfford ? 'title="Not enough coins"' : ''}>
        <span class="shop-card__price">🪙 ${item.coinCost}</span>
      </button>
    `;

    const buyBtn = card.querySelector('.shop-card__buy');
    buyBtn.addEventListener('click', () => {
      if (!canAfford) {
        showShopToast(`Need ${item.coinCost} coins (you have ${_coins})`, 'error');
        return;
      }
      const result = buyItemWithCoins(item.id);
      if (result.error) {
        showShopToast(result.error, 'error');
      } else {
        showShopToast(`${item.emoji} ${item.name} purchased! (+${item.usesPerPurchase} uses)`, 'success');
        updateCoinsDisplay();
        renderShopItems();
        renderInventory();
      }
    });

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
async function renderPokemonShop() {
  const container = document.getElementById('shop-pokemon');
  if (!container) return;
  container.innerHTML = '';

  // Get player's current ELO to filter out already-unlocked Pokémon
  const { loadPlayerStats } = await import('../engine/elo.js');
  const stats = loadPlayerStats();
  const playerElo = stats?.rating || 600;

  // Collect only ELO-locked Pokémon the player can't access yet (and not already coin-unlocked)
  const allPokemon = [];
  for (const teamKey of ['scarlet', 'violet']) {
    const pool = POKEMON_POOL[teamKey] || [];
    for (const entry of pool) {
      if (entry.requiredElo > 0 && playerElo < entry.requiredElo && !_unlockedPokemon.includes(entry.key)) {
        allPokemon.push({ ...entry, team: teamKey });
      }
    }
    const kings = KING_POOL[teamKey] || [];
    for (const entry of kings) {
      if (entry.requiredElo > 0 && playerElo < entry.requiredElo && !_unlockedPokemon.includes(entry.key)) {
        allPokemon.push({ ...entry, team: teamKey, isKing: true });
      }
    }
  }

  // Sort by cost (ELO requirement)
  allPokemon.sort((a, b) => a.requiredElo - b.requiredElo);

  if (allPokemon.length === 0) {
    container.innerHTML = '<div class="shop-inv-empty">You\'ve unlocked all Pok\u00e9mon! \ud83c\udf89</div>';
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'shop-pokemon-grid';

  for (const entry of allPokemon) {
    const pkmn = POKEMON[entry.key];
    if (!pkmn) continue;

    const cost = getPokemonCoinCost(entry.requiredElo);
    const canAfford = _coins >= cost;

    const card = document.createElement('button');
    card.className = `shop-pkmn-card ${canAfford ? '' : 'shop-pkmn-card--locked'}`;
    card.title = `${pkmn.name} — \ud83e\ude99 ${cost} coins`;
    card.innerHTML = `
      <img class="shop-pkmn-img" src="${pkmn.img || ''}" alt="${pkmn.name}" />
      <div class="shop-pkmn-name">${pkmn.name}</div>
      <div class="shop-pkmn-stats">\u2764\ufe0f${pkmn.hp} \u2694\ufe0f${pkmn.damage}</div>
      <div class="shop-pkmn-cost">\ud83e\ude99 ${cost}</div>
    `;

    card.addEventListener('click', () => {
      if (!canAfford) {
        showShopToast(`Need ${cost} coins for ${pkmn.name} (you have ${_coins})`, 'error');
        return;
      }
      if (unlockPokemon(entry.key, cost)) {
        showShopToast(`\ud83c\udf89 ${pkmn.name} unlocked!`, 'success');
        updateCoinsDisplay();
        renderPokemonShop();
        renderPokemonPacks();
      }
    });

    grid.appendChild(card);
  }

  container.appendChild(grid);
}

// ─── Pokémon Pack System ────────────────────────────────────────────

function buildPackPool() {
  const pool = [];
  for (const teamKey of ['scarlet', 'violet']) {
    const entries = [...(POKEMON_POOL[teamKey] || []), ...(KING_POOL[teamKey] || [])];
    for (const entry of entries) {
      const { tier, weight } = getPackWeight(entry.requiredElo);
      if (weight <= 0) continue; // skip starters
      const pkmn = POKEMON[entry.key];
      if (!pkmn) continue;
      pool.push({ key: entry.key, team: teamKey, tier, weight, pkmn });
    }
  }
  return pool;
}

function rollPack() {
  const pool = buildPackPool();
  if (pool.length === 0) return null;
  const totalWeight = pool.reduce((sum, p) => sum + p.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const entry of pool) {
    roll -= entry.weight;
    if (roll <= 0) return entry;
  }
  return pool[pool.length - 1];
}

export function buyPokemonPack() {
  if (_coins < PACK_COST) return { error: `Need ${PACK_COST} coins (you have ${_coins})` };
  const result = rollPack();
  if (!result) return { error: 'No Pokémon available' };
  _coins -= PACK_COST;
  const isDuplicate = _unlockedPokemon.includes(result.key);
  if (isDuplicate) {
    // Refund half cost for duplicates
    const refund = Math.floor(PACK_COST / 2);
    _coins += refund;
  } else {
    _unlockedPokemon.push(result.key);
  }
  saveState();
  syncToServer();
  return { success: true, result, isDuplicate };
}

function renderPokemonPacks() {
  const container = document.getElementById('shop-packs-pokemon');
  if (!container) return;
  container.innerHTML = '';

  const section = document.createElement('div');
  section.className = 'shop-pack-section';

  // Pack card
  const packCard = document.createElement('button');
  const canAfford = _coins >= PACK_COST;
  packCard.className = `shop-pack-buy ${canAfford ? '' : 'shop-pack-buy--disabled'}`;
  packCard.innerHTML = `
    <div class="shop-pack-visual">
      <div class="shop-pack-ball">🔴</div>
      <div class="shop-pack-glow"></div>
    </div>
    <div class="shop-pack-info">
      <div class="shop-pack-title">Pokémon Pack</div>
      <div class="shop-pack-desc">Contains 1 random Pokémon</div>
      <div class="shop-pack-rates">
        <span style="color:${TIER_COLORS.common}">Common 54%</span>
        <span style="color:${TIER_COLORS.uncommon}">Uncommon 27%</span>
        <span style="color:${TIER_COLORS.rare}">Rare 11%</span>
        <span style="color:${TIER_COLORS.epic}">Epic 5%</span>
        <span style="color:${TIER_COLORS.legendary}">Legend 2%</span>
        <span style="color:${TIER_COLORS.mythic}">Mythic 1%</span>
      </div>
    </div>
    <div class="shop-pack-price">
      <span>🪙 ${PACK_COST}</span>
    </div>
  `;

  packCard.addEventListener('click', () => {
    if (_coins < PACK_COST) {
      showShopToast(`Need ${PACK_COST} coins (you have ${_coins})`, 'error');
      return;
    }
    const res = buyPokemonPack();
    if (res.error) {
      showShopToast(res.error, 'error');
      return;
    }
    showPackReveal(res.result, res.isDuplicate);
    updateCoinsDisplay();
    renderPokemonPacks();
    renderPokemonShop();
  });

  section.appendChild(packCard);

  // Owned count
  const ownedCount = _unlockedPokemon.length;
  const pool = buildPackPool();
  const info = document.createElement('div');
  info.className = 'shop-pack-owned';
  info.textContent = `${ownedCount} Pokémon unlocked from packs • ${pool.length} available in pool`;
  section.appendChild(info);

  container.appendChild(section);
}

function showPackReveal(result, isDuplicate) {
  const pkmn = result.pkmn;
  const tierColor = TIER_COLORS[result.tier] || '#fff';
  const tierLabel = TIER_LABELS[result.tier] || '';

  const overlay = document.createElement('div');
  overlay.className = 'pack-reveal-overlay';
  overlay.innerHTML = `
    <div class="pack-reveal-card">
      <div class="pack-reveal-glow" style="--tier-color: ${tierColor}"></div>
      <div class="pack-reveal-sparkles"></div>
      <img class="pack-reveal-img" src="${pkmn.img || ''}" alt="${pkmn.name}" />
      <div class="pack-reveal-name">${pkmn.name}</div>
      <div class="pack-reveal-tier" style="color: ${tierColor}">${tierLabel} ${result.tier.toUpperCase()}</div>
      <div class="pack-reveal-types">${pkmn.types.join(' / ')}</div>
      <div class="pack-reveal-stats">❤️ ${pkmn.hp} HP  ⚔️ ${pkmn.damage} DMG</div>
      ${isDuplicate
        ? `<div class="pack-reveal-dupe">Already owned! 🪙 ${Math.floor(PACK_COST / 2)} refunded</div>`
        : `<div class="pack-reveal-new">✨ NEW POKÉMON UNLOCKED! ✨</div>`
      }
      <button class="pack-reveal-close">Continue</button>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('pack-reveal-overlay--show'));

  // Add sparkle particles
  const sparkleContainer = overlay.querySelector('.pack-reveal-sparkles');
  for (let i = 0; i < 20; i++) {
    const s = document.createElement('div');
    s.className = 'pack-reveal-sparkle';
    s.style.setProperty('--x', `${Math.random() * 200 - 100}px`);
    s.style.setProperty('--y', `${Math.random() * 200 - 100}px`);
    s.style.setProperty('--d', `${Math.random() * 0.5 + 0.2}s`);
    s.style.setProperty('--color', tierColor);
    sparkleContainer.appendChild(s);
  }

  overlay.querySelector('.pack-reveal-close').addEventListener('click', () => {
    overlay.classList.remove('pack-reveal-overlay--show');
    setTimeout(() => overlay.remove(), 300);
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.remove('pack-reveal-overlay--show');
      setTimeout(() => overlay.remove(), 300);
    }
  });
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
