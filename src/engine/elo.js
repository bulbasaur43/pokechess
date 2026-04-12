/**
 * ELO Rating System for PokéChess
 * Uses server profile when logged in, falls back to localStorage
 */

import { isLoggedIn, getProfile } from './auth.js';

const STORAGE_KEY = 'pokechess_elo';
const DEFAULT_RATING = 1000;
const K_FACTOR_BASE = 32;

// AI difficulty → approximate ELO rating
const AI_RATINGS = {
  easy:   600,
  medium: 1000,
  hard:   1400,
  expert: 1800,
};

/**
 * Load player stats — uses server profile if logged in, localStorage otherwise
 */
export function loadPlayerStats() {
  // If logged in, use server-synced profile
  if (isLoggedIn()) {
    const profile = getProfile();
    if (profile) {
      return {
        rating: profile.rating ?? DEFAULT_RATING,
        peak: profile.peak ?? DEFAULT_RATING,
        wins: profile.wins ?? 0,
        losses: profile.losses ?? 0,
        draws: profile.draws ?? 0,
        streak: profile.streak ?? 0,
        bestStreak: profile.bestStreak ?? 0,
        history: profile.history ?? [],
        gamesPlayed: profile.gamesPlayed ?? 0,
        username: profile.username,
      };
    }
  }

  // Fall back to localStorage for anonymous play
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return {
        rating: data.rating ?? DEFAULT_RATING,
        peak: data.peak ?? DEFAULT_RATING,
        wins: data.wins ?? 0,
        losses: data.losses ?? 0,
        draws: data.draws ?? 0,
        streak: data.streak ?? 0,
        bestStreak: data.bestStreak ?? 0,
        history: data.history ?? [],
        gamesPlayed: data.gamesPlayed ?? 0,
      };
    }
  } catch (e) {
    // Corrupted data — reset
  }
  return createDefaultStats();
}

function createDefaultStats() {
  return {
    rating: DEFAULT_RATING,
    peak: DEFAULT_RATING,
    wins: 0,
    losses: 0,
    draws: 0,
    streak: 0,
    bestStreak: 0,
    history: [],
    gamesPlayed: 0,
  };
}

/**
 * Save player stats to localStorage
 */
function savePlayerStats(stats) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch (e) {
    // Storage full or unavailable
  }
}

/**
 * Calculate expected score (probability of winning)
 */
function expectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Get K-factor based on games played (higher K for new players)
 */
function getKFactor(gamesPlayed) {
  if (gamesPlayed < 10) return 40;   // New player — volatile
  if (gamesPlayed < 30) return 32;   // Settling in
  return 24;                          // Established
}

/**
 * Calculate ELO change after a game result
 * @param {number} playerRating
 * @param {number} opponentRating
 * @param {'win'|'loss'|'draw'} result
 * @param {number} gamesPlayed
 * @returns {number} Rating change (can be negative)
 */
export function calculateEloChange(playerRating, opponentRating, result, gamesPlayed) {
  const expected = expectedScore(playerRating, opponentRating);
  const actual = result === 'win' ? 1 : result === 'draw' ? 0.5 : 0;
  const k = getKFactor(gamesPlayed);
  return Math.round(k * (actual - expected));
}

/**
 * Report a game result and update stored stats
 * @param {'win'|'loss'|'draw'} result
 * @param {string} gameMode - 'ai' | 'online' | 'local'
 * @param {object} options - { aiDifficulty?, opponentRating? }
 * @returns {{ stats, change, oldRating, newRating }}
 */
export function reportGameResult(result, gameMode, options = {}) {
  const stats = loadPlayerStats();
  const oldRating = stats.rating;

  // Determine opponent rating
  let opponentRating;
  if (gameMode === 'ai') {
    opponentRating = AI_RATINGS[options.aiDifficulty] ?? AI_RATINGS.medium;
  } else if (gameMode === 'online') {
    opponentRating = options.opponentRating ?? DEFAULT_RATING;
  } else {
    // Local games don't affect rating
    return { stats, change: 0, oldRating, newRating: oldRating };
  }

  const change = calculateEloChange(oldRating, opponentRating, result, stats.gamesPlayed);
  const newRating = Math.max(100, oldRating + change); // Floor at 100

  // Update stats
  stats.rating = newRating;
  stats.gamesPlayed++;

  if (newRating > stats.peak) stats.peak = newRating;

  if (result === 'win') {
    stats.wins++;
    stats.streak = stats.streak > 0 ? stats.streak + 1 : 1;
  } else if (result === 'loss') {
    stats.losses++;
    stats.streak = stats.streak < 0 ? stats.streak - 1 : -1;
  } else {
    stats.draws++;
    stats.streak = 0;
  }

  if (stats.streak > stats.bestStreak) stats.bestStreak = stats.streak;

  // Track history (last 20)
  stats.history.push({
    rating: newRating,
    change,
    result,
    opponent: gameMode === 'ai' ? `AI (${options.aiDifficulty})` : 'Player',
    timestamp: Date.now(),
  });
  if (stats.history.length > 20) stats.history = stats.history.slice(-20);

  savePlayerStats(stats);
  return { stats, change, oldRating, newRating };
}

/**
 * Get the rank title based on ELO rating
 */
export function getRankTitle(rating) {
  if (rating >= 2000) return { title: 'Champion',   emoji: '👑', color: '#FFD700' };
  if (rating >= 1700) return { title: 'Master',     emoji: '⭐', color: '#FF6B4A' };
  if (rating >= 1400) return { title: 'Expert',     emoji: '🔥', color: '#A78BFA' };
  if (rating >= 1100) return { title: 'Skilled',    emoji: '⚔️',  color: '#60A5FA' };
  if (rating >= 800)  return { title: 'Trainer',    emoji: '🎮', color: '#4ADE80' };
  if (rating >= 500)  return { title: 'Rookie',     emoji: '🌱', color: '#FACC15' };
  return                      { title: 'Beginner',   emoji: '🥚', color: '#9CA3AF' };
}

/**
 * Get win rate as a percentage
 */
export function getWinRate(stats) {
  const total = stats.wins + stats.losses + stats.draws;
  if (total === 0) return 0;
  return Math.round((stats.wins / total) * 100);
}

/**
 * Reset all stats
 */
export function resetStats() {
  const stats = createDefaultStats();
  savePlayerStats(stats);
  return stats;
}
