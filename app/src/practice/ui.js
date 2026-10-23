// 实景练习的界面：自由输入对话 + 评分结果页。数据全部来自后端，这里不做任何判断。
// 用户与模型的文本一律走 textContent，不当 HTML 解析（防 XSS）。
const DIM = { clarity: '表达清晰度', respect: '表达尊重', boundary: '边界明确性', response_to_pushback: '应对追问' };
const DIMS = ['clarity', 'respect', 'boundary', 'response_to_pushback'];
const TAG = { clear_refusal: '明确表态', vague: '含糊', emotional: '只表达了情绪', attack: '针对对方', concrete_request: '具体诉求', concession: '答应了', off_topic: '没接话题' };
const END = {
  goal_reached: '对方松口了，这一场的目标达成。',
  rapport_broken: '关系先绷断了。这不算失败，只说明这种说法的代价偏高。',
  max_turns: '轮数用完了。', user_ended: '你结束了这一场。',
};
const NEXT = { retry_same: '同一场景再练一次', review_card: '先回看这条思路', transfer_new: '换一个新场景' };

const SVG_NS = 'http://www.w3.org/2000/svg';
const SVG_TAGS = new Set(['svg', 'circle', 'path', 'g', 'line', 'rect', 'text']);

function h(tag, attrs, ...kids) {
  // SVG 元素必须用 SVG 命名空间创建，否则浏览器当成未知 HTML 元素，宽高为 0、什么都画不出来
  const el = SVG_TAGS.has(tag) ? document.createElementNS(SVG_NS, tag) : document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.setAttribute('class', v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

export function buildPracticeUI() {
  const host = h('section', { id: 'practice', class: 'practice', hidden: true });
  document.getElementById('app').appendChild(host);

  const top = h('header', { class: 'pp-top' },
    h('button', { class: 'back', id: 'pp-back', type: 'button' }, '← 回到书房'),
    h('div', { class: 'pp-meta' }, h('b', { id: 'pp-place' }), h('span', { id: 'pp-src' })));
  const card = h('aside', { class: 'prac', id: 'pp-card', hidden: true });
  host.append(top, card);

  const state = { onBack: null };
  top.querySelector('#pp-back').addEventListener('click', () => state.onBack && state.onBack());

  // 对话区各部件（每次 mount 重建，避免上一场的状态残留）
  let log, input, send, finish, count, notice, setup;

  function renderChat(sc, handlers) {
    log = h('div', { class: 'pp-log', role: 'log', 'aria-live': 'polite' });
    input = h('textarea', { class: 'pp-input', rows: 2, maxlength: 300, 'aria-label': '你要说的话', placeholder: '你会怎么说？按 Enter 发送' });
    send = h('button', { class: 'pp-send', type: 'button' }, '发送');
    finish = h('button', { class: 'pp-finish', type: 'button' }, '结束并看反馈');
    count = h('span', { class: 'prac-count' }, '');
    notice = h('div', { class: 'pp-notice', hidden: true });
    setup = h('p', { class: 'prac-setup' }, sc.setting);
    card.replaceChildren(
      h('div', { class: 'prac-top' }, h('span', { class: 'prac-kicker' }, '换你上场'), count),
      setup,
      h('p', { class: 'pp-goal' }, '你的目标：', sc.success_hint),
      notice, log,
      h('div', { class: 'pp-composer' }, input, h('div', { class: 'pp-actions' }, finish, send)));
    card.hidden = false;
    card.classList.remove('in'); void card.offsetWidth; card.classList.add('in');
    send.addEventListener('click', handlers.onSend);
    finish.addEventListener('click', handlers.onFinish);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); handlers.onSend(); }
      e.stopPropagation();                      // 打字时不要触发场景的键盘快捷键（Esc 之外的方向键等）
    });
  }

  return {
    mount(story, onBack) {
      host.hidden = false;
      document.body.classList.add('in-practice');
      host.querySelector('#pp-place').textContent = (story.practice && story.practice.place) || '实景练习';
      host.querySelector('#pp-src').textContent = `${story.concept} · ${story.source}`;
      card.hidden = true;
      state.onBack = onBack;
    },
    unmount() {
      host.hidden = true;
      document.body.classList.remove('in-practice');
    },
    startChat(sc, handlers) { renderChat(sc, handlers); },
    setTurn(turn, max) { count.textContent = `第 ${Math.min(turn + 1, max)} / ${max} 轮`; },
    addLine(who, text) {
      log.append(h('div', { class: `pp-msg ${who === 'me' ? 'me' : 'npc'}` }, h('b', null, who === 'me' ? '你' : who), h('p', null, text)));
      log.scrollTop = log.scrollHeight;
    },
    removeLast() { log.lastChild && log.lastChild.remove(); },
    note(text) { notice.hidden = !text; notice.textContent = text || ''; },
    toast(text) { this.note(text); },
    busy(on) {
      send.disabled = on; input.disabled = on; finish.disabled = on;
      send.textContent = on ? '对方在回应…' : '发送';
      if (!on) input.focus();
    },
    getText() { return input.value.trim(); },
    setText(t) { input.value = t; },
    lockInput() { input.disabled = true; send.disabled = true; },
    markEnded(reason, onScore) {
      send.hidden = true; finish.hidden = true; input.hidden = true;
      card.append(h('div', { class: 'prac-done' },
        h('span', { class: 'pd-kicker' }, '这一场到这'),
        h('p', null, END[reason] || '这一场结束了。'),
        h('button', { class: 'cc-go', id: 'pp-score', type: 'button', onclick: onScore }, '看反馈 →')));
    },
    crisis(message, hotlines) {
      card.replaceChildren(h('div', { class: 'pp-crisis', role: 'alert' },
        h('span', { class: 'pd-kicker' }, '先停一下'),
        h('p', null, message),
        h('ul', null, (hotlines || []).map((x) => h('li', null, `${x.name}：`, h('b', null, x.number)))),
        h('p', { class: 'muted' }, '这里不会继续练习，也不会给你打分。'),
        h('button', { class: 'cc-go', type: 'button', onclick: () => state.onBack && state.onBack() }, '回到书房')));
    },
    scoring(on) {
      const b = card.querySelector('#pp-score');
      if (b) { b.disabled = on; b.textContent = on ? '正在复盘…' : '看反馈 →'; }
    },

    // —— 评分结果 ——
    showResult(R, actions) {
      const res = R.result;
      const shown = DIMS.filter((d) => res.scores[d] != null);
      const fb = (f, kind) => h('li', { class: `pp-fb ${kind}` },
        h('span', { class: 'pp-dim' }, DIM[f.dim]),
        f.quote ? h('blockquote', null, `第 ${f.turn} 轮 · 「${f.quote}」`) : h('blockquote', { class: 'none' }, '这一项没有对应的那句话（没有出现）'),
        h('p', null, f.comment),
        f.suggestion ? h('p', { class: 'pp-sug' }, h('b', null, '建议：'), f.suggestion) : null);
      const r = 46, c = 2 * Math.PI * r;
      const ring = h('div', { class: 'pp-ring', role: 'img', 'aria-label': `这次练习的整体表现 ${res.overall} 分，满分 100` },
        h('svg', { viewBox: '0 0 110 110' },
          h('circle', { cx: 55, cy: 55, r, class: 'bg' }),
          h('circle', { cx: 55, cy: 55, r, class: 'fg', 'stroke-dasharray': `${(c * res.overall) / 100} ${c}`, transform: 'rotate(-90 55 55)' })),
        h('b', null, res.overall));
      const bars = shown.map((d) => h('div', { class: 'pp-bar' },
        h('span', null, DIM[d]),
        h('i', { role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': res.scores[d], 'aria-label': DIM[d] }, h('em', { style: `width:${res.scores[d]}%` })),
        h('b', null, res.scores[d])));
      const history = R.card.history;
      card.replaceChildren(
        h('div', { class: 'prac-top' }, h('span', { class: 'prac-kicker' }, '这一场的复盘'), h('span', { class: 'prac-count' }, R.mode === 'live' ? '在线模型' : '离线演示模式')),
        R.notice ? h('div', { class: 'pp-notice' }, R.notice) : null,
        h('p', { class: 'pp-intro' }, res.user_facing_intro),
        h('div', { class: 'pp-score' }, ring, h('div', { class: 'pp-bars' }, bars,
          h('p', { class: 'muted small' }, '只评这一场用到的维度；这反映的是这一次对话，不代表你的真实沟通水平。'))),
        h('p', { class: 'muted' }, END[R.end_reason] || ''),
        h('h4', null, '做得好的地方'),
        res.strengths.length ? h('ul', { class: 'pp-fbs' }, res.strengths.map((f) => fb(f, 'good'))) : h('p', { class: 'muted' }, '这一场没有找到可以逐字引用的亮点，宁可少写，不编造。'),
        h('h4', null, '可以改进的地方'),
        res.improvements.length ? h('ul', { class: 'pp-fbs' }, res.improvements.map((f) => fb(f, 'todo'))) : h('p', { class: 'muted' }, '没有需要特别指出的地方。'),
        h('div', { class: 'pp-ref' },
          h('b', null, history ? `${history.name} · ${R.card.concept}` : R.card.concept),
          h('p', null, res.card_reference.note),
          res.card_reference.link_to_turn ? h('p', { class: 'muted small' }, `最能解释的是第 ${res.card_reference.link_to_turn} 轮。`) : null),
        h('div', { class: 'pp-next' },
          h('b', null, `下一步：${NEXT[res.next_action]}`),
          h('p', null, res.next_reason)),
        h('details', { class: 'pp-replay' }, h('summary', null, '对话回放与逐轮标注'),
          h('ol', null, R.log.map((e) => h('li', null, h('span', { class: `pp-tag ${e.evidence_tag}` }, TAG[e.evidence_tag] || '—'), ' ', e.user_utterance)))),
        h('div', { class: 'pp-result-actions' },
          actions.map((a) => h('button', { class: a.primary ? 'cc-go' : 'pp-secondary', type: 'button', onclick: a.run }, a.label))),
        h('p', { class: 'muted small' }, '反馈只基于这一场你说过的话。这是沟通练习工具，不构成心理评估。'));
      card.hidden = false;
      card.scrollTop = 0;
      card.classList.remove('in'); void card.offsetWidth; card.classList.add('in');
    },
  };
}
