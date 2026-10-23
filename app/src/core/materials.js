import * as THREE from 'three';
import { woodTexture, plasterTexture, floorTexture } from './tex-surfaces.js';

const std = (o) => new THREE.MeshStandardMaterial(o);

// 全场景共用材质：先建一次，各模块按名字取用
export function makeMaterials() {
  const plaster = plasterTexture();
  return {
    plaster: std({ map: plaster, roughness: 0.95, color: 0xd9c4a0 }),
    floor: std({ map: floorTexture(), roughness: 0.38, metalness: 0.12, color: 0xd8c0a0 }),
    wood: std({ map: woodTexture(5), roughness: 0.6, metalness: 0.04, color: 0xe0c8a8 }),
    woodDark: std({ map: woodTexture(9, [22, 40, 13]), roughness: 0.58, metalness: 0.05, color: 0xd8c0a0 }),
    woodWarm: std({ map: woodTexture(14, [32, 55, 30]), roughness: 0.55, metalness: 0.05 }),
    brass: std({ color: 0xd2a850, metalness: 0.9, roughness: 0.28 }),
    brassDull: std({ color: 0x9c7a34, metalness: 0.8, roughness: 0.45 }),
    leather: std({ color: 0x5a2c1c, roughness: 0.55, metalness: 0.05 }),
    velvet: std({ color: 0x1a2a52, roughness: 0.95 }),
    paper: std({ color: 0xf0e2c0, roughness: 0.9 }),
    stone: std({ color: 0x8a7a68, roughness: 0.9 }),
    glowWarm: new THREE.MeshBasicMaterial({ color: 0xffd38a }),
    glowCool: new THREE.MeshBasicMaterial({ color: 0xbfe0ff }),
  };
}

// 立柱/横梁用的盒子，统一接收阴影
export function box(w, h, d, mat, x = 0, y = 0, z = 0, cast = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
}
