/**
 * Sprite Cache — Preloads and caches all Pokémon sprite images
 * 
 * Eliminates slow image loading by:
 * 1. Preloading all sprites as Image objects at startup
 * 2. Providing instant cloneNode() for rendering (no network fetch)
 * 3. Tracking load progress for optional loading screen
 */

import { POKEMON } from '../engine/types.js';
import { COSMETICS } from './shop.js';

// Cache: url → fully-loaded HTMLImageElement
const _cache = new Map();

// Track loading state
let _totalSprites = 0;
let _loadedSprites = 0;
let _preloadPromise = null;

/**
 * Preload all Pokémon sprite images and cosmetic assets.
 * Call once at app startup. Returns a promise that resolves when all are loaded.
 * Subsequent calls return the same promise (idempotent).
 */
export function preloadAllSprites() {
  if (_preloadPromise) return _preloadPromise;

  // Collect all unique sprite URLs from POKEMON data and cosmetics
  const urls = new Set();
  for (const pkmn of Object.values(POKEMON)) {
    if (pkmn.img) urls.add(pkmn.img);
  }
  for (const cosmetic of Object.values(COSMETICS)) {
    if (cosmetic.img) urls.add(cosmetic.img);
  }

  _totalSprites = urls.size;
  _loadedSprites = 0;

  const promises = [];
  for (const url of urls) {
    promises.push(
      new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = url;
        img.onload = () => {
          _cache.set(url, img);
          _loadedSprites++;
          resolve();
        };
        img.onerror = () => {
          // Still resolve — we'll fall back to creating a new img on cache miss
          console.warn(`[SpriteCache] Failed to preload: ${url}`);
          _loadedSprites++;
          resolve();
        };
      })
    );
  }

  _preloadPromise = Promise.all(promises);
  return _preloadPromise;
}

/**
 * Get a cached sprite image element ready for DOM insertion.
 * Returns a cloned <img> node if cached, or creates a new one if not yet loaded.
 * The clone ensures each board cell gets its own DOM element.
 *
 * @param {string} url - The sprite URL
 * @returns {HTMLImageElement}
 */
export function getCachedSprite(url) {
  const cached = _cache.get(url);
  if (cached) {
    // Clone the cached Image so each cell gets its own DOM node
    return cached.cloneNode();
  }
  // Fallback: create a new image (will load from browser HTTP cache if available)
  const img = new Image();
  img.src = url;
  return img;
}

/**
 * Get loading progress as a fraction (0..1).
 */
export function getSpriteLoadProgress() {
  if (_totalSprites === 0) return 1;
  return _loadedSprites / _totalSprites;
}

/**
 * Check if all sprites are loaded.
 */
export function areSpritesLoaded() {
  return _totalSprites > 0 && _loadedSprites >= _totalSprites;
}
