/**
 * Auth Client for PokéChess
 * Handles login, signup, session persistence, and server-side ELO sync
 */

const isDev = window.location.port === '5173' || window.location.port === '5174';
const API_BASE = isDev
  ? `http://${window.location.hostname}:3001/api`
  : `${window.location.origin}/api`;
const TOKEN_KEY = 'pokechess_token';
const PROFILE_KEY = 'pokechess_profile';

let currentToken = localStorage.getItem(TOKEN_KEY) || null;
let currentProfile = null;

// Load cached profile
try {
  const cached = localStorage.getItem(PROFILE_KEY);
  if (cached) currentProfile = JSON.parse(cached);
} catch {}

// ─── API Helpers ────────────────────────────────────────────────────

async function apiCall(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (currentToken) {
    headers['Authorization'] = `Bearer ${currentToken}`;
  }
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) {
      return { error: data.error || 'Request failed', status: res.status };
    }
    return data;
  } catch (e) {
    return { error: 'Could not connect to server', status: 0 };
  }
}

// ─── Auth Functions ─────────────────────────────────────────────────

export async function signup(username, password) {
  const result = await apiCall('POST', '/signup', { username, password });
  if (result.error) return { error: result.error };

  currentToken = result.token;
  currentProfile = result.profile;
  localStorage.setItem(TOKEN_KEY, currentToken);
  localStorage.setItem(PROFILE_KEY, JSON.stringify(currentProfile));
  return { profile: currentProfile };
}

export async function login(username, password) {
  const result = await apiCall('POST', '/login', { username, password });
  if (result.error) return { error: result.error };

  currentToken = result.token;
  currentProfile = result.profile;
  localStorage.setItem(TOKEN_KEY, currentToken);
  localStorage.setItem(PROFILE_KEY, JSON.stringify(currentProfile));
  return { profile: currentProfile };
}

export function logout() {
  apiCall('POST', '/logout').catch(() => {});
  currentToken = null;
  currentProfile = null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(PROFILE_KEY);
}

export function isLoggedIn() {
  return !!currentToken && !!currentProfile;
}

export function getProfile() {
  return currentProfile;
}

export function getUsername() {
  return currentProfile?.username ?? null;
}

/**
 * Refresh profile from server (validates token too)
 */
export async function refreshProfile() {
  if (!currentToken) return null;

  const result = await apiCall('GET', '/profile');
  if (result.error) {
    // Token expired or invalid
    if (result.status === 401) {
      currentToken = null;
      currentProfile = null;
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(PROFILE_KEY);
    }
    return null;
  }

  currentProfile = result.profile;
  localStorage.setItem(PROFILE_KEY, JSON.stringify(currentProfile));
  return currentProfile;
}

/**
 * Report game result to server (syncs ELO)
 * Falls back to local ELO if not logged in
 */
export async function reportGameResultToServer(result, gameMode, options = {}) {
  if (!currentToken) return null;

  const body = {
    result,
    gameMode,
    aiDifficulty: options.aiDifficulty,
    opponentRating: options.opponentRating,
  };

  const response = await apiCall('POST', '/elo/report', body);
  if (response.error) return null;

  // Update cached profile
  if (response.profile) {
    currentProfile = response.profile;
    localStorage.setItem(PROFILE_KEY, JSON.stringify(currentProfile));
  }

  return {
    change: response.change,
    oldRating: response.oldRating,
    newRating: response.newRating,
    stats: response.profile,
  };
}

/**
 * Get leaderboard from server
 */
export async function getLeaderboard() {
  const result = await apiCall('GET', '/leaderboard');
  if (result.error) return [];
  return result.leaderboard || [];
}

/**
 * Save team roster to server
 */
export async function saveTeam(team) {
  if (!currentToken) return false;
  const result = await apiCall('POST', '/team', { team });
  return !result.error;
}

/**
 * Load saved team roster from server
 */
export async function loadTeam() {
  if (!currentToken) return null;
  const result = await apiCall('GET', '/team');
  if (result.error) return null;
  return result.team || null;
}
