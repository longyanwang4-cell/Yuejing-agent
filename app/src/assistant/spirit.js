import * as THREE from 'three';
import { makeCanvas, toTexture } from '../core/tex.js';
import { glowSprite } from '../world/glow.js';

// 桌上的小光灵：圆滚滚的白色绒团，带耳朵，缓慢漂浮。
export function createSpirit() {
  const g = new THREE.Group();
  const [c, ctx] = makeCanvas(512, 256);
  ctx.fillStyle = '#fbfaff';
  ctx.fillRect(0, 0, 512, 256);
  ctx.fillStyle = '#26214a';
  [-1, 1].forEach((s) => {
    ctx.beginPath();
    ctx.ellipse(128 + s * 34, 140, 11, 15, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = '#fff';
  [-1, 1].forEach((s) => {
    ctx.beginPath();
    ctx.arc(128 + s * 34 - 3, 133, 4, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = 'rgba(255,150,170,.6)';
  [-1, 1].forEach((s) => {
    ctx.beginPath();
    ctx.ellipse(128 + s * 54, 168, 12, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  const tex = toTexture(c);
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, emissive: 0xc8d4ff, emissiveMap: tex, emissiveIntensity: 0.55 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.17, 28, 22), mat);
  body.scale.set(1.08, 0.92, 1);
  body.castShadow = true;
  g.add(body);
  const earGeo = new THREE.CapsuleGeometry(0.035, 0.15, 4, 8);
  [-1, 1].forEach((s) => {
    const e = new THREE.Mesh(earGeo, new THREE.MeshStandardMaterial({ color: 0xfff4f8, emissive: 0xffc8d8, emissiveIntensity: 0.35, roughness: 0.9 }));
    e.position.set(s * 0.09, 0.2, -0.01);
    e.rotation.z = -s * 0.28;
    g.add(e);
  });
  const halo = glowSprite('cool', 1.2, 0.5);
  g.add(halo);
  const hit = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), new THREE.MeshBasicMaterial({ visible: false }));
  g.add(hit);
  return {
    root: g,
    update(t) {
      g.position.y = 1.18 + Math.sin(t * 1.5) * 0.05;
      g.rotation.y = Math.sin(t * 0.5) * 0.4 + 0.5;
      g.rotation.z = Math.sin(t * 1.1) * 0.06;
    },
  };
}
