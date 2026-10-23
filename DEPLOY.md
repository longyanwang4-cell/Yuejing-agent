# 部署到华为云（Ubuntu）

目标：一台 Ubuntu 云主机，nginx 在前对外，uvicorn 在后只监听本机。

> **诚实声明**：下面的命令、`deploy/yuejing.service` 和 `deploy/nginx-yuejing.conf` 都是在没有 Ubuntu 机器的情况下写的，**没有在真实服务器上跑过**。
> 我实际验证过的只有：在一个干净的 Python 虚拟环境里，只按 `requirements.txt` 安装，启动后端，诊断、陪练、评分全链路可用。
> 每一步后面都写了「怎么确认它成功了」，请照着确认，不要跳过。

## 0. 部署前先想清楚三件事

1. **首次打开有多慢**：前端 7.3 MB，其中 5 张 UI 图占 6.5 MB（`gold.png` 3 MB、`paper.png` 2.2 MB 最大），JS 压缩后只有 0.2 MB。
   我不知道你这台主机的实际带宽，按 7 MB 的体积粗算：1 Mbps 约 56 秒、3 Mbps 约 18 秒、5 Mbps 约 11 秒、10 Mbps 约 5 秒（只算下载，不含服务器处理）。带宽小的话，评委看到长时间的"正在点亮书房…"可能直接关掉。
   - 最直接的办法是压缩那三张图（我在临时目录里试过：5.9 MB → 1.3 MB，按显示尺寸的 2 倍缩），**但会改仓库里的素材，我没有动，缩完的效果也没有在页面里看过**，你先看对比再决定。
   - 其次是调大公网带宽。华为云怎么计费、能不能临时调整，以控制台和官方价格页为准，我没有核实。
2. **没有 HTTPS 的后果**：只开 80 端口的话，浏览器会标"不安全"，部分手机浏览器会拦截。
   用域名需要**备案**（国内服务器没备案的域名会被拦截），今天来不及的话就先用 IP 访问，并接受"不安全"提示。
3. **模型 key 的去向**：key 只写在服务器的 `backend/.env`，权限设成只有服务用户可读。别发在群里，别放进仓库。

## 1. 华为云控制台（只能你操作）

- **安全组入方向**：放行 TCP **80**（以及以后要上 HTTPS 的 **443**）和 **22**（SSH，建议把源地址限制成你自己的 IP）。
- **不要放行 8765**。后端只监听 `127.0.0.1`，外部本来就连不上；放行了反而可能给人留下绕过 nginx 的错觉。
- 确认主机有**公网 IP**（弹性公网 IP）。

## 2. 服务器环境

```bash
sudo apt update
sudo apt install -y git python3 python3-venv nginx
python3 --version          # 必须 >= 3.10，否则后端起不来（依赖 fastapi/uvicorn 要求 3.10 以上，这一点我查过）
```

**确认**：`python3 --version` 显示 3.10 或更高。
低于 3.10 的话，要么换用自带更高 Python 的系统镜像，要么另外装较新的 Python 再用它建虚拟环境（`python3.x -m venv venv`）。
我不知道你的镜像默认是哪个版本，所以这里不替你下结论，以这条命令的输出为准。

**前端不用在服务器上构建**。构建需要 Node ≥ 20.19，Ubuntu 默认源里的版本通常不够。
做法是在你自己电脑上构建好，把 `app/dist` 传上去（见第 4 步）。

## 3. 拉代码，建运行用户和虚拟环境

```bash
sudo useradd --system --home /opt/yuejing --shell /usr/sbin/nologin yuejing
sudo git clone https://github.com/longyanwang4-cell/Yuejing-agent.git /opt/yuejing
cd /opt/yuejing
sudo python3 -m venv venv
sudo venv/bin/pip install -r backend/requirements.txt
```

**确认**：`/opt/yuejing/venv/bin/python -c "import fastapi, uvicorn, httpx, jsonschema; print('ok')"` 输出 `ok`。

## 4. 上传前端构建产物

仓库里**没有** `app/dist`（构建产物不进 git）。在你**自己的电脑**上：

```powershell
cd "E:\Codex project\阅镜agent\Hackathon-3dstudyroom\reading-room-Agent\app"
npm install
npm run build
scp -r dist 你的用户名@服务器公网IP:/tmp/dist
```

然后在服务器上：

```bash
sudo rm -rf /opt/yuejing/app/dist
sudo mkdir -p /opt/yuejing/app
sudo mv /tmp/dist /opt/yuejing/app/dist
```

**确认**：`ls /opt/yuejing/app/dist` 里有 `index.html` 和 `assets/`。

## 5. 配置密钥与限额

```bash
sudo cp /opt/yuejing/backend/.env.example /opt/yuejing/backend/.env
sudo nano /opt/yuejing/backend/.env
```

需要改的几行：

```
LLM_API_KEY=你的key
TRUST_PROXY=1                # 必须。后端在 nginx 后面，不设的话所有人会被当成同一个 IP（127.0.0.1），一个人用完额度全站一起走离线
DAILY_MODEL_CALL_CAP=300     # 先设小。链接一旦被转发，没有登录的 Demo 会被别人烧额度
PER_IP_PER_HOUR=60
```

没有 key 就保持 `LLM_API_KEY=` 为空，后端自动走离线演示模式，界面会明确标注。

```bash
sudo chown root:yuejing /opt/yuejing/backend/.env
sudo chmod 640 /opt/yuejing/backend/.env      # 只有 root 和服务用户能读，其他用户读不到 key
```

## 6. 启动后端

```bash
sudo cp /opt/yuejing/deploy/yuejing.service /etc/systemd/system/yuejing.service
sudo systemctl daemon-reload
sudo systemctl enable --now yuejing
sudo systemctl status yuejing --no-pager
```

**确认**：

```bash
curl -s http://127.0.0.1:8765/api/health
# 期望：{"ok":true,"live":true/false,...}   live=true 说明读到了 key
```

起不起来就看 `sudo journalctl -u yuejing -n 50 --no-pager`。最常见的原因：Python 版本低于 3.10、`/opt/yuejing/venv` 路径不对、`.env` 权限让服务用户读不了。
`yuejing.service` 里的「加固」几行（`ProtectSystem` 等）我没在真实 Ubuntu 上验证，如果怀疑是它们引起的，临时注释掉再试。

## 7. 配置 nginx

```bash
sudo cp /opt/yuejing/deploy/nginx-yuejing.conf /etc/nginx/sites-available/yuejing
sudo ln -sf /etc/nginx/sites-available/yuejing /etc/nginx/sites-enabled/yuejing
sudo rm -f /etc/nginx/sites-enabled/default         # 默认站点会抢 80 端口
sudo nginx -t                                       # 必须先通过
sudo systemctl reload nginx
```

**确认**（在服务器上和在你自己的电脑上各做一次）：

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://服务器公网IP/          # 期望 200
curl -s http://服务器公网IP/api/health                                 # 期望 {"ok":true,...}
```

在你自己电脑上这一条如果超时，几乎一定是安全组没放行 80，回第 1 步。

## 8. 上线后的验收（必做）

1. 浏览器打开 `http://服务器公网IP/`，右上角应显示"在线模型 · 模型名"（配了 key）或"离线演示模式"（没配）。
2. 走一遍：开始对话 → 输入"室友老是借我的充电器，我怕说了他觉得我小气" → 看典故 → 回去练 → 评分 → 回书房，书架有一部点亮。
3. **用另一台设备（手机流量）也打开一次**，确认不是只有你自己的网络能访问。
4. 刷新页面，练习记录还在。
5. 如果配了 key，**这是第一次用真实模型跑这套 Prompt**，仔细看对手台词是否像真人、评分是否引用了你说的话。出问题就设 `FORCE_OFFLINE=1`（改 `.env` 后 `sudo systemctl restart yuejing`）退回离线。

## 9. 评审期间

- **提前打开一次**，让服务和浏览器缓存都是热的。
- `sudo systemctl restart yuejing` 会清空所有会话（会话在内存里），正在练习的人会遇到"会话已过期"。别在评审时重启。
- 看谁在用、额度用了多少：`curl -s http://127.0.0.1:8765/api/health` 的 `quota.used_today`。
- 日志：`sudo journalctl -u yuejing -f`。
- 不要把 `--workers` 改成大于 1：会话和限流计数都在进程内存里，多进程会让会话随机失效、限额各算各的。

## 10. 没有验证过的清单

- 这些 systemd / nginx 配置在真实 Ubuntu 上的启动
- 华为云安全组、带宽、公网 IP 的实际表现
- 国内网络到你选的模型厂商接口的延迟和稳定性
- 真实模型下的 Prompt 表现
- 多人同时访问（会话上限 500，超出会淘汰最旧的）
- HTTPS 和域名
