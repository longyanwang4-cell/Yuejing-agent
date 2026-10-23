import * as THREE from 'three';
import { box } from '../core/materials.js';
import { makeCanvas, toTexture, speckle } from '../core/tex.js';
import { mulberry32 } from '../core/util.js';
import { FONT_BRUSH, FONT_SERIF, FONT_SANS, litCount } from '../config.js';
import { glowSprite } from './glow.js';

const matFromCanvas = (c, emissive = 0.55) => {
  const t = toTexture(c);
  return new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: emissive, roughness: 0.7 });
};

// 墙上的招牌：深木底 + 烫金“阅境”
export function signBoard(mats) {
  const [c, ctx] = makeCanvas(1024, 512);
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#2a1a10');
  g.addColorStop(1, '#1c110a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1024, 512);
  speckle(ctx, 1024, 512, 12, mulberry32(4));
  ctx.strokeStyle = '#c9a55a';
  ctx.lineWidth = 6;
  ctx.strokeRect(22, 22, 980, 468);
  ctx.lineWidth = 2;
  ctx.strokeRect(36, 36, 952, 440);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(255,200,110,.9)';
  ctx.shadowBlur = 26;
  ctx.fillStyle = '#f3d98e';
  ctx.font = `700 230px ${FONT_BRUSH}`;
  ctx.fillText('阅境', 512, 210);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#e8c97a';
  ctx.font = `500 44px ${FONT_SERIF}`;
  ctx.fillText('· 让经历成就更好的表达 ·', 512, 388);
  const g2 = new THREE.Group();
  g2.add(box(4.2, 2.18, 0.12, mats.woodDark, 0, 0, 0));
  const face = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 2.0), matFromCanvas(c, 0.7));
  face.position.z = 0.07;
  g2.add(face);
  const glow = glowSprite('warm', 6.5, 0.28);
  glow.position.z = 0.4;
  g2.add(glow);
  return g2;
}

// 钉在墙上的手写便笺
export function noteSheet(mats) {
  const [c, ctx] = makeCanvas(512, 640);
  ctx.fillStyle = '#e9d9b0';
  ctx.fillRect(0, 0, 512, 640);
  const rng = mulberry32(8);
  for (let i = 0; i < 40; i++) {
    const x = rng() * 512, y = rng() * 640, r = 20 + rng() * 80;
    const gg = ctx.createRadialGradient(x, y, 0, x, y, r);
    gg.addColorStop(0, `rgba(120,80,30,${0.05 + rng() * 0.08})`);
    gg.addColorStop(1, 'rgba(120,80,30,0)');
    ctx.fillStyle = gg;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  speckle(ctx, 512, 640, 14, rng);
  ctx.fillStyle = '#4a3420';
  ctx.textAlign = 'center';
  ctx.font = `700 74px ${FONT_BRUSH}`;
  ctx.fillText('更好的沟通', 256, 210);
  ctx.fillText('遇见更好的自己', 256, 320);
  ctx.font = `500 44px ${FONT_BRUSH}`;
  ctx.textAlign = 'right';
  ctx.fillText('—— 阅境', 440, 450);
  const g = new THREE.Group();
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.375), new THREE.MeshStandardMaterial({ map: toTexture(c), roughness: 0.95, emissive: 0x5a4020, emissiveIntensity: 0.18 }));
  paper.castShadow = true;
  g.add(paper);
  [[-0.45, 0.6], [0.45, 0.6]].forEach(([x, y]) => {
    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), mats.brass);
    pin.position.set(x, y, 0.03);
    g.add(pin);
  });
  g.rotation.z = 0.05;
  return g;
}

function sunsetDoor(w, h) {
  const W = 512, H = Math.round(512 * (h / w));
  const [c, ctx] = makeCanvas(W, H);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#7a5ab0');
  g.addColorStop(0.35, '#e48a9a');
  g.addColorStop(0.62, '#ffb26a');
  g.addColorStop(1, '#ffe6a8');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const sg = ctx.createRadialGradient(W * 0.5, H * 0.66, 0, W * 0.5, H * 0.66, W * 0.55);
  sg.addColorStop(0, 'rgba(255,250,210,1)');
  sg.addColorStop(0.3, 'rgba(255,214,140,.65)');
  sg.addColorStop(1, 'rgba(255,170,90,0)');
  ctx.fillStyle = sg;
  ctx.fillRect(0, 0, W, H);
  const rng = mulberry32(17);
  ctx.fillStyle = 'rgba(60,40,90,.85)';
  let x = 0;
  while (x < W) {
    const bw = 24 + rng() * 40, bh = 60 + rng() * 150;
    ctx.fillRect(x, H * 0.78 - bh, bw, bh + H);
    x += bw + 2;
  }
  ctx.fillStyle = '#2c1d44';
  ctx.fillRect(0, H * 0.82, W, H);
  ctx.beginPath();
  ctx.moveTo(W * 0.42, H);
  ctx.lineTo(W * 0.58, H);
  ctx.lineTo(W * 0.53, H * 0.82);
  ctx.lineTo(W * 0.47, H * 0.82);
  ctx.closePath();
  ctx.fillStyle = '#4a3466';
  ctx.fill();
  // 背影：背包少年
  const px = W * 0.5, py = H * 0.9;
  ctx.fillStyle = '#16102a';
  ctx.beginPath();
  ctx.ellipse(px, py - 108, 14, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(px - 17, py - 94, 34, 58);
  ctx.fillStyle = '#2a2142';
  ctx.fillRect(px - 26, py - 90, 14, 44);
  ctx.fillStyle = '#16102a';
  ctx.fillRect(px - 15, py - 38, 12, 40);
  ctx.fillRect(px + 3, py - 38, 12, 40);
  return c;
}

// 通向“真实世界”的拱门：一块发光的日落画面嵌在木门框里
export function realWorldGate(mats) {
  const w = 2.3, h = 3.7;
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(-w / 2, h - w / 2);
  shape.absarc(0, h - w / 2, w / 2, Math.PI, 0, true);
  shape.lineTo(w / 2, 0);
  shape.closePath();
  const pic = new THREE.Mesh(new THREE.ShapeGeometry(shape, 32), matFromCanvas(sunsetDoor(w, h), 1.1));
  const uv = pic.geometry.attributes.uv, pos = pic.geometry.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + w / 2) / w, pos.getY(i) / h);
  pic.position.z = 0.06;
  g.add(pic);
  const outer = new THREE.Shape();
  const t = 0.24;
  outer.moveTo(-w / 2 - t, 0);
  outer.lineTo(-w / 2 - t, h - w / 2);
  outer.absarc(0, h - w / 2, w / 2 + t, Math.PI, 0, true);
  outer.lineTo(w / 2 + t, 0);
  outer.lineTo(w / 2, 0);
  outer.lineTo(w / 2, h - w / 2);
  outer.absarc(0, h - w / 2, w / 2, 0, Math.PI, false);
  outer.lineTo(-w / 2, 0);
  outer.closePath();
  const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(outer, { depth: 0.22, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2, curveSegments: 28 }), mats.woodDark);
  frame.castShadow = true;
  g.add(frame);
  const key = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.12), mats.brass);
  key.position.set(0, h + t - 0.1, 0.2);
  key.rotation.z = Math.PI / 4;
  g.add(key);
  const light = new THREE.PointLight(0xffa860, 22, 8, 2);
  light.position.set(0, 1.8, 1.4);
  g.add(light);
  const spill = glowSprite('warm', 5.2, 0.32);
  spill.position.set(0, 1.9, 0.5);
  g.add(spill);
  return g;
}

// 成长看板：可重绘的画布 + 点亮的星点。数据由 refreshWorld() 按真实练习记录重画。
export function growthBoard(mats) {
  const W = 800, H = 1000;
  const [c, ctx] = makeCanvas(W, H);
  const tex = toTexture(c);
  const mat = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.55, roughness: 0.7 });

  function draw(d) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#142348');
    g.addColorStop(1, '#0a1230');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#c9a55a';
    ctx.lineWidth = 5;
    ctx.strokeRect(18, 18, W - 36, H - 36);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f3d98e';
    ctx.font = `700 64px ${FONT_BRUSH}`;
    ctx.fillText('我的成长', 56, 112);
    ctx.fillStyle = 'rgba(233,201,122,.35)';
    ctx.fillRect(56, 138, W - 112, 2);
    const rows = [['已完成场景', String(d.scenes)], ['最近一次表现', d.delta], ['已点亮典籍', `${d.unlocked} / 6`]];
    rows.forEach(([k, v], i) => {
      const y = 220 + i * 116;
      ctx.fillStyle = '#b9c6ee';
      ctx.font = `500 34px ${FONT_SANS}`;
      ctx.fillText(k, 56, y);
      ctx.fillStyle = '#ffe9a8';
      ctx.font = `700 56px ${FONT_SERIF}`;
      ctx.textAlign = 'right';
      ctx.fillText(v, W - 56, y + 4);
      ctx.textAlign = 'left';
    });
    ctx.fillStyle = '#b9c6ee';
    ctx.font = `500 34px ${FONT_SANS}`;
    ctx.fillText('常见卡点', 56, 580);
    ctx.fillStyle = '#e9c78a';
    ctx.font = `500 38px ${FONT_SERIF}`;
    (d.stuck.length ? d.stuck : ['练过之后，这里会出现你常卡的地方']).forEach((s, i) => ctx.fillText(`· ${s}`, 56, 640 + i * 52));
    const cx = W / 2, cy = 872;
    for (let i = 0; i < 6; i++) {
      const x = 76 + i * 120, y = cy + Math.sin(i * 1.3) * 26;
      const on = i < d.unlocked;
      const gg = ctx.createRadialGradient(x, y, 0, x, y, on ? 26 : 12);
      gg.addColorStop(0, on ? 'rgba(255,236,170,1)' : 'rgba(120,140,190,.7)');
      gg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gg;
      ctx.fillRect(x - 28, y - 28, 56, 56);
      if (i) {
        ctx.strokeStyle = on ? 'rgba(255,224,150,.8)' : 'rgba(120,140,190,.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(76 + (i - 1) * 120, cy + Math.sin((i - 1) * 1.3) * 26);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    }
    void cx;
    tex.needsUpdate = true;
  }
  draw({ scenes: 0, delta: '—', unlocked: litCount(), stuck: [] });
  const g = new THREE.Group();
  g.add(box(1.86, 2.3, 0.1, mats.woodDark, 0, 0, 0));
  g.add(box(1.76, 2.2, 0.11, mats.brass, 0, 0, -0.004, false));
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.125), mat);
  face.position.z = 0.062;
  g.add(face);
  g.userData.draw = draw;
  return g;
}
