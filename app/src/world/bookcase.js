import * as THREE from 'three';
import { box } from '../core/materials.js';
import { makeCanvas, toTexture } from '../core/tex.js';
import { mulberry32 } from '../core/util.js';

const PAL = ['#5a2a24', '#7a3a2c', '#3c2a4a', '#2a3b5a', '#2d4a3c', '#6b5226', '#8a5a2a', '#3a2a22',
  '#4a1f2c', '#243a4a', '#7a6a46', '#51402c', '#a07a44', '#1f2f3a', '#6a2f3a', '#35506a'];

let spineMap = null;
let bookMat = null;
let bandMat = null;
const unit = new THREE.BoxGeometry(1, 1, 1);
unit.translate(0, 0.5, 0);

// 书脊贴图：近白底，上下各一道烫金线 + 中间标签条，再被实例颜色着色
function getSpine() {
  if (spineMap) return spineMap;
  const [c, ctx] = makeCanvas(64, 256);
  ctx.fillStyle = '#f2ead8';
  ctx.fillRect(0, 0, 64, 256);
  ctx.fillStyle = '#b89a52';
  [[18, 3], [26, 1.5], [226, 3], [234, 1.5]].forEach(([y, h]) => ctx.fillRect(0, y, 64, h));
  ctx.fillStyle = '#e8d7a8';
  ctx.fillRect(10, 70, 44, 70);
  ctx.strokeStyle = '#8a6e30';
  ctx.strokeRect(10.5, 70.5, 43, 69);
  spineMap = toTexture(c, { aniso: 4 });
  bookMat = new THREE.MeshStandardMaterial({ map: spineMap, roughness: 0.72, metalness: 0.02 });
  bandMat = new THREE.MeshStandardMaterial({ color: 0xc9a85a, metalness: 0.8, roughness: 0.35 });
  return spineMap;
}

// 在 parent（墙面局部坐标：x 沿墙、y 向上、z 朝内）里建一座书柜。
// rect 为柜体外框；rows 缺省按 0.42 m 一层。
export function buildBookcase(mats, parent, rect, opt = {}) {
  getSpine();
  const { x0, x1, y0, y1 } = rect;
  const depth = opt.depth ?? 0.42;
  const rows = opt.rows ?? Math.max(2, Math.round((y1 - y0) / 0.42));
  const rng = mulberry32(opt.seed ?? 1);
  const g = new THREE.Group();
  parent.add(g);
  const w = x1 - x0, h = y1 - y0, t = 0.05, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;

  g.add(box(w, h, 0.03, mats.woodDark, mx, my, 0.02));
  g.add(box(t, h, depth, mats.wood, x0 + t / 2, my, depth / 2));
  g.add(box(t, h, depth, mats.wood, x1 - t / 2, my, depth / 2));
  g.add(box(w + 0.14, 0.1, depth + 0.1, mats.woodDark, mx, y1 + 0.05, (depth + 0.1) / 2));
  g.add(box(w + 0.06, 0.12, depth + 0.04, mats.woodDark, mx, y0 + 0.06, (depth + 0.04) / 2));

  const rh = (h - t) / rows;
  const books = [];
  const bands = [];
  for (let k = 0; k <= rows; k++) {
    const by = y0 + t / 2 + k * rh;
    if (k > 0 && k < rows) g.add(box(w - t, t, depth - 0.02, mats.wood, mx, by, depth / 2 + 0.01));
    if (k === rows || opt.empty?.includes(k)) continue;
    const floorY = by + t / 2;
    const avail = rh - t - 0.03;
    let x = x0 + t + 0.02;
    const xEnd = x1 - t - 0.02;
    while (x < xEnd - 0.03) {
      if (rng() < 0.045) { x += 0.08 + rng() * 0.14; continue; }
      const bw = 0.028 + rng() * 0.046;
      if (x + bw > xEnd) break;
      const bh = avail * (0.56 + rng() * 0.38);
      const bd = depth * (0.5 + rng() * 0.28);
      const lean = rng() < 0.035 ? (rng() - 0.5) * 0.45 : 0;
      const z = 0.05 + bd / 2 + rng() * 0.04;
      books.push([x + bw / 2, floorY, z, bw, bh, bd, lean, Math.floor(rng() * PAL.length)]);
      if (!lean && rng() < 0.55) bands.push([x + bw / 2, floorY + bh * (0.15 + rng() * 0.7), z, bw * 1.03, 0.011, bd * 1.02]);
      x += bw + 0.002;
    }
  }
  const d = new THREE.Object3D();
  const im = new THREE.InstancedMesh(unit, bookMat, books.length);
  const col = new THREE.Color();
  books.forEach(([px, py, pz, sx, sy, sz, lean, ci], i) => {
    d.position.set(px, py, pz);
    d.rotation.set(0, 0, lean);
    d.scale.set(sx, sy, sz);
    d.updateMatrix();
    im.setMatrixAt(i, d.matrix);
    im.setColorAt(i, col.set(PAL[ci]));
  });
  im.castShadow = false;
  im.receiveShadow = true;
  g.add(im);
  const bm = new THREE.InstancedMesh(unit, bandMat, bands.length);
  bands.forEach(([px, py, pz, sx, sy, sz], i) => {
    d.position.set(px, py, pz);
    d.rotation.set(0, 0, 0);
    d.scale.set(sx, sy, sz);
    d.updateMatrix();
    bm.setMatrixAt(i, d.matrix);
  });
  g.add(bm);
  g.userData.rowHeight = rh;
  g.userData.rows = rows;
  return g;
}

// 一整面墙两层书架：下层 + 回廊层。skip 里列出不放书柜的区段。
export function shelveWall(mats, wf, i, opt = {}) {
  const lower = opt.lower ?? [[-3.05, 3.05]];
  const upper = opt.upper ?? [[-3.05, 3.05]];
  lower.forEach(([a, b], n) => buildBookcase(mats, wf, { x0: a, x1: b, y0: 0.14, y1: 4.35 }, { seed: i * 31 + n * 7 + 3, rows: 10, ...(opt.lowerOpt?.[n] || {}) }));
  upper.forEach(([a, b], n) => buildBookcase(mats, wf, { x0: a, x1: b, y0: 4.78, y1: 8.7 }, { seed: i * 53 + n * 11 + 9, rows: 9 }));
}
