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
const BOX_COST = 200; // 5 packs for 200 (saves 50 vs buying singles)

/** Map requiredElo → rarity tier & drop weight */
function getPackWeight(requiredElo) {
  if (requiredElo <= 0) return { tier: 'starter', weight: 0 }; // starters can't drop
  if (requiredElo <= 700) return { tier: 'common', weight: 50 };
  if (requiredElo <= 1000) return { tier: 'uncommon', weight: 25 };
  if (requiredElo <= 1300) return { tier: 'rare', weight: 10 };
  if (requiredElo <= 1600) return { tier: 'epic', weight: 5 };
  if (requiredElo <= 1900) return { tier: 'legendary', weight: 2 };
  return { tier: 'mythic', weight: 1 };
}

const TIER_COLORS = {
  common: '#9ca3af',
  uncommon: '#22c55e',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b',
  mythic: '#ef4444',
};

const TIER_LABELS = {
  common: '★',
  uncommon: '★★',
  rare: '★★★',
  epic: '★★★★',
  legendary: '★★★★★',
  mythic: '★★★★★★',
};

const isDev = window.location.port === '5173' || window.location.port === '5174';
const API_BASE = isDev
  ? `http://${window.location.hostname}:3001/api`
  : `${window.location.origin}/api`;

// ─── Coin Packs (buy with real money) ───────────────────────────────

export const COIN_PACKS = [
  { id: 'pack_100', coins: 100, price: 99, priceLabel: '$0.99', bonus: '' },
  { id: 'pack_500', coins: 500, price: 399, priceLabel: '$3.99', bonus: '🔥 Best Value' },
  { id: 'pack_1200', coins: 1200, price: 699, priceLabel: '$6.99', bonus: '💎 Premium' },
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
    cooldownBattles: 0,
  },
  RARE_CANDY: {
    id: 'RARE_CANDY',
    name: 'Rare Candy',
    emoji: '🍬',
    coinCost: 150,
    description: 'Instantly promote any pawn',
    useDescription: 'Click a friendly pawn to evolve it',
    color: '#facc15',
    usesPerPurchase: 10,
    cooldownBattles: 0,
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
    cooldownBattles: 0,
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
    cooldownBattles: 0,
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
    cooldownBattles: 0,
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
    cooldownBattles: 0,
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
    cooldownBattles: 0,
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
    cooldownBattles: 0,
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
    cooldownBattles: 0,
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
    cooldownBattles: 0,
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
    cooldownBattles: 0,
  },
  OBLITERATOR: {
    id: 'OBLITERATOR',
    name: 'Obliterator',
    emoji: '🗡️',
    coinCost: 1000,
    description: 'Next attack is a guaranteed one-hit KO',
    useDescription: 'Click a piece to arm',
    color: '#22d3ee',
    usesPerPurchase: 1,
    cooldownBattles: 0,
  },
  RAZOR_LEAF: {
    id: 'RAZOR_LEAF',
    name: 'Razor Leaf Storm',
    emoji: '🍃',
    coinCost: 300,
    description: 'Adds +1 AOE damage to abilities (+2 on Bulbasaur)',
    useDescription: 'Click a piece to empower with leaves',
    color: '#4ade80',
    usesPerPurchase: 3,
    cooldownBattles: 0,
    hidden: true,
  },
};

// ─── Cosmetics ──────────────────────────────────────────────────────

export const COSMETICS = {
  PARTY_HAT: { id: 'PARTY_HAT', name: 'Party Hat', emoji: '🎉', overlay: '🥳', coinCost: 5, position: 'top', color: '#f472b6' },
  CROWN: { id: 'CROWN', name: 'Crown', emoji: '👑', overlay: '👑', coinCost: 15, position: 'top', color: '#fbbf24' },
  SUNGLASSES: { id: 'SUNGLASSES', name: 'Sunglasses', emoji: '🕶️', overlay: '🕶️', coinCost: 10, position: 'middle', color: '#1e293b' },
  BOW: { id: 'BOW', name: 'Bow', emoji: '🎀', overlay: '🎀', coinCost: 5, position: 'top', color: '#fb7185' },
  FLAME_AURA: { id: 'FLAME_AURA', name: 'Flame Aura', emoji: '🔥', overlay: '🔥', coinCost: 20, position: 'aura', color: '#ef4444' },
  ICE_AURA: { id: 'ICE_AURA', name: 'Ice Aura', emoji: '❄️', overlay: '❄️', coinCost: 20, position: 'aura', color: '#38bdf8' },
  SPARKLE: { id: 'SPARKLE', name: 'Sparkle', emoji: '✨', overlay: '✨', coinCost: 12, position: 'aura', color: '#fcd34d' },
  RAINBOW: { id: 'RAINBOW', name: 'Rainbow Trail', emoji: '🌈', overlay: '🌈', coinCost: 25, position: 'bottom', color: '#a78bfa' },
  // Premium Gaming Cosmetics — actual pixel art images
  MAJORAS_MASK: { id: 'MAJORAS_MASK', name: "Majora's Mask", emoji: '🎭', overlay: '🎭', img: '/assets/cosmetics/majoras_mask.png', coinCost: 75, position: 'middle', color: '#7c3aed' },
  LINKS_HAT: { id: 'LINKS_HAT', name: "Link's Hat", emoji: '🧝', overlay: '🧝', img: '/assets/cosmetics/links_hat.png', coinCost: 75, position: 'top', color: '#22c55e' },
  MARIOS_HAT: { id: 'MARIOS_HAT', name: "Mario's Hat", emoji: '🍄', overlay: '🍄', img: '/assets/cosmetics/marios_hat.png', coinCost: 75, position: 'top', color: '#ef4444' },
  PIKACHU_EARS: { id: 'PIKACHU_EARS', name: 'Pikachu Ears', emoji: '⚡', overlay: '⚡', img: '/assets/cosmetics/pikachu_ears.png', coinCost: 75, position: 'top', color: '#facc15' },
  MASTER_SWORD: { id: 'MASTER_SWORD', name: 'Master Sword', emoji: '⚔️', overlay: '⚔️', img: '/assets/cosmetics/master_sword.png', coinCost: 75, position: 'aura', color: '#60a5fa' },
  ONE_HIT_OBLITERATOR: { id: 'ONE_HIT_OBLITERATOR', name: 'One-Hit Obliterator', emoji: '🗡️', overlay: '🗡️', img: '/assets/cosmetics/one_hit_obliterator.png', coinCost: 200, position: 'aura', color: '#22d3ee' },
  POKEBALL: { id: 'POKEBALL', name: 'Poké Ball', emoji: '🔴', overlay: '🔴', img: '/assets/cosmetics/pokeball.png', coinCost: 75, position: 'bottom', color: '#dc2626' },
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
let _pokemonLevels = {};    // { POKEMON_KEY: level (1-5) }
let _unlockedHiddenItems = [];  // hidden item IDs unlocked via achievements

// ─── Upgrade System ─────────────────────────────────────────────────
const MAX_POKEMON_LEVEL = 2;
const UPGRADE_COSTS = [200]; // Cost for level 2 (one upgrade per Pokémon)

/** Get upgrade bonus stats for a given level. Level 2 gives +1 HP and +1 damage. */
const UPGRADE_HP_TABLE =  [0, 1];  // cumulative
const UPGRADE_DMG_TABLE = [0, 1];  // cumulative

export function getUpgradeBonus(level) {
  if (!level || level <= 1) return { hp: 0, damage: 0 };
  const idx = Math.min(level, MAX_POKEMON_LEVEL) - 1;
  return {
    hp: UPGRADE_HP_TABLE[idx] || 0,
    damage: UPGRADE_DMG_TABLE[idx] || 0,
  };
}

export function getPokemonLevel(key) { return _pokemonLevels[key] || 1; }
export function getAllPokemonLevels() { return { ..._pokemonLevels }; }

export function getUpgradeCost(key) {
  const currentLevel = getPokemonLevel(key);
  if (currentLevel >= MAX_POKEMON_LEVEL) return null; // Max level
  return UPGRADE_COSTS[currentLevel - 1];
}

export function upgradePokemon(key) {
  const cost = getUpgradeCost(key);
  if (cost === null) return { error: 'Already max level' };
  if (_coins < cost) return { error: `Need ${cost} coins (you have ${_coins})` };
  _coins -= cost;
  _pokemonLevels[key] = (getPokemonLevel(key)) + 1;
  saveState();
  syncToServer();
  return { success: true, newLevel: _pokemonLevels[key] };
}
const STATE_KEY = 'pokechess_shop';

// Pre-process cosmetic images that need background removal.
// Per-asset config: 'dark' removes near-black, 'light' removes near-white.
const BG_REMOVAL_CONFIG = {
  MASTER_SWORD: 'dark',
  ONE_HIT_OBLITERATOR: 'grey',
  LINKS_HAT: 'light',
};

(function initCosmeticImages() {
  for (const [key, c] of Object.entries(COSMETICS)) {
    const mode = BG_REMOVAL_CONFIG[key];
    if (!c.img || !mode) continue;
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
        const r = d[i], g = d[i + 1], b = d[i + 2];
        if (mode === 'dark') {
          // Remove near-black pixels (the sword's dark background)
          if (r < 35 && g < 35 && b < 35) {
            d[i + 3] = 0;
          } else if (r < 55 && g < 55 && b < 55) {
            d[i + 3] = Math.min(d[i + 3], Math.round(((r + g + b) / 3 - 35) / 20 * 255));
          }
        } else if (mode === 'light') {
          // Remove near-white pixels (Link's Hat white background)
          if (r > 220 && g > 220 && b > 220) {
            d[i + 3] = 0;
          } else if (r > 200 && g > 200 && b > 200) {
            d[i + 3] = Math.min(d[i + 3], Math.round((255 - (r + g + b) / 3) / 55 * 255));
          }
        } else if (mode === 'grey') {
          // Remove grey/light background (obliterator)
          const avg = (r + g + b) / 3;
          const spread = Math.abs(r - avg) + Math.abs(g - avg) + Math.abs(b - avg);
          if (avg > 160 && spread < 30) {
            d[i + 3] = 0;
          } else if (avg > 140 && spread < 40) {
            d[i + 3] = Math.min(d[i + 3], Math.round((160 - avg) / 20 * 255));
          }
        }
      }
      ctx.putImageData(data, 0, 0);
      c.img = canvas.toDataURL('image/png');
    };
    imgEl.src = c.img;
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
      _pokemonLevels = data.pokemonLevels || {};
      _unlockedHiddenItems = data.unlockedHiddenItems || [];
    }
  } catch { _coins = 0; _inventory = {}; _battleCount = 0; _unlockedPokemon = []; _lastDailyReward = ''; _ownedCosmetics = []; _equippedCosmetic = ''; _pokemonLevels = {}; _unlockedHiddenItems = []; }
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
    pokemonLevels: _pokemonLevels,
    unlockedHiddenItems: _unlockedHiddenItems,
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

/** Coin cost scales with ELO requirement. Pack-only Pokémon cost 2x. */
export function getPokemonCoinCost(requiredElo, packOnly = false) {
  let base;
  if (requiredElo <= 0) return 0; // Free Pokémon can't be bought
  if (requiredElo <= 700) base = 50;
  else if (requiredElo <= 1000) base = 100;
  else if (requiredElo <= 1300) base = 200;
  else if (requiredElo <= 1600) base = 350;
  else if (requiredElo <= 1900) base = 500;
  else base = 750; // 2000+ (legendaries)
  return packOnly ? base * 2 : base;
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

// Trade: remove a Pokémon you're giving away, add the one you receive
export function executeTrade(giveKey, receiveKey) {
  // Remove the given pokemon (if in unlocked list)
  const idx = _unlockedPokemon.indexOf(giveKey);
  if (idx !== -1) {
    _unlockedPokemon.splice(idx, 1);
  }
  // Always add the received pokemon (even if already owned — it's a trade dupe)
  _unlockedPokemon.push(receiveKey);
  saveState();
  syncToServer();
  return true;
}

// Dupe choice: refund coins for a duplicate
export function refundDupe(amount) {
  _coins += amount;
  saveState();
  syncToServer();
}

// Dupe choice: keep the duplicate (adds extra copy for trading)
export function keepDupe(key) {
  _unlockedPokemon.push(key);
  saveState();
  syncToServer();
}

// ─── Public API ─────────────────────────────────────────────────────

export function getCoins() { return _coins; }

// Hidden item unlocks (via achievements like minigame scores)
export function unlockHiddenItem(itemId) {
  if (_unlockedHiddenItems.includes(itemId)) return false;
  _unlockedHiddenItems.push(itemId);
  saveState();
  return true;
}
export function isHiddenItemUnlocked(itemId) {
  return _unlockedHiddenItems.includes(itemId);
}

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
  // Never used yet — always ready
  if (!entry.lastUsedBattle) return true;
  return (_battleCount - entry.lastUsedBattle) >= item.cooldownBattles;
}

export function getCooldownRemaining(itemId) {
  const entry = _inventory[itemId];
  if (!entry) return 0;
  const item = SHOP_ITEMS[itemId];
  if (!item || item.cooldownBattles <= 0) return 0;
  if (!entry.lastUsedBattle) return 0;
  return Math.max(0, item.cooldownBattles - (_battleCount - entry.lastUsedBattle));
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

    // Real Stripe: redirect to Checkout
    if (data.checkoutUrl) {
      window.location.href = data.checkoutUrl;
      return { success: true, redirecting: true };
    }

    return { error: 'Payment system error' };
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
      body: JSON.stringify({ coins: _coins, inventory: _inventory, battleCount: _battleCount, unlockedPokemon: _unlockedPokemon, pokemonLevels: _pokemonLevels }),
    });
  } catch { /* silent */ }
}

export async function loadFromServer() {
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
      if (data.pokemonLevels) _pokemonLevels = data.pokemonLevels;
      saveState();
    }
  } catch { /* silent */ }
}

// Lazy-load Stripe.js
let _stripe = null;
async function loadStripeJS() {
  if (_stripe) return _stripe;
  try {
    // Fetch publishable key from server
    const isDev = window.location.port === '5173' || window.location.port === '5174';
    const base = isDev ? `http://${window.location.hostname}:3001/api` : `${window.location.origin}/api`;
    const res = await fetch(`${base}/shop/config`);
    const config = await res.json();
    if (!config.stripePublishableKey) return null;

    if (!window.Stripe) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://js.stripe.com/v3/';
        s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    _stripe = window.Stripe(config.stripePublishableKey);
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
      <h3 class="shop-section-title">💰 PokéCoin Packs</h3>
      <div class="shop-packs" id="shop-packs"></div>
    </div>

    <div class="shop-section">
      <h3 class="shop-section-title">🎒 Items <span class="shop-section-hint">10 uses per purchase</span></h3>
      <div class="shop-items" id="shop-items"></div>
    </div>

    <div class="shop-section">
      <h3 class="shop-section-title">🐾 Pokémon <span class="shop-section-hint">Unlock without ELO requirement</span></h3>
      <div class="shop-pokemon" id="shop-pokemon"></div>
    </div>
    <div class="shop-section">
      <h3 class="shop-section-title">👑 True King Upgrades <span class="shop-section-hint">+1 HP & +1 DMG per level (max 3)</span></h3>
      <div class="shop-upgrades" id="shop-upgrades"></div>
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
  renderUpgrades();
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
    card.className = 'shop-pack';
    card.innerHTML = `
      <div class="shop-pack__coins">🪙 ${pack.coins}</div>
      <div class="shop-pack__price">${pack.priceLabel}</div>
      ${pack.bonus ? `<div class="shop-pack__bonus">${pack.bonus}</div>` : ''}
    `;
    card.addEventListener('click', async () => {
      card.disabled = true;
      card.classList.add('shop-pack--loading');
      const origText = card.querySelector('.shop-pack__price').textContent;
      card.querySelector('.shop-pack__price').textContent = 'Processing...';
      const result = await buyCoins(pack.id);
      card.disabled = false;
      card.classList.remove('shop-pack--loading');
      card.querySelector('.shop-pack__price').textContent = origText;
      if (result.error) {
        showShopToast(result.error, 'error');
      } else {
        showShopToast(`🪙 +${pack.coins} PokéCoins added!`, 'success');
        updateCoinsDisplay();
        renderShopItems();
        renderPokemonPacks();
      }
    });
    container.appendChild(card);
  }
}

function renderShopItems() {
  const container = document.getElementById('shop-items');
  if (!container) return;
  container.innerHTML = '';

  for (const item of Object.values(SHOP_ITEMS)) {
    // Hide secret items until unlocked
    if (item.hidden && !_unlockedHiddenItems.includes(item.id)) continue;
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
function renderUpgrades() {
  const container = document.getElementById('shop-upgrades');
  if (!container) return;
  container.innerHTML = '';

  // Show ALL unlocked Pokémon for upgrade
  const upgradeList = [];
  for (const key of _unlockedPokemon) {
    const pkmn = POKEMON[key];
    if (pkmn && !upgradeList.find(k => k.key === key)) {
      upgradeList.push({ key, pkmn });
    }
  }
  // Also include any default team Pokémon (kings, etc.)
  for (const teamKey of ['scarlet', 'violet']) {
    const pool = KING_POOL[teamKey] || [];
    for (const entry of pool) {
      const pkmn = POKEMON[entry.key];
      if (pkmn && !upgradeList.find(k => k.key === entry.key)) {
        upgradeList.push({ key: entry.key, pkmn });
      }
    }
    const regularPool = POKEMON_POOL[teamKey] || [];
    for (const entry of regularPool) {
      const pkmn = POKEMON[entry.key];
      if (pkmn && !upgradeList.find(k => k.key === entry.key)) {
        upgradeList.push({ key: entry.key, pkmn });
      }
    }
  }

  if (upgradeList.length === 0) {
    container.innerHTML = '<div class="shop-inv-empty">No Pokémon available to upgrade!</div>';
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'shop-upgrade-grid';

  for (const { key, pkmn } of upgradeList) {
    const level = getPokemonLevel(key);
    const cost = getUpgradeCost(key);
    const isMaxed = cost === null;
    const bonus = getUpgradeBonus(level);
    const canAfford = !isMaxed && _coins >= cost;

    const card = document.createElement('div');
    card.className = `shop-upgrade-card ${isMaxed ? 'shop-upgrade-card--max' : ''}`;

    card.innerHTML = `
      <img class="shop-upgrade-img" src="${pkmn.img || ''}" alt="${pkmn.name}" />
      <div class="shop-upgrade-info">
        <div class="shop-upgrade-name">${pkmn.name}</div>
        <div class="shop-upgrade-level">${isMaxed ? '★ Upgraded' : 'Not Upgraded'}</div>
        <div class="shop-upgrade-stats">
          ❤️${pkmn.hp + bonus.hp} <span class="shop-upgrade-bonus">${bonus.hp > 0 ? `(+${bonus.hp})` : ''}</span>
          ⚔️${pkmn.damage + bonus.damage} <span class="shop-upgrade-bonus">${bonus.damage > 0 ? `(+${bonus.damage})` : ''}</span>
        </div>
      </div>
      <button class="shop-upgrade-btn ${isMaxed ? 'shop-upgrade-btn--max' : canAfford ? '' : 'shop-upgrade-btn--locked'}" ${isMaxed ? 'disabled' : ''}>
        ${isMaxed ? '★ MAX' : `⬆️ 🪙 ${cost}`}
      </button>
    `;

    if (!isMaxed) {
      card.querySelector('.shop-upgrade-btn').addEventListener('click', () => {
        if (_coins < cost) {
          showShopToast(`Need ${cost} coins for ${pkmn.name} upgrade (you have ${_coins})`, 'error');
          return;
        }
        const res = upgradePokemon(key);
        if (res.success) {
          showShopToast(`⬆️ ${pkmn.name} upgraded to Level ${res.newLevel}!`, 'success');
          updateCoinsDisplay();
          renderUpgrades();
        } else {
          showShopToast(res.error, 'error');
        }
      });
    }

    grid.appendChild(card);
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

  // Collect ELO-locked + pack-only Pokémon the player hasn't unlocked yet
  const allPokemon = [];
  for (const teamKey of ['scarlet', 'violet']) {
    const pool = POKEMON_POOL[teamKey] || [];
    for (const entry of pool) {
      // Pack-only: always show (no ELO gate). Regular: show if ELO-locked.
      const shouldShow = entry.packOnly
        ? !_unlockedPokemon.includes(entry.key)
        : (entry.requiredElo > 0 && playerElo < entry.requiredElo && !_unlockedPokemon.includes(entry.key));
      if (shouldShow) {
        allPokemon.push({ ...entry, team: teamKey });
      }
    }
    const kings = KING_POOL[teamKey] || [];
    for (const entry of kings) {
      const shouldShow = entry.packOnly
        ? !_unlockedPokemon.includes(entry.key)
        : (entry.requiredElo > 0 && playerElo < entry.requiredElo && !_unlockedPokemon.includes(entry.key));
      if (shouldShow) {
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

    const cost = getPokemonCoinCost(entry.requiredElo, !!entry.packOnly);
    const canAfford = _coins >= cost;

    const card = document.createElement('button');
    card.className = `shop-pkmn-card ${canAfford ? '' : 'shop-pkmn-card--locked'} ${entry.packOnly ? 'shop-pkmn-card--pack' : ''}`;
    card.title = `${pkmn.name} — \ud83e\ude99 ${cost} coins${entry.packOnly ? ' (Pack Exclusive — 2x price)' : ''}`;
    card.innerHTML = `
      ${entry.packOnly ? '<div class="shop-pkmn-badge">📦 Pack Exclusive</div>' : ''}
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
  if (!isDuplicate) {
    _unlockedPokemon.push(result.key);
  }
  // Dupes: no auto-refund — player chooses to keep or refund in UI
  saveState();
  syncToServer();
  return { success: true, result, isDuplicate, refundAmount: Math.floor(PACK_COST / 2) };
}

export function buyPokemonBox() {
  if (_coins < BOX_COST) return { error: `Need ${BOX_COST} coins (you have ${_coins})` };
  _coins -= BOX_COST;
  const results = [];
  for (let i = 0; i < 5; i++) {
    const result = rollPack();
    if (!result) continue;
    const isDuplicate = _unlockedPokemon.includes(result.key);
    if (!isDuplicate) {
      _unlockedPokemon.push(result.key);
    }
    const refundAmount = Math.floor(BOX_COST / 5);
    results.push({ result, isDuplicate, refundAmount });
  }
  saveState();
  syncToServer();
  return { success: true, results };
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
    updateCoinsDisplay();
    renderPokemonPacks();
    renderPokemonShop();
    showPackRipOpen(res.result, res.isDuplicate, null, res.refundAmount);
  });

  section.appendChild(packCard);

  // Box card (5 packs)
  const boxCard = document.createElement('button');
  const canAffordBox = _coins >= BOX_COST;
  boxCard.className = `shop-pack-buy shop-pack-buy--box ${canAffordBox ? '' : 'shop-pack-buy--disabled'}`;
  boxCard.innerHTML = `
    <div class="shop-pack-visual">
      <div class="shop-pack-ball">📦</div>
      <div class="shop-pack-glow shop-pack-glow--box"></div>
    </div>
    <div class="shop-pack-info">
      <div class="shop-pack-title">Pokémon Box</div>
      <div class="shop-pack-desc">Contains 5 Pokémon Packs</div>
      <div class="shop-pack-rates">
        <span style="color:${TIER_COLORS.common}">Common 54%</span>
        <span style="color:${TIER_COLORS.uncommon}">Uncommon 27%</span>
        <span style="color:${TIER_COLORS.rare}">Rare 11%</span>
        <span style="color:${TIER_COLORS.epic}">Epic 5%</span>
        <span style="color:${TIER_COLORS.legendary}">Legend 2%</span>
        <span style="color:${TIER_COLORS.mythic}">Mythic 1%</span>
        <span style="color:#86efac">💰 Save 50 coins vs singles!</span>
      </div>
    </div>
    <div class="shop-pack-price">
      <span>🪙 ${BOX_COST}</span>
    </div>
  `;

  boxCard.addEventListener('click', () => {
    if (_coins < BOX_COST) {
      showShopToast(`Need ${BOX_COST} coins (you have ${_coins})`, 'error');
      return;
    }
    const res = buyPokemonBox();
    if (res.error) {
      showShopToast(res.error, 'error');
      return;
    }
    updateCoinsDisplay();
    renderPokemonPacks();
    renderPokemonShop();
    showBoxRipOpen(res.results);
  });

  section.appendChild(boxCard);

  // Owned count
  const ownedCount = _unlockedPokemon.length;
  const pool = buildPackPool();
  const info = document.createElement('div');
  info.className = 'shop-pack-owned';
  info.textContent = `${ownedCount} Pokémon unlocked from packs • ${pool.length} available in pool`;
  section.appendChild(info);

  container.appendChild(section);
}

function showPackRipOpen(result, isDuplicate, options, refundAmount = 0) {
  const tierColor = TIER_COLORS[result.tier] || '#fff';
  const opts = options || {};
  const { packIndex, totalPacks, onComplete } = opts;
  const showCounter = typeof packIndex === 'number';

  const overlay = document.createElement('div');
  overlay.className = 'pack-rip-overlay';
  const pkmn = result.pkmn;
  overlay.innerHTML = `
    ${showCounter ? `<div class="pack-rip-counter">Pack ${packIndex + 1} / ${totalPacks}</div>` : ''}
    <div class="pack-rip-hint">✂️ Drag across the top to open!</div>
    <div class="pack-rip-container">
      <div class="pack-rip-card">
        <div class="pack-rip-top">
          <div class="pack-rip-tear-zone"></div>
          <div class="pack-rip-tear-line"></div>
          <div class="pack-rip-progress"></div>
          <div class="pack-rip-particles"></div>
        </div>
        <div class="pack-rip-body">
          <div class="pack-rip-ball">🔴</div>
          <div class="pack-rip-label">Pokémon Pack</div>
          <div class="pack-rip-glow" style="--tier-color: ${tierColor}"></div>
        </div>
        <img class="pack-rip-pokemon" src="${pkmn.img || ''}" alt="${pkmn.name}" style="--tier-color: ${tierColor}" />
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('pack-rip-overlay--show'));

  const tearZone = overlay.querySelector('.pack-rip-tear-zone');
  const tearLine = overlay.querySelector('.pack-rip-tear-line');
  const progressBar = overlay.querySelector('.pack-rip-progress');
  const particles = overlay.querySelector('.pack-rip-particles');
  const card = overlay.querySelector('.pack-rip-card');

  let progress = 0;
  let isDragging = false;
  let lastX = 0;
  let completed = false;

  function updateProgress(p) {
    progress = Math.min(1, Math.max(0, p));
    progressBar.style.width = `${progress * 100}%`;
    tearLine.style.setProperty('--rip-progress', progress);

    // Shake effect as progress increases
    const shake = progress * 3;
    card.style.transform = `translateY(${Math.sin(Date.now() / 50) * shake}px)`;

    // Add tear particles at the rip edge
    if (Math.random() < progress * 0.4) {
      const particle = document.createElement('div');
      particle.className = 'pack-rip-particle';
      particle.style.left = `${progress * 100}%`;
      particle.style.setProperty('--py', `${(Math.random() - 0.5) * 30}px`);
      particle.style.setProperty('--px', `${(Math.random() - 0.5) * 20}px`);
      particles.appendChild(particle);
      setTimeout(() => particle.remove(), 600);
    }

    if (progress >= 1 && !completed) {
      completed = true;
      finishRip();
    }
  }

  function finishRip() {
    card.classList.add('pack-rip-card--opened');
    // Burst of particles
    for (let i = 0; i < 30; i++) {
      const p = document.createElement('div');
      p.className = 'pack-rip-particle pack-rip-particle--burst';
      p.style.left = `${Math.random() * 100}%`;
      p.style.setProperty('--py', `${Math.random() * -80 - 20}px`);
      p.style.setProperty('--px', `${(Math.random() - 0.5) * 100}px`);
      p.style.setProperty('--color', tierColor);
      particles.appendChild(p);
    }
    // Pokémon pops out of the pack
    const pokemonEl = card.querySelector('.pack-rip-pokemon');
    if (pokemonEl) pokemonEl.classList.add('pack-rip-pokemon--pop');
    setTimeout(() => {
      overlay.classList.remove('pack-rip-overlay--show');
      setTimeout(() => {
        overlay.remove();
        if (onComplete) {
          onComplete();
        } else {
          showPackReveal(result, isDuplicate, refundAmount);
        }
      }, 300);
    }, 1400);
  }

  // Mouse events
  tearZone.addEventListener('mousedown', (e) => {
    isDragging = true;
    lastX = e.clientX;
    e.preventDefault();
  });

  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);

  // Touch events
  tearZone.addEventListener('touchstart', (e) => {
    isDragging = true;
    lastX = e.touches[0].clientX;
    e.preventDefault();
  }, { passive: false });

  window.addEventListener('touchmove', onTouchMove, { passive: false });
  window.addEventListener('touchend', onUp);

  function onMove(e) {
    if (!isDragging || completed) return;
    const dx = e.clientX - lastX;
    if (dx > 0) {
      const zoneWidth = tearZone.getBoundingClientRect().width;
      updateProgress(progress + dx / zoneWidth);
    }
    lastX = e.clientX;
  }

  function onTouchMove(e) {
    if (!isDragging || completed) return;
    const dx = e.touches[0].clientX - lastX;
    if (dx > 0) {
      const zoneWidth = tearZone.getBoundingClientRect().width;
      updateProgress(progress + dx / zoneWidth);
    }
    lastX = e.touches[0].clientX;
    e.preventDefault();
  }

  function onUp() {
    isDragging = false;
  }

  // Cleanup listeners when done
  const cleanup = () => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('touchend', onUp);
  };

  const origRemove = overlay.remove.bind(overlay);
  overlay.remove = () => { cleanup(); origRemove(); };
}

function showBoxRipOpen(results) {
  let currentIndex = 0;

  function openNext() {
    if (currentIndex >= results.length) {
      showBoxSummary(results);
      return;
    }
    const { result, isDuplicate } = results[currentIndex];
    const idx = currentIndex;
    currentIndex++;
    showPackRipOpen(result, isDuplicate, {
      packIndex: idx,
      totalPacks: results.length,
      onComplete: openNext,
    });
  }

  openNext();
}

function showBoxSummary(results) {
  const overlay = document.createElement('div');
  overlay.className = 'pack-reveal-overlay';

  const dupes = results.filter(r => r.isDuplicate);
  const refundPerDupe = Math.floor(BOX_COST / 5);

  let cardsHtml = '';
  for (let i = 0; i < results.length; i++) {
    const { result, isDuplicate } = results[i];
    const pkmn = result.pkmn;
    const tierColor = TIER_COLORS[result.tier] || '#fff';
    const tierLabel = TIER_LABELS[result.tier] || '';
    cardsHtml += `
      <div class="box-summary-card" style="--tier-color: ${tierColor}" data-idx="${i}">
        <div class="box-summary-glow"></div>
        <img class="box-summary-img" src="${pkmn.img || ''}" alt="${pkmn.name}" />
        <div class="box-summary-name">${pkmn.name}</div>
        <div class="box-summary-tier">${tierLabel} ${result.tier.toUpperCase()}</div>
        <div class="box-summary-stats">\u2764\ufe0f${pkmn.hp} \u2694\ufe0f${pkmn.damage}</div>
        ${isDuplicate
        ? `<div class="box-summary-dupe">DUPE</div>
           <div class="box-dupe-btns">
             <button class="box-dupe-btn box-dupe-btn--keep" data-idx="${i}">🔄 Keep</button>
             <button class="box-dupe-btn box-dupe-btn--refund" data-idx="${i}">🪙 Refund</button>
           </div>`
        : '<div class="box-summary-new">\u2728 NEW</div>'
      }
      </div>
    `;
  }

  const newCount = results.filter(r => !r.isDuplicate).length;
  const dupeCount = dupes.length;

  overlay.innerHTML = `
    <div class="box-summary-panel">
      <div class="box-summary-title">\ud83d\udce6 Box Results</div>
      <div class="box-summary-subtitle">${newCount} new \u2022 ${dupeCount} dupes</div>
      <div class="box-summary-grid">${cardsHtml}</div>
      ${dupeCount > 0 ? `
        <div class="box-bulk-actions">
          <button class="btn pack-dupe-btn pack-dupe-btn--keep" id="box-keep-all">🔄 Keep All Dupes</button>
          <button class="btn pack-dupe-btn pack-dupe-btn--refund" id="box-refund-all">🪙 Refund All (${refundPerDupe * dupeCount} coins)</button>
        </div>
      ` : ''}
      <button class="pack-reveal-close">Continue</button>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('pack-reveal-overlay--show'));

  // Track which dupes have been decided
  const decided = new Set();

  function updateCard(idx, action) {
    if (decided.has(idx)) return;
    decided.add(idx);
    const { result, isDuplicate } = results[idx];
    if (!isDuplicate) return;
    const card = overlay.querySelector(`.box-summary-card[data-idx="${idx}"]`);
    const btns = card?.querySelector('.box-dupe-btns');
    if (action === 'keep') {
      keepDupe(result.key);
      if (btns) btns.innerHTML = '<div class="box-dupe-decided">🔄 Kept</div>';
    } else {
      refundDupe(results[idx].refundAmount || refundPerDupe);
      if (btns) btns.innerHTML = '<div class="box-dupe-decided">🪙 Refunded</div>';
    }
  }

  // Per-card buttons
  overlay.querySelectorAll('.box-dupe-btn--keep').forEach(btn => {
    btn.addEventListener('click', () => updateCard(parseInt(btn.dataset.idx), 'keep'));
  });
  overlay.querySelectorAll('.box-dupe-btn--refund').forEach(btn => {
    btn.addEventListener('click', () => updateCard(parseInt(btn.dataset.idx), 'refund'));
  });

  // Bulk actions
  document.getElementById('box-keep-all')?.addEventListener('click', () => {
    results.forEach((r, i) => { if (r.isDuplicate) updateCard(i, 'keep'); });
  });
  document.getElementById('box-refund-all')?.addEventListener('click', () => {
    results.forEach((r, i) => { if (r.isDuplicate) updateCard(i, 'refund'); });
  });

  function closeBox() {
    // Auto-refund any undecided dupes
    results.forEach((r, i) => {
      if (r.isDuplicate && !decided.has(i)) {
        refundDupe(r.refundAmount || refundPerDupe);
      }
    });
    overlay.classList.remove('pack-reveal-overlay--show');
    setTimeout(() => overlay.remove(), 300);
    updateCoinsDisplay();
    renderPokemonPacks();
  }

  overlay.querySelector('.pack-reveal-close').addEventListener('click', closeBox);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeBox();
  });
}

function showPackReveal(result, isDuplicate, refundAmount = 0) {
  const pkmn = result.pkmn;
  const tierColor = TIER_COLORS[result.tier] || '#fff';
  const tierLabel = TIER_LABELS[result.tier] || '';

  const overlay = document.createElement('div');
  overlay.className = 'pack-reveal-overlay';

  const dupeHtml = isDuplicate
    ? `<div class="pack-reveal-dupe">Already owned!</div>
       <div class="pack-dupe-choice">
         <button class="btn pack-dupe-btn pack-dupe-btn--keep" data-action="keep">🔄 Keep for Trading</button>
         <button class="btn pack-dupe-btn pack-dupe-btn--refund" data-action="refund">🪙 Refund ${refundAmount} coins</button>
       </div>`
    : `<div class="pack-reveal-new">✨ NEW POKÉMON UNLOCKED! ✨</div>
       <button class="pack-reveal-close">Continue</button>`;

  overlay.innerHTML = `
    <div class="pack-reveal-card">
      <div class="pack-reveal-glow" style="--tier-color: ${tierColor}"></div>
      <div class="pack-reveal-sparkles"></div>
      <img class="pack-reveal-img" src="${pkmn.img || ''}" alt="${pkmn.name}" />
      <div class="pack-reveal-name">${pkmn.name}</div>
      <div class="pack-reveal-tier" style="color: ${tierColor}">${tierLabel} ${result.tier.toUpperCase()}</div>
      <div class="pack-reveal-types">${pkmn.types.join(' / ')}</div>
      <div class="pack-reveal-stats">❤️ ${pkmn.hp} HP  ⚔️ ${pkmn.damage} DMG</div>
      ${dupeHtml}
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

  function closeReveal() {
    overlay.classList.remove('pack-reveal-overlay--show');
    setTimeout(() => overlay.remove(), 300);
    updateCoinsDisplay();
    renderPokemonPacks();
  }

  // New Pokémon: simple continue
  overlay.querySelector('.pack-reveal-close')?.addEventListener('click', closeReveal);

  // Dupe choice: keep or refund
  if (isDuplicate) {
    overlay.querySelector('[data-action="keep"]')?.addEventListener('click', () => {
      keepDupe(result.key);
      showShopToast(`🔄 Kept duplicate ${pkmn.name} for trading!`, 'success');
      closeReveal();
    });
    overlay.querySelector('[data-action="refund"]')?.addEventListener('click', () => {
      refundDupe(refundAmount);
      showShopToast(`🪙 Refunded ${refundAmount} coins`, 'success');
      closeReveal();
    });
  } else {
    // Non-dupe: can also close by clicking overlay
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeReveal();
    });
  }
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
