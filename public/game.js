const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const comboEl = document.getElementById('combo');
const livesEl = document.getElementById('lives');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayText = document.getElementById('overlay-text');
const overlayHint = document.getElementById('overlay-hint');
const startBtn = document.getElementById('start');
const menuBtn = document.getElementById('menu');

const MENU_COPY = {
  title: 'ORBITAL',
  text: 'Bouge la souris — ta lune orbite autour de la planète.<br/>Dévie tout ce qui vient vers elle.',
  start: 'Insérer une pièce',
  hint: 'clique sur insérer · espace pour démarrer',
};

const PLANET_RADIUS = 30;
const MOON_RADIUS = 14;
const MOON_ORBIT = 115;
const MAX_LIVES = 3;
const BEST_KEY = 'orbital.best';

const PALETTE = {
  magenta: '#ff2a6d',
  pink: '#ff6ec7',
  cyan: '#00f0ff',
  yellow: '#fff700',
  orange: '#ff8a00',
  violet: '#b537f2',
  white: '#f7e8ff',
};

function readBest() {
  try {
    const n = Number(localStorage.getItem(BEST_KEY));
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

function writeBest(value) {
  try {
    localStorage.setItem(BEST_KEY, String(value));
  } catch {
    /* localStorage may be blocked; ignore */
  }
}

const state = {
  width: 0,
  height: 0,
  cx: 0,
  cy: 0,
  horizonY: 0,
  mouseX: 0,
  mouseY: 0,
  moonAngle: 0,
  asteroids: [],
  particles: [],
  stars: [],
  score: 0,
  best: readBest(),
  mouseInitialized: false,
  combo: 1,
  comboTimer: 0,
  lives: MAX_LIVES,
  spawnTimer: 0,
  elapsed: 0,
  shake: 0,
  running: false,
  lastTime: 0,
};

function resize() {
  const dpr = window.devicePixelRatio || 1;
  state.width = window.innerWidth;
  state.height = window.innerHeight;
  canvas.width = state.width * dpr;
  canvas.height = state.height * dpr;
  canvas.style.width = state.width + 'px';
  canvas.style.height = state.height + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  state.cx = state.width / 2;
  state.cy = state.height / 2;
  state.horizonY = state.cy + 70;
  if (!state.mouseInitialized) {
    state.mouseX = state.cx + 120;
    state.mouseY = state.cy;
  }
  seedStars();
}

function seedStars() {
  state.stars.length = 0;
  const count = Math.round((state.width * state.horizonY) / 6500);
  for (let i = 0; i < count; i++) {
    state.stars.push({
      x: Math.random() * state.width,
      y: Math.random() * state.horizonY,
      r: Math.random() * 1.3 + 0.2,
      tw: Math.random() * Math.PI * 2,
    });
  }
}

function spawnAsteroid() {
  const angle = Math.random() * Math.PI * 2;
  const distance = Math.hypot(state.width, state.height) / 2 + 60;
  const x = state.cx + Math.cos(angle) * distance;
  const y = state.cy + Math.sin(angle) * distance;
  const speed = 95 + Math.min(state.elapsed * 2.6, 220);
  const dx = state.cx - x;
  const dy = state.cy - y;
  const d = Math.hypot(dx, dy);
  state.asteroids.push({
    x, y,
    vx: (dx / d) * speed,
    vy: (dy / d) * speed,
    radius: 11 + Math.random() * 9,
    rotation: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 2.6,
    sides: 3 + Math.floor(Math.random() * 3),
  });
}

function burst(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 100 + Math.random() * 240;
    state.particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 0.5 + Math.random() * 0.5,
      maxLife: 1,
      color,
    });
  }
}

function updateHud() {
  scoreEl.textContent = state.score.toLocaleString('fr-FR');
  bestEl.textContent = state.best.toLocaleString('fr-FR');
  comboEl.textContent = `×${state.combo}`;
  livesEl.innerHTML = '';
  for (let i = 0; i < MAX_LIVES; i++) {
    const pip = document.createElement('div');
    pip.className = 'pip' + (i >= state.lives ? ' lost' : '');
    livesEl.appendChild(pip);
  }
}

function reset() {
  state.asteroids.length = 0;
  state.particles.length = 0;
  state.score = 0;
  state.combo = 1;
  state.comboTimer = 0;
  state.lives = MAX_LIVES;
  state.elapsed = 0;
  state.spawnTimer = 0;
  state.shake = 0;
  updateHud();
}

function start() {
  if (state.running) return;
  reset();
  overlay.classList.remove('visible');
  state.running = true;
  state.lastTime = performance.now();
}

function showMenu() {
  state.running = false;
  reset();
  overlayTitle.textContent = MENU_COPY.title;
  overlayText.innerHTML = MENU_COPY.text;
  startBtn.textContent = MENU_COPY.start;
  overlayHint.textContent = MENU_COPY.hint;
  menuBtn.hidden = true;
  overlay.classList.add('visible');
}

function gameOver() {
  state.running = false;
  if (state.score > state.best) {
    state.best = state.score;
    writeBest(state.best);
  }
  overlayTitle.textContent = 'FIN DE PARTIE';
  overlayText.innerHTML = `Score <strong>${state.score.toLocaleString('fr-FR')}</strong> · Record <strong>${state.best.toLocaleString('fr-FR')}</strong>`;
  startBtn.textContent = 'Recommencer';
  overlayHint.textContent = 'espace pour recommencer · m pour le menu';
  menuBtn.hidden = false;
  overlay.classList.add('visible');
  updateHud();
}

function update(dt) {
  state.elapsed += dt;
  state.spawnTimer += dt;
  const spawnInterval = Math.max(0.3, 1.15 - state.elapsed * 0.013);
  while (state.spawnTimer > spawnInterval) {
    state.spawnTimer -= spawnInterval;
    spawnAsteroid();
  }

  const target = Math.atan2(state.mouseY - state.cy, state.mouseX - state.cx);
  let diff = target - state.moonAngle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  state.moonAngle += diff * Math.min(1, dt * 16);

  const moonX = state.cx + Math.cos(state.moonAngle) * MOON_ORBIT;
  const moonY = state.cy + Math.sin(state.moonAngle) * MOON_ORBIT;

  for (let i = state.asteroids.length - 1; i >= 0; i--) {
    const a = state.asteroids[i];
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    a.rotation += a.spin * dt;

    if (Math.hypot(a.x - moonX, a.y - moonY) < a.radius + MOON_RADIUS) {
      state.score += 10 * state.combo;
      state.combo = Math.min(state.combo + 1, 99);
      state.comboTimer = 1.6;
      state.shake = Math.min(state.shake + 5, 16);
      burst(a.x, a.y, PALETTE.cyan, 18);
      state.asteroids.splice(i, 1);
      updateHud();
      continue;
    }

    if (Math.hypot(a.x - state.cx, a.y - state.cy) < a.radius + PLANET_RADIUS) {
      state.lives--;
      state.combo = 1;
      state.shake = 28;
      burst(a.x, a.y, PALETTE.magenta, 30);
      state.asteroids.splice(i, 1);
      updateHud();
      if (state.lives <= 0) {
        gameOver();
        return;
      }
    }
  }

  if (state.comboTimer > 0) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0 && state.combo !== 1) {
      state.combo = 1;
      updateHud();
    }
  }

  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.94;
    p.vy *= 0.94;
    p.life -= dt;
    if (p.life <= 0) state.particles.splice(i, 1);
  }

  state.shake = Math.max(0, state.shake - dt * 55);
}

function drawSky() {
  const sky = ctx.createLinearGradient(0, 0, 0, state.horizonY);
  sky.addColorStop(0, '#06010f');
  sky.addColorStop(0.55, '#250a4a');
  sky.addColorStop(1, '#6b1466');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, state.width, state.horizonY);

  const ground = ctx.createLinearGradient(0, state.horizonY, 0, state.height);
  ground.addColorStop(0, '#1a0033');
  ground.addColorStop(1, '#02000a');
  ctx.fillStyle = ground;
  ctx.fillRect(0, state.horizonY, state.width, state.height - state.horizonY);
}

function drawStars(now) {
  const t = now / 1000;
  for (const s of state.stars) {
    const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 1.6 + s.tw));
    ctx.globalAlpha = a;
    ctx.fillStyle = PALETTE.white;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawSun() {
  const sunR = Math.min(220, state.width * 0.22);
  const sunY = state.horizonY;
  const grad = ctx.createLinearGradient(0, sunY - sunR, 0, sunY);
  grad.addColorStop(0, PALETTE.yellow);
  grad.addColorStop(0.4, PALETTE.orange);
  grad.addColorStop(0.75, PALETTE.magenta);
  grad.addColorStop(1, PALETTE.violet);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, state.width, state.horizonY);
  ctx.clip();

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(state.cx, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#06010f';
  const lower = sunY;
  const upper = sunY - sunR;
  const span = lower - upper;
  for (let i = 0; i < 6; i++) {
    const ty = i / 6;
    const h = Math.max(2, (span / 28) * (1 + ty * 5));
    const y = upper + span * (0.45 + ty * 0.55);
    ctx.fillRect(state.cx - sunR, y, sunR * 2, h);
  }
  ctx.restore();

  const glow = ctx.createRadialGradient(state.cx, sunY, 0, state.cx, sunY, sunR * 2.2);
  glow.addColorStop(0, 'rgba(255, 42, 109, 0.35)');
  glow.addColorStop(0.5, 'rgba(181, 55, 242, 0.12)');
  glow.addColorStop(1, 'rgba(181, 55, 242, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, state.width, state.height);
}

function drawGrid(now) {
  const horizon = state.horizonY;
  const groundH = state.height - horizon;
  const reach = groundH;

  ctx.strokeStyle = 'rgba(255, 42, 109, 0.85)';
  ctx.lineWidth = 1.2;

  const scroll = (now / 1700) % 1;
  const rows = 16;
  for (let i = 0; i < rows; i++) {
    const k = (i + scroll) / rows;
    const t = k * k;
    const y = horizon + reach * t;
    if (y > state.height) continue;
    const alpha = 0.25 + 0.7 * k;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(state.width, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const cols = 26;
  const colSpan = state.width;
  for (let i = -cols; i <= cols; i++) {
    if (i === 0) continue;
    const endX = state.cx + (i * colSpan) / 14;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(state.cx, horizon);
    ctx.lineTo(endX, state.height);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.shadowColor = PALETTE.magenta;
  ctx.shadowBlur = 24;
  ctx.strokeStyle = PALETTE.magenta;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  ctx.lineTo(state.width, horizon);
  ctx.stroke();
  ctx.restore();
}

function drawPlanet() {
  const glow = ctx.createRadialGradient(state.cx, state.cy, 0, state.cx, state.cy, PLANET_RADIUS * 4);
  glow.addColorStop(0, 'rgba(255, 42, 109, 0.55)');
  glow.addColorStop(0.5, 'rgba(255, 110, 199, 0.18)');
  glow.addColorStop(1, 'rgba(255, 42, 109, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(state.cx, state.cy, PLANET_RADIUS * 4, 0, Math.PI * 2);
  ctx.fill();

  const body = ctx.createRadialGradient(
    state.cx - PLANET_RADIUS * 0.4,
    state.cy - PLANET_RADIUS * 0.4,
    PLANET_RADIUS * 0.2,
    state.cx,
    state.cy,
    PLANET_RADIUS,
  );
  body.addColorStop(0, PALETTE.pink);
  body.addColorStop(1, PALETTE.magenta);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(state.cx, state.cy, PLANET_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.55)';
  ctx.lineWidth = 1.5;
  ctx.shadowColor = PALETTE.cyan;
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.ellipse(state.cx, state.cy, PLANET_RADIUS * 1.6, PLANET_RADIUS * 0.45, -0.35, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawOrbit() {
  ctx.save();
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.18)';
  ctx.setLineDash([4, 6]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(state.cx, state.cy, MOON_ORBIT, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawMoon() {
  const moonX = state.cx + Math.cos(state.moonAngle) * MOON_ORBIT;
  const moonY = state.cy + Math.sin(state.moonAngle) * MOON_ORBIT;

  const glow = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, MOON_RADIUS * 4.5);
  glow.addColorStop(0, 'rgba(0, 240, 255, 0.75)');
  glow.addColorStop(0.5, 'rgba(0, 240, 255, 0.2)');
  glow.addColorStop(1, 'rgba(0, 240, 255, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(moonX, moonY, MOON_RADIUS * 4.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.shadowColor = PALETTE.cyan;
  ctx.shadowBlur = 22;
  ctx.fillStyle = PALETTE.cyan;
  ctx.beginPath();
  ctx.arc(moonX, moonY, MOON_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = '#fff';
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(moonX - MOON_RADIUS * 0.35, moonY - MOON_RADIUS * 0.35, MOON_RADIUS * 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawAsteroids() {
  for (const a of state.asteroids) {
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.rotation);
    ctx.shadowColor = PALETTE.cyan;
    ctx.shadowBlur = 14;
    ctx.strokeStyle = '#fff';
    ctx.fillStyle = 'rgba(0, 240, 255, 0.08)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    const sides = a.sides;
    for (let i = 0; i <= sides; i++) {
      const ang = (i / sides) * Math.PI * 2;
      const r = a.radius * (0.85 + 0.18 * Math.sin(i * 1.7));
      const px = Math.cos(ang) * r;
      const py = Math.sin(ang) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function drawParticles() {
  for (const p of state.particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.8 * alpha + 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function render(now) {
  drawSky();
  drawStars(now);
  drawSun();
  drawGrid(now);

  const shakeX = (Math.random() - 0.5) * state.shake;
  const shakeY = (Math.random() - 0.5) * state.shake;
  ctx.save();
  ctx.translate(shakeX, shakeY);

  drawOrbit();
  drawPlanet();
  drawAsteroids();
  drawMoon();
  drawParticles();

  ctx.restore();
}

function frame(now) {
  const dt = Math.min(0.05, (now - state.lastTime) / 1000);
  state.lastTime = now;
  if (state.running) update(dt);
  render(now);
  requestAnimationFrame(frame);
}

window.addEventListener('resize', resize);
window.addEventListener('mousemove', (e) => {
  state.mouseX = e.clientX;
  state.mouseY = e.clientY;
  state.mouseInitialized = true;
});
window.addEventListener('keydown', (e) => {
  if (state.running) return;
  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault();
    start();
  } else if (e.code === 'KeyM' && !menuBtn.hidden) {
    e.preventDefault();
    showMenu();
  }
});

startBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  start();
});
menuBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  showMenu();
});
overlay.addEventListener('click', () => {
  if (menuBtn.hidden) start();
});

resize();
updateHud();
requestAnimationFrame((t) => {
  state.lastTime = t;
  frame(t);
});
