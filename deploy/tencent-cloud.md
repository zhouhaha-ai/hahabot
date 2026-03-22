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
DOCKERHUB_NAMESPACE=zhouhahaai
IMAGE_TAG=latest
```

Use `latest` for mainline deployments. For a branch or one-off release, set `IMAGE_TAG=sha-<github-commit-sha>`.

Recommended container-side database URL:

```text
DATABASE_URL=postgresql+psycopg://postgres:postgres@postgres:5432/haha_chatbot
```

Ensure these deploy assets exist on the server before enabling CD:

- `deploy.sh`
- `deploy/deploy.sh`
- `deploy/remote-deploy.sh`
- `docker-compose.yml`

## Publish Images

GitHub Actions publishes two application images to Docker Hub on pushes to `main`, pushes to `codex/haha-chatbot`, and manual workflow dispatches:

- `zhouhahaai/hahabot-frontend`
- `zhouhahaai/hahabot-backend`

Required GitHub repository secrets:

- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`

The database continues to run from the official `postgres:16-alpine` image.
Only pushes to `main` refresh the `latest` tag. Other workflow runs publish `sha-<commit>` tags for explicit deployment.

## Bootstrap Manual CD

### 1. Create a Deploy SSH Key

Generate a dedicated key pair for GitHub Actions:

```bash
ssh-keygen -t ed25519 -C "github-actions-hahabot-deploy" -f ~/.ssh/hahabot_deploy
```

Use:

- `~/.ssh/hahabot_deploy` as `DEPLOY_SSH_PRIVATE_KEY`
- `~/.ssh/hahabot_deploy.pub` for the server `authorized_keys`

### 2. Install the Public Key

On the server:

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
cat ~/.ssh/hahabot_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### 3. Pin the SSH Host Key

Generate the exact known-hosts line locally:

```bash
ssh-keyscan -H <your-server-ip>
```

Save the full output line as the repository secret `DEPLOY_SSH_KNOWN_HOSTS`.
Do not run `ssh-keyscan` inside the workflow.

### 4. Add GitHub CD Secrets

Add these repository secrets:

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_PORT` (optional, defaults to `22`)
- `DEPLOY_SSH_PRIVATE_KEY`
- `DEPLOY_SSH_KNOWN_HOSTS`

### 5. Configure Passwordless sudo

GitHub Actions deploys by running:

```bash
sudo /home/ubuntu/hahabot/deploy/remote-deploy.sh <image_tag>
```

Install a dedicated sudoers rule:

```bash
sudo visudo -f /etc/sudoers.d/hahabot-deploy
```

Contents:

```text
ubuntu ALL=(root) NOPASSWD: /home/ubuntu/hahabot/deploy/remote-deploy.sh *
```

Then lock down permissions:

```bash
sudo chmod 440 /etc/sudoers.d/hahabot-deploy
```

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

Routine releases should use the GitHub Actions workflow `Deploy Production`.

When you run it manually, provide one of these tags:

- `latest`
- `sha-<github-commit-sha>`

The workflow validates the tag locally, SSHes into the server, updates `.env`, runs `deploy/remote-deploy.sh`, and verifies the running frontend/backend image refs.

Manual server-side `./deploy.sh` is still useful for first-time bootstrap and emergency debugging.

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

The repository includes a root entrypoint [`deploy.sh`](../deploy.sh) backed by [`deploy/deploy.sh`](./deploy.sh). It:

- verifies `.env` and `docker-compose.yml` exist
- verifies `DOCKERHUB_NAMESPACE` exists in `.env`
- uses `docker compose` directly when it works, otherwise falls back to `sudo docker compose`
- pulls the latest configured images and restarts the stack
- checks `docker compose ps`
- smoke-checks `http://localhost/api/sessions`

The CD workflow additionally uses [`deploy/remote-deploy.sh`](./remote-deploy.sh) to:

- validate the requested image tag
- update `.env` idempotently
- invoke `deploy.sh`
- print `docker compose ps`
- verify the running frontend/backend containers use the requested image tag
- print backend/frontend logs when deployment fails

## Rollback / Stop

To roll back, run `Deploy Production` again with an older `sha-...` image tag.

To stop the stack manually:

```bash
docker compose down
```

Use `docker compose down -v` only if you explicitly intend to remove PostgreSQL data.
