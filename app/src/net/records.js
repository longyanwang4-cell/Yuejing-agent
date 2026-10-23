// 训练记录：只存在用户自己浏览器的 localStorage，不上传，没有账号。可一键清除。
// 书架「点亮」「成长记录」都从这里算，不再是写死的假数据。「点亮」只表示练习过，不表示掌握。
const KEY = 'yuejing.records.v1';
const MAX = 50;
const listeners = new Set();

export function loadRecords() {
  try {
    const a = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(a) ? a : [];
  } catch (_) { return []; }
}

export function saveRecord(rec) {
  try {
    const all = loadRecords();
    all.unshift(rec);
    localStorage.setItem(KEY, JSON.stringify(all.slice(0, MAX)));
    listeners.forEach((f) => f());
    return true;
  } catch (_) { return false; }     // 隐私模式或存储已满
}

export function clearRecords() {
  try { localStorage.removeItem(KEY); } catch (_) { /* 忽略 */ }
  listeners.forEach((f) => f());
}

export const onRecordsChange = (f) => { listeners.add(f); return () => listeners.delete(f); };

export const practicedCardIds = () => new Set(loadRecords().map((r) => r.card_id));

// 成长面板用：真实统计，没有记录时返回 null，由面板显示「还没有练习」
export function growthSummary() {
  const recs = loadRecords();
  if (!recs.length) return null;
  const last = recs[0];
  const sum = {}, cnt = {};
  for (const r of recs.slice(0, 8)) {
    for (const [k, v] of Object.entries(r.scores || {})) {
      if (v == null) continue;
      sum[k] = (sum[k] || 0) + v; cnt[k] = (cnt[k] || 0) + 1;
    }
  }
  const avg = Object.fromEntries(Object.keys(sum).map((k) => [k, Math.round(sum[k] / cnt[k])]));
  const byTag = {};
  for (const r of recs) byTag[r.scene_tag] = (byTag[r.scene_tag] || 0) + 1;
  const stuck = Object.entries(byTag).sort((a, b) => b[1] - a[1]).map(([k]) => k).slice(0, 2);
  const overall = recs.slice(0, 8).map((r) => r.overall).reverse();
  return { count: recs.length, last, avg, stuck, trend: overall,
    memory: last.improvements_hint || null };
}
