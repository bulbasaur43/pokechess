/**
 * Background Music Player for PokéChess
 * Uses YouTube IFrame API to play video game OSTs
 */

const PLAYLIST = [
  { id: 'PXuMbN_TZQw', title: 'Trainer Battle — Pokémon Scarlet/Violet' },
  { id: 'wRWq53IFXE4', title: 'Dragon Roost Island — Zelda: Wind Waker' },
  { id: 'zO8Y7hdD6Qk', title: 'Hyrule Field — Zelda: Ocarina of Time' },
  { id: 'SbIG4u7ALAE', title: 'Flying Minigame — Zelda: Tears of the Kingdom' },
  { id: 'ygMjItiTjFk', title: 'Final Boss (AI) — Pokémon Scarlet/Violet' },
];

let player = null;
let currentIndex = 0;
let isMuted = false;
let isReady = false;
let volume = 30; // Low default so it doesn't overpower gameplay

/** Load the YouTube IFrame API script */
function loadYTAPI() {
  if (window.YT && window.YT.Player) {
    onYTReady();
    return;
  }
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
  window.onYouTubeIframeAPIReady = onYTReady;
}

function onYTReady() {
  // Shuffle playlist
  for (let i = PLAYLIST.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [PLAYLIST[i], PLAYLIST[j]] = [PLAYLIST[j], PLAYLIST[i]];
  }

  // Create hidden player
  let container = document.getElementById('yt-player-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'yt-player-container';
    container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;pointer-events:none;';
    document.body.appendChild(container);

    const el = document.createElement('div');
    el.id = 'yt-music-player';
    container.appendChild(el);
  }

  player = new YT.Player('yt-music-player', {
    height: '1',
    width: '1',
    videoId: PLAYLIST[0].id,
    playerVars: {
      autoplay: 0,
      controls: 0,
      disablekb: 1,
      fs: 0,
      modestbranding: 1,
      rel: 0,
      playsinline: 1,
    },
    events: {
      onReady: (e) => {
        isReady = true;
        e.target.setVolume(volume);
        updateMusicUI();
      },
      onStateChange: (e) => {
        // When video ends, play next
        if (e.data === YT.PlayerState.ENDED) {
          playNext();
        }
      },
      onError: () => {
        // Skip broken video
        playNext();
      },
    },
  });
}

function playNext() {
  currentIndex = (currentIndex + 1) % PLAYLIST.length;
  if (player && isReady) {
    player.loadVideoById(PLAYLIST[currentIndex].id);
    updateMusicUI();
  }
}

function playPrev() {
  currentIndex = (currentIndex - 1 + PLAYLIST.length) % PLAYLIST.length;
  if (player && isReady) {
    player.loadVideoById(PLAYLIST[currentIndex].id);
    updateMusicUI();
  }
}

function toggleMute() {
  if (!player || !isReady) return;
  isMuted = !isMuted;
  if (isMuted) {
    player.pauseVideo();
  } else {
    player.playVideo();
  }
  updateMusicUI();
}

function startPlaying() {
  if (!player || !isReady) return;
  if (isMuted) return;
  player.playVideo();
}

function setVolume(v) {
  volume = Math.max(0, Math.min(100, v));
  if (player && isReady) player.setVolume(volume);
}

function getCurrentTrack() {
  return PLAYLIST[currentIndex];
}

function updateMusicUI() {
  const btn = document.getElementById('music-toggle');
  const label = document.getElementById('music-label');
  if (btn) btn.textContent = isMuted ? '🔇' : '🎵';
  if (label) label.textContent = isMuted ? 'Music Off' : getCurrentTrack().title;
}

/** Create the floating music control widget */
export function createMusicControls() {
  if (document.getElementById('music-controls')) return;

  const controls = document.createElement('div');
  controls.id = 'music-controls';
  controls.className = 'music-controls';
  controls.innerHTML = `
    <button class="music-btn music-btn--prev" id="music-prev" title="Previous">⏮</button>
    <button class="music-btn music-btn--toggle" id="music-toggle" title="Play/Pause">🎵</button>
    <button class="music-btn music-btn--next" id="music-next" title="Next">⏭</button>
    <span class="music-label" id="music-label">Loading...</span>
  `;
  document.body.appendChild(controls);

  document.getElementById('music-toggle').addEventListener('click', toggleMute);
  document.getElementById('music-next').addEventListener('click', playNext);
  document.getElementById('music-prev').addEventListener('click', playPrev);

  // Need user interaction to start audio — start on first click anywhere
  const startOnInteraction = () => {
    startPlaying();
    document.removeEventListener('click', startOnInteraction);
  };
  document.addEventListener('click', startOnInteraction);

  // Load YouTube API
  loadYTAPI();
}
