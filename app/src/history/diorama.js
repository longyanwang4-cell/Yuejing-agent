import * as THREE from 'three';
import { makeCanvas, toTexture, speckle } from '../core/tex.js';
import { mulberry32, lerp, damp } from '../core/util.js';
import { FONT_BRUSH, FONT_SERIF } from '../config.js';
import { glowSprite } from '../world/glow.js';

// 一本书摊开在虚空里，右页上立着一座微缩的赵国街景。
// 全部由基础几何体 + canvas 贴图构成，没有外部模型。
export const BOOK = {
  pageW: 4.1, pageH: 3.05,
  origin: new THREE.Vector3(2.15, 0, 0), // 右页上的场景中心
};

const INK = 0x241d2e;
const WOOD = 0x3a2a26;
const STONE = 0x413943;

function mat(color, o = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.04, ...o });
}
const M = {
  ink: mat(0x3a3148),
  robe: mat(0x4a4058),
  robeLight: mat(0x5e5168),
  skin: mat(0xd8bba0),
  wood: mat(0x6a4a34),
  stone: mat(0x6b5f6a),
  roof: mat(0x2e2a40),
  gold: mat(0xd8b46a, { metalness: 0.75, roughness: 0.35 }),
  cloth: mat(0x9e3a2e),
  horse: mat(0x453a52),
  wheel: mat(0x6a5540),
};

function box(w, h, d, m, x = 0, y = 0, z = 0) {
  const g = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  g.position.set(x, y, z);
  g.castShadow = true;
  g.receiveShadow = true;
  return g;
}

// ——— 人物 ———
function person({ h = 0.5, robe = 0x4a4058, helmet = false, cape = false, sash = 0, staff = false, sword = false } = {}) {
  const g = new THREE.Group();
  const rm = mat(robe);
  // 身量全部按 h 走 —— 写死绝对半径的话，矮个子会被压成一个矮胖的棋子
  const body = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.15, h * 0.2, h * 0.62, 16), rm);
  body.position.y = h * 0.31;
  const chest = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.165, h * 0.185, h * 0.2, 16), rm);
  chest.position.y = h * 0.66;
  // 肩：一圈薄盘，压出衣褶的转折
  const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.2, h * 0.17, h * 0.045, 16), rm);
  shoulder.position.y = h * 0.745;
  // 下摆：多一道转折，别让袍子收成一个光溜溜的圆锥
  const hem = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.203, h * 0.216, h * 0.05, 16), rm);
  hem.position.y = h * 0.025;
  g.add(body, chest, shoulder, hem);
  // 交领：两条斜襟压在胸前
  [-1, 1].forEach((s) => {
    const lapel = new THREE.Mesh(new THREE.BoxGeometry(h * 0.03, h * 0.16, h * 0.014), M.ink);
    lapel.position.set(s * h * 0.042, h * 0.655, h * 0.072);
    lapel.rotation.z = s * 0.42;
    g.add(lapel);
  });

  // 双袖：贴着身体垂下，微微外张 —— 必须探出袍身，不然整件衣服是一根柱子
  [-1, 1].forEach((s) => {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.045, h * 0.062, h * 0.42, 10), rm);
    arm.position.set(s * h * 0.175, h * 0.56, 0);
    arm.rotation.z = -s * 0.12;
    g.add(arm);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.068, h * 0.068, h * 0.022, 10), M.ink);
    cuff.position.set(s * h * 0.198, h * 0.368, 0);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(h * 0.032, 10, 8), M.skin);
    hand.position.set(s * h * 0.2, h * 0.345, h * 0.012);
    g.add(cuff, hand);
  });

  // 腰带
  if (sash) {
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.172, h * 0.172, h * 0.05, 16), mat(sash));
    belt.position.y = h * 0.46;
    g.add(belt);
  }

  const head = new THREE.Mesh(new THREE.SphereGeometry(h * 0.1, 16, 12), M.skin);
  head.position.y = h * 0.86;
  head.scale.set(1, 1.06, 1.02);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.035, h * 0.04, h * 0.05, 8), M.skin);
  neck.position.y = h * 0.795;
  g.add(neck, head);
  // 五官：远看是两点墨，近看（练习镜头会拉到眼前）才有个人样
  [-1, 1].forEach((s) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(h * 0.014, 8, 6), mat(0x2a2336));
    eye.position.set(s * h * 0.038, h * 0.873, h * 0.088);
    g.add(eye);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(h * 0.042, h * 0.008, h * 0.008), mat(0x2a2336));
    brow.position.set(s * h * 0.038, h * 0.905, h * 0.088);
    brow.rotation.z = s * 0.16;
    g.add(brow);
  });
  if (helmet) {
    // 兜鍪：铁的青灰圆顶 + 一圈帽檐 + 红缨，别做成一个亮金球
    const iron = mat(0x4b4657, { metalness: 0.35, roughness: 0.58 });
    const bronze = mat(0xb08d4e, { metalness: 0.55, roughness: 0.45 });
    const hm = new THREE.Mesh(new THREE.SphereGeometry(h * 0.108, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.56), iron);
    hm.position.y = h * 0.885;
    // 盔檐收窄：原来檐比头还宽，俯视时整张脸被檐口盖住，人只剩一只桶
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.104, h * 0.11, h * 0.02, 16), bronze);
    brim.position.y = h * 0.878;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(h * 0.022, h * 0.09, 8), bronze);
    spike.position.y = h * 1.01;
    const tassel = new THREE.Mesh(new THREE.ConeGeometry(h * 0.03, h * 0.09, 6), M.cloth);
    tassel.position.set(0, h * 1.06, -h * 0.02);
    // 短须
    const beard = new THREE.Mesh(new THREE.ConeGeometry(h * 0.05, h * 0.11, 8), mat(0x2c2438));
    beard.position.set(0, h * 0.79, h * 0.055);
    beard.rotation.x = Math.PI;
    g.add(hm, brim, spike, tassel, beard);
  } else {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.075, h * 0.105, h * 0.095, 12), M.ink);
    cap.position.y = h * 0.94;
    const capBrim = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.115, h * 0.115, h * 0.012, 12), M.ink);
    capBrim.position.y = h * 0.895;
    // 冠带：脑后的绶带
    const band = new THREE.Mesh(new THREE.BoxGeometry(h * 0.2, h * 0.026, h * 0.02), mat(0x8a2b22));
    band.position.set(0, h * 0.925, -h * 0.09);
    g.add(cap, capBrim, band);
  }
  if (cape) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.09, h * 0.2, h * 0.55, 10, 1, true, -0.9, 1.8), mat(robe, { side: THREE.DoubleSide }));
    c.position.set(0, h * 0.52, 0.01);
    c.rotation.y = Math.PI;
    g.add(c);
  }
  // 汉节：竹杖 + 顶上一撮快掉光的旄。
  // 苏武「杖汉节牧羊」，没有这根杖，他就只是一个被扣下的使臣。
  if (staff) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.015, h * 0.017, h * 1.02, 8), mat(0x6a5540));
    pole.position.set(h * 0.205, h * 0.51, h * 0.02);
    pole.rotation.z = 0.04;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.03, h * 0.022, h * 0.05, 8), M.gold);
    cap.position.set(h * 0.187, h * 1.03, h * 0.02);
    const tuft = new THREE.Group();
    tuft.position.set(h * 0.187, h * 1.0, h * 0.02);
    // 节旄尽落 —— 只剩几缕，所以挂得稀；
    // 但「稀」不等于「没有」：这几缕要垂到肩下、还要带着暖白，
    // 远看才认得出他举的是节，不是一根棍。
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const strand = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.011, h * 0.003, h * 0.26, 4), mat(0xd9d0bf));
      strand.position.set(Math.cos(a) * h * 0.032, -h * 0.13, Math.sin(a) * h * 0.032);
      strand.rotation.z = Math.cos(a) * 0.3;
      strand.rotation.x = Math.sin(a) * 0.3;
      tuft.add(strand);
    }
    g.add(pole, cap, tuft);
  }
  // 佩剑：唐雎的「挺剑而起」，起码得先有把剑。
  // 剑挂左腰（画面里是观者的右边），剑鞘斜向下，剑柄压在带上。
  if (sword) {
    const sheath = box(h * 0.022, h * 0.32, h * 0.042, mat(0x241f2a), h * 0.165, h * 0.32, h * 0.05);
    sheath.rotation.z = -0.44;
    const guard = box(h * 0.1, h * 0.016, h * 0.05, M.gold, h * 0.235, h * 0.455, h * 0.05);
    guard.rotation.z = -0.44;
    const grip = box(h * 0.024, h * 0.085, h * 0.034, mat(0x4a3a2e), h * 0.257, h * 0.505, h * 0.05);
    grip.rotation.z = -0.44;
    g.add(sheath, guard, grip);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.userData.body = body;
  return g;
}

// ——— 马 + 车 ———
function horse() {
  const g = new THREE.Group();
  const body = box(0.2, 0.11, 0.34, M.horse, 0, 0.16, 0);
  const neck = box(0.07, 0.14, 0.09, M.horse, 0, 0.22, -0.15);
  neck.rotation.x = -0.5;
  const head = box(0.055, 0.06, 0.12, M.horse, 0, 0.29, -0.23);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.14, 6), M.horse);
  tail.position.set(0, 0.17, 0.18);
  tail.rotation.x = -0.5;
  g.add(body, neck, head, tail);
  [[-0.07, -0.13], [0.07, -0.13], [-0.07, 0.13], [0.07, 0.13]].forEach(([x, z]) => {
    g.add(box(0.03, 0.13, 0.03, M.horse, x, 0.065, z));
  });
  return g;
}

function carriage() {
  const g = new THREE.Group();
  const body = box(0.26, 0.13, 0.4, M.wood, 0, 0.14, 0.02);
  const poleShaft = box(0.04, 0.04, 0.3, M.wood, 0, 0.11, -0.28);
  const canopy = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.34, 12, 1, true, 0, Math.PI), M.cloth);
  canopy.rotation.z = Math.PI / 2;
  canopy.rotation.y = Math.PI / 2;
  canopy.position.set(0, 0.28, 0.05);
  const canopyMat = canopy.material;
  canopyMat.side = THREE.DoubleSide;
  g.add(body, poleShaft, canopy);
  [-1, 1].forEach((s) => {
    const w = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.014, 6, 16), M.wheel);
    w.position.set(s * 0.14, 0.09, 0.04);
    w.rotation.y = Math.PI / 2;
    g.add(w);
  });
  const h = horse();
  h.position.set(0, 0, -0.45);
  g.add(h);
  g.userData.horse = h;
  return g;
}

// ——— 建筑 ———
function gateTower(x) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.5, 0.24), wallMat(0.26));
  base.position.y = 0.25;
  base.castShadow = true;
  base.receiveShadow = true;
  const upper = box(0.3, 0.16, 0.28, M.wood, 0, 0.58, 0);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.26, 0.14, 4), M.roof);
  roof.position.y = 0.72;
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1.25, 1, 1.15);
  roof.castShadow = true;
  g.add(base, upper, roof);
  g.position.x = x;
  return g;
}

function wallSeg(len, x, z, rotY = 0) {
  const g = new THREE.Group();
  const w = new THREE.Mesh(new THREE.BoxGeometry(len, 0.3, 0.12), wallMat(len));
  w.position.y = 0.15;
  w.castShadow = true;
  w.receiveShadow = true;
  const cap = box(len + 0.04, 0.045, 0.16, M.roof, 0, 0.32, 0);
  g.add(w, cap);
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  return g;
}

// ——— 程序化贴图 ———
const _texCache = new Map();
function tex(name, rx = 1, ry = 1) {
  const key = `${name}:${rx}:${ry}`;
  if (_texCache.has(key)) return _texCache.get(key);
  const t = { brick: brickTexture, tile: tileTexture, plaster: plasterTexture, lattice: latticeTexture }[name]();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  _texCache.set(key, t);
  return t;
}
function wallMat(len) { return new THREE.MeshStandardMaterial({ map: tex('brick', Math.max(1, len * 1.6), 1), roughness: 0.95, metalness: 0 }); }

function brickTexture() {
  const rng = mulberry32(17);
  const [c, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#6b625c';
  ctx.fillRect(0, 0, 256, 256);
  const rowH = 32;
  for (let y = 0; y < 256; y += rowH) {
    ctx.fillStyle = `rgba(42,36,34,${0.3 + rng() * 0.16})`;
    ctx.fillRect(0, y, 256, 2);
    const off = (y / rowH) % 2 ? 0 : 32;
    for (let x = off; x < 256; x += 64) {
      ctx.fillStyle = 'rgba(42,36,34,.24)';
      ctx.fillRect(x, y, 1.5, rowH);
    }
  }
  for (let i = 0; i < 140; i++) {
    ctx.fillStyle = `rgba(${rng() < 0.5 ? '212,200,182' : '30,26,24'},${0.02 + rng() * 0.055})`;
    ctx.beginPath();
    ctx.ellipse(rng() * 256, rng() * 256, 4 + rng() * 28, 3 + rng() * 16, rng() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  speckle(ctx, 256, 256, 11, rng);
  return toTexture(c, { aniso: 8 });
}

function plasterTexture() {
  const rng = mulberry32(31);
  const [c, ctx] = makeCanvas(256, 256);
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#8b7f72');
  g.addColorStop(0.55, '#7d7166');
  g.addColorStop(1, '#6b6058');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(${rng() < 0.5 ? '30,24,20' : '210,196,172'},${0.02 + rng() * 0.06})`;
    ctx.beginPath();
    ctx.ellipse(rng() * 256, rng() * 256, 6 + rng() * 34, 4 + rng() * 20, rng() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // 墙根返潮的深色带
  const wet = ctx.createLinearGradient(0, 210, 0, 256);
  wet.addColorStop(0, 'rgba(34,28,26,0)');
  wet.addColorStop(1, 'rgba(34,28,26,.4)');
  ctx.fillStyle = wet;
  ctx.fillRect(0, 210, 256, 46);
  speckle(ctx, 256, 256, 9, rng);
  return toTexture(c, { aniso: 8 });
}

function tileTexture() {
  const rng = mulberry32(23);
  const [c, ctx] = makeCanvas(128, 128);
  ctx.fillStyle = '#2f2b3c';
  ctx.fillRect(0, 0, 128, 128);
  for (let x = 0; x < 128; x += 16) {
    const g = ctx.createLinearGradient(x, 0, x + 16, 0);
    g.addColorStop(0, 'rgba(8,6,16,.5)');
    g.addColorStop(0.42, 'rgba(104,96,124,.34)');
    g.addColorStop(1, 'rgba(8,6,16,.54)');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, 16, 128);
  }
  for (let y = 0; y < 128; y += 22) {
    ctx.fillStyle = 'rgba(6,4,12,.42)';
    ctx.fillRect(0, y, 128, 3);
    ctx.fillStyle = 'rgba(126,118,146,.16)';
    ctx.fillRect(0, y + 3, 128, 2);
  }
  speckle(ctx, 128, 128, 7, rng);
  return toTexture(c, { aniso: 8 });
}

// 窗棂：木格
function latticeTexture() {
  const [c, ctx] = makeCanvas(64, 64);
  ctx.fillStyle = 'rgba(18,12,10,.86)';
  ctx.fillRect(0, 0, 64, 64);
  ctx.strokeStyle = 'rgba(176,138,92,.75)';
  ctx.lineWidth = 2;
  for (let i = 8; i < 64; i += 16) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 64); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(64, i); ctx.stroke();
  }
  ctx.strokeRect(1, 1, 62, 62);
  return toTexture(c, { aniso: 4 });
}

// ——— 屋舍 ———
// w 沿 x，d 沿 z，屋脊沿 z；face 决定临街的是哪一面（+1 = x 正侧）
function house({ w = 0.5, d = 0.9, h = 0.5, roofH = 0.16, face = 1, lit = true } = {}) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ map: tex('plaster', Math.max(1, d * 2.4), Math.max(1, h * 3)), roughness: 0.96, metalness: 0 }));
  body.position.y = h / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);
  // 勒脚
  g.add(box(w + 0.02, 0.05, d + 0.02, M.stone, 0, 0.025, 0));
  // 山墙木框
  [-1, 1].forEach((s) => {
    const beam = box(0.022, h, 0.022, M.wood, s * (w / 2 - 0.012), h / 2, d / 2 - 0.012);
    g.add(beam);
    const beam2 = box(0.022, h, 0.022, M.wood, s * (w / 2 - 0.012), h / 2, -d / 2 + 0.012);
    g.add(beam2);
  });

  // 双坡瓦顶
  const slopeW = Math.hypot(w / 2, roofH) + 0.03;
  const ang = Math.atan2(roofH, w / 2);
  [-1, 1].forEach((s) => {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(slopeW, 0.026, d + 0.09),
      new THREE.MeshStandardMaterial({ map: tex('tile', Math.max(2, d * 6), 2), roughness: 0.9, metalness: 0 }));
    slab.position.set(s * w * 0.25, h + roofH / 2, 0);
    slab.rotation.z = -s * ang;
    slab.castShadow = true;
    slab.receiveShadow = true;
    g.add(slab);
  });
  const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, d + 0.1, 6), M.roof);
  ridge.rotation.x = Math.PI / 2;
  ridge.position.y = h + roofH;
  ridge.castShadow = true;
  g.add(ridge);

  // 临街面：门 + 两扇窗 + 挑檐
  const fx = (face * w) / 2 + face * 0.011;
  const door = box(0.006, h * 0.5, d * 0.26, M.ink, fx, h * 0.25, 0);
  const doorFrame = box(0.008, h * 0.56, d * 0.31, M.wood, fx - face * 0.002, h * 0.28, 0);
  g.add(doorFrame, door);
  [-1, 1].forEach((s) => {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(d * 0.22, h * 0.24),
      new THREE.MeshStandardMaterial({ map: tex('lattice'), roughness: 0.9, transparent: false }));
    win.position.set(fx + face * 0.004, h * 0.62, s * d * 0.28);
    win.rotation.y = face > 0 ? Math.PI / 2 : -Math.PI / 2;
    g.add(win);
  });
  // 屋檐挑出：给立面上一条暗带，压出身形
  const eave = box(0.09, 0.022, d + 0.1, M.roof, face * (w / 2 + 0.03), h - 0.02, 0);
  g.add(eave);

  if (lit) {
    const halo = glowSprite('warm', 0.22, 0.5);
    halo.position.set(fx + face * 0.03, h * 0.5, 0);
    g.add(halo);
  }
  return g;
}

// ——— 街面道具 ———
function jar(s = 1, color = 0x54463e) {
  const g = new THREE.Group();
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), mat(color, { roughness: 0.9 }));
  belly.scale.set(1, 1.05, 1);
  belly.position.y = 0.032;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.018, 0.02, 8), mat(color, { roughness: 0.9 }));
  neck.position.y = 0.068;
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.004, 4, 10), mat(color, { roughness: 0.9 }));
  lip.rotation.x = Math.PI / 2;
  lip.position.y = 0.076;
  g.add(belly, neck, lip);
  g.scale.setScalar(s);
  return g;
}

function crate(s = 1) {
  const g = new THREE.Group();
  g.add(box(0.06 * s, 0.05 * s, 0.05 * s, M.wood, 0, 0.025 * s, 0));
  g.add(box(0.062 * s, 0.008 * s, 0.052 * s, M.roof, 0, 0.05 * s, 0));
  return g;
}

// 街边摊：四根杆 + 布篷 + 柜台 + 货
function stall({ w = 0.34, d = 0.24, awning = 0x7a3a30, goods = 3 } = {}) {
  const g = new THREE.Group();
  const hPost = 0.26;
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.007, hPost, 5), M.wood);
    p.position.set((sx * w) / 2, hPost / 2, (sz * d) / 2);
    p.castShadow = true;
    g.add(p);
  });
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.08, d + 0.06),
    new THREE.MeshStandardMaterial({ color: awning, roughness: 0.92, side: THREE.DoubleSide }));
  cloth.rotation.x = -Math.PI / 2 + 0.16;
  cloth.position.y = hPost;
  cloth.castShadow = true;
  g.add(cloth);
  const counter = box(w * 0.86, 0.055, d * 0.5, M.wood, 0, 0.075, d * 0.12);
  g.add(counter);
  for (let i = 0; i < goods; i++) {
    const j = jar(0.75, i % 2 ? 0x4a3c34 : 0x5c4a3c);
    j.position.set((i - (goods - 1) / 2) * 0.07, 0.103, d * 0.12 + (i % 2 ? 0.02 : -0.02));
    g.add(j);
  }
  return g;
}

// 水井
function well() {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.13, 12, 1, true), M.stone);
  ring.position.y = 0.065;
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.088, 12), new THREE.MeshBasicMaterial({ color: 0x14161f }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.11;
  g.add(ring, water);
  [-1, 1].forEach((s) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.26, 5), M.wood);
    post.position.set(s * 0.09, 0.13, 0);
    post.castShadow = true;
    g.add(post);
  });
  const beam = box(0.22, 0.016, 0.016, M.wood, 0, 0.26, 0);
  g.add(beam);
  const roof = box(0.24, 0.012, 0.12, M.roof, 0, 0.276, 0);
  g.add(roof);
  return g;
}

// 幌子：横杆上挂一块布招
function banner({ w = 0.16, h = 0.22, color = 0xb8873a } = {}) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.5, 5), M.wood);
  pole.position.y = 0.25;
  const arm = box(0.16, 0.012, 0.012, M.wood, 0.07, 0.47, 0);
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ color, roughness: 0.9, side: THREE.DoubleSide }));
  cloth.position.set(0.13, 0.47 - h / 2, 0);
  cloth.castShadow = true;
  g.add(pole, arm, cloth);
  g.userData.cloth = cloth;
  return g;
}


function willow(x, z, s = 1) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.03, 0.42, 7), M.wood);
  trunk.position.y = 0.21;
  trunk.rotation.z = (Math.random() - 0.5) * 0.12;
  g.add(trunk);
  const canopyMat = mat(0x3d5544, { roughness: 0.95 });
  for (let i = 0; i < 3; i++) {
    const blob = new THREE.Mesh(new THREE.SphereGeometry(0.16 - i * 0.03, 10, 8), canopyMat);
    blob.position.set((Math.random() - 0.5) * 0.1, 0.46 + i * 0.09, (Math.random() - 0.5) * 0.1);
    blob.scale.set(1, 0.6, 1);
    g.add(blob);
  }
  g.position.set(x, 0, z);
  g.scale.setScalar(s);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

function flag(x, z, char = '赵') {
  const [c, ctx] = makeCanvas(128, 160);
  ctx.fillStyle = '#7a2a24';
  ctx.fillRect(0, 0, 128, 160);
  ctx.strokeStyle = '#d8b46a';
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, 116, 148);
  ctx.fillStyle = '#f0dca8';
  ctx.font = `700 84px ${FONT_BRUSH}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(char, 64, 86);
  const tex = toTexture(c);
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.6, 5), M.wood);
  pole.position.y = 0.3;
  const clothMat = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.9 });
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.26), clothMat);
  cloth.position.set(0.11, 0.44, 0);
  g.add(pole, cloth);
  g.position.set(x, 0, z);
  g.userData.cloth = cloth;
  return g;
}

// 地面贴图：夯土 + 车辙 + 墨渍
function groundTexture() {
  const rng = mulberry32(9);
  const [c, ctx] = makeCanvas(512, 512);
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#6a5c62');
  g.addColorStop(1, '#4e4450');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = `rgba(${rng() < 0.5 ? '20,16,26' : '120,110,120'},${0.03 + rng() * 0.08})`;
    ctx.beginPath();
    ctx.ellipse(rng() * 512, rng() * 512, 6 + rng() * 40, 4 + rng() * 24, rng() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // 主街：偏亮的夯土带，南北向
  const path = ctx.createLinearGradient(210, 0, 300, 0);
  path.addColorStop(0, 'rgba(140,124,104,0)');
  path.addColorStop(0.5, 'rgba(140,124,104,.30)');
  path.addColorStop(1, 'rgba(140,124,104,0)');
  ctx.fillStyle = path;
  ctx.fillRect(150, 0, 220, 512);
  ctx.strokeStyle = 'rgba(30,24,34,.4)';
  [0.44, 0.56].forEach((f) => {
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(512 * f, 0);
    ctx.lineTo(512 * f, 512);
    ctx.stroke();
  });
  speckle(ctx, 512, 512, 12, rng);
  return toTexture(c);
}

// 雪地贴图：北海不能是夯土。
// 但这套灯是给暗底调的（主光 4.2、案头点光 26），白雪照进去会直接烧成一张白纸，
// 所以这儿画的是「月色下的雪」—— 冷蓝灰的底，只有雪脊留几笔亮。
function snowTexture() {
  const rng = mulberry32(23);
  const [c, ctx] = makeCanvas(512, 512);
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#8e9cb4');
  g.addColorStop(1, '#78879f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  // 风推出来的雪埂：宽、软、低对比。
  // 原来那些细长的椭圆压上去像一块结冰的湖面 —— 雪不是裂纹。
  for (let i = 0; i < 26; i++) {
    const y = rng() * 512;
    const grd = ctx.createLinearGradient(0, y - 26, 0, y + 26);
    grd.addColorStop(0, 'rgba(226,238,252,0)');
    grd.addColorStop(0.45, rng() < 0.5 ? 'rgba(226,238,252,.18)' : 'rgba(38,54,86,.13)');
    grd.addColorStop(1, 'rgba(38,54,86,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.ellipse(rng() * 512, y, 140 + rng() * 160, 26, (rng() - 0.5) * 0.24, 0, Math.PI * 2);
    ctx.fill();
  }
  // 雪面上的起伏：软边的小块，别带硬轮廓
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = rng() < 0.45 ? 'rgba(226,238,252,.10)' : 'rgba(38,54,86,.09)';
    ctx.beginPath();
    ctx.ellipse(rng() * 512, rng() * 512, 18 + rng() * 52, 6 + rng() * 12, rng() * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // 几道踩出来的路：宽笔触压窄笔触，边缘才不会是一条画上去的线
  [0.36, 0.5].forEach((f) => {
    [[26, 0.05], [14, 0.06], [6, 0.07]].forEach(([w, a]) => {
      ctx.lineWidth = w;
      ctx.strokeStyle = `rgba(40,56,88,${a})`;
      ctx.beginPath();
      ctx.moveTo(512 * f, 0);
      ctx.bezierCurveTo(512 * (f + 0.05), 170, 512 * (f - 0.04), 340, 512 * (f + 0.03), 512);
      ctx.stroke();
    });
  });
  speckle(ctx, 512, 512, 6, rng);
  return toTexture(c);
}

function pageCanvas(kind) {
  const W = 1024, H = Math.round(1024 * (BOOK.pageH / BOOK.pageW));
  const [c, ctx] = makeCanvas(W, H);
  const tex = toTexture(c, { aniso: 8 });
  const draw = (story, step, idx) => {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    // 纸：边缘不规则
    ctx.beginPath();
    const rng = mulberry32(kind === 'left' ? 3 : 21);
    const pts = 26;
    for (let i = 0; i <= pts; i++) {
      const t = i / pts;
      const x = t < 0.25 ? t * 4 * W : t < 0.5 ? W : t < 0.75 ? W - (t - 0.5) * 4 * W : 0;
      const y = t < 0.25 ? 0 : t < 0.5 ? (t - 0.25) * 4 * H : t < 0.75 ? H : H - (t - 0.75) * 4 * H;
      const j = 3 + rng() * 5;
      ctx.lineTo(Math.min(W, Math.max(0, x + (rng() - 0.5) * j)), Math.min(H, Math.max(0, y + (rng() - 0.5) * j)));
    }
    ctx.closePath();
    const pg = ctx.createLinearGradient(0, 0, 0, H);
    pg.addColorStop(0, '#e9dcc0');
    pg.addColorStop(0.5, '#e3d3b2');
    pg.addColorStop(1, '#d8c49f');
    ctx.fillStyle = pg;
    ctx.fill();
    ctx.clip();

    // 纸纹
    for (let i = 0; i < 90; i++) {
      const x = rng() * W, y = rng() * H, r = 20 + rng() * 120;
      const gg = ctx.createRadialGradient(x, y, 0, x, y, r);
      gg.addColorStop(0, `rgba(120,90,50,${0.03 + rng() * 0.05})`);
      gg.addColorStop(1, 'rgba(120,90,50,0)');
      ctx.fillStyle = gg;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // 书脊阴影
    const edge = ctx.createLinearGradient(kind === 'left' ? W : 0, 0, kind === 'left' ? W - 130 : 130, 0);
    edge.addColorStop(0, 'rgba(60,36,16,.34)');
    edge.addColorStop(1, 'rgba(60,36,16,0)');
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, W, H);

    const ink = '#3a2a1e';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (kind === 'left') {
      // 底层：淡墨山水
      const rng2 = mulberry32(40 + idx);
      for (let layer = 0; layer < 3; layer++) {
        ctx.beginPath();
        ctx.moveTo(-20, H);
        const base = H * (0.5 + layer * 0.14);
        for (let x = -20; x <= W + 20; x += 18) {
          const y = base - Math.sin(x * 0.004 + layer * 2.2 + rng2()) * (80 - layer * 20) - Math.sin(x * 0.013 + layer) * 16;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(W + 20, H);
        ctx.closePath();
        const g2 = ctx.createLinearGradient(0, base - 110, 0, H);
        g2.addColorStop(0, `rgba(${96 - layer * 20},${86 - layer * 18},${100 - layer * 18},${0.1 + layer * 0.06})`);
        g2.addColorStop(1, `rgba(${64 - layer * 12},${56 - layer * 10},${68 - layer * 10},${0.06 + layer * 0.05})`);
        ctx.fillStyle = g2;
        ctx.fill();
      }
      [0.4, 0.54, 0.68].forEach((f, i) => {
        const g3 = ctx.createLinearGradient(0, H * f - 36, 0, H * f + 36);
        g3.addColorStop(0, 'rgba(245,238,222,0)');
        g3.addColorStop(0.5, `rgba(245,238,222,${0.42 - i * 0.09})`);
        g3.addColorStop(1, 'rgba(245,238,222,0)');
        ctx.fillStyle = g3;
        ctx.fillRect(0, H * f - 36, W, 72);
      });

      // 竖排正文：从右往左
      const top = 78, colGap = 76;
      let cx = W - 96;
      const vr = (text, size, color, font = FONT_SERIF, gap = 1.2) => {
        ctx.fillStyle = color;
        ctx.font = `500 ${size}px ${font}`;
        [...text].forEach((ch, i) => ctx.fillText(ch, cx, top + size * 0.5 + i * size * gap));
      };
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.fillStyle = '#8a6a3a';
      ctx.font = `500 24px ${FONT_SERIF}`;
      ctx.fillText(`第${'一二三四五'[idx]}幕`, cx, top - 26);

      vr(step.title.slice(0, 12), 42, '#2a1c12', FONT_BRUSH, 1.08);
      cx -= colGap;
      if (step.title.length > 12) {
        vr(step.title.slice(12), 42, '#2a1c12', FONT_BRUSH, 1.08);
        cx -= colGap;
      }
      cx -= 22;

      step.page.forEach((line) => {
        const chunks = line.match(/.{1,19}/g) || [];
        chunks.forEach((chunk) => {
          vr(chunk, 25, '#31241a', FONT_SERIF, 1.22);
          cx -= 66;
        });
        cx -= 12;
      });

      if (step.quote) {
        cx -= 6;
        ctx.fillStyle = 'rgba(150,40,30,.09)';
        ctx.fillRect(cx - 34, top - 18, 68, 430);
        ctx.fillStyle = '#8a2b22';
        ctx.font = `500 29px ${FONT_BRUSH}`;
        [...step.quote.text].slice(0, 12).forEach((ch, i) => ctx.fillText(ch, cx, top + 26 + i * 34));
        ctx.fillStyle = '#8a6a3a';
        ctx.font = `500 18px ${FONT_SERIF}`;
        ctx.fillText(step.quote.by, cx - 28, top + 26 + Math.min(12, step.quote.text.length) * 34 + 20);
      }

      // 印章
      ctx.fillStyle = '#a8322a';
      ctx.fillRect(74, H - 168, 84, 84);
      ctx.fillStyle = '#f2e3c4';
      ctx.font = `700 30px ${FONT_BRUSH}`;
      ctx.fillText('阅', 96, H - 140);
      ctx.fillText('境', 96, H - 106);
      ctx.fillText('藏', 136, H - 140);
      ctx.fillText('书', 136, H - 106);
      // 页脚
      ctx.fillStyle = 'rgba(90,64,36,.8)';
      ctx.font = `500 21px ${FONT_SERIF}`;
      ctx.textAlign = 'left';
      ctx.fillText(`${story.title} · ${story.source}`, 182, H - 92);
    } else {
      // 右页：只留淡墨山影，正文不重复
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(0, H * (0.55 + i * 0.1));
        for (let x = 0; x <= W; x += 24) {
          ctx.lineTo(x, H * (0.55 + i * 0.1) - Math.sin(x * 0.004 + i * 2) * (36 - i * 8));
        }
        ctx.lineTo(W, H);
        ctx.lineTo(0, H);
        ctx.closePath();
        ctx.fillStyle = `rgba(${70 - i * 12},${58 - i * 10},${70 - i * 12},.16)`;
        ctx.fill();
      }
    }
    ctx.restore();
    tex.needsUpdate = true;
  };
  return { tex, draw };
}

export function buildDiorama() {
  const root = new THREE.Group();

  // —— 书 ——
  const book = new THREE.Group();
  root.add(book);
  const pageGeo = new THREE.PlaneGeometry(BOOK.pageW, BOOK.pageH);
  const left = pageCanvas('left');
  const right = pageCanvas('right');
  const mkPage = (canvasObj, x) => {
    const m = new THREE.Mesh(pageGeo, new THREE.MeshStandardMaterial({
      map: canvasObj.tex, transparent: true, roughness: 0.95, metalness: 0,
      emissive: 0xffffff, emissiveMap: canvasObj.tex, emissiveIntensity: 0.16,
    }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0, 0);
    return m;
  };
  book.add(mkPage(left, -(BOOK.pageW / 2 + 0.06)));
  book.add(mkPage(right, BOOK.pageW / 2 + 0.06));
  // 书脊与纸垛
  const spine = box(0.12, 0.16, BOOK.pageH + 0.06, M.wood, 0, -0.09, 0);
  book.add(spine);
  [-1, 1].forEach((s) => {
    book.add(box(BOOK.pageW, 0.1, BOOK.pageH, mat(0xd6c4a2), s * (BOOK.pageW / 2 + 0.06), -0.075, 0));
  });
  book.position.y = 0;

  // —— 案面：书摊在一张深色的长案上，不是浮在虚空里 ——
  // 只做光与木纹，越往外越黑，和场景雾接到一起，边缘看不出接缝
  const deskTex = (() => {
    const [c, ctx] = makeCanvas(512, 512);
    const g = ctx.createRadialGradient(256, 248, 18, 256, 256, 306);
    g.addColorStop(0, '#4b3b2c');
    g.addColorStop(0.4, '#2a221b');
    g.addColorStop(0.76, '#100d12');
    g.addColorStop(1, '#06040a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
    const rng = mulberry32(91);
    for (let i = 0; i < 110; i++) {
      const y = rng() * 512;
      ctx.strokeStyle = `rgba(${rng() < 0.5 ? '16,11,8' : '126,100,68'},${0.02 + rng() * 0.05})`;
      ctx.lineWidth = 0.6 + rng() * 1.7;
      ctx.beginPath();
      ctx.moveTo(-10, y);
      ctx.bezierCurveTo(170, y + (rng() - 0.5) * 30, 340, y + (rng() - 0.5) * 30, 522, y + (rng() - 0.5) * 16);
      ctx.stroke();
    }
    return toTexture(c, { aniso: 8 });
  })();
  const desk = new THREE.Mesh(
    new THREE.PlaneGeometry(46, 34),
    new THREE.MeshStandardMaterial({ map: deskTex, roughness: 0.84, metalness: 0.04 }),
  );
  desk.rotation.x = -Math.PI / 2;
  desk.position.set(0.4, -0.28, -1.1);
  desk.receiveShadow = true;
  root.add(desk);
  // 桌子外面再垫一层大而暗的面，把 46×34 的边缘藏进雾里，不然站到街面高度会看见一条假地平线
  // 颜色取的就是场景雾色，远到那个距离时两者已经完全一样
  const under = new THREE.Mesh(
    new THREE.PlaneGeometry(240, 240),
    new THREE.MeshBasicMaterial({ color: 0x140d17, fog: true }),
  );
  under.rotation.x = -Math.PI / 2;
  under.position.set(0.4, -0.34, -1.1);
  root.add(under);

  // —— 场景容器 ——
  // 街道整体按典故重建：六篇共用同一副骨架，换的是陈设、旗号、天气与人物。
  const dio = new THREE.Group();
  dio.position.copy(BOOK.origin);
  dio.scale.setScalar(0.86);
  root.add(dio);

  // —— 光：建一次，换典故时只改颜色 ——
  const key = new THREE.DirectionalLight(0xffc48a, 4.2);
  key.position.set(3.6, 5.2, 4.2);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -5;
  key.shadow.camera.right = 5;
  key.shadow.camera.top = 5;
  key.shadow.camera.bottom = -5;
  key.shadow.bias = -0.0012;
  root.add(key);
  const fill = new THREE.DirectionalLight(0x7c96dc, 1.9);
  fill.position.set(-4.5, 3, -3.5);
  root.add(fill);
  // 背光：把人和建筑的轮廓从暗底上勾出来
  const backLight = new THREE.DirectionalLight(0xffb070, 2.4);
  backLight.position.set(1.2, 2.4, -5.5);
  root.add(backLight);
  const hemi = new THREE.HemisphereLight(0xa294c8, 0x2a2030, 1.5);
  root.add(hemi);
  const bookLight = new THREE.PointLight(0xffd9a8, 26, 10, 2);
  bookLight.position.set(2.4, 2.4, 1.6);
  root.add(bookLight);

  // 悬在书后的光晕
  const halo = glowSprite('cool', 22, 0.16);
  halo.position.set(2.2, 1.4, -5.5);
  root.add(halo);

  let town = null;
  let curStory = null;

  function mountTown(st) {
    if (town) { dio.remove(town.group); town = null; }
    town = buildTown(st);
    dio.add(town.group);
    const t = st.town || {};
    key.color.setHex(t.key ?? 0xffc48a);
    fill.color.setHex(t.fill ?? 0x7c96dc);
    hemi.color.setHex(t.hemi ?? 0xa294c8);
    halo.visible = t.snow !== true;
  }

  // —— 分幕状态 ——
  function setStep(idx, stepKey) {
    if (town) town.setStep(stepKey);
    void idx;
  }

  function update(dt, t) {
    if (town) town.tick(dt, t);
  }

  return {
    root, dio, book, left, right,
    setStep,
    update,
    setStoryStep(story, step, idx) {
      // 换典故就整条街重建：人物、地标、天气都跟着换
      if (story !== curStory) { curStory = story; mountTown(story); }
      left.draw(story, step, idx);
      right.draw(story, step, idx);
    },
  };
}

// ——————————————————————————————————————————————
// 街道：按典故重建。六篇共用一副骨架（城门 / 屋舍 / 摊子 / 树），
// 换的是陈设（地标）、旗号、天气与站在街上的人。
// ——————————————————————————————————————————————
const CAST_MK = {
  person: (o) => person(o),
  guard: (o) => person({ helmet: true, ...o }),
  carriage: () => carriage(),
};

function buildTown(story) {
  const t = story.town || {};
  const lm = t.landmarks || [];
  // 四个布景：市集 / 官署 / 荒野 / 殿上
  const preset = lm.includes('throne') ? 'palace'
    : lm.includes('yurt') ? 'wild'
      : (lm.includes('hall') || lm.includes('court')) ? 'court'
        : 'market';

  const g = new THREE.Group();
  const anim = { flags: [], banners: [], lanterns: [], mists: [], snow: null };

  // —— 地面 ——
  // 雪原换一张贴图：夯土 + 车辙铺在北海边上，怎么打光都像一块灰布
  const snowTex = t.snow ? snowTexture() : null;
  const gm = new THREE.MeshStandardMaterial({ map: snowTex || groundTexture(), roughness: 0.95 });
  if (t.ground) gm.color.setHex(t.ground);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 3.1), gm);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.006;
  ground.receiveShadow = true;
  g.add(ground);

  // —— 街市骨架（荒野与殿上不铺） ——
  if (preset === 'market' || preset === 'court') {
    const gate = new THREE.Group();
    gate.position.set(0, 0, -1.15);
    gate.add(gateTower(-0.42), gateTower(0.42));
    gate.add(box(0.72, 0.1, 0.14, M.wood, 0, 0.44, 0));
    gate.add(box(0.24, 0.12, 0.03, M.gold, 0, 0.56, 0.06));
    const gateRoof = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.07, 0.2), M.roof);
    gateRoof.position.set(0, 0.62, 0);
    gate.add(gateRoof);
    g.add(gate);

    g.add(wallSeg(1.5, -1.5, -1.28));
    g.add(wallSeg(1.5, 1.5, -1.28));
    g.add(wallSeg(1.35, -1.92, -0.6, Math.PI / 2));
    g.add(wallSeg(0.7, -1.92, 1.05, Math.PI / 2));
    g.add(wallSeg(2.6, 1.92, 0.1, Math.PI / 2));

    // 街市：两侧屋舍，把空场子收成一条街。官署那侧让给正堂，不放民房。
    [
      { z: -0.86, h: 0.5, d: 0.62 },
      { z: 0.0, h: 0.58, d: 0.62 },
      { z: 0.86, h: 0.46, d: 0.58 },
    ].forEach((o) => {
      const hs = house({ ...o, w: 0.42, face: -1 });
      hs.position.set(1.56, 0, o.z);
      g.add(hs);
    });
    if (preset !== 'court') {
      [
        { z: -0.86, h: 0.54, d: 0.58 },
        { z: 1.06, h: 0.48, d: 0.56 },
      ].forEach((o) => {
        const hs = house({ ...o, w: 0.42, face: 1 });
        hs.position.set(-1.58, 0, o.z);
        g.add(hs);
      });
    }
  }

  // —— 摊子、坛罐、木箱 ——
  if (t.stalls) {
    const stallA = stall({ w: 0.34, d: 0.26 });
    stallA.position.set(1.14, 0, -0.42);
    stallA.rotation.y = -Math.PI / 2;
    g.add(stallA);
    const stallB = stall({ w: 0.3, d: 0.24, awning: 0x3f4a6a, goods: 2 });
    stallB.position.set(-1.14, 0, -0.8);
    stallB.rotation.y = Math.PI / 2;
    g.add(stallB);
    [[1.24, -0.2, 1], [1.29, -0.14, 0.8], [-1.26, -0.98, 0.9], [-1.2, -1.02, 0.7]].forEach(([x, z, s]) => {
      const j = jar(s);
      j.position.set(x, 0, z);
      g.add(j);
    });
    [[1.3, -0.62, 1], [-1.27, -0.6, 0.9], [-1.23, -0.53, 0.8]].forEach(([x, z, s]) => {
      const c = crate(s);
      c.position.set(x, 0, z);
      c.rotation.y = Math.random() * 0.6;
      g.add(c);
    });
  }

  if (t.well) {
    const w1 = well();
    w1.position.set(-1.3, 0, 1.36);
    g.add(w1);
  }

  if (t.trees) {
    g.add(willow(1.28, -1.06, 0.85));
    g.add(willow(-1.3, -1.04, 0.78));
    g.add(willow(1.26, 1.3, 0.72));
  }

  // —— 幌子与旗 ——
  if (t.stalls) {
    [[1.32, 0.44, 1], [-1.32, 0.9, -1]].forEach(([x, z, ry]) => {
      const b = banner({ color: t.accent || 0xb8873a });
      b.position.set(x, 0, z);
      b.rotation.y = ry * Math.PI;
      g.add(b);
      anim.banners.push(b);
    });
  }
  if (t.flag) {
    [flag(-0.82, -1.02, t.flag), flag(0.82, -1.02, t.flag)].forEach((f) => {
      g.add(f);
      anim.flags.push(f);
    });
  }

  // —— 城门边的小门（晏子）：大门旁边开一道狗门 ——
  if (lm.includes('smallDoor')) {
    const d = new THREE.Group();
    d.position.set(-0.5, 0.28, -1.02);
    d.add(box(0.34, 0.44, 0.1, wallMat(0.6), 0, 0.22, 0));
    d.add(box(0.13, 0.24, 0.12, mat(0x141018), 0, 0.14, 0.005));
    d.add(box(0.2, 0.04, 0.14, M.wood, 0, 0.4, 0.02));
    g.add(d);
  }

  // —— 官署正堂（子罕） ——
  if (lm.includes('hall')) {
    const h = new THREE.Group();
    h.position.set(-1.46, 0, 0.2);
    h.rotation.y = Math.PI / 2;
    h.add(box(1.34, 0.1, 0.72, M.stone, 0, 0.05, 0));
    [[-0.56, -0.28], [0.56, -0.28], [-0.56, 0.28], [0.56, 0.28]].forEach(([x, z]) => {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.46, 8), M.wood);
      p.position.set(x, 0.33, z);
      p.castShadow = true;
      h.add(p);
    });
    h.add(box(1.34, 0.46, 0.06, wallMat(1.34), 0, 0.33, -0.34));
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.07, 0.92), M.roof);
    roof.position.set(0, 0.58, 0);
    roof.castShadow = true;
    h.add(roof);
    h.add(box(1.66, 0.04, 0.1, mat(0x22202c), 0, 0.63, 0));
    h.add(box(0.34, 0.1, 0.02, M.gold, 0, 0.48, 0.06));
    h.add(box(0.5, 0.05, 0.24, M.wood, 0, 0.24, -0.14));
    h.add(box(0.06, 0.1, 0.06, mat(0x2a2418), 0, 0.18, -0.14));
    g.add(h);
  }

  // —— 玉璧（子罕）：立在几上的璧 ——
  if (lm.includes('jade')) {
    const j = new THREE.Group();
    j.position.set(-1.0, 0, 0.2);
    j.add(box(0.12, 0.06, 0.12, mat(0x2a2418), 0, 0.03, 0));
    j.add(box(0.02, 0.08, 0.02, mat(0x2a2418), 0, 0.09, 0));
    const disc = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.014, 8, 20), mat(0x9ec6a8, { metalness: 0.3, roughness: 0.4 }));
    disc.position.y = 0.15;
    disc.rotation.x = Math.PI / 2;
    j.add(disc);
    g.add(j);
  }

  // —— 毡帐与羊群（苏武） ——
  if (lm.includes('yurt')) {
    const y = new THREE.Group();
    y.position.set(-0.98, 0, -0.42);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.33, 0.3, 16), mat(0x8a7a68));
    body.position.y = 0.15;
    body.castShadow = true;
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.26, 16), mat(0x9a8a74));
    top.position.y = 0.42;
    top.castShadow = true;
    const door = box(0.1, 0.16, 0.04, mat(0x3a3028), 0, 0.08, 0.3);
    y.add(body, top, door);
    g.add(y);
  }
  if (lm.includes('sheep')) {
    // 羊要「一眼是羊」：扁长的身子 + 四条细腿 + 一颗深色的头。
    // 原来只有一颗压扁的白球加一个小黑点，远看就是一地雪球。
    const rng = mulberry32(77);
    const sheep = (s = 1) => {
      const sh = new THREE.Group();
      const wool = mat(0xd0c9ba);
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), wool);
      body.scale.set(1.5, 0.95, 1.0);
      body.position.y = 0.15;
      sh.add(body);
      // 背上的卷毛，打破光滑的蛋形
      for (let i = 0; i < 5; i++) {
        const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.03 + rng() * 0.013, 7, 6), wool);
        tuft.position.set(-0.055 + i * 0.028, 0.198 + rng() * 0.022, (rng() - 0.5) * 0.075);
        sh.add(tuft);
      }
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.034, 0.075, 8), wool);
      neck.position.set(0.115, 0.19, 0);
      neck.rotation.z = -0.6;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), mat(0x3a332c));
      head.scale.set(1.25, 0.9, 0.85);
      head.position.set(0.148, 0.212, 0);
      sh.add(neck, head);
      [-1, 1].forEach((e) => {
        const ear = new THREE.Mesh(new THREE.SphereGeometry(0.013, 6, 5), mat(0x3a332c));
        ear.scale.set(1, 0.55, 1.5);
        ear.position.set(0.136, 0.232, e * 0.026);
        sh.add(ear);
      });
      [[-0.058, 0.033], [0.058, 0.033], [-0.058, -0.033], [0.058, -0.033]].forEach(([x, z]) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.0065, 0.135, 5), mat(0x3a332c));
        leg.position.set(x, 0.068, z);
        sh.add(leg);
      });
      const tail = new THREE.Mesh(new THREE.SphereGeometry(0.021, 6, 5), wool);
      tail.position.set(-0.138, 0.163, 0);
      sh.add(tail);
      sh.scale.setScalar(s);
      return sh;
    };
    // 散在帐前，离人物留出空 —— 羊挤在人身上就看不清谁在说话
    [[-0.92, 0.46], [-0.58, 0.84], [-0.9, 1.16], [0.74, 0.66], [0.98, 1.02],
     [0.4, 1.3], [-0.16, 1.14], [1.06, 0.32], [-1.14, 0.12]].forEach(([x, z], i) => {
      const s = sheep(i % 4 === 3 ? 0.66 : 0.88 + rng() * 0.22);
      s.position.set(x, 0, z);
      s.rotation.y = rng() * Math.PI * 2;
      g.add(s);
    });
    // 雪堆：压扁的白球，边上再插几根枯枝。
    // 段数得给够 —— 8×6 的球压扁之后是一块多边形冰面，不是积雪。
    // 贴图不能借地皮那张：球的 UV 在顶点收拢，雪脊会卷成一圈指纹。
    // 就压一个比地皮略亮、比纯白暗的蓝白，靠球面的明暗出体积。
    [[-1.15, 0.8, 0.3], [1.16, 1.2, 0.24], [0.18, 1.36, 0.2]].forEach(([x, z, r]) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), mat(0x9dabc2, { roughness: 1 }));
      m.scale.y = 0.34;
      m.position.set(x, 0.01, z);
      g.add(m);
    });
    [[-1.06, 1.02], [0.88, 1.3], [0.62, 0.12]].forEach(([x, z]) => {
      for (let i = 0; i < 3; i++) {
        const twig = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.16 + rng() * 0.1, 4), mat(0x4a3a30));
        twig.position.set(x + (rng() - 0.5) * 0.07, 0.07, z + (rng() - 0.5) * 0.07);
        twig.rotation.z = (rng() - 0.5) * 0.7;
        twig.rotation.x = (rng() - 0.5) * 0.5;
        g.add(twig);
      }
    });
    // 雪里露头的石头：得是石头色，用浅蓝白就成了另一堆没化的雪
    for (let i = 0; i < 5; i++) {
      const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.03 + rng() * 0.05, 0), mat(0x8a93a4));
      r.position.set((rng() - 0.5) * 3.2, 0.02, (rng() - 0.5) * 2.2);
      r.rotation.set(rng(), rng(), rng());
      g.add(r);
    }
  }

  // —— 县衙的鼓（陶潜） ——
  if (lm.includes('court')) {
    const d = new THREE.Group();
    d.position.set(1.44, 0, -0.16);
    d.rotation.y = -Math.PI / 2;
    d.add(box(0.3, 0.06, 0.2, M.wood, 0, 0.03, 0));
    d.add(box(0.06, 0.12, 0.06, M.wood, 0, 0.08, 0));
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.16, 14), mat(0x8a3a2e));
    drum.rotation.z = Math.PI / 2;
    drum.position.y = 0.16;
    drum.castShadow = true;
    d.add(drum);
    g.add(d);
  }

  // —— 秦廷：台基、坐榻、屏风（唐雎） ——
  if (lm.includes('throne')) {
    const p = new THREE.Group();
    p.position.set(0, 0, -1.12);
    p.add(box(1.5, 0.12, 0.62, M.stone, 0, 0.06, 0));
    p.add(box(1.1, 0.06, 0.4, mat(0x3a3038), 0, 0.15, 0.02));
    p.add(box(1.2, 0.4, 0.04, mat(0x4a3a2e), 0, 0.36, -0.22));
    [[-0.5, 0.2], [0.5, 0.2]].forEach(([x]) => {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.62, 8), M.wood);
      col.position.set(x, 0.43, 0.24);
      col.castShadow = true;
      p.add(col);
    });
    p.add(box(0.42, 0.05, 0.26, mat(0x5a3a2e), 0, 0.2, -0.08));
    // 殿顶不能是一块压平的板 —— 那是一块雨棚，不是殿。
    // 四棱台切出来的庑殿顶，比平板多两件事：檐口的一道斜线，和顶上的一道脊。
    // 压扁必须烘进几何体：Mesh 的 scale 在 rotation 之前生效，
    // 先转 45° 再 scale.z，出来的是一个斜掉的菱形，不是一顶殿顶。
    const hip = (rt, rb, h, sz, m) => {
      const geo = new THREE.CylinderGeometry(rt, rb, h, 4);
      geo.rotateY(Math.PI / 4);
      geo.scale(1, 1, sz);
      return new THREE.Mesh(geo, m);
    };
    const roof = hip(0.3, 1.18, 0.2, 0.47, M.roof);
    roof.position.set(0, 0.86, 0);
    roof.castShadow = true;
    const eave = hip(1.14, 1.24, 0.04, 0.47, mat(0x4a2a2a));
    eave.position.set(0, 0.75, 0);
    const ridge = box(0.34, 0.05, 0.1, M.gold, 0, 0.98, 0);
    p.add(roof, eave, ridge);
    // 台基得有台阶，不然一块石板浮在土上。
    // 三级，一级比一级矮一点往外挪 —— 顶上那级贴着台基前沿。
    [[0.2, 0.12, 0.37], [0.13, 0.18, 0.52], [0.06, 0.18, 0.7]].forEach(([h, d, z]) => {
      p.add(box(0.66, h, d, M.stone, 0, h / 2, z));
    });
    g.add(p);
  }
  if (lm.includes('brazier')) {
    [-0.72, 0.72].forEach((x) => {
      const b = new THREE.Group();
      b.position.set(x, 0, -0.5);
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.05, 0.11, 12), mat(0x6a5a3a, { metalness: 0.5, roughness: 0.5 }));
      bowl.position.y = 0.14;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 6), mat(0x4a4030));
      leg.position.y = 0.05;
      const fire = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffa040, toneMapped: false }));
      fire.position.y = 0.18;
      const glow = glowSprite('warm', 0.42, 0.85);
      glow.position.y = 0.2;
      b.add(leg, bowl, fire, glow);
      g.add(b);
      anim.lanterns.push(glow);
    });
  }

  // —— 殿上的立柱与宫灯：秦廷原本只有一座台、两只火盆，
  //    镜头一拉远就是一大块空地，两侧连个「殿」的样子都没有 ——
  if (lm.includes('throne')) {
    [[-1.24, 0.38], [1.24, 0.38], [-1.24, -0.64], [1.24, -0.64]].forEach(([x, z]) => {
      const c = new THREE.Group();
      c.position.set(x, 0, z);
      c.add(box(0.15, 0.05, 0.15, M.stone, 0, 0.025, 0));
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.05, 1.02, 10), mat(0x5a3228));
      shaft.position.y = 0.56;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.05, 0.03, 10), M.gold);
      cap.position.y = 1.08;
      c.add(shaft, cap);
      g.add(c);
    });
    // 柱头不架梁。试过：一圈横梁架在四根柱子上，从上往下看就是一副脚手架，
    // 比四根光柱子更像工地。殿的「间」靠台基、台阶和御座交代，不靠梁。

    [[-1.06, 1.04], [1.06, 1.04]].forEach(([x, z]) => {
      const l = new THREE.Group();
      l.position.set(x, 0, z);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.86, 6), M.wood);
      pole.position.y = 0.43;
      const arm = box(0.16, 0.014, 0.014, M.wood, 0.07, 0.85, 0);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.11, 10),
        new THREE.MeshStandardMaterial({ color: 0xc0442e, roughness: 0.7, emissive: 0x6a1408, emissiveIntensity: 0.6 }));
      body.position.set(0.14, 0.76, 0);
      const halo = glowSprite('warm', 0.5, 0.5);
      halo.position.set(0.14, 0.76, 0);
      l.add(pole, arm, body, halo);
      g.add(l);
      anim.lanterns.push(halo);
    });
  }

  // —— 人物 ——
  const cast = {};
  (story.cast || []).forEach((c) => {
    const obj = (CAST_MK[c.kind] || CAST_MK.person)(c.opts || {});
    obj.position.set(c.pos ? c.pos[0] : 0, c.y || 0, c.pos ? c.pos[1] : 0);
    obj.rotation.y = c.r || 0;
    if (c.vis === false) obj.visible = false;
    if (c.scale) obj.scale.setScalar(c.scale);
    if (c.parent && cast[c.parent]) cast[c.parent].add(obj);
    else g.add(obj);
    cast[c.key] = obj;
  });

  // 街上的闲人：只在市集布景里出现，免得抢镜
  if ((preset === 'market' || preset === 'court') && t.stalls) {
    const vendor = person({ h: 0.44, robe: 0x5a4a44, sash: 0x8a6a3a });
    vendor.position.set(0.94, 0, -0.44);
    vendor.rotation.y = -1.5;
    g.add(vendor);
    const passer = person({ h: 0.46, robe: 0x44506a, sash: 0x8a2b22 });
    passer.position.set(-0.9, 0, -0.3);
    passer.rotation.y = 2.4;
    g.add(passer);
  }
  if (preset === 'market' || preset === 'court') {
    [[-0.34, 0.46], [0.34, 0.46]].forEach(([x, h]) => {
      const gd = person({ h, robe: 0x4c4450, helmet: true });
      gd.position.set(x, 0, -0.96);
      gd.rotation.y = Math.PI + x * 0.6;
      g.add(gd);
    });
    g.add(box(0.9, 0.05, 0.16, M.stone, 0, 0.025, -0.98));
    [-0.36, 0.36].forEach((x) => {
      const l = new THREE.Group();
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 5), M.wood);
      post.position.y = 0.15;
      const shade = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), new THREE.MeshBasicMaterial({ color: 0xc4442e, toneMapped: false }));
      shade.scale.set(1, 1.25, 1);
      shade.position.y = 0.31;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false }));
      bulb.position.y = 0.31;
      const glow = glowSprite('warm', 0.5, 0.9);
      glow.position.y = 0.31;
      l.add(post, shade, bulb, glow);
      l.position.set(x, 0, -0.9);
      g.add(l);
      anim.lanterns.push(glow);
    });
  }

  // —— 雾与墨点 ——
  // 雪原不放雾斑：加色混合的白雾压在白雪上，不是雾，是地上两块发光的白斑。
  // 北海的空气本来就该是清冷的，雪粒就够了。
  const mistCount = t.snow ? 0 : 5;
  for (let i = 0; i < mistCount; i++) {
    const s = glowSprite('white', 2.6 + i * 0.35, 0.05);
    s.material.color = new THREE.Color(preset === 'wild' ? 0x9ab0d0 : 0x9a8fb8);
    s.position.set((Math.random() - 0.5) * 3.6, 0.22 + Math.random() * 0.3, (Math.random() - 0.5) * 2.2);
    s.scale.y = 0.55;
    g.add(s);
    anim.mists.push(s);
  }
  const moteCount = 150;
  const moteGeo = new THREE.BufferGeometry();
  const mpos = new Float32Array(moteCount * 3);
  const seed = mulberry32(4);
  for (let i = 0; i < moteCount; i++) {
    mpos[i * 3] = (seed() - 0.5) * 4.4;
    mpos[i * 3 + 1] = seed() * 1.2;
    mpos[i * 3 + 2] = (seed() - 0.5) * 3.0;
  }
  moteGeo.setAttribute('position', new THREE.BufferAttribute(mpos, 3));
  const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({
    size: 0.022, map: glowSprite('gold', 1, 1).material.map, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, color: preset === 'wild' ? 0xdce8ff : 0xffd9a0, opacity: 0.75, toneMapped: false,
  }));
  g.add(motes);

  // —— 雪（荒野） ——
  if (t.snow) {
    const n = 220;
    const geo = new THREE.BufferGeometry();
    const p = new Float32Array(n * 3);
    const r = mulberry32(31);
    for (let i = 0; i < n; i++) {
      p[i * 3] = (r() - 0.5) * 4.4;
      p[i * 3 + 1] = r() * 1.6;
      p[i * 3 + 2] = (r() - 0.5) * 3.0;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    anim.snow = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.018, color: 0xeaf2ff, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false,
    }));
    g.add(anim.snow);
  }

  // —— 分幕：每个人物自己的位子 ——
  const beats = story.beats || {};
  const targets = {};
  function setStep(k) {
    const b = beats[k] || beats.bg || {};
    Object.entries(cast).forEach(([ck, obj]) => {
      const v = b[ck];
      if (!v) return;
      targets[ck] = targets[ck] || { p: obj.position.clone(), r: obj.rotation.y, lean: 0 };
      if (v.p) targets[ck].p.set(v.p[0], obj.position.y, v.p[1]);
      if (v.r !== undefined) targets[ck].r = v.r;
      targets[ck].lean = v.lean || 0;
      if (v.vis !== undefined) obj.visible = v.vis;
    });
  }

  function tick(dt, time) {
    Object.entries(cast).forEach(([ck, o]) => {
      const tg = targets[ck];
      if (!tg) return;
      o.position.x = damp(o.position.x, tg.p.x, 2.4, dt);
      o.position.z = damp(o.position.z, tg.p.z, 2.4, dt);
      o.rotation.y = damp(o.rotation.y, tg.r, 2.4, dt);
      o.rotation.x = damp(o.rotation.x, tg.lean, 2.4, dt);
    });
    anim.flags.forEach((f, i) => {
      f.userData.cloth.rotation.y = Math.sin(time * 1.6 + i) * 0.28;
      f.userData.cloth.rotation.z = Math.sin(time * 2.3 + i * 2) * 0.05;
    });
    anim.banners.forEach((b, i) => {
      b.userData.cloth.rotation.z = Math.sin(time * 1.1 + i * 2.2) * 0.07;
      b.userData.cloth.rotation.y = Math.sin(time * 0.8 + i) * 0.16;
    });
    anim.lanterns.forEach((l, i) => { l.material.opacity = 0.7 + Math.sin(time * 2 + i) * 0.15; });
    anim.mists.forEach((m, i) => {
      m.position.x += Math.sin(time * 0.12 + i) * dt * 0.05;
      m.material.opacity = 0.045 + Math.sin(time * 0.5 + i) * 0.015;
    });
    const arr = moteGeo.attributes.position.array;
    for (let i = 0; i < moteCount; i++) {
      arr[i * 3 + 1] += dt * (0.03 + (i % 5) * 0.006);
      if (arr[i * 3 + 1] > 1.25) arr[i * 3 + 1] = 0.02;
    }
    moteGeo.attributes.position.needsUpdate = true;
    if (anim.snow) {
      const s = anim.snow.geometry.attributes.position.array;
      for (let i = 0; i < s.length; i += 3) {
        s[i + 1] -= dt * 0.09;
        s[i] += Math.sin(time * 0.6 + i) * dt * 0.012;
        if (s[i + 1] < 0) s[i + 1] = 1.6;
      }
      anim.snow.geometry.attributes.position.needsUpdate = true;
    }
  }

  return { group: g, cast, setStep, tick };
}
