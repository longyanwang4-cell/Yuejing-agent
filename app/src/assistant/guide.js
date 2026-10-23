import * as THREE from 'three';
import { makeCanvas, toTexture } from '../core/tex.js';
import { damp } from '../core/util.js';
import { FONT_SERIF } from '../config.js';
import { glowSprite } from '../world/glow.js';

// 书封：竖版，金边 + 书名，远看只要认出是一本书
function bookCover() {
  const [c, ctx] = makeCanvas(240, 320);
  const g = ctx.createLinearGradient(0, 0, 240, 320);
  g.addColorStop(0, '#26408a');
  g.addColorStop(1, '#101f4e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 240, 320);
  ctx.strokeStyle = '#e8c97a';
  ctx.lineWidth = 6;
  ctx.strokeRect(12, 12, 216, 296);
  ctx.lineWidth = 2;
  ctx.strokeRect(22, 22, 196, 276);
  ctx.fillStyle = '#e8c97a';
  ctx.font = `700 42px ${FONT_SERIF}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('阅', 120, 138);
  ctx.fillText('境', 120, 192);
  return toTexture(c, { aniso: 4 });
}

// 两点之间拉一段圆柱：袖子靠它摆，省得每个关节去猜旋转角
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

// 袖口金边：沿小臂方向套一圈，省得手算欧拉角
const _zAxis = new THREE.Vector3(0, 0, 1);
const _armDir = new THREE.Vector3();
function cuff(a, b, r, m) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.008, 6, 18), m);
  _armDir.subVectors(b, a).normalize();
  ring.position.copy(b);
  ring.quaternion.setFromUnitVectors(_zAxis, _armDir);
  return ring;
}

function box(w, h, d, m, x, y, z) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  b.position.set(x, y, z);
  return b;
}

// 沟通达人：古代礼官 / 书生。深靛外袍压暖光、纸白中衣提亮，左臂弯里夹一卷《阅境》。
export function createGuide() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  // 主色一深一浅：远看先读到的是色块，不是细节
  const robeMat = new THREE.MeshStandardMaterial({ color: 0x33436b, roughness: 0.85, side: THREE.DoubleSide, emissive: 0x0b1122, emissiveIntensity: 0.10 });
  const innerMat = new THREE.MeshStandardMaterial({ color: 0xece4d4, roughness: 0.9, side: THREE.DoubleSide, emissive: 0x2a2822, emissiveIntensity: 0.06 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xe0b860, metalness: 0.75, roughness: 0.34, emissive: 0x3a2608, emissiveIntensity: 0.18 });
  const capeMat = new THREE.MeshStandardMaterial({ color: 0x1e2740, roughness: 0.8, side: THREE.DoubleSide, emissive: 0x0a1020, emissiveIntensity: 0.08 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xe0b99c, roughness: 0.7, emissive: 0x5a3a2c, emissiveIntensity: 0.08 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x1b1620, roughness: 0.78, emissive: 0x161020, emissiveIntensity: 0.1 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x141018, roughness: 0.42 });
  const browMat = new THREE.MeshStandardMaterial({ color: 0x241c22, roughness: 0.85 });
  // 高光点不吃光也不吃色调映射，任何距离都是一个亮点
  const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const jadeMat = new THREE.MeshStandardMaterial({ color: 0x7fbfae, roughness: 0.35, metalness: 0.15, emissive: 0x1e4a42, emissiveIntensity: 0.3 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x1d1a1c, roughness: 0.8 });

  // 靴子：袍摆下面只露低矮的方履，比运动鞋窄一截
  [-1, 1].forEach((s) => {
    const sole = box(0.088, 0.016, 0.235, shoeMat, s * 0.085, 0.008, 0.06);
    const shoe = box(0.078, 0.066, 0.215, shoeMat, s * 0.085, 0.049, 0.055);
    body.add(sole, shoe);
  });

  // 下摆：腰以下才张开，上口贴腰、下沿 0.30，钟形留在一段里而不是整身
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.30, 0.86, 28, 1, true), robeMat);
  skirt.position.y = 0.52;
  skirt.scale.z = 0.9;
  body.add(skirt);
  // 下摆滚边：Torus 压扁，做成一圈描金线
  const hem = new THREE.Mesh(new THREE.TorusGeometry(0.295, 0.011, 8, 40), trimMat);
  hem.rotation.x = Math.PI / 2;
  hem.scale.set(1, 0.9, 0.5);
  hem.position.y = 0.10;
  body.add(hem);

  // 上身：肩宽 0.19 → 腰 0.145，收腰的落差交给肩线和腰带去读
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.145, 0.44, 22), robeMat);
  torso.position.y = 1.2;
  torso.scale.z = 0.88;
  body.add(torso);
  // 肩头：两颗球，把肩点推到 ±0.20，手臂才有地方起势
  [-1, 1].forEach((s) => {
    const sh = new THREE.Mesh(new THREE.SphereGeometry(0.072, 14, 10), robeMat);
    sh.position.set(s * 0.2, 1.4, 0.005);
    sh.scale.set(1, 0.9, 0.95);
    body.add(sh);
  });

  // 披风：从背后兜到肩前，前缘正好露在臂缝外面，形成两道竖边
  const cape = new THREE.Mesh(
    new THREE.CylinderGeometry(0.235, 0.32, 0.88, 26, 1, true, Math.PI * 0.38, Math.PI * 1.24),
    capeMat
  );
  cape.position.set(0, 0.97, -0.04);
  cape.scale.z = 0.85;
  body.add(cape);

  // 腰带 + 方形玉扣
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.017, 8, 32), trimMat);
  belt.rotation.x = Math.PI / 2;
  belt.scale.set(1, 0.9, 0.7);
  belt.position.y = 0.975;
  const buckle = box(0.052, 0.046, 0.02, jadeMat, 0, 0.975, 0.142);
  body.add(belt, buckle);

  // 中衣：白色 V 三角垫在交领底下，白 + 靛的撞色是最先认出的形状
  const vShape = new THREE.Shape();
  vShape.moveTo(-0.078, 0.075);
  vShape.lineTo(0.078, 0.075);
  vShape.lineTo(0, -0.10);
  vShape.closePath();
  const innerV = new THREE.Mesh(new THREE.ShapeGeometry(vShape), innerMat);
  innerV.position.set(0, 1.3, 0.168);
  innerV.rotation.x = 0.12;
  body.add(innerV);

  // 交领：两片斜襟压在白三角两边，内缘走一条 0.011 的金线
  [-1, 1].forEach((s) => {
    const panel = new THREE.Group();
    panel.position.set(s * 0.082, 1.29, 0.176);
    // 绕 y 收一点，外缘贴回胸口，别让斜襟像两块漂浮的板
    panel.rotation.set(0.12, s * 0.3, -s * 0.22);
    panel.add(box(0.088, 0.3, 0.014, robeMat, 0, 0, 0));
    panel.add(box(0.011, 0.3, 0.008, trimMat, -s * 0.043, 0, 0.006));
    body.add(panel);
  });
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.016, 8, 20), trimMat);
  collar.rotation.x = Math.PI / 2.2;
  collar.position.set(0, 1.41, 0.006);
  body.add(collar);

  // 颈：留出 0.04 的高度，别让头直接坐在领子上
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.05, 0.09, 12), skinMat);
  neck.position.y = 1.44;
  body.add(neck);

  // 头：冠顶（不含发髻）落在 1.68 附近
  const head = new THREE.Group();
  head.position.set(0, 1.575, 0.004);
  body.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.103, 24, 18), skinMat);
  skull.scale.set(0.97, 1.02, 1.0);
  head.add(skull);

  // 五官全部是独立几何体，不再拿画布糊脸
  const eyes = [];
  [-1, 1].forEach((s) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.017, 12, 10), eyeMat);
    eye.position.set(s * 0.037, 0.008, 0.094);
    eye.scale.set(1, 1.1, 0.55);
    // 眨眼统一按这个基准压 y
    eye.userData.baseY = 1.1;
    // 高光挂在眼球上，跟着眨眼一起收；z 要放到球面外，不然被眼白吃掉
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.004, 8, 6), sparkMat);
    glint.position.set(0.006, 0.004, 0.018);
    eye.add(glint);
    head.add(eye);
    eyes.push(eye);

    const brow = box(0.046, 0.012, 0.012, browMat, s * 0.037, 0.044, 0.094);
    brow.rotation.z = s * 0.1;
    head.add(brow);

    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), skinMat);
    ear.scale.set(0.45, 1.2, 0.9);
    ear.position.set(s * 0.098, 0.002, -0.005);
    head.add(ear);
  });
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.045, 8), skinMat);
  nose.rotation.x = Math.PI / 2.05;
  nose.position.set(0, -0.002, 0.092);
  const mouth = box(0.036, 0.008, 0.01,
    new THREE.MeshStandardMaterial({ color: 0x8a5048, roughness: 0.7 }),
    0, -0.052, 0.09);
  head.add(nose, mouth);

  // 发帽只盖到眉线以上：下沿 0.067，额头留一条肤色，别像头巾
  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.105, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.34),
    hairMat
  );
  hairCap.scale.set(0.99, 1.04, 1.02);
  hairCap.position.set(0, 0.002, -0.004);
  // 额头那撮：有一条自然的发际线，不然光脑袋上扣一顶黑帽
  const fringe = new THREE.Mesh(new THREE.SphereGeometry(0.104, 20, 12), hairMat);
  fringe.scale.set(0.95, 0.36, 0.62);
  fringe.position.set(0, 0.072, 0.036);
  fringe.rotation.x = -0.34;
  // 后脑发：半个壳往下包到颈后
  const nape = new THREE.Mesh(
    new THREE.SphereGeometry(0.104, 14, 10, 0, Math.PI, 0, Math.PI * 0.55),
    hairMat
  );
  nape.position.set(0, 0.002, -0.008);
  nape.rotation.y = Math.PI;
  nape.scale.set(0.99, 1.03, 1.03);
  // 发髻：压扁的球，稍靠后；发簪横穿过去
  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 10), hairMat);
  bun.scale.set(1, 0.82, 0.95);
  bun.position.set(0, 0.128, -0.048);
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.16, 6), trimMat);
  pin.rotation.z = Math.PI / 2;
  pin.position.set(0, 0.131, -0.05);
  head.add(hairCap, nape, bun, pin, fringe);

  // 手臂：宽袍大袖。肩 ±0.20 起，肘 ±0.26，前臂收回身前，臂缝能透光
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const makeArm = (side, elbow, wrist, cuffR) => {
    const g = new THREE.Group();
    g.position.set(side * 0.2, 1.4, 0.005);
    const shoulder = V(0, 0, 0);
    const dir = new THREE.Vector3().subVectors(wrist, elbow).normalize();
    // 上臂 0.075→0.083，小臂再涨到袖口 0.088，一路变宽才是大袖
    g.add(limb(shoulder, elbow, 0.083, 0.075, robeMat));
    g.add(limb(elbow, wrist, cuffR, 0.08, robeMat));
    // 袖口金边
    g.add(cuff(elbow, wrist, cuffR, trimMat));
    // 垂袖：袖口下面再接一截开口圆柱，剪影才不是两根光棍
    const dropC = wrist.clone().addScaledVector(dir, 0.08);
    dropC.y -= 0.06;
    const drop = new THREE.Mesh(new THREE.CylinderGeometry(cuffR * 0.97, cuffR * 1.06, 0.13, 14, 1, true), robeMat);
    drop.position.copy(dropC);
    drop.rotation.z = -side * 0.06;
    g.add(drop);
    const dropRing = new THREE.Mesh(new THREE.TorusGeometry(cuffR * 1.05, 0.007, 6, 20), trimMat);
    dropRing.rotation.x = Math.PI / 2;
    dropRing.position.set(dropC.x, dropC.y - 0.065, dropC.z);
    g.add(dropRing);
    // 手从袖口探出，肤色
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.043, 12, 10), skinMat);
    hand.position.copy(wrist).addScaledVector(dir, 0.035);
    hand.scale.set(0.9, 1.15, 0.68);
    g.add(hand);
    body.add(g);
    return g;
  };
  const armR = makeArm(1, V(0.06, -0.24, 0.03), V(0.015, -0.475, 0.15), 0.088);
  const armL = makeArm(-1, V(-0.06, -0.24, 0.06), V(0.09, -0.33, 0.19), 0.088);

  // 线装书：缩到 0.19×0.26×0.036，斜夹在左臂弯里，书脊朝外
  const book = new THREE.Group();
  const coverTex = bookCover();
  const cMat = new THREE.MeshStandardMaterial({ map: coverTex, roughness: 0.55, emissive: 0x6a5a30, emissiveIntensity: 0.12 });
  const bookDark = new THREE.MeshStandardMaterial({ color: 0x142040, roughness: 0.6 });
  const pageMat = new THREE.MeshStandardMaterial({ color: 0xf0e6c8, roughness: 0.9 });
  const pages = new THREE.Mesh(new THREE.BoxGeometry(0.178, 0.248, 0.024), pageMat);
  const frontCover = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.26, 0.006),
    [bookDark, bookDark, bookDark, bookDark, cMat, bookDark]);
  frontCover.position.z = 0.015;
  const backCover = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.26, 0.006), bookDark);
  backCover.position.z = -0.015;
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.262, 0.04), bookDark);
  spine.position.x = -0.089;
  book.add(pages, frontCover, backCover, spine);
  // 挂到左臂上，手臂微动时书不会脱手；z 轴倾斜让书成一条斜线
  book.position.set(0.04, -0.26, 0.238);
  book.rotation.set(0.1, -0.25, 0.36);
  armL.add(book);

  // 脚下光环 + 周身星尘
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xbcd4ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.56, 64), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  const ring2 = new THREE.Mesh(new THREE.RingGeometry(0.66, 0.68, 64), ringMat);
  ring2.rotation.x = -Math.PI / 2;
  ring2.position.y = 0.02;
  root.add(ring, ring2);
  const aura = glowSprite('cool', 3.0, 0.06);
  aura.position.y = 1.1;
  body.add(aura);
  const motes = [];
  for (let i = 0; i < 14; i++) {
    const s = glowSprite(i % 3 ? 'gold' : 'cool', 0.13 + (i % 4) * 0.035, 0.9);
    s.userData = { a: (i / 14) * Math.PI * 2, r: 0.55 + (i % 5) * 0.09, y: 0.3 + (i % 7) * 0.2, sp: 0.4 + (i % 4) * 0.14 };
    root.add(s);
    motes.push(s);
  }
  const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.8, 8), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = 0.9;
  root.add(hit);

  // 人物本体统一收阴影；光环和 hit 不算
  body.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  let blinkAt = 2.5, blinkUntil = 0, talk = 0, talkTarget = 0;
  const target = new THREE.Vector3();
  return {
    root, head,
    set talking(v) { talkTarget = v ? 1 : 0; },
    headWorld(out) { return head.getWorldPosition(out); },
    update(dt, t, lookAt) {
      talk = damp(talk, talkTarget, 6, dt);
      // 呼吸浮动：脚不离地，只让身体轻轻起伏
      body.position.y = 0.008 + Math.sin(t * 1.3) * 0.008;
      body.rotation.z = Math.sin(t * 0.7) * 0.012;
      armL.rotation.x = -0.02 + Math.sin(t * 1.1) * 0.03 - talk * (0.05 + Math.sin(t * 6) * 0.035);
      armL.rotation.z = 0.02 + Math.sin(t * 0.9) * 0.02;
      armR.rotation.x = Math.sin(t * 1.0 + 1) * 0.03;
      armR.rotation.z = -0.02 + Math.sin(t * 0.9) * 0.025;
      if (lookAt) {
        root.worldToLocal(target.copy(lookAt));
        const yaw = Math.atan2(target.x, target.z);
        const pitch = Math.atan2(target.y - 1.58, Math.hypot(target.x, target.z));
        head.rotation.y = damp(head.rotation.y, clampT(yaw, -0.6, 0.6), 4, dt);
        head.rotation.x = damp(head.rotation.x, clampT(-pitch, -0.3, 0.3) + talk * Math.sin(t * 8) * 0.02, 4, dt);
      }
      head.rotation.z = Math.sin(t * 0.6) * 0.025;
      // 眨眼：不用贴图了，直接把两只眼睛压扁再弹回
      if (t > blinkAt) {
        blinkUntil = t + 0.12;
        blinkAt = t + 2.4 + Math.random() * 2.8;
      }
      if (blinkUntil && t > blinkUntil) blinkUntil = 0;
      const open = blinkUntil && t <= blinkUntil ? 0.12 : 1;
      eyes.forEach((e) => { e.scale.y = e.userData.baseY * open; });
      ring.rotation.z += dt * 0.35;
      ring2.rotation.z -= dt * 0.2;
      ringMat.opacity = 0.42 + Math.sin(t * 1.6) * 0.1;
      motes.forEach((m) => {
        const u = m.userData;
        const a = u.a + t * u.sp;
        m.position.set(Math.cos(a) * u.r, u.y + Math.sin(t * 1.2 + u.a) * 0.12, Math.sin(a) * u.r * 0.8);
        m.material.opacity = 0.5 + Math.sin(t * 2 + u.a * 3) * 0.4;
      });
    },
  };
}

const clampT = (v, a, b) => Math.min(b, Math.max(a, v));
