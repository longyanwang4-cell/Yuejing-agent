import * as THREE from 'three';
import { ROOM, SPAWN } from '../config.js';
import { fitFov } from './engine.js';

const EYE = 1.62;
const PLAYER_R = 0.34;
const SENS = 0.0022;   // 指针锁定：原始位移 → 弧度
const DRAG = 0.0034;   // 拖拽兜底：屏幕像素 → 弧度（没有锁定时的灵敏度）

// 第一人称漫游：WASD 走、鼠标转视角、E 交互。
// 只在 home 模式接管相机；进面板/典故时交还给 Rig 的机位系统。
//
// 视角有两种来源：
//   1. Pointer Lock（MC 那样）——点一下画面锁住光标，纯鼠标移动转视角；
//   2. 拖拽兜底——浏览器拒绝锁定（自动化环境、部分嵌入浏览器、无权限）时，
//      按住左键拖动转视角，WASD / E 照旧。
export function createWalker(engine, opts) {
  const { canvas, colliders = [], pickAt, onLock, onUse } = opts;
  const cam = engine.camera;
  const keys = new Set();
  const pos = new THREE.Vector3();
  const vel = new THREE.Vector3();
  let yaw = 0;
  let pitch = 0;
  let bobT = 0;
  let active = false;
  let first = true;

  let roam = false;      // 玩家点过画面，进入漫游（准星、WASD、E 生效）
  let locked = false;    // 光标真的被锁住了
  let noLock = false;    // 浏览器不给锁，走拖拽
  let dragging = false;
  let dragDist = 0;
  let px = 0, py = 0;
  let blockedAt = 0;     // 拖拽结束后的这一下 click 不算点击
  let tryAt = 0;

  // 从当前相机位姿接管，避免切模式时镜头跳一下
  function poseFromCamera() {
    pos.copy(cam.position);
    pos.y = EYE;
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    yaw = Math.atan2(-dir.x, -dir.z);
    pitch = THREE.MathUtils.clamp(Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1)), -1.32, 1.32);
  }

  function collide(p) {
    for (const c of colliders) {
      const dx = p.x - c.x, dz = p.z - c.z;
      const rr = c.r + PLAYER_R;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        const k = (rr - d) / d;
        p.x += dx * k;
        p.z += dz * k;
      }
    }
    // 八边形墙：沿 8 条外法线都不许越界
    const lim = ROOM.apothem - 0.55;
    for (let i = 0; i < 8; i++) {
      const phi = (i * Math.PI) / 4;
      const nx = Math.sin(phi), nz = -Math.cos(phi);
      const d = p.x * nx + p.z * nz;
      if (d > lim) {
        p.x -= nx * (d - lim);
        p.z -= nz * (d - lim);
      }
    }
  }

  function setRoam(v) {
    if (roam === v) return;
    roam = v;
    onLock?.(roam);
  }

  function markNoLock() { noLock = true; }

  // 锁定可能失败：窗口还没拿到焦点时第一次点击不算数，隔一会儿再试一次
  function requestLock() {
    if (locked) return;
    const now = performance.now();
    if (now - tryAt < 800) return;
    tryAt = now;
    let p;
    try { p = canvas.requestPointerLock?.(); } catch (_) { markNoLock(); return; }
    if (p && p.then) p.catch(markNoLock);
  }

  function releaseLock() {
    if (document.pointerLockElement === canvas) document.exitPointerLock?.();
  }

  // —— 输入 ——
  const isField = (t) => t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);

  function onKeyDown(e) {
    if (!active || isField(e.target)) return;
    if (e.code === 'KeyE') {
      if (!e.repeat && roam) onUse?.();
      return;
    }
    if (e.code === 'Space') e.preventDefault();
    keys.add(e.code);
  }
  function onKeyUp(e) { keys.delete(e.code); }
  function onBlur() { keys.clear(); dragging = false; }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  // 未进入漫游时点画面开始漫游；点在可交互物上让拾取器先处理
  canvas.addEventListener('mousedown', (e) => {
    if (!active || e.button !== 0) return;
    if (!roam) {
      if (pickAt?.(e)) return;
      setRoam(true);
      requestLock();
      return;
    }
    if (locked) return;
    // 已经进入漫游但没锁住光标：按住左键拖拽转视角
    dragging = true;
    dragDist = 0;
    px = e.clientX;
    py = e.clientY;
    requestLock();
  });

  window.addEventListener('mousemove', (e) => {
    if (!active) return;
    if (locked) {
      yaw -= e.movementX * SENS;
      pitch = THREE.MathUtils.clamp(pitch - e.movementY * SENS, -1.32, 1.32);
      return;
    }
    if (!dragging) return;
    const dx = e.clientX - px, dy = e.clientY - py;
    px = e.clientX;
    py = e.clientY;
    dragDist += Math.abs(dx) + Math.abs(dy);
    yaw -= dx * DRAG;
    pitch = THREE.MathUtils.clamp(pitch - dy * DRAG, -1.32, 1.32);
  });

  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    if (dragDist > 6) blockedAt = performance.now();
  });

  // 拖完手一松，浏览器还会补一个 click：吃掉它，免得误开面板
  window.addEventListener('click', (e) => {
    if (performance.now() - blockedAt < 300) {
      e.stopPropagation();
      e.preventDefault();
    }
  }, true);

  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
    if (locked) {
      noLock = false;
      dragging = false;
      if (!roam) setRoam(true);
    } else {
      keys.clear();
    }
    onLock?.(roam);
  });
  document.addEventListener('pointerlockerror', markNoLock);

  // 能不能真的开走：锁住了，或者确认锁不了并且玩家已经点过画面
  const driving = () => locked || (noLock && roam);

  function update(dt) {
    if (!active) return;
    const on = driving();
    const fwd = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
    const side = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
    const sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const speed = sprint ? 5.1 : 3.05;

    let ix = on ? side : 0, iy = on ? fwd : 0;
    const mag = Math.hypot(ix, iy);
    if (mag > 0) { ix /= mag; iy /= mag; }
    const sin = Math.sin(yaw), cos = Math.cos(yaw);
    const tx = (-sin * iy + cos * ix) * speed;
    const tz = (-cos * iy - sin * ix) * speed;
    const k = 1 - Math.exp(-(on ? 11 : 16) * dt);
    vel.x += (tx - vel.x) * k;
    vel.z += (tz - vel.z) * k;
    if (Math.abs(vel.x) < 0.002) vel.x = 0;
    if (Math.abs(vel.z) < 0.002) vel.z = 0;

    pos.x += vel.x * dt;
    pos.z += vel.z * dt;
    collide(pos);

    const sp = Math.hypot(vel.x, vel.z);
    bobT += dt * sp * 2.5;
    const bob = Math.sin(bobT) * 0.026 * Math.min(1, sp / 3);

    cam.position.set(pos.x, EYE + bob, pos.z);
    cam.rotation.set(pitch, yaw, 0, 'YXZ');

    const target = fitFov(sprint && sp > 3 ? 66 : 62, cam.aspect);
    if (Math.abs(cam.fov - target) > 0.05) {
      cam.fov += (target - cam.fov) * Math.min(1, dt * 6);
      cam.updateProjectionMatrix();
    }
  }

  return {
    get locked() { return locked; },
    get roaming() { return roam; },
    get dragMode() { return noLock && !locked; },
    get active() { return active; },
    // 'camera' 从当前镜头接管（关面板回书房时用），'spawn' 直接回到门边
    enter(mode = 'camera') {
      if (first || mode === 'spawn') {
        pos.set(SPAWN.x, EYE, SPAWN.z);
        yaw = SPAWN.yaw;
        pitch = SPAWN.pitch;
        first = false;
      } else {
        poseFromCamera();
      }
      vel.set(0, 0, 0);
      active = true;
      cam.fov = fitFov(62, cam.aspect);
      cam.updateProjectionMatrix();
      cam.position.set(pos.x, EYE, pos.z);
      cam.rotation.set(pitch, yaw, 0, 'YXZ');
    },
    exit() {
      active = false;
      keys.clear();
      vel.set(0, 0, 0);
      dragging = false;
      releaseLock();
      setRoam(false);
    },
    // 回到刚才站的地方：从典故场景退回来时用，人不会被打回门口
    resume(p) {
      if (!p) return this.enter('camera');
      pos.set(p.x, EYE, p.z);
      yaw = p.yaw;
      pitch = p.pitch;
      vel.set(0, 0, 0);
      active = true;
      cam.fov = fitFov(62, cam.aspect);
      cam.updateProjectionMatrix();
      cam.position.set(pos.x, EYE, pos.z);
      cam.rotation.set(pitch, yaw, 0, 'YXZ');
    },
    update,
    // 供 UI 提示用
    get pose() { return { x: pos.x, z: pos.z, yaw, pitch }; },
  };
}
