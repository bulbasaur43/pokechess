/**
 * Bulbasaur Minigames Module
 * Three canvas-based minigames accessible from the title logo
 */
import { unlockHiddenItem, isHiddenItemUnlocked, getCoins, spendCoins } from './shop.js';

// Preload sprites from PokeAPI official artwork
const BULBA_IMG = new Image();
BULBA_IMG.crossOrigin = 'anonymous';
BULBA_IMG.src = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/1.png';

const PIKA_IMG = new Image();
PIKA_IMG.crossOrigin = 'anonymous';
PIKA_IMG.src = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png';

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
  const hasLeafBlaster = isHiddenItemUnlocked('LEAF_BLASTER');
  const SHOOT_INTERVAL = hasLeafBlaster ? 3 : 8; // 20/sec with Leaf Blaster, ~7.5/sec default
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

      // Leaf Blaster unlock at score 150
      let blasterUnlocked = false;
      if (score >= 50 && !isHiddenItemUnlocked('LEAF_BLASTER')) {
        blasterUnlocked = unlockHiddenItem('LEAF_BLASTER');
      }
      if (blasterUnlocked || (score >= 50 && isHiddenItemUnlocked('LEAF_BLASTER'))) {
        ctx.fillStyle = '#22c55e';
        ctx.font = 'bold 16px monospace';
        ctx.fillText('🌿 SECRET UNLOCKED: Leaf Blaster! 🌿', W / 2, H / 2 + 70);
        ctx.font = '12px monospace';
        ctx.fillStyle = 'rgba(34, 197, 94, 0.8)';
        ctx.fillText('Bulbasaur now fires 20 leaves/sec!', W / 2, H / 2 + 88);
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

// ─── Pikachu Draw Helper ────────────────────────────────────
function drawPikachu(ctx, x, y, size, facing = 1) {
  ctx.save();
  if (facing < 0) {
    ctx.translate(x + size, y);
    ctx.scale(-1, 1);
    x = 0; y = 0;
  }
  if (PIKA_IMG.complete && PIKA_IMG.naturalWidth > 0) {
    ctx.drawImage(PIKA_IMG, x, y, size, size);
  } else {
    ctx.fillStyle = '#f8d030';
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ─── Game 4: Pikachu Volt Dash ──────────────────────────────
function startVoltDashGame(canvas) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const ground = H - 50;
  let pika = { x: 70, y: ground - 40, vy: 0, size: 40, jumping: false };
  let bolts = []; // collectible thunderbolts
  let rocks = []; // obstacles
  let score = 0;
  let speed = 3.5;
  let frameCount = 0;
  let gameOver = false;
  let combo = 0;
  let animId;

  function spawnBolt() {
    bolts.push({ x: W + 10, y: ground - 30 - Math.random() * 120, size: 18 });
  }
  function spawnRock() {
    const h = 18 + Math.random() * 28;
    rocks.push({ x: W + 10, w: 18 + Math.random() * 14, h, y: ground - h });
  }

  function jump() {
    if (!pika.jumping && !gameOver) { pika.vy = -11; pika.jumping = true; }
    if (gameOver) resetGame();
  }

  function resetGame() {
    pika = { x: 70, y: ground - 40, vy: 0, size: 40, jumping: false };
    bolts = []; rocks = []; score = 0; speed = 3.5; frameCount = 0; gameOver = false; combo = 0;
  }

  canvas.onclick = jump;
  canvas.onkeydown = (e) => { if (e.code === 'Space') { e.preventDefault(); jump(); } };
  canvas.setAttribute('tabindex', '0');
  canvas.focus();

  function update() {
    if (gameOver) return;
    frameCount++;
    if (frameCount % 55 === 0) spawnBolt();
    if (frameCount % Math.max(35, 75 - Math.floor(score / 5)) === 0) spawnRock();
    if (frameCount % 250 === 0) speed = Math.min(8, speed + 0.3);

    pika.vy += 0.55;
    pika.y += pika.vy;
    if (pika.y >= ground - pika.size) { pika.y = ground - pika.size; pika.vy = 0; pika.jumping = false; }

    bolts.forEach(b => b.x -= speed);
    rocks.forEach(r => r.x -= speed);
    bolts = bolts.filter(b => b.x > -30);
    rocks = rocks.filter(r => r.x > -30);

    // Collect bolts
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i];
      if (pika.x + 30 > b.x && pika.x + 10 < b.x + b.size && pika.y + 10 < b.y + b.size && pika.y + pika.size > b.y) {
        bolts.splice(i, 1);
        combo++;
        score += combo; // combo scoring
      }
    }

    // Hit rocks
    for (const r of rocks) {
      if (pika.x + 30 > r.x && pika.x + 10 < r.x + r.w && pika.y + pika.size > r.y) {
        gameOver = true;
      }
    }
  }

  function draw() {
    // Dark electric sky
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0c0e1a');
    grad.addColorStop(1, '#1a1040');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Ground
    ctx.fillStyle = '#2a1f4e';
    ctx.fillRect(0, ground, W, H - ground);
    ctx.fillStyle = '#f8d030';
    ctx.fillRect(0, ground, W, 2);

    // Bolts
    bolts.forEach(b => {
      ctx.font = `${b.size}px serif`;
      ctx.fillText('⚡', b.x, b.y + b.size);
    });

    // Rocks
    ctx.fillStyle = '#6b7280';
    rocks.forEach(r => {
      ctx.beginPath();
      ctx.moveTo(r.x, r.y + r.h);
      ctx.lineTo(r.x + r.w / 2, r.y);
      ctx.lineTo(r.x + r.w, r.y + r.h);
      ctx.closePath();
      ctx.fill();
    });

    // Pikachu
    drawPikachu(ctx, pika.x, pika.y, pika.size);

    // Combo indicator
    if (combo > 1 && !gameOver) {
      ctx.fillStyle = '#f8d030';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`x${combo} combo!`, pika.x - 5, pika.y - 8);
    }

    // HUD
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(`⚡ ${score}`, 10, 25);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '11px monospace';
    ctx.fillText('Click / SPACE to jump', 10, H - 8);

    if (gameOver) {
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#f8d030';
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Zapped Out!', W / 2, H / 2 - 30);
      ctx.font = '16px monospace';
      ctx.fillStyle = '#fff';
      ctx.fillText(`Score: ${score} (best combo: x${combo}) — Click to retry`, W / 2, H / 2 + 5);
      ctx.textAlign = 'left';
    }
  }

  function loop() { update(); draw(); animId = requestAnimationFrame(loop); }
  loop();
  return () => cancelAnimationFrame(animId);
}

// ─── Game 5: Pikachu Thunder Catch ──────────────────────────
function startThunderCatchGame(canvas) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  let pika = { x: W / 2 - 20, size: 40 };
  const pikaY = H - 55;
  let items = []; // falling objects
  let score = 0;
  let hp = 5;
  let frameCount = 0;
  let gameOver = false;
  let animId;
  let keys = {};

  const ITEM_TYPES = [
    { emoji: '🍇', points: 1, color: '#a855f7' },
    { emoji: '🍎', points: 2, color: '#ef4444' },
    { emoji: '⚡', points: 5, color: '#f8d030' },
    { emoji: '💎', points: 10, color: '#38bdf8' },
    { emoji: '💣', points: -1, color: '#374151', harmful: true },
  ];

  function spawnItem() {
    // Higher chance of harmful items as score increases
    const harmfulChance = Math.min(0.35, 0.1 + score * 0.003);
    const isHarmful = Math.random() < harmfulChance;
    const type = isHarmful ? ITEM_TYPES[4] : ITEM_TYPES[Math.floor(Math.random() * 4)];
    items.push({ x: 10 + Math.random() * (W - 30), y: -20, speed: 2 + Math.random() * 2 + score * 0.02, ...type, size: 22 });
  }

  function resetGame() {
    pika = { x: W / 2 - 20, size: 40 };
    items = []; score = 0; hp = 5; frameCount = 0; gameOver = false;
  }

  canvas.setAttribute('tabindex', '0');
  canvas.focus();
  canvas.onkeydown = (e) => { keys[e.code] = true; e.preventDefault(); if (gameOver && e.code === 'Space') resetGame(); };
  canvas.onkeyup = (e) => { keys[e.code] = false; };
  canvas.onclick = () => { if (gameOver) resetGame(); };

  function update() {
    if (gameOver) return;
    frameCount++;
    if (frameCount % Math.max(12, 30 - Math.floor(score / 8)) === 0) spawnItem();

    const spd = 5;
    if (keys['ArrowLeft'] || keys['KeyA']) pika.x = Math.max(0, pika.x - spd);
    if (keys['ArrowRight'] || keys['KeyD']) pika.x = Math.min(W - pika.size, pika.x + spd);

    items.forEach(it => it.y += it.speed);

    // Catch check
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (it.y + it.size > pikaY && it.x + it.size > pika.x + 5 && it.x < pika.x + pika.size - 5) {
        items.splice(i, 1);
        if (it.harmful) { hp--; if (hp <= 0) gameOver = true; }
        else { score += it.points; }
        continue;
      }
      // Missed good items don't penalize, missed bombs are fine
      if (it.y > H + 10) { items.splice(i, 1); }
    }
  }

  function draw() {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Platform
    ctx.fillStyle = '#f8d030';
    ctx.fillRect(0, H - 12, W, 12);
    ctx.fillStyle = '#ca8a04';
    ctx.fillRect(0, H - 12, W, 2);

    // Falling items
    items.forEach(it => {
      ctx.font = `${it.size}px serif`;
      ctx.fillText(it.emoji, it.x, it.y + it.size);
    });

    // Pikachu
    drawPikachu(ctx, pika.x, pikaY, pika.size);

    // HUD
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(`Score: ${score}  HP: ${'❤️'.repeat(Math.max(0, hp))}`, 10, 22);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '11px monospace';
    ctx.fillText('← → / A D to move', 10, H - 18);

    if (gameOver) {
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#f8d030';
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Game Over!', W / 2, H / 2 - 30);
      ctx.font = '16px monospace';
      ctx.fillStyle = '#fff';
      ctx.fillText(`Score: ${score} — Click to retry`, W / 2, H / 2 + 5);
      ctx.textAlign = 'left';
    }
  }

  function loop() { update(); draw(); animId = requestAnimationFrame(loop); }
  loop();
  return () => { cancelAnimationFrame(animId); canvas.onkeydown = null; canvas.onkeyup = null; canvas.onclick = null; };
}

// ─── Game 6: PokéDrift (Drift Boss style) ───────────────────
// Authentic Drift Boss clone: car drives forward on connected platform
// segments with 90° turns. Hold = drift right, release = drift left.
// Fall off the edge = game over. Collect coins on the track.

const DRIFT_CARS = [
  { name: 'Pikachu',    color: '#f8d030', body: '#f8d030', roof: '#e8c020', turn: 2.2, cost: 0 },
  { name: 'Bulbasaur',  color: '#4ade80', body: '#4ade80', roof: '#22c55e', turn: 1.6, cost: 30 },
  { name: 'Charmander', color: '#ef4444', body: '#ef4444', roof: '#dc2626', turn: 3.0, cost: 50 },
  { name: 'Squirtle',   color: '#38bdf8', body: '#38bdf8', roof: '#0ea5e9', turn: 2.5, cost: 40 },
];

function getDriftUnlocks() {
  try { return JSON.parse(localStorage.getItem('pokechess_drift_unlocks') || '[0]'); } catch { return [0]; }
}
function saveDriftUnlock(idx) {
  const u = getDriftUnlocks();
  if (!u.includes(idx)) { u.push(idx); localStorage.setItem('pokechess_drift_unlocks', JSON.stringify(u)); }
}

function drawCar(ctx, x, y, angle, car, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const s = scale || 1;
  // Car body
  ctx.fillStyle = car.body;
  ctx.beginPath();
  ctx.moveTo(-8 * s, -14 * s);
  ctx.lineTo(8 * s, -14 * s);
  ctx.quadraticCurveTo(12 * s, -14 * s, 12 * s, -10 * s);
  ctx.lineTo(12 * s, 10 * s);
  ctx.quadraticCurveTo(12 * s, 14 * s, 8 * s, 14 * s);
  ctx.lineTo(-8 * s, 14 * s);
  ctx.quadraticCurveTo(-12 * s, 14 * s, -12 * s, 10 * s);
  ctx.lineTo(-12 * s, -10 * s);
  ctx.quadraticCurveTo(-12 * s, -14 * s, -8 * s, -14 * s);
  ctx.fill();
  // Roof/cabin
  ctx.fillStyle = car.roof;
  ctx.fillRect(-7 * s, -6 * s, 14 * s, 10 * s);
  // Windshield
  ctx.fillStyle = 'rgba(200,230,255,0.7)';
  ctx.fillRect(-6 * s, -11 * s, 12 * s, 5 * s);
  // Rear window
  ctx.fillStyle = 'rgba(200,230,255,0.5)';
  ctx.fillRect(-5 * s, 5 * s, 10 * s, 4 * s);
  // Wheels
  ctx.fillStyle = '#222';
  ctx.fillRect(-13 * s, -11 * s, 4 * s, 7 * s);
  ctx.fillRect(9 * s, -11 * s, 4 * s, 7 * s);
  ctx.fillRect(-13 * s, 4 * s, 4 * s, 7 * s);
  ctx.fillRect(9 * s, 4 * s, 4 * s, 7 * s);
  // Headlights
  ctx.fillStyle = '#fff';
  ctx.fillRect(-8 * s, -14 * s, 4 * s, 2 * s);
  ctx.fillRect(4 * s, -14 * s, 4 * s, 2 * s);
  // Taillights
  ctx.fillStyle = '#f00';
  ctx.fillRect(-7 * s, 12 * s, 3 * s, 2 * s);
  ctx.fillRect(4 * s, 12 * s, 3 * s, 2 * s);
  ctx.restore();
}

function startDriftGame(canvas) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  // ── State ──
  let phase = 'select'; // 'select' | 'play' | 'dead'
  let carIdx = 0;
  let score = 0, coinCount = 0, bestScore = 0;
  let fallTimer = 0;
  let holding = false;
  let animId;
  let buyMsg = '', buyMsgT = 0;

  // Track state
  const ROAD_W = 65;
  // Direction vectors: 0=up, 1=right, 2=down, 3=left
  const DX = [0, 1, 0, -1];
  const DY = [-1, 0, 1, 0];
  let segments = [];  // {sx,sy,dir,len}
  let trackCoins = [];
  let carX = 0, carY = 0; // world position
  let segI = 0; // current segment index
  let segProgress = 0; // 0..segLen pixels traveled in current seg
  let lateralOff = 0; // perpendicular offset from center
  let speed = 1.5;

  // Load best
  try { bestScore = parseInt(localStorage.getItem('pokechess_drift_best') || '0'); } catch {}

  // ── Track generation ──
  function buildTrack() {
    segments = []; trackCoins = [];
    let x = 0, y = 0, dir = 0; // start going up
    for (let i = 0; i < 500; i++) {
      const len = 90 + Math.floor(Math.random() * 70);
      segments.push({ sx: x, sy: y, dir, len });
      // Place coins
      const n = Math.floor(len / 60);
      for (let c = 0; c < n; c++) {
        const t = (c + 0.5) / n * len;
        trackCoins.push({
          x: x + DX[dir] * t,
          y: y + DY[dir] * t,
          collected: false
        });
      }
      // Move to segment end
      x += DX[dir] * len;
      y += DY[dir] * len;
      // Turn (never go backwards = opposite dir)
      const turnRight = Math.random() < 0.5;
      dir = turnRight ? (dir + 1) % 4 : (dir + 3) % 4;
    }
  }

  function resetGame() {
    buildTrack();
    segI = 0; segProgress = 0; lateralOff = 0;
    speed = 1.5; score = 0; coinCount = 0; fallTimer = 0;
    holding = false;
    const s = segments[0];
    carX = s.sx; carY = s.sy;
  }

  // ── Perpendicular direction ──
  function perpDX(dir) { return DY[dir] === 0 ? 0 : -DY[dir] > 0 ? -1 : DY[dir] > 0 ? 1 : 0; }
  // Simpler: perp right of travel direction
  function perpR(dir) {
    // up→right, right→down, down→left, left→up
    return { dx: DY[dir] === -1 ? 1 : DY[dir] === 1 ? -1 : 0 === DX[dir] ? 0 : DX[dir],
             dy: DX[dir] === 1 ? 1 : DX[dir] === -1 ? -1 : 0 };
  }
  // Even simpler approach:
  function getPerpR(dir) {
    // dir 0 (up): perp right = (1,0)
    // dir 1 (right): perp right = (0,1)
    // dir 2 (down): perp right = (-1,0)
    // dir 3 (left): perp right = (0,-1)
    return { dx: [1, 0, -1, 0][dir], dy: [0, 1, 0, -1][dir] };
  }

  // ── Input ──
  function onPress() {
    if (phase === 'select') return;
    if (phase === 'dead') { phase = 'select'; return; }
    holding = true;
  }
  function onRelease() { holding = false; }

  canvas.addEventListener('mousedown', onPress);
  canvas.addEventListener('mouseup', onRelease);
  canvas.addEventListener('touchstart', (e) => { e.preventDefault(); onPress(); }, { passive: false });
  canvas.addEventListener('touchend', (e) => { e.preventDefault(); onRelease(); }, { passive: false });
  canvas.setAttribute('tabindex', '0');
  canvas.focus();

  canvas.onkeydown = (e) => {
    if (e.code === 'Space' || e.code === 'ArrowRight') { e.preventDefault(); onPress(); }
    if (phase === 'select') {
      if (e.code === 'ArrowLeft') carIdx = (carIdx - 1 + DRIFT_CARS.length) % DRIFT_CARS.length;
      if (e.code === 'ArrowDown') carIdx = (carIdx + 1) % DRIFT_CARS.length;
      if (e.code === 'ArrowUp') carIdx = (carIdx - 1 + DRIFT_CARS.length) % DRIFT_CARS.length;
      if (e.code === 'Enter') tryStart();
    }
  };
  canvas.onkeyup = (e) => {
    if (e.code === 'Space' || e.code === 'ArrowRight') onRelease();
  };

  canvas.onclick = (e) => {
    if (phase !== 'select') return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width * W;
    const my = (e.clientY - rect.top) / rect.height * H;
    // Car buttons: centered, 4 rows
    const btnW = 260, btnH = 42;
    const startY = 130;
    for (let i = 0; i < DRIFT_CARS.length; i++) {
      const bx = (W - btnW) / 2;
      const by = startY + i * (btnH + 8);
      if (mx >= bx && mx <= bx + btnW && my >= by && my <= by + btnH) {
        carIdx = i;
        tryStart();
        return;
      }
    }
  };

  function tryStart() {
    const unlocked = getDriftUnlocks().includes(carIdx);
    if (unlocked) {
      phase = 'play'; resetGame(); return;
    }
    const cost = DRIFT_CARS[carIdx].cost;
    if (getCoins() >= cost && spendCoins(cost)) {
      saveDriftUnlock(carIdx);
      phase = 'play'; resetGame();
    } else {
      buyMsg = `Need ${cost} coins (have ${getCoins()})`;
      buyMsgT = 120;
    }
  }

  // ── Update ──
  function update() {
    if (buyMsgT > 0) buyMsgT--;
    if (phase !== 'play') {
      if (phase === 'dead') fallTimer++;
      return;
    }

    const seg = segments[segI];
    if (!seg) { phase = 'dead'; return; }

    // Move forward
    speed = Math.min(3.0, 1.5 + score * 0.005);
    segProgress += speed;

    // Lateral drift
    const turnRate = DRIFT_CARS[carIdx].turn;
    if (holding) lateralOff += turnRate;
    else lateralOff -= turnRate;

    // Check fall
    if (Math.abs(lateralOff) > ROAD_W / 2) {
      phase = 'dead'; fallTimer = 0;
      if (score > bestScore) {
        bestScore = score;
        try { localStorage.setItem('pokechess_drift_best', String(bestScore)); } catch {}
      }
      return;
    }

    // Advance to next segment
    if (segProgress >= seg.len) {
      segProgress -= seg.len;
      segI++;
      score++;
      // Don't reset lateral offset — player must adjust for the turn!
    }

    // Calculate car world position
    const s = segments[segI];
    if (!s) { phase = 'dead'; return; }
    const p = getPerpR(s.dir);
    carX = s.sx + DX[s.dir] * segProgress + p.dx * lateralOff;
    carY = s.sy + DY[s.dir] * segProgress + p.dy * lateralOff;

    // Collect coins
    for (const c of trackCoins) {
      if (!c.collected && Math.hypot(carX - c.x, carY - c.y) < 16) {
        c.collected = true;
        coinCount++;
      }
    }
  }

  // ── Draw ──
  function draw() {
    // Background
    ctx.fillStyle = '#87CEEB'; // sky blue like Drift Boss
    ctx.fillRect(0, 0, W, H);
    // Gradient sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
    skyGrad.addColorStop(0, '#7EC8E3');
    skyGrad.addColorStop(0.5, '#B8E0F0');
    skyGrad.addColorStop(1, '#E8F4F8');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    if (phase === 'select') { drawSelectScreen(); return; }

    // Camera: center on car
    ctx.save();
    ctx.translate(W / 2 - carX, H / 2 - carY);

    const halfW = ROAD_W / 2;
    const viewDist = Math.max(W, H) * 0.8;

    // Draw segments
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i];
      const midX = s.sx + DX[s.dir] * s.len / 2;
      const midY = s.sy + DY[s.dir] * s.len / 2;
      if (Math.abs(midX - carX) > viewDist && Math.abs(midY - carY) > viewDist) continue;

      const p = getPerpR(s.dir);
      const ex = s.sx + DX[s.dir] * s.len;
      const ey = s.sy + DY[s.dir] * s.len;

      // Platform shadow
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath();
      ctx.moveTo(s.sx - p.dx * halfW + 3, s.sy - p.dy * halfW + 6);
      ctx.lineTo(ex - p.dx * halfW + 3, ey - p.dy * halfW + 6);
      ctx.lineTo(ex + p.dx * halfW + 3, ey + p.dy * halfW + 6);
      ctx.lineTo(s.sx + p.dx * halfW + 3, s.sy + p.dy * halfW + 6);
      ctx.fill();

      // Platform top (light gray like Drift Boss)
      ctx.fillStyle = i % 2 === 0 ? '#c8c8c8' : '#b8b8b8';
      ctx.beginPath();
      ctx.moveTo(s.sx - p.dx * halfW, s.sy - p.dy * halfW);
      ctx.lineTo(ex - p.dx * halfW, ey - p.dy * halfW);
      ctx.lineTo(ex + p.dx * halfW, ey + p.dy * halfW);
      ctx.lineTo(s.sx + p.dx * halfW, s.sy + p.dy * halfW);
      ctx.fill();

      // Platform side (darker)
      ctx.fillStyle = '#888';
      ctx.beginPath();
      ctx.moveTo(s.sx - p.dx * halfW, s.sy - p.dy * halfW);
      ctx.lineTo(ex - p.dx * halfW, ey - p.dy * halfW);
      ctx.lineTo(ex - p.dx * halfW + 3, ey - p.dy * halfW + 6);
      ctx.lineTo(s.sx - p.dx * halfW + 3, s.sy - p.dy * halfW + 6);
      ctx.fill();

      // Center line (dashed)
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([8, 12]);
      ctx.beginPath();
      ctx.moveTo(s.sx, s.sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.setLineDash([]);

      // Edge lines
      ctx.strokeStyle = 'rgba(0,0,0,0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(s.sx - p.dx * halfW, s.sy - p.dy * halfW);
      ctx.lineTo(ex - p.dx * halfW, ey - p.dy * halfW);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(s.sx + p.dx * halfW, s.sy + p.dy * halfW);
      ctx.lineTo(ex + p.dx * halfW, ey + p.dy * halfW);
      ctx.stroke();
    }

    // Coins
    for (const c of trackCoins) {
      if (c.collected) continue;
      if (Math.abs(c.x - carX) > viewDist) continue;
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(c.x, c.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#DAA520';
      ctx.beginPath();
      ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 6px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', c.x, c.y + 2);
    }

    // Car
    if (phase === 'play' || (phase === 'dead' && fallTimer < 40)) {
      const s = segments[segI] || segments[segments.length - 1];
      const carAngle = [(-Math.PI / 2), 0, (Math.PI / 2), Math.PI][s ? s.dir : 0];
      const sc = phase === 'dead' ? Math.max(0.1, 1 - fallTimer / 40) : 1;
      const alpha = phase === 'dead' ? Math.max(0, 1 - fallTimer / 30) : 1;
      ctx.globalAlpha = alpha;
      drawCar(ctx, carX, carY, carAngle, DRIFT_CARS[carIdx], sc);
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    // ── HUD ──
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(8, 8, 120, 50);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`📏 ${score}`, 16, 30);
    ctx.fillText(`🪙 ${coinCount}`, 16, 50);

    // Drift indicator
    ctx.fillStyle = holding ? '#f8d030' : 'rgba(255,255,255,0.4)';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(holding ? '→ DRIFT' : '← LEFT', W - 12, 28);
    ctx.textAlign = 'left';

    // Controls hint
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.font = '11px sans-serif';
    ctx.fillText('Hold Space/Click = Drift Right', 12, H - 10);

    // Game over overlay
    if (phase === 'dead' && fallTimer > 25) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, W, H);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText('GAME OVER', W / 2, H / 2 - 50);

      ctx.font = '18px sans-serif';
      ctx.fillText(`Score: ${score}  |  Coins: ${coinCount}`, W / 2, H / 2 - 15);

      ctx.fillStyle = '#FFD700';
      ctx.font = '14px sans-serif';
      ctx.fillText(`Best: ${bestScore}`, W / 2, H / 2 + 12);

      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '14px sans-serif';
      ctx.fillText('Click or press Space to continue', W / 2, H / 2 + 45);
      ctx.textAlign = 'left';
    }
  }

  // ── Select Screen ──
  function drawSelectScreen() {
    ctx.textAlign = 'center';

    // Title
    ctx.fillStyle = '#333';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('🏎️ PokéDrift', W / 2, 40);

    ctx.fillStyle = '#666';
    ctx.font = '13px sans-serif';
    ctx.fillText('Hold to drift right · Release to drift left', W / 2, 62);
    ctx.fillText('Stay on the road!', W / 2, 80);

    // Best score
    if (bestScore > 0) {
      ctx.fillStyle = '#DAA520';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(`🏆 Best: ${bestScore}`, W / 2, 105);
    }

    // Car buttons
    const btnW = 260, btnH = 42;
    const startY = 130;
    for (let i = 0; i < DRIFT_CARS.length; i++) {
      const c = DRIFT_CARS[i];
      const bx = (W - btnW) / 2;
      const by = startY + i * (btnH + 8);
      const sel = i === carIdx;
      const unlocked = getDriftUnlocks().includes(i);

      // Button bg
      ctx.fillStyle = sel ? (unlocked ? c.color + '33' : '#fef3c733') : '#f5f5f5';
      ctx.strokeStyle = sel ? c.color : '#ddd';
      ctx.lineWidth = sel ? 2 : 1;
      ctx.fillRect(bx, by, btnW, btnH);
      ctx.strokeRect(bx, by, btnW, btnH);

      // Draw mini car
      drawCar(ctx, bx + 30, by + btnH / 2, -Math.PI / 2, c, 0.6);

      // Name + info
      ctx.textAlign = 'left';
      ctx.fillStyle = unlocked ? '#333' : '#999';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(c.name, bx + 55, by + 18);

      ctx.fillStyle = unlocked ? '#888' : '#bbb';
      ctx.font = '11px sans-serif';
      const turnLabel = c.turn <= 1.8 ? 'Slow & Steady' : c.turn <= 2.3 ? 'Balanced' : c.turn <= 2.7 ? 'Quick' : 'Fast & Wild';
      ctx.fillText(`Turn: ${turnLabel}`, bx + 55, by + 34);

      // Price / status
      ctx.textAlign = 'right';
      if (unlocked) {
        ctx.fillStyle = '#4ade80';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText('✓ PLAY', bx + btnW - 10, by + 26);
      } else {
        ctx.fillStyle = '#DAA520';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(`🪙 ${c.cost}`, bx + btnW - 10, by + 26);
      }
    }

    // Coins display
    ctx.textAlign = 'center';
    ctx.fillStyle = '#555';
    ctx.font = '12px sans-serif';
    ctx.fillText(`Your coins: 🪙 ${getCoins()}`, W / 2, startY + DRIFT_CARS.length * (btnH + 8) + 15);

    // Buy error
    if (buyMsgT > 0 && buyMsg) {
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(buyMsg, W / 2, startY + DRIFT_CARS.length * (btnH + 8) + 38);
    }

    ctx.textAlign = 'left';
  }

  // ── Loop ──
  function loop() {
    update();
    draw();
    animId = requestAnimationFrame(loop);
  }
  loop();

  return () => {
    cancelAnimationFrame(animId);
    canvas.onkeydown = null;
    canvas.onkeyup = null;
    canvas.onclick = null;
  };
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
        <h2 class="minigame-title">🎮 Pokémon Arcade</h2>
        <button class="minigame-close">&times;</button>
      </div>
      <div class="minigame-tabs">
        <button class="minigame-tab minigame-tab--active" data-tab="bulbasaur">🌿 Bulbasaur</button>
        <button class="minigame-tab" data-tab="pikachu">⚡ Pikachu</button>
      </div>
      <div class="minigame-select" data-tab-content="bulbasaur">
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
      <div class="minigame-select" data-tab-content="pikachu" style="display:none">
        <button class="minigame-btn minigame-btn--pika" data-game="voltdash">
          <span class="minigame-btn__icon">⚡</span>
          <span class="minigame-btn__name">Volt Dash</span>
          <span class="minigame-btn__desc">Jump & collect bolts</span>
        </button>
        <button class="minigame-btn minigame-btn--pika" data-game="thundercatch">
          <span class="minigame-btn__icon">🎯</span>
          <span class="minigame-btn__name">Thunder Catch</span>
          <span class="minigame-btn__desc">Catch berries, dodge bombs</span>
        </button>
        <button class="minigame-btn minigame-btn--pika" data-game="drift">
          <span class="minigame-btn__icon">🏎️</span>
          <span class="minigame-btn__name">PokéDrift</span>
          <span class="minigame-btn__desc">Hold to drift, stay on the road</span>
        </button>
      </div>
      <div class="minigame-canvas-wrap" style="display:none">
        <button class="minigame-back">← Back</button>
        <canvas class="minigame-canvas" width="600" height="420"></canvas>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('minigame-overlay--show'));

  const panel = overlay.querySelector('.minigame-panel');
  const selectDivs = overlay.querySelectorAll('.minigame-select');
  const canvasWrap = overlay.querySelector('.minigame-canvas-wrap');
  const canvas = overlay.querySelector('.minigame-canvas');
  const backBtn = overlay.querySelector('.minigame-back');
  const tabsDiv = overlay.querySelector('.minigame-tabs');

  // Tab switching
  tabsDiv.addEventListener('click', (e) => {
    const tab = e.target.closest('.minigame-tab');
    if (!tab) return;
    tabsDiv.querySelectorAll('.minigame-tab').forEach(t => t.classList.remove('minigame-tab--active'));
    tab.classList.add('minigame-tab--active');
    selectDivs.forEach(d => d.style.display = d.dataset.tabContent === tab.dataset.tab ? '' : 'none');
  });

  function close() {
    if (activeCleanup) { activeCleanup(); activeCleanup = null; }
    overlay.classList.remove('minigame-overlay--show');
    setTimeout(() => overlay.remove(), 300);
  }

  function showSelect() {
    if (activeCleanup) { activeCleanup(); activeCleanup = null; }
    selectDivs.forEach(d => {
      const activeTab = tabsDiv.querySelector('.minigame-tab--active')?.dataset.tab;
      d.style.display = d.dataset.tabContent === activeTab ? '' : 'none';
    });
    tabsDiv.style.display = '';
    canvasWrap.style.display = 'none';
  }

  function startGame(type) {
    selectDivs.forEach(d => d.style.display = 'none');
    tabsDiv.style.display = 'none';
    canvasWrap.style.display = '';
    canvas.focus();
    if (type === 'jump') activeCleanup = startJumpGame(canvas);
    else if (type === 'shooter') activeCleanup = startShooterGame(canvas);
    else if (type === 'maze') activeCleanup = startMazeGame(canvas);
    else if (type === 'voltdash') activeCleanup = startVoltDashGame(canvas);
    else if (type === 'thundercatch') activeCleanup = startThunderCatchGame(canvas);
    else if (type === 'drift') activeCleanup = startDriftGame(canvas);
  }

  overlay.querySelector('.minigame-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  backBtn.addEventListener('click', showSelect);
  overlay.querySelectorAll('.minigame-btn').forEach(btn => {
    btn.addEventListener('click', () => startGame(btn.dataset.game));
  });
}
