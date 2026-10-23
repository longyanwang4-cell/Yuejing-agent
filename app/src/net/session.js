// 跨场景共享的这一次流程：诊断结果、后端会话、最近一次评分。三个场景都从这里读，不各存一份。
import { api, ApiError } from './api.js';
import { saveRecord } from './records.js';

export const SESS = {
  id: null,            // 后端 session_id
  diag: null,          // 最近一次诊断（含 matched_card_ids / primary_obstacle）
  cards: [],
  scenario: null,      // 诊断给出的练习场景（后端 public_scenario）
  awaiting: false,     // 诊断正在等用户回答那一次追问
  mode: 'offline',     // 'live' | 'offline' | 'safety'
  lib: null,           // /api/library
  result: null,        // 最近一次 /api/score 的完整响应
  saved: null,         // 已落盘的 session，防止重复保存
};

export function resetSession() {
  Object.assign(SESS, { id: null, diag: null, cards: [], scenario: null, awaiting: false, result: null });
}

export async function loadLibrary() {
  try {
    SESS.lib = await api.library();
    return SESS.lib;
  } catch (e) {
    SESS.lib = null;
    throw e;
  }
}

export async function diagnose(text) {
  const r = await api.diagnose({ text, session_id: SESS.id });
  SESS.id = r.session_id;
  SESS.diag = r.diagnosis;
  SESS.cards = r.cards || [];
  SESS.scenario = r.scenario;
  SESS.mode = r.mode;
  SESS.awaiting = r.diagnosis.next_action === 'ask_once';
  return r;
}

// 评分结果落盘：只存这一场必要的内容，书架点亮和成长面板都从这里读
export function persistResult(R) {
  if (!R || SESS.saved === R.session_id) return true;
  const res = R.result;
  const ok = saveRecord({
    id: `${R.session_id}:${Date.now()}`, ts: Date.now(),
    scenario_id: R.scenario.scenario_id, scene_tag: R.scenario.scene_tag, setting: R.scenario.setting,
    npc: R.scenario.npc.name, card_id: R.card.id, concept: R.card.concept,
    story: R.card.history ? R.card.history.name : R.card.concept,
    mode: R.mode, overall: res.overall, scores: res.scores,
    next_action: res.next_action, next_scenario_id: res.next_scenario_id, next_reason: res.next_reason,
    end_reason: R.end_reason, result: res, log: R.log,
    improvements_hint: res.improvements[0] ? res.improvements[0].comment : null,
  });
  SESS.saved = R.session_id;
  return ok;
}

export { ApiError };
