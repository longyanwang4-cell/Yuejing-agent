import { SHELF, isLit, litCount } from '../config.js';
import { cardById } from '../mock/data.js';
import { growthSummary } from '../net/records.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function verifyPill(h) {
  return h && !h.verified ? '<span class="pill-warn">出处待核</span>' : '';
}

// 书架总览：六部典籍，按两类场景分组
export function shelfPanel() {
  const row = (it) => {
    const c = cardById[it.card];
    return `
    <button class="row ${isLit(it) ? 'lit-seal' : 'dim'}" data-act="book" data-id="${it.id}">
      <span class="tag h">典</span>
      <span class="main"><b>${esc(it.title)}</b><small>${esc(it.group)} · ${esc(c.concept)}</small></span>
      <span class="state ${isLit(it) ? '' : 'off'}">${isLit(it) ? '已点亮' : '未解锁'}</span>
    </button>`;
  };
  const groups = [...new Set(SHELF.map((s) => s.group))];
  return `
    <h2>我的书架</h2>
    <div class="sub">六部典籍 · 已点亮 ${litCount()} / ${SHELF.length} · 练过一次，对应的典籍就会亮起</div>
    <div class="scroll">
      ${groups.map((g) => `<div class="sec">${esc(g)}</div>${SHELF.filter((s) => s.group === g).map(row).join('')}`).join('')}
    </div>
    <div class="foot">每一部典籍对应一个卡点：先看他们怎么做，再回来练自己的。</div>`;
}

// 单张知识卡详情：原文 + 现代解读，不给页码，也不摘录任何在版图书
export function cardPanel(itemId) {
  const it = SHELF.find((s) => s.id === itemId);
  const c = cardById[it.card];
  const h = c.history_pair || {};
  return `
    <button class="link-back" data-act="shelf-list">← 返回书架</button>
    <div class="detail scroll">
      <h3>${esc(c.concept)}</h3>
      <div class="meta">${esc(c.scene_tag)} · ${isLit(it) ? '已练过' : '尚未练习'}</div>

      <div class="casebox">
        <div class="case-head"><b>${esc(h.name)}</b><span>${esc(h.era || '')}</span></div>
        <blockquote>${esc(c.quote || '')}<cite>——${esc(h.origin || c.source)}</cite></blockquote>
        <p>${esc(h.note || '')}</p>
        ${verifyPill(h)}
      </div>

      <p>${esc(c.plain)}</p>
      <div class="box"><h4>别读偏了</h4><p>${esc(c.limit)}</p></div>
      <button class="cc-go" data-act="story" data-card="${it.card}">看这一幕 →</button>
      <div class="src">出处：${esc(c.source)}<br>${esc(c.locator)}</div>
    </div>`;
}

const DIM_NAME = { clarity: '表达清晰度', respect: '表达尊重', boundary: '边界明确性', response_to_pushback: '应对追问' };

// 成长记录：全部来自这台设备上的真实练习记录。没练过就如实说没有，不放假数字。
export function growthPanel() {
  const g = growthSummary();
  if (!g) {
    return `
    <h2>成长记录</h2>
    <div class="sub">越练，书房越懂你</div>
    <div class="scroll">
      <div class="detail"><div class="box"><p>还没有练习记录。去和沟通达人聊聊你的困扰，练完一场，这里就会出现你自己的数据。</p></div></div>
    </div>
    <div class="foot">记录只保存在这台设备的浏览器里，不上传，也不需要账号。</div>`;
  }
  const dims = Object.entries(g.avg).map(([k, v]) => ({ name: DIM_NAME[k] || k, v }));
  const trend = g.trend.length > 1 ? `最近几次整体表现：${g.trend.join(' → ')}（不同场景难度不同，仅供参考）` : '再练几场，这里会出现变化。';
  return `
    <h2>成长记录</h2>
    <div class="sub">越练，书房越懂你</div>
    <div class="scroll">
      <div class="stats">
        <div class="stat"><b>${g.count}</b><span>已完成场景</span></div>
        <div class="stat"><b>${g.last.overall}</b><span>最近一次表现</span></div>
        <div class="stat"><b>${litCount()}</b><span>点亮典籍</span></div>
      </div>
      <div class="sec">各方面的近期平均</div>
      <div class="bars">${dims.map((d) => `<div class="bar"><span>${esc(d.name)}</span><i style="--v:${d.v}%"></i><em>${d.v}</em></div>`).join('')}</div>
      <div class="sec">常练的方向</div>
      ${g.stuck.map((s) => `<div class="row"><span class="main"><b>${esc(s)}</b></span></div>`).join('')}
      <div class="sec">上一场留下的一句话</div>
      <div class="detail"><div class="box"><p>${esc(g.memory || trend)}</p></div></div>
      <div class="sec">变化</div>
      <div class="detail"><div class="box"><p>${esc(trend)}</p></div></div>
    </div>
    <div class="foot">这是你在这台设备上的真实记录。「点亮」表示练习过，不表示已经掌握。</div>`;
}

// 探索：六部典籍入口
export function explorePanel() {
  const rows = SHELF.map((it) => {
    const c = cardById[it.card];
    const h = c.history_pair;
    return `
    <button class="row" data-act="story" data-card="${it.card}">
      <span class="tag h">典</span>
      <span class="main"><b>${esc(it.title)}</b><small>${esc(h.origin)} · 对应「${esc(c.concept)}」</small></span>
      ${verifyPill(h) || '<span class="state">进入</span>'}
    </button>`;
  });
  return `
    <h2>探索更多场景</h2>
    <div class="sub">史书里的六件事 · 每一件都有它的解法</div>
    <div class="scroll">${rows.join('')}</div>
    <div class="foot">每个典故是一个独立场景：先看他们怎么做，再回来练自己的。</div>`;
}
