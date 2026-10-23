import * as THREE from 'three';
import { ROOM, HUB } from '../config.js';
import { polar } from '../core/util.js';
import { glowSprite } from './glow.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const R = ROOM.circ;

// 半透明光束：边缘更透、靠近窗口端更亮，用菲涅尔式衰减做出“月光穿窗”
function beamMaterial(color) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0.07 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying float vT;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vV = -mv.xyz; vN = normalMatrix * normal;
        vT = clamp(0.5 + position.y / 10.5, 0.0, 1.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying vec3 vN; varying vec3 vV; varying float vT;
      void main(){ float f = pow(abs(dot(normalize(vN), normalize(vV))), 1.8);
        gl_FragColor = vec4(uColor, f * uOpacity * (1.0 - vT * 0.85)); }`,
  });
}

function sconce(mats, parent, phi, y, lit) {
  const [x, z] = polar(phi, R - 0.36);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.lookAt(0, y, 0);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.34, 6), mats.brassDull);
  arm.rotation.x = Math.PI / 2;
  arm.position.z = -0.15;
  const shade = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 12), new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false }));
  shade.scale.set(1, 1.35, 1);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 0.07, 10), mats.brass);
  cap.position.y = 0.17;
  const halo = glowSprite('warm', 1.5, 0.85);
  g.add(arm, shade, cap, halo);
  if (lit) {
    const p = new THREE.PointLight(0xffb870, 14, 11, 2);
    g.add(p);
  }
  parent.add(g);
}

export function buildLights(scene, renderer, mats) {
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.32;
  scene.add(new THREE.HemisphereLight(0x7d92d6, 0x4a2c16, 1.5));
  scene.add(new THREE.AmbientLight(0x6a5240, 1.2));

  const moon = new THREE.SpotLight(0xa8c4ff, 210, 60, 0.46, 0.75, 1.6);
  moon.position.set(0.4, 8.0, -ROOM.apothem - 7);
  moon.target.position.set(HUB.x, 0.4, HUB.z + 0.5);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.bias = -0.0004;
  moon.shadow.camera.near = 6;
  moon.shadow.camera.far = 40;
  scene.add(moon, moon.target);

  const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 1.6, 10.5, 28, 1, true), beamMaterial(0x9cc2ff));
  const from = new THREE.Vector3(0.4, 4.6, -ROOM.apothem - 0.2);
  const to = new THREE.Vector3(HUB.x, 0.2, HUB.z);
  beam.position.copy(from).lerp(to, 0.5);
  beam.lookAt(to);
  beam.rotateX(Math.PI / 2);
  beam.scale.set(1, (from.distanceTo(to) / 10.5), 1);
  beam.raycast = () => {};
  scene.add(beam);

  const rim = new THREE.PointLight(0xffc27a, 34, 0, 2);
  rim.position.set(HUB.x - 5.0, 4.4, HUB.z + 6.5);
  scene.add(rim);

  for (let k = 0; k < 8; k++) {
    const phi = Math.PI / 8 + (k * Math.PI) / 4;
    sconce(mats, scene, phi, 3.0, k === 0 || k === 7 || k === 1 || k === 6);
    sconce(mats, scene, phi, 7.3, false);
  }
  return { moon, beam };
}
