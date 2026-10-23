import { makeCanvas, toTexture, speckle } from './tex.js';
import { mulberry32 } from './util.js';

// 地板：深色橡木拼板
export function floorTexture() {
  const rng = mulberry32(11);
  const [c, ctx] = makeCanvas(1024, 1024);
  const rows = 8;
  const ph = 1024 / rows;
  for (let r = 0; r < rows; r++) {
    let x = -rng() * 300;
    while (x < 1024) {
      const w = 260 + rng() * 360;
      const l = 22 + rng() * 10;
      ctx.fillStyle = `hsl(${24 + rng() * 8}, ${40 + rng() * 10}%, ${l}%)`;
      ctx.fillRect(x, r * ph, w, ph);
      ctx.strokeStyle = 'rgba(20,10,4,.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, r * ph, w, ph);
      for (let g = 0; g < 14; g++) {
        const gy = r * ph + rng() * ph;
        ctx.strokeStyle = `rgba(${rng() < 0.5 ? '12,6,2' : '120,70,34'},${0.08 + rng() * 0.12})`;
        ctx.lineWidth = 1 + rng() * 1.5;
        ctx.beginPath();
        ctx.moveTo(x, gy);
        ctx.bezierCurveTo(x + w * 0.3, gy + (rng() - 0.5) * 8, x + w * 0.6, gy + (rng() - 0.5) * 8, x + w, gy);
        ctx.stroke();
      }
      x += w;
    }
  }
  speckle(ctx, 1024, 1024, 14, rng);
  return toTexture(c, { repeat: [6, 6] });
}

// 书架木料：胡桃木横纹
export function woodTexture(seed = 5, base = [28, 46, 24]) {
  const rng = mulberry32(seed);
  const [c, ctx] = makeCanvas(512, 256);
  ctx.fillStyle = `hsl(${base[0]},${base[1]}%,${base[2]}%)`;
  ctx.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 90; i++) {
    const y = rng() * 256;
    ctx.strokeStyle = `rgba(${rng() < 0.55 ? '18,8,2' : '170,110,60'},${0.06 + rng() * 0.14})`;
    ctx.lineWidth = 0.6 + rng() * 2.2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= 512; x += 64) ctx.lineTo(x, y + Math.sin(x * 0.02 + i) * 3 + (rng() - 0.5) * 3);
    ctx.stroke();
  }
  speckle(ctx, 512, 256, 10, rng);
  return toTexture(c, { repeat: [1, 1] });
}

// 墙面：暖灰泥 + 渍痕。UV 为世界单位，repeat 控制每块覆盖多少米
export function plasterTexture() {
  const rng = mulberry32(21);
  const [c, ctx] = makeCanvas(512, 512);
  ctx.fillStyle = '#6b5236';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 70; i++) {
    const x = rng() * 512;
    const y = rng() * 512;
    const r = 30 + rng() * 120;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const dark = rng() < 0.5;
    g.addColorStop(0, dark ? 'rgba(30,18,8,.16)' : 'rgba(210,170,110,.12)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  speckle(ctx, 512, 512, 16, rng);
  return toTexture(c, { repeat: [0.25, 0.25] });
}

// 圆形地毯：同心环 + 八角星纹，四周留透明
export function rugTexture() {
  const S = 1024;
  const [c, ctx] = makeCanvas(S, S);
  const cx = S / 2;
  const ring = (r0, r1, col) => {
    ctx.beginPath();
    ctx.arc(cx, cx, r1, 0, Math.PI * 2);
    ctx.arc(cx, cx, r0, 0, Math.PI * 2, true);
    ctx.fillStyle = col;
    ctx.fill('evenodd');
  };
  ctx.beginPath();
  ctx.arc(cx, cx, 500, 0, Math.PI * 2);
  ctx.fillStyle = '#5a1a26';
  ctx.fill();
  ring(470, 500, '#c9a55a');
  ring(440, 466, '#1d2b58');
  ring(402, 436, '#7a2433');
  ring(398, 402, '#c9a55a');
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * 418, cx + Math.sin(a) * 418);
    ctx.rotate(a + Math.PI / 4);
    ctx.fillStyle = i % 2 ? '#c9a55a' : '#e9d8a6';
    ctx.fillRect(-7, -7, 14, 14);
    ctx.restore();
  }
  ctx.fillStyle = '#1d2b58';
  ctx.beginPath();
  ctx.arc(cx, cx, 380, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#c9a55a';
  ctx.lineWidth = 4;
  for (let k = 0; k < 8; k++) {
    ctx.save();
    ctx.translate(cx, cx);
    ctx.rotate((k * Math.PI) / 4);
    ctx.beginPath();
    ctx.moveTo(0, -300);
    ctx.lineTo(46, -120);
    ctx.lineTo(0, -60);
    ctx.lineTo(-46, -120);
    ctx.closePath();
    ctx.fillStyle = k % 2 ? '#7a2433' : '#2c4a86';
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  [220, 150, 84].forEach((r, i) => {
    ctx.beginPath();
    ctx.arc(cx, cx, r, 0, Math.PI * 2);
    ctx.strokeStyle = i === 1 ? '#e9d8a6' : '#c9a55a';
    ctx.lineWidth = i === 1 ? 6 : 3;
    ctx.stroke();
  });
  ctx.fillStyle = '#c9a55a';
  ctx.beginPath();
  ctx.arc(cx, cx, 30, 0, Math.PI * 2);
  ctx.fill();
  speckle(ctx, S, S, 10, mulberry32(3));
  return toTexture(c);
}
