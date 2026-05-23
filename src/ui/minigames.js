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
// Pseudo-3D road perspective. Camera behind car looking forward.
// Road curves left/right. Hold=drift right, release=drift left.

const DRIFT_CARS = [
  { name: 'Pikachu',    body: '#f8d030', roof: '#d4a800', trim: '#b89000', turn: 1.8, cost: 0 },
  { name: 'Bulbasaur',  body: '#4ade80', roof: '#16a34a', trim: '#0d7a32', turn: 1.4, cost: 30 },
  { name: 'Charmander', body: '#ef4444', roof: '#b91c1c', trim: '#7f1d1d', turn: 2.5, cost: 50 },
  { name: 'Squirtle',   body: '#38bdf8', roof: '#0284c7', trim: '#075985', turn: 2.1, cost: 40 },
];

function getDriftUnlocks() {
  try { return JSON.parse(localStorage.getItem('pokechess_drift_unlocks') || '[0]'); } catch { return [0]; }
}
function saveDriftUnlock(idx) {
  const u = getDriftUnlocks();
  if (!u.includes(idx)) { u.push(idx); localStorage.setItem('pokechess_drift_unlocks', JSON.stringify(u)); }
}

function startDriftGame(canvas) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  let phase = 'select';
  let carIdx = 0, animId;
  let score = 0, coinsGot = 0, bestScore = 0;
  let fallTimer = 0, holding = false;
  let buyMsg = '', buyMsgT = 0;

  // Pseudo-3D road params
  const HORIZON = H * 0.38;       // horizon Y line
  const ROAD_HALF = 0.4;          // road half-width as fraction of screen at bottom
  const CAM_HEIGHT = 1200;        // camera height
  const DRAW_DIST = 200;          // how many segments to draw

  // Road segments: each has curve, length
  let road = [];       // [{curve, len}]
  let pos = 0;         // distance traveled along road
  let playerX = 0;     // -1 to 1 (position on road, 0=center)
  let speed = 0;
  const MAX_SPEED = 180;
  const ACCEL = 0.8;

  // Collectibles on road
  let roadCoins = [];  // {z, lane}  z=distance along road, lane=-1..1
  let roadPowerups = []; // {z, type:'shield'|'boost'}
  let shield = 0;
  let boost = 0;

  try { bestScore = parseInt(localStorage.getItem('pokechess_drift_best') || '0'); } catch {}

  function buildRoad() {
    road = [];
    roadCoins = [];
    roadPowerups = [];
    // Start straight
    addRoad(50, 0);
    for (let i = 0; i < 80; i++) {
      // Random curves
      const curve = (Math.random() - 0.5) * 5;
      const len = 15 + Math.floor(Math.random() * 25);
      addRoad(len, curve);
      // Some straight between curves
      if (Math.random() < 0.3) addRoad(10, 0);
    }
    // Place coins and powerups
    let totalLen = 0;
    for (const seg of road) totalLen += seg.len;
    for (let z = 100; z < totalLen - 50; z += 12 + Math.floor(Math.random() * 20)) {
      if (Math.random() < 0.7) {
        roadCoins.push({ z, lane: (Math.random() - 0.5) * 1.2, got: false });
      }
    }
    for (let z = 300; z < totalLen - 100; z += 150 + Math.floor(Math.random() * 200)) {
      roadPowerups.push({ z, type: Math.random() < 0.5 ? 'shield' : 'boost', got: false });
    }
  }

  function addRoad(len, curve) {
    for (let i = 0; i < len; i++) {
      road.push({ curve, len: 1 });
    }
  }

  function resetGame() {
    buildRoad();
    pos = 0; playerX = 0; speed = 80;
    score = 0; coinsGot = 0; fallTimer = 0;
    shield = 0; boost = 0; holding = false;
  }

  function tryStart() {
    if (getDriftUnlocks().includes(carIdx)) { phase = 'play'; resetGame(); return; }
    const cost = DRIFT_CARS[carIdx].cost;
    if (getCoins() >= cost && spendCoins(cost)) {
      saveDriftUnlock(carIdx); phase = 'play'; resetGame();
    } else { buyMsg = `Need ${cost} coins (have ${getCoins()})`; buyMsgT = 120; }
  }

  // ── Input ──
  canvas.setAttribute('tabindex', '0'); canvas.focus();
  function press() {
    if (phase === 'select') return;
    if (phase === 'dead') { phase = 'select'; return; }
    holding = true;
  }
  function release() { holding = false; }
  canvas.addEventListener('mousedown', press);
  canvas.addEventListener('mouseup', release);
  canvas.addEventListener('touchstart', (e) => { e.preventDefault(); press(); }, { passive: false });
  canvas.addEventListener('touchend', (e) => { e.preventDefault(); release(); }, { passive: false });
  canvas.onkeydown = (e) => {
    if (e.code === 'Space') { e.preventDefault(); press(); }
    if (phase === 'select') {
      if (e.code === 'ArrowUp') carIdx = (carIdx - 1 + DRIFT_CARS.length) % DRIFT_CARS.length;
      if (e.code === 'ArrowDown') carIdx = (carIdx + 1) % DRIFT_CARS.length;
      if (e.code === 'Enter') tryStart();
    }
  };
  canvas.onkeyup = (e) => { if (e.code === 'Space') release(); };
  canvas.onclick = (e) => {
    if (phase !== 'select') return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width * W;
    const my = (e.clientY - rect.top) / rect.height * H;
    const btnW = 260, btnH = 50, startY = 135;
    for (let i = 0; i < DRIFT_CARS.length; i++) {
      const bx = (W - btnW) / 2, by = startY + i * (btnH + 8);
      if (mx >= bx && mx <= bx + btnW && my >= by && my <= by + btnH) {
        carIdx = i; tryStart(); return;
      }
    }
  };

  // ── Update ──
  function update() {
    if (buyMsgT > 0) buyMsgT--;
    if (phase !== 'play') { if (phase === 'dead') fallTimer++; return; }

    // Speed up gradually
    const baseMax = Math.min(MAX_SPEED, 80 + score * 0.3);
    const curMax = boost > 0 ? baseMax * 1.5 : baseMax;
    speed = Math.min(curMax, speed + ACCEL);
    if (boost > 0) boost--;

    pos += speed * 0.005;
    score = Math.floor(pos);

    // Drift
    const turnRate = DRIFT_CARS[carIdx].turn * 0.012;
    if (holding) playerX += turnRate;
    else playerX -= turnRate;

    // Road curvature pushes the player
    const segIdx = Math.floor(pos) % road.length;
    const curve = road[segIdx] ? road[segIdx].curve : 0;
    playerX += curve * speed * 0.000008;

    // Check if off road
    if (Math.abs(playerX) > 1.05) {
      if (shield > 0) {
        shield--;
        playerX = Math.sign(playerX) * 0.8;
      } else {
        phase = 'dead'; fallTimer = 0;
        if (score > bestScore) {
          bestScore = score;
          try { localStorage.setItem('pokechess_drift_best', String(bestScore)); } catch {}
        }
        return;
      }
    }

    // Collect coins
    for (const c of roadCoins) {
      if (c.got) continue;
      const dz = c.z - pos;
      if (dz > -1 && dz < 1 && Math.abs(c.lane - playerX) < 0.35) {
        c.got = true; coinsGot++;
      }
    }
    // Collect powerups
    for (const p of roadPowerups) {
      if (p.got) continue;
      const dz = p.z - pos;
      if (dz > -1 && dz < 1 && Math.abs(playerX) < 0.6) {
        p.got = true;
        if (p.type === 'shield') shield = Math.min(shield + 1, 3);
        else boost = 180;
      }
    }
  }

  // ── Draw ──
  function draw() {
    // Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
    sky.addColorStop(0, '#3a7bd5');
    sky.addColorStop(1, '#87CEEB');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, HORIZON);

    // Ground (far ground below horizon)
    ctx.fillStyle = '#5a8f3a';
    ctx.fillRect(0, HORIZON, W, H - HORIZON);

    if (phase === 'select') { drawSelect(); return; }

    // ── Pseudo-3D Road ──
    const baseIdx = Math.floor(pos);
    let cumCurve = 0;
    let x = 0; // accumulated horizontal shift
    let dx = 0; // rate of horizontal shift

    // Draw from horizon down to bottom (far to near)
    for (let y = HORIZON; y < H; y++) {
      // Perspective: how far away is this scan line
      const perspective = (y - HORIZON) / (H - HORIZON); // 0 at horizon, 1 at bottom
      if (perspective < 0.001) continue;
      const z = 1 / perspective; // depth

      // Which road segment are we looking at
      const segZ = baseIdx + z * 6;
      const segIdx = Math.floor(segZ) % road.length;
      const seg = road[segIdx];

      // Accumulate curve
      if (seg) dx += seg.curve * 0.015;
      x += dx * perspective;

      // Road width at this depth (wider near bottom)
      const roadW = ROAD_HALF * W * perspective;
      const roadCenter = W / 2 + x * W * 0.3 - playerX * roadW;

      const roadL = roadCenter - roadW;
      const roadR = roadCenter + roadW;

      // Grass (alternating stripes for speed effect)
      const grassDark = Math.floor(segZ) % 6 < 3;
      ctx.fillStyle = grassDark ? '#4a7f2a' : '#5a8f3a';
      ctx.fillRect(0, y, W, 1);

      // Road rumble strip (red/white at edges)
      const rumbleW = roadW * 0.08;
      const rumbleOn = Math.floor(segZ) % 4 < 2;
      ctx.fillStyle = rumbleOn ? '#e03030' : '#ffffff';
      ctx.fillRect(roadL - rumbleW, y, rumbleW, 1);
      ctx.fillRect(roadR, y, rumbleW, 1);

      // Road surface
      const roadDark = Math.floor(segZ) % 6 < 3;
      ctx.fillStyle = roadDark ? '#686868' : '#707070';
      ctx.fillRect(roadL, y, roadR - roadL, 1);

      // Road edge lines (white)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(roadL, y, 2, 1);
      ctx.fillRect(roadR - 2, y, 2, 1);

      // Center dashes
      if (Math.floor(segZ * 2) % 3 < 2) {
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillRect(roadCenter - 1, y, 2, 1);
      }
    }

    // ── Draw coins (in 3D space) ──
    for (const c of roadCoins) {
      if (c.got) continue;
      const dz = c.z - pos;
      if (dz < 0.5 || dz > 30) continue;
      const p = 1 / (dz * 0.17);
      if (p < 0.02) continue;
      const screenY = HORIZON + (H - HORIZON) * p;
      const roadW = ROAD_HALF * W * p;
      const dx2 = getScreenXShift(c.z);
      const screenX = W / 2 + dx2 * W * 0.3 + c.lane * roadW - playerX * roadW;
      const r = Math.max(3, 7 * p);
      ctx.fillStyle = '#FFD700';
      ctx.beginPath(); ctx.arc(screenX, screenY - r, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#B8860B';
      ctx.beginPath(); ctx.arc(screenX, screenY - r, r * 0.65, 0, Math.PI * 2); ctx.fill();
    }

    // ── Draw powerups ──
    for (const p2 of roadPowerups) {
      if (p2.got) continue;
      const dz = p2.z - pos;
      if (dz < 0.5 || dz > 30) continue;
      const p = 1 / (dz * 0.17);
      if (p < 0.02) continue;
      const screenY = HORIZON + (H - HORIZON) * p;
      const dx2 = getScreenXShift(p2.z);
      const roadW = ROAD_HALF * W * p;
      const screenX = W / 2 + dx2 * W * 0.3 - playerX * roadW;
      const sz = Math.max(8, 18 * p);
      ctx.font = `${sz}px serif`;
      ctx.textAlign = 'center';
      ctx.fillText(p2.type === 'shield' ? '🛡️' : '🚀', screenX, screenY - 2);
    }

    // ── Draw car ──
    if (phase === 'play' || (phase === 'dead' && fallTimer < 35)) {
      drawCar3D(phase === 'dead' ? Math.max(0.2, 1 - fallTimer / 35) : 1);
    }

    // Shield indicator
    if (shield > 0 && phase === 'play') {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(W / 2, H - 55, 35, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#38bdf8'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`×${shield}`, W / 2 + 30, H - 30);
    }
    // Boost indicator
    if (boost > 0 && phase === 'play') {
      ctx.fillStyle = '#f8d030'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('🚀 BOOST!', W / 2, HORIZON + 30);
    }

    // ── HUD ──
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(8, 8, 130, 55);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(`Score: ${score}`, 16, 30);
    ctx.fillText(`🪙 ${coinsGot}`, 16, 52);

    ctx.fillStyle = holding ? '#f8d030' : 'rgba(255,255,255,0.4)';
    ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(holding ? '→ DRIFT' : '← LEFT', W - 14, 28);
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '11px sans-serif';
    ctx.fillText('Hold SPACE / Click = Drift Right', 14, H - 8);

    // Game over
    if (phase === 'dead' && fallTimer > 25) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff'; ctx.font = 'bold 32px sans-serif';
      ctx.fillText('GAME OVER', W / 2, H / 2 - 55);
      ctx.font = '18px sans-serif';
      ctx.fillText(`Score: ${score}  ·  Coins: ${coinsGot}`, W / 2, H / 2 - 18);
      ctx.fillStyle = '#FFD700'; ctx.font = 'bold 16px sans-serif';
      ctx.fillText(`🏆 Best: ${bestScore}`, W / 2, H / 2 + 12);
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '14px sans-serif';
      ctx.fillText('Click or Space to continue', W / 2, H / 2 + 48);
      ctx.textAlign = 'left';
    }
  }

  function getScreenXShift(targetZ) {
    const baseIdx = Math.floor(pos);
    let xAcc = 0, dxAcc = 0;
    const steps = Math.floor(targetZ - pos);
    for (let i = 0; i < steps && i < 200; i++) {
      const si = (baseIdx + i) % road.length;
      const seg = road[si];
      if (seg) dxAcc += seg.curve * 0.015;
      const p = (i + 1) / (steps + 1);
      xAcc += dxAcc * p * 0.5;
    }
    return xAcc;
  }

  function drawCar3D(alpha) {
    ctx.globalAlpha = alpha;
    const cx = W / 2, cy = H - 45;
    const car = DRIFT_CARS[carIdx];

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(cx, cy + 20, 28, 8, 0, 0, Math.PI * 2); ctx.fill();

    // Car body (trapezoid shape seen from behind)
    ctx.fillStyle = car.body;
    ctx.beginPath();
    ctx.moveTo(cx - 26, cy + 16);  // bottom-left
    ctx.lineTo(cx - 22, cy - 8);   // top-left
    ctx.lineTo(cx + 22, cy - 8);   // top-right
    ctx.lineTo(cx + 26, cy + 16);  // bottom-right
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = car.trim; ctx.lineWidth = 1.5; ctx.stroke();

    // Roof
    ctx.fillStyle = car.roof;
    ctx.beginPath();
    ctx.moveTo(cx - 18, cy - 6);
    ctx.lineTo(cx - 14, cy - 22);
    ctx.lineTo(cx + 14, cy - 22);
    ctx.lineTo(cx + 18, cy - 6);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = car.trim; ctx.lineWidth = 1; ctx.stroke();

    // Rear window
    ctx.fillStyle = 'rgba(150, 200, 240, 0.7)';
    ctx.beginPath();
    ctx.moveTo(cx - 14, cy - 8);
    ctx.lineTo(cx - 12, cy - 19);
    ctx.lineTo(cx + 12, cy - 19);
    ctx.lineTo(cx + 14, cy - 8);
    ctx.closePath(); ctx.fill();

    // Wheels
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(cx - 30, cy + 2, 7, 14);
    ctx.fillRect(cx + 23, cy + 2, 7, 14);
    // Wheel rims
    ctx.fillStyle = '#888';
    ctx.fillRect(cx - 29, cy + 5, 5, 8);
    ctx.fillRect(cx + 24, cy + 5, 5, 8);

    // Taillights
    ctx.fillStyle = '#ff2020';
    ctx.fillRect(cx - 23, cy + 12, 8, 4);
    ctx.fillRect(cx + 15, cy + 12, 8, 4);
    // Taillight glow
    ctx.fillStyle = 'rgba(255, 50, 50, 0.3)';
    ctx.beginPath(); ctx.arc(cx - 19, cy + 18, 6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 19, cy + 18, 6, 0, Math.PI * 2); ctx.fill();

    // License plate
    ctx.fillStyle = '#fff';
    ctx.fillRect(cx - 8, cy + 13, 16, 5);
    ctx.fillStyle = '#333'; ctx.font = '4px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('DRIFT', cx, cy + 17);

    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  // ── Select Screen ──
  function drawSelect() {
    // Keep sky+grass background from draw()
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff'; ctx.font = 'bold 30px sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 4;
    ctx.fillText('🏎️ PokéDrift', W / 2, 38);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = '12px sans-serif';
    ctx.fillText('Hold to drift right  ·  Release to drift left', W / 2, 58);
    ctx.fillText('Stay on the road! Collect coins and power-ups!', W / 2, 74);

    if (bestScore > 0) {
      ctx.fillStyle = '#FFD700'; ctx.font = 'bold 13px sans-serif';
      ctx.fillText(`🏆 Best: ${bestScore}`, W / 2, 100);
    }

    ctx.fillStyle = '#fff'; ctx.font = 'bold 14px sans-serif';
    ctx.fillText('Choose Your Car', W / 2, 125);

    const btnW = 260, btnH = 50, startY = 135;
    for (let i = 0; i < DRIFT_CARS.length; i++) {
      const c = DRIFT_CARS[i];
      const bx = (W - btnW) / 2, by = startY + i * (btnH + 8);
      const sel = i === carIdx, unl = getDriftUnlocks().includes(i);

      ctx.fillStyle = sel ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.75)';
      ctx.fillRect(bx, by, btnW, btnH);
      ctx.strokeStyle = sel ? c.body : '#bbb';
      ctx.lineWidth = sel ? 3 : 1;
      ctx.strokeRect(bx, by, btnW, btnH);
      if (!unl) { ctx.fillStyle = 'rgba(180,180,180,0.3)'; ctx.fillRect(bx, by, btnW, btnH); }

      // Car color preview
      ctx.fillStyle = c.body;
      ctx.fillRect(bx + 10, by + 8, 34, 34);
      ctx.fillStyle = c.roof;
      ctx.fillRect(bx + 14, by + 15, 26, 19);
      ctx.fillStyle = 'rgba(150,200,240,0.5)';
      ctx.fillRect(bx + 16, by + 10, 22, 6);
      ctx.fillStyle = '#ff2020';
      ctx.fillRect(bx + 15, by + 34, 7, 3);
      ctx.fillRect(bx + 32, by + 34, 7, 3);

      ctx.textAlign = 'left';
      ctx.fillStyle = unl ? '#222' : '#888'; ctx.font = 'bold 15px sans-serif';
      ctx.fillText(c.name, bx + 54, by + 24);
      ctx.fillStyle = '#777'; ctx.font = '11px sans-serif';
      const td = c.turn <= 1.5 ? 'Steady & Safe' : c.turn <= 1.9 ? 'Balanced' : c.turn <= 2.3 ? 'Quick' : 'Wild & Fast';
      ctx.fillText(td, bx + 54, by + 42);

      ctx.textAlign = 'right';
      if (unl) {
        ctx.fillStyle = '#16a34a'; ctx.font = 'bold 13px sans-serif';
        ctx.fillText('▶ PLAY', bx + btnW - 12, by + 32);
      } else {
        ctx.fillStyle = '#B8860B'; ctx.font = 'bold 13px sans-serif';
        ctx.fillText(`🪙 ${c.cost}`, bx + btnW - 12, by + 32);
      }
    }

    ctx.textAlign = 'center';
    const infoY = startY + DRIFT_CARS.length * (btnH + 8) + 10;
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '12px sans-serif';
    ctx.fillText(`Balance: 🪙 ${getCoins()}   |   🛡️ Shield saves a fall   |   🚀 Speed boost`, W / 2, infoY);
    if (buyMsgT > 0) {
      ctx.fillStyle = '#ff6b6b'; ctx.font = 'bold 12px sans-serif';
      ctx.fillText(buyMsg, W / 2, infoY + 22);
    }
    ctx.textAlign = 'left';
  }

  function loop() { update(); draw(); animId = requestAnimationFrame(loop); }
  loop();
  return () => { cancelAnimationFrame(animId); canvas.onkeydown = null; canvas.onkeyup = null; canvas.onclick = null; };
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
