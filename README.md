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

On the server, deploy by pulling images and starting the stack:

```bash
chmod +x deploy.sh deploy/deploy.sh
./deploy.sh
```

Check the session API through the Nginx proxy:

```bash
curl http://localhost/api/sessions
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
