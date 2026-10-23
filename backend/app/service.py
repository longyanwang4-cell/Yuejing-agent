# -*- coding: utf-8 -*-
"""主链路业务：诊断 → 陪练 → 评分。模型只提议，规则由 rules.py 裁决；模型失败一律降级到离线规则，不白屏。"""
import json
import re
import threading
import time
import uuid
from collections import OrderedDict

from jsonschema import Draft7Validator

from . import config, llm, offline_diag, offline_play, rules, safety
from .content import (CARD_MAP, OBST_TO_CARD, OBST_TO_SCENARIO, PROMPTS, SCEN_MAP, SCHEMAS,
                      dims_union, public_card, public_scenario, render, roleplay_scenario_json, skinned)
from .quota import quota

_V = {n: Draft7Validator(s) for n, s in SCHEMAS.items()}
_PUNCT = re.compile(r"[\s，。！？、,.!?…~～「」“”\"'：:；;（）()\-—]")


def _norm(s: str) -> str:
    return _PUNCT.sub("", s or "")


class SessionGone(Exception):
    pass


class Conflict(Exception):
    pass


class UnknownScenario(Exception):
    pass


class Store:
    def __init__(self):
        self._lock = threading.Lock()
        self._d = OrderedDict()

    def create(self) -> dict:
        s = {"id": uuid.uuid4().hex, "ts": time.time(), "lock": threading.RLock(), "diag": None, "diag_text": None,
             "scenario_id": None, "scenario_live": None, "skinned": False, "state": None, "turn": 0, "log": [], "tactics": [], "stage": 1, "history": [],
             "ended": False, "end_reason": None, "scored": None, "crisis": False}
        with self._lock:
            self._d[s["id"]] = s
            while len(self._d) > config.MAX_SESSIONS:
                self._d.popitem(last=False)
        return s

    def get(self, sid):
        with self._lock:
            s = self._d.get(sid or "")
            if s and time.time() - s["ts"] > config.SESSION_TTL_SECONDS:
                del self._d[sid]
                s = None
            if s:
                s["ts"] = time.time()
                self._d.move_to_end(sid)
            return s

    def require(self, sid) -> dict:
        s = self.get(sid)
        if not s:
            raise SessionGone()
        return s


store = Store()


def _go_live(ip: str) -> bool:
    return config.live_enabled() and quota.allow(ip)


def _mode_notice(live_wanted: bool, failed: bool):
    if failed:
        return "offline", "模型暂时没有响应，这一步已切换为离线演示模式（规则驱动，不是模型生成）。"
    if not live_wanted:
        return "offline", ("当前为离线演示模式（规则驱动，不是模型生成）。"
                           if not config.live_enabled() else "今日在线额度已用完，已切换为离线演示模式。")
    return "live", None


# ============================== 诊断 ==============================
def _diag_check(clarified: bool, raw: str):
    def check(o):
        if o["safety_flag"] == "none":
            if clarified and o["next_action"] == "ask_once":
                return "用户已回答过追问，禁止再次追问，必须择一或判为 unsupported"
            if o["next_action"] == "offer_choice":
                if o["primary_obstacle"] is None:
                    return "offer_choice 必须给出 primary_obstacle"
                if CARD_MAP[OBST_TO_CARD[o["primary_obstacle"]]]["scene_tag"] != o["scene_tag"]:
                    return "scene_tag 与 primary_obstacle 所属场景不一致"
        if _norm(o["evidence"]) not in _norm(raw):
            return "evidence 必须是用户原话片段，原文里没有「%s」" % o["evidence"]
        return None
    return check


def _normalize_diag(o: dict) -> dict:
    if o["safety_flag"] == "crisis":
        if "12356" not in o["user_facing_message"]:
            o["user_facing_message"] += " 全国统一心理援助热线 12356；希望24热线 400-161-9995。"
        o.update(matched_card_ids=[], rubric_dims=[], primary_obstacle=None, scene_tag="unsupported",
                 next_action="refer_out")
        return o
    if o["next_action"] == "offer_choice":
        first = OBST_TO_CARD[o["primary_obstacle"]]
        rest = [c for c in o["matched_card_ids"] if c != first]
        o["matched_card_ids"] = ([first] + rest)[:2]
    if o["next_action"] in ("ask_once", "decline_scope"):
        o["matched_card_ids"] = []
    o["rubric_dims"] = dims_union(o["matched_card_ids"])
    return o


def diagnose(session_id, text: str, ip: str) -> dict:
    s = store.get(session_id) or store.create()
    with s["lock"]:
        prev = s["diag"]
        clarified = bool(prev and prev["next_action"] == "ask_once")
        if clarified:
            raw = s["diag_text"] + "\n" + text
            block = "用户首次描述：%s\n你的追问：%s\n用户的回答：%s\n\n注意：这已经是用户对追问的回答，禁止再追问。" % (
                s["diag_text"], prev["clarifying_question"], text)
        else:
            raw, block = text, text
            s["diag_text"] = text
        s.update(scenario_id=None, state=None, turn=0, log=[], tactics=[], stage=1, history=[],
                 ended=False, end_reason=None, scored=None, crisis=False)

        if safety.is_crisis(raw):
            d = safety.crisis_diagnose_output(text)
            s["diag"], s["crisis"] = d, True
            return {"session_id": s["id"], "diagnosis": d, "scenario": None, "cards": [],
                    "mode": "safety", "notice": None, "crisis": True, "hotlines": safety.HOTLINES}

        want_live = _go_live(ip)
        d, failed = None, False
        if want_live:
            try:
                d = llm.call_json(PROMPTS["diagnose"], [{"role": "user", "content": block}], SCHEMAS["diagnose"],
                                  _diag_check(clarified, raw))
                d = _normalize_diag(d)
                errs = list(_V["diagnose"].iter_errors(d))
                if errs:
                    raise llm.LLMFailure(errs[0].message)
            except llm.LLMFailure:
                d, failed = None, True
        if d is None:
            d = offline_diag.diagnose(raw, clarified)
        mode, notice = _mode_notice(want_live, failed)
        s["diag"] = d
        crisis = d["safety_flag"] == "crisis"
        s["crisis"] = crisis
        scenario = None
        if d["next_action"] == "offer_choice":
            scenario = public_scenario(SCEN_MAP[OBST_TO_SCENARIO[d["primary_obstacle"]]])
        return {"session_id": s["id"], "diagnosis": d, "scenario": scenario,
                "cards": [public_card(CARD_MAP[c]) for c in d["matched_card_ids"]],
                "mode": "safety" if crisis else mode, "notice": notice, "crisis": crisis,
                "hotlines": safety.HOTLINES if crisis else None}


# ============================== 陪练 ==============================
def start_practice(session_id, scenario_id: str, skin: dict | None = None) -> dict:
    s = store.get(session_id) or store.create()
    base = SCEN_MAP.get(scenario_id)
    if not base:
        raise UnknownScenario(scenario_id)
    sc = skinned(base, skin)
    with s["lock"]:
        s.update(scenario_id=scenario_id, scenario_live=sc, skinned=sc is not base, state=dict(sc["state_init"]), turn=0, log=[], tactics=[],
                 stage=1, history=[], ended=False, end_reason=None, scored=None, crisis=False)
        return {"session_id": s["id"], "scenario": public_scenario(sc), "state": s["state"], "turn": 0,
                "opening_line": sc["npc"]["opening_line"], "mode": "live" if config.live_enabled() else "offline"}


def _history_messages(s, sc, text):
    msgs = []
    for i, h in enumerate(s["history"]):
        u = h["user"] if i else "（你的开场白已经说过：「%s」）\n用户：%s" % (sc["npc"]["opening_line"], h["user"])
        msgs += [{"role": "user", "content": u}, {"role": "assistant", "content": json.dumps(h["npc_out"], ensure_ascii=False)}]
    u = text if s["history"] else "（你的开场白已经说过：「%s」）\n用户：%s" % (sc["npc"]["opening_line"], text)
    return msgs + [{"role": "user", "content": u}]


def practice_turn(session_id, text: str, ip: str) -> dict:
    s = store.require(session_id)
    with s["lock"]:
        if not s["scenario_id"] or s["crisis"]:
            raise Conflict("还没有开始练习")
        if s["ended"]:
            raise Conflict("这一场已经结束了")
        if safety.is_crisis(text):
            s["crisis"], s["ended"], s["end_reason"] = True, True, "crisis"
            return {"crisis": True, "message": safety.CRISIS_MESSAGE, "hotlines": safety.HOTLINES, "ended": True,
                    "mode": "safety"}
        sc = s["scenario_live"]
        turn = s["turn"] + 1
        last = s["tactics"][-2:]
        want_live = _go_live(ip)
        out, failed, stage_next = None, False, None
        if want_live:
            system = render(PROMPTS["roleplay"], scenario_json=roleplay_scenario_json(sc), turn=turn,
                            max_turns=sc["max_turns"], last_two_tactics=json.dumps(last, ensure_ascii=False) if last else "无",
                            **s["state"])
            try:
                out = llm.call_json(system, _history_messages(s, sc, text), SCHEMAS["roleplay"],
                                    lambda o: rules.roleplay_violation(s["state"], o, turn, last))
                stage_next = out["escalation_stage"]
            except llm.LLMFailure:
                out, failed = None, True
        if out is None:
            out, stage_next = offline_play.npc_turn(sc["scenario_id"], text, s["state"], turn, s["stage"], last,
                                                {h["npc_out"]["npc_line"] for h in s["history"]},
                                                SCEN_MAP[s["scenario_id"]]["card_id"] if s.get("skinned") else None)
        mode, notice = _mode_notice(want_live, failed)

        new_state, fixed, notes = rules.apply_turn(s["state"], out, turn, sc["max_turns"], last)
        ev = fixed.get("evidence")
        if ev and _norm(ev) not in _norm(text):
            ev = text.strip()[:20]
        s["log"].append({"turn": turn, "user_utterance": text.strip(), "evidence": ev,
                         "evidence_tag": fixed.get("evidence_tag"), "npc_tactic": fixed["tactic"]})
        s["history"].append({"user": text.strip(), "npc_out": {k: fixed[k] for k in fixed}})
        s["tactics"].append(fixed["tactic"])
        s["state"], s["turn"], s["stage"] = new_state, turn, stage_next
        if fixed["should_end"]:
            s["ended"], s["end_reason"] = True, fixed["end_reason"]
        return {"npc_line": fixed["npc_line"], "state": new_state, "turn": turn, "max_turns": sc["max_turns"],
                "ended": s["ended"], "end_reason": s["end_reason"], "evidence_tag": fixed.get("evidence_tag"),
                "mode": mode, "notice": notice, "crisis": False}


def end_practice(session_id) -> dict:
    s = store.require(session_id)
    with s["lock"]:
        if not s["scenario_id"]:
            raise Conflict("还没有开始练习")
        if not s["ended"]:
            s["ended"], s["end_reason"] = True, "user_ended"
        return {"ended": True, "end_reason": s["end_reason"], "turn": s["turn"]}


# ============================== 评分 ==============================
def _fix_score(o: dict, sc: dict, card: dict, final: dict, end_reason: str, offline_ref: dict) -> dict:
    o["scenario_id"] = sc["scenario_id"]
    o["card_reference"]["card_id"], o["card_reference"]["concept"] = card["id"], card["concept"]
    o["overall"] = rules.recompute_overall(o["scores"], sc["rubric_dims"])
    act = rules.decide_next(o["overall"], final["npc_concession"], sc["difficulty"], end_reason)
    if act != o["next_action"]:
        o["next_reason"] = offline_ref["next_reason"]          # 模型的理由对应的是它自己选的路径，路径改了理由就得换
    o["next_action"] = act
    o["next_scenario_id"] = sc["transfer_to"] if act == "transfer_new" else None
    return o


def score(session_id, ip: str) -> dict:
    s = store.require(session_id)
    with s["lock"]:
        if s["scored"]:
            return s["scored"]
        if s["crisis"] or not s["scenario_id"]:
            raise Conflict("这一场没有可评分的内容")
        if not s["log"]:
            raise Conflict("还没有说过话，没法评分")
        sc, card = s["scenario_live"], CARD_MAP[SCEN_MAP[s["scenario_id"]]["card_id"]]
        final, end_reason = s["state"], s["end_reason"] or "user_ended"
        ref = offline_play.score(sc, s["log"], final, end_reason)
        want_live = _go_live(ip)
        o, failed = None, False
        if want_live:
            system = render(PROMPTS["score"], scenario_json=json.dumps(sc, ensure_ascii=False, indent=1),
                            card_json=json.dumps(card, ensure_ascii=False, indent=1),
                            turns_used=s["turn"], max_turns=sc["max_turns"], end_reason=end_reason,
                            evidence_log_json=json.dumps(s["log"], ensure_ascii=False, indent=1), **final)
            try:
                o = llm.call_json(system, [{"role": "user", "content": "请按要求输出评分 JSON。"}], SCHEMAS["score"],
                                  lambda x: rules.check_score_output(x, sc, s["log"]))
                o = _fix_score(o, sc, card, final, end_reason, ref)
                errs = list(_V["score"].iter_errors(o))
                if errs:
                    raise llm.LLMFailure(errs[0].message)
            except llm.LLMFailure:
                o, failed = None, True
        if o is None:
            o = ref
        mode, notice = _mode_notice(want_live, failed)
        res = {"session_id": s["id"], "result": o, "log": s["log"], "final_state": final, "end_reason": end_reason,
               "scenario": public_scenario(sc), "card": public_card(card), "mode": mode, "notice": notice,
               "next_scenario": public_scenario(SCEN_MAP[o["next_scenario_id"]]) if o["next_scenario_id"] else None}
        s["scored"] = res
        return res
