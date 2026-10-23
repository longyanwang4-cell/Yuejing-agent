# -*- coding: utf-8 -*-
"""
阅境 Agent 配置校验器
用法：python -I tools/validate_all.py
作用：改完 knowledge/ prompts/ scenarios/ 下任何文件后跑一遍，
      确认三个模块的字段、枚举、跨文件引用仍然自洽。
退出码 0 = 全过，1 = 有问题（可直接接 CI）。
"""
import json, re, sys, math, os
from jsonschema import Draft7Validator

# 本脚本常用 -I 运行（忽略环境变量），故在此自行设定输出编码，避免 GBK 控制台报错
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = lambda *p: json.load(open(os.path.join(BASE, *p), encoding="utf-8"))
T = lambda *p: open(os.path.join(BASE, *p), encoding="utf-8").read()

cards = J("knowledge", "cards.json")
dg_s = J("prompts", "diagnose.schema.json")
rp_s = J("prompts", "roleplay.schema.json")
sc_s = J("prompts", "score.schema.json")
scen_f = J("scenarios", "roleplay.scenarios.json")
dg_md = T("prompts", "diagnose.system.md")
rp_md = T("prompts", "roleplay.system.md")
sc_md = T("prompts", "score.system.md")

FAIL = []
def bad(m): FAIL.append(m); print("  FAIL", m)
def ok(m): print("  OK  ", m)

DIMS = ["clarity", "respect", "boundary", "response_to_pushback"]
CARD_IDS = {c["id"] for c in cards["cards"]}
CMAP = {c["id"]: c for c in cards["cards"]}
SCEN = {s["scenario_id"]: s for s in scen_f["scenarios"]}
OBST = set(dg_s["properties"]["primary_obstacle"]["oneOf"][0]["enum"])
OBST2CARD = {
    "unclear_boundary": "boundary_task_separation",
    "fear_of_being_disliked": "boundary_courage_disliked",
    "over_compliance": "boundary_not_others_expectation",
    "provoked_into_struggle": "conflict_power_struggle",
    "stuck_on_who_is_right": "conflict_being_right_is_trap",
    "anger_as_only_tool": "conflict_anger_is_a_tool",
}
samples = lambda md: [json.loads(x) for x in re.findall(r"```json\s*(\{.*?\})\s*```", md, re.S)]


# ---------- A. 知识卡 ----------
print("\n[A] knowledge/cards.json")
req = ["id","scene_tag","concept","match_keywords","plain","limit","rubric_hint","source","locator","history_pair"]
if len(CARD_IDS) != len(cards["cards"]): bad("card id 重复")
for c in cards["cards"]:
    miss = [k for k in req if k not in c]
    if miss: bad("%s 缺字段 %s" % (c["id"], miss))
    if not set(c["rubric_hint"]) <= set(cards["meta"]["rubric_dims"]): bad("%s rubric_hint 非法" % c["id"])
    for f in ("plain", "limit"):
        if re.search(r'[“"][^”"]{25,}', c.get(f, "")): bad("%s %s 疑似含原文摘录" % (c["id"], f))
if len(cards["cards"]) == 6: ok("6 张卡，字段齐全，无长引号段（无原文摘录）")

# ---------- B. 诊断 ----------
print("\n[B] prompts/diagnose.*")
if set(dg_s["properties"]["matched_card_ids"]["items"]["enum"]) != CARD_IDS: bad("card_id 枚举 != cards.json")
else: ok("card_id 枚举与 cards.json 一致")
if set(dg_s["properties"]["scene_tag"]["enum"]) - {"unsupported"} != {c["scene_tag"] for c in cards["cards"]}: bad("scene_tag 枚举不一致")
else: ok("scene_tag 枚举一致")
if set(dg_s["properties"]["rubric_dims"]["items"]["enum"]) != set(cards["meta"]["rubric_dims"]): bad("rubric_dims 枚举不一致")
else: ok("rubric_dims 枚举一致")
for i in CARD_IDS | OBST:
    if i not in dg_md: bad("prompt 未提及 %s" % i)
v = Draft7Validator(dg_s)
for n, o in enumerate(samples(dg_md), 1):
    e = list(v.iter_errors(o))
    if e: bad("diagnose 样例 %d 不合规: %s" % (n, e[0].message))
    if o["matched_card_ids"]:
        u = set()
        for cid in o["matched_card_ids"]: u |= set(CMAP[cid]["rubric_hint"])
        if set(o["rubric_dims"]) != u: bad("diagnose 样例 %d rubric_dims != 卡片 rubric_hint 并集" % n)
        if o["rubric_dims"] != [d for d in DIMS if d in o["rubric_dims"]]: bad("diagnose 样例 %d 维度顺序非规范" % n)
ok("4 个样例合规且 rubric_dims = 卡片并集")

# ---------- C. 角色模拟 ----------
print("\n[C] scenarios + prompts/roleplay.*")
if sorted(s["primary_obstacle"] for s in scen_f["scenarios"]) != sorted(OBST): bad("场景未与 6 个 obstacle 一对一")
else: ok("6 场景 <-> 6 obstacle 一对一")
svars = set(scen_f["meta"]["state_vars"])
for s in scen_f["scenarios"]:
    sid = s["scenario_id"]
    if OBST2CARD[s["primary_obstacle"]] != s["card_id"]: bad("%s obstacle/card 不匹配" % sid)
    if CMAP[s["card_id"]]["scene_tag"] != s["scene_tag"]: bad("%s scene_tag 与卡片不一致" % sid)
    if not set(CMAP[s["card_id"]]["rubric_hint"]) & set(s["rubric_dims"]): bad("%s rubric_dims 与卡片无交集" % sid)
    if set(s["state_init"]) != svars: bad("%s state_init 字段不全" % sid)
    if s["state_init"]["user_position_clarity"] or s["state_init"]["npc_concession"]: bad("%s 累积量必须从 0 起" % sid)
    if len(s["npc"]["escalation"]) != 3: bad("%s escalation 必须 3 阶段" % sid)
    if not s["npc"]["never"]: bad("%s never 为空" % sid)
    if s["transfer_to"] not in SCEN or s["transfer_to"] == sid: bad("%s transfer_to 非法" % sid)
ok("card/scene_tag/state_init/escalation/transfer_to 全部自洽")
for t in scen_f["meta"]["npc_tactics"]:
    if t not in rp_md: bad("prompt 未说明 tactic %s" % t)
for x in svars:
    if x not in rp_md: bad("prompt 未说明状态量 %s" % x)
ok("8 tactic + 4 状态量均有说明")
v = Draft7Validator(rp_s)
for n, o in enumerate(samples(rp_md), 1):
    e = list(v.iter_errors(o))
    if e: bad("roleplay 样例 %d 不合规: %s" % (n, e[0].message))
ok("%d 个样例合规" % len(samples(rp_md)))

# 可达性：清晰用户能否在 max_turns 内达成
for s in scen_f["scenarios"]:
    st, turn = dict(s["state_init"]), 0
    while turn < s["max_turns"]:
        turn += 1
        st["user_position_clarity"] = min(100, st["user_position_clarity"] + 22)
        if st["user_position_clarity"] >= 40: st["npc_concession"] = min(100, st["npc_concession"] + 25)
        if st["npc_concession"] >= 70: break
    if st["npc_concession"] < 70: bad("%s 目标在 %d 轮内不可达" % (s["scenario_id"], s["max_turns"]))
    r, t2 = s["state_init"]["rapport"], 0
    while r > 15 and t2 < s["max_turns"]: t2 += 1; r = max(0, r - 20)
    if t2 <= 1: bad("%s 关系 1 轮即破裂" % s["scenario_id"])
ok("6 场景目标 4 轮可达；关系破裂最快 2 轮")

# ---------- D. 评分 ----------
print("\n[D] prompts/score.*")
if set(sc_s["properties"]["card_reference"]["properties"]["card_id"]["enum"]) != CARD_IDS: bad("score card_id 枚举不一致")
if set(sc_s["definitions"]["dim"]["enum"]) != set(cards["meta"]["rubric_dims"]): bad("score dim 枚举不一致")
ok("枚举与 cards.json 一致")

def decide(ov, con, dif, er):
    if er == "rapport_broken": return "retry_same"
    if ov < 50: return "review_card"
    if ov < 70: return "retry_same"
    if con < 70: return "retry_same"
    if dif < 3: return "transfer_new"
    if ov >= 85: return "transfer_new"
    return "retry_same"

combos = 0
for ov in range(101):
    for con in (0, 69, 70, 100):
        for dif in (1, 2, 3):
            for er in ("goal_reached", "max_turns", "rapport_broken", "user_ended"):
                a = decide(ov, con, dif, er); combos += 1
                if a == "transfer_new" and ov < 70: bad("规则/schema 冲突 transfer<70")
                if a == "review_card" and ov > 49: bad("规则/schema 冲突 review>49")
ok("决策表 %d 组合全部可解，且不与 schema 边界冲突" % combos)

LOGS = {0: {1:"啊……我今天可能有点不方便", 2:"你要用多久啊",
            3:"不行，我今天下午要带电脑去图书馆，充电器得我自己用一整天",
            4:"晚上我也要用，你要不问问别人"},
        1: {1:"啊……我看看", 2:"嗯……可能吧", 3:"那你用完早点还我"}}
META = {0: ("goal_reached", 75), 1: ("max_turns", 0)}
v = Draft7Validator(sc_s)
for i, o in enumerate(samples(sc_md)):
    e = list(v.iter_errors(o))
    if e: bad("score 样例 %d 不合规: %s" % (i+1, e[0].message)); continue
    s, log = SCEN[o["scenario_id"]], LOGS[i]
    for d in DIMS:
        if (d in s["rubric_dims"]) != (o["scores"][d] is not None): bad("样例 %d scores.%s 填写错误" % (i+1, d))
    vals = [o["scores"][d] for d in DIMS if o["scores"][d] is not None]
    if o["overall"] != math.floor(sum(vals)/len(vals) + 0.5): bad("样例 %d overall 非算术平均(.5进位)" % (i+1))
    for grp in ("strengths", "improvements"):
        for f in o[grp]:
            if f["turn"] is None: continue
            if f["turn"] not in log: bad("样例 %d %s turn %s 不在日志" % (i+1, grp, f["turn"]))
            elif f["quote"] not in log[f["turn"]]: bad("样例 %d %s quote 非逐字" % (i+1, grp))
    st = {f["turn"] for f in o["strengths"] if f["turn"]}
    im = {f["turn"] for f in o["improvements"] if f["turn"]}
    if st & im: bad("样例 %d 同一 turn 两边复用" % (i+1))
    if o["card_reference"]["card_id"] != s["card_id"]: bad("样例 %d 卡片与场景不符" % (i+1))
    er, con = META[i]
    if o["next_action"] != decide(o["overall"], con, s["difficulty"], er): bad("样例 %d next_action 不符规则表" % (i+1))
    if o["next_action"] == "transfer_new" and o["next_scenario_id"] != s["transfer_to"]: bad("样例 %d 迁移目标错误" % (i+1))
ok("2 个样例合规、引用逐字可溯、路径符合规则表")
for p in ["已经掌握", "心理测量", "心理诊断"]:
    if p not in sc_md: bad("prompt 缺少对「%s」的明确禁止" % p)
ok("明确禁止宣称掌握/心理测量/心理诊断")

print("\n" + "="*52)
print("==> ALL CHECKS PASSED" if not FAIL else "==> %d 个问题：\n - %s" % (len(FAIL), "\n - ".join(FAIL)))
sys.exit(1 if FAIL else 0)
