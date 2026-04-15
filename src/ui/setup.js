/**
 * Title Screen for PokéChess
 * Mode selection → AI / Online / Local config → Start
 */

import { TEAMS, POKEMON, POKEMON_POOL, KING_POOL, BACK_RANK_ROLES, ABILITIES } from '../engine/types.js';
import { AI_DIFFICULTIES } from '../engine/ai.js';
import { loadPlayerStats, getRankTitle, getWinRate } from '../engine/elo.js';
import { isLoggedIn, getUsername, login, signup, logout, refreshProfile, getLeaderboard, saveTeam, loadTeam } from '../engine/auth.js';

export function renderTitleScreen(onStart) {
  const app = document.getElementById('app');
  app.innerHTML = '';
  app.classList.add('app--title');

  const screen = document.createElement('div');
  screen.className = 'title-screen';
  screen.id = 'title-screen';

  screen.innerHTML = `
    <div class="title-screen__bg">
      <div class="title-screen__particles" id="title-particles"></div>
    </div>

    <div class="title-screen__content">
      <h1 class="title-screen__logo">
        <span class="title-screen__logo-poke">Poké</span><span class="title-screen__logo-chess">Chess</span>
      </h1>
      <p class="title-screen__tagline">Where Strategy Meets Pokémon Combat</p>

      <!-- Auth Section -->
      <div class="auth-section" id="auth-section"></div>

      <!-- Player Rating Badge -->
      <div class="title-screen__rating" id="title-rating"></div>

      <!-- Game Config (hidden until logged in) -->
      <div id="game-config" style="display:none">

      <!-- Mode Selection -->
      <div class="title-screen__section">
        <h3>🎮 Game Mode</h3>
        <div class="mode-select">
          <button class="mode-btn mode-btn--active" data-mode="ai">
            <span class="mode-btn__icon">🤖</span>
            <span class="mode-btn__label">VS AI</span>
            <span class="mode-btn__desc">Battle the computer</span>
          </button>
          <button class="mode-btn" data-mode="online">
            <span class="mode-btn__icon">🌐</span>
            <span class="mode-btn__label">Online</span>
            <span class="mode-btn__desc">Find an opponent</span>
          </button>
          <button class="mode-btn" data-mode="local">
            <span class="mode-btn__icon">👥</span>
            <span class="mode-btn__label">Local</span>
            <span class="mode-btn__desc">Play on one screen</span>
          </button>
        </div>
      </div>

      <!-- Config panels (shown/hidden based on mode) -->
      <div id="config-panels">

        <!-- Team Selection (AI + Online) -->
        <div class="title-screen__section config-panel" id="panel-team">
          <h3>⚔️ Choose Your Team</h3>
          <div class="team-select">
            <button class="team-select__btn team-select__btn--scarlet team-select__btn--active" data-team="scarlet">
              <img src="/img/koraidon.png" alt="Koraidon" class="team-select__img" />
              <span class="team-select__name" style="color:${TEAMS.scarlet.color}">Ancient</span>
              <span class="team-select__subtitle">Team Scarlet</span>
            </button>
            <div class="team-select__vs">VS</div>
            <button class="team-select__btn team-select__btn--violet" data-team="violet">
              <img src="/img/miraidon.png" alt="Miraidon" class="team-select__img" />
              <span class="team-select__name" style="color:${TEAMS.violet.color}">Future</span>
              <span class="team-select__subtitle">Team Violet</span>
            </button>
          </div>
        </div>

        <!-- Roster Editor -->
        <div class="title-screen__section config-panel" id="panel-roster">
          <h3>📚 Customize Roster <span class="roster-hint">(click a slot to swap)</span></h3>
          <div class="roster-team-tabs" id="roster-team-tabs" style="display:none">
            <button class="roster-tab roster-tab--active" data-tab-team="scarlet" style="--tab-color:${TEAMS.scarlet.color}">🔴 Ancient</button>
            <button class="roster-tab" data-tab-team="violet" style="--tab-color:${TEAMS.violet.color}">🟣 Future</button>
          </div>
          <div class="roster-editor" id="roster-editor"></div>
          <div class="roster-swap-panel" id="roster-swap-panel"></div>
        </div>

        <!-- AI Difficulty (AI only) -->
        <div class="title-screen__section config-panel" id="panel-difficulty">
          <h3>🤖 AI Difficulty</h3>
          <div class="difficulty-select difficulty-select--10">
            ${Object.entries(AI_DIFFICULTIES).map(([key, d]) => `
              <button class="btn btn--diff ${key === '3' ? 'btn--diff--active' : ''}" data-diff="${key}" title="${d.desc}">
                <span class="diff__level">${key}</span>
                <span class="diff__desc">${d.desc}</span>
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Time Control (all modes) -->
        <div class="title-screen__section config-panel" id="panel-time">
          <h3>⏱️ Time Control</h3>
          <div class="time-control__buttons">
            <button class="btn btn--time" data-preset="short">🏃 Short<br><span>10 min</span></button>
            <button class="btn btn--time btn--time--active" data-preset="medium">⚔️ Medium<br><span>25 min</span></button>
            <button class="btn btn--time" data-preset="long">🏰 Long<br><span>45 min</span></button>
          </div>
        </div>

      </div>

      <button class="btn btn--start" id="btn-start-game">
        <span class="btn__flash"></span>
        ⚔️ Start Battle
      </button>

      </div><!-- end game-config -->

      <!-- Login required message (shown when not logged in) -->
      <div class="login-required" id="login-required">
        <p>🔒 Log in or create an account to play</p>
      </div>

      <!-- Leaderboard & Pokédex Buttons -->
      <div class="title-btn-row">
        <button class="btn btn--leaderboard" id="btn-leaderboard">🏆 Leaderboard</button>
        <button class="btn btn--pokedex" id="btn-pokedex">📖 Pokédex</button>
      </div>

      <!-- Leaderboard Overlay -->
      <div class="leaderboard-overlay" id="leaderboard-overlay"></div>

      <!-- Pokédex Overlay -->
      <div class="pokedex-overlay" id="pokedex-overlay"></div>

      <div class="title-screen__rules">
        <h3>Quick Rules</h3>
        <ul>
          <li>❤️ <strong>Pieces have HP</strong> — attacks deal damage instead of instant captures</li>
          <li>⚔️ <strong>Damage tiers:</strong> Weak (2), Standard (3), Heavy (4)</li>
          <li>💀 <strong>Kill = capture</strong> — reduce HP to 0 to take the square</li>
          <li>🛡️ <strong>Survive = bounce back</strong> — if target has HP left, attacker returns</li>
          <li>💥 <strong>8% critical hit</strong> — doubles damage</li>
          <li>✨ <strong>Every Pokémon has a unique ability</strong> — freeze, stun, damage, drain, or heal!</li>
          <li>👑 <strong>Eliminate the opponent's True King to win!</strong></li>
          <li>⏱️ <strong>Chess clock</strong> — run out of time and you lose!</li>
        </ul>
      </div>

      <!-- Admin Panel -->
      <button class="btn btn--admin" id="btn-admin">🔒 Admin</button>
      <div class="admin-overlay" id="admin-overlay"></div>
    </div>
  `;

  app.appendChild(screen);

  // ── State ──
  let selectedMode = 'ai';
  let selectedTeam = 'scarlet';
  let selectedDifficulty = '3';
  let selectedPreset = 'medium';

  // Current roster (mutable copies of default back rank + pawn)
  let customRoster = {
    scarlet: { backRank: [...TEAMS.scarlet.backRank], pawnPokemon: TEAMS.scarlet.pawnPokemon },
    violet:  { backRank: [...TEAMS.violet.backRank],  pawnPokemon: TEAMS.violet.pawnPokemon },
  };
  let activeSwapSlot = null; // { type: 'back'|'pawn', index?: number }

  // Load saved team from server
  if (isLoggedIn()) {
    loadTeam().then(saved => {
      if (saved) {
        if (saved.scarlet) {
          customRoster.scarlet = { backRank: [...saved.scarlet.backRank], pawnPokemon: saved.scarlet.pawnPokemon };
        }
        if (saved.violet) {
          customRoster.violet = { backRank: [...saved.violet.backRank], pawnPokemon: saved.violet.pawnPokemon };
        }
        renderRoster();
      }
    });
  }

  // ── Mode selection ──
  const modeBtns = screen.querySelectorAll('.mode-btn');
  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      modeBtns.forEach(b => b.classList.remove('mode-btn--active'));
      btn.classList.add('mode-btn--active');
      selectedMode = btn.dataset.mode;
      updatePanels();
    });
  });

  function updatePanels() {
    const teamPanel = document.getElementById('panel-team');
    const diffPanel = document.getElementById('panel-difficulty');
    const rosterPanel = document.getElementById('panel-roster');
    const startBtn = document.getElementById('btn-start-game');
    const teamTabs = document.getElementById('roster-team-tabs');

    // Team panel: only for AI/Online (pick which team you play)
    teamPanel.style.display = (selectedMode === 'ai' || selectedMode === 'online') ? '' : 'none';
    // Roster editor: shown for all modes
    rosterPanel.style.display = '';
    diffPanel.style.display = selectedMode === 'ai' ? '' : 'none';

    // Team tabs: shown in local mode so both teams can be edited
    if (teamTabs) {
      teamTabs.style.display = selectedMode === 'local' ? 'flex' : 'none';
    }
    // In local mode, default to scarlet tab
    if (selectedMode === 'local' && selectedTeam !== 'scarlet' && selectedTeam !== 'violet') {
      selectedTeam = 'scarlet';
    }

    if (selectedMode === 'online') {
      startBtn.innerHTML = '<span class="btn__flash"></span>🌐 Find Match';
    } else if (selectedMode === 'local') {
      startBtn.innerHTML = '<span class="btn__flash"></span>👥 Start Local Game';
    } else {
      startBtn.innerHTML = '<span class="btn__flash"></span>⚔️ Start Battle';
    }
    renderRoster();
  }

  // ── Team selection (AI / Online modes) ──
  const teamBtns = screen.querySelectorAll('.team-select__btn');
  teamBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      teamBtns.forEach(b => b.classList.remove('team-select__btn--active'));
      btn.classList.add('team-select__btn--active');
      selectedTeam = btn.dataset.team;
      activeSwapSlot = null;
      renderRoster();
    });
  });

  // ── Roster team tabs (Local mode: switch between Scarlet/Violet editing) ──
  const rosterTabs = screen.querySelectorAll('.roster-tab');
  rosterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      rosterTabs.forEach(t => t.classList.remove('roster-tab--active'));
      tab.classList.add('roster-tab--active');
      selectedTeam = tab.dataset.tabTeam;
      activeSwapSlot = null;
      renderRoster();
    });
  });

  // ── Roster Editor ──
  function renderRoster() {
    const container = document.getElementById('roster-editor');
    const swapPanel = document.getElementById('roster-swap-panel');
    if (!container) return;

    const roster = customRoster[selectedTeam];
    const team = TEAMS[selectedTeam];

    // Build back rank slots
    let html = '<div class="roster-slots">';
    roster.backRank.forEach((pkmnKey, i) => {
      const pkmn = POKEMON[pkmnKey];
      const role = BACK_RANK_ROLES[i];
      const isTrueKing = role === 'TRUE_KING';
      const isActive = activeSwapSlot?.type === 'back' && activeSwapSlot?.index === i;
      html += `
        <button class="roster-slot ${isActive ? 'roster-slot--active' : ''} ${isTrueKing ? 'roster-slot--king' : ''}"
                data-slot-type="back" data-slot-index="${i}">
          <img class="roster-slot__img" src="${pkmn?.img || ''}" alt="${pkmn?.name || ''}" />
          <span class="roster-slot__name">${pkmn?.name || pkmnKey}</span>
          <span class="roster-slot__role">${role}</span>
          ${isTrueKing ? '<span class="roster-slot__crown">👑</span>' : ''}
        </button>
      `;
    });

    // Pawn slot
    const pawn = POKEMON[roster.pawnPokemon];
    const isPawnActive = activeSwapSlot?.type === 'pawn';
    html += `
      <button class="roster-slot roster-slot--pawn ${isPawnActive ? 'roster-slot--active' : ''}"
              data-slot-type="pawn">
        <img class="roster-slot__img" src="${pawn?.img || ''}" alt="${pawn?.name || ''}" />
        <span class="roster-slot__name">${pawn?.name || roster.pawnPokemon}</span>
        <span class="roster-slot__role">PAWN ×8</span>
      </button>
    `;
    html += '</div>';
    container.innerHTML = html;

    // Wire slot clicks
    container.querySelectorAll('.roster-slot:not([disabled])').forEach(btn => {
      btn.addEventListener('click', () => {
        const slotType = btn.dataset.slotType;
        const slotIndex = btn.dataset.slotIndex ? parseInt(btn.dataset.slotIndex) : null;

        if (activeSwapSlot?.type === slotType && activeSwapSlot?.index === slotIndex) {
          activeSwapSlot = null; // toggle off
        } else {
          activeSwapSlot = { type: slotType, index: slotIndex };
        }
        renderRoster();
      });
    });

    // Render swap options if a slot is selected
    if (activeSwapSlot && swapPanel) {
      renderSwapOptions(swapPanel);
    } else if (swapPanel) {
      swapPanel.innerHTML = '';
    }
  }

  function renderSwapOptions(swapPanel) {
    const stats = loadPlayerStats();
    const playerElo = stats.rating;

    // Use KING_POOL for TRUE_KING slot, POKEMON_POOL for everything else
    const isKingSlot = activeSwapSlot.type === 'back' && BACK_RANK_ROLES[activeSwapSlot.index] === 'TRUE_KING';
    const pool = isKingSlot ? (KING_POOL[selectedTeam] || []) : (POKEMON_POOL[selectedTeam] || []);
    const roster = customRoster[selectedTeam];

    // Current Pokémon in this slot
    const currentKey = activeSwapSlot.type === 'pawn'
      ? roster.pawnPokemon
      : roster.backRank[activeSwapSlot.index];

    let html = '<div class="swap-options">';
    html += '<div class="swap-options__title">⇄ Swap with:</div>';
    html += '<div class="swap-options__grid">';

    pool.forEach(entry => {
      const pkmn = POKEMON[entry.key];
      if (!pkmn) return;
      const unlocked = playerElo >= entry.requiredElo;
      const isCurrent = entry.key === currentKey;
      const ability = ABILITIES[entry.key];
      const abilityLabel = ability ? `${ability.emoji} ${ability.name}` : '';

      // Count how many times this Pokémon is already in the roster (back rank + pawn)
      let useCount = roster.backRank.filter(k => k === entry.key).length;
      if (roster.pawnPokemon === entry.key) useCount++;
      // If we're currently editing a slot that has this key, don't count it
      if (isCurrent) useCount--;
      const atLimit = useCount >= 2;

      const disabled = !unlocked || isCurrent || atLimit;

      html += `
        <button class="swap-option ${isCurrent ? 'swap-option--current' : ''} ${!unlocked ? 'swap-option--locked' : ''} ${atLimit ? 'swap-option--maxed' : ''}"
                data-pkmn-key="${entry.key}" ${disabled ? 'disabled' : ''}>
          <img class="swap-option__img" src="${pkmn.img || ''}" alt="${pkmn.name}" />
          <div class="swap-option__info">
            <span class="swap-option__name">${pkmn.name}</span>
            <span class="swap-option__stats">❤️${pkmn.hp} ⚔️${pkmn.damage}</span>
            ${abilityLabel ? `<span class="swap-option__ability">${abilityLabel}</span>` : ''}
          </div>
          ${!unlocked ? `<span class="swap-option__lock">🔒 ${entry.requiredElo}</span>` : ''}
          ${isCurrent ? '<span class="swap-option__check">✓</span>' : ''}
          ${atLimit ? '<span class="swap-option__lock">2x max</span>' : ''}
        </button>
      `;
    });

    html += '</div></div>';
    swapPanel.innerHTML = html;

    // Wire swap clicks
    swapPanel.querySelectorAll('.swap-option:not([disabled])').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.pkmnKey;
        if (activeSwapSlot.type === 'pawn') {
          roster.pawnPokemon = key;
        } else {
          roster.backRank[activeSwapSlot.index] = key;
        }
        activeSwapSlot = null;
        renderRoster();
        // Auto-save team to server
        if (isLoggedIn()) {
          saveTeam({
            scarlet: { backRank: [...customRoster.scarlet.backRank], pawnPokemon: customRoster.scarlet.pawnPokemon },
            violet:  { backRank: [...customRoster.violet.backRank],  pawnPokemon: customRoster.violet.pawnPokemon },
          });
        }
      });
    });
  }

  // ── AI Difficulty ──
  const diffBtns = screen.querySelectorAll('.btn--diff');
  diffBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      diffBtns.forEach(b => b.classList.remove('btn--diff--active'));
      btn.classList.add('btn--diff--active');
      selectedDifficulty = btn.dataset.diff;
    });
  });

  // ── Time control ──
  const timeButtons = screen.querySelectorAll('.btn--time');
  timeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      timeButtons.forEach(b => b.classList.remove('btn--time--active'));
      btn.classList.add('btn--time--active');
      selectedPreset = btn.dataset.preset;
    });
  });

  // ── Start button ──
  document.getElementById('btn-start-game').addEventListener('click', () => {
    screen.classList.add('title-screen--exit');
    setTimeout(() => {
      app.classList.remove('app--title');
      const playerColor = selectedTeam === 'scarlet' ? 'white' : 'black';

      // Build team presets from custom roster
      const teamPresets = {};
      if (selectedMode === 'local') {
        // Local mode: pass both teams' custom rosters
        teamPresets.scarlet = {
          backRank: [...customRoster.scarlet.backRank],
          pawnPokemon: customRoster.scarlet.pawnPokemon,
          pawnRole: TEAMS.scarlet.pawnRole,
        };
        teamPresets.violet = {
          backRank: [...customRoster.violet.backRank],
          pawnPokemon: customRoster.violet.pawnPokemon,
          pawnRole: TEAMS.violet.pawnRole,
        };
      } else {
        const roster = customRoster[selectedTeam];
        teamPresets[selectedTeam] = {
          backRank: [...roster.backRank],
          pawnPokemon: roster.pawnPokemon,
          pawnRole: TEAMS[selectedTeam].pawnRole,
        };
      }

      onStart(selectedPreset, {
        mode: selectedMode,
        playerColor: selectedMode === 'local' ? 'white' : playerColor,
        aiDifficulty: selectedDifficulty,
        isAIGame: selectedMode === 'ai',
        isOnline: selectedMode === 'online',
        isLocal: selectedMode === 'local',
        preferredTeam: selectedTeam,
        teamPresets,
      });
    }, 500);
  });

  // Leaderboard button
  document.getElementById('btn-leaderboard')?.addEventListener('click', showLeaderboard);

  // Pokédex button
  document.getElementById('btn-pokedex')?.addEventListener('click', showPokedex);

  function showPokedex() {
    const overlay = document.getElementById('pokedex-overlay');
    if (!overlay) return;

    // If already open, close it
    if (overlay.classList.contains('pokedex-overlay--open')) {
      overlay.classList.remove('pokedex-overlay--open');
      overlay.innerHTML = '';
      return;
    }

    const effectLabel = (ab) => {
      if (!ab) return '—';
      const parts = [];
      if (ab.effect === 'damage') parts.push(`${ab.damage} dmg to ${ab.targets.replace(/_/g,' ')}`);
      else if (ab.effect === 'status') parts.push(`${ab.status} ${ab.targets.replace(/_/g,' ')}`);
      else if (ab.effect === 'heal') parts.push(`heal ${ab.heal} HP (self)`);
      else if (ab.effect === 'drain') {
        parts.push(`${ab.damage} dmg to ${ab.targets.replace(/_/g,' ')}`);
        if (ab.heal > 0) parts.push(`heal ${ab.heal} HP`);
        else if (ab.heal < 0) parts.push(`costs ${Math.abs(ab.heal)} self HP`);
      }
      else if (ab.effect === 'heal_allies') parts.push(`heal allies ${ab.heal} HP`);
      if (ab.bonusStatus) parts.push(`+ ${ab.bonusStatus} 1 target`);
      return parts.join(', ');
    };

    const renderTeam = (teamKey, teamLabel, teamColor) => {
      const entries = Object.entries(POKEMON).filter(([k, p]) => p.team === teamKey);
      return `
        <div class="pokedex-team">
          <h3 class="pokedex-team__title" style="color:${teamColor}">${teamLabel}</h3>
          <div class="pokedex-grid">
            ${entries.map(([key, p]) => {
              const ab = ABILITIES[key];
              return `
                <div class="pokedex-card">
                  <img class="pokedex-card__img" src="${p.img || ''}" alt="${p.name}" />
                  <div class="pokedex-card__info">
                    <div class="pokedex-card__name">${p.name}</div>
                    <div class="pokedex-card__stats">❤️ ${p.hp} ⚔️ ${p.damage}</div>
                    ${ab ? `
                      <div class="pokedex-card__ability">
                        <span class="pokedex-card__ability-name">${ab.emoji} ${ab.name}</span>
                        <span class="pokedex-card__ability-desc">${effectLabel(ab)}</span>
                      </div>
                    ` : '<div class="pokedex-card__ability"><span class="pokedex-card__ability-desc">No ability</span></div>'}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    };

    overlay.innerHTML = `
      <div class="pokedex-panel">
        <div class="pokedex-header">
          <h2>📖 Pokédex — Abilities</h2>
          <button class="pokedex-close" id="pokedex-close">✕</button>
        </div>
        <div class="pokedex-body">
          ${renderTeam('scarlet', '🔴 Ancient Team (Scarlet)', TEAMS.scarlet.color)}
          ${renderTeam('violet', '🟣 Future Team (Violet)', TEAMS.violet.color)}
        </div>
      </div>
    `;

    overlay.classList.add('pokedex-overlay--open');

    document.getElementById('pokedex-close')?.addEventListener('click', () => {
      overlay.classList.remove('pokedex-overlay--open');
      overlay.innerHTML = '';
    });
  }

  // ── Admin Panel ──
  document.getElementById('btn-admin')?.addEventListener('click', showAdminPanel);

  let adminPassword = null;

  function adminFetch(endpoint, body) {
    const isDev = window.location.port === '5173' || window.location.port === '5174';
    const base = isDev ? `http://${window.location.hostname}:3001/api` : `${window.location.origin}/api`;
    return fetch(`${base}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminPassword, ...body }),
    }).then(r => r.json());
  }

  function showAdminPanel() {
    const overlay = document.getElementById('admin-overlay');
    if (!overlay) return;

    if (overlay.classList.contains('admin-overlay--open')) {
      overlay.classList.remove('admin-overlay--open');
      overlay.innerHTML = '';
      return;
    }

    // If no password yet, show password prompt
    if (!adminPassword) {
      overlay.innerHTML = `
        <div class="admin-panel">
          <div class="admin-header">
            <h2>🔒 Admin Login</h2>
            <button class="admin-close" id="admin-close">✕</button>
          </div>
          <div class="admin-password-form">
            <input type="password" id="admin-pw-input" class="admin-input" placeholder="Enter admin password..." autofocus />
            <button class="btn btn--admin-submit" id="admin-pw-submit">Unlock</button>
            <div class="admin-error" id="admin-pw-error"></div>
          </div>
        </div>
      `;
      overlay.classList.add('admin-overlay--open');

      document.getElementById('admin-close')?.addEventListener('click', () => {
        overlay.classList.remove('admin-overlay--open');
        overlay.innerHTML = '';
      });

      const submit = () => {
        const pw = document.getElementById('admin-pw-input')?.value;
        if (!pw) return;
        adminPassword = pw;
        // Test password by fetching users
        adminFetch('/admin/users', {}).then(data => {
          if (data.error) {
            adminPassword = null;
            document.getElementById('admin-pw-error').textContent = '❌ ' + data.error;
          } else {
            renderAdminDashboard(overlay, data.users);
          }
        }).catch(() => {
          adminPassword = null;
          document.getElementById('admin-pw-error').textContent = '❌ Connection error';
        });
      };

      document.getElementById('admin-pw-submit')?.addEventListener('click', submit);
      document.getElementById('admin-pw-input')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') submit();
      });
      return;
    }

    // Already authenticated — load users
    adminFetch('/admin/users', {}).then(data => {
      if (data.error) {
        adminPassword = null;
        showAdminPanel();
      } else {
        renderAdminDashboard(overlay, data.users);
      }
    });
  }

  function renderAdminDashboard(overlay, users) {
    overlay.innerHTML = `
      <div class="admin-panel">
        <div class="admin-header">
          <h2>⚙️ Admin Dashboard</h2>
          <button class="admin-close" id="admin-close-dash">✕</button>
        </div>
        <div class="admin-search">
          <input type="text" id="admin-search" class="admin-input" placeholder="Search users..." />
        </div>
        <div class="admin-user-list" id="admin-user-list"></div>
        <div class="admin-status" id="admin-status"></div>
      </div>
    `;
    overlay.classList.add('admin-overlay--open');

    document.getElementById('admin-close-dash')?.addEventListener('click', () => {
      overlay.classList.remove('admin-overlay--open');
      overlay.innerHTML = '';
    });

    let allUsers = users;

    function renderUsers(filter = '') {
      const list = document.getElementById('admin-user-list');
      if (!list) return;
      const filtered = filter
        ? allUsers.filter(u => u.username.toLowerCase().includes(filter.toLowerCase()))
        : allUsers;

      if (filtered.length === 0) {
        list.innerHTML = '<div class="admin-empty">No users found</div>';
        return;
      }

      list.innerHTML = filtered.map(u => {
        const isBanned = u.bannedUntil && new Date(u.bannedUntil) > new Date();
        const banLabel = isBanned
          ? `<span class="admin-ban-tag">🚫 Banned until ${new Date(u.bannedUntil).toLocaleDateString()}</span>`
          : '';
        return `
          <div class="admin-user-card ${isBanned ? 'admin-user-card--banned' : ''}">
            <div class="admin-user-info">
              <span class="admin-user-name">${u.rankEmoji || ''} ${u.username}</span>
              <span class="admin-user-stats">${u.rank || ''} — ⭐ ${u.rating} | ${u.gamesPlayed} games | W${u.wins}/L${u.losses}</span>
              ${banLabel}
            </div>
            <div class="admin-user-actions">
              <button class="admin-action-btn admin-action-btn--elo" data-user="${u.username}" data-action="elo" title="Modify ELO">📊 ELO</button>
              <button class="admin-action-btn admin-action-btn--reset" data-user="${u.username}" data-action="reset" title="Reset ELO">🔄 Reset</button>
              <button class="admin-action-btn admin-action-btn--ban" data-user="${u.username}" data-action="${isBanned ? 'unban' : 'ban'}" title="${isBanned ? 'Unban' : 'Ban'}">${isBanned ? '✅ Unban' : '🔨 Ban'}</button>
              <button class="admin-action-btn admin-action-btn--delete" data-user="${u.username}" data-action="delete" title="Delete">🗑️</button>
            </div>
          </div>
        `;
      }).join('');

      // Wire action buttons
      list.querySelectorAll('.admin-action-btn').forEach(btn => {
        btn.addEventListener('click', () => handleAdminAction(btn.dataset.action, btn.dataset.user));
      });
    }

    renderUsers();

    document.getElementById('admin-search')?.addEventListener('input', e => {
      renderUsers(e.target.value);
    });

    function showStatus(msg, isError = false) {
      const el = document.getElementById('admin-status');
      if (el) {
        el.textContent = msg;
        el.className = 'admin-status ' + (isError ? 'admin-status--error' : 'admin-status--success');
        setTimeout(() => { if (el) el.textContent = ''; }, 3000);
      }
    }

    function refreshUsers() {
      adminFetch('/admin/users', {}).then(data => {
        if (data.users) {
          allUsers = data.users;
          const search = document.getElementById('admin-search')?.value || '';
          renderUsers(search);
        }
      });
      // Also refresh the logged-in user's profile + rating badge
      refreshProfile().then(() => populateRatingBadge());
    }

    function handleAdminAction(action, username) {
      if (action === 'delete') {
        if (!confirm(`Delete user "${username}" permanently? This cannot be undone.`)) return;
        adminFetch('/admin/delete', { username }).then(data => {
          showStatus(data.message || data.error, !!data.error);
          if (data.success) refreshUsers();
        });

      } else if (action === 'elo') {
        const amount = prompt(`Modify ELO for "${username}".\nEnter amount (e.g. 200 or -100):`);
        if (amount === null) return;
        adminFetch('/admin/elo', { username, amount: parseInt(amount) }).then(data => {
          if (data.success) showStatus(`${username}: ${data.oldRating} → ${data.newRating} ${data.rankEmoji} ${data.rank}`);
          else showStatus(data.error, true);
          if (data.success) refreshUsers();
        });

      } else if (action === 'reset') {
        if (!confirm(`Reset ALL stats for "${username}" to default?`)) return;
        adminFetch('/admin/reset-elo', { username }).then(data => {
          showStatus(data.message || data.error, !!data.error);
          if (data.success) refreshUsers();
        });

      } else if (action === 'ban') {
        const hours = prompt(`Ban "${username}" for how many hours?`);
        if (hours === null) return;
        adminFetch('/admin/ban', { username, hours: parseInt(hours) }).then(data => {
          showStatus(data.message || data.error, !!data.error);
          if (data.success) refreshUsers();
        });

      } else if (action === 'unban') {
        adminFetch('/admin/unban', { username }).then(data => {
          showStatus(data.message || data.error, !!data.error);
          if (data.success) refreshUsers();
        });
      }
    }
  }

  // Init panel visibility
  updatePanels();
  createParticles();
  renderAuthSection();
  populateRatingBadge();

  // Try refreshing profile from server on load
  if (isLoggedIn()) {
    refreshProfile().then(() => {
      renderAuthSection();
      populateRatingBadge();
    });
  }
}

function renderAuthSection() {
  const container = document.getElementById('auth-section');
  if (!container) return;

  const gameConfig = document.getElementById('game-config');
  const loginRequired = document.getElementById('login-required');

  if (isLoggedIn()) {
    const username = getUsername();
    container.innerHTML = `
      <div class="auth-badge">
        <span class="auth-badge__avatar">👤</span>
        <span class="auth-badge__name">${username}</span>
        <button class="btn btn--small btn--secondary" id="btn-logout">Logout</button>
      </div>
    `;
    // Show game config, hide login prompt
    if (gameConfig) gameConfig.style.display = '';
    if (loginRequired) loginRequired.style.display = 'none';

    document.getElementById('btn-logout')?.addEventListener('click', () => {
      logout();
      renderAuthSection();
      populateRatingBadge();
    });
  } else {
    container.innerHTML = `
      <div class="auth-panel" id="auth-panel">
        <div class="auth-tabs">
          <button class="auth-tab auth-tab--active" data-tab="login" id="tab-login">Login</button>
          <button class="auth-tab" data-tab="signup" id="tab-signup">Sign Up</button>
        </div>
        <form class="auth-form" id="auth-form">
          <div class="auth-form__fields">
            <input type="text" class="auth-input" id="auth-username" placeholder="Username" autocomplete="username" maxlength="20" />
            <input type="password" class="auth-input" id="auth-password" placeholder="Password" autocomplete="current-password" />
          </div>
          <button type="submit" class="btn btn--primary auth-submit" id="auth-submit">Login</button>
          <div class="auth-error" id="auth-error"></div>
        </form>
      </div>
    `;

    // Hide game config, show login prompt
    if (gameConfig) gameConfig.style.display = 'none';
    if (loginRequired) loginRequired.style.display = '';

    let authMode = 'login';

    const tabLogin = document.getElementById('tab-login');
    const tabSignup = document.getElementById('tab-signup');
    const submitBtn = document.getElementById('auth-submit');
    const form = document.getElementById('auth-form');
    const errorEl = document.getElementById('auth-error');

    tabLogin?.addEventListener('click', () => {
      authMode = 'login';
      tabLogin.classList.add('auth-tab--active');
      tabSignup.classList.remove('auth-tab--active');
      submitBtn.textContent = 'Login';
      errorEl.textContent = '';
    });

    tabSignup?.addEventListener('click', () => {
      authMode = 'signup';
      tabSignup.classList.add('auth-tab--active');
      tabLogin.classList.remove('auth-tab--active');
      submitBtn.textContent = 'Create Account';
      errorEl.textContent = '';
    });

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('auth-username')?.value?.trim();
      const password = document.getElementById('auth-password')?.value;

      if (!username || !password) {
        errorEl.textContent = 'Enter username and password';
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = '...';
      errorEl.textContent = '';

      const result = authMode === 'login'
        ? await login(username, password)
        : await signup(username, password);

      if (result.error) {
        errorEl.textContent = result.error;
        submitBtn.disabled = false;
        submitBtn.textContent = authMode === 'login' ? 'Login' : 'Create Account';
      } else {
        renderAuthSection();
        populateRatingBadge();
      }
    });
  }
}

function populateRatingBadge() {
  const container = document.getElementById('title-rating');
  if (!container) return;

  const stats = loadPlayerStats();
  const rank = getRankTitle(stats.rating);
  const winRate = getWinRate(stats);
  const totalGames = stats.wins + stats.losses + stats.draws;

  if (totalGames === 0 && stats.rating === 1000) {
    container.innerHTML = `
      <div class="rating-badge rating-badge--new">
        <span class="rating-badge__icon">🥚</span>
        <span class="rating-badge__label">Unranked</span>
        <span class="rating-badge__sub">Play a game to get rated!</span>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="rating-badge" style="--rank-color: ${rank.color}">
        <span class="rating-badge__icon">${rank.emoji}</span>
        <div class="rating-badge__info">
          <span class="rating-badge__rank" style="color:${rank.color}">${rank.title}</span>
          <span class="rating-badge__rating">${stats.rating} ELO</span>
        </div>
        <div class="rating-badge__stats">
          <span class="rating-badge__wld">${stats.wins}W ${stats.losses}L ${stats.draws}D</span>
          <span class="rating-badge__wr">${winRate}%</span>
        </div>
        ${stats.streak > 1 ? `<span class="rating-badge__streak">🔥${stats.streak}</span>` : ''}
      </div>
    `;
  }
}

function createParticles() {
  const container = document.getElementById('title-particles');
  if (!container) return;
  for (let i = 0; i < 30; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = Math.random() * 100 + '%';
    p.style.animationDelay = Math.random() * 5 + 's';
    p.style.animationDuration = (3 + Math.random() * 4) + 's';
    p.style.setProperty('--hue', Math.random() > 0.5 ? '0' : '270');
    container.appendChild(p);
  }
}

async function showLeaderboard() {
  const overlay = document.getElementById('leaderboard-overlay');
  if (!overlay) return;

  // Show loading state
  overlay.classList.add('leaderboard-overlay--show');
  overlay.innerHTML = `
    <div class="leaderboard-panel">
      <button class="leaderboard-close" id="lb-close">&times;</button>
      <h2 class="leaderboard-title">🏆 Leaderboard</h2>
      <div class="leaderboard-loading">
        <div class="searching-overlay__spinner"></div>
        <p>Loading rankings...</p>
      </div>
    </div>
  `;

  document.getElementById('lb-close')?.addEventListener('click', hideLeaderboard);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) hideLeaderboard();
  });

  // Fetch data
  const leaders = await getLeaderboard();
  const currentUser = getUsername();

  const medals = ['🥇', '🥈', '🥉'];

  const rows = leaders.length === 0
    ? '<div class="leaderboard-empty">No players yet — be the first!</div>'
    : leaders.map((p, i) => {
        const rank = getRankTitle(p.rating);
        const isMe = currentUser && p.username.toLowerCase() === currentUser.toLowerCase();
        const medal = medals[i] || `<span class="lb-rank-num">${i + 1}</span>`;
        const wr = p.gamesPlayed > 0 ? Math.round((p.wins / p.gamesPlayed) * 100) : 0;

        return `
          <div class="lb-row ${isMe ? 'lb-row--me' : ''} ${i < 3 ? 'lb-row--top' : ''}">
            <div class="lb-row__pos">${medal}</div>
            <div class="lb-row__player">
              <span class="lb-row__name">${p.username}</span>
              <span class="lb-row__rank-badge" style="color:${rank.color}">${rank.emoji} ${rank.title}</span>
            </div>
            <div class="lb-row__rating">${p.rating}</div>
            <div class="lb-row__record">${p.wins}W ${p.losses}L</div>
            <div class="lb-row__wr">${wr}%</div>
          </div>
        `;
      }).join('');

  overlay.querySelector('.leaderboard-panel').innerHTML = `
    <button class="leaderboard-close" id="lb-close">&times;</button>
    <h2 class="leaderboard-title">🏆 Leaderboard</h2>
    <div class="lb-header">
      <div class="lb-header__pos">#</div>
      <div class="lb-header__player">Player</div>
      <div class="lb-header__rating">ELO</div>
      <div class="lb-header__record">Record</div>
      <div class="lb-header__wr">Win%</div>
    </div>
    <div class="lb-rows">${rows}</div>
  `;

  document.getElementById('lb-close')?.addEventListener('click', hideLeaderboard);
}

function hideLeaderboard() {
  const overlay = document.getElementById('leaderboard-overlay');
  if (overlay) {
    overlay.classList.remove('leaderboard-overlay--show');
    overlay.innerHTML = '';
  }
}
