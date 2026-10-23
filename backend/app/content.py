# -*- coding: utf-8 -*-
"""加载 knowledge / prompts / scenarios。cards.json 是唯一事实源。"""
import json
from .config import ROOT

DIMS = ["clarity", "respect", "boundary", "response_to_pushback"]


def _json(*p):
    return json.loads(ROOT.joinpath(*p).read_text(encoding="utf-8"))


CARDS = _json("knowledge", "cards.json")
CARD_MAP = {c["id"]: c for c in CARDS["cards"]}
SCEN_FILE = _json("scenarios", "roleplay.scenarios.json")
SCEN_MAP = {s["scenario_id"]: s for s in SCEN_FILE["scenarios"]}
SCHEMAS = {n: _json("prompts", n + ".schema.json") for n in ("diagnose", "roleplay", "score")}

# primary_obstacle 是整条链路的主键：卡片和场景都由它决定
OBST_TO_SCENARIO = {s["primary_obstacle"]: s["scenario_id"] for s in SCEN_FILE["scenarios"]}
OBST_TO_CARD = {s["primary_obstacle"]: s["card_id"] for s in SCEN_FILE["scenarios"]}

_MARK = "## PROMPT 正文"


def _prompt(name: str) -> str:
    t = ROOT.joinpath("prompts", name + ".system.md").read_text(encoding="utf-8")
    i = t.index(_MARK)
    return t[t.index("\n", i) + 1:].strip()


PROMPTS = {n: _prompt(n) for n in ("diagnose", "roleplay", "score")}


def render(template: str, **kw) -> str:
    for k, v in kw.items():
        template = template.replace("{{%s}}" % k, str(v))
    return template


def dims_union(card_ids):
    u = set()
    for cid in card_ids:
        u |= set(CARD_MAP[cid]["rubric_hint"])
    return [d for d in DIMS if d in u]


def public_card(c: dict) -> dict:
    """对外只给概括，不给 match_keywords，也不给未核实的 history_pair。"""
    d = {k: c[k] for k in ("id", "scene_tag", "concept", "plain", "limit", "source", "locator")}
    d["quote"] = c.get("quote")                       # 史书原文（公版），可以展示
    h = c.get("history_pair") or {}
    d["history"] = {k: h.get(k) for k in ("name", "origin", "era", "verified", "note")} if h else None
    return d


def public_scenario(s: dict) -> dict:
    n = s["npc"]
    return {
        "scenario_id": s["scenario_id"], "scene_tag": s["scene_tag"], "card_id": s["card_id"],
        "difficulty": s["difficulty"], "max_turns": s["max_turns"], "setting": s["setting"],
        "rubric_dims": s["rubric_dims"], "success_hint": s["success_hint"],
        "npc": {"name": n["name"], "relationship": n["relationship"], "opening_line": n["opening_line"]},
    }


def roleplay_scenario_json(s: dict) -> str:
    """喂给陪练模型的场景：去掉评分用的字段，避免泄露。"""
    d = {k: s[k] for k in ("scenario_id", "difficulty", "max_turns", "setting", "npc")}
    return json.dumps(d, ensure_ascii=False, indent=1)


_SKIN_MAX = 200

# 换了典故的情境之后，「你的目标」也要跟着换，否则会出现「班会上没人贴标签，提示却在讲被贴标签」。
# 每条只描述这张卡想练的那一个动作，不涉及具体情境，所以对任何换皮后的场景都成立。
STORY_HINTS = {
    "boundary_task_separation": "说出自己的具体限制或理由，而不是只说「不方便」",
    "boundary_courage_disliked": "被劝、被说「大家会怪你」时不去自证，把自己的要求再说一遍",
    "boundary_not_others_expectation": "可以谢谢对方的看重，但要说出自己这段时间的实际容量，不用替对方解决问题",
    "conflict_power_struggle": "不回应那句针对你这个人的话，把话题拉回到具体哪一处",
    "conflict_being_right_is_trap": "放掉谁对谁错，转向接下来怎么改、谁改哪一段",
    "conflict_anger_is_a_tool": "把不满说成一个具体的诉求，比如怎么排班、什么时候做",
}


def skinned(scenario: dict, skin: dict | None) -> dict:
    """典故自带的练习场景（房间、对手称呼、开场白）叠在后端场景上。
    只允许改「台面」：地点/情境/对手称呼/开场白。目标、隐藏动机、升级节奏、never、状态初值、难度、
    评分维度、max_turns 全部沿用后端场景——规则不因为换了皮肤而松动。"""
    if not skin:
        return scenario
    out = json.loads(json.dumps(scenario))
    for k, key in (("place", None), ("setup", "setting"), ("who", None), ("line", None)):
        v = skin.get(k)
        if v is not None and (not isinstance(v, str) or len(v) > _SKIN_MAX):
            return scenario                                  # 不合规的皮肤整体丢弃，用原场景
    if skin.get("setup"):
        place = skin.get("place") or ""
        out["setting"] = (place + "。" if place else "") + skin["setup"]
    if skin.get("who"):
        out["npc"]["name"] = skin["who"]
    if skin.get("line"):
        out["npc"]["opening_line"] = skin["line"]
    out["success_hint"] = STORY_HINTS.get(out["card_id"], out["success_hint"])
    return out
