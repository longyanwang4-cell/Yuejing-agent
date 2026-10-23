# -*- coding: utf-8 -*-
"""危机信号预检。命中就不调模型、不分类、不练习，直接转介。

词表取自半步猫提示词里的危机关键词，去掉了"没意思"（太宽，会误伤"这课没意思"）。
热线号码仅在第三方目录核对过，上线前请对照官方来源再确认一次。
"""
CRISIS_WORDS = [
    "不想活", "活不下去", "死了算了", "自杀", "轻生", "结束一切", "伤害自己",
    "消失就好了", "想死", "不想活了", "割腕", "跳楼", "结束生命", "不如死了", "自残",
]

HOTLINES = [
    {"name": "全国统一心理援助热线", "number": "12356"},
    {"name": "希望24热线", "number": "400-161-9995"},
]

CRISIS_MESSAGE = (
    "我在这儿，先不练习，也不分析。你说的这些很重要，别一个人扛着。"
    "现在请先联系身边信任的人，或者拨打下面的热线，有人会认真听你说。"
)


def is_crisis(text: str) -> bool:
    t = (text or "").replace(" ", "")
    return any(w in t for w in CRISIS_WORDS)


def crisis_diagnose_output(evidence: str) -> dict:
    """与 diagnose.schema.json 的 crisis 分支一致。"""
    return {
        "safety_flag": "crisis", "scene_tag": "unsupported", "secondary_scene_tag": None,
        "primary_obstacle": None, "confidence": "high", "evidence": evidence[:20] or "危机信号",
        "matched_card_ids": [], "rubric_dims": [], "next_action": "refer_out",
        "clarifying_question": None,
        "user_facing_message": CRISIS_MESSAGE + "全国统一心理援助热线 12356；希望24热线 400-161-9995。",
    }
