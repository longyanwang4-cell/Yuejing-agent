import * as THREE from 'three';
import { ROOM } from '../config.js';

// 第 i 面墙（0=正对镜头的后墙，顺时针）。返回一个局部坐标系：
// x 向右、y 向上、z 指向房间内侧，墙面在 z=0。
export function wallFrame(i) {
  const phi = (i * Math.PI) / 4;
  const g = new THREE.Group();
  g.position.set(ROOM.apothem * Math.sin(phi), 0, -ROOM.apothem * Math.cos(phi));
  g.rotation.y = -phi;
  g.userData.index = i;
  return g;
}

// 带矩形/拱形洞口的墙面。UV 以米计，灰泥贴图每 4 米重复一次。
export function wallShape({ holes = [] } = {}) {
  const w = ROOM.wallW + 0.04;
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(w / 2, ROOM.wallH);
  s.lineTo(-w / 2, ROOM.wallH);
  s.closePath();
  holes.forEach((h) => s.holes.push(h));
  return s;
}

export function archPath(cx, y0, halfW, springY) {
  const p = new THREE.Path();
  p.moveTo(cx - halfW, y0);
  p.lineTo(cx - halfW, springY);
  p.absarc(cx, springY, halfW, Math.PI, 0, true);
  p.lineTo(cx + halfW, y0);
  p.closePath();
  return p;
}

// 拱形描边（门框、窗框用），沿拱线挤出一条截面为矩形的带
export function archFrame(cx, y0, halfW, springY, thick, depth, mat) {
  const outer = new THREE.Shape();
  const hw = halfW + thick;
  outer.moveTo(cx - hw, y0);
  outer.lineTo(cx - hw, springY);
  outer.absarc(cx, springY, hw, Math.PI, 0, true);
  outer.lineTo(cx + hw, y0);
  outer.lineTo(cx + halfW, y0);
  outer.lineTo(cx + halfW, springY);
  outer.absarc(cx, springY, halfW, 0, Math.PI, false);
  outer.lineTo(cx - halfW, y0);
  outer.closePath();
  const geo = new THREE.ExtrudeGeometry(outer, { depth, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2, curveSegments: 28 });
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}
