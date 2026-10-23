import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SHOTS } from '../world/shots.js';
import { damp, ease } from './util.js';

// 窄屏时把 FOV 放宽，避免手机上视野被切掉。漫游与机位共用同一套换算。
export function fitFov(base, aspect) {
  const narrow = Math.min(1.9, Math.max(1, 1.6 / aspect));
  return Math.min(88, base * (aspect < 1.6 ? 1 + (narrow - 1) * 0.75 : 1));
}

// 渲染器 + 后期 + 相机机位。场景内容由外部往 engine.scene 里加。
export function createEngine(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070f);
  scene.fog = new THREE.FogExp2(0x0b1022, 0.012);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 160);

  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  const bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.38, 0.7, 1.0);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const rig = new Rig(camera);
  const ticks = [];
  const clock = new THREE.Timer();
  let time = 0;

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    rig.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  window.addEventListener('pointermove', (e) => {
    rig.mouse.set((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
  });

  function loop() {
    clock.update();
    const dt = Math.min(clock.getDelta(), 0.05);
    time += dt;
    rig.update(dt, time);
    ticks.forEach((fn) => fn(dt, time));
    composer.render();
    requestAnimationFrame(loop);
  }

  return {
    renderer, scene, camera, composer, bloom, rig, renderPass,
    onTick: (fn) => ticks.push(fn),
    // 切换渲染的 Scene：书房与历史典故是两个独立的场景，机位表也各有一套
    setScene(next, shots) {
      renderPass.scene = next;
      if (shots) rig.setShots(shots);
    },
    start: () => { rig.snap('home'); requestAnimationFrame(loop); },
    get time() { return time; },
  };
}

class Rig {
  constructor(camera) {
    this.cam = camera;
    this.shots = SHOTS;
    this.mouse = new THREE.Vector2();
    this.sm = new THREE.Vector2();
    this.pos = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.fov = 55;
    this.aspect = 1.78;
    this.from = null;
    this.to = null;
    this.t = 1;
    this.dur = 1.6;
    this.par = 1;
    this.name = 'home';
    this.enabled = true;
    this.fwd = new THREE.Vector3();
    this.right = new THREE.Vector3();
  }

  setShots(shots) {
    this.shots = shots;
  }

  // 交出/收回相机控制权（漫游时由 walker 直接写相机）
  enable(v) { this.enabled = v; }

  // 把当前相机位姿写回机位状态：从漫游切到取景时，过渡从这里起步，不会跳
  syncFromCamera() {
    this.pos.copy(this.cam.position);
    this.cam.getWorldDirection(this.fwd);
    this.look.copy(this.cam.position).addScaledVector(this.fwd, 8);
    this.fov = this.cam.fov;
    this.to = null;
    this.t = 1;
  }

  snap(name) {
    const s = this.shots[name];
    this.pos.copy(s.pos);
    this.look.copy(s.look);
    this.fov = s.fov;
    this.to = null;
    this.t = 1;
    this.name = name;
  }

  go(name, dur = 1.8) {
    const s = this.shots[name];
    if (!s) return;
    this.goShot(s, dur);
    this.name = name;
  }

  // 直接推一段现算出来的机位（不是机位表里的名字）。
  // 历史场景里的 street / gate 要跟着这一场的人走，机位是当场算的。
  goShot(s, dur = 1.8) {
    this.from = { pos: this.pos.clone(), look: this.look.clone(), fov: this.fov };
    this.to = s;
    this.t = 0;
    this.dur = dur;
    this.name = 'shot';
  }

  update(dt, time) {
    if (!this.enabled) return;
    if (this.to) {
      this.t = Math.min(1, this.t + dt / this.dur);
      const k = ease(this.t);
      this.pos.lerpVectors(this.from.pos, this.to.pos, k);
      this.pos.y += Math.sin(Math.PI * k) * 0.22;
      this.look.lerpVectors(this.from.look, this.to.look, k);
      this.fov = this.from.fov + (this.to.fov - this.from.fov) * k;
      if (this.t >= 1) this.to = null;
    }
    this.sm.x = damp(this.sm.x, this.mouse.x, 3.2, dt);
    this.sm.y = damp(this.sm.y, this.mouse.y, 3.2, dt);

    const cam = this.cam;
    const par = this.name === 'talk' ? 0.4 : 1;
    this.fwd.subVectors(this.look, this.pos).normalize();
    this.right.crossVectors(this.fwd, cam.up).normalize();
    cam.position.copy(this.pos)
      .addScaledVector(this.right, this.sm.x * 0.5 * par + Math.sin(time * 0.31) * 0.06)
      .addScaledVector(cam.up, this.sm.y * 0.2 * par + Math.sin(time * 0.43) * 0.03);
    cam.lookAt(this.look);

    const f = fitFov(this.fov, this.aspect);
    if (Math.abs(cam.fov - f) > 0.01) {
      cam.fov = f;
      cam.updateProjectionMatrix();
    }
  }
}
