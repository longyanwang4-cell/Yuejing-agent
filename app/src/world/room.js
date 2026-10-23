import * as THREE from 'three';
import { ROOM } from '../config.js';
import { box } from '../core/materials.js';
import { polar } from '../core/util.js';
import { skyTexture, mountainTextures } from '../core/tex-sky.js';
import { domeTexture } from '../core/tex-dome.js';
import { wallFrame, wallShape, archPath, archFrame } from './wall-frame.js';

const A = ROOM.apothem;

function octagonShape(apothem) {
  const R = apothem / Math.cos(Math.PI / 8);
  const s = new THREE.Shape();
  for (let k = 0; k < 8; k++) {
    const phi = Math.PI / 8 + (k * Math.PI) / 4;
    const [x, z] = polar(phi, R);
    k ? s.lineTo(x, -z) : s.moveTo(x, -z);
  }
  s.closePath();
  return s;
}

function buildFloor(mats) {
  mats.floor.map.repeat.set(0.36, 0.36);
  const geo = new THREE.ShapeGeometry(octagonShape(A + 0.05));
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, mats.floor);
  m.receiveShadow = true;
  return m;
}

// 二层回廊：八边环形板 + 托架 + 栏杆
function buildGallery(mats) {
  const g = new THREE.Group();
  const outer = octagonShape(A - 0.02);
  outer.holes.push(octagonShape(A - 1.3));
  const geo = new THREE.ExtrudeGeometry(outer, { depth: 0.22, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  const slab = new THREE.Mesh(geo, mats.woodDark);
  slab.position.y = ROOM.deckY - 0.22;
  slab.castShadow = slab.receiveShadow = true;
  g.add(slab);

  const inner = A - 1.3;
  const L = 2 * inner * Math.tan(Math.PI / 8);
  for (let i = 0; i < 8; i++) {
    const wf = wallFrame(i);
    // 第 6 面墙的中段留出旋梯通道
    const gap = i === 6 ? 0.75 : 0;
    const segs = gap ? [[-L / 2 - 0.06, -gap], [gap, L / 2 + 0.06]] : [[-L / 2 - 0.06, L / 2 + 0.06]];
    segs.forEach(([a, b]) => {
      wf.add(box(b - a, 0.09, 0.12, mats.brass, (a + b) / 2, ROOM.deckY + 1.02, 1.3));
      wf.add(box(b - a, 0.2, 0.14, mats.woodDark, (a + b) / 2, ROOM.deckY - 0.3, 1.3));
    });
    const posts = Math.round(L / 0.42);
    for (let p = 0; p <= posts; p++) {
      const x = -L / 2 + (p * L) / posts;
      if (gap && Math.abs(x) < gap) continue;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.96, 8), mats.brassDull);
      post.position.set(x, ROOM.deckY + 0.5, 1.3);
      wf.add(post);
    }
    for (let b = 0; b < 4; b++) {
      const cor = box(0.22, 0.5, 0.5, mats.woodDark, -L / 2 + (L * (b + 0.5)) / 4, ROOM.deckY - 0.5, 1.05);
      cor.rotation.x = 0;
      wf.add(cor);
    }
    g.add(wf);
  }
  return g;
}

function buildColumns(mats) {
  const g = new THREE.Group();
  const R = A / Math.cos(Math.PI / 8);
  for (let k = 0; k < 8; k++) {
    const phi = Math.PI / 8 + (k * Math.PI) / 4;
    const [x, z] = polar(phi, R);
    const col = new THREE.Group();
    col.position.set(x, 0, z);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.33, ROOM.wallH, 16), mats.woodDark);
    shaft.position.y = ROOM.wallH / 2;
    shaft.castShadow = true;
    col.add(shaft);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.3, 16), mats.brassDull);
    base.position.y = 0.15;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.32, 0.38, 16), mats.brassDull);
    cap.position.y = ROOM.wallH - 0.19;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.035, 8, 24), mats.brass);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = ROOM.deckY - 0.1;
    col.add(base, cap, ring);
    g.add(col);
  }
  return g;
}

function buildDome(mats) {
  const R = A / Math.cos(Math.PI / 8);
  const pts = [];
  const steps = 14;
  const H = 4.4;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = t * (Math.PI / 2) * 0.93;
    pts.push(new THREE.Vector2(R * Math.cos(a) * (1 - 0.0) + 0.95 * Math.sin(a) * 0, ROOM.wallH + H * Math.sin(a)));
  }
  pts[steps].x = 0.9;
  const geo = new THREE.LatheGeometry(pts, 8, Math.PI / 8, Math.PI * 2);
  const mat = new THREE.MeshStandardMaterial({ map: domeTexture(), side: THREE.BackSide, roughness: 0.9, emissive: 0x1a2860, emissiveMap: null, emissiveIntensity: 0.55 });
  mat.emissiveMap = mat.map;
  const dome = new THREE.Mesh(geo, mat);
  const g = new THREE.Group();
  g.add(dome);
  const top = ROOM.wallH + H * Math.sin((Math.PI / 2) * 0.93);
  const oculus = new THREE.Mesh(new THREE.CircleGeometry(0.9, 8), new THREE.MeshBasicMaterial({ color: 0xffe2a8 }));
  oculus.rotation.x = Math.PI / 2;
  oculus.position.y = top - 0.02;
  g.add(oculus);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.07, 8, 8), mats.brass);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = top - 0.05;
  ring.rotation.z = Math.PI / 8;
  g.add(ring);
  g.userData.top = top;
  return g;
}

// 拱窗 + 窗外夜景（月、山、塔）
function buildWindow(mats, wf) {
  const halfW = 1.72, y0 = 1.7, spring = 5.9;
  const frame = archFrame(0, y0, halfW, spring, 0.26, 0.62, mats.woodDark);
  frame.position.z = -0.5;
  wf.add(frame);
  const sill = box(halfW * 2 + 0.9, 0.18, 0.9, mats.woodDark, 0, y0 - 0.06, 0.28);
  wf.add(sill);
  const barMat = mats.brassDull;
  const top = spring + halfW;
  wf.add(box(0.07, top - y0, 0.07, barMat, 0, (top + y0) / 2, -0.12));
  [3.5, 5.0].forEach((y) => wf.add(box(halfW * 2, 0.06, 0.07, barMat, 0, y, -0.12)));
  for (let i = 1; i <= 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry((halfW * i) / 3.2, 0.028, 6, 36, Math.PI), barMat);
    ring.position.set(0, spring, -0.12);
    wf.add(ring);
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 4) * Math.PI;
    const spoke = box(0.04, halfW, 0.05, barMat, 0, 0, -0.12);
    spoke.geometry.translate(0, halfW / 2, 0);
    spoke.position.set(0, spring, -0.12);
    spoke.rotation.z = a - Math.PI / 2;
    wf.add(spoke);
  }

  const skyTex = skyTexture();
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(17, 12.5), new THREE.MeshBasicMaterial({ map: skyTex, toneMapped: false }));
  sky.position.set(-0.4, 7.3, -14);
  wf.add(sky);
  const { far, near } = mountainTextures();
  const mFar = new THREE.Mesh(new THREE.PlaneGeometry(19, 5.8), new THREE.MeshBasicMaterial({ map: far, transparent: true, toneMapped: false, depthWrite: false }));
  mFar.position.set(-0.4, 3.4, -11.4);
  const mNear = new THREE.Mesh(new THREE.PlaneGeometry(15.5, 4.8), new THREE.MeshBasicMaterial({ map: near, transparent: true, toneMapped: false, depthWrite: false }));
  mNear.position.set(-0.2, 2.5, -9.8);
  wf.add(mFar, mNear);
}

// 墙洞配置：第 0 面开拱窗，第 2 面开“时空之门”
function wallHoles(i) {
  if (i === 0) return [archPath(0, 1.7, 1.72, 5.9)];
  return [];
}

export function buildRoom(mats) {
  const root = new THREE.Group();
  mats.plaster.map.repeat.set(0.25, 0.25);
  root.add(buildFloor(mats));

  for (let i = 0; i < 8; i++) {
    const wf = wallFrame(i);
    const geo = new THREE.ShapeGeometry(wallShape({ holes: wallHoles(i) }), 24);
    const wall = new THREE.Mesh(geo, mats.plaster);
    wall.castShadow = wall.receiveShadow = true;
    wf.add(wall);
    wf.add(box(ROOM.wallW + 0.1, 0.16, 0.06, mats.woodDark, 0, 0.08, 0.03));
    if (i === 0) buildWindow(mats, wf);
    root.add(wf);
  }
  root.add(buildGallery(mats), buildColumns(mats));
  const dome = buildDome(mats);
  root.add(dome);
  root.userData.domeTop = dome.userData.top;
  return root;
}
