# 校园机会平台

面向单所学校的校园机会撮合平台。学生、老师和组织都可以发布项目、竞赛、科研、社团或创业机会，其他用户可以申请加入。首版以钉钉企业内部 H5 微应用为入口，但业务系统与钉钉保持解耦。

## 当前里程碑

- Vue 3 + TypeScript 手机端优先响应式首页
- NestJS 健康检查接口
- 校园机会列表接口
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
pnpm dev
```

然后访问：

- 用户端：http://localhost:5173
- API 健康检查：http://localhost:3000/api/health
- 机会列表：http://localhost:3000/api/opportunities

如需启动本地数据库：

```bash
docker compose up -d
```

## 常用命令

```bash
pnpm dev        # 同时启动前后端
pnpm build      # 生产构建
pnpm typecheck  # 类型检查
pnpm test       # 后端测试
```

## 安全提醒

钉钉 `ClientSecret`、数据库密码和 JWT 密钥只能放在 `.env` 或服务器密钥管理系统中，禁止提交到 Git。仓库只保留 `.env.example`。
