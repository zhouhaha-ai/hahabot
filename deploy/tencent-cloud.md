# Tencent Cloud Deployment

## Server

- Host: `<your-server-ip>`
- User: `ubuntu`

Keep credentials outside this repository. If any password or API key has been shared in chat or elsewhere, rotate it before production deployment.

## First-Time Setup

Install Docker Engine and Docker Compose plugin on the server before deploying. Then clone the repository:

```bash
ssh ubuntu@<your-server-ip>
git clone git@github.com:zhouhaha-ai/hahabot.git
cd hahabot
```

Create the runtime environment file:

```bash
cp .env.example .env
```

Edit `.env` and set:

- `DOCKERHUB_NAMESPACE`
- `IMAGE_TAG`
- `QWEN_API_KEY`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `DATABASE_URL`

Recommended image settings:

```text
DOCKERHUB_NAMESPACE=zhouhaha
IMAGE_TAG=latest
```

Use `latest` for mainline deployments. For a branch or one-off release, set `IMAGE_TAG=sha-<github-commit-sha>`.

Recommended container-side database URL:

```text
DATABASE_URL=postgresql+psycopg://postgres:postgres@postgres:5432/haha_chatbot
```

## Publish Images

GitHub Actions publishes two application images to Docker Hub on pushes to `main`, pushes to `codex/haha-chatbot`, and manual workflow dispatches:

- `zhouhaha/hahabot-frontend`
- `zhouhaha/hahabot-backend`

Required GitHub repository secrets:

- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`

The database continues to run from the official `postgres:16-alpine` image.
Only pushes to `main` refresh the `latest` tag. Other workflow runs publish `sha-<commit>` tags for explicit deployment.

## Start the Stack

On the server:

```bash
chmod +x deploy.sh deploy/deploy.sh
./deploy.sh
```

Open the app in a browser:

```text
http://<your-server-ip>/
```

## Update Deployment

After new images have been published, rerun:

```bash
./deploy.sh
```

If the server is using a git checkout, a typical update is:

```bash
git pull
./deploy.sh
```

If you need to deploy a specific image revision, override `IMAGE_TAG` before running:

```bash
IMAGE_TAG=sha-<github-commit-sha> ./deploy.sh
```

## Operational Checks

Smoke-check the proxied API:

```bash
curl http://localhost/api/sessions
```

Tail logs when debugging:

```bash
docker compose logs -f frontend
docker compose logs -f backend
docker compose logs -f postgres
```

## Stable Deployment Script

The repository includes a root entrypoint [`deploy.sh`](/Users/zhouhaha/Desktop/haha-bot/.worktrees/codex-haha-chatbot/deploy.sh) backed by [`deploy/deploy.sh`](/Users/zhouhaha/Desktop/haha-bot/.worktrees/codex-haha-chatbot/deploy/deploy.sh). It:

- verifies `.env` and `docker-compose.yml` exist
- verifies `DOCKERHUB_NAMESPACE` exists in `.env`
- uses `docker compose` directly when it works, otherwise falls back to `sudo docker compose`
- pulls the latest configured images and restarts the stack
- checks `docker compose ps`
- smoke-checks `http://localhost/api/sessions`

## Rollback / Stop

```bash
docker compose down
```

Use `docker compose down -v` only if you explicitly intend to remove PostgreSQL data.
