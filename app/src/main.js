import './styles/main.css';
import './styles/ui.css';
import './styles/panel.css';
import './styles/story.css';
import './styles/practice.css';
import './styles/assets.css';
import { createEngine } from './core/engine.js';
import { createPicker } from './core/pick.js';
import { buildStudy } from './world/scene.js';
import { SHOTS as STUDY_SHOTS } from './world/shots.js';
import { createHistory } from './history/scene.js';
import { createPractice } from './practice/scene.js';
import { createFlow } from './ui/flow.js';
import { api } from './net/api.js';
import { loadLibrary } from './net/session.js';
import { redrawGrowthBoard } from './world/refresh.js';
import { refreshBooks } from './world/books.js';
import { onRecordsChange } from './net/records.js';

const canvas = document.getElementById('gl');
const engine = createEngine(canvas);
const world = buildStudy(engine);
const picker = createPicker(engine, canvas);

let flow;
// 三个场景各管各的：书房（漫游）/ 典故（看别人）/ 练习（你自己上场）
const practice = createPractice(engine, {
  studyScene: engine.scene,
  studyShots: STUDY_SHOTS,
  onExit: (res) => flow.returnFromStory(res),
});
const history = createHistory(engine, {
  studyScene: engine.scene,
  studyShots: STUDY_SHOTS,
  onExit: (res) => flow.returnFromStory(res),
  // 看完典故点「回去练」：典故化场收掉，接着换到练习那间屋子
  onPractice: (story) => practice.open(story, story.id),
});
flow = createFlow({ engine, world, picker, history });

engine.onTick((dt, t) => {
  world.guide.update(dt, t, engine.camera.position);
});

engine.start();
flow.start();
window.__engine = engine;
window.__world = world;
window.__flow = flow;
window.__history = history;
window.__practice = practice;
// 书架点亮和成长看板都按真实练习记录画，而不是写死的演示数字。
// 页面一加载就画一遍（刷新后记录还在），记录变化（练完一场、清除记录）时也自动重画。
const syncWorld = () => { refreshBooks(world.books); redrawGrowthBoard(world); };
syncWorld();
onRecordsChange(syncWorld);

// 后端状态：在线模型 / 离线演示 / 连不上。先把页面亮起来，再异步取，不阻塞 3D 书房。
const badge = document.getElementById('mock');
function showBadge(text, warn) {
  badge.hidden = false;
  badge.textContent = text;
  badge.classList.toggle('warn', !!warn);
}
loadLibrary().catch(() => {});
api.health().then((h) => showBadge(h.live ? `在线模型 · ${h.model}` : '离线演示模式 · 规则驱动，不是模型生成', !h.live))
  .catch(() => showBadge('后端未连接 · 对话与练习暂不可用', true));

document.getElementById('loader').classList.add('done');
