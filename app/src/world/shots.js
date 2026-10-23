import * as THREE from 'three';
import { ROOM, HUB } from '../config.js';

// 第 i 面墙局部坐标 (x 沿墙, y 高度, d 离墙向内的距离) → 世界坐标
export function wallPoint(i, x, y, d) {
  const phi = (i * Math.PI) / 4;
  const nx = -Math.sin(phi), nz = Math.cos(phi);
  const tx = Math.cos(phi), tz = Math.sin(phi);
  return new THREE.Vector3(
    ROOM.apothem * Math.sin(phi) + tx * x + nx * d,
    y,
    -ROOM.apothem * Math.cos(phi) + tz * x + nz * d,
  );
}

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// 每个机位 = 相机位置 + 注视点。鼠标视差在此基础上叠加，所以这里给“静止”姿态
export const SHOTS = {
  home:    { pos: V(1.2, 1.7, 7.4),  look: V(0.9, 3.5, -3.4), fov: 56 },
  talk:    { pos: V(0.6, 1.5, 4.3),  look: V(-0.6, 1.25, 0.95), fov: 44 },
  // 机位沿墙右移，把陈列柜整体推到画面左侧，给右侧面板让位
  shelf:   { pos: wallPoint(7, 1.2, 1.35, 5.2), look: wallPoint(7, 1.2, 1.30, 0), fov: 50 },
  // 进书：镜头贴到「以史为鉴」那五部典籍上，再化进书页里
  dive:    { pos: wallPoint(7, 0.72, 1.30, 2.45), look: wallPoint(7, 0.72, 1.18, 0.12), fov: 32 },
  growth:  { pos: wallPoint(1, 0.9, 2.0, 7.0), look: wallPoint(1, 0.9, 2.5, 0), fov: 50 },
  explore: { pos: V(HUB.x + 0.3, 2.1, HUB.z + 4.6), look: V(HUB.x, 3.1, HUB.z), fov: 52 },
};
