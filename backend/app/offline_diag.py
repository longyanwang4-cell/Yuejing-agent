# -*- coding: utf-8 -*-
"""离线诊断：正则打分。只在无 key / 模型失败 / 额度用尽时使用，界面会标注。"""
import re
from .content import CARD_MAP, OBST_TO_CARD, dims_union

PATTERNS = {
    "fear_of_being_disliked": r"怕.{0,10}(小气|生气|不高兴|讨厌|孤立|疏远|关系|难看)|觉得我小气|关系变差|被讨厌|讨好",
    "over_compliance": r"总是答应|不敢说不|怕让人失望|辜负|父母.{0,6}期待|又答应|硬着头皮|习惯.{0,4}(答应|妥协)|每次都答应",
    "provoked_into_struggle": r"吵架|争吵|怼|挑衅|针对我|甩锅|越吵|人身攻击|骂我|被骂|吵起来",
    "stuck_on_who_is_right": r"谁对谁错|谁的错|明明.{0,6}(我|他|她)|说服不了|不公平|分工不公|记错|不承认|不认账",
    "anger_as_only_tool": r"发火|发脾气|控制不住|忍不住|吼|后悔|一说就急|情绪上来|语气冲|火大",
    "unclear_boundary": r"借|拒绝|不好意思|不知道怎么(说|开口)|开口|不方便|帮忙|为难|不想借",
}
PRIORITY = list(PATTERNS)
OUT_OF_SCOPE = r"面试|演讲|当众|汇报|恋爱|表白|对象|老师|导师|答辩|考研|求职|职业规划|长辈"


def _clause(text: str, span) -> str:
    parts, pos = re.split(r"([，。！？,.!?；;\n])", text), 0
    for p in parts:
        if pos <= span[0] < pos + len(p):
            return p.strip()[:30] or text[:20]
        pos += len(p)
    return text[:20]


def _base(**kw):
    o = {"safety_flag": "none", "scene_tag": "unsupported", "secondary_scene_tag": None,
         "primary_obstacle": None, "confidence": "low", "evidence": "", "matched_card_ids": [],
         "rubric_dims": [], "next_action": "ask_once", "clarifying_question": None,
         "user_facing_message": ""}
    o.update(kw)
    return o


def diagnose(text: str, clarified: bool) -> dict:
    text = text.strip()
    hits = {}
    for ob in PRIORITY:
        ms = list(re.finditer(PATTERNS[ob], text))
        if ms:
            hits[ob] = ms
    scope = re.search(OUT_OF_SCOPE, text)
    if scope and not hits:
        return _base(confidence="high", evidence=_clause(text, scope.span()), next_action="decline_scope",
                     user_facing_message="这个场景我这一版还练不了。现在能陪你练的是两类：不知道怎么拒绝、怎么把界限说出来，"
                                         "以及已经起了摩擦之后怎么谈。如果你最近碰到这两种，我们可以从那儿开始。")
    if not hits:
        if clarified:
            return _base(confidence="high", evidence=text[:20], next_action="decline_scope",
                         user_facing_message="我没能从你的描述里判断出是哪一类。这一版只支持「拒绝与边界」和「冲突应对」，"
                                             "如果你的情况属于这两类，可以换个说法再说一次具体发生了什么。")
        q = "最近一次让你觉得难受的是哪件事？对方当时说了什么，你是怎么回的？"
        return _base(evidence=text[:20], clarifying_question=q,
                     user_facing_message="我还不太确定卡点在哪。" + q)
    ranked = sorted(hits, key=lambda ob: (-len(hits[ob]), PRIORITY.index(ob)))
    if ranked[0] == "unclear_boundary" and len(ranked) > 1:     # 通用词不压过具体障碍
        ranked = ranked[1:] + ["unclear_boundary"]
    top = ranked[0]
    cards = [OBST_TO_CARD[top]] + ([OBST_TO_CARD[ranked[1]]] if len(ranked) > 1 else [])
    scene = CARD_MAP[cards[0]]["scene_tag"]
    other = {CARD_MAP[c]["scene_tag"] for c in cards} - {scene}
    ev = _clause(text, hits[top][0].span())
    conf = "high" if len(hits[top]) >= 2 or len(ranked) == 1 else "medium"
    msg = "因为你提到「%s」，我先把它归到「%s」。" % (ev, scene)
    msg += "如果不太对，你可以补充。" if conf == "medium" else ""
    msg += "你想先看一条思路，还是直接开始模拟练习？"
    return _base(scene_tag=scene, secondary_scene_tag=next(iter(other), None), primary_obstacle=top,
                 confidence=conf, evidence=ev, matched_card_ids=cards, rubric_dims=dims_union(cards),
                 next_action="offer_choice", user_facing_message=msg)
