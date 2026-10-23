# 阅境 Agent｜交接文档

> 面向接手这个项目的人。读完这一份应该能独立往下做，不需要回头问。
> 产出日期：2026-10-21　最后更新：2026-10-23
> 状态：配置层已完成并通过校验；`app/` 三维前端三个场景都已跑通（书房 / 典故 / 练习）；后端与评分仍未开始

---

## 0. 一分钟了解

**做什么**：一个让大学生练习人际沟通的 Agent。用户带着真实困扰进来 → Agent 诊断分类 → 给一条书里的思路 → AI 扮演对方陪他多轮练 → 四维度证据化打分 → 根据表现决定下一步练什么。

**和市面产品的区别**：别的产品是「选书→读书→做笔记」，我们是「带着问题进来→Agent 决定你该看哪条→练→评」。差异化在**闭环**，不在聊天也不在 3D。

**当前进度**：

| 层 | 状态 |
|---|---|
| 知识库（6 张卡） | ✅ 完成 |
| 诊断模块 Prompt + Schema | ✅ 完成 |
| 角色模拟 Prompt + Schema + 6 场景配置 | ✅ 完成 |
| 评分模块 Prompt + Schema | ✅ 完成 |
| 校验脚本 | ✅ 完成（15 项全过） |
| **后端代码** | ❌ 未开始 |
| **前端页面** | 🟡 书房 / 典故 / 练习三个 Scene 已跑通，数据全 mock |
| **3D 场景** | ✅ 可漫游书房 + 六篇典故（各五幕）+ 六个独立练习房间 |

**第一件事**：`cd app && npm install && npm run dev`，能进书房；再跑一遍 `python -I tools/validate_all.py`，应该看到 `ALL CHECKS PASSED`。两边都过，说明现状是好的，可以直接往下做。

---

## 1. 文件地图

```
D:\claude prioject\3d agent\
├── HANDOFF.md                        ← 你正在读的
├── knowledge\
│   └── cards.json                    6 张知识卡（唯一事实源）
├── prompts\
│   ├── diagnose.system.md            诊断 Prompt（整段作 system message）
│   ├── diagnose.schema.json          诊断输出约束
│   ├── roleplay.system.md            角色模拟 Prompt（每轮调一次）
│   ├── roleplay.schema.json          单轮输出约束
│   ├── score.system.md               评分复盘 Prompt（结束后调一次）
│   └── score.schema.json             评分输出约束
├── scenarios\
│   └── roleplay.scenarios.json       6 个场景配置 + 状态机规则
├── tools\
│   └── validate_all.py               改完任何配置都跑这个
└── 原材料\                            原始素材，没动过
    ├── ACC(1).docx                   三版产品演进史 + PRD
    ├── gpt 方案书.docx                 方案书 V0.1
    └── *.png / *.jpg                 概念图 4 张 + 微信群截图 3 张
```

**依赖**：校验脚本需要 `jsonschema`（`pip install jsonschema`）。除此之外配置层没有任何依赖。

---

## 2. 主链路：七步，三次模型调用

```
①用户描述困扰
     ↓
②诊断归类 ───────────────── 模型调用 1（diagnose）
     ↓  输出 primary_obstacle → 决定用哪张卡、哪个场景
③知识卡（可跳过）
     ↓
④多轮角色扮演 ───────────── 模型调用 2（roleplay，每轮一次）
     ↓  输出 evidence_log + 终局 state
⑤四维度评分复盘 ─────────── 模型调用 3（score）
     ↓
⑥下一步决策（规则，不调模型）
     ↓
⑦成长记录落盘
```

三个模块靠 `primary_obstacle` 串起来，它是整条链路的主键：

| primary_obstacle | 知识卡 | 场景 | 难度 |
|---|---|---|---|
| `unclear_boundary` | boundary_task_separation | roommate_charger_boundary | 1 |
| `fear_of_being_disliked` | boundary_courage_disliked | roommate_night_game_disliked | 2 |
| `over_compliance` | boundary_not_others_expectation | club_task_refusal | 2 |
| `provoked_into_struggle` | conflict_power_struggle | group_blame_provoked | 2 |
| `stuck_on_who_is_right` | conflict_being_right_is_trap | dorm_chore_who_is_right | 3 |
| `anger_as_only_tool` | conflict_anger_is_a_tool | borrowed_money_anger | 3 |

诊断判出 obstacle，卡片和场景就都定了，不需要二次判断。

---

## 3. 怎么做：实施计划

### 阶段 1：主链路跑通（最高优先级）

目标：命令行里能从「我不好意思拒绝室友」一路走到评分输出。**先不做任何界面。**

1. 写一个 `callModel(systemPrompt, messages, schema)`，要求模型返回 JSON，用 schema 校验
2. 校验失败重试一次；再失败走兜底（见 §5）
3. 按 §2 顺序串三个模块，中间状态先放内存
4. 验收：三种输入各跑一遍——典型拒绝、描述过短（应触发追问）、面试（应拒绝受理）

**这一阶段做完，项目就算活了。** 后面全是包装。

### 阶段 2：决策闭环

1. 实现 §4 的状态机（后端算，不交给模型）
2. 实现评分模块第七节的路径规则表（纯 if-else，别用模型判）
3. 训练记录落盘：`localStorage` 就够，PRD 明确不要数据库
4. 验收：演示两条路径——一次没说清→`review_card`→再练；一次说清了→`transfer_new`→新场景

### 阶段 3：界面

1. 四个页面：输入页、对话页、知识卡页、历史记录页
2. 评分用你们概念图里那个环形分数 + 四条横向进度条，图已经画好了照着做
3. 验收：刷新不丢数据，模型出错不白屏

### 阶段 4：3D 书房（P1，可砍）

1. 静态书架 + 6 本书可点击 + 练过的点亮
2. **技术选型**：React 项目用 React Three Fiber（33k 星，MIT），非 React 用 Three.js（117k 星，MIT）
3. **时间不够立刻降级 2D**：一张书房插画 + 书籍图标高亮，P0 功能完全不受影响
4. 书籍必须是独立可点击对象，不能是一张整图（见 §7 关于 Sac 教程那条）

### 阶段 5：路演准备

按同一个案例彩排。**演示时必须讲清三件事**，否则闭环体现不出来：
- 为什么匹配这条知识
- 哪一句话影响了评分
- 为什么 Agent 选择下一步练这个

---

## 4. 状态机（务必后端实现）

四个状态量，模型只提议增量，**后端负责累加、裁剪、校验**：

| 变量 | 范围 | 含义 | 特殊规则 |
|---|---|---|---|
| `rapport` | 0–100 | 关系融洽度 | ≤15 触发结束 |
| `pressure` | 0–100 | 对方施压强度 | NPC 的武器，不是用户指标 |
| `user_position_clarity` | 0–100 | 用户立场清晰度 | **只升不降**（单调递增） |
| `npc_concession` | 0–100 | 对方让步幅度 | ≥70 判定达成 |

```
每轮每项 |delta| ≤ 25，裁剪到 [0, 100]
user_position_clarity 的 delta 不得为负（schema 已锁）
concede_partial 要求 user_position_clarity ≥ 40
accept 要求 npc_concession ≥ 70
同一 tactic 不得连用超过 2 轮（把前两轮传回给模型）
```

结束条件任一命中：`turn > max_turns` / `npc_concession ≥ 70` / `rapport ≤ 15` / 用户主动结束。

**为什么把 clarity 和 concession 拆成两个**：方案书原示例只有一个 `boundary_clarity`，既表示「用户说清了没」又表示「对方退了没」。但这两件事不同步——用户说得很清楚而对方还在耗，是最该练的情况。合在一起 NPC 就只能要么秒退要么死扛。

---

## 5. 异常兜底（PRD 要求，别漏）

| 情况 | 处理 |
|---|---|
| 模型返回非法 JSON | 重试 1 次 → 仍失败则用兜底文案，页面不崩 |
| 模型返回超范围枚举 | 当作非法，走上面流程 |
| 超时 | 同上，前端显示「再试一次」按钮 |
| `evidence` 摘不出用户原话 | 诊断模块 `confidence` 降为 `low`；评分模块用「证据不足写法」（`turn`/`quote` 填 `null`，明说「这句话没有出现」） |
| 危机信号（自伤等） | `safety_flag: "crisis"` → 立刻转介，不分类不练习不给卡片 |

**兜底文案要提前写好放在代码里**，不要临时让模型生成。

---

## 6. 三条红线

### 6.1 版权

**内容载体已经改过一次，以改后的为准：只以史书为载体。** 早期方案里那本《被讨厌的勇气》已经整个拿掉了 —— 凡是还在讲「原书第几夜」「页码指路」的段落都是旧稿残留，按本节执行。

书架上现在这六部典籍全部是**公版史书**，不存在在版图书的授权问题：

| 典籍 | 出处 | 对应概念 |
|---|---|---|
| 子罕辞玉 | 左传 | 拒绝与边界 |
| 苏武持节 | 汉书 | 拒绝与边界 |
| 不为五斗米折腰 | 晋书 | 拒绝与边界 |
| 晏子使楚 | 晏子春秋 | 冲突应对 |
| 将相和 | 史记 | 冲突应对（**唯一精做全五幕**） |
| 唐雎不辱使命 | 战国策 | 冲突应对 |

公版只是「可以引」，不等于「随便引」：

- ✅ 可以：引原文句子、标注出处到篇名（如《史记·廉颇蔺相如列传》）、用自己的话讲这段事
- ❌ 不要：把整篇列传做成全文阅读页、把译文当原著原文署作者名
- 译文若用白话改写，来源写「据《史记》意译」，不写「《史记》云」

### 6.2 产品定位

这是**人际沟通能力训练工具**，不是心理咨询/医疗产品。

- 不做心理诊断，不提疾病名、人格类型
- 不用心理测量口径（说「这次练习的表现」，不说「你的沟通能力得分」）
- 不宣称用户「已经掌握」某种能力
- 普通人际困扰**不要主动提心理热线**（只有危机分支提）——把普通困扰导向心理求助既不准确也会让用户退缩

三个 schema 都用 `additionalProperties: false` 挡住了模型自己长出 `diagnosis`、`mastered` 这类字段。校验脚本里有对应负例。

### 6.3 数据口径

PRD 里「54 份问卷」的结论（75% 存在困扰、冲突应对 70%、拒绝边界 65%）样本只有 54 人、大一大二占 61%。

对外展示必须标注「本次问卷样本」，**不能说成「大学生普遍如此」**。方案书已有这条口径说明，保留它。

---

## 7. 外部参考的真实情况（我核验过）

方案书列了 7 个 GitHub 仓库，实际查询结果：

| 仓库 | 星 | 许可证 | 结论 |
|---|---|---|---|
| ConversationSimulator | 4 | NOASSERTION | 只读设计思路 |
| edu-role-play | 1 | MIT | 只看 Rubric 结构 |
| nextjs-docs-rag | 3 | Apache-2.0 | 本期不需要 RAG |
| SocialBench | 71 | **无** | 已停更两年 |
| RPEval | 20 | **无** | 只借评估维度 |
| **react-three-fiber** | 33k | MIT | ✅ 可用 |
| **three.js** | 117k | MIT | ✅ 可用 |

前五个是 1–71 星的个人项目，**三个没有许可证**（= 默认保留所有权利，不能复制代码）。能真正用的只有后两个。Agent 侧全部自己写。

**关于那条 X 链接**（https://x.com/Saccc_c/status/2110694725640474759）：

是 Sac 的一篇长文《手把手教你用 Opus 5.5 / Astra + Tripo 制作 3D 游戏》（2026-10-15，68.7 万浏览）。他的管线是 `Image 生图 → Tripo 生成 3D → Opus 操控 Blender + Unity → Mixamo 动作`，**目标是 Unity 打包的桌面游戏**，和我们要的网页 Demo 不是一回事，别照搬。

值得拿走的三条方法：
1. 先定一张满意的主效果图，再围绕它补其他角度（俯视图说布局，斜侧图说层次）
2. 让 AI 先拆解资产、标注哪些需要单独生成，而不是一股脑全生成
3. 多机位截图反馈迭代

**源码在文章发布时未公开**（他写「下周将在 GitHub 开源」），我用 GitHub API 搜不到对应仓库。所以**不要把它列为依赖**，也别承诺能复刻他的游戏。

---

## 8. 待决事项

交给你判断，我没有替你决定：

1. **历史典故的位置**。微信群里（最新讨论）定的是「历史典故第一顺位，没有才退回书籍」，方案书写的是「历史作为可选模块」。两份材料冲突，概念图站在群聊这一侧（蔺相如卡片画在主干流程第 2、3 步）。我的建议是合成版：**历史负责「看见」，书籍负责「命名」**——先给典故场景让用户看见，再用一个概念名命名它。这样书籍只出概念不出原文，版权风险也降了。`cards.json` 里 `history_pair` 字段已经预留好位置。

2. **`history_pair` 里 4 条典故待核原文**。`verified` 字段标了状态：只有亚历山大斩绳结是 `true`（书中 p141 自引），子罕辞玉、晏子使楚、将相和、六尺巷都是 `false`，我凭记忆给的出处，**入库前必须核**。公版材料的优势正是可核验。

3. **诊断模块 low 置信度时 `scene_tag` 填什么**。现在填 `"unsupported"`，语义上有点挤（它表达的是「判不出」而不是「超范围」）。要分开的话加一个 `"undetermined"` 枚举值，schema 和 Prompt 各改一处。我没加是因为少一个枚举少一处分支，前端判 `next_action === "ask_once"` 就够了。

4. ~~**典故要精做到几篇**~~ **已定并已执行**：六篇全部做到五幕，右页各有一座按地标生成的微缩场景（荒野 / 市集 / 朝堂）。原判断「先深不先广」已作废 —— 六篇都有场景之后，书架才不像一张待办清单。

---

## 9. 改配置的规矩

**唯一事实源是 `knowledge/cards.json`。** 改任何东西都从它开始，然后同步三个 schema 的枚举。

改完**一定跑校验**：

```powershell
python -I "D:\claude prioject\3d agent\tools\validate_all.py"
```

它会检查 15 项，包括跨文件引用一致性、样例合规性、引用是否逐字可溯、状态机可达性、决策表完备性。退出码可以直接接 CI。

加一张卡要同时改五处：
1. `knowledge/cards.json` 加卡
2. `prompts/diagnose.schema.json` 的 `matched_card_ids` 枚举
3. `prompts/diagnose.system.md` 第四节的匹配表 + 第三节的 obstacle 表
4. `prompts/score.schema.json` 的 `card_id` 枚举
5. `scenarios/roleplay.scenarios.json` 加对应场景（obstacle 与卡片必须一对一）

漏任何一处校验都会报出来。

---

## 10. 一句话优先级

> **Agent 训练闭环 > 对话质量与反馈可信度 > 3D 视觉表现**

3D 书房是加分项，不是交付阻塞项。时间不够就降 2D，P0 一个都不能少。

---

## 11. `app/` 三维前端：结构与坑

**三个场景，一个 composer。** 书房、典故、练习是三个独立的 `THREE.Scene`，各自带一套机位表；`engine.setScene(scene, shots)` 换的是 `renderPass.scene` 和机位表，不是切页面。场景之间靠 `ui/wipe.js` 那层暖纸色的化场交接 —— **只能有一层**，各场景自己造一张纸会叠出谁也关不掉的黑屏。

| 文件 | 管什么 |
|---|---|
| `core/engine.js` | 渲染器、后期、`Rig` 机位（`snap` / `go` / `goShot` / `update`）、tick 队列 |
| `core/walker.js` | 第一人称 WASD + 鼠标 + E，只在书房里启用 |
| `history/diorama.js` | 整本书 + 右页那座城，全部由基础几何体和 canvas 贴图拼出来 |
| `history/story.js` | 六篇典故的全部内容：cast / beats / steps / practice |
| `history/scene.js` | 书页场景的取景、五幕推进、概念卡、交给练习 |
| `practice/scene.js` | 六个 1:1 房间（宿舍 / 教室 / 办公室 / 会议室 / 走廊…） |
| `assistant/guide.js` | 书房里那尊沟通达人。分节四肢 + 几何五官，和 `buildOpponent()` 同一套做法 |
| `ui/flow.js` | 书房的状态机（home / talk / shelf / growth / explore）与漫游 |
| `styles/assets.css` | 生图素材的落点（纸 / 金箔 / 九宫格框 / 金线 / 朱砂印），**新 UI 一律从这里取** |

**机位。** `Rig` 只在 `enabled` 时写相机；书房里相机归 walker 管，切到取景前必须先 `walk.exit()`。`wide / wide2 / lianpo / drop` 是排好的固定取景；`street / gate` 是**当场算的**（`scene.js` 里的 `AIM`）：六篇的人站位差得远，固定机位总有一篇对着空地开镜。加新篇目时不用管这两个机位，但要确认 `beats` 里每个人都写了 `p`。

**灯光是个陷阱。** 典故场景的主光是 4.2、案头点光 26，后期是 ACES + 曝光 1.05 —— 这套参数是给深色地面调的。**接近白色的材质会当场烧成一张白纸**（北海的雪第一版就是这样）。要亮的东西，把反照率压到中灰偏冷，让光去提亮它。同理，加色混合的白色 glow sprite 压在亮地面上不是雾，是两块发光的白斑 —— 雪原里被显式关掉了。

**两个会浪费时间的环境坑（都验证过，不是代码 bug）：**

1. 控制台报 `buildRoom is not defined` / `hemBand is not defined` —— 那是之前改文件时留下的 **HMR 残帧**，源码里根本没有这两个函数。整页刷新即消失。别去找。
2. 截图拍出一整屏白色辉光、UI 也变得发灰 —— WebGL 上下文被浏览器收走了（`gl.isContextLost()` 为 true，通常伴随 `ERR_INSUFFICIENT_RESOURCES`）。刷新页面即可，别改材质。

**无头浏览器里截图的正确姿势**：headless 下 rAF 会被节流，`rig.go()` 的过渡走不完。截图前先 `rig.t = 1`，再手动跑几次 `rig.update(dt, t)`，最后 `composer.render()`。

**UI 素材是「生图直出 + 只做色溢清理」，不是抠图。** 五张图在 `app/public/ui/`（paper / gold / frame / divider / seal），源头与提示词在 `art/ui/`。规矩：素材必须由接口直接给透明底；`art/ui/_clean.py` 只负责打掉生图留下的纯红/纯绿毛边（`frame.png` 曾经漏过一遍，`_fix-frame.py` 补的就是这个 —— 边框上那圈红线）。**不要手动画蒙版去抠。**

**引用的两个硬约束**：气泡靠 `flow.js` 每帧写 `left/top` 并用 `offsetWidth/Height` 排版，换皮时不能改定位方式、不能给 `#bubble` 加 `display:flex`（会盖掉 `hidden`）；`.top` 这个 class 表示气泡在人物上方，尾巴必须从底部伸出去。典故页的「带着这句话回去练」（`#cc-go`）在无头浏览器里**只认真实点击**，`element.click()` 打不开练习场景 —— 用 Playwright 的 `locator().click()`。
