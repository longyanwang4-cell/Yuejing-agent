# -*- coding: utf-8 -*-
"""运行配置。密钥只从环境变量或 backend/.env 读取，绝不写进代码或前端。"""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]          # 交接包根目录
BACKEND = ROOT / "backend"


def _load_dotenv():
    f = BACKEND / ".env"
    if not f.exists():
        return
    for line in f.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


_load_dotenv()

# 任何 OpenAI 兼容接口都可用（DeepSeek / 通义 / 智谱 / Moonshot / OpenAI ...）
LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "https://api.openai.com/v1").rstrip("/")
LLM_API_KEY = os.environ.get("LLM_API_KEY", "")
LLM_MODEL = os.environ.get("LLM_MODEL", "gpt-4o-mini")
LLM_TIMEOUT = float(os.environ.get("LLM_TIMEOUT", "40"))

# 强制离线（不调模型）。路演现场网络不稳时用：FORCE_OFFLINE=1
FORCE_OFFLINE = os.environ.get("FORCE_OFFLINE", "") == "1"

# 公网 Demo 没有登录，必须限额，否则链接泄露会烧光额度
DAILY_MODEL_CALL_CAP = int(os.environ.get("DAILY_MODEL_CALL_CAP", "1500"))
PER_IP_PER_HOUR = int(os.environ.get("PER_IP_PER_HOUR", "150"))

MAX_USER_CHARS = 300
SESSION_TTL_SECONDS = 2 * 3600
MAX_SESSIONS = 500


def live_enabled() -> bool:
    return bool(LLM_API_KEY) and not FORCE_OFFLINE

# 部署在反向代理（Render/Nginx 等）后面时设为 1，才信任 X-Forwarded-For 取真实 IP
TRUST_PROXY = os.environ.get("TRUST_PROXY", "") == "1"
