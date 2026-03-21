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

- `QWEN_API_KEY`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `DATABASE_URL`

Recommended container-side database URL:

```text
DATABASE_URL=postgresql+psycopg://postgres:postgres@postgres:5432/haha_chatbot
```

## Start the Stack

```bash
chmod +x deploy.sh deploy/deploy.sh
./deploy.sh
```

Open the app in a browser:

```text
http://<your-server-ip>/
```

## Update Deployment

After syncing new code onto the server, rerun:

```bash
./deploy.sh
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
- uses `docker compose` directly when available, otherwise falls back to `sudo docker compose`
- rebuilds and restarts the stack
- checks `docker compose ps`
- smoke-checks `http://localhost/api/sessions`

## Rollback / Stop

```bash
docker compose down
```

Use `docker compose down -v` only if you explicitly intend to remove PostgreSQL data.
