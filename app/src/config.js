// 书房的几何常量。墙体是正八边形：apothem 为中心到每面墙的垂直距离。
export const ROOM = {
  apothem: 8.5,
  wallH: 9.4,
  deckY: 4.62,
  depth: 0.45,
  get circ() { return this.apothem / Math.cos(Math.PI / 8); },
  get wallW() { return 2 * this.apothem * Math.tan(Math.PI / 8); },
};

// 书房中心（圆桌、地毯、吊灯共用）
export const HUB = { x: 1.0, z: -1.4 };

// 沟通达人站的位置
export const GUIDE = { x: -2.0, z: 0.9, yaw: 0.5 };

// 进门站位：站在门边，稍偏向智能体，一眼能看到圆桌与书架
export const SPAWN = { x: 1.2, z: 6.8, yaw: 0.40, pitch: 0.02 };

// 漫游碰撞体（地面上的圆柱形障碍），半径按家具外轮廓给
export const WALK_COLLIDERS = [
  { x: HUB.x, z: HUB.z, r: 1.55 },        // 圆桌
  { x: 7.2, z: -0.6, r: 1.45 },           // 长沙发
  { x: 5.0, z: 1.3, r: 0.85 },            // 扶手椅
  { x: 7.5, z: 1.9, r: 0.42 },            // 落地灯
  { x: -4.6, z: 3.4, r: 0.42 },
  { x: 7.4, z: -2.9, r: 0.42 },
  { x: -4.8, z: 0, r: 1.35 },             // 旋梯
  { x: GUIDE.x, z: GUIDE.z, r: 0.58 },    // 沟通达人
];

// 画布里用的字体：走系统楷体/宋体，不依赖外网字体
export const FONT_BRUSH = '"STKaiti","KaiTi","楷体","Kaiti SC","Noto Serif SC",serif';
export const FONT_SERIF = '"Noto Serif SC","Source Han Serif SC","Songti SC","SimSun","宋体",serif';
export const FONT_SANS = '"Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif';

// 一张知识卡 = 一部史书里的一段典故。顺序与 knowledge/cards.json 一致。
// sub 是书脊上的出处简称，竖排显示，所以控制在 4 字以内。
const CASES = [
  { card: 'boundary_task_separation',        group: '拒绝与边界', title: '子罕辞玉',       origin: '左传' },
  { card: 'boundary_courage_disliked',       group: '拒绝与边界', title: '苏武持节',       origin: '汉书' },
  { card: 'boundary_not_others_expectation', group: '拒绝与边界', title: '不为五斗米折腰', origin: '晋书' },
  { card: 'conflict_power_struggle',         group: '冲突应对',   title: '晏子使楚',       origin: '晏子春秋' },
  { card: 'conflict_being_right_is_trap',    group: '冲突应对',   title: '将相和',         origin: '史记' },
  { card: 'conflict_anger_is_a_tool',        group: '冲突应对',   title: '唐雎不辱使命',   origin: '战国策' },
];

// 哪些知识卡已经练过：从浏览器里的真实训练记录算（net/records.js），不再是写死的演示数据。
// 这是一个「实时视图」：每次读取都重算，所以练完一场回到书房，书架立刻变化。
import { practicedCardIds } from './net/records.js';
export const UNLOCKED_CARDS = { has: (id) => practicedCardIds().has(id) };

export const SHELF = CASES.map((p) => ({
  id: `h:${p.card}`, kind: 'history', title: p.title, sub: p.origin, card: p.card, group: p.group,
}));

// 六篇典故现在都有五幕场景了，书架上不再有「还没做」的位置，
// 点亮的判定就只剩「练过没有」这一条。
export const isLit = (item) => UNLOCKED_CARDS.has(item.card);
export const litCount = () => SHELF.filter(isLit).length;
