/**
 * Online Matchmaking Client for PokéChess
 * Connects to the WebSocket server to find opponents and sync moves
 */

const isDev = window.location.port === '5173' || window.location.port === '5174';
const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = isDev
  ? `ws://${window.location.hostname}:3001`
  : `${wsProtocol}//${window.location.host}`;

let ws = null;
let callbacks = {};

export function connectToServer(cbs) {
  callbacks = cbs;

  return new Promise((resolve, reject) => {
    try {
      ws = new WebSocket(WS_URL);
    } catch (e) {
      reject(e);
      return;
    }

    ws.onopen = () => {
      console.log('🔌 Connected to PokéChess server');
      resolve();
    };

    ws.onmessage = (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }

      switch (msg.type) {
        case 'searching':
          callbacks.onSearching?.();
          break;
        case 'match_found':
          callbacks.onMatchFound?.(msg);
          break;
        case 'opponent_move':
          callbacks.onOpponentMove?.(msg);
          break;
        case 'opponent_resigned':
          callbacks.onOpponentResigned?.();
          break;
        case 'opponent_disconnected':
          callbacks.onOpponentDisconnected?.();
          break;
        case 'search_cancelled':
          callbacks.onSearchCancelled?.();
          break;
        case 'trade_searching':
          callbacks.onTradeSearching?.();
          break;
        case 'trade_matched':
          callbacks.onTradeMatched?.(msg);
          break;
        case 'trade_offer_received':
          callbacks.onTradeOfferReceived?.(msg);
          break;
        case 'trade_confirmed':
          callbacks.onTradeConfirmed?.(msg);
          break;
        case 'trade_partner_confirmed':
          callbacks.onTradePartnerConfirmed?.();
          break;
        case 'trade_cancelled':
          callbacks.onTradeCancelled?.();
          break;
        case 'trade_partner_disconnected':
          callbacks.onTradePartnerDisconnected?.();
          break;
        case 'lobby_chat':
          callbacks.onLobbyChat?.(msg);
          break;
        case 'game_chat':
          callbacks.onGameChat?.(msg);
          break;
        case 'chat_history':
          callbacks.onChatHistory?.(msg);
          break;
      }
    };

    ws.onclose = () => {
      console.log('🔌 Disconnected from server');
      callbacks.onDisconnected?.();
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
      reject(err);
    };
  });
}

export function findMatch(team, timePreset, teamPresets, username) {
  if (!ws || ws.readyState !== 1) return;
  ws.send(JSON.stringify({
    type: 'find_match',
    team,
    timePreset,
    teamPresets: teamPresets || {},
    username: username || 'Unknown',
  }));
}

export function sendMove(fromRow, fromCol, toRow, toCol, randomValues) {
  if (!ws || ws.readyState !== 1) return;
  ws.send(JSON.stringify({
    type: 'move',
    fromRow, fromCol, toRow, toCol,
    randomValues: randomValues || [],
  }));
}

export function cancelSearch() {
  if (!ws || ws.readyState !== 1) return;
  ws.send(JSON.stringify({ type: 'cancel_search' }));
}

export function resign() {
  if (!ws || ws.readyState !== 1) return;
  ws.send(JSON.stringify({ type: 'resign' }));
}

export function disconnect() {
  if (ws) {
    ws.close();
    ws = null;
  }
}

export function isConnected() {
  return ws && ws.readyState === 1;
}

// ─── Chat Functions ─────────────────────────────────────────────────

export function setUsername(username) {
  if (!ws || ws.readyState !== 1) return;
  ws.send(JSON.stringify({ type: 'set_username', username }));
}

export function sendLobbyChat(text) {
  if (!ws || ws.readyState !== 1) return;
  ws.send(JSON.stringify({ type: 'lobby_chat', text }));
}

export function sendGameChat(text) {
  if (!ws || ws.readyState !== 1) return;
  ws.send(JSON.stringify({ type: 'game_chat', text }));
}

export function requestChatHistory() {
  if (!ws || ws.readyState !== 1) return;
  ws.send(JSON.stringify({ type: 'get_chat_history' }));
}

// ─── Trade Functions ────────────────────────────────────────────────

export function findTrade(username, unlockedPokemon) {
  if (!ws || ws.readyState !== 1) return;
  ws.send(JSON.stringify({
    type: 'find_trade',
    username,
    unlockedPokemon,
  }));
}

export function sendTradeOffer(pokemonKey, coins) {
  if (!ws || ws.readyState !== 1) return;
  ws.send(JSON.stringify({
    type: 'trade_offer',
    pokemonKey: pokemonKey || null,
    coins: coins || 0,
  }));
}

export function confirmTrade() {
  if (!ws || ws.readyState !== 1) return;
  ws.send(JSON.stringify({ type: 'trade_confirm' }));
}

export function cancelTrade() {
  if (!ws || ws.readyState !== 1) return;
  ws.send(JSON.stringify({ type: 'trade_cancel' }));
}
