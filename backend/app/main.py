# -*- coding: utf-8 -*-
"""FastAPI 入口。同一个服务同时托管前端静态页，部署只需要起这一个进程。
注意：Demo 没有登录，任何拿到链接的人都能用；模型额度靠 quota.py 限流，key 只在后端环境变量里。"""
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import config, service
from .content import CARDS, CARD_MAP, SCEN_FILE, public_card, public_scenario
from .quota import quota

app = FastAPI(title="阅境 Agent", docs_url=None, redoc_url=None)
# 3D 前端构建产物：cd app && npm run build。后端同源托管它，部署只需起这一个进程。
FRONTEND = config.ROOT / "app" / "dist"


def client_ip(req: Request) -> str:
    if config.TRUST_PROXY:
        xff = req.headers.get("x-forwarded-for", "")
        if xff:
            return xff.split(",")[0].strip()
    return req.client.host if req.client else "unknown"


class DiagnoseIn(BaseModel):
    text: str = Field(min_length=1, max_length=config.MAX_USER_CHARS)
    session_id: str | None = None


class Skin(BaseModel):
    place: str | None = Field(default=None, max_length=60)
    setup: str | None = Field(default=None, max_length=200)
    who: str | None = Field(default=None, max_length=20)
    line: str | None = Field(default=None, max_length=200)


class StartIn(BaseModel):
    scenario_id: str
    session_id: str | None = None
    skin: Skin | None = None


class TurnIn(BaseModel):
    session_id: str
    text: str = Field(min_length=1, max_length=config.MAX_USER_CHARS)


class SidIn(BaseModel):
    session_id: str


@app.exception_handler(service.SessionGone)
async def _gone(_, __):
    return JSONResponse({"error": "session_gone", "message": "会话已过期，请重新开始。"}, status_code=410)


@app.exception_handler(service.Conflict)
async def _conflict(_, e):
    return JSONResponse({"error": "conflict", "message": str(e)}, status_code=409)


class NotFound(Exception):
    pass


@app.exception_handler(NotFound)
async def _nf(_, __):
    return JSONResponse({"error": "not_found", "message": "没有这个场景或卡片。"}, status_code=404)


@app.exception_handler(Exception)
async def _any(_, __):
    # 兜底：任何未预料的错误都给前端一个可理解的提示，而不是 500 白屏
    return JSONResponse({"error": "server", "message": "服务暂时出了点问题，请再试一次。"}, status_code=500)


@app.get("/api/health")
def health():
    return {"ok": True, "live": config.live_enabled(), "model": config.LLM_MODEL if config.live_enabled() else None,
            "quota": quota.snapshot()}


@app.get("/api/library")
def library():
    return {"cards": [public_card(c) for c in CARDS["cards"]],
            "scenarios": [public_scenario(s) for s in SCEN_FILE["scenarios"]],
            "corpus": CARDS["meta"]["corpus"],
            "live": config.live_enabled()}


@app.post("/api/diagnose")
def diagnose(body: DiagnoseIn, req: Request):
    return service.diagnose(body.session_id, body.text.strip(), client_ip(req))


@app.post("/api/practice/start")
def start(body: StartIn):
    try:
        return service.start_practice(body.session_id, body.scenario_id, body.skin.model_dump() if body.skin else None)
    except service.UnknownScenario:
        raise NotFound()


@app.post("/api/practice/turn")
def turn(body: TurnIn, req: Request):
    return service.practice_turn(body.session_id, body.text.strip(), client_ip(req))


@app.post("/api/practice/end")
def end(body: SidIn):
    return service.end_practice(body.session_id)


@app.post("/api/score")
def score(body: SidIn, req: Request):
    return service.score(body.session_id, client_ip(req))


if FRONTEND.exists():
    @app.get("/")
    def index():
        return FileResponse(FRONTEND / "index.html")

    app.mount("/", StaticFiles(directory=str(FRONTEND)), name="static")
else:
    @app.get("/")
    def index_missing():
        return JSONResponse({"error": "no_frontend", "message": "前端还没构建：cd app && npm install && npm run build"},
                            status_code=404)
