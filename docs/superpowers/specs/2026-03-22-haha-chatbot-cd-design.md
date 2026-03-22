# Haha Chatbot CD Design

## Overview

This spec adds a minimal production CD path for `haha-chatbot` on top of the existing CI image publishing flow.

The deployment flow will be:

1. Code is merged to `main`
2. GitHub Actions publishes Docker images to Docker Hub
3. A human manually triggers a deployment workflow in GitHub Actions
4. The deployment workflow connects to the Tencent Cloud server over SSH using a dedicated private key
5. The workflow updates the server-side `IMAGE_TAG` if needed and runs the existing `deploy.sh`
6. The server pulls Docker Hub images and restarts the stack with Docker Compose

The design deliberately preserves the current single-server deployment model and does not introduce a platform-specific deployment service.

## Goals

- Add a manual, repeatable CD flow that does not require logging into the server for each deployment
- Reuse the current `deploy.sh` contract instead of inventing a second deployment mechanism
- Support deploying either `latest` or an explicit `sha-<commit>` image tag
- Use SSH private key authentication rather than server passwords in GitHub Actions
- Make rollback possible by re-running the deploy workflow with an older `sha-...` tag

## Non-Goals

- Automatic deploy-on-push
- Multi-environment deployments such as `staging` and `production`
- Blue-green, canary, or rolling multi-node deployment
- Replacing Docker Compose with Kubernetes or TKE
- Rebuilding application images on the server
- Managing PostgreSQL backups or disaster recovery in this change

## Product Decisions

- CD is manual-trigger only
- Image publishing and deployment stay as separate workflows
- GitHub Actions authenticates to the server with a dedicated SSH key pair
- The server remains the execution point for `deploy.sh`
- The deployment workflow may optionally update `IMAGE_TAG` before invoking `deploy.sh`
- The existing server `.env` remains the source of truth for runtime secrets

## Current-State Constraints

The repository already has:

- a Docker Hub publishing workflow for frontend and backend images
- a pull-based deployment script at `deploy/deploy.sh`
- a single Tencent Cloud host running the application through Docker Compose
- Docker image tags with two modes:
  - `latest` for `main`
  - `sha-<commit>` for explicit builds

The CD design must fit into these existing constraints rather than replacing them.

## Target Architecture

The full delivery path becomes:

1. `docker-publish.yml` builds and pushes images
2. `deploy-production.yml` is manually triggered from GitHub Actions
3. `deploy-production.yml` opens an SSH session to the server
4. Remote commands:
   - change into `/home/ubuntu/hahabot`
   - update `.env` so `IMAGE_TAG` matches the workflow input
   - run `./deploy.sh`
   - print deployment verification output

The server still runs:

- `frontend` from Docker Hub
- `backend` from Docker Hub
- `postgres` from official Docker Hub

## Workflow Design

### Existing CI Workflow

`docker-publish.yml` remains responsible only for publishing images.

Responsibilities:

- authenticate to Docker Hub
- build backend and frontend images
- push `latest` on `main`
- push `sha-<commit>` tags for explicit versioning

It will not SSH to the server or deploy.

### New CD Workflow

A new workflow, tentatively `deploy-production.yml`, will be added.

Trigger:

- `workflow_dispatch` only

Inputs:

- `image_tag`
  - default: `latest`
  - also supports `sha-<github-commit-sha>`

Secrets:

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_PORT` optional, default `22`
- `DEPLOY_SSH_PRIVATE_KEY`

Execution steps:

1. Check out the repository for access to deployment scripts and context
2. Start an SSH agent and load `DEPLOY_SSH_PRIVATE_KEY`
3. Add the server host to known hosts
4. SSH to the server
5. Update `/home/ubuntu/hahabot/.env` so `IMAGE_TAG=<workflow input>`
6. Run `/home/ubuntu/hahabot/deploy.sh`
7. Print `docker compose ps`
8. On failure, print recent backend/frontend logs

## SSH Key Strategy

The deployment uses a dedicated SSH key pair created specifically for GitHub Actions.

Rules:

- The private key is stored only in GitHub Actions secret `DEPLOY_SSH_PRIVATE_KEY`
- The public key is appended to `/home/ubuntu/.ssh/authorized_keys`
- This key is not reused for local development or personal admin access
- If the key must be revoked, removing its public half from `authorized_keys` is sufficient

This keeps password-based SSH out of the CD path.

## Server Requirements

The server must already contain a working project directory:

- `/home/ubuntu/hahabot`

Required files:

- `.env`
- `docker-compose.yml`
- `deploy.sh`
- `deploy/deploy.sh`

Required server-side assumptions:

- Docker Engine and Docker Compose plugin are installed
- the `ubuntu` user can SSH in
- `deploy.sh` can complete either through direct Docker access or via `sudo`
- the current runtime secrets remain in `.env`

The CD workflow does not recreate the project directory. It assumes the server was bootstrapped once already.

## Remote Command Contract

The deployment workflow must keep the remote command set narrow and predictable.

Allowed remote actions:

- edit the `IMAGE_TAG` line in `/home/ubuntu/hahabot/.env`
- run `/home/ubuntu/hahabot/deploy.sh`
- inspect `docker compose ps`
- inspect `docker compose logs --tail=...`

It should not:

- mutate unrelated files
- rebuild images locally
- rewrite other runtime secrets
- destroy PostgreSQL volumes

## Deployment Semantics

### Deploying `latest`

Used for normal production releases from `main`.

Flow:

- CI publishes `latest`
- human triggers CD with `image_tag=latest`
- server runs `deploy.sh` and pulls the current stable images

### Deploying `sha-<commit>`

Used for:

- explicit QA validation
- emergency rollback
- pinning a release to an exact build

Flow:

- CI publishes `sha-<commit>`
- human triggers CD with that exact tag
- server rewrites `.env` to that tag and redeploys

## Failure Handling

If remote deployment fails:

- the GitHub Actions job fails visibly
- the workflow prints `docker compose ps`
- the workflow prints recent `backend` and `frontend` logs

This should provide enough first-pass debugging context without requiring immediate SSH access.

If `deploy.sh` fails because the app is still warming up, the workflow still fails, which is acceptable for the first version. Retrying the workflow remains the human-controlled recovery path.

## Rollback Strategy

Rollback uses the same manual deployment workflow.

Procedure:

1. Identify a previously published `sha-<commit>` image tag
2. Trigger `deploy-production.yml`
3. Enter that tag as `image_tag`
4. Let the workflow update `.env` and rerun `deploy.sh`

No separate rollback script is needed.

## Security Considerations

- Server passwords must not be used in GitHub Actions
- Runtime secrets remain on the server in `.env`, not in GitHub Actions workflow inputs
- The deploy SSH key should be scoped to server access only
- The workflow should avoid echoing secrets or full `.env` contents
- Docker Hub credentials remain in the existing CI workflow, not the CD workflow

## Testing and Verification

The implementation should be validated at three levels:

### Local Static Verification

- YAML syntax check for the new workflow
- shell syntax check for any deployment script edits
- repository diff check for malformed patches

### Workflow Validation

- manual `workflow_dispatch` dry run against the real repository configuration
- successful SSH authentication using the deploy key
- successful remote invocation of `deploy.sh`

### Production Acceptance

- `GET /api/sessions` returns `200`
- `docker compose ps` shows healthy running services
- at least one SSE chat request succeeds after deployment

## Open Questions Resolved

- Trigger mode: manual only
- Authentication mode: SSH private key
- Deployment action: SSH to server, then run server-side pull-based deployment
- Server interaction after setup: no regular manual SSH required for routine releases

## Scope Boundary for Planning

Implementation planning should cover:

- generating and documenting the deploy SSH key setup
- adding the manual deployment workflow
- updating README and deployment docs
- verifying the workflow against the current server layout

Implementation planning should not expand into:

- infrastructure as code
- multi-server orchestration
- secret rotation tooling
- database backup automation
