// 化场：一层暖纸色的光，铺满整个屏幕再换场景。
// 书房 / 典故 / 实景练习三个场景共用这一层 —— 交接时不能各拿一张纸，
// 那样会出现「两张纸叠着，谁也关不掉」的黑屏。

let el = null;

function node() {
  if (el) return el;
  el = document.createElement('div');
  el.id = 'wipe';
  el.className = 'wipe';
  document.body.appendChild(el);
  return el;
}

export function wipeIn(ms = 420) {
  node().classList.add('on');
  return new Promise((r) => setTimeout(r, ms));
}

export function wipeOut() {
  node().classList.remove('on');
}
