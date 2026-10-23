import { makeCanvas, toTexture } from './tex.js';
import { mulberry32 } from './util.js';

function glow(ctx, x, y, r, col) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, col);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

// 窗外夜空：星河 + 大月亮。月亮位于画面右上，透过拱窗刚好落在视野中央偏右
export function skyTexture() {
  const rng = mulberry32(77);
  const W = 2048, H = 1536;
  const [c, ctx] = makeCanvas(W, H);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#040818');
  g.addColorStop(0.4, '#0b1d4c');
  g.addColorStop(0.68, '#1b4b7a');
  g.addColorStop(0.86, '#4a8aa0');
  g.addColorStop(1, '#e9c58c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  glow(ctx, 560, 420, 520, 'rgba(96,64,200,.30)');
  glow(ctx, 1500, 300, 620, 'rgba(40,150,190,.22)');
  glow(ctx, 900, 780, 700, 'rgba(30,90,170,.25)');
  glow(ctx, 1650, 860, 420, 'rgba(150,70,170,.16)');
  ctx.save();
  ctx.translate(W * 0.5, H * 0.4);
  ctx.rotate(-0.5);
  const mg = ctx.createLinearGradient(0, -170, 0, 170);
  mg.addColorStop(0, 'rgba(255,255,255,0)');
  mg.addColorStop(0.5, 'rgba(190,215,255,.17)');
  mg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = mg;
  ctx.fillRect(-W, -170, W * 2, 340);
  ctx.restore();
  for (let i = 0; i < 2400; i++) {
    const x = rng() * W, y = rng() * H * 0.82;
    const s = rng() ** 3 * 2.2 + 0.4;
    ctx.globalAlpha = 0.25 + rng() * 0.75;
    ctx.fillStyle = rng() < 0.15 ? '#ffe2b0' : rng() < 0.3 ? '#bcd4ff' : '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 46; i++) {
    const x = rng() * W, y = rng() * H * 0.62, l = 6 + rng() * 16;
    ctx.strokeStyle = 'rgba(255,255,255,.7)';
    ctx.beginPath();
    ctx.moveTo(x - l, y); ctx.lineTo(x + l, y);
    ctx.moveTo(x, y - l); ctx.lineTo(x, y + l);
    ctx.stroke();
  }
  const mx = 1042, my = 660, mr = 150;
  glow(ctx, mx, my, mr * 4.4, 'rgba(255,236,190,.20)');
  glow(ctx, mx, my, mr * 2.2, 'rgba(255,240,205,.32)');
  const mgd = ctx.createRadialGradient(mx - 44, my - 44, 10, mx, my, mr);
  mgd.addColorStop(0, '#fffaf0');
  mgd.addColorStop(0.7, '#f6e7c0');
  mgd.addColorStop(1, '#e2c98e');
  ctx.fillStyle = mgd;
  ctx.beginPath();
  ctx.arc(mx, my, mr, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 14; i++) {
    const a = rng() * Math.PI * 2, d = rng() * mr * 0.78, r = 8 + rng() * 26;
    ctx.fillStyle = `rgba(190,160,100,${0.10 + rng() * 0.12})`;
    ctx.beginPath();
    ctx.arc(mx + Math.cos(a) * d, my + Math.sin(a) * d, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return toTexture(c, { aniso: 4 });
}

// 山脊剪影（透明底）：远山带薄雾、近山更暗；远山上有一座塔，给“历史”留一个暗示
function ridge(ctx, W, base, amp, seed, color, mist) {
  const rng = mulberry32(seed);
  const ph = [rng() * 6, rng() * 6, rng() * 6];
  ctx.beginPath();
  ctx.moveTo(0, ctx.canvas.height);
  for (let x = 0; x <= W; x += 6) {
    const y = base - amp * (0.55 * Math.sin(x * 0.0042 + ph[0]) + 0.3 * Math.sin(x * 0.011 + ph[1]) + 0.15 * Math.sin(x * 0.027 + ph[2]) + 0.5);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, ctx.canvas.height);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, base - amp * 1.3, 0, base + amp);
  g.addColorStop(0, color);
  g.addColorStop(1, mist);
  ctx.fillStyle = g;
  ctx.fill();
}

function pagoda(ctx, x, y, s) {
  ctx.fillStyle = '#0b1634';
  ctx.fillRect(x - 3 * s, y - 70 * s, 6 * s, 70 * s);
  for (let i = 0; i < 5; i++) {
    const w = (26 - i * 4) * s, yy = y - (14 + i * 13) * s;
    ctx.beginPath();
    ctx.moveTo(x - w - 6 * s, yy + 3 * s);
    ctx.quadraticCurveTo(x - w * 0.5, yy - 2 * s, x, yy - 8 * s);
    ctx.quadraticCurveTo(x + w * 0.5, yy - 2 * s, x + w + 6 * s, yy + 3 * s);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillRect(x - 1 * s, y - 100 * s, 2 * s, 22 * s);
}

export function mountainTextures() {
  const W = 2048, H = 640;
  const [fc, f] = makeCanvas(W, H);
  ridge(f, W, 330, 120, 5, 'rgba(38,78,120,.95)', 'rgba(120,160,190,.9)');
  pagoda(f, 1210, 232, 1.3);
  ridge(f, W, 420, 90, 9, 'rgba(18,40,84,1)', 'rgba(60,100,140,1)');
  const [nc, n] = makeCanvas(W, H);
  ridge(n, W, 470, 80, 13, 'rgba(8,18,46,1)', 'rgba(14,30,66,1)');
  ridge(n, W, 560, 60, 21, 'rgba(4,9,26,1)', 'rgba(6,14,38,1)');
  return { far: toTexture(fc, { aniso: 4 }), near: toTexture(nc, { aniso: 4 }) };
}
