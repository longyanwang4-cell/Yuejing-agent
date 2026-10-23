import * as THREE from 'three';
import { radialGlow } from '../core/tex.js';

const cache = new Map();

function glowMap(kind) {
  if (cache.has(kind)) return cache.get(kind);
  const stops = {
    warm: [[0, 'rgba(255,214,140,1)'], [0.25, 'rgba(255,170,80,.45)'], [1, 'rgba(255,140,40,0)']],
    cool: [[0, 'rgba(210,235,255,1)'], [0.25, 'rgba(120,180,255,.45)'], [1, 'rgba(60,120,255,0)']],
    gold: [[0, 'rgba(255,240,190,1)'], [0.3, 'rgba(255,210,110,.4)'], [1, 'rgba(255,190,60,0)']],
    white: [[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,255,255,.35)'], [1, 'rgba(255,255,255,0)']],
  }[kind];
  const t = radialGlow(128, stops);
  cache.set(kind, t);
  return t;
}

// 叠加混合的光晕贴片：不参与光照，只负责“看起来在发光”
export function glowSprite(kind, size, opacity = 1) {
  const mat = new THREE.SpriteMaterial({
    map: glowMap(kind),
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    opacity,
    toneMapped: false,
  });
  const s = new THREE.Sprite(mat);
  s.scale.set(size, size, 1);
  s.raycast = () => {};
  return s;
}
