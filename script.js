const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const timerEl = document.getElementById('timer');
const modeEl = document.getElementById('mode');
const restartBtn = document.getElementById('restart');

const W = canvas.width, H = canvas.height;
const FIELD = { x: -520, z: -300, w: 1040, h: 600 };
const GOAL_W = 220;
const keys = {};
window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

const camera = { y: 680, z: 760, fov: 730 };
function project(x,y,z){
  const dz = (z + camera.z);
  const s = camera.fov / Math.max(80, dz);
  return { x: W/2 + x*s, y: H*0.82 - (y + camera.y)*s, s };
}

function clamp(v,a,b){ return Math.max(a, Math.min(b,v)); }
function dist(a,b){ return Math.hypot(a.x-b.x, a.z-b.z); }

class Car {
  constructor(x,z,color,isAI=false){
    this.x=x; this.z=z; this.vx=0; this.vz=0; this.a=0; this.r=24;
    this.color=color; this.boost=100; this.isAI=isAI;
  }
  control(dt,target){
    let up=false, down=false, left=false, right=false, boosting=false;
    if(this.isAI){
      const tx = target.x - this.x, tz = target.z - this.z;
      const desired = Math.atan2(tz,tx);
      let d = desired - this.a; while(d>Math.PI)d-=Math.PI*2; while(d<-Math.PI)d+=Math.PI*2;
      left = d < -0.08; right = d > 0.08; up = true;
      boosting = Math.abs(d)<0.35 && this.boost>20;
    } else {
      up = keys['z'] || keys['arrowup'];
      down = keys['s'] || keys['arrowdown'];
      left = keys['q'] || keys['arrowleft'];
      right = keys['d'] || keys['arrowright'];
      boosting = keys['shift'] && this.boost>0;
    }
    if(left) this.a -= 3.4*dt;
    if(right) this.a += 3.4*dt;

    let acc = ((up?1:0) + (down?-0.65:0)) * 470;
    if(boosting && up){ acc *= 1.8; this.boost = Math.max(0, this.boost - 36*dt);} else this.boost = Math.min(100, this.boost + 16*dt);

    this.vx += Math.cos(this.a) * acc * dt;
    this.vz += Math.sin(this.a) * acc * dt;
    this.vx *= 0.985; this.vz *= 0.985;
    const max = boosting ? 470 : 320;
    const sp = Math.hypot(this.vx, this.vz);
    if(sp>max){ this.vx = this.vx/sp*max; this.vz = this.vz/sp*max; }

    this.x += this.vx*dt; this.z += this.vz*dt;
    this.x = clamp(this.x, FIELD.x+this.r, FIELD.x+FIELD.w-this.r);
    this.z = clamp(this.z, FIELD.z+this.r, FIELD.z+FIELD.h-this.r);
  }
  draw(){
    const p = project(this.x, 0, this.z);
    const w = 70*p.s*0.12, h=42*p.s*0.12;
    ctx.save();
    ctx.translate(p.x,p.y);
    ctx.rotate(this.a+Math.PI/2);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(-w/2+3, -h/2+3, w,h);
    ctx.fillStyle = this.color; ctx.fillRect(-w/2,-h/2,w,h);
    ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(w*0.05,-h*0.35,w*0.35,h*0.7);
    ctx.restore();
  }
}

class Ball {
  constructor(){ this.r=18; this.reset(); }
  reset(){ this.x=0; this.z=0; this.vx=(Math.random()*2-1)*120; this.vz=(Math.random()*2-1)*120; }
  update(dt, chaos=false){
    if(chaos){ this.vx += (Math.random()*2-1)*40*dt; this.vz += (Math.random()*2-1)*40*dt; }
    this.x += this.vx*dt; this.z += this.vz*dt;
    this.vx *= 0.995; this.vz *= 0.995;
    if(this.x-this.r < FIELD.x){ this.x = FIELD.x+this.r; this.vx *= -0.9; }
    if(this.x+this.r > FIELD.x+FIELD.w){ this.x = FIELD.x+FIELD.w-this.r; this.vx *= -0.9; }
    if(this.z-this.r < FIELD.z){ this.z = FIELD.z+this.r; this.vz *= -0.9; }
    if(this.z+this.r > FIELD.z+FIELD.h){ this.z = FIELD.z+FIELD.h-this.r; this.vz *= -0.9; }
  }
  draw(){
    const p = project(this.x, 14, this.z);
    const r = Math.max(5, this.r*p.s*0.12);
    const g = ctx.createRadialGradient(p.x-r*0.4,p.y-r*0.4,2,p.x,p.y,r);
    g.addColorStop(0,'#fff'); g.addColorStop(1,'#cbd5e1');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(p.x,p.y,r,0,Math.PI*2); ctx.fill();
  }
}

let player, ai, ball, blue=0, orange=0, mode='duel', timeLeft=60;
function init(){
  player = new Car(-240,0,'#38bdf8',false);
  ai = new Car(240,0,'#f97316',true);
  ai.a = Math.PI;
  ball = new Ball();
}

function resetMatch(){ blue=0; orange=0; timeLeft=60; init(); updateHUD(); }
modeEl.addEventListener('change', ()=>{ mode=modeEl.value; resetMatch(); });
restartBtn.addEventListener('click', resetMatch);

function carBall(car){
  const d = dist(car,ball), min = car.r+ball.r;
  if(d<min){
    const nx=(ball.x-car.x)/d, nz=(ball.z-car.z)/d, ov=min-d;
    ball.x += nx*ov; ball.z += nz*ov;
    const imp = car.vx*nx + car.vz*nz;
    ball.vx += nx*(imp*1.1 + 170); ball.vz += nz*(imp*1.1 + 170);
  }
}

function goals(){
  const inGate = ball.z > -GOAL_W/2 && ball.z < GOAL_W/2;
  if(inGate && ball.x < FIELD.x + 8){ orange++; afterGoal(); }
  if(inGate && ball.x > FIELD.x + FIELD.w - 8){ blue++; afterGoal(); }
}
function afterGoal(){ player.x=-240; player.z=0; player.vx=player.vz=0; ai.x=240; ai.z=0; ai.vx=ai.vz=0; ball.reset(); updateHUD(); }
function updateHUD(){ scoreEl.textContent = `Bleu ${blue} - ${orange} Orange`; }

function drawField(){
  ctx.clearRect(0,0,W,H);
  const corners = [
    project(FIELD.x,0,FIELD.z), project(FIELD.x+FIELD.w,0,FIELD.z),
    project(FIELD.x+FIELD.w,0,FIELD.z+FIELD.h), project(FIELD.x,0,FIELD.z+FIELD.h)
  ];
  ctx.fillStyle='#14532d';
  ctx.beginPath(); ctx.moveTo(corners[0].x,corners[0].y);
  for(let i=1;i<corners.length;i++) ctx.lineTo(corners[i].x,corners[i].y);
  ctx.closePath(); ctx.fill();

  for(let i=0;i<10;i++){
    const x0 = FIELD.x + i*(FIELD.w/10), x1=x0+FIELD.w/10;
    const a=project(x0,0,FIELD.z), b=project(x1,0,FIELD.z), c=project(x1,0,FIELD.z+FIELD.h), d=project(x0,0,FIELD.z+FIELD.h);
    ctx.fillStyle = i%2 ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.05)';
    ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.lineTo(c.x,c.y); ctx.lineTo(d.x,d.y); ctx.closePath(); ctx.fill();
  }

  const m0=project(0,0,FIELD.z), m1=project(0,0,FIELD.z+FIELD.h);
  ctx.strokeStyle='rgba(255,255,255,.7)'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(m0.x,m0.y); ctx.lineTo(m1.x,m1.y); ctx.stroke();
}

let last=performance.now(); init();
function loop(now){
  const dt=Math.min((now-last)/1000,0.03); last=now;
  if(mode==='time'){ timeLeft -= dt; if(timeLeft<=0){ timeLeft=0; } }
  timerEl.textContent = mode==='time' ? `Temps: ${timeLeft.toFixed(1)}s` : '';

  const chaos = mode==='chaos';
  if(!(mode==='time' && timeLeft<=0)){
    player.control(dt, ball);
    ai.control(dt, ball);
    ball.update(dt, chaos);
    carBall(player); carBall(ai);
    goals();
  }

  drawField();
  [ball, player, ai].sort((a,b)=>a.z-b.z).forEach(o=>o.draw());
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
