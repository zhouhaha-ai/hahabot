# haha-chatbot

Simple full-stack chatbot with React, FastAPI, PostgreSQL, and SSE streaming. Session memory is scoped to the current chat session and persists across page refreshes; cross-session memory is intentionally disabled.

## Stack

- Frontend: React 18 + TypeScript + Vite
- Backend: FastAPI + SQLAlchemy + Alembic
- Database: PostgreSQL
- Streaming: POST + `text/event-stream`
- Deployment: Docker Compose + Nginx

## Environment

Create a local `.env` from `.env.example`:

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

Use `latest` for mainline deployments. For a branch or one-off release, set `IMAGE_TAG=sha-<github-commit-sha>`.

## Local Development

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

## Docker Deploy

GitHub Actions publishes the application images to Docker Hub:

- `zhouhahaai/hahabot-frontend`
- `zhouhahaai/hahabot-backend`

The PostgreSQL container continues to use the official `postgres:16-alpine` image from Docker Hub.
Only pushes to `main` refresh the `latest` tag. Other workflow runs publish `sha-<commit>` tags for explicit deployment.

### 1. Configure GitHub Secrets

In the GitHub repository settings, add these Actions secrets:

- `DOCKERHUB_USERNAME=zhouhahaai`
- `DOCKERHUB_TOKEN=<docker-hub-access-token>`

After that, the workflow at [.github/workflows/docker-publish.yml](/Users/zhouhaha/Desktop/haha-bot/.worktrees/codex-haha-chatbot/.github/workflows/docker-publish.yml) will publish:

- `zhouhahaai/hahabot-frontend:latest`
- `zhouhahaai/hahabot-backend:latest`

when `main` is updated, plus `sha-<commit>` tags for explicit deployments.

### 2. Prepare the Server

Clone the repository onto the server and create the runtime `.env` file:

```bash
git clone git@github.com:zhouhaha-ai/hahabot.git
cd hahabot
cp .env.example .env
```

Set these values in `.env`:

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

`latest` is the stable deployment channel from `main`. If you need to deploy an exact build, replace it with `IMAGE_TAG=sha-<github-commit-sha>`.

### 3. First Deployment

On the server, deploy by pulling images and starting the stack:

```bash
chmod +x deploy.sh deploy/deploy.sh
./deploy.sh
```

`deploy.sh` does four things:

- validates `.env` and `docker-compose.yml`
- runs `docker compose pull`
- runs `docker compose up -d`
- smoke-checks `http://localhost/api/sessions`

The backend container runs `alembic upgrade head` on startup, so database migrations are applied automatically during deployment.

### 4. Verification

Check the session API through the Nginx proxy:

```bash
curl http://localhost/api/sessions
```

Check the running containers:

```bash
docker compose ps
```

If you want to inspect logs:

```bash
docker compose logs -f frontend
docker compose logs -f backend
docker compose logs -f postgres
```

### 5. Update an Existing Deployment

If you are deploying the latest version from `main`:

```bash
git pull
./deploy.sh
```

If you want to deploy a specific GitHub Actions image build:

```bash
sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=sha-<github-commit-sha>/' .env
./deploy.sh
```

### 6. Roll Back

To roll back, set `.env` back to a previous `IMAGE_TAG=sha-...` and redeploy:

```bash
./deploy.sh
```

Stop the stack:

```bash
docker compose down
```

## Notes

- The frontend proxies `/api` to the backend through Nginx, including SSE chat responses.
- `deploy.sh` now runs `docker compose pull` and `docker compose up -d`; it does not build images on the server.
- The backend container runs `alembic upgrade head` on startup, so schema migrations apply during deployment.
- Secrets must stay in `.env` or server environment variables and must not be committed.
- In the current coding environment, `docker` CLI is not installed, so Docker build commands were not executable here. Frontend and backend application tests were verified separately.
