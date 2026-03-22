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

### CI：Docker 镜像发布

GitHub Actions 会把应用镜像发布到 Docker Hub：

- `zhouhahaai/hahabot-frontend`
- `zhouhahaai/hahabot-backend`

PostgreSQL 继续直接使用官方镜像 `postgres:16-alpine`。

只有推送到 `main` 时才会刷新 `latest` 标签。其他分支推送或手动触发 workflow 时，只会发布 `sha-<commit>` 标签。

### 1. 配置 CI Secrets

在 GitHub 仓库设置里添加这两个 Actions secrets：

- `DOCKERHUB_USERNAME=zhouhahaai`
- `DOCKERHUB_TOKEN=<docker-hub-access-token>`

配置完成后，仓库内的 [`.github/workflows/docker-publish.yml`](.github/workflows/docker-publish.yml) 会自动发布镜像。

### CD：手动部署到生产服务器

生产部署不再要求你手动 SSH 上服务器执行命令。流程是：

1. 推代码到 `main`
2. GitHub Actions 发布 Docker 镜像
3. 在 GitHub Actions 手动运行 [`.github/workflows/deploy-production.yml`](.github/workflows/deploy-production.yml)
4. workflow 自动 SSH 到服务器，执行 `deploy/remote-deploy.sh`
5. 服务器执行 `docker compose pull && docker compose up -d`

这个 workflow 支持两种部署输入：

- `latest`：部署 `main` 的稳定版本
- `sha-<github-commit-sha>`：部署某个精确镜像版本，也可用于回滚

### 2. 配置 CD Secrets

在 GitHub 仓库设置里再添加这些 Actions secrets：

- `DEPLOY_HOST=<your-server-ip>`
- `DEPLOY_USER=ubuntu`
- `DEPLOY_PORT=22`
- `DEPLOY_SSH_PRIVATE_KEY=<deploy-private-key>`
- `DEPLOY_SSH_KNOWN_HOSTS=<pinned-known-hosts-line>`

`DEPLOY_PORT` 可选；如果不填，workflow 默认用 `22`。

### 3. 生成 deploy SSH key

建议专门为 GitHub Actions 生成一对部署密钥，不要复用你自己的开发机私钥：

```bash
ssh-keygen -t ed25519 -C "github-actions-hahabot-deploy" -f ~/.ssh/hahabot_deploy
```

会得到：

- 私钥：`~/.ssh/hahabot_deploy`
- 公钥：`~/.ssh/hahabot_deploy.pub`

把私钥完整内容保存到 GitHub Secret `DEPLOY_SSH_PRIVATE_KEY`。

### 4. 配置服务器 SSH 和已知主机

把公钥追加到服务器：

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
cat ~/.ssh/hahabot_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

生成 pinned host key，用于 GitHub Secret `DEPLOY_SSH_KNOWN_HOSTS`：

```bash
ssh-keyscan -H <your-server-ip>
```

把输出的整行保存为 `DEPLOY_SSH_KNOWN_HOSTS`，不要在 workflow 运行时动态 `ssh-keyscan`。

### 5. 准备服务器

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

首次同步仓库后，还要保证这些部署资产已经在服务器目录里：

- `deploy.sh`
- `deploy/deploy.sh`
- `deploy/remote-deploy.sh`
- `docker-compose.yml`

如果服务器不是 git checkout，而是之前手工同步的代码快照，也要先把这些文件同步上去一次。

### 6. 配置服务器运行环境

服务器端直接执行：

```bash
chmod +x deploy.sh deploy/deploy.sh
chmod +x deploy/remote-deploy.sh
```

`.env` 推荐配置：

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

### 7. 首次部署

首次部署可以先在服务器上手工执行一次：

```bash
./deploy.sh
```

`deploy.sh` 会做这几件事：

- 检查 `.env` 和 `docker-compose.yml`
- 执行 `docker compose pull`
- 执行 `docker compose up -d`
- 对 `http://localhost/api/sessions` 做 smoke check

后端容器启动时会自动执行 `alembic upgrade head`，所以数据库迁移会在部署过程中自动应用。

### 8. 为 GitHub Actions 配置无密码 sudo

`deploy-production.yml` 在服务器上执行的是：

```bash
sudo /home/ubuntu/hahabot/deploy/remote-deploy.sh <image_tag>
```

所以服务器需要给 `ubuntu` 用户一条受限的无密码 sudo 规则，例如：

```bash
sudo visudo -f /etc/sudoers.d/hahabot-deploy
```

写入：

```text
ubuntu ALL=(root) NOPASSWD: /home/ubuntu/hahabot/deploy/remote-deploy.sh *
```

保存后执行：

```bash
sudo chmod 440 /etc/sudoers.d/hahabot-deploy
```

### 9. 手动触发 CD

在 GitHub 仓库中打开 `Actions` -> `Deploy Production` -> `Run workflow`。

`image_tag` 的常见填法：

- `latest`
- `sha-<40位commit sha>`

workflow 会先在 runner 本地校验 tag，然后再 SSH 到服务器更新 `.env` 中的 `IMAGE_TAG`，并执行远程部署和镜像校验。

### 10. 验收

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

### 11. 更新部署

如果使用 GitHub Actions CD，日常更新不需要再手动 SSH 到服务器。

如果你只想部署 `main` 上最新的稳定版本，在 `Deploy Production` workflow 里填：

- `image_tag=latest`

如果要部署某个精确镜像版本或回滚，在 workflow 里填：

- `image_tag=sha-<github-commit-sha>`

只有在初始化、排障或同步部署脚本时，才需要再登录服务器。

### 12. 回滚

回滚方式就是重新手动触发 `Deploy Production`，把 `image_tag` 改成之前的 `sha-...`。

停止服务：

```bash
docker compose down
```

### 说明

- 前端通过 Nginx 代理 `/api` 到后端，也支持 SSE 流式响应。
- 现在服务器不会本地构建镜像，而是直接从 Docker Hub 拉取镜像部署。
- 正常发布走 GitHub Actions 手动 CD，不需要日常登录服务器。
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

### CI: Docker Image Publishing

GitHub Actions publishes application images to Docker Hub:

- `zhouhahaai/hahabot-frontend`
- `zhouhahaai/hahabot-backend`

PostgreSQL continues to run from the official `postgres:16-alpine` image.

Only pushes to `main` refresh the `latest` tag. Other branch pushes or manual runs publish `sha-<commit>` tags for explicit deployments.

### 1. Configure CI Secrets

Add these Actions secrets in the GitHub repository settings:

- `DOCKERHUB_USERNAME=zhouhahaai`
- `DOCKERHUB_TOKEN=<docker-hub-access-token>`

The workflow at [`.github/workflows/docker-publish.yml`](.github/workflows/docker-publish.yml) publishes the images.

### CD: Manual Production Deploys

Production deploys no longer require you to SSH into the server for routine releases. The flow is:

1. push code to `main`
2. GitHub Actions publishes images
3. manually run [`.github/workflows/deploy-production.yml`](.github/workflows/deploy-production.yml)
4. the workflow SSHes into the server and runs `deploy/remote-deploy.sh`
5. the server runs `docker compose pull && docker compose up -d`

Supported `image_tag` values:

- `latest` for the stable `main` release
- `sha-<github-commit-sha>` for exact releases or rollbacks

### 2. Configure CD Secrets

Add these repository secrets for CD:

- `DEPLOY_HOST=<your-server-ip>`
- `DEPLOY_USER=ubuntu`
- `DEPLOY_PORT=22`
- `DEPLOY_SSH_PRIVATE_KEY=<deploy-private-key>`
- `DEPLOY_SSH_KNOWN_HOSTS=<pinned-known-hosts-line>`

`DEPLOY_PORT` is optional; the workflow defaults to `22`.

### 3. Generate a Deploy SSH Key

Create a dedicated deploy key instead of reusing a personal SSH key:

```bash
ssh-keygen -t ed25519 -C "github-actions-hahabot-deploy" -f ~/.ssh/hahabot_deploy
```

Store the private key contents in `DEPLOY_SSH_PRIVATE_KEY`.

### 4. Install the Public Key and Known Host

Append the public key to the server:

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
cat ~/.ssh/hahabot_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

Generate the pinned host key entry:

```bash
ssh-keyscan -H <your-server-ip>
```

Save the full output line in `DEPLOY_SSH_KNOWN_HOSTS`. Do not `ssh-keyscan` during workflow runtime.

### 5. Prepare the Server

For first-time deployment:

```bash
git clone git@github.com:zhouhaha-ai/hahabot.git
cd hahabot
cp .env.example .env
```

Ensure these deploy assets exist on the server:

- `deploy.sh`
- `deploy/deploy.sh`
- `deploy/remote-deploy.sh`
- `docker-compose.yml`

If the server directory is an older code snapshot instead of a git checkout, sync these files once before using CD.

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

### 6. Configure the Server Runtime

Run on the server:

```bash
chmod +x deploy.sh deploy/deploy.sh
chmod +x deploy/remote-deploy.sh
```

### 7. First Deployment

For the initial bootstrap, run once on the server:

```bash
./deploy.sh
```

`deploy.sh` will:

- validate `.env` and `docker-compose.yml`
- run `docker compose pull`
- run `docker compose up -d`
- smoke-check `http://localhost/api/sessions`

The backend container runs `alembic upgrade head` on startup, so schema migrations are applied automatically.

### 8. Configure Passwordless sudo for GitHub Actions

The deploy workflow runs:

```bash
sudo /home/ubuntu/hahabot/deploy/remote-deploy.sh <image_tag>
```

Create a dedicated sudoers rule:

```bash
sudo visudo -f /etc/sudoers.d/hahabot-deploy
```

Add:

```text
ubuntu ALL=(root) NOPASSWD: /home/ubuntu/hahabot/deploy/remote-deploy.sh *
```

Then:

```bash
sudo chmod 440 /etc/sudoers.d/hahabot-deploy
```

### 9. Run CD Manually

Open `Actions` -> `Deploy Production` -> `Run workflow`.

Common `image_tag` values:

- `latest`
- `sha-<40-char commit sha>`

The workflow validates the tag locally, SSHes into the server, updates `IMAGE_TAG`, runs the remote deploy helper, and verifies the running frontend/backend image tags.

### 10. Verification

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

### 11. Updating a Deployment

With CD configured, routine deploys should go through the `Deploy Production` workflow instead of manual SSH sessions.

Use:

- `image_tag=latest` to deploy the latest stable `main` release
- `image_tag=sha-<github-commit-sha>` to deploy a specific published image

### 12. Rollback

Rollback is the same workflow run with an older `sha-...` tag.

Stop the stack:

```bash
docker compose down
```

### Notes

- The frontend proxies `/api` to the backend through Nginx, including SSE responses.
- The server no longer builds images locally; it pulls published images from Docker Hub.
- Normal production releases use the manual GitHub Actions CD workflow.
- Secrets must stay in `.env` or server-side environment variables and must never be committed.
- In this coding environment, `docker` CLI is not available, so full container orchestration was not executed locally. Application tests, builds, and deployment scripts were verified separately.
