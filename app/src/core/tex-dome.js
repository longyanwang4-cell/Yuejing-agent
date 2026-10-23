import { makeCanvas, toTexture } from './tex.js';
import { mulberry32 } from './util.js';

// 穹顶彩绘：深蓝星空 + 八块镶金分区，每块一组星座连线。
// 画布 u 方向对应 8 块平面，v 方向 0=屋檐 1=天窗。
export function domeTexture() {
  const rng = mulberry32(31);
  const W = 2048, H = 1024;
  const [c, ctx] = makeCanvas(W, H);
  const g = ctx.createLinearGradient(0, H, 0, 0);
  g.addColorStop(0, '#0c1c4a');
  g.addColorStop(0.55, '#14307a');
  g.addColorStop(1, '#1d3f8a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const pw = W / 8;
  for (let k = 0; k < 8; k++) {
    const x0 = k * pw;
    for (let i = 0; i < 140; i++) {
      const x = x0 + 14 + rng() * (pw - 28), y = 30 + rng() * (H - 80);
      ctx.fillStyle = `rgba(255,${230 + rng() * 25},${190 + rng() * 40},${0.3 + rng() * 0.6})`;
      ctx.beginPath();
      ctx.arc(x, y, 0.8 + rng() * 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    const n = 6 + Math.floor(rng() * 3);
    const pts = [];
    for (let i = 0; i < n; i++) pts.push([x0 + 40 + rng() * (pw - 80), 160 + rng() * (H - 380)]);
    pts.sort((a, b) => a[0] - b[0]);
    ctx.strokeStyle = 'rgba(233,200,120,.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    pts.forEach(([x, y]) => {
      const gg = ctx.createRadialGradient(x, y, 0, x, y, 16);
      gg.addColorStop(0, 'rgba(255,240,200,1)');
      gg.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = gg;
      ctx.fillRect(x - 16, y - 16, 32, 32);
    });
    ctx.fillStyle = '#d6b363';
    ctx.fillRect(x0 - 5, 0, 10, H);
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.fillRect(x0 + 5, 0, 5, H);
  }
  [0.04, 0.5, 0.94].forEach((f, i) => {
    ctx.fillStyle = i === 1 ? 'rgba(214,179,99,.55)' : '#d6b363';
    ctx.fillRect(0, H * f - (i === 1 ? 3 : 8), W, i === 1 ? 6 : 16);
  });
  const vg = ctx.createLinearGradient(0, 0, 0, H);
  vg.addColorStop(0, 'rgba(0,0,0,.55)');
  vg.addColorStop(0.35, 'rgba(0,0,0,0)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
  return toTexture(c);
}
