const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");

const W = canvas.width;
const H = canvas.height;

const FIELD = {
  x: 60,
  y: 40,
  w: W - 120,
  h: H - 80
};

const GOAL = {
  depth: 24,
  width: 180
};

const keys = {};
window.addEventListener("keydown", (e) => (keys[e.key.toLowerCase()] = true));
window.addEventListener("keyup", (e) => (keys[e.key.toLowerCase()] = false));

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function length(x, y) {
  return Math.hypot(x, y);
}

// --- Sons simples (WebAudio) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function beep(freq = 300, dur = 0.06, type = "square", gain = 0.04) {
  const t0 = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = gain;
  osc.connect(g).connect(audioCtx.destination);
  osc.start(t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.stop(t0 + dur);
}
window.addEventListener("click", () => audioCtx.resume(), { once: true });

// --- Entités ---
class Car {
  constructor(x, y, color, controls) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.angle = 0;
    this.r = 20;
    this.color = color;
    this.controls = controls;

    this.boost = 100;
  }

  update(dt) {
    const up = keys[this.controls.up];
    const down = keys[this.controls.down];
    const left = keys[this.controls.left];
    const right = keys[this.controls.right];
    const boosting = keys[this.controls.boost] && this.boost > 0;

    const turnSpeed = 3.6;
    if (left) this.angle -= turnSpeed * dt;
    if (right) this.angle += turnSpeed * dt;

    const forward = up ? 1 : 0;
    const backward = down ? -0.7 : 0;
    let accel = 410 * (forward + backward);

    if (boosting && forward > 0) {
      accel *= 1.85;
      this.boost = Math.max(0, this.boost - 32 * dt);
    } else {
      this.boost = Math.min(100, this.boost + 18 * dt);
    }

    this.vx += Math.cos(this.angle) * accel * dt;
    this.vy += Math.sin(this.angle) * accel * dt;

    // Friction
    this.vx *= 0.985;
    this.vy *= 0.985;

    // Vitesse max
    const maxSpeed = boosting ? 430 : 300;
    const sp = length(this.vx, this.vy);
    if (sp > maxSpeed) {
      this.vx = (this.vx / sp) * maxSpeed;
      this.vy = (this.vy / sp) * maxSpeed;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Collision bords terrain (sauf zone de but)
    const inGoalY =
      this.y > H / 2 - GOAL.width / 2 && this.y < H / 2 + GOAL.width / 2;

    // Gauche
    if (this.x - this.r < FIELD.x - (inGoalY ? GOAL.depth : 0)) {
      this.x = FIELD.x - (inGoalY ? GOAL.depth : 0) + this.r;
      this.vx *= -0.45;
      beep(180, 0.03, "triangle", 0.02);
    }
    // Droite
    if (this.x + this.r > FIELD.x + FIELD.w + (inGoalY ? GOAL.depth : 0)) {
      this.x = FIELD.x + FIELD.w + (inGoalY ? GOAL.depth : 0) - this.r;
      this.vx *= -0.45;
      beep(180, 0.03, "triangle", 0.02);
    }
    // Haut/Bas
    if (this.y - this.r < FIELD.y) {
      this.y = FIELD.y + this.r;
      this.vy *= -0.45;
      beep(180, 0.03, "triangle", 0.02);
    }
    if (this.y + this.r > FIELD.y + FIELD.h) {
      this.y = FIELD.y + FIELD.h - this.r;
      this.vy *= -0.45;
      beep(180, 0.03, "triangle", 0.02);
    }
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    // ombre
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(-18, -11, 36, 22);

    // corps
    ctx.fillStyle = this.color;
    ctx.fillRect(-20, -12, 40, 24);

    // pare-brise
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillRect(2, -8, 12, 16);

    // roues
    ctx.fillStyle = "#111827";
    ctx.fillRect(-18, -14, 8, 4);
    ctx.fillRect(-18, 10, 8, 4);
    ctx.fillRect(10, -14, 8, 4);
    ctx.fillRect(10, 10, 8, 4);

    ctx.restore();

    // jauge boost
    const bw = 72;
    const bh = 8;
    const bx = this.x - bw / 2;
    const by = this.y - 34;
    ctx.fillStyle = "rgba(15,23,42,0.8)";
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = this.color;
    ctx.fillRect(bx, by, (bw * this.boost) / 100, bh);
  }
}

class Ball {
  constructor() {
    this.r = 16;
    this.reset();
  }

  reset() {
    this.x = W / 2;
    this.y = H / 2;
    this.vx = (Math.random() * 2 - 1) * 80;
    this.vy = (Math.random() * 2 - 1) * 80;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    this.vx *= 0.997;
    this.vy *= 0.997;

    const inGoalY =
      this.y > H / 2 - GOAL.width / 2 && this.y < H / 2 + GOAL.width / 2;

    // Murs verticaux hors buts
    if (!inGoalY) {
      if (this.x - this.r < FIELD.x) {
        this.x = FIELD.x + this.r;
        this.vx *= -0.9;
        beep(220, 0.04, "sine", 0.03);
      }
      if (this.x + this.r > FIELD.x + FIELD.w) {
        this.x = FIELD.x + FIELD.w - this.r;
        this.vx *= -0.9;
        beep(220, 0.04, "sine", 0.03);
      }
    }

    if (this.y - this.r < FIELD.y) {
      this.y = FIELD.y + this.r;
      this.vy *= -0.9;
      beep(220, 0.04, "sine", 0.03);
    }
    if (this.y + this.r > FIELD.y + FIELD.h) {
      this.y = FIELD.y + FIELD.h - this.r;
      this.vy *= -0.9;
      beep(220, 0.04, "sine", 0.03);
    }
  }

  draw() {
    const grad = ctx.createRadialGradient(this.x - 5, this.y - 5, 3, this.x, this.y, this.r);
    grad.addColorStop(0, "#fff");
    grad.addColorStop(1, "#cbd5e1");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.stroke();
  }
}

const car1 = new Car(FIELD.x + 120, H / 2, "#38bdf8", {
  up: "z",
  down: "s",
  left: "q",
  right: "d",
  boost: "shift"
});

const car2 = new Car(FIELD.x + FIELD.w - 120, H / 2, "#f97316", {
  up: "arrowup",
  down: "arrowdown",
  left: "arrowleft",
  right: "arrowright",
  boost: "control"
});

const ball = new Ball();

let scoreLeft = 0;
let scoreRight = 0;

function resolveCarBall(car, ball) {
  const dx = ball.x - car.x;
  const dy = ball.y - car.y;
  const dist = Math.hypot(dx, dy);
  const minDist = car.r + ball.r;

  if (dist < minDist && dist > 0.0001) {
    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = minDist - dist;

    ball.x += nx * overlap;
    ball.y += ny * overlap;

    // impulsion liée vitesse voiture
    const impact = (car.vx * nx + car.vy * ny);
    ball.vx += nx * (impact * 1.15 + 130);
    ball.vy += ny * (impact * 1.15 + 130);

    beep(420, 0.05, "square", 0.04);
  }
}

function checkGoal() {
  const goalTop = H / 2 - GOAL.width / 2;
  const goalBottom = H / 2 + GOAL.width / 2;

  if (ball.y > goalTop && ball.y < goalBottom) {
    // but gauche
    if (ball.x < FIELD.x - GOAL.depth + 4) {
      scoreRight++;
      onGoal();
    }
    // but droite
    if (ball.x > FIELD.x + FIELD.w + GOAL.depth - 4) {
      scoreLeft++;
      onGoal();
    }
  }
}

function onGoal() {
  scoreEl.textContent = `${scoreLeft} - ${scoreRight}`;
  beep(600, 0.08, "sawtooth", 0.05);
  setTimeout(() => beep(750, 0.08, "sawtooth", 0.05), 90);

  car1.x = FIELD.x + 120; car1.y = H / 2; car1.vx = car1.vy = 0; car1.angle = 0;
  car2.x = FIELD.x + FIELD.w - 120; car2.y = H / 2; car2.vx = car2.vy = 0; car2.angle = Math.PI;
  ball.reset();
}

function drawField() {
  // fond gazon "texturé"
  ctx.fillStyle = "#166534";
  ctx.fillRect(FIELD.x, FIELD.y, FIELD.w, FIELD.h);

  // bandes
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)";
    ctx.fillRect(FIELD.x + (FIELD.w / 12) * i, FIELD.y, FIELD.w / 12, FIELD.h);
  }

  // ligne médiane + cercle central
  ctx.strokeStyle = "rgba(255,255,255,0.65)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(W / 2, FIELD.y);
  ctx.lineTo(W / 2, FIELD.y + FIELD.h);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(W / 2, H / 2, 80, 0, Math.PI * 2);
  ctx.stroke();

  // zones de but
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 2;
  ctx.strokeRect(FIELD.x - GOAL.depth, H / 2 - GOAL.width / 2, GOAL.depth, GOAL.width);
  ctx.strokeRect(FIELD.x + FIELD.w, H / 2 - GOAL.width / 2, GOAL.depth, GOAL.width);
}

let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.03);
  last = now;

  ctx.clearRect(0, 0, W, H);
  drawField();

  car1.update(dt);
  car2.update(dt);
  ball.update(dt);

  resolveCarBall(car1, ball);
  resolveCarBall(car2, ball);

  checkGoal();

  ball.draw();
  car1.draw();
  car2.draw();

  requestAnimationFrame(loop);
}

car2.angle = Math.PI;
requestAnimationFrame(loop);