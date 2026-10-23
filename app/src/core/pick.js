import * as THREE from 'three';

// 3D 物体的悬停/点击。物体及其所有子网格需带 userData.pickId，再用 handlers[pickId] 响应。
export function createPicker(engine, canvas) {
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const roots = [];
  const handlers = new Map();
  let hover = null;
  let enabled = true;
  let last = null;

  function resolve(hits) {
    for (const h of hits) {
      if (h.object.isSprite || h.object.material?.blending === THREE.AdditiveBlending) continue;
      let o = h.object;
      while (o) {
        if (o.userData?.pickId && handlers.has(o.userData.pickId)) return o.userData.pickId;
        o = o.parent;
      }
      return null;
    }
    return null;
  }

  function hit(ev) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -(((ev.clientY - r.top) / r.height) * 2 - 1));
    ray.setFromCamera(ndc, engine.camera);
    return resolve(ray.intersectObjects(roots, true));
  }

  // 准星射线：从屏幕正中打出去，限定距离，供 E 交互用
  function centerHit(maxDist = 3.6) {
    ndc.set(0, 0);
    ray.setFromCamera(ndc, engine.camera);
    ray.far = maxDist;
    const id = resolve(ray.intersectObjects(roots, true));
    ray.far = Infinity;
    return id;
  }

  function setHover(id, ev) {
    if (id === hover) {
      if (id && handlers.get(id).onMove) handlers.get(id).onMove(ev);
      return;
    }
    if (hover) handlers.get(hover)?.onLeave?.();
    hover = id;
    canvas.style.cursor = id ? 'pointer' : 'default';
    if (id) handlers.get(id).onEnter?.(ev);
  }

  canvas.addEventListener('pointermove', (ev) => {
    last = ev;
    if (!enabled) return;
    setHover(hit(ev), ev);
  });
  canvas.addEventListener('pointerleave', () => setHover(null));
  canvas.addEventListener('click', (ev) => {
    if (!enabled) return;
    const id = hit(ev);
    if (id) handlers.get(id).onClick?.(ev);
  });

  return {
    register(root, id, h) {
      if (!roots.includes(root)) roots.push(root);
      root.traverse((o) => { o.userData.pickId = id; });
      handlers.set(id, h);
    },
    // 一组物体共用 pickId 前缀（如各本书）：自行在子物体上打 pickId，这里只登记处理器
    handle(id, h) { handlers.set(id, h); },
    addRoot(root) { if (!roots.includes(root)) roots.push(root); },
    setEnabled(v) {
      enabled = v;
      if (!v) setHover(null);
    },
    refresh() { if (enabled && last) setHover(hit(last), last); },
    // —— 漫游接口 ——
    centerHit,
    labelOf: (id) => handlers.get(id)?.use || null,
    trigger: (id) => { const h = handlers.get(id); if (h?.onClick) h.onClick({}); },
    pickAtEvent: (ev) => hit(ev),
  };
}
