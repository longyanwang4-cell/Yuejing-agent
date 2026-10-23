import * as THREE from 'three';
import { SHELF, isLit, WALK_COLLIDERS } from '../config.js';
import { ICONS } from './icons.js';
import { shelfPanel, cardPanel, growthPanel, explorePanel } from './panels.js';
import { createWalker } from '../core/walker.js';
import { GREETING, QUICK_CHIPS, cardById } from '../mock/data.js';
import { diagnose } from '../net/session.js';
import { refreshBooks } from '../world/books.js';
import { redrawGrowthBoard } from '../world/refresh.js';

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// 套书名号：概念名自带「」时不再嵌套
const q = (s) => (s.includes('「') ? s : `「${s}」`);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const MENU = [
  { id: 'talk', title: '开始对话', sub: '告诉我你的困扰' },
  { id: 'shelf', title: '我的书架', sub: '' },
  { id: 'growth', title: '成长记录', sub: '看看我的变化' },
  { id: 'explore', title: '探索更多场景', sub: '历史人物 · 经典案例' },
];

// 书房的界面状态机：home / talk / shelf / growth / explore。所有内容均为 mock。
export function createFlow({ engine, world, picker, history }) {
  const els = {
    menu: $('menu'), bubble: $('bubble'), text: $('bubble-text'), choices: $('bubble-choices'),
    dock: $('dock'), chips: $('dock-chips'), form: $('dock-form'), input: $('dock-input'),
    panel: $('panel'), back: $('back'), tip: $('tip'), hint: $('hint'), curtain: $('curtain'),
    crosshair: $('crosshair'), xlabel: $('xlabel'), canvas: $('gl'),
  };
  // 回到书房时的那张纸条：挂在 body 上，比现有 UI 晚建，不占 index.html
  const returnNote = document.createElement('aside');
  returnNote.id = 'return-note';
  returnNote.addEventListener('click', () => returnNote.classList.remove('on'));
  document.body.appendChild(returnNote);
  els.returnNote = returnNote;
  let mode = 'home';
  let typing = 0;
  let busy = false;
  const headPos = new THREE.Vector3();

  // —— 第一人称漫游 ——
  let lookId = null;
  const walk = createWalker(engine, {
    canvas: els.canvas,
    colliders: WALK_COLLIDERS,
    pickAt: (ev) => picker.pickAtEvent(ev),
    // 锁住光标时只留准星 + E；没锁住则保留鼠标悬停和点击，两种都能用
    onLock: (roam) => {
      els.crosshair.hidden = !roam;
      if (roam) leaveTip();
      picker.setEnabled(!walk.locked && (mode === 'home' || mode === 'shelf'));
      renderHint();
    },
    // E：触发准星对着的东西
    onUse: () => {
      if (lookId) picker.trigger(lookId);
    },
  });

  // —— 菜单 ——
  function renderHint() {
    els.hint.innerHTML = walk.locked
      ? '<b>W A S D</b> 移动 · 鼠标转视角 · <b>E</b> 交互 · <b>Esc</b> 释放鼠标'
      : walk.dragMode
        ? '<b>按住鼠标拖动</b>转视角 · <b>W A S D</b> 移动 · <b>E</b> 交互'
        : walk.roaming
          ? '<b>点击画面</b>锁定鼠标继续转视角 · <b>W A S D</b> 移动 · <b>E</b> 交互'
          : '<b>点击画面</b>开始漫游 · <b>W A S D</b> 移动 · 鼠标转视角 · <b>E</b> 交互';
  }

  function renderMenu() {
    els.menu.innerHTML = MENU.map((m) => `
      <button class="menu-item ${mode === m.id ? 'active' : ''}" data-mode="${m.id}">
        <span class="menu-ico">${ICONS[m.id]}</span>
        <span><b>${m.title}</b><small>${m.id === 'shelf' ? `已点亮 ${SHELF.filter(isLit).length}/${SHELF.length} 部` : m.sub}</small></span>
      </button>`).join('');
  }
  els.menu.addEventListener('click', (e) => {
    const b = e.target.closest('[data-mode]');
    if (b) go(b.dataset.mode);
  });

  // —— 气泡 ——
  async function say(text, choices = []) {
    const my = ++typing;
    els.bubble.hidden = false;
    els.bubble.style.animation = 'none';
    void els.bubble.offsetWidth;
    els.bubble.style.animation = '';
    els.choices.innerHTML = '';
    els.text.classList.remove('caret');
    els.text.textContent = '';
    world.guide.talking = true;
    for (let i = 1; i <= text.length; i++) {
      if (my !== typing) return;
      els.text.textContent = text.slice(0, i);
      els.text.classList.add('caret');
      await sleep(/[，。？！]/.test(text[i - 1]) ? 90 : 32);
    }
    els.text.classList.remove('caret');
    world.guide.talking = false;
    els.choices.innerHTML = choices.map((c, i) => `<button class="choice ${c.kind || ''}" data-i="${i}">${c.label}</button>`).join('');
    els.choices._list = choices;
  }
  function thinking() {
    ++typing;
    els.bubble.hidden = false;
    els.choices.innerHTML = '';
    els.text.classList.remove('caret');
    els.text.innerHTML = '<span class="dots"><span></span><span></span><span></span></span>';
    world.guide.talking = true;
  }
  function hideBubble() {
    ++typing;
    els.bubble.hidden = true;
    world.guide.talking = false;
  }
  els.choices.addEventListener('click', (e) => {
    const b = e.target.closest('[data-i]');
    if (b) els.choices._list[Number(b.dataset.i)].run();
  });

  // —— 面板 ——
  function showPanel(html) {
    els.panel.hidden = false;
    els.panel.style.animation = 'none';
    void els.panel.offsetWidth;
    els.panel.style.animation = '';
    els.panel.innerHTML = html;
  }
  function hidePanel() { els.panel.hidden = true; }
  els.panel.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const act = b.dataset.act;
    if (act === 'book') showPanel(cardPanel(b.dataset.id));
    if (act === 'shelf-list') showPanel(shelfPanel());
    if (act === 'story') openStory(b.dataset.card);
  });

  // —— 模式切换 ——
  function go(next, opts = {}) {
    if (busy) return;
    mode = next;
    hideBubble();
    hidePanel();
    if (next !== 'home') els.returnNote.classList.remove('on');
    els.dock.hidden = true;
    els.hint.classList.toggle('off', next !== 'home');
    els.back.hidden = next === 'home';
    renderMenu();
    els.menu.style.display = next === 'home' ? '' : 'none';

    // home 把相机交还给玩家；其它模式改由机位系统接管
    const shot = { home: 'home', talk: 'talk', shelf: 'shelf', growth: 'growth', explore: 'explore' }[next];
    if (next === 'home') {
      engine.rig.enable(false);
      if (opts.resume) walk.resume(opts.resume);
      else walk.enter(opts.spawn ? 'spawn' : 'camera');
    } else {
      walk.exit();
      els.crosshair.hidden = true;
      if (!opts.keepCam) {
        engine.rig.enable(true);
        engine.rig.syncFromCamera();
        engine.rig.go(shot, 1.9);
      }
    }
    picker.setEnabled(!walk.locked && (next === 'home' || next === 'shelf'));

    const wait = opts.keepCam ? 40 : 1300;
    if (next === 'home') sleep(1400).then(() => mode === 'home' && !opts.noGreet && greet());
    if (next === 'talk') sleep(1500).then(() => mode === 'talk' && startTalk());
    if (next === 'shelf') sleep(wait).then(() => mode === 'shelf' && showPanel(opts.item ? cardPanel(opts.item) : shelfPanel()));
    if (next === 'growth') sleep(wait).then(() => mode === 'growth' && showPanel(growthPanel()));
    if (next === 'explore') sleep(wait).then(() => mode === 'explore' && showPanel(explorePanel()));
  }
  els.back.addEventListener('click', () => go('home'));

  // —— 对话（mock） ——
  function greet() {
    say(GREETING, [{ label: '开始聊聊', kind: 'primary', run: () => go('talk') }]);
  }
  async function startTalk() {
    await say(GREETING);
    els.dock.hidden = false;
    els.chips.innerHTML = QUICK_CHIPS.map((c, i) => `<button class="chip" data-i="${i}">${c.label}</button>`).join('');
    els.input.focus();
  }
  els.chips.addEventListener('click', (e) => {
    const b = e.target.closest('[data-i]');
    if (!b) return;
    els.input.value = QUICK_CHIPS[Number(b.dataset.i)].text;
    els.input.focus();
  });
  const CRISIS_LINES = [{ name: '全国统一心理援助热线', number: '12356' }, { name: '希望24热线', number: '400-161-9995' }];

  els.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = els.input.value.trim();
    if (!text || mode !== 'talk' || busy) return;
    els.input.value = '';
    els.dock.hidden = true;
    thinking();
    let r;
    try {
      r = await diagnose(text);
    } catch (err) {
      // 网络/超时/服务错误：把话还给用户，让他再试一次，不白屏
      await say(`${err.message}`, [{ label: '再试一次', kind: 'primary', run: () => { els.input.value = text; els.dock.hidden = false; els.input.focus(); hideBubble(); } }]);
      return;
    }
    const d = r.diagnosis;

    // 危机：不分类、不练习、不给卡片，只给热线
    if (r.crisis || d.safety_flag === 'crisis') {
      await say(d.user_facing_message, [{ label: '我知道了', kind: 'ghost', run: () => go('home') }]);
      return;
    }
    if (d.next_action === 'ask_once') {
      await say(d.user_facing_message);
      els.dock.hidden = false;
      els.input.placeholder = '补充一下具体发生了什么…';
      els.input.focus();
      return;
    }
    if (d.next_action === 'decline_scope') {
      await say(d.user_facing_message, [{ label: '换个说法', kind: 'ghost', run: () => { hideBubble(); els.dock.hidden = false; els.input.focus(); } }]);
      return;
    }
    // offer_choice：把后端判断的依据原样说给用户，再让他确认
    await say(d.user_facing_message, [
      { label: '对，就是这个', kind: 'primary', run: () => confirmDiagnosis(r) },
      { label: '不太对，我再说说', kind: 'ghost', run: () => { say('好的，换个说法再讲一次吧。'); els.dock.hidden = false; els.input.focus(); } },
    ]);
  });

  async function confirmDiagnosis(r) {
    const card = (r.cards || [])[0];
    const h = card && card.history;
    if (!card) { go('home'); return; }
    if (!h || !history.has(card.id)) {
      await say(`明白了。这类困扰可以用${q(card.concept)}来看。这张卡的典故还在补，我们先直接练一练吧。`, [
        { label: '直接开始练习', kind: 'primary', run: () => openPractice(r) },
      ]);
      return;
    }
    await say(`先不讲道理，带你去看一个故事：${q(h.name)}。看完再回来，我们给它起个名字，叫${q(card.concept)}。`, [
      { label: `去看${q(h.name)}`, kind: 'primary', run: () => openStory(card.id) },
      { label: '先留在书房', kind: 'ghost', run: () => go('home') },
    ]);
  }

  // 没有典故可看时的直通：直接把后端诊断出的场景交给练习场景
  function openPractice(r) {
    const card = (r.cards || [])[0];
    if (card) openStory(card.id);
  }

  // —— 进入历史典故场景 / 练习 ——
  // 进场不是切镜头，是「走进书里」：镜头先俯冲到「以史为鉴」那五部典籍上，
  // 化场的那一层暖光就落在这里；进到书里之后先落在街面，再拉开成整本书。
  let savedPose = null;
  async function openStory(cardId) {
    hideBubble();
    hidePanel();
    els.dock.hidden = true;
    els.menu.style.display = 'none';
    els.back.hidden = true;
    els.hint.classList.add('off');
    els.tip.hidden = true;
    mode = 'story';
    savedPose = { ...walk.pose };
    walk.exit();
    els.crosshair.hidden = true;
    picker.setEnabled(false);
    engine.rig.enable(true);
    engine.rig.syncFromCamera();
    if (!history.has(cardId)) { history.open(cardId); return; }   // 还没做的篇目：直接给待办卡
    engine.rig.go('dive', 1.15);
    await sleep(1000);
    history.open(cardId, { fromStudy: true });
  }

  // 从典故场景回到书房：人还在原来站的地方，不是被打回门口。
  // 回来时用一张「带回书房」的纸条收口，不用气泡 —— 人可能背对着沟通达人，
  // 气泡会飘在空处、尾巴指不到任何人。
  let noteTimer = 0;
  function showReturnNote(cardId, practiced) {
    const c = cardById[cardId];
    if (!c) return;
    els.returnNote.innerHTML = `
      <small>${practiced ? '练过一场' : '带回书房'}</small>
      <b>${esc(c.concept)}</b>
      <em>${esc(c.source || '')}</em>
      <div class="rn-rule"></div>
      <p>${practiced ? '刚才那一场已经记下。下次遇到同样的场面，先想起这句话。' : '已记入「我的书架」，随时可以再看一遍。'}</p>`;
    els.returnNote.classList.add('on');
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => els.returnNote.classList.remove('on'), 7600);
  }

  function returnFromStory(res = {}) {
    refreshBooks(world.books);
    redrawGrowthBoard(world);
    mode = 'home';
    go('home', { noGreet: true, resume: savedPose });
    savedPose = null;
    if (!res.cardId) return;
    sleep(1250).then(() => { if (mode === 'home') showReturnNote(res.cardId, !!res.practiced); });
  }

  // —— 3D 拾取 ——
  const tip = (html) => { els.tip.hidden = false; els.tip.innerHTML = html; };
  const moveTip = (ev) => { els.tip.style.left = `${ev.clientX}px`; els.tip.style.top = `${ev.clientY}px`; };
  const leaveTip = () => { els.tip.hidden = true; };
  function reg(root, id, label, sub, onClick, use) {
    picker.register(root, id, {
      use, onEnter: (ev) => { tip(`<b>${label}</b><small>${sub}</small>`); moveTip(ev); },
      onMove: moveTip, onLeave: leaveTip, onClick,
    });
  }
  reg(world.guide.root, 'guide', '沟通达人', '点击开始对话', () => mode === 'home' && go('talk'), '与她对话');
  reg(world.spirit.root, 'spirit', '小光灵', '书房的记忆守护者', () => mode === 'home' && say('我会记住你每一次练习。练得越多，书架上亮的典籍就越多。', [{ label: '好', run: () => hideBubble() }]), '和小光灵说话');
  reg(world.arm, 'arm', '浑天仪', '探索更多场景', () => mode === 'home' && go('explore'), '转动浑天仪');
  reg(world.board, 'board', '成长看板', '查看成长记录', () => mode === 'home' && go('growth'), '看成长记录');
  reg(world.gate, 'gate', '走向真实世界', '实战（后续开放）', () => mode === 'home' && say('走进真实世界之前，先在书房里练好每一步。实战入口之后开放。', [{ label: '好', run: () => hideBubble() }]), '走近那扇门');
  picker.addRoot(world.dcase);
  SHELF.forEach((it) => {
    picker.handle(`book:${it.id}`, {
      use: `阅读「${it.title}」`,
      onEnter: (ev) => {
        world.books.find((b) => b.userData.item.id === it.id).userData.target = 1;
        tip(`<b>${it.title}</b><small>${it.sub} · ${isLit(it) ? '已点亮' : '未解锁'}</small>`);
        moveTip(ev);
      },
      onMove: moveTip,
      onLeave: () => { world.books.find((b) => b.userData.item.id === it.id).userData.target = 0; leaveTip(); },
      // 走着的时候就地打开详情，镜头不动，退出来还站在原地
      onClick: () => (mode === 'home' ? go('shelf', { item: it.id, keepCam: true }) : showPanel(cardPanel(it.id))),
    });
  });

  // 准星对着什么：每 80ms 打一次射线，只改 UI，不碰相机
  let lookAcc = 0;
  engine.onTick((dt) => {
    if (mode !== 'home') return;
    lookAcc += dt;
    if (lookAcc < 0.08) return;
    lookAcc = 0;
    const id = walk.roaming ? picker.centerHit(3.6) : null;
    if (id === lookId) return;
    lookId = id;
    const label = id ? picker.labelOf(id) : null;
    els.xlabel.textContent = label ? `E  ${label}` : '';
    els.xlabel.classList.toggle('on', !!label);
  });

  // 气泡跟随智能体头部
  // 气泡锚定在智能体脚下的固定点（不跟头部起伏），并带死区：
  // 屏幕位置漂移不到 DEAD 像素就纹丝不动，超过才缓动过去。这样按钮始终是静止的、好点。
  const SIDE = 40, DEAD = 36;
  const placed = { x: 0, y: 0, mode: '', w: 0, ready: false };
  const cur = { x: 0, y: 0 };
  const anchor = new THREE.Vector3();
  engine.onTick((dt) => {
    if (els.bubble.hidden) { placed.ready = false; return; }
    world.guide.root.getWorldPosition(anchor);
    anchor.y += 1.9;
    anchor.project(engine.camera);
    const w = window.innerWidth, h = window.innerHeight;
    const bw = els.bubble.offsetWidth, bh = els.bubble.offsetHeight;
    const sx = (anchor.x * 0.5 + 0.5) * w, sy = (-anchor.y * 0.5 + 0.5) * h;
    // 首页：气泡悬在智能体左上方，让出圆桌和浑天仪；对话页：贴在她右侧
    const top = mode === 'home' && w > 900;
    let x = top ? sx - bw * 0.3 : sx + SIDE + 24;
    let y = top ? sy - bh - 40 : sy - 40;
    x = Math.max(12, Math.min(w - bw - 12, x));
    y = Math.max(70, Math.min(h - bh - 90, y));
    const moved = Math.hypot(x - placed.x, y - placed.y) > DEAD;
    if (!placed.ready || placed.mode !== mode || placed.w !== w || moved) {
      if (!placed.ready) { cur.x = x; cur.y = y; }
      Object.assign(placed, { x, y, mode, w, ready: true });
    }
    const k = 1 - Math.exp(-8 * dt);
    cur.x += (placed.x - cur.x) * k;
    cur.y += (placed.y - cur.y) * k;
    if (Math.abs(placed.x - cur.x) < 0.4) cur.x = placed.x;
    if (Math.abs(placed.y - cur.y) < 0.4) cur.y = placed.y;
    els.bubble.classList.toggle('top', top);
    els.bubble.style.left = `${cur.x}px`;
    els.bubble.style.top = `${cur.y}px`;
  });

  engine.onTick((dt) => walk.update(dt));
  renderMenu();
  renderHint();
  // 开局就站在门边，点击画面即可开始走
  engine.rig.enable(false);
  walk.enter('spawn');
  picker.setEnabled(true);
  return { start: () => sleep(1600).then(() => mode === 'home' && greet()), go, returnFromStory, openStory, walk };
}
