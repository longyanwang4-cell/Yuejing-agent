// 按真实练习记录重画书房里的成长看板。书架点亮由 books.js 的 refreshBooks 负责。
import { growthSummary } from '../net/records.js';
import { litCount } from '../config.js';

export function redrawGrowthBoard(world) {
  const draw = world.board && world.board.userData && world.board.userData.draw;
  if (!draw) return;
  const g = growthSummary();
  draw({
    scenes: g ? g.count : 0,
    delta: g ? `${g.last.overall} 分` : '—',
    unlocked: litCount(),
    stuck: g ? g.stuck : [],
  });
}
