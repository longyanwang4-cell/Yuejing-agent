import cards from '../../../knowledge/cards.json';
import { UNLOCKED_CARDS } from '../config.js';

// 只剩开场白、快捷提示和知识卡索引。诊断、成长数据已改读后端与本地真实记录（net/）。

export const cardById = Object.fromEntries(cards.cards.map((c) => [c.id, c]));

export const GREETING = '你好呀！我是你的沟通达人智能体。今天你想解决什么人际困扰呢？';

export const QUICK_CHIPS = [
  { label: '不好意思拒绝别人', text: '室友老借我的充电器，我又不好意思拒绝' },
  { label: '小组作业有人甩锅', text: '小组作业有人甩锅，我一说就吵起来了' },
  { label: '怕被人讨厌', text: '我总是怕拒绝之后别人会讨厌我' },
  { label: '一说话就想发火', text: '一和室友说事情我就忍不住发火，事后又后悔' },
];

export const SCENE_DEFAULT_CARD = { 拒绝与边界: 'boundary_task_separation', 冲突应对: 'conflict_power_struggle' };

export const isCardUnlocked = (id) => UNLOCKED_CARDS.has(id);
export const allCards = cards.cards;
