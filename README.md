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
