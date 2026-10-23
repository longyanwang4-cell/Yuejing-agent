# -*- coding: utf-8 -*-
"""离线陪练 + 离线评分。规则驱动，不调模型。
用途：无 key、模型失败、额度用尽时保证 Demo 能完整走完闭环。界面会标注「离线演示模式」。
输出结构与 roleplay / score 的 schema 一致，之后同样经过 rules.py 的后端校验。
"""
import re
from .content import CARD_MAP, DIMS, SCEN_MAP
from .offline_lines import LINES, STORY_LINES
from .rules import decide_next, recompute_overall

HEDGE = r"可能|有点|看看|再说|也许|好像|大概|应该|不太|嗯{1,}|啊……|吧\?|算是"
# 「不方便」是文档里的典型含糊句，不算明确拒绝；时间词本身也不算具体理由
# 「问问别人 / 找别人」是把问题交还给对方，属于明确的边界表态
REFUSE = r"不行|不借|不能|不可以|没法|不给|不要|不想|拒绝|没空|没时间|做不了|接不了|不接|问问别人|问别人|找别人|另外找"
CONCRETE = r"因为|要用|得用|我要|我得|自己要|自己用|一整天|整晚|期中|考试|图书馆|作业|早八|\d"
ATTACK = (r"有病|滚|闭嘴|自己不会|你这人|你怎么老是|烦死|傻|白痴|不要脸|你每次都|别拿.{0,6}(堵|挡|压)|堵我|"
          r"你.{0,6}(总是|老是|从来)|自私|没脑子|无耻|至于吗")
CONCESSION = r"好吧|行吧|可以吧|借你|给你|没问题|行行行|拿去|那好吧|算了"
REQUEST = (r"能不能|可不可以|可以.{0,6}吗|麻烦|希望你|请你|什么时候|几号|周[一二三四五六日]前|"
           r"怎么(排|补|分)|重新(排|分)|这周.{0,4}还|今晚.{0,6}(补|给|交)")
EMOTION = r"生气|难受|不舒服|烦|委屈|失望|不开心|不高兴"
# 冲突类场景里的好回应不是「说不」，而是把话题从对错/情绪拉回到具体做法：问具体哪一处、
# 提出分工或排班、给出带时间的承诺。这类句子要按「具体诉求」计，否则会把示范里的好句子判成含糊。
CONSTRUCTIVE = (r"具体(哪|是|说)|一条一条|逐条|对一遍|翻出来|写下来|贴(在|到)|排(个)?班|分工|谁改|改哪|先改|怎么改|"
                r"(周[一二三四五六日]|明[天早晚]|今晚|这周|下周|[点号]前|中午前|之前).{0,14}(给|交|出|改|做|补|发|汇总)|"
                r"给(您|你)看|我们(现在|先|今晚|再|就|一起|把)")
POLITE = r"不好意思|抱歉|谢谢|理解|对不起|麻烦你"


def classify(text: str):
    """返回 (evidence_tag, clarity_gain, rapport_delta)。"""
    t = text.strip()
    polite = 4 if re.search(POLITE, t) else 0
    if re.search(ATTACK, t):
        return "attack", 0, -20
    if re.search(CONCESSION, t) and not re.search(r"不借|不行|不能|不要", t):
        return "concession", 0, 3
    if re.search(REFUSE, t):
        if re.search(HEDGE, t) and not re.search(CONCRETE, t):
            return "vague", 3, 0
        return "clear_refusal", (22 if re.search(CONCRETE, t) else 14), polite
    if re.search(REQUEST, t):
        return "concrete_request", 20, 3 + polite
    # 说出了自己的具体限制（即使没带「不」字），按评分标准也算把事说成了对方听得懂的具体事
    if re.search(CONSTRUCTIVE, t) and len(t) >= 10 and not re.search(HEDGE, t):
        return "concrete_request", 20, polite
    # 必须是第一人称陈述：疑问句（你要用多久啊）是在问对方，不算说出了自己的限制
    if (re.search(CONCRETE, t) and "我" in t and not re.search(HEDGE, t)
            and not re.search(r"[?？吗呢啊]$|多久|多长|什么|怎么|为什么", t)):
        return "concrete_request", 20, polite
    if re.search(EMOTION, t):
        return "emotional", 3, -5
    if re.search(HEDGE, t):
        return "vague", 3, 0
    return ("off_topic" if (len(t) < 8 or t.endswith(("?", "？"))) else "vague"), 0, 0


def _pick(lines, used_lines):
    """优先选没说过的台词；全说过了才循环，保证不复读。"""
    for ln in lines:
        if ln not in used_lines:
            return ln
    return lines[len(used_lines) % len(lines)]


def _pool(L, st):
    """当前阶段台词排最前，其余阶段的台词作为后备，用完之前不会重复。返回 [(tactic, line)]。"""
    order = [st] + [i for i in (1, 2, 3) if i != st]
    return [(L["s%d" % i][0], ln) for i in order for ln in L["s%d" % i][1]]


def npc_turn(scenario_id: str, text: str, state: dict, turn: int, stage: int, last_tactics: list,
             used_lines=frozenset(), story_card=None):
    """返回符合 roleplay.schema 的单轮输出（未经 apply_turn 修正）。"""
    L = (STORY_LINES.get(story_card) if story_card else None) or LINES[scenario_id]
    tag, gain, rap = classify(text)
    ev = text.strip()[:20]
    delta = dict(rapport=rap, pressure=0, user_position_clarity=gain, npc_concession=0)
    st = max(1, min(3, stage))
    after_clarity = state["user_position_clarity"] + gain

    if tag == "attack":
        tactic, line = "deflect", _pick(L["attack"], used_lines)
        delta["pressure"] = 10
    elif tag == "concession" and L["yield"] not in used_lines:
        tactic, line = "press", L["yield"]
        delta["pressure"] = -10
    elif tag in ("clear_refusal", "concrete_request") and turn >= 2 and after_clarity >= 40:
        if state["npc_concession"] >= 50:
            tactic, line = "accept", L["accept"]
            delta.update(pressure=-20, npc_concession=25)
        else:
            tactic, line = "concede_partial", _pick(L["concede"], used_lines)
            delta.update(pressure=-15, npc_concession=25)
    else:
        pool = _pool(L, st)
        fresh = [p for p in pool if p[1] not in used_lines]
        tactic, line = (fresh or pool)[0]
        delta["pressure"] = 5 if tag in ("clear_refusal", "concrete_request") else 10
        st = min(3, st + 1)
    # 同一 tactic 连用超过 2 轮 → 换一个
    if len(last_tactics) >= 2 and last_tactics[-1] == last_tactics[-2] == tactic and tactic not in ("accept",):
        tactic = "probe" if tactic != "probe" else "press"

    return {
        "npc_line": line, "tactic": tactic, "state_delta": delta,
        "evidence": ev if text.strip() else None, "evidence_tag": tag if text.strip() else None,
        "should_end": False, "end_reason": None, "escalation_stage": min(3, max(1, stage)),
    }, st


# ------------------------------ 评分 ------------------------------
SAY = {
    "roommate_charger_boundary": "今天不行，我要带电脑去图书馆，充电器得自己用一整天。",
    "roommate_night_game_disliked": "我明天早八，现在得睡了，请你把声音关掉或者戴上耳机。",
    "club_task_refusal": "谢谢学姐信任我，不过这周我已经接了两件事还有期中，物料这次接不了。",
    "group_blame_provoked": "我这块今晚补完，你那块什么时候能给我？我们先对一下进度。",
    "dorm_chore_who_is_right": "谁记错先放一边，我们重新排一下轮值，每人固定一天，行吗？",
    "borrowed_money_anger": "那三百块已经两个月了，这周五前你能转给我吗？",
}
NOTE = {
    # 每张卡两句：(说清了时的对应, 没说清时的对应)。只转述典故与自编解读，不摘录原文以外的段落。
    "boundary_task_separation": (
        "子罕拒绝一块玉，靠的是先说自己看重什么，而不是把玉贬低一顿。你把自己的限制摆在前面，再说这件事不接，对方没法只靠施压把它推翻。",
        "子罕先说的是自己看重什么，再谈这件事。这一场里你的理由一直没有被说完整，所以对方先听到的是余地，而不是你的位置。"),
    "boundary_courage_disliked": (
        "苏武在最要紧的那件事上不让步，别的地方照常往来。他会不会被讨厌不归他管，守住那条线才归他管。你被追问之后仍把要求重说了一遍，是同一个意思。",
        "苏武被劝了两次都没有点头。这一场里你的要求没有被说完整，对方就没有理由停下，怕被讨厌的那一半把话压回去了。"),
    "boundary_not_others_expectation": (
        "陶渊明拒绝的不是俸禄，是为了俸禄必须变成另一个人。你没有为了换认可而答应，同时说明了自己的实际容量，这正是这一条双向的用法。",
        "陶渊明辞官，代价自己认了。这一场里对方一直在抬高你的重要性，要点是说出自己的容量，而不是等对方不再需要你。"),
    "conflict_power_struggle": (
        "晏子被当众刁难，不回击那句针对人的话，只回应对事的规则。对方转向攻击你的时候你没有接招，而是回到事情上，就是不参加这场比赛。",
        "晏子只说了一句关于规矩的话。这一场里对方把话题转到针对你这个人时，你的回应被他带着走了，比赛就这样开始了。"),
    "conflict_being_right_is_trap": (
        "蔺相如从没说过廉颇错，他把谁更对换成了什么更急。你把焦点从谁记错放到了接下来怎么办，这一步比争出对错有用。",
        "蔺相如不在谁对谁错上争。这一场的焦点一直停在对错上，对方也就只会守着自己的细节，事情反而没人往前推。"),
    "conflict_anger_is_a_tool": (
        "唐雎把怒拆成两种，没有被吓住也没有跟着发火。你把不满换成了一个具体诉求，对方才有可以回应的东西。",
        "唐雎的怒是在他手里选用的。这一场的不满还没有变成对方能接的具体要求，把想要的事说成时间和动作，会比表达火气更有用。"),
}


def _clip(v):
    return max(0, min(100, int(round(v))))


def score(scenario: dict, log: list, final: dict, end_reason: str) -> dict:
    sid = scenario["scenario_id"]
    n = max(1, len(log))
    tags = [e["evidence_tag"] for e in log]
    good = {"clear_refusal", "concrete_request"}
    share = sum(t in good for t in tags) / n
    attacks = tags.count("attack")
    caves = tags.count("concession")
    later = [t for e, t in zip(log, tags) if e["turn"] >= 2]
    share_later = (sum(t in good for t in later) / len(later)) if later else 0.4

    raw = {
        "clarity": 20 + 55 * share + 25 * final["user_position_clarity"] / 100,
        "respect": 92 - 28 * attacks - 4 * tags.count("emotional"),
        "boundary": 15 + 50 * share + 25 * final["npc_concession"] / 100 - 22 * caves,
        "response_to_pushback": 25 + 55 * share_later + 10 * (final["npc_concession"] >= 25) - 18 * caves - 10 * attacks,
    }
    scores = {d: (_clip(raw[d]) if d in scenario["rubric_dims"] else None) for d in DIMS}
    overall = recompute_overall(scores, scenario["rubric_dims"])

    by_turn = {e["turn"]: e for e in log}
    dim_main = "boundary" if "boundary" in scenario["rubric_dims"] else scenario["rubric_dims"][0]
    dim_clear = "clarity" if "clarity" in scenario["rubric_dims"] else dim_main

    def quote(e):
        return e["user_utterance"].strip()[:25]

    improvements, used_turns = [], set()
    if not any(t in good for t in tags):          # 全程没表态：没说话本身就是证据，turn/quote 填 null
        improvements.append({"dim": dim_main, "turn": None, "quote": None,
                             "comment": "这场对话里你始终没有直接说出那个不或具体诉求，所以对方一直有理由继续问。这不是说错了什么，是那句话没有出现。",
                             "suggestion": "下一次可以在第一轮就说：" + SAY[sid]})
    bad = next((e for e in log if e["evidence_tag"] == "attack"), None)
    if bad and len(improvements) < 2:
        improvements.append({"dim": "respect", "turn": bad["turn"], "quote": quote(bad),
                             "comment": "这句把矛头指向了对方这个人，而不是这件事，对方会先防御而不是回应你的要求。",
                             "suggestion": "说事不说人，比如：" + SAY[sid]})
        used_turns.add(bad["turn"])
    vague = next((e for e in log if e["evidence_tag"] in ("vague", "off_topic", "emotional")
                  and e["turn"] not in used_turns), None)
    if vague and len(improvements) < 2:
        improvements.append({"dim": dim_clear, "turn": vague["turn"], "quote": quote(vague),
                             "comment": "这句留了余地，没有说成一件对方可以回应的具体事，所以对方会继续推进。",
                             "suggestion": "直接说出自己的具体限制，比如：" + SAY[sid]})
        used_turns.add(vague["turn"])
    cave = next((e for e in log if e["evidence_tag"] == "concession" and e["turn"] not in used_turns), None)
    if cave and len(improvements) < 2:
        improvements.append({"dim": dim_main, "turn": cave["turn"], "quote": quote(cave),
                             "comment": "这句答应了自己并不情愿的事，前面说清的立场在这里被放掉了。",
                             "suggestion": "被追问时把原来那句再说一遍：" + SAY[sid]})
        used_turns.add(cave["turn"])
    strengths = []
    clear = next((e for e in log if e["evidence_tag"] in good and e["turn"] not in used_turns), None)
    if clear:
        strengths.append({"dim": dim_main, "turn": clear["turn"], "quote": quote(clear),
                          "comment": "这句给出了具体的限制或诉求，对方没法只靠施压把它推翻。"})
    # 只有话里真有顾及对方的措辞才记为尊重的优点；没有就不写，宁可少一条
    polite = next((e for e in log if re.search(POLITE, e["user_utterance"])
                   and e["evidence_tag"] not in ("attack", "concession")
                   and e["turn"] not in used_turns and (not clear or e["turn"] != clear["turn"])), None)
    if attacks == 0 and polite and len(strengths) < 2:
        strengths.append({"dim": "respect", "turn": polite["turn"], "quote": quote(polite),
                          "comment": "全程没有把话说难听，关系代价保住了，接下来要补的是把自己的需要说完整。"})

    card = CARD_MAP[scenario["card_id"]]
    ok = bool(clear)
    link = (clear or (log[-1] if log else None))
    next_action = decide_next(overall, final["npc_concession"], scenario["difficulty"], end_reason)
    nxt = scenario["transfer_to"] if next_action == "transfer_new" else None
    if next_action == "transfer_new":
        reason = "这一场整体表现 %d 分，对方也退了（让步 %d）。可以换一个新场景再试：和「%s」的那一场（%s）。" % (
            overall, final["npc_concession"], SCEN_MAP[nxt]["npc"]["name"], SCEN_MAP[nxt]["setting"].split("。")[0])
    elif next_action == "review_card":
        reason = "这一场整体表现 %d 分，主要原因是关键的那句没有说出来。建议先看一下「%s」这条思路，再回到同一个场景练一次。" % (overall, card["concept"])
    elif end_reason == "rapport_broken":
        reason = "这一场中途关系先崩了，代价偏高。同一个场景再来一次，试着说事不说人。"
    elif final["npc_concession"] < 70:
        reason = "这一场整体表现 %d 分，但对方并没有真的退让（让步 %d）。同一场景再练一次，把关键那句说得更具体。" % (overall, final["npc_concession"])
    else:
        reason = "这一场整体表现 %d 分，再练一次，把那句话在被追问之后依然说完整。" % overall

    intro = ("刚才这几轮里，你在第 %d 轮把话说清楚之后，对方的态度有了变化。我们按几个方面过一遍。" % clear["turn"]
             if clear else "这一场你一直很客气，但从头到尾对方都没听到明确的回应。我们看看卡在哪儿。")
    return {
        "scenario_id": sid, "scores": scores, "overall": overall,
        "strengths": strengths[:2], "improvements": improvements[:2],
        "card_reference": {"card_id": card["id"], "concept": card["concept"],
                           "link_to_turn": link["turn"] if link else None, "note": NOTE[card["id"]][0 if ok else 1]},
        "next_action": next_action, "next_scenario_id": nxt, "next_reason": reason, "user_facing_intro": intro,
    }
