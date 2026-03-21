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

- `QWEN_API_KEY`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `DATABASE_URL`

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

## Docker Run

Start the full stack:

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
- Secrets must stay in `.env` or server environment variables and must not be committed.
- In the current coding environment, `docker` CLI is not installed, so Docker build commands were not executable here. Frontend and backend application tests were verified separately.
