# 校园机会平台

面向单所学校的校园机会撮合平台。学生、老师和组织都可以发布项目、竞赛、科研、社团或创业机会，其他用户可以申请加入。首版以钉钉企业内部 H5 微应用为入口，但业务系统与钉钉保持解耦。

## 当前里程碑

- Vue 3 + TypeScript 手机端优先响应式首页
- NestJS 健康检查接口
- 基于 Prisma + PostgreSQL 的校园机会列表接口
- 可重复执行的数据库迁移与本地种子数据
- PostgreSQL / Redis 本地容器配置
- 钉钉凭证和身份适配预留

## 环境要求

- Node.js 24 LTS
- pnpm
- Docker Desktop（数据库阶段需要）

## 本地启动

```bash
cp .env.example .env
pnpm install
docker compose up -d postgres
pnpm db:generate
pnpm db:deploy
pnpm db:seed
pnpm dev
```

然后访问：

- 用户端：http://localhost:5173
- API 健康检查：http://localhost:3000/api/health
- 机会列表：http://localhost:3000/api/opportunities

首次拉取项目或数据库结构变化后，需要依次执行：

```bash
docker compose up -d postgres # 启动 PostgreSQL
pnpm db:generate              # 生成 Prisma 客户端
pnpm db:deploy                # 应用已提交的数据库迁移
pnpm db:seed                  # 写入本地演示数据，可重复执行
```

## 常用命令

```bash
pnpm dev        # 同时启动前后端
pnpm build      # 生产构建
pnpm typecheck  # 类型检查
pnpm test       # 后端测试
pnpm db:studio  # 打开 Prisma 数据管理界面
```

## 安全提醒

钉钉 `ClientSecret`、数据库密码和 JWT 密钥只能放在 `.env` 或服务器密钥管理系统中，禁止提交到 Git。仓库只保留 `.env.example`。

## 阶段 2：开发登录与权限

本地 `.env` 同时设置 `NODE_ENV=development` 和 `DEV_AUTH_ENABLED=true` 后，重启 API，在前端“我的”选择林同学、周同学或张老师登录。默认配置禁用开发登录；生产环境即使误设开关为 true，也不会开放账号列表和开发登录接口。正式身份认证将在后续通过钉钉接入。

登录使用随机 Bearer 会话凭证，有效期 8 小时；数据库只保存凭证的 SHA-256 哈希。前端凭证存于当前标签页的 sessionStorage，刷新可恢复登录，退出会删除数据库会话。服务器每次从数据库读取当前身份和权限。开发会话带有专用标识，关闭开发登录或切换生产环境后即不可使用。开发登录启用时 API 仅监听 127.0.0.1，Vite 默认也仅监听回环地址，不要向公网转发开发服务。

| 接口 | 权限与行为 |
| --- | --- |
| GET /api/health、GET /api/opportunities | 公开读取 |
| GET /api/auth/dev/accounts | 仅开发环境提供预置学生和老师账号 |
| POST /api/auth/dev/login | 仅开发环境，提交 `{ "userId": "seed-user-lin" }` |
| GET /api/me | 当前登录者的身份和个人说明 |
| PATCH /api/me/profile | 只允许修改自己的 headline、introduction、tags、availability、matchingEnabled |
| GET /api/me/opportunities | 当前用户自己的发布，包括非公开状态 |
| GET /api/me/opportunities/:id | 只返回属于当前用户的机会，他人的返回 404 |
| POST /api/auth/logout | 注销当前会话，返回 204 |

未登录访问受保护接口返回 401；角色限制失败返回 403；非法字段或超长输入返回 400。新接口默认需要登录，公开接口必须显式标记 `@Public()`；有角色限制的接口使用 `@Roles(...)`。用户不能通过资料接口修改身份、角色或其他用户资料。

阶段 2 接通了页面的登录、个人说明和匹配开关持久化。GitHub Pages 仍仅部署静态前端，后端数据库服务目前运行在本地；线上演示不显示开发账号选择器。

验证：先运行数据库迁移与种子数据，再执行 `pnpm test`。权限测试创建专用临时用户并清理，不会修改预置用户的个人说明。

## 阶段 3：机会发布闭环

登录后可在发布页保存未完成的草稿，或填写标题、介绍及截止日期后正式发布。“我的发布”读取当前用户的数据库记录；继续编辑会打开完整发布表单，可修改分类、标签、投入要求和地点等全部内容。保存成功后同步首页列表。连续点击按钮会被阻止，草稿再次保存会更新原记录。

当前本地 MVP 使用 `DRAFT → OPEN → CLOSED`；审核状态继续预留，暂未启用审核流程。已关闭记录保留但不可再编辑或重新发布。超过截止日期的 OPEN 记录在管理页显示“已截止”，可延长日期或关闭；公开列表和公开详情实时过滤草稿、关闭和过期记录。截止时间统一按中国标准时间当日 23:59:59.999 处理。

| 接口 | 行为 |
| --- | --- |
| POST /api/opportunities | 登录后创建，intent 为 draft 或 publish |
| PATCH /api/opportunities/:id | 发布者修改自己的 DRAFT/OPEN 记录 |
| POST /api/opportunities/:id/publish | 发布者把完整草稿转为招募中 |
| POST /api/opportunities/:id/close | 发布者关闭招募，保留历史 |
| GET /api/opportunities/:id | 公开查询仍在招募且未截止的详情 |

可编辑字段：title（60 字）、description（500 字）、category（project/competition/research/startup/study）、commitment（120 字）、location（100 字）、tags（最多 8 个、每个 20 字）、deadline（YYYY-MM-DD，草稿允许空）。发起人由会话确定，申请数从 0 开始；客户端不能提交 publisherId、applicants、featured 或 status。并发状态变更通过数据库条件更新控制，冲突返回 409；其他人的管理记录返回 404。

首页近 7 日数字根据实际公开记录的 publishedAt 计算。种子数据含历史截止日期，因此初始公开列表可能少于 3 条；历史机会仍在对应账号的“我的发布”中。接口失败时，本地开发页显示错误和重试入口，不伪装成发布成功。

## 阶段 4：机会申请、审核与联系权限

申请页的“我发出的 / 我收到的”及“我的申请”现已使用数据库记录，不再预填模拟申请。支持提交、查看详情、修改待处理申请、发起人通过/拒绝以及申请人撤回。切换账号后数据清空并重新读取，刷新浏览器仍保留记录；当前用“刷新申请”读取处理结果，尚未接入推送通知。

- 申请说明选填、最多 180 字，与是否附带个人说明独立。附带时由服务器保存个人说明快照；后续编辑个人说明不会改变旧申请，修改申请时可重新附上当前快照或取消附件。没有个人说明时需先完善或关闭附带选项。
- 只允许申请正在招募且未截止的机会，禁止申请自己的机会。同一用户对同一机会只能有一条记录，重复或并发提交返回 409。当前撤回/拒绝后暂不支持重新申请。
- 状态为 PENDING → APPROVED / REJECTED；申请者可把 PENDING 或 APPROVED 撤回为 WITHDRAWN。只有发布者可审核，只有申请者可编辑/撤回；并发决定通过条件更新防止覆盖。关闭/截止后不能新增、修改或通过申请，但可以拒绝/撤回；已有通过记录的联系权限保留，直到申请者撤回。
- 联系方式在“我的 → 设置”自愿填写，最多 120 字，仅本人及申请通过后的对方可读取。未通过返回 403，无关用户返回 404。提交和通过前均提示双向联系权限；撤回后不再提供联系方式。清空联系方式会停止后续展示，但不能收回对方已保存的信息。联系方式不放入公开用户信息或个人说明快照。
- 钉钉直连和通知尚未接入；未填写联系方式时明确提示。个人匹配申请从阶段 5 起接入同一套申请页与处理接口。
- 公开卡片与“我的发布”的申请人数现按真实申请记录统计（含待处理、通过、拒绝，不含撤回），不再使用种子数据中的演示计数；旧 applicants 列保留以兼容旧数据，不是当前计数来源。

| 接口 | 行为 |
| --- | --- |
| POST /api/opportunities/:id/applications | 申请机会，body 为 note 与 sendProfile |
| GET /api/me/applications?direction=sent / received | 我发出的 / 我收到的 |
| GET /api/applications/:id | 仅双方可查看申请及附带快照 |
| PATCH /api/applications/:id | 申请者修改待处理记录 |
| POST /api/applications/:id/review | 发布者处理，decision 为 approve 或 reject |
| POST /api/applications/:id/withdraw | 申请者撤回，保留历史 |
| GET /api/applications/:id/contact | 仅通过后的双方读取对方联系方式，响应禁止缓存 |
| PATCH /api/me/contact | 本人设置/清空联系方式，body 为 contact |

升级时先执行 `pnpm db:generate`、`pnpm db:deploy`，然后重启 API。验收可用一个开发账号发布未来截止的机会，另一个账号申请，再切回发起人进入“申请 → 我收到的”查看快照和审核。测试创建独立临时用户与申请并定向清理，不修改演示账号资料。

## 阶段 5：个人匹配与统一请求

匹配页不再使用浏览器本地计数或模拟师生数组。服务器按中国标准时间的自然日保存轮次，每个账号每天最多 3 轮，每轮最多 2 位老师、3 位学生；不足时展示真实人数，无候选人不创建轮次、不扣次数。关闭个人匹配后不能开始轮次，也不会出现在新结果或重新读取的旧结果中。双方都须是学生/老师，开启匹配且填写个人说明标题及介绍。

当前是可解释的 **rules-v1 规则匹配**，不是大模型 AI：需求按英文词及中文双字片段提取，需求命中占 70 分，双方共同标签占 30 分；未填需求时只按共同标签计分。优先展示当天未见过的候选人，同分按账号、日期和轮次稳定打散。个人卡片显示“相关分”，不是成功概率；分数保留轮次产生时的值，展示内容每次读取都来自当前个人说明。暂未接入向量检索、行为训练或外部模型，也不对匹配效果作准确率承诺。

| 接口 | 行为 |
| --- | --- |
| GET /api/matching/status | 当前账号今日次数及最新结果，刷新可恢复；禁止缓存 |
| POST /api/matching/rounds | requirement 最多 20 个 Unicode 码点，requestId 为 16–64 位字母/数字/连字符 |
| POST /api/matching/requests | 提交 roundId、targetUserId、note、sendProfile；仅可请求自己当天结果中的用户 |
| /api/me/applications、/api/applications/:id 及处理接口 | 同时承载机会申请与个人匹配，kind 为 OPPORTUNITY / MATCH |

- 轮次通过用户行锁和数据库唯一约束防止并发超额。同一个 requestId 重试返回同一轮，不重复扣次数；请求编号不能跨日期或修改需求复用。前端保存未确认的请求编号，网络恢复读取结果后确认，避免重复消耗。
- 匹配来意必填，最多 180 字；是否附带个人说明仍独立。附带的是提交时快照，延续阶段 4 的修改、同意、拒绝和撤回规则。
- 匹配请求仅向接收方开放处理权限。禁止向自己发送；双向并发发送只产生一条请求。已有双方请求（含拒绝/撤回历史）的对象不再参与新一轮推荐，当前暂不支持重新发起。
- 接收方同意后双方可读联系方式；任一方关闭匹配会暂停该匹配请求的联系权限，重新开启后已通过请求可恢复。撤回则停止该请求的联系权限。机会申请不受个人匹配开关影响。
- 旧结果只在当天可用于创建新请求。关闭匹配或个人说明不完整时，服务器会拦截发送、修改及同意匹配请求；拒绝和撤回仍可操作。已发送的申请及经同意提供的快照保留在双方历史记录中。

本地演示只预置林同学、周同学、张老师，不为凑人数虚构结果。`prisma/seed-matching.ts` 只补全原本没有的张老师/周同学演示个人说明，不覆盖已有说明、联系方式或匹配开关；已由常规种子脚本调用，也可在 apps/api 下单独运行 `pnpm exec ts-node --project tsconfig.json prisma/seed-matching.ts`。正式部署不要创建演示账号或启用开发登录。

验收：林同学登录 → 匹配输入需求 → 开始匹配 → 表明来意；张老师登录 → 申请 → 我收到的 → 查看快照并同意。再切回林同学查看联系入口。测试覆盖每日边界、并发限额、幂等重试、双方互发去重、退出匹配、快照和联系权限；全套运行 `pnpm test`。数据库/API 仍在本地，GitHub Pages 只部署静态前端。
