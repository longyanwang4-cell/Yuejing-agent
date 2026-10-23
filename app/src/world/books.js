import * as THREE from 'three';
import { box } from '../core/materials.js';
import { makeCanvas, toTexture, speckle } from '../core/tex.js';
import { mulberry32 } from '../core/util.js';
import { FONT_BRUSH, FONT_SERIF, SHELF, isLit } from '../config.js';
import { glowSprite } from './glow.js';

const BW = 0.56, BH = 0.80, BD = 0.08;

// 封面：右上起竖排书名（超过 4 字自动折两列），左侧竖排出处，右下角一方朱印
function coverCanvas(item, lit) {
  const W = 320, H = 448;
  const [c, ctx] = makeCanvas(W, H);
  const top = lit ? '#8a2a28' : '#3a2220';
  const bot = lit ? '#5a1618' : '#241514';
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, top);
  g.addColorStop(1, bot);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  speckle(ctx, W, H, 16, mulberry32(item.title.length * 7 + 3));
  const gold = lit ? '#e8c97a' : '#8a7a58';
  ctx.strokeStyle = gold;
  ctx.lineWidth = 5;
  ctx.strokeRect(16, 16, W - 32, H - 32);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(26, 26, W - 52, H - 52);
  ctx.fillStyle = gold;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const chars = [...item.title];
  const cols = chars.length <= 4 ? 1 : 2;
  const perCol = Math.ceil(chars.length / cols);
  const fs = cols === 1 ? (chars.length <= 2 ? 92 : 76) : (perCol <= 3 ? 62 : 56);
  const step = fs + 12;
  const gap = fs + 16;
  ctx.font = `700 ${fs}px ${FONT_BRUSH}`;
  // 两列共用同一条起头线，短的那列从顶上对齐，不留半截悬空
  const y0 = H / 2 - ((perCol - 1) * step) / 2 - 10;
  for (let col = 0; col < cols; col++) {
    const seg = chars.slice(col * perCol, (col + 1) * perCol);
    const x = W / 2 + 14 + ((cols - 1) * gap) / 2 - col * gap;
    seg.forEach((ch, i) => ctx.fillText(ch, x, y0 + i * step));
  }

  // 出处：贴左竖排
  ctx.font = `500 22px ${FONT_SERIF}`;
  const subs = [...item.sub];
  const sy0 = H / 2 - ((subs.length - 1) * 26) / 2;
  subs.forEach((ch, i) => ctx.fillText(ch, 48, sy0 + i * 26));

  // 朱印
  ctx.beginPath();
  ctx.arc(W - 50, H - 58, 22, 0, Math.PI * 2);
  ctx.fillStyle = lit ? '#c0392b' : '#5a2a28';
  ctx.fill();
  ctx.fillStyle = lit ? '#ffe9c8' : '#a08a80';
  ctx.font = `700 24px ${FONT_BRUSH}`;
  ctx.fillText('典', W - 50, H - 56);
  return c;
}

function makeBookMesh(item, lit) {
  const tex = toTexture(coverCanvas(item, lit));
  const face = new THREE.MeshStandardMaterial({
    map: tex, roughness: 0.55, metalness: 0.05,
    emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: lit ? 0.5 : 0.1,
  });
  const edge = new THREE.MeshStandardMaterial({ color: 0xe6d8b4, roughness: 0.9 });
  const back = new THREE.MeshStandardMaterial({ color: 0x3a1614, roughness: 0.6 });
  const spine = new THREE.MeshStandardMaterial({ color: 0x6a2220, roughness: 0.5, metalness: 0.1 });
  // 顺序：+x 右(页边) / -x 左(书脊) / +y / -y / +z 封面 / -z 封底
  const m = new THREE.Mesh(new THREE.BoxGeometry(BW, BH, BD), [edge, spine, edge, edge, face, back]);
  m.castShadow = true;
  return m;
}

// 柜内匾额：以史为鉴
function plaqueTexture() {
  const [c, ctx] = makeCanvas(1024, 256);
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#241409');
  g.addColorStop(1, '#150c06');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1024, 256);
  speckle(ctx, 1024, 256, 10, mulberry32(11));
  ctx.strokeStyle = '#a8873f';
  ctx.lineWidth = 4;
  ctx.strokeRect(14, 14, 996, 228);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(26, 26, 972, 204);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(255, 200, 110, .8)';
  ctx.shadowBlur = 20;
  ctx.fillStyle = '#f0d79a';
  ctx.font = `700 118px ${FONT_BRUSH}`;
  ctx.fillText('以史为鉴', 512, 106);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#b99a5e';
  ctx.font = `500 30px ${FONT_SERIF}`;
  ctx.fillText('练一次 · 亮一本', 512, 206);
  return c;
}

// 陈列柜：六部典籍一字排开，上面一方「以史为鉴」匾
export function buildDisplayCase(mats) {
  const g = new THREE.Group();
  const cols = 6, pitch = 0.80;
  const W = cols * pitch + 0.3, H = 2.3, D = 0.5;
  g.add(box(W, H, 0.04, new THREE.MeshStandardMaterial({ color: 0x0f1630, roughness: 0.95 }), 0, H / 2, 0.02));
  g.add(box(0.1, H, D, mats.woodDark, -W / 2 + 0.05, H / 2, D / 2));
  g.add(box(0.1, H, D, mats.woodDark, W / 2 - 0.05, H / 2, D / 2));
  g.add(box(W + 0.2, 0.12, D + 0.1, mats.woodDark, 0, H + 0.06, D / 2 + 0.05));
  g.add(box(W + 0.1, 0.16, D + 0.04, mats.woodDark, 0, 0.08, D / 2 + 0.02));
  const shelfY = 0.17;
  g.add(box(W - 0.1, 0.06, D - 0.04, mats.wood, 0, shelfY, D / 2));
  // 暖光灯带（顶灯打匾与书）
  const strip = new THREE.Mesh(new THREE.BoxGeometry(W - 0.3, 0.02, 0.02), new THREE.MeshBasicMaterial({ color: 0xffe2a8, toneMapped: false }));
  strip.position.set(0, H - 0.09, D - 0.05);
  g.add(strip);

  // 匾
  const ptex = toTexture(plaqueTexture());
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), new THREE.MeshStandardMaterial({
    map: ptex, emissive: 0xffffff, emissiveMap: ptex, emissiveIntensity: 0.3, roughness: 0.8,
  }));
  plaque.position.set(0, 1.66, 0.045);
  g.add(plaque);

  const lamp = new THREE.PointLight(0xffd8a0, 7, 4.5, 2);
  lamp.position.set(0, 1.4, 1.0);
  g.add(lamp);

  const books = [];
  SHELF.forEach((item, i) => {
    const col = i % cols;
    const lit = isLit(item);
    const holder = new THREE.Group();
    holder.position.set(-W / 2 + 0.15 + pitch * (col + 0.5), shelfY + 0.03 + BH / 2, D * 0.55);
    holder.rotation.x = -0.1;
    const mesh = makeBookMesh(item, lit);
    holder.add(mesh);
    if (lit) {
      const halo = glowSprite('gold', 1.25, 0.5);
      halo.position.z = 0.1;
      holder.add(halo);
      holder.userData.halo = halo;
    }
    holder.userData = { ...holder.userData, item, lit, baseY: holder.position.y, baseZ: holder.position.z, t: 0, target: 0 };
    holder.traverse((o) => { o.userData.pickId = `book:${item.id}`; });
    g.add(holder);
    books.push(holder);
  });
  g.userData.books = books;
  g.userData.size = { W, H, D };
  return g;
}

// 练完一场回到书房时调用：按最新的练习记录重画每本书的封面和光晕。
// 封面是一次性画好的贴图，所以这里换贴图/材质，而不是只改一个状态位。
export function refreshBooks(books) {
  books.forEach((holder) => {
    const u = holder.userData;
    const lit = isLit(u.item);
    if (lit === u.lit) return;
    const mesh = holder.children.find((o) => o.isMesh && Array.isArray(o.material));
    if (mesh) {
      const face = mesh.material[4];
      const tex = toTexture(coverCanvas(u.item, lit));
      face.map?.dispose?.();
      face.emissiveMap?.dispose?.();
      face.map = tex;
      face.emissiveMap = tex;
      face.emissiveIntensity = lit ? 0.5 : 0.1;
      face.needsUpdate = true;
    }
    if (lit && !u.halo) {
      const halo = glowSprite('gold', 1.25, 0.5);
      halo.position.z = 0.1;
      holder.add(halo);
      u.halo = halo;
    } else if (!lit && u.halo) {
      holder.remove(u.halo);
      u.halo = null;
    }
    u.lit = lit;
  });
}

// 悬停时书本向前抽出一点
export function animateBooks(books, dt) {
  books.forEach((b) => {
    const u = b.userData;
    u.t += (u.target - u.t) * Math.min(1, dt * 10);
    b.position.z = u.baseZ + u.t * 0.16;
    b.position.y = u.baseY + u.t * 0.05;
    b.rotation.x = -0.1 + u.t * 0.1;
    if (u.halo) u.halo.material.opacity = 0.42 + u.t * 0.4;
  });
}
