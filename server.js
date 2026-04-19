/**
 * PokéChess — Game Server
 * Combines: HTTP API (auth + ELO) + WebSocket (matchmaking)
 *
 * Run: node server.js
 */

import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { randomBytes, createHash } from 'crypto';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

const PORT = process.env.PORT || 3001;
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIST_DIR = join(__dirname, 'dist');
const DB_FILE = './data/users.json';

// ─── Upstash Redis (persistent storage across deploys) ──────────────

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const DB_KEY = 'pokechess_db';

async function redisGet(key) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return null;
  try {
    const res = await fetch(`${UPSTASH_URL}/get/${key}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    });
    const data = await res.json();
    return data.result ? JSON.parse(data.result) : null;
  } catch (e) {
    console.error('Redis GET error:', e.message);
    return null;
  }
}

async function redisSet(key, value) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return;
  try {
    await fetch(`${UPSTASH_URL}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(['SET', key, JSON.stringify(value)]),
    });
  } catch (e) {
    console.error('Redis SET error:', e.message);
  }
}

// ─── Database ───────────────────────────────────────────────────────

// Local file load (fallback for dev / initial migration)
function loadDBLocal() {
  try {
    if (existsSync(DB_FILE)) {
      return JSON.parse(readFileSync(DB_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Local DB load error:', e.message);
  }
  return { users: {}, sessions: {} };
}

// Debounced Redis save to batch rapid writes
let redisSaveTimeout = null;

function saveDB(data) {
  // Always save locally (fast, sync)
  try {
    const dir = DB_FILE.substring(0, DB_FILE.lastIndexOf('/'));
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Local DB save error:', e.message);
  }

  // Debounce Redis save (1s) to avoid hammering the API
  if (redisSaveTimeout) clearTimeout(redisSaveTimeout);
  redisSaveTimeout = setTimeout(() => {
    redisSet(DB_KEY, data).then(() => {
      console.log('📦 Saved to Redis');
    });
  }, 1000);
}

// Load from Redis on startup, migrate local data if needed
async function initDB() {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    console.log(`📦 Redis not configured — using local file (${Object.keys(db.users).length} users)`);
    return;
  }

  const redisData = await redisGet(DB_KEY);
  if (redisData && redisData.users && Object.keys(redisData.users).length > 0) {
    db = redisData;
    console.log(`📦 Loaded ${Object.keys(db.users).length} users from Redis`);
  } else if (Object.keys(db.users).length > 0) {
    // Migrate existing local data to Redis
    await redisSet(DB_KEY, db);
    console.log(`📦 Migrated ${Object.keys(db.users).length} local users to Redis`);
  } else {
    console.log('📦 Starting with empty database');
  }
}

// Ensure data directory exists
try { mkdirSync('./data', { recursive: true }); } catch { }

let db = loadDBLocal();

function hashPassword(password, salt) {
  return createHash('sha256').update(password + salt).digest('hex');
}

function generateToken() {
  return randomBytes(32).toString('hex');
}

// ─── HTTP API ───────────────────────────────────────────────────────

const httpServer = createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Serve static files from dist/ (production build) for non-API routes
  if (!req.url.startsWith('/api/')) {
    const MIME_TYPES = {
      '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
      '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
      '.webp': 'image/webp',
    };

    let filePath = join(DIST_DIR, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
    if (!existsSync(filePath) || !filePath.startsWith(DIST_DIR)) {
      filePath = join(DIST_DIR, 'index.html'); // SPA fallback
    }
    if (existsSync(filePath)) {
      try {
        const data = readFileSync(filePath);
        const ext = extname(filePath);
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        res.end(data);
        return;
      } catch {
        // fall through to API
      }
    }
  }

  // Parse body for POST requests
  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        routeRequest(req, res, data);
      } catch {
        sendJSON(res, 400, { error: 'Invalid JSON' });
      }
    });
  } else {
    routeRequest(req, res, null);
  }
});

function routeRequest(req, res, body) {
  const url = req.url;

  if (req.method === 'POST' && url === '/api/signup') {
    handleSignup(req, res, body);
  } else if (req.method === 'POST' && url === '/api/login') {
    handleLogin(req, res, body);
  } else if (req.method === 'GET' && url === '/api/profile') {
    handleGetProfile(req, res);
  } else if (req.method === 'POST' && url === '/api/elo/report') {
    handleEloReport(req, res, body);
  } else if (req.method === 'GET' && url === '/api/leaderboard') {
    handleLeaderboard(req, res);
  } else if (req.method === 'POST' && url === '/api/logout') {
    handleLogout(req, res);
  } else if (req.method === 'GET' && url === '/api/team') {
    handleGetTeam(req, res);
  } else if (req.method === 'POST' && url === '/api/team') {
    handleSaveTeam(req, res, body);
  } else if (req.method === 'POST' && url === '/api/admin/users') {
    handleAdminListUsers(req, res, body);
  } else if (req.method === 'POST' && url === '/api/admin/delete') {
    handleAdminDeleteUser(req, res, body);
  } else if (req.method === 'POST' && url === '/api/admin/elo') {
    handleAdminModifyElo(req, res, body);
  } else if (req.method === 'POST' && url === '/api/admin/reset-elo') {
    handleAdminResetElo(req, res, body);
  } else if (req.method === 'POST' && url === '/api/admin/ban') {
    handleAdminBan(req, res, body);
  } else if (req.method === 'POST' && url === '/api/admin/unban') {
    handleAdminUnban(req, res, body);
  } else if (req.method === 'GET' && url === '/api/online') {
    handleOnlineCount(req, res);
  } else {
    sendJSON(res, 404, { error: 'Not found' });
  }
}

function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function getAuthUser(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const username = db.sessions[token];
  if (!username || !db.users[username]) return null;
  return { username, user: db.users[username] };
}

// ── Signup ──


function handleSignup(req, res, body) {
  const { username, password } = body || {};

  if (!username || !password) {
    return sendJSON(res, 400, { error: 'Username and password required' });
  }

  if (username.length < 3 || username.length > 20) {
    return sendJSON(res, 400, { error: 'Username must be 3-20 characters' });
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return sendJSON(res, 400, { error: 'Username: letters, numbers, underscores only' });
  }

  if (password.length < 4) {
    return sendJSON(res, 400, { error: 'Password must be at least 4 characters' });
  }

  if (db.users[username.toLowerCase()]) {
    return sendJSON(res, 409, { error: 'Username already taken' });
  }

  const salt = randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);
  const token = generateToken();

  db.users[username.toLowerCase()] = {
    username: username,
    displayName: username,
    passwordHash: hash,
    salt,
    createdAt: Date.now(),
    rating: 1000,
    peak: 1000,
    wins: 0,
    losses: 0,
    draws: 0,
    streak: 0,
    bestStreak: 0,
    gamesPlayed: 0,
    history: [],
  };

  db.sessions[token] = username.toLowerCase();
  saveDB(db);

  console.log(`👤 New user: ${username}`);

  sendJSON(res, 201, {
    token,
    profile: getPublicProfile(db.users[username.toLowerCase()]),
  });
}

// ── Login ──

function handleLogin(req, res, body) {
  const { username, password } = body || {};

  if (!username || !password) {
    return sendJSON(res, 400, { error: 'Username and password required' });
  }

  const user = db.users[username.toLowerCase()];
  if (!user) {
    return sendJSON(res, 401, { error: 'Invalid username or password' });
  }

  const hash = hashPassword(password, user.salt);
  if (hash !== user.passwordHash) {
    return sendJSON(res, 401, { error: 'Invalid username or password' });
  }

  // Ban check
  if (user.bannedUntil) {
    const banEnd = new Date(user.bannedUntil);
    if (banEnd > new Date()) {
      const remaining = Math.ceil((banEnd - new Date()) / (1000 * 60 * 60));
      return sendJSON(res, 403, { error: `Account banned. ${remaining}h remaining. Expires: ${banEnd.toLocaleString()}` });
    } else {
      // Ban expired — clear it
      delete user.bannedUntil;
      saveDB(db);
    }
  }

  const token = generateToken();
  db.sessions[token] = username.toLowerCase();
  saveDB(db);

  console.log(`🔑 Login: ${username}`);

  sendJSON(res, 200, {
    token,
    profile: getPublicProfile(user),
  });
}

// ── Profile ──

function handleGetProfile(req, res) {
  const auth = getAuthUser(req);
  if (!auth) return sendJSON(res, 401, { error: 'Not logged in' });

  sendJSON(res, 200, { profile: getPublicProfile(auth.user) });
}

// ── ELO Report ──

function handleEloReport(req, res, body) {
  const auth = getAuthUser(req);
  if (!auth) return sendJSON(res, 401, { error: 'Not logged in' });

  const { result, gameMode, aiDifficulty, opponentRating } = body || {};
  if (!result || !['win', 'loss', 'draw'].includes(result)) {
    return sendJSON(res, 400, { error: 'Invalid result' });
  }

  const user = auth.user;
  const oldRating = user.rating;

  // AI ratings
  const AI_RATINGS = { 1: 400, 2: 550, 3: 700, 4: 850, 5: 1000, 6: 1150, 7: 1300, 8: 1500, 9: 1700, 10: 2000 };
  let oppRating;
  if (gameMode === 'ai') {
    oppRating = AI_RATINGS[aiDifficulty] ?? 1000;
  } else if (gameMode === 'online') {
    oppRating = opponentRating ?? 1000;
  } else {
    return sendJSON(res, 200, { change: 0, oldRating, newRating: oldRating, profile: getPublicProfile(user) });
  }

  // ELO calculation
  const expected = 1 / (1 + Math.pow(10, (oppRating - oldRating) / 400));
  const actual = result === 'win' ? 1 : result === 'draw' ? 0.5 : 0;
  const k = user.gamesPlayed < 10 ? 40 : user.gamesPlayed < 30 ? 32 : 24;
  const change = Math.round(k * (actual - expected));
  const newRating = Math.max(100, oldRating + change);

  user.rating = newRating;
  user.gamesPlayed++;
  if (newRating > user.peak) user.peak = newRating;

  if (result === 'win') {
    user.wins++;
    user.streak = user.streak > 0 ? user.streak + 1 : 1;
  } else if (result === 'loss') {
    user.losses++;
    user.streak = user.streak < 0 ? user.streak - 1 : -1;
  } else {
    user.draws++;
    user.streak = 0;
  }

  if (user.streak > user.bestStreak) user.bestStreak = user.streak;

  user.history.push({ rating: newRating, change, result, timestamp: Date.now() });
  if (user.history.length > 20) user.history = user.history.slice(-20);

  saveDB(db);

  sendJSON(res, 200, {
    change,
    oldRating,
    newRating,
    profile: getPublicProfile(user),
  });
}

// ── Leaderboard ──

function handleLeaderboard(req, res) {
  const leaders = Object.values(db.users)
    .map(u => ({
      username: u.displayName,
      rating: u.rating,
      wins: u.wins,
      losses: u.losses,
      gamesPlayed: u.gamesPlayed,
    }))
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 20);

  sendJSON(res, 200, { leaderboard: leaders });
}

// ── Logout ──

function handleLogout(req, res) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    const token = auth.slice(7);
    delete db.sessions[token];
    saveDB(db);
  }
  sendJSON(res, 200, { ok: true });
}

// ── Save/Load Team ──

function handleGetTeam(req, res) {
  const auth = getAuthUser(req);
  if (!auth) return sendJSON(res, 401, { error: 'Not logged in' });

  sendJSON(res, 200, { team: auth.user.savedTeam || null });
}

function handleSaveTeam(req, res, body) {
  const auth = getAuthUser(req);
  if (!auth) return sendJSON(res, 401, { error: 'Not logged in' });

  const { team } = body || {};
  if (!team || typeof team !== 'object') {
    return sendJSON(res, 400, { error: 'Invalid team data' });
  }

  auth.user.savedTeam = team;
  saveDB(db);

  console.log(`💾 Team saved for ${auth.username}`);
  sendJSON(res, 200, { ok: true });
}

function getPublicProfile(user) {
  return {
    username: user.displayName,
    rating: user.rating,
    peak: user.peak,
    wins: user.wins,
    losses: user.losses,
    draws: user.draws,
    streak: user.streak,
    bestStreak: user.bestStreak,
    gamesPlayed: user.gamesPlayed,
    history: user.history,
  };
}

// ─── Admin API ──────────────────────────────────────────────────────

const ADMIN_PASSWORD = 'megabulbasaur';

function getServerRank(rating) {
  if (rating >= 2000) return { title: 'Champion',  emoji: '👑' };
  if (rating >= 1700) return { title: 'Master',    emoji: '⭐' };
  if (rating >= 1400) return { title: 'Expert',    emoji: '🔥' };
  if (rating >= 1100) return { title: 'Skilled',   emoji: '⚔️' };
  if (rating >= 800)  return { title: 'Trainer',   emoji: '🎮' };
  if (rating >= 500)  return { title: 'Rookie',    emoji: '🌱' };
  return                     { title: 'Beginner',  emoji: '🥚' };
}

function verifyAdmin(body) {
  return body?.adminPassword === ADMIN_PASSWORD;
}

function handleAdminListUsers(req, res, body) {
  if (!verifyAdmin(body)) return sendJSON(res, 403, { error: 'Invalid admin password' });

  const users = Object.entries(db.users).map(([key, u]) => {
    const rank = getServerRank(u.rating);
    return {
      username: u.displayName,
      key,
      rating: u.rating,
      peak: u.peak,
      gamesPlayed: u.gamesPlayed,
      wins: u.wins,
      losses: u.losses,
      bannedUntil: u.bannedUntil || null,
      rank: rank.title,
      rankEmoji: rank.emoji,
      savedTeam: u.savedTeam || null,
    };
  });

  sendJSON(res, 200, { users });
}

function handleAdminDeleteUser(req, res, body) {
  if (!verifyAdmin(body)) return sendJSON(res, 403, { error: 'Invalid admin password' });
  const target = body.username?.toLowerCase();
  if (!target || !db.users[target]) return sendJSON(res, 404, { error: 'User not found' });

  // Remove all sessions for this user
  for (const [token, user] of Object.entries(db.sessions)) {
    if (user === target) delete db.sessions[token];
  }
  delete db.users[target];
  saveDB(db);

  console.log(`🗑️ Admin deleted user: ${target}`);
  sendJSON(res, 200, { success: true, message: `User '${target}' deleted` });
}

function handleAdminModifyElo(req, res, body) {
  if (!verifyAdmin(body)) return sendJSON(res, 403, { error: 'Invalid admin password' });
  const target = body.username?.toLowerCase();
  const amount = parseInt(body.amount, 10);
  if (!target || !db.users[target]) return sendJSON(res, 404, { error: 'User not found' });
  if (isNaN(amount)) return sendJSON(res, 400, { error: 'Invalid amount' });

  const user = db.users[target];
  const oldRating = user.rating;
  user.rating = Math.max(0, user.rating + amount);
  if (user.rating > user.peak) user.peak = user.rating;
  saveDB(db);

  const rank = getServerRank(user.rating);
  console.log(`📊 Admin modified ELO: ${user.displayName} ${oldRating} → ${user.rating} (${amount > 0 ? '+' : ''}${amount}) — ${rank.emoji} ${rank.title}`);
  sendJSON(res, 200, { success: true, oldRating, newRating: user.rating, rank: rank.title, rankEmoji: rank.emoji });
}

function handleAdminResetElo(req, res, body) {
  if (!verifyAdmin(body)) return sendJSON(res, 403, { error: 'Invalid admin password' });
  const target = body.username?.toLowerCase();
  if (!target || !db.users[target]) return sendJSON(res, 404, { error: 'User not found' });

  const user = db.users[target];
  user.rating = 1000;
  user.peak = 1000;
  user.wins = 0;
  user.losses = 0;
  user.draws = 0;
  user.streak = 0;
  user.bestStreak = 0;
  user.gamesPlayed = 0;
  user.history = [];
  saveDB(db);

  console.log(`🔄 Admin reset ELO: ${user.displayName}`);
  sendJSON(res, 200, { success: true, message: `${user.displayName} reset to 1000 ELO` });
}

function handleAdminBan(req, res, body) {
  if (!verifyAdmin(body)) return sendJSON(res, 403, { error: 'Invalid admin password' });
  const target = body.username?.toLowerCase();
  const hours = parseInt(body.hours, 10);
  if (!target || !db.users[target]) return sendJSON(res, 404, { error: 'User not found' });
  if (isNaN(hours) || hours <= 0) return sendJSON(res, 400, { error: 'Invalid ban duration' });

  const user = db.users[target];
  const banEnd = new Date(Date.now() + hours * 60 * 60 * 1000);
  user.bannedUntil = banEnd.toISOString();

  // Invalidate their sessions
  for (const [token, uname] of Object.entries(db.sessions)) {
    if (uname === target) delete db.sessions[token];
  }
  saveDB(db);

  console.log(`🔨 Admin banned ${user.displayName} for ${hours}h until ${banEnd.toLocaleString()}`);
  sendJSON(res, 200, { success: true, message: `${user.displayName} banned for ${hours} hours`, bannedUntil: banEnd.toISOString() });
}

function handleAdminUnban(req, res, body) {
  if (!verifyAdmin(body)) return sendJSON(res, 403, { error: 'Invalid admin password' });
  const target = body.username?.toLowerCase();
  if (!target || !db.users[target]) return sendJSON(res, 404, { error: 'User not found' });

  delete db.users[target].bannedUntil;
  saveDB(db);

  console.log(`✅ Admin unbanned ${db.users[target].displayName}`);
  sendJSON(res, 200, { success: true, message: `${db.users[target].displayName} unbanned` });
}

// ─── Online Count ───────────────────────────────────────────────────

function handleOnlineCount(req, res) {
  const online = wss.clients ? wss.clients.size : 0;
  const inGame = rooms.size * 2;
  const waiting = waitingPlayer ? 1 : 0;
  sendJSON(res, 200, { online, inGame, waiting, totalUsers: Object.keys(db.users).length });
}

// ─── WebSocket (Matchmaking) ────────────────────────────────────────

const wss = new WebSocketServer({ server: httpServer });

let waitingPlayer = null;
const rooms = new Map();
let roomCounter = 0;

wss.on('connection', (ws) => {
  ws.id = `player_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  ws.isAlive = true;
  ws.roomId = null;

  console.log(`🔌 ${ws.id} connected`);

  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }

    switch (msg.type) {
      case 'find_match':
        handleFindMatch(ws, msg);
        break;
      case 'move':
        handleMove(ws, msg);
        break;
      case 'cancel_search':
        handleCancelSearch(ws);
        break;
      case 'resign':
        handleResign(ws);
        break;
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        break;
    }
  });

  ws.on('close', () => {
    console.log(`🔌 ${ws.id} disconnected`);
    handleDisconnect(ws);
  });

  ws.on('error', () => {
    handleDisconnect(ws);
  });
});

function handleFindMatch(ws, msg) {
  const preferredTeam = msg.team || 'scarlet';
  const timePreset = msg.timePreset || 'medium';

  if (waitingPlayer && waitingPlayer.readyState === 1) {
    const roomId = `room_${++roomCounter}`;

    let whiteWs, blackWs;
    if (waitingPlayer.preferredTeam === 'violet') {
      blackWs = waitingPlayer;
      whiteWs = ws;
    } else {
      whiteWs = waitingPlayer;
      blackWs = ws;
    }

    whiteWs.roomId = roomId;
    blackWs.roomId = roomId;

    rooms.set(roomId, {
      white: whiteWs,
      black: blackWs,
      timePreset,
      moves: [],
    });

    console.log(`🎮 Match: ${whiteWs.id} vs ${blackWs.id} in ${roomId}`);

    whiteWs.send(JSON.stringify({ type: 'match_found', roomId, yourColor: 'white', timePreset }));
    blackWs.send(JSON.stringify({ type: 'match_found', roomId, yourColor: 'black', timePreset }));

    waitingPlayer = null;
  } else {
    ws.preferredTeam = preferredTeam;
    ws.timePreset = timePreset;
    waitingPlayer = ws;
    ws.send(JSON.stringify({ type: 'searching' }));
    console.log(`🔍 ${ws.id} searching...`);
  }
}

function handleMove(ws, msg) {
  const room = rooms.get(ws.roomId);
  if (!room) return;
  const opponent = room.white === ws ? room.black : room.white;
  if (opponent && opponent.readyState === 1) {
    opponent.send(JSON.stringify({
      type: 'opponent_move',
      fromRow: msg.fromRow, fromCol: msg.fromCol,
      toRow: msg.toRow, toCol: msg.toCol,
    }));
  }
  room.moves.push(msg);
}

function handleCancelSearch(ws) {
  if (waitingPlayer === ws) waitingPlayer = null;
  ws.send(JSON.stringify({ type: 'search_cancelled' }));
}

function handleResign(ws) {
  const room = rooms.get(ws.roomId);
  if (!room) return;
  const opponent = room.white === ws ? room.black : room.white;
  if (opponent && opponent.readyState === 1) {
    opponent.send(JSON.stringify({ type: 'opponent_resigned' }));
  }
  cleanupRoom(ws.roomId);
}

function handleDisconnect(ws) {
  if (waitingPlayer === ws) waitingPlayer = null;
  const room = rooms.get(ws.roomId);
  if (room) {
    const opponent = room.white === ws ? room.black : room.white;
    if (opponent && opponent.readyState === 1) {
      opponent.send(JSON.stringify({ type: 'opponent_disconnected' }));
    }
    cleanupRoom(ws.roomId);
  }
}

function cleanupRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  if (room.white) room.white.roomId = null;
  if (room.black) room.black.roomId = null;
  rooms.delete(roomId);
}

// Heartbeat
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) { handleDisconnect(ws); return ws.terminate(); }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

// Start — load from Redis first, then listen
initDB().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`⚔️ PokéChess server on http://localhost:${PORT}`);
    console.log(`   API: http://localhost:${PORT}/api/...`);
    console.log(`   WS:  ws://localhost:${PORT}`);
    if (UPSTASH_URL && UPSTASH_TOKEN) console.log('   📦 Redis: connected');
    else console.log('   📦 Redis: not configured (using local file only)');
  });
});
