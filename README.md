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

本阶段已接通页面的登录、个人说明和匹配开关持久化。“我的发布/申请”、匹配结果和其余业务操作仍保留原型流程，后续阶段逐项接入。GitHub Pages 仍仅部署静态前端，后端数据库服务目前运行在本地；线上演示不显示开发账号选择器。

验证：先运行数据库迁移与种子数据，再执行 `pnpm test`。权限测试创建专用临时用户并清理，不会修改预置用户的个人说明。
