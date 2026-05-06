/**
 * Bulbasaur Minigames Module
 * Three canvas-based minigames accessible from the title logo
 */
import { unlockHiddenItem, isHiddenItemUnlocked } from './shop.js';

// Preload Bulbasaur sprite from PokeAPI official artwork
const BULBA_IMG = new Image();
BULBA_IMG.crossOrigin = 'anonymous';
BULBA_IMG.src = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/1.png';

function drawBulbasaur(ctx, x, y, size, facing = 1) {
  ctx.save();
  if (facing < 0) {
    ctx.translate(x + size, y);
    ctx.scale(-1, 1);
    x = 0; y = 0;
  }
  if (BULBA_IMG.complete && BULBA_IMG.naturalWidth > 0) {
    ctx.drawImage(BULBA_IMG, x, y, size, size);
  } else {
    // Fallback while loading
    ctx.fillStyle = '#6dbd8a';
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ─── Game 1: Bulbasaur Jump ─────────────────────────────────
function startJumpGame(canvas) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const ground = H - 60;
  let bulba = { x: 80, y: ground - 40, vy: 0, size: 40, jumping: false };
  let obstacles = [];
  let score = 0;
  let speed = 3;
  let frameCount = 0;
  let gameOver = false;
  let animId;

  function spawnObstacle() {
    const h = 20 + Math.random() * 30;
    obstacles.push({ x: W + 10, w: 20 + Math.random() * 15, h, y: ground - h });
  }

  function jump() {
    if (!bulba.jumping && !gameOver) { bulba.vy = -10; bulba.jumping = true; }
    if (gameOver) { resetGame(); }
  }

  function resetGame() {
    bulba = { x: 80, y: ground - 40, vy: 0, size: 40, jumping: false };
    obstacles = []; score = 0; speed = 3; frameCount = 0; gameOver = false;
  }

  canvas.onclick = jump;
  canvas.onkeydown = (e) => { if (e.code === 'Space') { e.preventDefault(); jump(); } };
  canvas.setAttribute('tabindex', '0');
  canvas.focus();

  function update() {
    if (gameOver) return;
    frameCount++;
    if (frameCount % Math.max(40, 80 - score) === 0) spawnObstacle();
    if (frameCount % 200 === 0) speed = Math.min(8, speed + 0.3);

    bulba.vy += 0.5;
    bulba.y += bulba.vy;
    if (bulba.y >= ground - bulba.size) { bulba.y = ground - bulba.size; bulba.vy = 0; bulba.jumping = false; }

    obstacles.forEach(o => o.x -= speed);
    obstacles = obstacles.filter(o => o.x > -40);

    for (const o of obstacles) {
      if (bulba.x + 30 > o.x && bulba.x + 10 < o.x + o.w &&
          bulba.y + bulba.size > o.y) {
        gameOver = true;
      }
    }
    obstacles.forEach(o => { if (o.x + o.w < bulba.x && !o.scored) { o.scored = true; score++; } });
  }

  function draw() {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, W, H);
    // Ground
    ctx.fillStyle = '#2d5a3d';
    ctx.fillRect(0, ground, W, H - ground);
    ctx.fillStyle = '#3a7a5a';
    ctx.fillRect(0, ground, W, 3);
    // Obstacles (cacti-like)
    ctx.fillStyle = '#c0392b';
    obstacles.forEach(o => { ctx.fillRect(o.x, o.y, o.w, o.h); });
    // Bulbasaur
    drawBulbasaur(ctx, bulba.x, bulba.y, bulba.size);
    // Score
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(`Score: ${score}`, 10, 25);
    if (gameOver) {
      // Check for hidden item unlock
      let justUnlocked = false;
      if (score >= 50 && !isHiddenItemUnlocked('AGILITY_BAND')) {
        justUnlocked = unlockHiddenItem('AGILITY_BAND');
      }

      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Game Over!', W / 2, H / 2 - 30);
      ctx.font = '16px monospace';
      ctx.fillStyle = '#fff';
      ctx.fillText(`Score: ${score} — Click to retry`, W / 2, H / 2);

      if (justUnlocked || (score >= 50 && isHiddenItemUnlocked('AGILITY_BAND'))) {
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 18px monospace';
        ctx.fillText('💨 SECRET UNLOCKED: Agility Band! 💨', W / 2, H / 2 + 30);
        ctx.font = '13px monospace';
        ctx.fillStyle = 'rgba(56, 189, 248, 0.8)';
        ctx.fillText('Check the shop for your new item!', W / 2, H / 2 + 50);
      }
      ctx.textAlign = 'left';
    }
  }

  function loop() {
    update(); draw();
    animId = requestAnimationFrame(loop);
  }
  loop();
  return () => cancelAnimationFrame(animId);
}

// ─── Game 2: Leaf Shooter ───────────────────────────────────
function startShooterGame(canvas) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  let bulba = { x: 60, y: H / 2, size: 40 };
  let leaves = [];
  let enemies = [];
  let score = 0;
  let hp = 5;
  let frameCount = 0;
  let gameOver = false;
  let animId;
  let keys = {};
  let mouseX = W / 2, mouseY = H / 2;
  let shootTimer = 0;
  const SHOOT_INTERVAL = 8; // Auto-shoot every 8 frames (~7.5 shots/sec)
  const LEAF_SPEED = 8;

  // Get mouse/touch position relative to canvas
  function getCanvasPos(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (W / rect.width),
      y: (clientY - rect.top) * (H / rect.height),
    };
  }

  function shoot() {
    if (gameOver) return;
    const bx = bulba.x + bulba.size;
    const by = bulba.y + bulba.size / 2;
    const dx = mouseX - bx;
    const dy = mouseY - by;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    leaves.push({
      x: bx, y: by,
      vx: (dx / dist) * LEAF_SPEED,
      vy: (dy / dist) * LEAF_SPEED,
      angle: Math.atan2(dy, dx),
    });
  }

  canvas.setAttribute('tabindex', '0');
  canvas.focus();

  // Keyboard movement
  canvas.onkeydown = (e) => { keys[e.code] = true; if (e.code === 'Space') e.preventDefault(); };
  canvas.onkeyup = (e) => { keys[e.code] = false; };

  // Track mouse position
  canvas.addEventListener('mousemove', (e) => {
    const pos = getCanvasPos(e.clientX, e.clientY);
    mouseX = pos.x;
    mouseY = pos.y;
  });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const pos = getCanvasPos(e.touches[0].clientX, e.touches[0].clientY);
    mouseX = pos.x;
    mouseY = pos.y;
  }, { passive: false });

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const pos = getCanvasPos(e.touches[0].clientX, e.touches[0].clientY);
    mouseX = pos.x;
    mouseY = pos.y;
  }, { passive: false });

  // Click to retry on game over
  canvas.onclick = () => {
    if (gameOver) resetGame();
  };

  function spawnEnemy() {
    const sz = 15 + Math.random() * 20;
    const ehp = sz > 30 ? 3 : sz > 22 ? 2 : 1;
    enemies.push({ x: W + 10, y: 30 + Math.random() * (H - 90), size: sz, hp: ehp, maxHp: ehp, speed: 1.5 + Math.random() * 2, flash: 0 });
  }

  function resetGame() {
    bulba = { x: 60, y: H / 2, size: 40 };
    leaves = []; enemies = []; score = 0; hp = 5; frameCount = 0; gameOver = false; shootTimer = 0;
  }

  function update() {
    if (gameOver) return;
    frameCount++;
    if (frameCount % 45 === 0) spawnEnemy();

    // Keyboard movement
    const spd = 4;
    if (keys['ArrowUp'] || keys['KeyW']) bulba.y = Math.max(0, bulba.y - spd);
    if (keys['ArrowDown'] || keys['KeyS']) bulba.y = Math.min(H - bulba.size, bulba.y + spd);

    // Auto-shoot
    shootTimer++;
    if (shootTimer >= SHOOT_INTERVAL) {
      shootTimer = 0;
      shoot();
    }

    // Update leaves (now with vx and vy)
    leaves.forEach(l => { l.x += l.vx; l.y += l.vy; });
    leaves = leaves.filter(l => l.x > -10 && l.x < W + 10 && l.y > -10 && l.y < H + 10);

    enemies.forEach(e => { e.x -= e.speed; if (e.flash > 0) e.flash--; });

    // Leaf-enemy collision
    for (let i = enemies.length - 1; i >= 0; i--) {
      for (let j = leaves.length - 1; j >= 0; j--) {
        const e = enemies[i], l = leaves[j];
        if (l && e && l.x > e.x && l.x < e.x + e.size && l.y > e.y && l.y < e.y + e.size) {
          leaves.splice(j, 1);
          e.hp--;
          if (e.hp <= 0) {
            enemies.splice(i, 1);
            score += e.maxHp; // More points for tougher enemies
          } else {
            e.flash = 6; // Flash white when hit
          }
          break;
        }
      }
    }

    // Enemy reaches left
    for (let i = enemies.length - 1; i >= 0; i--) {
      if (enemies[i].x < -10) { enemies.splice(i, 1); hp--; if (hp <= 0) gameOver = true; }
    }
  }

  function draw() {
    ctx.fillStyle = '#0f1923';
    ctx.fillRect(0, 0, W, H);
    // Stars
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    for (let i = 0; i < 30; i++) {
      const sx = (i * 137 + frameCount * 0.3) % W;
      const sy = (i * 97) % H;
      ctx.fillRect(sx, sy, 2, 2);
    }

    // Aim line (subtle)
    if (!gameOver) {
      ctx.save();
      ctx.strokeStyle = 'rgba(74, 222, 128, 0.15)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 8]);
      ctx.beginPath();
      ctx.moveTo(bulba.x + bulba.size, bulba.y + bulba.size / 2);
      ctx.lineTo(mouseX, mouseY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Crosshair at mouse
      ctx.save();
      ctx.strokeStyle = 'rgba(74, 222, 128, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(mouseX, mouseY, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mouseX - 14, mouseY); ctx.lineTo(mouseX - 6, mouseY);
      ctx.moveTo(mouseX + 6, mouseY); ctx.lineTo(mouseX + 14, mouseY);
      ctx.moveTo(mouseX, mouseY - 14); ctx.lineTo(mouseX, mouseY - 6);
      ctx.moveTo(mouseX, mouseY + 6); ctx.lineTo(mouseX, mouseY + 14);
      ctx.stroke();
      ctx.restore();
    }

    // Bulbasaur
    drawBulbasaur(ctx, bulba.x, bulba.y, bulba.size);
    // Leaves — rotated to face direction of travel
    ctx.fillStyle = '#4ade80';
    leaves.forEach(l => {
      ctx.save();
      ctx.translate(l.x, l.y);
      ctx.rotate(l.angle || 0);
      ctx.fillRect(-4, -2, 8, 4);
      ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(10, -3); ctx.lineTo(10, 3); ctx.fill();
      ctx.restore();
    });
    // Enemies (Zubats - simple)
    enemies.forEach(e => {
      const baseColor = e.flash > 0 ? '#fff' : '#a855f7';
      const wingColor = e.flash > 0 ? '#ddd' : '#7c3aed';
      ctx.fillStyle = baseColor;
      ctx.beginPath();
      ctx.ellipse(e.x + e.size / 2, e.y + e.size / 2, e.size / 2, e.size / 3, 0, 0, Math.PI * 2);
      ctx.fill();
      // Wings
      ctx.fillStyle = wingColor;
      const wy = Math.sin(frameCount * 0.3 + e.x) * 5;
      ctx.beginPath();
      ctx.moveTo(e.x + e.size / 2, e.y + e.size / 2);
      ctx.lineTo(e.x - 5, e.y + wy);
      ctx.lineTo(e.x + 5, e.y + wy + 5);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(e.x + e.size / 2, e.y + e.size / 2);
      ctx.lineTo(e.x + e.size + 5, e.y + wy);
      ctx.lineTo(e.x + e.size - 5, e.y + wy + 5);
      ctx.fill();
      // HP pips for multi-HP enemies
      if (e.maxHp > 1) {
        const pipY = e.y - 6;
        const pipW = 4, pipGap = 2;
        const totalW = e.maxHp * pipW + (e.maxHp - 1) * pipGap;
        const startX = e.x + e.size / 2 - totalW / 2;
        for (let p = 0; p < e.maxHp; p++) {
          ctx.fillStyle = p < e.hp ? '#ef4444' : 'rgba(255,255,255,0.2)';
          ctx.fillRect(startX + p * (pipW + pipGap), pipY, pipW, 3);
        }
      }
    });
    // HUD
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(`Score: ${score}  HP: ${'❤️'.repeat(hp)}`, 10, 22);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '11px monospace';
    ctx.fillText('↑↓ move • Mouse aims • Auto-fires!', 10, H - 10);

    if (gameOver) {
      // Check for hidden item unlock
      let justUnlocked = false;
      if (score >= 100 && !isHiddenItemUnlocked('RAZOR_LEAF')) {
        justUnlocked = unlockHiddenItem('RAZOR_LEAF');
      }

      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Game Over!', W / 2, H / 2 - 30);
      ctx.font = '16px monospace';
      ctx.fillStyle = '#fff';
      ctx.fillText(`Score: ${score} — Click to retry`, W / 2, H / 2);

      if (justUnlocked || (score >= 100 && isHiddenItemUnlocked('RAZOR_LEAF'))) {
        ctx.fillStyle = '#4ade80';
        ctx.font = 'bold 18px monospace';
        ctx.fillText('🍃 SECRET UNLOCKED: Razor Leaf Storm! 🍃', W / 2, H / 2 + 30);
        ctx.font = '13px monospace';
        ctx.fillStyle = 'rgba(74, 222, 128, 0.8)';
        ctx.fillText('Check the shop for your new item!', W / 2, H / 2 + 50);
      }

      // Toxic Orb unlock at score 200
      let toxicUnlocked = false;
      if (score >= 200 && !isHiddenItemUnlocked('TOXIC_ORB')) {
        toxicUnlocked = unlockHiddenItem('TOXIC_ORB');
      }
      if (toxicUnlocked || (score >= 200 && isHiddenItemUnlocked('TOXIC_ORB'))) {
        ctx.fillStyle = '#a855f7';
        ctx.font = 'bold 18px monospace';
        ctx.fillText('☠️ SECRET UNLOCKED: Toxic Orb! ☠️', W / 2, H / 2 + 75);
        ctx.font = '13px monospace';
        ctx.fillStyle = 'rgba(168, 85, 247, 0.8)';
        ctx.fillText('A deadly new item awaits in the shop!', W / 2, H / 2 + 95);
      }
      ctx.textAlign = 'left';
    }
  }

  function loop() {
    update(); draw();
    animId = requestAnimationFrame(loop);
  }
  loop();
  return () => { cancelAnimationFrame(animId); canvas.onkeydown = null; canvas.onkeyup = null; canvas.onclick = null; };
}

// ─── Game 3: Maze ───────────────────────────────────────────
function startMazeGame(canvas) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const COLS = 11, ROWS = 9;
  const CW = Math.floor(W / COLS), CH = Math.floor(H / ROWS);
  let animId;

  // Generate maze using recursive backtracking
  function generateMaze() {
    const grid = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => ({ walls: [true, true, true, true], visited: false }))); // top, right, bottom, left
    const stack = [];
    let cur = { r: 0, c: 0 };
    grid[0][0].visited = true;
    stack.push(cur);

    while (stack.length > 0) {
      const neighbors = [];
      const { r, c } = cur;
      if (r > 0 && !grid[r - 1][c].visited) neighbors.push({ r: r - 1, c, dir: 0 });
      if (c < COLS - 1 && !grid[r][c + 1].visited) neighbors.push({ r, c: c + 1, dir: 1 });
      if (r < ROWS - 1 && !grid[r + 1][c].visited) neighbors.push({ r: r + 1, c, dir: 2 });
      if (c > 0 && !grid[r][c - 1].visited) neighbors.push({ r, c: c - 1, dir: 3 });

      if (neighbors.length > 0) {
        const next = neighbors[Math.floor(Math.random() * neighbors.length)];
        // Remove walls between cur and next
        grid[r][c].walls[next.dir] = false;
        grid[next.r][next.c].walls[(next.dir + 2) % 4] = false;
        grid[next.r][next.c].visited = true;
        stack.push(cur);
        cur = next;
      } else {
        cur = stack.pop();
      }
    }
    return grid;
  }

  let maze = generateMaze();
  let player = { r: 0, c: 0 };
  let goal = { r: ROWS - 1, c: COLS - 1 };
  let moves = 0;
  let won = false;

  function reset() {
    maze = generateMaze();
    player = { r: 0, c: 0 };
    moves = 0;
    won = false;
  }

  canvas.setAttribute('tabindex', '0');
  canvas.focus();
  canvas.onkeydown = (e) => {
    if (won) { if (e.code === 'Space') reset(); return; }
    const { r, c } = player;
    const cell = maze[r][c];
    if ((e.code === 'ArrowUp' || e.code === 'KeyW') && !cell.walls[0]) { player.r--; moves++; }
    if ((e.code === 'ArrowRight' || e.code === 'KeyD') && !cell.walls[1]) { player.c++; moves++; }
    if ((e.code === 'ArrowDown' || e.code === 'KeyS') && !cell.walls[2]) { player.r++; moves++; }
    if ((e.code === 'ArrowLeft' || e.code === 'KeyA') && !cell.walls[3]) { player.c--; moves++; }
    if (player.r === goal.r && player.c === goal.c) won = true;
    e.preventDefault();
  };

  function draw() {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, W, H);

    // Draw maze
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 2;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = c * CW, y = r * CH;
        const w = maze[r][c].walls;
        if (w[0]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + CW, y); ctx.stroke(); }
        if (w[1]) { ctx.beginPath(); ctx.moveTo(x + CW, y); ctx.lineTo(x + CW, y + CH); ctx.stroke(); }
        if (w[2]) { ctx.beginPath(); ctx.moveTo(x, y + CH); ctx.lineTo(x + CW, y + CH); ctx.stroke(); }
        if (w[3]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + CH); ctx.stroke(); }
      }
    }

    // Goal
    ctx.fillStyle = '#fbbf24';
    ctx.font = `${Math.min(CW, CH) - 8}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⭐', goal.c * CW + CW / 2, goal.r * CH + CH / 2);

    // Player (Bulbasaur)
    const ps = Math.min(CW, CH) - 6;
    drawBulbasaur(ctx, player.c * CW + (CW - ps) / 2, player.r * CH + (CH - ps) / 2, ps);

    // HUD
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`Moves: ${moves}`, 5, 5);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '11px monospace';
    ctx.fillText('Arrow keys / WASD to move', 5, H - 16);

    if (won) {
      // Check for hidden item unlock
      let justUnlocked = false;
      if (moves <= 30 && !isHiddenItemUnlocked('SHADOW_CLOAK')) {
        justUnlocked = unlockHiddenItem('SHADOW_CLOAK');
      }

      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 26px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🎉 You escaped!', W / 2, H / 2 - 25);
      ctx.font = '14px monospace';
      ctx.fillStyle = '#fff';
      ctx.fillText(`${moves} moves — SPACE for new maze`, W / 2, H / 2 + 5);

      if (justUnlocked || (moves <= 30 && isHiddenItemUnlocked('SHADOW_CLOAK'))) {
        ctx.fillStyle = '#6366f1';
        ctx.font = 'bold 16px monospace';
        ctx.fillText('🌑 SECRET UNLOCKED: Shadow Cloak! 🌑', W / 2, H / 2 + 35);
        ctx.font = '12px monospace';
        ctx.fillStyle = 'rgba(99, 102, 241, 0.8)';
        ctx.fillText('Check the shop for your new item!', W / 2, H / 2 + 55);
      }
    }
  }

  function loop() {
    draw();
    animId = requestAnimationFrame(loop);
  }
  loop();
  return () => { cancelAnimationFrame(animId); canvas.onkeydown = null; };
}

// ─── Minigame Selector Overlay ──────────────────────────────
let activeCleanup = null;

export function openMinigames() {
  if (document.querySelector('.minigame-overlay')) return;

  const overlay = document.createElement('div');
  overlay.className = 'minigame-overlay';
  overlay.innerHTML = `
    <div class="minigame-panel">
      <div class="minigame-header">
        <h2 class="minigame-title">🌿 Bulbasaur Arcade</h2>
        <button class="minigame-close">&times;</button>
      </div>
      <div class="minigame-select">
        <button class="minigame-btn" data-game="jump">
          <span class="minigame-btn__icon">🦘</span>
          <span class="minigame-btn__name">Bulba Jump</span>
          <span class="minigame-btn__desc">Tap to jump obstacles</span>
        </button>
        <button class="minigame-btn" data-game="shooter">
          <span class="minigame-btn__icon">🍃</span>
          <span class="minigame-btn__name">Leaf Shooter</span>
          <span class="minigame-btn__desc">Shoot leaves at Zubats</span>
        </button>
        <button class="minigame-btn" data-game="maze">
          <span class="minigame-btn__icon">🌀</span>
          <span class="minigame-btn__name">Maze Escape</span>
          <span class="minigame-btn__desc">Navigate the maze</span>
        </button>
      </div>
      <div class="minigame-canvas-wrap" style="display:none">
        <button class="minigame-back">← Back</button>
        <canvas class="minigame-canvas" width="440" height="320"></canvas>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('minigame-overlay--show'));

  const panel = overlay.querySelector('.minigame-panel');
  const selectDiv = overlay.querySelector('.minigame-select');
  const canvasWrap = overlay.querySelector('.minigame-canvas-wrap');
  const canvas = overlay.querySelector('.minigame-canvas');
  const backBtn = overlay.querySelector('.minigame-back');

  function close() {
    if (activeCleanup) { activeCleanup(); activeCleanup = null; }
    overlay.classList.remove('minigame-overlay--show');
    setTimeout(() => overlay.remove(), 300);
  }

  function showSelect() {
    if (activeCleanup) { activeCleanup(); activeCleanup = null; }
    selectDiv.style.display = '';
    canvasWrap.style.display = 'none';
  }

  function startGame(type) {
    selectDiv.style.display = 'none';
    canvasWrap.style.display = '';
    canvas.focus();
    if (type === 'jump') activeCleanup = startJumpGame(canvas);
    else if (type === 'shooter') activeCleanup = startShooterGame(canvas);
    else if (type === 'maze') activeCleanup = startMazeGame(canvas);
  }

  overlay.querySelector('.minigame-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  backBtn.addEventListener('click', showSelect);
  overlay.querySelectorAll('.minigame-btn').forEach(btn => {
    btn.addEventListener('click', () => startGame(btn.dataset.game));
  });
}
