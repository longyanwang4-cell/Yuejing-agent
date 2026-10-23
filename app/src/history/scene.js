import * as THREE from 'three';
import { buildDiorama, BOOK } from './diorama.js';
import { STORIES, PENDING_STORIES } from './story.js';
import { wipeIn, wipeOut } from '../ui/wipe.js';

const SHOTS = {
  // drop：落点。镜头先落在街面高度，再拉开成 wide —— 像书页摊开，人站在街心
  drop:   { pos: new THREE.Vector3(2.15, 0.42, 1.02), look: new THREE.Vector3(2.05, 0.30, -1.05), fov: 52 },
  // wide 不是「整本书」的全景。原来退到 z=5.3，书只占下半幅，人也只有几个像素 ——
  // 等于把模型的简略放大给人看。现在推近到右页占满画面，左页只留书脊那一线：
  // 「这是一本书」靠书脊和纸边交代就够了，用不着把整本书塞进来。
  wide:   { pos: new THREE.Vector3(2.20, 2.75, 3.85), look: new THREE.Vector3(2.15, 0.06, 0.15), fov: 44 },
  // wide2 抬高、近乎俯瞰整页 —— 第五幕要人退一步看全貌
  wide2:  { pos: new THREE.Vector3(2.10, 3.90, 2.75), look: new THREE.Vector3(2.15, 0.0, -0.12), fov: 44 },
  lianpo: { pos: new THREE.Vector3(1.05, 1.25, 2.90), look: new THREE.Vector3(1.75, 0.32, 0.95), fov: 38 },
  // street / gate 的落点由 aimedShot() 当场算（见下面 AIM），
  // 表里只留一份「没人可跟」时的兜底：对着右页正中。
  street: { pos: new THREE.Vector3(3.35, 1.90, 2.40), look: new THREE.Vector3(2.15, 0.24, 0.00), fov: 44 },
  gate:   { pos: new THREE.Vector3(2.35, 1.25, 2.60), look: new THREE.Vector3(2.15, 0.28, 0.00), fov: 42 },
};

const $ = (id) => document.getElementById(id);

// —— 跟人的机位 ——
// wide / wide2 / lianpo / drop 是排好的取景，谁演都一样。
// street 与 gate 不行：六篇的人站位差得远，固定机位总会有一篇对着空地开镜
// （陶潜那一篇的「结果」，三个人全在画面外）。这两个机位改成盯着这一场的人算：
// 取在场人物的中心，机位按固定偏移吊在上方 —— 角度是导演的，落点是当场算的。
const AIM = {
  street: { off: new THREE.Vector3(1.2, 1.9, 2.4), look: 0.24, fov: 44 },
  gate:   { off: new THREE.Vector3(0.2, 1.25, 2.6), look: 0.28, fov: 42 },
};

function aimedShot(name, story, step) {
  const base = SHOTS[name];
  const aim = AIM[name];
  if (!aim) return base;
  const beat = story.beats && story.beats[step.key];
  if (!beat) return base;
  let x = 0, z = 0, n = 0;
  for (const a of Object.values(beat)) {
    if (!a || a.vis === false || !a.p) continue;
    x += a.p[0];
    z += a.p[1];
    n++;
  }
  if (!n) return base;
  // 人的站位是相对街景中心的，街景挂在右页中心
  x = x / n + BOOK.origin.x;
  z /= n;
  return {
    pos: new THREE.Vector3(x + aim.off.x, aim.off.y, z + aim.off.z),
    look: new THREE.Vector3(x, aim.look, z),
    fov: aim.fov,
  };
}

// 历史典故场景：一本摊开的书 + 右页上的微缩街景。分五幕推进。
export function createHistory(engine, { studyScene, studyShots, onExit, onPractice }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x120c16);
  // 暖雾：案面的远处边缘化进雾里，站到街面高度也不会看见一条假地平线
  scene.fog = new THREE.FogExp2(0x140d17, 0.04);

  const dio = buildDiorama();
  scene.add(dio.root);

  const ui = buildUI();
  let story = null, storyId = null, step = 0, open = false;

  engine.onTick((dt, t) => { if (open) dio.update(dt, t); });

  // camDur = 这一下镜头用多久到位；进场时先 snap 在街面，再拉开，所以传 0
  function render(camDur = 2.0) {
    const s = story.steps[step];
    ui.setMeta(story, s, step);
    dio.setStoryStep(story, s, step);
    dio.setStep(step, s.key);
    if (camDur > 0) engine.rig.goShot(aimedShot(s.shot, story, s), camDur);
    ui.setConcept(step === story.steps.length - 1 ? story : null);
  }

  function go(delta) {
    const next = Math.min(story.steps.length - 1, Math.max(0, step + delta));
    if (next === step) return;
    step = next;
    render();
  }

  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  // —— 实景练习 ——
  // 练习不在书里演：这里是「看别人的典故」，练习是另一间 1:1 的房间。
  // 所以这一下只做交接：化场、收界面，把这篇典故交给练习场景接手。
  let handing = false;
  async function startPractice() {
    const p = story && story.practice;
    if (!p || handing) return;
    handing = true;
    ui.setConcept(null);
    await wipeIn(380);
    open = false;
    ui.unmount();
    onPractice?.(story, storyId);
    handing = false;
  }

  const api = {
    scene,
    shots: SHOTS,
    get isOpen() { return open; },
    has: (cardId) => !!STORIES[cardId],
    // 从书房进场：书房的镜头已经推到典籍上了，这里化进书页、落在街面、再拉开
    async open(cardId, { fromStudy = false } = {}) {
      const st = STORIES[cardId];
      if (!st) { ui.showPending(PENDING_STORIES[cardId] || { title: '本篇', line: '' }, () => onExit?.()); return false; }
      story = st;
      storyId = cardId;
      step = 0;
      open = true;
      ui.mount(st, {
        onJump: (i) => { step = i; render(); },
        onPrev: () => go(-1),
        onNext: () => go(1),
        onExit: () => api.close(),
        onPractice: () => startPractice(),
      });
      await wipeIn(fromStudy ? 340 : 460);
      engine.setScene(scene, SHOTS);
      engine.rig.snap('drop');
      render(0);
      await nextFrame();
      engine.rig.goShot(aimedShot(st.steps[0].shot, story, st.steps[0]), 2.8);
      wipeOut();
      return true;
    },
    async close(opts = {}) {
      if (!open) return;
      const res = { cardId: storyId, practice: !!opts.practice };
      await wipeIn(380);
      open = false;
      ui.unmount();
      engine.setScene(studyScene, studyShots);
      onExit?.(res);
      await nextFrame();
      wipeOut();
    },
  };

  window.addEventListener('keydown', (e) => {
    if (!open) return;
    if (e.key === 'ArrowRight') go(1);
    if (e.key === 'ArrowLeft') go(-1);
    if (e.key === 'Escape') api.close();
  });

  return api;
}

// ——— 界面 ———
function buildUI() {
  const host = document.createElement('section');
  host.id = 'story';
  host.className = 'story';
  host.hidden = true;
  host.innerHTML = `
    <header class="story-top">
      <button class="back" id="story-back">← 回到书房</button>
      <div class="story-meta"><b id="story-name"></b><span id="story-src"></span></div>
    </header>

    <aside class="story-note" id="story-note">
      <div class="note-head"><span id="story-era"></span><em id="story-step"></em></div>
      <p id="story-cap"></p>
      <div class="note-rule"></div>
    </aside>

    <div class="story-concept" id="story-concept" hidden>
      <span class="cc-label">这一幕，有一个名字</span>
      <b id="cc-concept"></b>
      <small id="cc-src"></small>
      <button class="cc-go" id="cc-go">带着这句话回去练 →</button>
    </div>

    <footer class="story-rail">
      <div class="rail-dots" id="rail-dots"></div>
      <div class="rail-controls">
        <button id="story-prev">上一步</button>
        <span class="rail-count" id="story-count"></span>
        <button id="story-next" class="primary">下一步</button>
      </div>
    </footer>

    <div class="story-pending" id="story-pending" hidden>
      <div class="pd-card">
        <span class="pd-kicker">这一篇还在写</span>
        <h2 id="pd-title"></h2>
        <p id="pd-line"></p>
        <p class="pd-note">这一篇的 3D 场景还没搭好，先把题面放进书架。</p>
        <button class="cc-go" id="pd-back">回到书房 →</button>
      </div>
    </div>`;
  document.getElementById('app').appendChild(host);

  const el = (id) => host.querySelector(`#${id}`);
  const back = el('story-back');
  const pending = el('story-pending');
  return {
    mount(st, h) {
      host.hidden = false;
      document.body.classList.add('in-story');
      el('story-name').textContent = st.title;
      el('story-src').textContent = st.source;
      el('story-era').textContent = st.era;
      pending.hidden = true;
      el('rail-dots').innerHTML = st.steps.map((s) => `<button data-i="${st.steps.indexOf(s)}" title="${s.label}"><i></i><em>${s.label}</em></button>`).join('');
      el('rail-dots').querySelectorAll('[data-i]').forEach((b) => {
        b.onclick = () => h.onJump?.(Number(b.dataset.i));
      });
      el('story-prev').onclick = h.onPrev;
      el('story-next').onclick = h.onNext;
      el('cc-go').onclick = h.onPractice;
      back.onclick = h.onExit;
      pending.hidden = true;
      host._stepJump = h.onJump;
    },
    unmount() {
      host.hidden = true;
      document.body.classList.remove('in-story');
      el('story-concept').hidden = true;
    },
    showPending(info, onBack) {
      host.hidden = false;
      pending.hidden = false;
      el('pd-title').textContent = info.title;
      el('pd-line').textContent = info.line || '';
      el('pd-back').onclick = () => { pending.hidden = true; host.hidden = true; onBack(); };
    },
    setMeta(st, s, idx) {
      el('story-step').textContent = `第${'一二三四五'[idx]}幕`;
      el('story-cap').textContent = s.caption || '';
      el('story-note').classList.remove('in');
      void el('story-note').offsetWidth;
      el('story-note').classList.add('in');
      el('story-count').textContent = `${idx + 1} / ${st.steps.length}`;
      el('story-prev').disabled = idx === 0;
      const last = idx === st.steps.length - 1;
      el('story-next').textContent = last ? '看完了' : '下一步';
      el('story-next').disabled = last;
      el('rail-dots').querySelectorAll('[data-i]').forEach((b) => {
        const i = Number(b.dataset.i);
        b.classList.toggle('on', i === idx);
        b.classList.toggle('done', i < idx);
        b.onclick = () => host._stepJump && host._stepJump(i);
      });
    },
    setConcept(st) {
      const box = el('story-concept');
      if (!st) { box.hidden = true; return; }
      el('cc-concept').textContent = st.concept;
      el('cc-src').textContent = `${st.origin} · ${st.section}`;
      box.hidden = false;
      box.classList.remove('in');
      void box.offsetWidth;
      box.classList.add('in');
    },
  };
}
