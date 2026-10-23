# -*- coding: utf-8 -*-
"""后端测试。运行：cd backend && python -m pytest -q
离线测试不需要 key；在线路径用假模型（monkeypatch llm._post）验证：违规输出会被拦截、失败会降级、不白屏。"""
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient  # noqa: E402

from app import config, llm, rules, service, safety  # noqa: E402
from app.main import app  # noqa: E402
from app.quota import Quota  # noqa: E402

C = TestClient(app)
CHARGER = "roommate_charger_boundary"


@pytest.fixture(autouse=True)
def offline(monkeypatch):
    monkeypatch.setattr(config, "LLM_API_KEY", "")
    monkeypatch.setattr(config, "FORCE_OFFLINE", True)


def play(scn, lines):
    sid = C.post("/api/practice/start", json={"scenario_id": scn}).json()["session_id"]
    outs = []
    for t in lines:
        o = C.post("/api/practice/turn", json={"session_id": sid, "text": t}).json()
        outs.append(o)
        if o["ended"]:
            break
    else:
        C.post("/api/practice/end", json={"session_id": sid})
    return sid, outs


# ---------------- 诊断：四类输入 ----------------
def test_diagnose_typical_refusal():
    r = C.post("/api/diagnose", json={"text": "室友老是借我充电器，我怕说了他觉得我小气。"}).json()
    d = r["diagnosis"]
    assert d["scene_tag"] == "拒绝与边界" and d["next_action"] == "offer_choice"
    assert d["matched_card_ids"][0] == "boundary_courage_disliked"
    assert r["scenario"]["scenario_id"] == "roommate_night_game_disliked"
    assert r["mode"] == "offline" and r["notice"]


def test_diagnose_too_short_asks_once_then_must_decide():
    r = C.post("/api/diagnose", json={"text": "我和室友关系不太好。"}).json()
    assert r["diagnosis"]["next_action"] == "ask_once" and r["diagnosis"]["clarifying_question"]
    r2 = C.post("/api/diagnose", json={"text": "还行吧", "session_id": r["session_id"]}).json()
    assert r2["diagnosis"]["next_action"] != "ask_once"            # 全链路只追问一次


def test_diagnose_out_of_scope_declined():
    d = C.post("/api/diagnose", json={"text": "下周要面试，我紧张得不行。"}).json()["diagnosis"]
    assert d["next_action"] == "decline_scope" and d["matched_card_ids"] == []


def test_diagnose_crisis_never_reaches_model_or_cards(monkeypatch):
    monkeypatch.setattr(config, "FORCE_OFFLINE", False)
    monkeypatch.setattr(config, "LLM_API_KEY", "k")
    monkeypatch.setattr(llm, "_post", lambda m: pytest.fail("危机输入不应调用模型"))
    r = C.post("/api/diagnose", json={"text": "最近真的不想活了"}).json()
    assert r["crisis"] and r["diagnosis"]["next_action"] == "refer_out"
    assert r["diagnosis"]["matched_card_ids"] == [] and r["scenario"] is None and r["cards"] == []
    assert "12356" in r["diagnosis"]["user_facing_message"]


def test_crisis_mid_practice_stops_everything():
    sid = C.post("/api/practice/start", json={"scenario_id": CHARGER}).json()["session_id"]
    o = C.post("/api/practice/turn", json={"session_id": sid, "text": "我真的不想活了"}).json()
    assert o["crisis"] and o["ended"] and o["hotlines"]
    assert C.post("/api/practice/turn", json={"session_id": sid, "text": "继续"}).status_code == 409


def test_input_length_and_empty_rejected():
    assert C.post("/api/diagnose", json={"text": ""}).status_code == 422
    assert C.post("/api/diagnose", json={"text": "好" * 301}).status_code == 422


# ---------------- 陪练规则 ----------------
def test_first_turn_never_concedes_even_if_model_does():
    st = {"rapport": 60, "pressure": 25, "user_position_clarity": 0, "npc_concession": 0}
    out = {"npc_line": "行吧", "tactic": "concede_partial", "evidence": "x", "evidence_tag": "clear_refusal",
           "state_delta": {"rapport": 0, "pressure": 0, "user_position_clarity": 25, "npc_concession": 25},
           "should_end": False, "end_reason": None, "escalation_stage": 1}
    new, fixed, notes = rules.apply_turn(st, out, 1, 8, [])
    assert new["npc_concession"] == 0 and fixed["tactic"] != "concede_partial"


def test_clarity_is_monotonic_and_deltas_clipped():
    st = {"rapport": 50, "pressure": 50, "user_position_clarity": 30, "npc_concession": 0}
    out = {"npc_line": "x", "tactic": "press", "evidence": None, "evidence_tag": None,
           "state_delta": {"rapport": -99, "pressure": 99, "user_position_clarity": -40, "npc_concession": 0},
           "should_end": False, "end_reason": None, "escalation_stage": 1}
    new, fixed, _ = rules.apply_turn(st, out, 2, 8, [])
    assert new["user_position_clarity"] == 30 and new["rapport"] == 25 and new["pressure"] == 75


def test_backend_decides_end_not_the_model():
    st = {"rapport": 50, "pressure": 20, "user_position_clarity": 60, "npc_concession": 50}
    out = {"npc_line": "行", "tactic": "accept", "evidence": "x", "evidence_tag": "clear_refusal",
           "state_delta": {"rapport": 0, "pressure": 0, "user_position_clarity": 0, "npc_concession": 25},
           "should_end": False, "end_reason": None, "escalation_stage": 3}
    _, fixed, _ = rules.apply_turn(st, out, 4, 8, ["press", "probe"])
    assert fixed["should_end"] and fixed["end_reason"] == "goal_reached"


def test_clear_user_reaches_goal_and_transfers():
    clear = ["不行，我今天要带电脑去图书馆，充电器得我自己用一整天", "晚上我也要用，我自己要写作业",
             "我整晚都要用，你可以问问别人", "真的不行，我自己要用一整天"]
    sid, outs = play(CHARGER, clear)
    assert outs[-1]["ended"] and outs[-1]["end_reason"] == "goal_reached"
    assert outs[0]["npc_line"] and not any(o["tactic"] == "accept" for o in [{"tactic": ""}])
    r = C.post("/api/score", json={"session_id": sid}).json()
    assert r["result"]["next_action"] == "transfer_new" and r["result"]["next_scenario_id"] == "club_task_refusal"
    assert r["next_scenario"]["scenario_id"] == "club_task_refusal"


def test_vague_user_gets_review_card_with_null_evidence():
    sid, _ = play(CHARGER, ["啊……我看看", "嗯……可能吧", "那你用完早点还我", "再说吧", "看情况"])
    res = C.post("/api/score", json={"session_id": sid}).json()["result"]
    assert res["next_action"] == "review_card" and res["overall"] < 50
    nulls = [f for f in res["improvements"] if f["turn"] is None]
    assert nulls and nulls[0]["quote"] is None and "没有出现" in nulls[0]["comment"]


def test_npc_does_not_repeat_lines():
    _, outs = play(CHARGER, ["嗯……", "再说吧", "看情况", "好吧", "随便", "算了", "行吧"])
    lines = [o["npc_line"] for o in outs]
    assert len(lines) == len(set(lines))


def test_scoring_quotes_are_verbatim_and_overall_is_mean():
    sid, _ = play(CHARGER, ["啊……我今天可能有点不方便", "你要用多久啊", "不行，我今天要带电脑去图书馆，充电器得我自己用一整天"])
    r = C.post("/api/score", json={"session_id": sid}).json()
    by = {e["turn"]: e["user_utterance"] for e in r["log"]}
    for grp in ("strengths", "improvements"):
        for f in r["result"][grp]:
            if f["turn"] is not None:
                assert f["quote"] in by[f["turn"]]
    sc = r["result"]["scores"]
    vals = [v for v in sc.values() if v is not None]
    assert r["result"]["overall"] == rules.rnd(sum(vals) / len(vals))


def test_rounding_half_up_not_bankers():
    assert rules.rnd(28.5) == 29 and rules.rnd(0.5) == 1 and rules.rnd(2.5) == 3


def test_decide_next_table():
    assert rules.decide_next(90, 80, 1, "goal_reached") == "transfer_new"
    assert rules.decide_next(90, 80, 3, "goal_reached") == "transfer_new"
    assert rules.decide_next(80, 80, 3, "goal_reached") == "retry_same"
    assert rules.decide_next(80, 40, 1, "max_turns") == "retry_same"
    assert rules.decide_next(49, 0, 1, "max_turns") == "review_card"
    assert rules.decide_next(95, 90, 1, "rapport_broken") == "retry_same"


# ---------------- 会话与接口 ----------------
def test_expired_session_gives_410_not_crash():
    assert C.post("/api/practice/turn", json={"session_id": "nope", "text": "hi"}).status_code == 410


def test_score_requires_practice_and_is_idempotent():
    sid = C.post("/api/practice/start", json={"scenario_id": CHARGER}).json()["session_id"]
    assert C.post("/api/score", json={"session_id": sid}).status_code == 409
    C.post("/api/practice/turn", json={"session_id": sid, "text": "不行，我自己要用一整天"})
    C.post("/api/practice/end", json={"session_id": sid})
    a = C.post("/api/score", json={"session_id": sid}).json()
    b = C.post("/api/score", json={"session_id": sid}).json()
    assert a["result"] == b["result"]


def test_library_hides_match_keywords_and_exposes_verified_history():
    lib = C.get("/api/library").json()
    assert len(lib["cards"]) == 6 and len(lib["scenarios"]) == 6
    for c in lib["cards"]:
        assert "match_keywords" not in c and "history_pair" not in c
        assert c["quote"] and c["history"]["name"]          # 史书卡：一张卡 = 一个典故 + 一句原文
        assert c["history"]["verified"] is True              # 未核实的出处不应混进对外数据
    assert all("hidden_goal" not in s["npc"] and "escalation" not in s["npc"] for s in lib["scenarios"])


def test_quota_caps(monkeypatch):
    monkeypatch.setattr(config, "DAILY_MODEL_CALL_CAP", 3)
    monkeypatch.setattr(config, "PER_IP_PER_HOUR", 2)
    q = Quota()
    assert q.allow("a") and q.allow("a") and not q.allow("a")      # 单 IP 小时上限
    assert q.allow("b") and not q.allow("c")                       # 全局日上限


# ---------------- 在线路径（假模型） ----------------
def live(monkeypatch, responder):
    monkeypatch.setattr(config, "FORCE_OFFLINE", False)
    monkeypatch.setattr(config, "LLM_API_KEY", "test-key")
    monkeypatch.setattr(service, "quota", Quota())
    monkeypatch.setattr(llm, "_post", responder)


def test_live_model_garbage_falls_back_without_crashing(monkeypatch):
    live(monkeypatch, lambda m: "这不是 JSON")
    r = C.post("/api/diagnose", json={"text": "室友借我充电器，我不好意思拒绝"}).json()
    assert r["mode"] == "offline" and "离线演示模式" in r["notice"] and r["diagnosis"]["next_action"] == "offer_choice"


def test_live_diagnose_valid_output_is_used_and_normalised(monkeypatch):
    good = {"safety_flag": "none", "scene_tag": "拒绝与边界", "secondary_scene_tag": None,
            "primary_obstacle": "unclear_boundary", "confidence": "high", "evidence": "不好意思拒绝",
            "matched_card_ids": ["boundary_courage_disliked", "boundary_task_separation"],
            "rubric_dims": ["response_to_pushback"], "next_action": "offer_choice", "clarifying_question": None,
            "user_facing_message": "因为你提到不好意思拒绝，归到拒绝与边界。先看思路还是直接练？"}
    live(monkeypatch, lambda m: json.dumps(good, ensure_ascii=False))
    r = C.post("/api/diagnose", json={"text": "室友借我充电器，我不好意思拒绝"}).json()
    assert r["mode"] == "live"
    assert r["diagnosis"]["matched_card_ids"][0] == "boundary_task_separation"      # 首选卡被后端纠正为 obstacle 对应的卡
    assert r["diagnosis"]["rubric_dims"] == ["clarity", "boundary", "response_to_pushback"]   # 并集由后端重算


def test_live_fabricated_evidence_is_rejected_then_retried(monkeypatch):
    bad = {"safety_flag": "none", "scene_tag": "拒绝与边界", "secondary_scene_tag": None,
           "primary_obstacle": "unclear_boundary", "confidence": "high", "evidence": "用户从没说过这句话",
           "matched_card_ids": ["boundary_task_separation"], "rubric_dims": ["clarity", "boundary"],
           "next_action": "offer_choice", "clarifying_question": None, "user_facing_message": "x"}
    calls = []
    live(monkeypatch, lambda m: (calls.append(1), json.dumps(bad, ensure_ascii=False))[1])
    r = C.post("/api/diagnose", json={"text": "室友借我充电器，我不好意思拒绝"}).json()
    assert len(calls) == 2 and r["mode"] == "offline"          # 重试一次，仍不合规则降级


def test_live_roleplay_first_turn_concession_triggers_retry_with_reason(monkeypatch):
    seen = []

    def responder(msgs):
        seen.append(msgs[-1]["content"])
        t = "concede_partial" if len(seen) == 1 else "minimize"
        return json.dumps({"npc_line": "就一会儿嘛。", "tactic": t, "state_delta": {
            "rapport": 0, "pressure": 5, "user_position_clarity": 3, "npc_concession": 0},
            "evidence": "有点不方便", "evidence_tag": "vague", "should_end": False, "end_reason": None,
            "escalation_stage": 1}, ensure_ascii=False)
    live(monkeypatch, responder)
    sid = C.post("/api/practice/start", json={"scenario_id": CHARGER}).json()["session_id"]
    o = C.post("/api/practice/turn", json={"session_id": sid, "text": "我今天有点不方便"}).json()
    assert len(seen) == 2 and "第一轮绝不让步" in seen[1] and o["mode"] == "live"


def test_live_score_numbers_are_overridden_by_backend(monkeypatch):
    sid, _ = play(CHARGER, ["不行，我今天要带电脑去图书馆，充电器得我自己用一整天"])
    ref = C.post("/api/score", json={"session_id": sid}).json()["result"]
    sid2, _ = play(CHARGER, ["不行，我今天要带电脑去图书馆，充电器得我自己用一整天"])
    forged = json.loads(json.dumps(ref))
    forged.update(overall=99, next_action="transfer_new", next_scenario_id="club_task_refusal")
    forged["strengths"] = [{"dim": "boundary", "turn": 1, "quote": "不行，我今天要带电脑去图书馆", "comment": "说清了。"}]
    forged["improvements"] = []
    live(monkeypatch, lambda m: json.dumps(forged, ensure_ascii=False))
    r = C.post("/api/score", json={"session_id": sid2}).json()
    vals = [v for v in r["result"]["scores"].values() if v is not None]
    assert r["result"]["overall"] == rules.rnd(sum(vals) / len(vals)) != 99
    assert r["result"]["next_action"] != "transfer_new" or r["result"]["overall"] >= 70


def test_live_score_with_fake_quote_falls_back(monkeypatch):
    sid, _ = play(CHARGER, ["不行，我自己要用一整天"])
    ref = C.post("/api/score", json={"session_id": sid}).json()["result"]
    sid2, _ = play(CHARGER, ["不行，我自己要用一整天"])
    forged = json.loads(json.dumps(ref))
    forged["strengths"] = [{"dim": "boundary", "turn": 1, "quote": "我根本没说过的话", "comment": "x"}]
    live(monkeypatch, lambda m: json.dumps(forged, ensure_ascii=False))
    r = C.post("/api/score", json={"session_id": sid2}).json()
    assert r["mode"] == "offline"


def test_safety_prefilter_has_no_overbroad_word():
    assert not safety.is_crisis("这节课好没意思")
    assert safety.is_crisis("我想死")


# ---------------- 典故换皮：只换台面，规则不松 ----------------
def test_skin_changes_stage_but_not_rules():
    skin = {"place": "宿舍 · 熄灯前", "setup": "室友又来借充电器，已经是这个月第四次。", "who": "室友", "line": "充电器借我用一晚上呗。"}
    r = C.post("/api/practice/start", json={"scenario_id": CHARGER, "skin": skin}).json()
    assert r["opening_line"] == "充电器借我用一晚上呗。" and r["scenario"]["npc"]["name"] == "室友"
    assert "第四次" in r["scenario"]["setting"]
    sc = service.SCEN_MAP[CHARGER]
    live = service.store.get(r["session_id"])["scenario_live"]
    for k in ("difficulty", "max_turns", "rubric_dims", "state_init"):
        assert live[k] == sc[k]
    assert live["npc"]["never"] == sc["npc"]["never"] and live["npc"]["escalation"] == sc["npc"]["escalation"]
    assert live["npc"]["hidden_goal"] == sc["npc"]["hidden_goal"]


def test_oversized_skin_is_rejected_by_schema():
    skin = {"line": "好" * 500}
    assert C.post("/api/practice/start", json={"scenario_id": CHARGER, "skin": skin}).status_code == 422


def test_skinned_session_still_scores_and_never_concedes_turn_one():
    skin = {"who": "室友", "line": "充电器借我用一晚上呗。"}
    sid = C.post("/api/practice/start", json={"scenario_id": CHARGER, "skin": skin}).json()["session_id"]
    o = C.post("/api/practice/turn", json={"session_id": sid, "text": "不行，我今天要带电脑去图书馆，充电器得我自己用一整天"}).json()
    assert o["state"]["npc_concession"] == 0 and not o["ended"]
    C.post("/api/practice/end", json={"session_id": sid})
    r = C.post("/api/score", json={"session_id": sid}).json()
    assert r["scenario"]["npc"]["name"] == "室友" and r["result"]["scenario_id"] == CHARGER


def test_unknown_scenario_is_404():
    assert C.post("/api/practice/start", json={"scenario_id": "nope"}).status_code == 404


def test_story_skin_uses_story_lines_not_the_base_scenario_lines():
    skin = {"place": "教室 · 班会", "setup": "班里要选一个人做汇报，没人举手。", "who": "班长", "line": "就你吧，你讲得最好。"}
    sid = C.post("/api/practice/start", json={"scenario_id": "roommate_night_game_disliked", "skin": skin}).json()["session_id"]
    lines = []
    for t in ["啊……我有点不太想讲", "我这次不接，我准备的是另一个方向", "嗯……", "再说吧"]:
        lines.append(C.post("/api/practice/turn", json={"session_id": sid, "text": t}).json()["npc_line"])
    assert not any("打完我就睡" in x or "戴耳机" in x or "游戏" in x for x in lines)
    assert len(lines) == len(set(lines))


def test_unskinned_session_keeps_base_lines():
    sid = C.post("/api/practice/start", json={"scenario_id": "roommate_night_game_disliked"}).json()["session_id"]
    o = C.post("/api/practice/turn", json={"session_id": sid, "text": "嗯……"}).json()
    assert o["npc_line"] in {x for t in ("s1", "s2", "s3") for x in
                             __import__("app.offline_lines", fromlist=["LINES"]).LINES["roommate_night_game_disliked"][t][1]}


def test_every_story_card_has_complete_offline_lines():
    from app.offline_lines import STORY_LINES
    from app.content import CARD_MAP
    assert set(STORY_LINES) <= set(CARD_MAP)
    for cid, L in STORY_LINES.items():
        for k in ("s1", "s2", "s3", "attack", "concede", "accept", "yield"):
            assert L[k], (cid, k)


def test_skinned_scenario_gets_story_matching_goal_hint():
    from app.content import STORY_HINTS, CARD_MAP
    assert set(STORY_HINTS) == set(CARD_MAP)                       # 每张卡都有，漏一张就会回退到不贴切的提示
    skin = {"place": "教室 · 班会", "setup": "班里要选一个人做汇报。", "who": "班长", "line": "就你吧。"}
    r = C.post("/api/practice/start", json={"scenario_id": "roommate_night_game_disliked", "skin": skin}).json()
    assert "贴标签" not in r["scenario"]["success_hint"]
    assert r["scenario"]["success_hint"] == STORY_HINTS["boundary_courage_disliked"]
    plain = C.post("/api/practice/start", json={"scenario_id": "roommate_night_game_disliked"}).json()
    assert "贴标签" in plain["scenario"]["success_hint"]            # 不换皮时保持原样


# ---------------- 限流的来源 IP：不能被客户端伪造 ----------------
def _req(xff, peer="10.0.0.5"):
    from starlette.requests import Request
    hdr = [(b"x-forwarded-for", xff.encode())] if xff is not None else []
    return Request({"type": "http", "headers": hdr, "client": (peer, 1234)})


def test_client_ip_ignores_forwarded_header_when_not_behind_proxy(monkeypatch):
    from app.main import client_ip
    monkeypatch.setattr(config, "TRUST_PROXY", False)
    assert client_ip(_req("1.1.1.1")) == "10.0.0.5"          # 没有代理时，头是客户端写的，一律不信


def test_client_ip_takes_rightmost_so_client_cannot_spoof(monkeypatch):
    from app.main import client_ip
    monkeypatch.setattr(config, "TRUST_PROXY", True)
    # nginx 追加模式：客户端塞了假头 1.1.1.1，nginx 在右边追加真实来源 203.0.113.9
    assert client_ip(_req("1.1.1.1, 203.0.113.9")) == "203.0.113.9"
    assert client_ip(_req("203.0.113.9")) == "203.0.113.9"
    assert client_ip(_req("  203.0.113.9  ")) == "203.0.113.9"


def test_client_ip_falls_back_when_header_missing_or_empty(monkeypatch):
    from app.main import client_ip
    monkeypatch.setattr(config, "TRUST_PROXY", True)
    assert client_ip(_req(None)) == "10.0.0.5"
    assert client_ip(_req("")) == "10.0.0.5"
    assert client_ip(_req(" , ")) == "10.0.0.5"


def test_spoofed_headers_cannot_bypass_per_ip_limit(monkeypatch):
    """端到端：同一真实 IP 换着花样伪造头，仍然只算一个人，超限后走离线。"""
    from app.main import client_ip
    monkeypatch.setattr(config, "TRUST_PROXY", True)
    monkeypatch.setattr(config, "PER_IP_PER_HOUR", 2)
    monkeypatch.setattr(config, "DAILY_MODEL_CALL_CAP", 100)
    q = Quota()
    ips = {client_ip(_req(f"9.9.9.{i}, 203.0.113.9")) for i in range(10)}
    assert ips == {"203.0.113.9"}
    assert q.allow("203.0.113.9") and q.allow("203.0.113.9") and not q.allow("203.0.113.9")


# ---------------- 评分输出的确定性修复（来自真实模型上观察到的三种偏差） ----------------
def _score_sc():
    return service.SCEN_MAP[CHARGER]          # rubric_dims = ["boundary", "clarity"]


def _good_item(turn, quote, dim="boundary"):
    return {"dim": dim, "turn": turn, "quote": quote, "comment": "c"}


def test_normalize_nulls_out_of_scope_dims_and_fills_missing_keys():
    sc = _score_sc()
    o = {"scores": {"clarity": 70, "respect": 88, "boundary": 72}, "strengths": [], "improvements": []}   # respect 被填了，response_to_pushback 漏了
    out = rules.normalize_score(o, sc)
    assert out["scores"] == {"clarity": 70, "respect": None, "boundary": 72, "response_to_pushback": None}


def test_normalize_never_touches_in_scope_scores():
    sc = _score_sc()
    o = {"scores": {"clarity": 41, "boundary": 99}, "strengths": [], "improvements": []}
    out = rules.normalize_score(o, sc)
    assert out["scores"]["clarity"] == 41 and out["scores"]["boundary"] == 99


def test_normalize_drops_strength_that_collides_with_improvement_only():
    sc = _score_sc()
    o = {"scores": {}, "strengths": [_good_item(4, "a"), _good_item(3, "b"), _good_item(None, None)],
         "improvements": [dict(_good_item(4, "a"), suggestion="s")]}
    out = rules.normalize_score(o, sc)
    assert [f["turn"] for f in out["strengths"]] == [3, None]          # 撞车的第 4 轮被去掉，其余原样
    assert len(out["improvements"]) == 1


def test_normalize_does_not_launder_fabricated_quotes_or_missing_in_scope_scores():
    sc = _score_sc()
    log = [{"turn": 1, "user_utterance": "不行，我自己要用一整天"}]
    fake = {"scores": {"clarity": 70, "boundary": 72}, "strengths": [_good_item(1, "我根本没说过的话")], "improvements": []}
    assert "逐字" in rules.check_score_output(rules.normalize_score(fake, sc), sc, log)            # 编造引用：仍被拒
    missing = {"scores": {"clarity": 70, "boundary": None}, "strengths": [], "improvements": []}
    assert "boundary" in rules.check_score_output(rules.normalize_score(missing, sc), sc, log)     # 该评的维度缺分：仍被拒


def test_normalize_is_safe_on_garbage_shapes():
    sc = _score_sc()
    for junk in (None, [], "x", 3, {"scores": "bad"}, {"strengths": "bad", "improvements": [1]}):
        rules.normalize_score(junk, sc)                                # 不抛异常，交给 schema 去拒绝


def test_live_score_with_the_three_real_deviations_is_accepted_not_degraded(monkeypatch):
    sid, _ = play(CHARGER, ["不行，我自己要用一整天"])
    ref = C.post("/api/score", json={"session_id": sid}).json()["result"]
    sid2, _ = play(CHARGER, ["不行，我自己要用一整天"])
    q = "不行，我自己要用一整天"
    forged = json.loads(json.dumps(ref))
    forged["scores"] = {"clarity": 70, "respect": 88, "boundary": 72}                        # 偏差 1+2：多填 respect，漏 response_to_pushback
    forged["strengths"] = [_good_item(1, q)]
    forged["improvements"] = [dict(_good_item(1, q, "clarity"), suggestion="s")]             # 偏差 3：同一轮两边都有
    live(monkeypatch, lambda m: json.dumps(forged, ensure_ascii=False))
    r = C.post("/api/score", json={"session_id": sid2}).json()
    assert r["mode"] == "live", r["notice"]
    res = r["result"]
    assert res["scores"]["respect"] is None and res["scores"]["response_to_pushback"] is None
    assert res["overall"] == rules.rnd((70 + 72) / 2) and res["strengths"] == []
