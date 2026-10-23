// 后端调用封装。任何失败都变成带中文提示的 ApiError，界面据此提示「再试一次」，不白屏。
// 开发时由 vite 代理到 FastAPI（见 vite.config.js）；生产环境由后端同源托管，不需要改地址。
const TIMEOUT_MS = 75000;   // 后端单次模型调用最多重试一次再降级，留足余量

export class ApiError extends Error {
  constructor(kind, message, status) { super(message); this.kind = kind; this.status = status; }
}

async function call(path, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const hasBody = body !== undefined;
  try {
    const r = await fetch(path, {
      method: hasBody ? 'POST' : 'GET',
      headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
      body: hasBody ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    let data = null;
    try { data = await r.json(); } catch (_) { /* 非 JSON 响应 */ }
    if (!r.ok) {
      const kind = { 410: 'gone', 409: 'conflict', 422: 'invalid', 404: 'missing' }[r.status] || 'server';
      const fallback = kind === 'invalid' ? '输入内容不符合要求（1 到 300 字）。' : '服务暂时出了点问题，请再试一次。';
      throw new ApiError(kind, (data && data.message) || fallback, r.status);
    }
    return data;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e.name === 'AbortError') throw new ApiError('timeout', '等了太久没有回应，请再试一次。');
    throw new ApiError('network', '网络好像断了，检查连接后再试一次。');
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  health: () => call('/api/health'),
  library: () => call('/api/library'),
  diagnose: (b) => call('/api/diagnose', b),
  start: (b) => call('/api/practice/start', b),
  turn: (b) => call('/api/practice/turn', b),
  end: (b) => call('/api/practice/end', b),
  score: (b) => call('/api/score', b),
};
