import * as THREE from 'three';
import { box } from '../core/materials.js';
import { glowSprite } from './glow.js';
import { makeCanvas, toTexture } from '../core/tex.js';

const cyl = (rt, rb, h, mat, seg = 20) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.castShadow = m.receiveShadow = true;
  return m;
};

// 一本独立的书（封面 + 内页），本地原点在书脊底部中心，竖立
export function makeBook(w, h, d, coverHex, mats) {
  const g = new THREE.Group();
  const cover = new THREE.MeshStandardMaterial({ color: coverHex, roughness: 0.6, metalness: 0.04 });
  g.add(box(w, h, d, cover, 0, h / 2, 0));
  const pages = box(w - 0.02, h - 0.03, d - 0.035, mats.paper, 0, h / 2, 0.012, false);
  g.add(pages);
  g.add(box(0.012, h * 1.002, d * 1.002, mats.brass, -w / 2 + 0.006, h / 2, 0, false));
  return g;
}

// 摊开的发光书页
export function openBook(mats, glow = true) {
  const g = new THREE.Group();
  const cov = new THREE.MeshStandardMaterial({ color: 0x4a1f1a, roughness: 0.6 });
  g.add(box(0.92, 0.035, 0.6, cov, 0, 0.0175, 0));
  [-1, 1].forEach((s) => {
    const p = box(0.43, 0.05, 0.56, mats.paper, s * 0.225, 0.06, 0, false);
    p.rotation.z = -s * 0.07;
    g.add(p);
  });
  if (glow) {
    const light = glowSprite('gold', 1.6, 0.75);
    light.position.y = 0.22;
    g.add(light);
  }
  return g;
}

export function candleLamp(mats) {
  const g = new THREE.Group();
  g.add(cyl(0.12, 0.15, 0.04, mats.brass, 16));
  const stem = cyl(0.025, 0.04, 0.34, mats.brass, 10);
  stem.position.y = 0.2;
  g.add(stem);
  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.17, 0.2, 18, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x1d6a5a, emissive: 0x2a9a7a, emissiveIntensity: 0.9, side: THREE.DoubleSide, roughness: 0.4, transparent: true, opacity: 0.92 }),
  );
  shade.position.y = 0.46;
  g.add(shade);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe2a0, toneMapped: false }));
  flame.position.y = 0.43;
  g.add(flame);
  const halo = glowSprite('warm', 1.1, 0.9);
  halo.position.y = 0.45;
  g.add(halo);
  return g;
}

export function teaSet(mats) {
  const g = new THREE.Group();
  const porcelain = new THREE.MeshStandardMaterial({ color: 0xece4d4, roughness: 0.25 });
  const pot = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), porcelain);
  pot.scale.y = 0.8;
  pot.position.y = 0.09;
  const lid = cyl(0.03, 0.05, 0.04, porcelain, 10);
  lid.position.y = 0.2;
  const spout = cyl(0.015, 0.025, 0.1, porcelain, 8);
  spout.position.set(0.11, 0.12, 0);
  spout.rotation.z = -0.9;
  g.add(pot, lid, spout);
  for (let i = 0; i < 2; i++) {
    const cup = cyl(0.05, 0.03, 0.05, porcelain, 12);
    cup.position.set(-0.16 + i * 0.1, 0.03, 0.17);
    g.add(cup);
  }
  return g;
}

// 圆桌：厚台面 + 收腰底座 + 桌面陈设
export function roundTable(mats) {
  const g = new THREE.Group();
  const top = cyl(1.2, 1.2, 0.1, mats.woodWarm, 40);
  top.position.y = 0.88;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.035, 8, 48), mats.brass);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.88;
  const stem = cyl(0.2, 0.34, 0.8, mats.woodDark, 18);
  stem.position.y = 0.45;
  const foot = cyl(0.78, 0.9, 0.12, mats.woodDark, 32);
  foot.position.y = 0.06;
  const foot2 = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.03, 8, 32), mats.brass);
  foot2.rotation.x = Math.PI / 2;
  foot2.position.y = 0.12;
  g.add(top, rim, stem, foot, foot2);

  const ob = openBook(mats);
  ob.position.set(0.35, 0.93, 0.35);
  ob.rotation.y = -0.4;
  g.add(ob);
  const lamp = candleLamp(mats);
  lamp.position.set(-0.55, 0.93, -0.1);
  g.add(lamp);
  const tea = teaSet(mats);
  tea.position.set(0.45, 0.93, -0.55);
  g.add(tea);
  const stackCols = [0x5a2a24, 0x2a3b5a, 0x6b5226, 0x2d4a3c];
  stackCols.forEach((c, i) => {
    const b = makeBook(0.34 - i * 0.02, 0.05, 0.24 - i * 0.01, c, mats);
    b.rotation.set(Math.PI / 2, 0, 0);
    b.position.set(-0.2, 0.93 + 0.025 + i * 0.052, 0.62);
    b.rotation.y = 0;
    const flat = new THREE.Group();
    flat.add(box(0.34 - i * 0.02, 0.05, 0.24 - i * 0.01, new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }), 0, 0, 0));
    flat.add(box(0.31 - i * 0.02, 0.03, 0.22 - i * 0.01, mats.paper, 0.012, 0, 0, false));
    flat.position.set(-0.2 + (i % 2) * 0.03, 0.93 + 0.025 + i * 0.05, 0.62);
    flat.rotation.y = 0.15 * (i - 1.5);
    g.add(flat);
  });
  return g;
}

// 浑天仪：三环 + 发光内核，缓慢自转。点击 = 探索更多场景
export function armillary(mats) {
  const g = new THREE.Group();
  const rings = [];
  const ringMat = new THREE.MeshStandardMaterial({ color: 0xe0b860, metalness: 0.95, roughness: 0.2, emissive: 0x6a4a10, emissiveIntensity: 0.45 });
  [[0.62, 0.025, 0, 0], [0.54, 0.02, Math.PI / 2, 0], [0.46, 0.02, Math.PI / 4, Math.PI / 3], [0.7, 0.016, Math.PI / 2.3, -Math.PI / 5]].forEach(([r, t, rx, rz]) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, t, 10, 64), ringMat);
    m.rotation.set(rx, 0, rz);
    m.castShadow = true;
    g.add(m);
    rings.push(m);
  });
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 32, 24),
    new THREE.MeshStandardMaterial({ color: 0x1b4fb0, emissive: 0x3a8cff, emissiveIntensity: 1.2, roughness: 0.2 }),
  );
  const halo = glowSprite('cool', 2.2, 0.85);
  g.add(core, halo);
  const axis = cyl(0.01, 0.01, 1.5, mats.brass, 6);
  g.add(axis);
  g.userData = { rings, core };
  return g;
}

// 悬挂吊灯：同心环 + 环上的烛灯
export function chandelier(mats, chainLen) {
  const g = new THREE.Group();
  const chain = cyl(0.015, 0.015, chainLen, mats.brassDull, 6);
  chain.position.y = chainLen / 2;
  g.add(chain);
  [[1.5, 0.04, 14], [0.95, 0.035, 9]].forEach(([r, t, n], ri) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, t, 8, 56), mats.brass);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -ri * 0.28;
    g.add(ring);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const c = new THREE.Group();
      c.position.set(Math.cos(a) * r, -ri * 0.28, Math.sin(a) * r);
      const cup = cyl(0.04, 0.03, 0.05, mats.brass, 8);
      const wax = cyl(0.022, 0.022, 0.12, mats.paper, 8);
      wax.position.y = 0.08;
      const fl = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe2a8, toneMapped: false }));
      fl.scale.y = 1.6;
      fl.position.y = 0.2;
      const gl = glowSprite('warm', 0.85, 0.9);
      gl.position.y = 0.2;
      c.add(cup, wax, fl, gl);
      g.add(c);
    }
  });
  const drop = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), new THREE.MeshStandardMaterial({ color: 0xfff0c0, emissive: 0xffc860, emissiveIntensity: 0.9, metalness: 0.5, roughness: 0.2 }));
  drop.scale.y = 1.6;
  drop.position.y = -0.78;
  g.add(drop);
  return g;
}

export function floorLamp(mats, withLight = true) {
  const g = new THREE.Group();
  const base = cyl(0.22, 0.26, 0.06, mats.brass, 20);
  base.position.y = 0.03;
  const pole = cyl(0.025, 0.03, 2.1, mats.brass, 8);
  pole.position.y = 1.08;
  const shadeMat = new THREE.MeshStandardMaterial({ color: 0xffe0b0, emissive: 0xffa850, emissiveIntensity: 1.1, side: THREE.DoubleSide, transparent: true, opacity: 0.95, roughness: 0.7 });
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.34, 0.42, 22, 1, true), shadeMat);
  shade.position.y = 2.28;
  g.add(base, pole, shade);
  const halo = glowSprite('warm', 2.6, 0.7);
  halo.position.y = 2.28;
  g.add(halo);
  if (withLight) {
    const p = new THREE.PointLight(0xffb060, 26, 9, 2);
    p.position.y = 2.2;
    g.add(p);
  }
  return g;
}

export function armchair(mats, color = 0x6a3322) {
  const leather = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.06 });
  const g = new THREE.Group();
  g.add(box(1.0, 0.34, 0.95, leather, 0, 0.42, 0));
  g.add(box(1.0, 0.82, 0.22, leather, 0, 0.8, -0.38));
  [-1, 1].forEach((s) => {
    const arm = box(0.2, 0.52, 0.95, leather, s * 0.6, 0.55, 0);
    arm.geometry = new THREE.BoxGeometry(0.2, 0.52, 0.95, 1, 1, 1);
    g.add(arm);
    const roll = cyl(0.11, 0.11, 0.95, leather, 14);
    roll.rotation.x = Math.PI / 2;
    roll.position.set(s * 0.6, 0.84, 0);
    g.add(roll);
    [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([a, b]) => {
      const leg = cyl(0.04, 0.03, 0.2, mats.woodDark, 8);
      leg.position.set(a * 0.5, 0.1, b * 0.42);
      g.add(leg);
    });
  });
  const cush = box(0.8, 0.14, 0.78, new THREE.MeshStandardMaterial({ color: color + 0x101010, roughness: 0.6 }), 0, 0.66, 0.05);
  g.add(cush);
  const studs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.018, 6, 6), mats.brass, 10);
  const d = new THREE.Object3D();
  for (let i = 0; i < 10; i++) {
    d.position.set(-0.38 + (i % 5) * 0.19, 0.82 + Math.floor(i / 5) * 0.28, -0.265);
    d.updateMatrix();
    studs.setMatrixAt(i, d.matrix);
  }
  g.add(studs);
  return g;
}

export function sofa(mats) {
  const velvet = new THREE.MeshStandardMaterial({ color: 0x1f3468, roughness: 0.9 });
  const velvetL = new THREE.MeshStandardMaterial({ color: 0x2c4a86, roughness: 0.9 });
  const g = new THREE.Group();
  g.add(box(2.7, 0.3, 1.05, velvet, 0, 0.36, 0));
  g.add(box(2.7, 0.78, 0.26, velvet, 0, 0.78, -0.4));
  [-1, 1].forEach((s) => {
    g.add(box(0.26, 0.55, 1.05, velvet, s * 1.34, 0.55, 0));
    const roll = cyl(0.13, 0.13, 1.05, velvet, 14);
    roll.rotation.x = Math.PI / 2;
    roll.position.set(s * 1.34, 0.84, 0);
    g.add(roll);
    [-1, 1].forEach((b) => {
      const leg = cyl(0.045, 0.03, 0.2, mats.brass, 8);
      leg.position.set(s * 1.2, 0.1, b * 0.42);
      g.add(leg);
    });
  });
  for (let i = 0; i < 3; i++) g.add(box(0.78, 0.16, 0.78, velvetL, -0.82 + i * 0.82, 0.58, 0.08));
  const pillow = box(0.38, 0.38, 0.1, new THREE.MeshStandardMaterial({ color: 0xc9a55a, roughness: 0.7 }), 0.9, 0.82, 0.18);
  pillow.rotation.set(-0.2, -0.2, 0.15);
  g.add(pillow);
  return g;
}

function helix(r, h, turns, n, y0 = 0, a0 = 0) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = a0 + t * turns * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * r, y0 + t * h, Math.sin(a) * r));
  }
  return pts;
}

// 黄铜旋梯：中柱 + 扇形踏板 + 螺旋扶手。顶部踏板高度 = rise
export function spiralStair(mats, rise, steps = 17, turns = 0.95, radius = 1.2) {
  const g = new THREE.Group();
  const pole = cyl(0.12, 0.12, rise + 1.1, mats.brass, 14);
  pole.position.y = (rise + 1.1) / 2;
  g.add(pole);
  const dy = rise / steps;
  const da = (turns * Math.PI * 2) / steps;
  for (let i = 1; i <= steps; i++) {
    const a = i * da;
    const step = new THREE.Group();
    const tread = box(radius - 0.1, 0.07, 0.62, mats.woodWarm, (radius - 0.1) / 2 + 0.1, 0, 0);
    step.add(tread);
    const post = cyl(0.014, 0.014, 0.95, mats.brassDull, 5);
    post.position.set(radius - 0.04, 0.5, 0);
    step.add(post);
    step.position.y = i * dy;
    step.rotation.y = -a;
    g.add(step);
  }
  const curve = new THREE.CatmullRomCurve3(helix(radius - 0.04, (steps - 1) * dy, (turns * (steps - 1)) / steps, 90, dy + 0.97, da));
  const rail = new THREE.Mesh(new THREE.TubeGeometry(curve, 120, 0.028, 8, false), mats.brass);
  rail.castShadow = true;
  g.add(rail);
  // 辅助量：顶部踏板的局部坐标，调用方据此接栈桥
  const aTop = steps * da;
  g.userData.top = new THREE.Vector3(Math.cos(-aTop) * (radius * 0.6), rise, Math.sin(-aTop) * (radius * 0.6));
  return g;
}

// 书房里的小摆件：挂在墙上的画框（canvas 现画）
export function frameFromCanvas(w, h, draw, mats, px = 256) {
  const [c, ctx] = makeCanvas(Math.round(px * (w / h)), px);
  draw(ctx, c.width, c.height);
  const tex = toTexture(c);
  const g = new THREE.Group();
  g.add(box(w + 0.16, h + 0.16, 0.06, mats.woodDark, 0, 0, 0));
  g.add(box(w + 0.06, h + 0.06, 0.07, mats.brass, 0, 0, -0.005, false));
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.35 }));
  pic.position.z = 0.04;
  g.add(pic);
  return g;
}
