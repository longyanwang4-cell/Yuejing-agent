import * as THREE from 'three';
import { makeCanvas, toTexture } from '../core/tex.js';
import { mulberry32 } from '../core/util.js';
import { glowSprite } from '../world/glow.js';
import { FONT_SERIF } from '../config.js';
import { wipeIn, wipeOut } from '../ui/wipe.js';
import { api } from '../net/api.js';
import { STORIES } from '../history/story.js';
import { SESS, persistResult } from '../net/session.js';
import { buildPracticeUI } from './ui.js';

// 实景练习：和「历史典故」完全分开的第三个场景。
// 典故是书页上的微缩街景（看别人），这里是 1:1 的现代房间（你自己上场）。
const SHOTS = {
  // 进门：站在门口先看清屋子，再走到对面那个人跟前
  enter: { pos: new THREE.Vector3(-1.85, 1.60, 3.30), look: new THREE.Vector3(0.30, 1.42, 0.25), fov: 46 },
  // 对话机位：眼高，人偏右，左边整块留给台词
  face: { pos: new THREE.Vector3(-0.42, 1.58, 2.46), look: new THREE.Vector3(0.10, 1.36, 0.30), fov: 42 },
};

const M = {
  wall: new THREE.MeshStandardMaterial({ color: 0x2b2c3a, roughness: 0.95 }),
  wallSide: new THREE.MeshStandardMaterial({ color: 0x24252f, roughness: 0.95 }),
  floor: null, // 运行时再建（要贴图）
  ceiling: new THREE.MeshStandardMaterial({ color: 0x1a1b24, roughness: 1 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x1e1d24, roughness: 0.8 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x54402f, roughness: 0.72 }),
  // metalness 别给太高：这屋里没有环境贴图，纯金属只会变成「黑管子 + 一个白点」，
  // 椅腿在暗处就成了一片白色星芒。低金属度 + 高粗糙度，才像刷过漆的铁。
  metal: new THREE.MeshStandardMaterial({ color: 0x7d7a86, roughness: 0.55, metalness: 0.3 }),
  white: new THREE.MeshStandardMaterial({ color: 0xd9d5cb, roughness: 0.85 }),
  glow: new THREE.MeshBasicMaterial({ color: 0x9fd0ff, toneMapped: false }),
};

// ——————————————————————————————————————————————
// 房间
// ——————————————————————————————————————————————
function woodFloorTexture() {
  const [c, ctx] = makeCanvas(512, 512);
  const rng = mulberry32(9);
  ctx.fillStyle = '#4a382a';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 8; i++) {
    const y = i * 64;
    const v = 0.86 + rng() * 0.28;
    ctx.fillStyle = `rgb(${Math.round(74 * v)},${Math.round(56 * v)},${Math.round(42 * v)})`;
    ctx.fillRect(0, y, 512, 62);
    // 木纹
    for (let g = 0; g < 26; g++) {
      ctx.strokeStyle = `rgba(0,0,0,${0.04 + rng() * 0.07})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      const gy = y + rng() * 60;
      ctx.moveTo(0, gy);
      ctx.bezierCurveTo(170, gy + (rng() - 0.5) * 6, 340, gy + (rng() - 0.5) * 6, 512, gy);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.fillRect(0, y + 62, 512, 2);
  }
  return toTexture(c, { repeat: [3, 3] });
}

function cityTexture() {
  const [c, ctx] = makeCanvas(512, 384);
  const rng = mulberry32(21);
  const g = ctx.createLinearGradient(0, 0, 0, 384);
  g.addColorStop(0, '#0b1226');
  g.addColorStop(0.55, '#1c2544');
  g.addColorStop(1, '#4a3a52');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 384);
  // 远处的楼：一层层压下去
  for (let layer = 0; layer < 3; layer++) {
    const base = 384 - layer * 26;
    ctx.fillStyle = ['#131a30', '#0e1426', '#0a0f1c'][layer];
    let x = 0;
    while (x < 512) {
      const w = 22 + rng() * 44;
      const h = 40 + rng() * (150 - layer * 30);
      ctx.fillRect(x, base - h, w, h);
      x += w + 3 + rng() * 8;
    }
  }
  // 楼里的灯
  for (let i = 0; i < 260; i++) {
    const x = rng() * 512;
    const y = 200 + rng() * 170;
    ctx.fillStyle = rng() > 0.75 ? 'rgba(255,214,150,.85)' : 'rgba(150,190,255,.5)';
    ctx.fillRect(x, y, 1.6, 2.4);
  }
  // 虚化的光斑
  for (let i = 0; i < 26; i++) {
    const x = rng() * 512, y = 150 + rng() * 200, r = 6 + rng() * 20;
    const b = ctx.createRadialGradient(x, y, 0, x, y, r);
    b.addColorStop(0, rng() > 0.5 ? 'rgba(255,200,140,.4)' : 'rgba(150,200,255,.35)');
    b.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = b;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return toTexture(c);
}

function posterTexture() {
  const [c, ctx] = makeCanvas(256, 340);
  ctx.fillStyle = '#171821';
  ctx.fillRect(0, 0, 256, 340);
  ctx.strokeStyle = '#3a3c4e';
  ctx.lineWidth = 3;
  ctx.strokeRect(10, 10, 236, 320);
  ctx.fillStyle = '#c9a55a';
  ctx.font = `600 30px ${FONT_SERIF}`;
  ctx.textAlign = 'center';
  ctx.fillText('先 把 事 说 清', 128, 140);
  ctx.fillText('再 说 谁 对', 128, 190);
  ctx.fillStyle = '#5a5c72';
  ctx.font = `400 15px ${FONT_SERIF}`;
  ctx.fillText('— 写在墙上提醒自己 —', 128, 250);
  return toTexture(c);
}

// 两点之间拉一段圆柱：胳膊、腿都靠它摆，省得每个关节去猜旋转角
const _up = new THREE.Vector3(0, 1, 0);
const _d = new THREE.Vector3();
function limb(a, b, rEnd, rRoot, m) {
  _d.subVectors(b, a);
  const len = _d.length();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rEnd, rRoot, len, 12), m);
  mesh.position.copy(a).addScaledVector(_d, 0.5);
  mesh.quaternion.setFromUnitVectors(_up, _d.normalize());
  return mesh;
}

function box(w, h, d, m, x, y, z) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  b.position.set(x, y, z);
  b.castShadow = true;
  b.receiveShadow = true;
  return b;
}

// 黑板上留着上次班会没擦干净的板书 —— 教室靠这一块认
function chalkBoardTexture() {
  const [c, ctx] = makeCanvas(768, 312);
  ctx.fillStyle = '#1d2b25';
  ctx.fillRect(0, 0, 768, 312);
  const rng = mulberry32(31);
  // 擦痕
  for (let i = 0; i < 46; i++) {
    ctx.fillStyle = `rgba(226,238,226,${0.01 + rng() * 0.022})`;
    ctx.fillRect(rng() * 700, rng() * 280, 70 + rng() * 150, 14 + rng() * 42);
  }
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(234,242,232,0.84)';
  ctx.font = `600 34px ${FONT_SERIF}`;
  ctx.fillText('分工 · 复盘 · 谁负责', 48, 88);
  ctx.fillStyle = 'rgba(222,234,220,0.58)';
  ctx.font = `400 25px ${FONT_SERIF}`;
  ctx.fillText('1. 三段内容分别谁写', 48, 150);
  ctx.fillText('2. 改之前先对一遍', 48, 196);
  ctx.fillText('3. 下周一交', 48, 242);
  // 随手划的两道
  ctx.strokeStyle = 'rgba(234,242,232,0.34)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(520, 62); ctx.lineTo(700, 250);
  ctx.moveTo(556, 240); ctx.lineTo(724, 120);
  ctx.stroke();
  return toTexture(c);
}

// 办公桌上那块屏：暗色后台 + 几行条目
function monitorTexture() {
  const [c, ctx] = makeCanvas(384, 216);
  ctx.fillStyle = '#141b26';
  ctx.fillRect(0, 0, 384, 216);
  ctx.fillStyle = '#1b2534';
  ctx.fillRect(0, 0, 384, 22);
  const rng = mulberry32(12);
  for (let i = 0; i < 9; i++) {
    const y = 38 + i * 19;
    ctx.fillStyle = i === 2 ? 'rgba(122,168,220,.5)' : 'rgba(120,140,170,.22)';
    ctx.fillRect(16, y, 30 + rng() * 240, 8);
  }
  ctx.fillStyle = 'rgba(122,168,220,.55)';
  ctx.fillRect(16, 176, 120, 16);
  return toTexture(c);
}

// 投影幕上那一页：深蓝底 + 标题 + 几行字 + 四根柱子。
// 不写字就是一面镜子 —— 会议室靠这页 PPT 认。
function slideTexture() {
  const [c, ctx] = makeCanvas(512, 288);
  ctx.fillStyle = '#0e1725';
  ctx.fillRect(0, 0, 512, 288);
  ctx.fillStyle = '#13203a';
  ctx.fillRect(0, 0, 512, 8);
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(232,240,250,0.9)';
  ctx.font = `600 30px ${FONT_SERIF}`;
  ctx.fillText('本周进展 · 复盘', 36, 62);
  ctx.fillStyle = 'rgba(140,170,205,0.55)';
  ctx.font = `400 16px ${FONT_SERIF}`;
  ctx.fillText('Q3 第一次同步', 36, 90);
  // 四根柱子
  const bars = [58, 96, 74, 122];
  bars.forEach((h, i) => {
    const x = 36 + i * 46;
    ctx.fillStyle = i === 3 ? 'rgba(122,168,220,0.85)' : 'rgba(122,168,220,0.38)';
    ctx.fillRect(x, 240 - h, 28, h);
  });
  // 右侧几行条目
  const rng = mulberry32(9);
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i === 1 ? 'rgba(160,195,235,0.5)' : 'rgba(140,170,205,0.26)';
    ctx.fillRect(262, 122 + i * 26, 70 + rng() * 150, 8);
  }
  ctx.strokeStyle = 'rgba(140,170,205,0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(36, 244); ctx.lineTo(476, 244);
  ctx.stroke();
  return toTexture(c);
}

// 一间屋子的壳：地板、四面墙、窗、吊灯、地毯、灯。哪一篇典故来都共用。
function buildShell() {
  const g = new THREE.Group();

  // 地面 / 墙 / 天花
  M.floor = new THREE.MeshStandardMaterial({ map: woodFloorTexture(), roughness: 0.72 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 7.4), M.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);

  const backWall = box(7.4, 2.9, 0.12, M.wall, 0, 1.45, -2.30);
  const leftWall = box(0.12, 2.9, 7.4, M.wallSide, -3.65, 1.45, 0);
  const rightWall = box(0.12, 2.9, 7.4, M.wallSide, 3.65, 1.45, 0);
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 7.4), M.ceiling);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = 2.85;
  g.add(backWall, leftWall, rightWall, ceiling);

  // 踢脚线
  g.add(box(7.4, 0.09, 0.03, M.dark, 0, 0.045, -2.22));
  g.add(box(0.03, 0.09, 7.4, M.dark, -3.58, 0.045, 0));
  g.add(box(0.03, 0.09, 7.4, M.dark, 3.58, 0.045, 0));

  // —— 窗：整间屋子的冷光源。教室要换成黑板，所以整组挂在一起 ——
  const WX = 1.05, WY = 1.78, WW = 1.7, WH = 1.15;
  const windowSet = new THREE.Group();
  const win = new THREE.Group();
  win.position.set(WX, WY, -2.23);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(WW, WH),
    new THREE.MeshBasicMaterial({ map: cityTexture(), toneMapped: false }));
  win.add(glass);
  // 窗框
  const frameM = M.dark;
  win.add(box(WW + 0.1, 0.06, 0.07, frameM, 0, WH / 2 + 0.03, 0.02));
  win.add(box(WW + 0.1, 0.06, 0.07, frameM, 0, -WH / 2 - 0.03, 0.02));
  win.add(box(0.06, WH + 0.12, 0.07, frameM, -WW / 2 - 0.03, 0, 0.02));
  win.add(box(0.06, WH + 0.12, 0.07, frameM, WW / 2 + 0.03, 0, 0.02));
  win.add(box(0.04, WH, 0.05, frameM, 0, 0, 0.02));
  win.add(box(WW, 0.04, 0.05, frameM, 0, 0.08, 0.02));
  // 窗台
  win.add(box(WW + 0.24, 0.05, 0.2, M.white, 0, -WH / 2 - 0.08, 0.08));
  windowSet.add(win);
  // 窗外漏进来的光
  const winGlow = glowSprite('cool', 3.4, 0.3);
  winGlow.position.set(WX, WY, -2.0);
  windowSet.add(winGlow);
  // 窗帘：两侧垂下的布。颜色别压太死 —— 太暗就是一左一右两根黑柱子，
  // 正对着人的后脑勺，比不挂还碍眼。
  [-1, 1].forEach((s) => {
    const cur = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 2.35, 10, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x4a4f6b, roughness: 1, side: THREE.DoubleSide }));
    cur.position.set(WX + s * (WW / 2 + 0.16), 1.45, -2.12);
    cur.scale.z = 0.45;
    windowSet.add(cur);
  });
  windowSet.add(box(WW + 0.7, 0.04, 0.04, M.metal, WX, 2.68, -2.12));
  g.add(windowSet);

  // —— 吊灯：整屋的暖光源 ——
  const lamp = new THREE.Group();
  lamp.position.set(-0.55, 0, -0.55);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.56, 6), M.dark);
  cord.position.y = 2.575;
  // 罩口朝下：锥尖在上、敞口在下，灯就从敞口里漏出来
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.2, 22, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x302b2b, roughness: 0.6, side: THREE.DoubleSide, metalness: 0.3 }));
  shade.position.y = 2.2;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xffd7a0, toneMapped: false }));
  bulb.position.y = 2.09;
  const lampGlow = glowSprite('warm', 1.5, 0.5);
  lampGlow.position.y = 2.09;
  lamp.add(cord, shade, bulb, lampGlow);
  g.add(lamp);

  // —— 地毯 ——
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.6),
    new THREE.MeshStandardMaterial({ color: 0x2a2b3c, roughness: 1 }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0.1, 0.008, 0.55);
  rug.receiveShadow = true;
  g.add(rug);
  const rugInner = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 2.2),
    new THREE.MeshStandardMaterial({ color: 0x343349, roughness: 1 }));
  rugInner.rotation.x = -Math.PI / 2;
  rugInner.position.set(0.1, 0.012, 0.55);
  g.add(rugInner);

  // —— 光 ——
  const hemi = new THREE.HemisphereLight(0x5a6c9e, 0x1a1520, 1.05);
  g.add(hemi);

  // 反打补光：主光在背后，人整个是黑的 —— 这一盏专管把脸捞回来。
  // 放在镜头这一侧偏左，暖一点，强度压得很低，只够看清表情，不破坏逆光。
  const faceFill = new THREE.PointLight(0xffd2a6, 4.2, 6.5, 2);
  faceFill.position.set(-0.35, 1.86, 1.75);
  g.add(faceFill);

  const key = new THREE.PointLight(0xffc487, 16, 9, 2);
  key.position.set(-0.55, 2.05, -0.55);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.3;
  key.shadow.camera.far = 9;
  key.shadow.bias = -0.002;
  g.add(key);

  // 窗光：冷、斜、从背后打过来，把人勾一道边
  const moon = new THREE.DirectionalLight(0x9dc2ff, 2.4);
  moon.position.set(2.6, 3.0, -3.4);
  moon.target.position.set(0.2, 0.8, 0.6);
  g.add(moon, moon.target);

  const winFill = new THREE.PointLight(0x8fb6ff, 8, 7, 2);
  winFill.position.set(1.05, 1.85, -1.95);
  g.add(winFill);

  const screenLight = new THREE.PointLight(0x8fc4ff, 3.2, 3.2, 2);
  screenLight.position.set(-1.4, 0.95, -1.9);
  g.add(screenLight);

  return { group: g, windowSet, key, moon, winFill };
}

// ——————————————————————————————————————————————
// 五套布景：宿舍 / 教室 / 办公室 / 会议室
// 壳子是同一间屋，换的是屋里那点东西 —— 但「教室」和「宿舍」的差别不在家具，
// 在第一眼：黑板还是床。
// ——————————————————————————————————————————————

// 课桌：一张桌面 + 四条铁腿 + 桌肚
function studentDesk(x, z, ry = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  g.add(box(0.62, 0.04, 0.36, M.wood, 0, 0.72, 0));
  [[-0.27, -0.15], [0.27, -0.15], [-0.27, 0.15], [0.27, 0.15]].forEach(([lx, lz]) => {
    g.add(box(0.028, 0.72, 0.028, M.metal, lx, 0.36, lz));
  });
  g.add(box(0.56, 0.02, 0.3, M.dark, 0, 0.5, 0));
  // 椅子
  g.add(box(0.4, 0.035, 0.38, M.wood, 0, 0.43, 0.46));
  g.add(box(0.4, 0.34, 0.03, M.wood, 0, 0.6, 0.65));
  [[-0.16, 0.3], [0.16, 0.3], [-0.16, 0.6], [0.16, 0.6]].forEach(([lx, lz]) => {
    g.add(box(0.024, 0.43, 0.024, M.metal, lx, 0.215, lz));
  });
  return g;
}

// 办公椅：坐垫 + 靠背 + 一根柱子 + 五只脚
function officeChair(x, z, ry = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  g.add(box(0.44, 0.07, 0.42, M.dark, 0, 0.46, 0));
  const back = box(0.42, 0.46, 0.06, M.dark, 0, 0.73, 0.2);
  back.rotation.x = 0.12;
  g.add(back);
  g.add(box(0.05, 0.4, 0.05, M.metal, 0, 0.25, 0));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const leg = box(0.04, 0.04, 0.3, M.metal, Math.sin(a) * 0.14, 0.05, Math.cos(a) * 0.14);
    leg.rotation.y = a;
    g.add(leg);
  }
  return g;
}

// 挂钟：一个圆形 + 两根针，便宜但一眼认得出
function wallClock(x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.16, 24), M.white);
  g.add(face);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.012, 8, 24), M.dark);
  g.add(rim);
  const hh = box(0.014, 0.09, 0.006, M.dark, 0.02, 0.03, 0.006);
  hh.rotation.z = -0.5;
  g.add(hh);
  const mh = box(0.01, 0.13, 0.006, M.dark, -0.015, 0.05, 0.008);
  mh.rotation.z = 0.25;
  g.add(mh);
  return g;
}

// —— 宿舍 ——
function buildDorm() {
  const g = new THREE.Group();

  // 床：靠右墙，被子压一半，枕头在靠窗那头
  const bed = new THREE.Group();
  bed.position.set(2.52, 0, -1.02);
  bed.add(box(1.18, 0.1, 2.08, M.dark, 0, 0.32, 0));
  [[-0.54, -0.98], [0.54, -0.98], [-0.54, 0.98], [0.54, 0.98]].forEach(([x, z]) => {
    bed.add(box(0.07, 0.3, 0.07, M.metal, x, 0.15, z));
  });
  bed.add(box(1.12, 0.16, 2.02, new THREE.MeshStandardMaterial({ color: 0xcfc7ba, roughness: 0.95 }), 0, 0.45, 0));
  bed.add(box(1.16, 0.1, 1.36, new THREE.MeshStandardMaterial({ color: 0x3f4a68, roughness: 1 }), 0, 0.53, 0.28));
  bed.add(box(1.16, 0.06, 0.22, new THREE.MeshStandardMaterial({ color: 0x59668a, roughness: 1 }), 0, 0.56, -0.44));
  const pillow = box(0.64, 0.13, 0.34, new THREE.MeshStandardMaterial({ color: 0xe2dbcf, roughness: 1 }), 0, 0.55, -0.8);
  pillow.rotation.x = -0.06;
  bed.add(pillow);
  bed.add(box(1.2, 0.62, 0.06, M.wood, 0, 0.56, -1.04));
  g.add(bed);

  // 书桌 + 笔记本
  const desk = new THREE.Group();
  desk.position.set(-1.65, 0, -2.02);
  desk.add(box(2.2, 0.06, 0.72, M.wood, 0, 0.75, 0));
  [[-1.02, -0.28], [1.02, -0.28], [-1.02, 0.28], [1.02, 0.28]].forEach(([x, z]) => {
    desk.add(box(0.07, 0.75, 0.07, M.metal, x, 0.375, z));
  });
  const laptop = new THREE.Group();
  laptop.position.set(0.25, 0.78, 0.05);
  laptop.add(box(0.36, 0.016, 0.25, M.metal, 0, 0, 0));
  const lid = box(0.36, 0.24, 0.014, M.metal, 0, 0.12, -0.12);
  lid.rotation.x = -0.22;
  laptop.add(lid);
  const screenGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.2), M.glow);
  screenGlow.position.set(0, 0.12, -0.108);
  screenGlow.rotation.x = -0.22;
  laptop.add(screenGlow);
  desk.add(laptop);
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.036, 0.095, 14), M.white);
  mug.position.set(-0.16, 0.828, 0.16);
  desk.add(mug);
  desk.add(box(0.22, 0.035, 0.3, new THREE.MeshStandardMaterial({ color: 0x8a3a34, roughness: 0.9 }), -0.62, 0.795, 0.02));
  desk.add(box(0.2, 0.03, 0.28, new THREE.MeshStandardMaterial({ color: 0x2f4a5a, roughness: 0.9 }), -0.63, 0.828, 0.03));
  g.add(desk);

  // 海报
  const poster = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.82),
    new THREE.MeshStandardMaterial({ map: posterTexture(), roughness: 0.95 }));
  poster.position.set(-1.9, 1.72, -2.22);
  g.add(poster);

  // 角落：绿植
  const plant = new THREE.Group();
  plant.position.set(1.52, 0, -1.74);
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.14, 0.34, 14),
    new THREE.MeshStandardMaterial({ color: 0x5a4436, roughness: 0.9 }));
  pot.position.y = 0.17;
  plant.add(pot);
  const rr = mulberry32(77);
  for (let i = 0; i < 9; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.11 + rr() * 0.07, 8, 6),
      new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.32, 0.35, 0.16 + rr() * 0.1), roughness: 1 }));
    leaf.scale.set(1, 0.5, 1.5);
    leaf.position.set((rr() - 0.5) * 0.42, 0.42 + rr() * 0.4, (rr() - 0.5) * 0.42);
    leaf.rotation.set(rr() * 0.6, rr() * 3.14, rr() * 0.6);
    plant.add(leaf);
  }
  g.add(plant);

  // 床头那面墙：一块层板，两本书、一个相框 —— 宿舍的「住过人」全靠这点零碎
  const shelf = new THREE.Group();
  shelf.position.set(2.62, 1.94, -2.2);
  shelf.add(box(0.92, 0.035, 0.17, M.wood, 0, 0, 0));
  shelf.add(box(0.06, 0.14, 0.15, M.metal, -0.4, -0.08, 0));
  shelf.add(box(0.06, 0.14, 0.15, M.metal, 0.4, -0.08, 0));
  [[0.05, 0.2], [0.07, 0.16]].forEach(([h, w], i) => {
    shelf.add(box(0.035, h, w, new THREE.MeshStandardMaterial({ color: [0x7a4a3c, 0x3d5a6a][i], roughness: 0.9 }), -0.3 + i * 0.05, 0.018 + h / 2, 0));
  });
  const frame = box(0.19, 0.15, 0.018, M.dark, 0.22, 0.09, 0);
  frame.rotation.z = 0.04;
  shelf.add(frame);
  shelf.add(box(0.15, 0.11, 0.004, new THREE.MeshStandardMaterial({ color: 0xc9bfae, roughness: 1 }), 0.22, 0.09, 0.011));
  g.add(shelf);

  // 床底：塞一只箱子，别让床下面空成一道影
  g.add(box(0.86, 0.27, 0.52, new THREE.MeshStandardMaterial({ color: 0x2c3244, roughness: 0.9 }), 2.46, 0.14, 0.42));
  g.add(box(0.16, 0.03, 0.02, M.metal, 2.46, 0.22, 0.69));

  // 拖鞋：一双，一正一反
  [-1, 1].forEach((s, i) => {
    const sl = box(0.1, 0.045, 0.24, new THREE.MeshStandardMaterial({ color: 0x4a5468, roughness: 1 }), 1.82 + i * 0.14, 0.024, -0.3);
    sl.rotation.y = 0.18 + i * 0.22;
    g.add(sl);
  });

  return g;
}

// —— 教室 · 班会 ——
function buildClassroom() {
  const g = new THREE.Group();

  // 黑板：后墙偏左。右边留给窗 —— 教室的冷光就是从那儿来的
  const board = new THREE.Mesh(new THREE.PlaneGeometry(2.42, 1.0),
    new THREE.MeshStandardMaterial({ map: chalkBoardTexture(), roughness: 0.96 }));
  board.position.set(-0.05, 1.72, -2.235);
  g.add(board);
  g.add(box(2.58, 0.06, 0.07, M.wood, -0.05, 2.25, -2.21));
  g.add(box(2.58, 0.06, 0.07, M.wood, -0.05, 1.19, -2.21));
  g.add(box(0.06, 1.12, 0.07, M.wood, -1.31, 1.72, -2.21));
  g.add(box(0.06, 1.12, 0.07, M.wood, 1.21, 1.72, -2.21));
  // 粉笔槽
  g.add(box(2.28, 0.03, 0.12, M.metal, -0.05, 1.165, -2.17));
  g.add(box(0.07, 0.022, 0.022, M.white, 0.5, 1.19, -2.16));
  g.add(box(0.07, 0.022, 0.022, M.white, 0.62, 1.19, -2.16));

  // 课桌：一排三张，都在人身后
  [[-1.55, -1.3], [-0.15, -1.3], [1.25, -1.3]].forEach(([x, z]) => g.add(studentDesk(x, z)));
  // 第二排在左边稍前 —— 只露个边，让教室有纵深
  g.add(studentDesk(-2.55, -0.35, 0.08));

  // 课桌上的东西：一摞书、一个笔袋、一只水杯。空桌子一眼就是道具
  const bookM = [0x8a3a34, 0x2f4a5a, 0xc7b98e];
  [-1.55, -0.15, 1.25].forEach((x, i) => {
    g.add(box(0.2, 0.026, 0.15, new THREE.MeshStandardMaterial({ color: bookM[i], roughness: 0.9 }), x - 0.06, 0.755, -1.3));
    g.add(box(0.18, 0.02, 0.14, new THREE.MeshStandardMaterial({ color: bookM[(i + 1) % 3], roughness: 0.9 }), x - 0.05, 0.778, -1.31));
    const pen = box(0.16, 0.03, 0.05, new THREE.MeshStandardMaterial({ color: 0x3d4a5c, roughness: 0.95 }), x + 0.16, 0.755, -1.24);
    pen.rotation.y = 0.3;
    g.add(pen);
  });
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.11, 12), M.white);
  cup.position.set(1.25, 0.8, -1.18);
  g.add(cup);

  // 讲台：靠右下，压住窗户前面那块空地，也把镜头右边填上
  const podium = new THREE.Group();
  podium.position.set(2.62, 0, -1.12);
  podium.add(box(1.02, 0.05, 0.5, M.wood, 0, 0.77, 0));
  podium.add(box(0.96, 0.62, 0.04, M.wood, 0, 0.46, 0.22));
  [[-0.44, -0.2], [0.44, -0.2], [-0.44, 0.2], [0.44, 0.2]].forEach(([x, z]) => {
    podium.add(box(0.05, 0.75, 0.05, M.metal, x, 0.375, z));
  });
  // 台上：一摞作业本 + 粉笔盒
  const hw = [0xd8cfc0, 0xc9c0b4, 0xe0d8c8];
  hw.forEach((c, i) => podium.add(box(0.3, 0.028, 0.22,
    new THREE.MeshStandardMaterial({ color: c, roughness: 0.95 }), -0.26, 0.81 + i * 0.028, 0)));
  podium.add(box(0.15, 0.07, 0.1, M.dark, -0.26, 0.9, 0));
  podium.add(box(0.06, 0.05, 0.04, M.white, 0.3, 0.82, 0.08));
  g.add(podium);

  // 黑板上方的挂钟：中国教室里最标准的那一格，也把墙顶那条空带补上
  // 往右挪开吊灯的绳子，不然两个圆挤在一起
  g.add(wallClock(0.38, 2.5, -2.235));

  // 学习园地：挂右墙。这面墙正对着镜头右边，不挂东西就是一整块空蓝
  const yq = new THREE.Group();
  // 右墙内表面在 x=3.59，板子必须退到 3.55，不然整块埋进墙里，只剩几张纸浮着
  yq.position.set(3.55, 1.66, 0.15);
  yq.rotation.y = -Math.PI / 2;
  // 板子本身要足够亮，不然在暗墙前只剩几张纸浮在空中
  yq.add(box(1.9, 1.02, 0.04, new THREE.MeshStandardMaterial({ color: 0xb8a894, roughness: 0.8 }), 0, 0, 0));
  const cork = new THREE.Mesh(new THREE.PlaneGeometry(1.78, 0.9),
    new THREE.MeshStandardMaterial({ color: 0xa8845c, roughness: 0.95 }));
  cork.position.z = 0.024;
  yq.add(cork);
  // 钉上去的纸：大小不一、各自歪一点，才像人贴的
  const paperC = [0xe8e2d3, 0xdcd5c4, 0xf0ebdc, 0xe0d9c7];
  [[-0.6, 0.22, 0.06], [-0.24, 0.24, -0.05], [0.12, 0.21, 0.04], [0.46, 0.23, -0.06],
   [-0.42, -0.24, -0.03], [0.02, -0.26, 0.05], [0.4, -0.23, -0.04]].forEach(([x, y, r], i) => {
    const p = box(0.26, 0.32, 0.006, new THREE.MeshStandardMaterial({ color: paperC[i % 4], roughness: 1 }), x, y, 0.03);
    p.rotation.z = r;
    yq.add(p);
  });
  // 两张奖状：红框黄底，一眼就是「班级荣誉」
  [[-0.14, 0.18], [0.2, -0.06]].forEach(([x, y]) => {
    yq.add(box(0.34, 0.24, 0.005, new THREE.MeshStandardMaterial({ color: 0x8f3b2f, roughness: 1 }), x, y, 0.033));
    yq.add(box(0.3, 0.2, 0.005, new THREE.MeshStandardMaterial({ color: 0xdcbf7f, roughness: 1 }), x, y, 0.036));
  });
  g.add(yq);

  return g;
}

// —— 办公室 · 周五傍晚 ——
function buildOffice() {
  const g = new THREE.Group();

  // 工位：右后方，显示器亮着
  const desk = new THREE.Group();
  desk.position.set(1.35, 0, -1.5);
  desk.add(box(1.84, 0.055, 0.84, M.wood, 0, 0.735, 0));
  [[-0.86, -0.35], [0.86, -0.35], [-0.86, 0.35], [0.86, 0.35]].forEach(([x, z]) => {
    desk.add(box(0.06, 0.71, 0.06, M.metal, x, 0.355, z));
  });
  // 显示器
  desk.add(box(0.74, 0.44, 0.03, M.dark, 0, 1.1, -0.24));
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.38),
    new THREE.MeshBasicMaterial({ map: monitorTexture(), toneMapped: false }));
  scr.position.set(0, 1.1, -0.222);
  desk.add(scr);
  desk.add(box(0.16, 0.2, 0.05, M.dark, 0, 0.87, -0.24));
  desk.add(box(0.4, 0.02, 0.13, M.white, 0, 0.772, 0.04));
  // 键盘 + 鼠标 + 一摞文件 + 杯子
  desk.add(box(0.44, 0.014, 0.15, M.dark, 0, 0.77, 0.1));
  desk.add(box(0.06, 0.02, 0.1, M.dark, 0.32, 0.77, 0.1));
  desk.add(box(0.22, 0.05, 0.3, new THREE.MeshStandardMaterial({ color: 0xd9d3c4, roughness: 0.95 }), -0.62, 0.79, 0.02));
  desk.add(box(0.21, 0.02, 0.29, new THREE.MeshStandardMaterial({ color: 0xb9c2cf, roughness: 0.95 }), -0.61, 0.826, 0.03));
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.036, 0.095, 14), M.white);
  mug.position.set(0.62, 0.81, 0.18);
  desk.add(mug);

  // 台灯：这排工位唯一的暖光。右后角本来是纯黑，一盏灯就把那半边捞回来了
  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.02, 16), M.dark);
  lampBase.position.set(0.82, 0.7725, -0.18);
  desk.add(lampBase);
  const lampArm = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.34, 8), M.metal);
  lampArm.position.set(0.82, 0.95, -0.18);
  lampArm.rotation.z = 0.18;
  desk.add(lampArm);
  const lampShade = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.14, 18, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xc9b46a, roughness: 0.6, side: THREE.DoubleSide }));
  lampShade.position.set(0.78, 1.1, -0.18);
  lampShade.rotation.z = 0.2;
  desk.add(lampShade);
  const lampBulb = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffdcae, toneMapped: false }));
  lampBulb.position.set(0.78, 1.045, -0.18);
  desk.add(lampBulb);
  const lampLight = new THREE.PointLight(0xffcb8e, 2.4, 2.6, 2);
  lampLight.position.set(0.78, 1.0, -0.14);
  desk.add(lampLight);
  g.add(desk);

  // 椅子：被推开了一半
  g.add(officeChair(1.15, -0.72, 0.5));

  // 文件柜：深灰金属，拉手要亮，不然在暗处就是一坨影子
  const cab = new THREE.Group();
  cab.position.set(3.15, 0, -1.75);
  const steel = new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.62, metalness: 0.25 });
  cab.add(box(0.5, 1.25, 0.42, steel, 0, 0.625, 0));
  [0.28, 0.75, 1.1].forEach((y) => {
    cab.add(box(0.44, 0.02, 0.012, M.dark, 0, y, 0.213));
    cab.add(box(0.11, 0.018, 0.02, new THREE.MeshStandardMaterial({ color: 0xb9c0ca, roughness: 0.35, metalness: 0.6 }), 0, y - 0.09, 0.218));
  });
  // 柜顶：一盆小绿植 + 一摞文件夹
  const cp = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.075, 0.16, 12), new THREE.MeshStandardMaterial({ color: 0x6a5a4a, roughness: 0.9 }));
  cp.position.set(-0.1, 1.33, 0);
  cab.add(cp);
  for (let i = 0; i < 5; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6),
      new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.33, 0.3, 0.2 + (i % 3) * 0.05), roughness: 1 }));
    leaf.scale.set(1, 0.55, 1.4);
    leaf.position.set(-0.1 + (i - 2) * 0.035, 1.44 + (i % 2) * 0.055, (i % 3 - 1) * 0.05);
    leaf.rotation.set(i * 0.4, i * 1.1, 0);
    cab.add(leaf);
  }
  [0, 1, 2].forEach((i) => cab.add(box(0.26, 0.026, 0.2,
    new THREE.MeshStandardMaterial({ color: [0xc9b46a, 0x8aa0b8, 0xd0cabb][i], roughness: 0.9 }), 0.12, 1.265 + i * 0.027, 0.02)));
  g.add(cab);

  // 挂钟：挪到柜子正上方。原来那个位置正好卡在人脑袋后面，只露出半个月亮
  g.add(wallClock(3.0, 2.06, -2.22));

  // 白板：原来贴在左后墙，整块被界面卡片挡住，等于白做。挪到右墙才有用
  const wb = new THREE.Group();
  wb.position.set(3.55, 1.62, 0.22);
  wb.rotation.y = -Math.PI / 2;
  wb.add(box(1.24, 0.86, 0.04, M.metal, 0, 0, 0));
  const wbFace = new THREE.Mesh(new THREE.PlaneGeometry(1.14, 0.76),
    new THREE.MeshStandardMaterial({ color: 0xd8dee2, roughness: 0.55 }));
  wbFace.position.z = 0.024;
  wb.add(wbFace);
  // 便利贴 + 几行没写完的笔迹
  [[-0.34, 0.2, 0xd8a84a], [0.3, 0.24, 0x7fb2a0], [0.03, -0.2, 0xd08a7a]].forEach(([x, y, c], i) => {
    const s = box(0.14, 0.14, 0.004, new THREE.MeshStandardMaterial({ color: c, roughness: 0.95 }), x, y, 0.028);
    s.rotation.z = (i - 1) * 0.09;
    wb.add(s);
  });
  [0, 1, 2].forEach((i) => wb.add(box(0.5 - i * 0.12, 0.012, 0.004, M.dark, 0.18, 0.04 - i * 0.07, 0.03)));
  wb.add(box(1.2, 0.03, 0.07, M.metal, 0, -0.45, 0.05));
  g.add(wb);

  return g;
}

// —— 会议室 · 汇报中途 ——
function buildMeeting() {
  const g = new THREE.Group();

  // 长桌：贴着右后方，椅子两边各三把
  const table = new THREE.Group();
  table.position.set(1.85, 0, -0.9);
  table.add(box(1.16, 0.06, 2.5, M.wood, 0, 0.73, 0));
  table.add(box(0.92, 0.7, 0.07, M.metal, 0, 0.36, -1.12));
  table.add(box(0.92, 0.7, 0.07, M.metal, 0, 0.36, 1.12));
  // 桌上：一排水杯、摊开的本子
  [-0.7, 0.15, 0.9].forEach((z) => {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.03, 0.1, 12), M.white);
    cup.position.set(0.28, 0.81, z);
    table.add(cup);
  });
  table.add(box(0.3, 0.02, 0.22, M.white, -0.2, 0.77, 0.1));
  table.add(box(0.28, 0.012, 0.2, M.dark, -0.2, 0.782, 0.12));
  g.add(table);

  [-0.95, 0.1, 1.0].forEach((z) => {
    g.add(officeChair(0.95, z, -Math.PI / 2));
    g.add(officeChair(2.72, z, Math.PI / 2));
  });

  // 投影幕：落在右墙，会议室的第三块屏。幕上得有东西在放
  const screen = new THREE.Group();
  screen.position.set(3.56, 1.62, -0.9);
  screen.rotation.y = -Math.PI / 2;
  screen.add(box(1.5, 0.9, 0.04, M.white, 0, 0, 0));
  const slide = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 0.76),
    new THREE.MeshBasicMaterial({ map: slideTexture(), toneMapped: false }));
  slide.position.z = 0.025;
  screen.add(slide);
  const spill = glowSprite('cool', 1.9, 0.22);
  spill.position.set(0, 0, 0.06);
  screen.add(spill);
  g.add(screen);

  // 挂钟放左边：原来在 x=0.2，正好被窗框切掉半个月亮，像贴纸没贴正
  g.add(wallClock(-0.95, 2.0, -2.22));

  return g;
}

// ——————————————————————————————————————————————
// 对面那个人：现代的，1:1
// ——————————————————————————————————————————————
function buildOpponent({ hoodie = 0x51618a, jeans = 0x2e3547, hair = 0x272129, phone = true } = {}) {
  const g = new THREE.Group();
  const hoodieM = new THREE.MeshStandardMaterial({ color: hoodie, roughness: 0.93 });
  const hoodieDark = new THREE.MeshStandardMaterial({ color: 0x39435e, roughness: 0.95 });
  const trimM = new THREE.MeshStandardMaterial({ color: 0x6b7ba6, roughness: 0.9 });
  const jeanM = new THREE.MeshStandardMaterial({ color: jeans, roughness: 0.88 });
  const skinM = new THREE.MeshStandardMaterial({ color: 0xe0b99c, roughness: 0.68 });
  const hairM = new THREE.MeshStandardMaterial({ color: hair, roughness: 0.82 });
  const shoeM = new THREE.MeshStandardMaterial({ color: 0x1d1d24, roughness: 0.78 });

  // 腿：大腿 / 小腿分开，膝上有个转折，不是一根直棍
  [-1, 1].forEach((s) => {
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.086, 0.072, 0.46, 12), jeanM);
    thigh.position.set(s * 0.093, 0.665, 0);
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.056, 0.42, 12), jeanM);
    shin.position.set(s * 0.093, 0.245, 0.006);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.082, 0.27), shoeM);
    shoe.position.set(s * 0.093, 0.041, 0.048);
    g.add(thigh, shin, shoe);
  });

  // 胯
  const hips = new THREE.Mesh(new THREE.CylinderGeometry(0.163, 0.148, 0.26, 16), jeanM);
  hips.position.y = 0.94;
  g.add(hips);

  // 上身：连帽衫，肩比腰宽一点点就够 —— 再宽就是棋子了
  // 下摆盖到胯上：连帽衫本来就长，也省掉一圈和裤子打架的罗纹
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.183, 0.168, 0.46, 18), hoodieM);
  torso.position.y = 1.215;
  // 肩头：两颗球，比一整片圆盘自然
  const shoulderL = new THREE.Mesh(new THREE.SphereGeometry(0.079, 12, 10), hoodieM);
  shoulderL.position.set(-0.148, 1.415, 0);
  const shoulderR = shoulderL.clone();
  shoulderR.position.x = 0.148;
  // 帽兜：堆在颈后，要比肩高出来一点
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.155, 14, 10), hoodieDark);
  hood.scale.set(1.1, 0.92, 0.68);
  hood.position.set(0, 1.44, -0.105);
  // 抽绳：连帽衫的辨识点，比贴一块口袋布干净
  g.add(hips, torso, shoulderL, shoulderR, hood);
  [-1, 1].forEach((s) => {
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.13, 6), trimM);
    cord.position.set(s * 0.052, 1.335, 0.166);
    cord.rotation.x = 0.06;
    g.add(cord);
  });

  // 手臂：一边垂下，一边抬到胸前看手机
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const rShoulder = V(0.152, 1.405, 0);
  const rElbow = V(0.207, 1.125, 0.01);
  const rWrist = V(0.222, 0.862, 0.035);
  const rightHand = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 8), skinM);
  rightHand.scale.set(0.85, 1.15, 0.9);
  rightHand.position.copy(rWrist).add(V(0.004, -0.028, 0.006));
  g.add(limb(rShoulder, rElbow, 0.049, 0.058, hoodieM),
        limb(rElbow, rWrist, 0.041, 0.05, hoodieM),
        rightHand);

  const lShoulder = V(-0.152, 1.405, 0);
  const lElbow = V(-0.248, 1.16, 0.055);
  const lWrist = V(-0.182, 1.228, 0.255);
  const leftHand = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 8), skinM);
  leftHand.scale.set(0.85, 1.15, 0.85);
  leftHand.position.copy(lWrist);
  g.add(limb(lShoulder, lElbow, 0.049, 0.058, hoodieM),
        limb(lElbow, lWrist, 0.041, 0.05, hoodieM),
        leftHand);

  if (phone) {
    const ph = new THREE.Group();
    ph.position.copy(lWrist).add(V(0.008, 0.048, 0.042));
    ph.rotation.set(-0.52, 0.26, 0.04);
    ph.add(box(0.073, 0.142, 0.008, new THREE.MeshStandardMaterial({ color: 0x121218, roughness: 0.5 }), 0, 0, 0));
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.064, 0.126),
      new THREE.MeshBasicMaterial({ color: 0xa8d4ff, toneMapped: false }));
    scr.position.z = 0.006;
    ph.add(scr);
    const sw = glowSprite('cool', 0.34, 0.45);
    sw.position.z = 0.02;
    ph.add(sw);
    g.add(ph);
  }

  // 颈 + 头
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.049, 0.058, 0.1, 12), skinM);
  neck.position.y = 1.5;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 16), skinM);
  head.scale.set(0.96, 1.16, 1.02);
  head.position.y = 1.625;
  // 发帽只盖到眉线以上 —— 压过眼睛就成了墨镜
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.107, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.38), hairM);
  hairCap.scale.set(0.97, 1.14, 1.04);
  hairCap.position.set(0, 1.629, -0.008);
  // 刘海：额前一小团，往后再收一点，别盖住眉
  const fringe = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 10), hairM);
  fringe.scale.set(0.92, 0.42, 0.55);
  fringe.position.set(0, 1.678, 0.058);
  fringe.rotation.x = -0.3;
  // 后颈的头发
  const nape = new THREE.Mesh(new THREE.SphereGeometry(0.093, 14, 8, 0, Math.PI, 0, Math.PI * 0.4), hairM);
  nape.position.set(0, 1.6, -0.018);
  nape.rotation.y = Math.PI;
  nape.scale.set(1.02, 1.1, 1.06);
  g.add(neck, head, hairCap, fringe, nape);

  // 五官
  [-1, 1].forEach((s) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.0145, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x1a161c, roughness: 0.35 }));
    eye.scale.set(1, 1.1, 0.7);
    eye.position.set(s * 0.037, 1.634, 0.089);
    g.add(eye);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.008, 0.008),
      new THREE.MeshStandardMaterial({ color: 0x2a2229, roughness: 0.8 }));
    brow.position.set(s * 0.037, 1.667, 0.088);
    brow.rotation.z = s * 0.1;
    g.add(brow);
    // 耳朵
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), skinM);
    ear.scale.set(0.5, 1.2, 0.9);
    ear.position.set(s * 0.098, 1.622, -0.004);
    g.add(ear);
  });
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.045, 8), skinM);
  nose.rotation.x = Math.PI / 2.15;
  nose.position.set(0, 1.607, 0.101);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.007, 0.008),
    new THREE.MeshStandardMaterial({ color: 0x7d4c47, roughness: 0.7 }));
  mouth.position.set(0, 1.569, 0.094);
  g.add(nose, mouth);

  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// ——————————————————————————————————————————————
// 练习控制器：3D 房间照旧；对话、状态、评分全部交给后端（backend/）。
export function createPractice(engine, { studyScene, studyShots, onExit }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x090a11);
  scene.fog = new THREE.FogExp2(0x0b0c14, 0.045);

  // 一间壳 + 四套布景，进场时按故事标的「地点」挑一套
  const shell = buildShell();
  scene.add(shell.group);
  const sets = {
    dorm: buildDorm(),
    classroom: buildClassroom(),
    office: buildOffice(),
    meeting: buildMeeting(),
  };
  Object.values(sets).forEach((s) => { s.visible = false; scene.add(s); });

  // 「宿舍 · 晚上八点」→ dorm。认不出来就按宿舍算。
  const kindOf = (place = '') => {
    if (/教室|班会|课堂|讲台/.test(place)) return 'classroom';
    if (/办公室|工位|公司/.test(place)) return 'office';
    if (/会议|汇报|会客/.test(place)) return 'meeting';
    return 'dorm';
  };
  let kind = 'dorm';
  function setRoom(next) {
    kind = next;
    for (const k in sets) sets[k].visible = k === next;
    // 黑板也得有窗：教室里那片冷光总得有个来源。所以教室不是把窗拿掉，
    // 是把窗往右挪，跟黑板并排；其它屋子窗在原位。
    const shift = next === 'classroom' ? 1.25 : 0;
    shell.windowSet.position.x = shift;
    shell.winFill.position.x = 1.05 + shift;
  }

  // 对手站在屋子中间偏右，正对着你
  const foe = buildOpponent({});
  foe.position.set(0.52, 0, 0.28);
  foe.rotation.y = 0;
  scene.add(foe);

  const ui = buildPracticeUI();
  let open = false;
  let cardId = null;
  let story = null;
  let skin = null;          // 典故自带的房间/对手/开场白，叠在后端场景上
  let turn = 0;
  let maxTurns = 8;
  let busy = false;
  let ended = false;
  let oppName = '对方';

  // 一点点呼吸，别让人像一块立牌
  engine.onTick((dt, t) => {
    if (!open) return;
    foe.position.y = Math.sin(t * 1.1) * 0.006;
    foe.rotation.y = Math.sin(t * 0.42) * 0.045;
  });

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  // 典故卡 ↔ 后端场景：诊断给出的 primary_obstacle 决定场景，这里按卡片反查
  const scenarioForCard = (id) => {
    const lib = SESS.lib;
    const sc = lib && lib.scenarios.find((x) => x.card_id === id);
    return sc ? sc.scenario_id : null;
  };

  async function begin(scenarioId) {
    try {
      const r = await api.start({
        scenario_id: scenarioId, session_id: SESS.id,
        skin: skin ? { place: skin.place, setup: skin.setup, who: skin.who, line: skin.line } : undefined,
      });
      SESS.id = r.session_id;
      turn = 0; ended = false; maxTurns = r.scenario.max_turns; oppName = r.scenario.npc.name;
      ui.startChat(r.scenario, { onSend: send, onFinish: finishNow });
      ui.setTurn(0, maxTurns);
      ui.addLine(oppName, r.opening_line);
      ui.note(r.mode === 'offline' ? '当前为离线演示模式（规则驱动，不是模型生成）。' : '');
      return true;
    } catch (e) {
      ui.startChat({ setting: '', success_hint: '' }, { onSend() {}, onFinish() {} });
      ui.note(e.message + ' 点左上角回到书房后可以再试一次。');
      return false;
    }
  }

  async function send() {
    const text = ui.getText();
    if (!text || busy || ended) return;
    busy = true; ui.busy(true);
    ui.addLine('me', text);
    ui.setText('');
    try {
      const r = await api.turn({ session_id: SESS.id, text });
      if (r.crisis) { ended = true; ui.crisis(r.message, r.hotlines); return; }
      ui.addLine(oppName, r.npc_line);
      turn = r.turn;
      ui.setTurn(turn, maxTurns);
      ui.note(r.notice || '');
      if (r.ended) { ended = true; ui.markEnded(r.end_reason, toScore); }
    } catch (e) {
      ui.removeLast();
      ui.setText(text);                       // 失败要把话还给用户，让他再发一次
      ui.note(e.message);
      if (e.kind === 'gone') ui.note('会话已过期，请回到书房重新开始。');
    } finally {
      busy = false;
      if (!ended) ui.busy(false);
    }
  }

  async function finishNow() {
    if (!turn || busy) { ui.note('先说一句话再结束吧。'); return; }
    try {
      if (!ended) await api.end({ session_id: SESS.id });
      ended = true;
    } catch (e) { ui.note(e.message); return; }
    toScore();
  }

  async function toScore() {
    ui.scoring(true);
    try {
      const R = await api.score({ session_id: SESS.id });
      SESS.result = R;
      const saved = persistResult(R);
      ui.showResult(R, resultActions(R, saved));
    } catch (e) {
      ui.scoring(false);
      ui.note(e.message);
    }
  }

  function resultActions(R, saved) {
    const res = R.result;
    const acts = [];
    if (res.next_action === 'transfer_new' && R.next_scenario) {
      acts.push({ label: '进入下一个场景 →', primary: true, run: () => switchTo(R.next_scenario.scenario_id) });
    }
    acts.push({ label: res.next_action === 'review_card' ? '回书房看这条思路' : '回到书房', primary: res.next_action !== 'transfer_new', run: () => api_close() });
    acts.push({ label: '同一场景再练一次', run: () => switchTo(R.scenario.scenario_id) });
    if (!saved) acts.push({ label: '（浏览器存储不可用，这次记录没能保存）', run: () => {} });
    return acts;
  }

  // 再练一次 = 同一间屋子同一套皮肤；进入下一个场景 = 换成目标场景对应典故自己的房间、对手和开场白。
  // 房间、皮肤、后端场景三者必须一起换，否则会出现「屋子是教室、对手却是室友」。
  async function switchTo(scenarioId) {
    const sameScene = SESS.result && scenarioId === SESS.result.scenario.scenario_id;
    if (!sameScene) {
      const lib = SESS.lib;
      const target = lib && lib.scenarios.find((x) => x.scenario_id === scenarioId);
      const st = target && STORIES[target.card_id];
      const p = st && st.practice;
      if (p) {
        story = st; cardId = target.card_id;
        skin = { place: p.place, setup: p.setup, who: p.turns[0].who, line: p.turns[0].line };
        setRoom(kindOf(p.place));
        ui.mount(st, () => api_close());
      } else {
        skin = null;
      }
    }
    await begin(scenarioId);
  }

  const api_ = {
    scene,
    shots: SHOTS,
    get isOpen() { return open; },
    async open(st, id) {
      if (open) return;
      story = st;
      if (!story.practice) return;
      cardId = id;
      const sid = scenarioForCard(id);
      if (!sid) return;
      const p0 = story.practice;
      skin = { place: p0.place, setup: p0.setup, who: p0.turns[0].who, line: p0.turns[0].line };
      open = true;
      setRoom(kindOf(p0.place));
      ui.mount(story, () => api_close());
      await wipeIn(420);
      // 从书房进来时相机还在漫游手里，得先收回来看取景
      engine.rig.enable(true);
      engine.setScene(scene, SHOTS);
      engine.rig.snap('enter');
      await nextFrame();
      engine.rig.go('face', 2.2);
      wipeOut();
      await wait(520);
      await begin(sid);
    },
    async close() {
      if (!open) return;
      open = false;
      await wipeIn(400);
      ui.unmount();
      engine.setScene(studyScene, studyShots);
      // practiced 只在真的评过分时为真：中途退出不算练过，书架不会被白点亮
      onExit?.({ cardId, practiced: !!(SESS.result && SESS.saved === SESS.result.session_id) });
      await nextFrame();
      wipeOut();
    },
  };
  const api_close = () => api_.close();

  window.addEventListener('keydown', (e) => {
    if (!open) return;
    if (e.key === 'Escape') api_.close();
  });

  return api_;
}
