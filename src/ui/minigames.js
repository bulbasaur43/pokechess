/**
 * Bulbasaur Minigames Module
 * Three canvas-based minigames accessible from the title logo
 */

const BULBA_COLOR = '#6dbd8a';
const BULBA_DARK = '#3a7a5a';
const BULBA_BULB = '#2f8a5a';

function drawBulbasaur(ctx, x, y, size, facing = 1) {
  const s = size;
  ctx.save();
  ctx.translate(x, y);
  if (facing < 0) { ctx.scale(-1, 1); ctx.translate(-s, 0); }
  // Body
  ctx.fillStyle = BULBA_COLOR;
  ctx.beginPath();
  ctx.ellipse(s * 0.5, s * 0.65, s * 0.38, s * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  // Legs
  ctx.fillStyle = BULBA_DARK;
  [[0.2, 0.85], [0.4, 0.88], [0.6, 0.88], [0.8, 0.85]].forEach(([lx, ly]) => {
    ctx.fillRect(s * lx - 4, s * ly, 8, s * 0.12);
  });
  // Bulb
  ctx.fillStyle = BULBA_BULB;
  ctx.beginPath();
  ctx.ellipse(s * 0.5, s * 0.42, s * 0.22, s * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a6040';
  ctx.beginPath();
  ctx.moveTo(s * 0.5, s * 0.22);
  ctx.lineTo(s * 0.38, s * 0.42);
  ctx.lineTo(s * 0.62, s * 0.42);
  ctx.fill();
  // Eyes
  ctx.fillStyle = '#c33';
  [[0.32, 0.58], [0.68, 0.58]].forEach(([ex, ey]) => {
    ctx.beginPath();
    ctx.arc(s * ex, s * ey, s * 0.06, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = '#fff';
  [[0.34, 0.56], [0.70, 0.56]].forEach(([ex, ey]) => {
    ctx.beginPath();
    ctx.arc(s * ex, s * ey, s * 0.025, 0, Math.PI * 2);
    ctx.fill();
  });
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
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Game Over!', W / 2, H / 2 - 15);
      ctx.font = '16px monospace';
      ctx.fillStyle = '#fff';
      ctx.fillText(`Score: ${score} — Click to retry`, W / 2, H / 2 + 15);
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

  function shoot() {
    if (!gameOver) leaves.push({ x: bulba.x + bulba.size, y: bulba.y + bulba.size / 2, vx: 7 });
  }

  canvas.setAttribute('tabindex', '0');
  canvas.focus();
  canvas.onkeydown = (e) => {
    keys[e.code] = true;
    if (e.code === 'Space') { e.preventDefault(); shoot(); }
  };
  canvas.onkeyup = (e) => { keys[e.code] = false; };
  canvas.onclick = shoot;

  function spawnEnemy() {
    const sz = 15 + Math.random() * 20;
    enemies.push({ x: W + 10, y: 30 + Math.random() * (H - 90), size: sz, hp: 1, speed: 1.5 + Math.random() * 2 });
  }

  function resetGame() {
    bulba = { x: 60, y: H / 2, size: 40 };
    leaves = []; enemies = []; score = 0; hp = 5; frameCount = 0; gameOver = false;
  }

  function update() {
    if (gameOver) return;
    frameCount++;
    if (frameCount % 45 === 0) spawnEnemy();

    const spd = 4;
    if (keys['ArrowUp'] || keys['KeyW']) bulba.y = Math.max(0, bulba.y - spd);
    if (keys['ArrowDown'] || keys['KeyS']) bulba.y = Math.min(H - bulba.size, bulba.y + spd);

    leaves.forEach(l => l.x += l.vx);
    leaves = leaves.filter(l => l.x < W);

    enemies.forEach(e => e.x -= e.speed);

    // Leaf-enemy collision
    for (let i = enemies.length - 1; i >= 0; i--) {
      for (let j = leaves.length - 1; j >= 0; j--) {
        const e = enemies[i], l = leaves[j];
        if (l && e && l.x > e.x && l.x < e.x + e.size && l.y > e.y && l.y < e.y + e.size) {
          enemies.splice(i, 1); leaves.splice(j, 1); score++; break;
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
    // Bulbasaur
    drawBulbasaur(ctx, bulba.x, bulba.y, bulba.size);
    // Leaves
    ctx.fillStyle = '#4ade80';
    leaves.forEach(l => {
      ctx.save(); ctx.translate(l.x, l.y); ctx.rotate(frameCount * 0.2);
      ctx.fillRect(-4, -2, 8, 4);
      ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(10, -3); ctx.lineTo(10, 3); ctx.fill();
      ctx.restore();
    });
    // Enemies (Zubats - simple)
    ctx.fillStyle = '#a855f7';
    enemies.forEach(e => {
      ctx.beginPath();
      ctx.ellipse(e.x + e.size / 2, e.y + e.size / 2, e.size / 2, e.size / 3, 0, 0, Math.PI * 2);
      ctx.fill();
      // Wings
      ctx.fillStyle = '#7c3aed';
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
      ctx.fillStyle = '#a855f7';
    });
    // HUD
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(`Score: ${score}  HP: ${'❤️'.repeat(hp)}`, 10, 22);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '11px monospace';
    ctx.fillText('↑↓ move • SPACE/Click shoot', 10, H - 10);

    if (gameOver) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Game Over!', W / 2, H / 2 - 15);
      ctx.font = '16px monospace';
      ctx.fillStyle = '#fff';
      ctx.fillText(`Score: ${score} — Click to retry`, W / 2, H / 2 + 15);
      ctx.textAlign = 'left';
    }
  }

  function loop() {
    update(); draw();
    animId = requestAnimationFrame(loop);
  }
  loop();
  return () => { cancelAnimationFrame(animId); canvas.onkeydown = null; canvas.onkeyup = null; };
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
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 26px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🎉 You escaped!', W / 2, H / 2 - 15);
      ctx.font = '14px monospace';
      ctx.fillStyle = '#fff';
      ctx.fillText(`${moves} moves — SPACE for new maze`, W / 2, H / 2 + 15);
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
