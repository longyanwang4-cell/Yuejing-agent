# -*- coding: utf-8 -*-
"""状态机与评分规则。全部由后端计算，模型只提议。与 tools/validate_all.py 里的 decide() 保持一致。"""
import math
from .content import DIMS

CLAMP = (0, 100)
PER_TURN_MAX = 25
STATE_KEYS = ("rapport", "pressure", "user_position_clarity", "npc_concession")


def rnd(x: float) -> int:
    """恰好 .5 向上进位。不能用 Python 的 round（就近取偶）。"""
    return math.floor(x + 0.5)


def _clip(v, lo, hi):
    return max(lo, min(hi, int(v)))


def apply_turn(state: dict, out: dict, turn: int, max_turns: int, last_tactics: list):
    """把模型本轮提议的 delta 应用到状态上。返回 (新状态, 修正后的 out, 备注列表)。"""
    notes = []
    d = dict(out["state_delta"])
    tactic = out["tactic"]

    for k in STATE_KEYS:
        d[k] = _clip(d[k], -PER_TURN_MAX, PER_TURN_MAX)
    d["user_position_clarity"] = max(0, d["user_position_clarity"])        # 只升不降

    # 让步门槛：看的是本轮之前累积的 clarity，而不是模型这一轮口头说的
    if turn == 1 and tactic in ("concede_partial", "accept"):
        notes.append("first_turn_concede_blocked"); tactic = "press"; d["npc_concession"] = 0
    if tactic == "concede_partial" and state["user_position_clarity"] + d["user_position_clarity"] < 40:
        notes.append("concede_below_threshold"); tactic = "probe"; d["npc_concession"] = 0
    if tactic == "accept" and state["npc_concession"] + d["npc_concession"] < 70:
        notes.append("accept_below_threshold"); tactic = "concede_partial"
    if out.get("evidence_tag") in ("attack", "vague", "off_topic"):          # schema 里同样锁了
        d["user_position_clarity"] = min(d["user_position_clarity"], 5)
        d["npc_concession"] = min(d["npc_concession"], 0)
    # 同一 tactic 不连用超过 2 轮
    if len(last_tactics) >= 2 and last_tactics[-1] == last_tactics[-2] == tactic:
        notes.append("tactic_repeat_flagged")

    new = {k: _clip(state[k] + d[k], *CLAMP) for k in STATE_KEYS}
    new["user_position_clarity"] = max(new["user_position_clarity"], state["user_position_clarity"])

    # 结束条件由后端裁决，不信模型的 should_end
    end = None
    if new["npc_concession"] >= 70:
        end = "goal_reached"
    elif new["rapport"] <= 15:
        end = "rapport_broken"
    elif turn >= max_turns:
        end = "max_turns"
    elif out.get("end_reason") == "user_ended":
        end = "user_ended"

    fixed = dict(out)
    fixed.update(tactic=tactic, state_delta=d, should_end=end is not None, end_reason=end)
    return new, fixed, notes


def roleplay_violation(state: dict, out: dict, turn: int, last_tactics: list):
    """陪练输出越过 Prompt 里的硬规则时返回原因（用于让模型带着原因重试）；合规返回 None。
    apply_turn 仍会兜底修正，但修正只改数值不改台词，所以优先让模型自己改。"""
    t, d = out["tactic"], out["state_delta"]
    if turn == 1 and t in ("concede_partial", "accept"):
        return "第一轮绝不让步，不能使用 %s" % t
    if t == "concede_partial" and state["user_position_clarity"] + d["user_position_clarity"] < 40:
        return "user_position_clarity 累计未达 40，不能使用 concede_partial；请用 press/probe 等继续推进"
    if t == "accept" and state["npc_concession"] + d["npc_concession"] < 70:
        return "npc_concession 累计未达 70，不能使用 accept"
    if len(last_tactics) >= 2 and last_tactics[-1] == last_tactics[-2] == t:
        return "tactic %s 已连续使用两轮，本轮必须换一个" % t
    return None


def decide_next(overall: int, npc_concession: int, difficulty: int, end_reason: str) -> str:
    """评分文档第七节的规则表，按顺序命中。"""
    if end_reason == "rapport_broken":
        return "retry_same"
    if overall < 50:
        return "review_card"
    if overall < 70:
        return "retry_same"
    if npc_concession < 70:
        return "retry_same"
    if difficulty < 3:
        return "transfer_new"
    if overall >= 85:
        return "transfer_new"
    return "retry_same"


def recompute_overall(scores: dict, rubric_dims: list) -> int:
    vals = [scores[d] for d in rubric_dims if scores.get(d) is not None]
    return rnd(sum(vals) / len(vals)) if vals else 0


def check_score_output(obj: dict, scenario: dict, log: list):
    """评分输出的运行时校验。返回错误字符串，None 表示通过。"""
    for d in DIMS:
        if (d in scenario["rubric_dims"]) != (obj["scores"].get(d) is not None):
            return "scores.%s 填写与场景 rubric_dims 不符" % d
    by_turn = {e["turn"]: e["user_utterance"] for e in log}
    seen = {"strengths": set(), "improvements": set()}
    for grp in ("strengths", "improvements"):
        for f in obj[grp]:
            if f["turn"] is None:
                continue
            if f["turn"] not in by_turn:
                return "%s 引用了不存在的 turn %s" % (grp, f["turn"])
            if f["quote"] not in by_turn[f["turn"]]:
                return "%s 的 quote 不是第 %s 轮的逐字原话" % (grp, f["turn"])
            seen[grp].add(f["turn"])
    if seen["strengths"] & seen["improvements"]:
        return "同一 turn 同时出现在优点和改进里"
    return None
