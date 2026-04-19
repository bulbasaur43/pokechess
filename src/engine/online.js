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

export function findMatch(team, timePreset) {
  if (!ws || ws.readyState !== 1) return;
  ws.send(JSON.stringify({
    type: 'find_match',
    team,
    timePreset,
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
