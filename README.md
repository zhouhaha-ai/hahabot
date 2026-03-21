# haha-chatbot

一个使用 React、FastAPI、PostgreSQL 和 SSE 流式输出实现的全栈聊天机器人项目。聊天记忆只在当前会话内生效，跨会话不共享上下文。

## 中文说明

### 技术栈

- 前端：React 18 + TypeScript + Vite
- 后端：FastAPI + SQLAlchemy + Alembic
- 数据库：PostgreSQL
- 流式协议：POST + `text/event-stream`
- 部署方式：Docker Compose + Nginx

### 环境变量

先从示例文件复制一份 `.env`：

```bash
cp .env.example .env
```

至少需要配置这些变量：

- `DOCKERHUB_NAMESPACE`
- `IMAGE_TAG`
- `QWEN_API_KEY`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `DATABASE_URL`

推荐镜像配置：

```text
DOCKERHUB_NAMESPACE=zhouhahaai
IMAGE_TAG=latest
```

`latest` 表示主线稳定版本。如果你想部署某一次 GitHub Actions 生成的精确镜像，把它改成 `IMAGE_TAG=sha-<github-commit-sha>`。

### 本地开发

后端测试：

```bash
cd backend
./.venv/bin/python -m pytest tests -v
```

前端测试：

```bash
cd frontend
npm run test
```

前端生产构建：

```bash
cd frontend
npm run build
```

### Docker 镜像发布

GitHub Actions 会把应用镜像发布到 Docker Hub：

- `zhouhahaai/hahabot-frontend`
- `zhouhahaai/hahabot-backend`

PostgreSQL 继续直接使用官方镜像 `postgres:16-alpine`。

只有推送到 `main` 时才会刷新 `latest` 标签。其他分支推送或手动触发 workflow 时，只会发布 `sha-<commit>` 标签。

### 1. 配置 GitHub Secrets

在 GitHub 仓库设置里添加这两个 Actions secrets：

- `DOCKERHUB_USERNAME=zhouhahaai`
- `DOCKERHUB_TOKEN=<docker-hub-access-token>`

配置完成后，仓库内的 [`.github/workflows/docker-publish.yml`](.github/workflows/docker-publish.yml) 会自动发布镜像。

### 2. 准备服务器

首次部署时，在服务器上执行：

```bash
git clone git@github.com:zhouhaha-ai/hahabot.git
cd hahabot
cp .env.example .env
```

`.env` 推荐配置如下：

```text
DOCKERHUB_NAMESPACE=zhouhahaai
IMAGE_TAG=latest
POSTGRES_DB=haha_chatbot
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<strong-password>
DATABASE_URL=postgresql+psycopg://postgres:<strong-password>@postgres:5432/haha_chatbot
QWEN_API_KEY=<your-qwen-api-key>
QWEN_MODEL=qwen-plus
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
```

### 3. 首次部署

服务器端直接执行：

```bash
chmod +x deploy.sh deploy/deploy.sh
./deploy.sh
```

`deploy.sh` 会做这几件事：

- 检查 `.env` 和 `docker-compose.yml`
- 执行 `docker compose pull`
- 执行 `docker compose up -d`
- 对 `http://localhost/api/sessions` 做 smoke check

后端容器启动时会自动执行 `alembic upgrade head`，所以数据库迁移会在部署过程中自动应用。

### 4. 验收

检查 API：

```bash
curl http://localhost/api/sessions
```

检查容器状态：

```bash
docker compose ps
```

查看日志：

```bash
docker compose logs -f frontend
docker compose logs -f backend
docker compose logs -f postgres
```

### 5. 更新部署

如果要部署 `main` 上最新的稳定版本：

```bash
git pull
./deploy.sh
```

如果要部署某个精确镜像版本：

```bash
sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=sha-<github-commit-sha>/' .env
./deploy.sh
```

### 6. 回滚

把 `.env` 里的 `IMAGE_TAG` 改回之前的 `sha-...`，然后重新执行：

```bash
./deploy.sh
```

停止服务：

```bash
docker compose down
```

### 说明

- 前端通过 Nginx 代理 `/api` 到后端，也支持 SSE 流式响应。
- 现在服务器不会本地构建镜像，而是直接从 Docker Hub 拉取镜像部署。
- 密钥必须放在 `.env` 或服务器环境变量中，不要提交到仓库。
- 当前这个编码环境里没有 `docker` CLI，所以本地只验证了前后端测试、构建和部署脚本，没有在本机执行完整容器编排。

## English

Simple full-stack chatbot built with React, FastAPI, PostgreSQL, and SSE streaming. Session memory is scoped to the current chat session and persists across refreshes, but it is intentionally isolated across sessions.

### Stack

- Frontend: React 18 + TypeScript + Vite
- Backend: FastAPI + SQLAlchemy + Alembic
- Database: PostgreSQL
- Streaming: POST + `text/event-stream`
- Deployment: Docker Compose + Nginx

### Environment

Create `.env` from the example file:

```bash
cp .env.example .env
```

Set at least:

- `DOCKERHUB_NAMESPACE`
- `IMAGE_TAG`
- `QWEN_API_KEY`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `DATABASE_URL`

Recommended image settings:

```text
DOCKERHUB_NAMESPACE=zhouhahaai
IMAGE_TAG=latest
```

Use `latest` for mainline deployments. For a branch build or one-off deployment, use `IMAGE_TAG=sha-<github-commit-sha>`.

### Local Development

Backend tests:

```bash
cd backend
./.venv/bin/python -m pytest tests -v
```

Frontend tests:

```bash
cd frontend
npm run test
```

Frontend production build:

```bash
cd frontend
npm run build
```

### Docker Deployment

GitHub Actions publishes application images to Docker Hub:

- `zhouhahaai/hahabot-frontend`
- `zhouhahaai/hahabot-backend`

PostgreSQL continues to run from the official `postgres:16-alpine` image.

Only pushes to `main` refresh the `latest` tag. Other branch pushes or manual runs publish `sha-<commit>` tags for explicit deployments.

### 1. Configure GitHub Secrets

Add these Actions secrets in the GitHub repository settings:

- `DOCKERHUB_USERNAME=zhouhahaai`
- `DOCKERHUB_TOKEN=<docker-hub-access-token>`

The workflow at [`.github/workflows/docker-publish.yml`](.github/workflows/docker-publish.yml) will publish the images.

### 2. Prepare the Server

For first-time deployment:

```bash
git clone git@github.com:zhouhaha-ai/hahabot.git
cd hahabot
cp .env.example .env
```

Recommended `.env` values:

```text
DOCKERHUB_NAMESPACE=zhouhahaai
IMAGE_TAG=latest
POSTGRES_DB=haha_chatbot
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<strong-password>
DATABASE_URL=postgresql+psycopg://postgres:<strong-password>@postgres:5432/haha_chatbot
QWEN_API_KEY=<your-qwen-api-key>
QWEN_MODEL=qwen-plus
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
```

### 3. First Deployment

Run on the server:

```bash
chmod +x deploy.sh deploy/deploy.sh
./deploy.sh
```

`deploy.sh` will:

- validate `.env` and `docker-compose.yml`
- run `docker compose pull`
- run `docker compose up -d`
- smoke-check `http://localhost/api/sessions`

The backend container runs `alembic upgrade head` on startup, so schema migrations are applied automatically.

### 4. Verification

Check the API:

```bash
curl http://localhost/api/sessions
```

Check running containers:

```bash
docker compose ps
```

View logs:

```bash
docker compose logs -f frontend
docker compose logs -f backend
docker compose logs -f postgres
```

### 5. Updating a Deployment

To deploy the latest stable version from `main`:

```bash
git pull
./deploy.sh
```

To deploy a specific published image:

```bash
sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=sha-<github-commit-sha>/' .env
./deploy.sh
```

### 6. Rollback

Set `IMAGE_TAG` back to a previous `sha-...` value and redeploy:

```bash
./deploy.sh
```

Stop the stack:

```bash
docker compose down
```

### Notes

- The frontend proxies `/api` to the backend through Nginx, including SSE responses.
- The server no longer builds images locally; it pulls published images from Docker Hub.
- Secrets must stay in `.env` or server-side environment variables and must never be committed.
- In this coding environment, `docker` CLI is not available, so full container orchestration was not executed locally. Application tests, builds, and deployment scripts were verified separately.
