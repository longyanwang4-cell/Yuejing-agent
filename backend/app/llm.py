# -*- coding: utf-8 -*-
"""模型调用：要求返回 JSON → schema 校验 → 失败重试一次 → 仍失败抛 LLMFailure（由调用方走兜底）。"""
import json
import re
import time
import httpx
from jsonschema import Draft7Validator
from . import config


class LLMFailure(Exception):
    pass


def _extract_json(text: str):
    t = (text or "").strip()
    t = re.sub(r"^```(?:json)?\s*|\s*```$", "", t, flags=re.S).strip()
    try:
        return json.loads(t)
    except Exception:
        i, j = t.find("{"), t.rfind("}")
        if i >= 0 and j > i:
            return json.loads(t[i:j + 1])
        raise


def _post(messages):
    body = {
        "model": config.LLM_MODEL, "messages": messages, "temperature": 0.6,
        "response_format": {"type": "json_object"},
    }
    r = httpx.post(
        config.LLM_BASE_URL + "/chat/completions", json=body, timeout=config.LLM_TIMEOUT,
        headers={"Authorization": "Bearer " + config.LLM_API_KEY},
    )
    if r.status_code == 400 and "response_format" in r.text:   # 个别兼容接口不支持 json_object
        body.pop("response_format")
        r = httpx.post(
            config.LLM_BASE_URL + "/chat/completions", json=body, timeout=config.LLM_TIMEOUT,
            headers={"Authorization": "Bearer " + config.LLM_API_KEY},
        )
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"]


def call_json(system: str, user_messages: list, schema: dict, extra_check=None, normalize=None) -> dict:
    """extra_check(obj) 返回错误字符串表示不合规。总共最多 2 次尝试。"""
    validator = Draft7Validator(schema)
    messages = [{"role": "system", "content": system}] + user_messages
    last = "unknown"
    for attempt in range(2):
        try:
            obj = _extract_json(_post(messages))
            if normalize:
                obj = normalize(obj)          # 只做确定性修复（不编造内容），修不了的仍交给下面的校验拒绝
            errs = list(validator.iter_errors(obj))
            if errs:
                last = "schema: " + errs[0].message
            else:
                bad = extra_check(obj) if extra_check else None
                if not bad:
                    return obj
                last = bad
        except (httpx.HTTPError, ValueError, KeyError, json.JSONDecodeError) as e:
            last = "%s: %s" % (type(e).__name__, e)
        if attempt == 0:
            messages = messages + [{"role": "user", "content":
                "上一次输出不合规（%s）。请只输出一个符合要求的 JSON 对象，不要任何其他文字。" % last[:200]}]
            time.sleep(0.4)
    raise LLMFailure(last)
