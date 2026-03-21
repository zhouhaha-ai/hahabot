# Tencent Cloud Deployment

## Server

- Host: `175.24.135.179`
- User: `ubuntu`

Keep credentials outside this repository. If any password or API key has been shared in chat or elsewhere, rotate it before production deployment.

## First-Time Setup

Install Docker Engine and Docker Compose plugin on the server before deploying. Then clone the repository:

```bash
ssh ubuntu@175.24.135.179
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
docker compose up --build -d
docker compose ps
```

Open the app in a browser:

```text
http://175.24.135.179/
```

## Update Deployment

```bash
git pull
docker compose up --build -d
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

## Rollback / Stop

```bash
docker compose down
```

Use `docker compose down -v` only if you explicitly intend to remove PostgreSQL data.
