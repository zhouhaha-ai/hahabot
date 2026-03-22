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
- The deployment workflow persistently updates the server-side `.env` `IMAGE_TAG` before invoking `deploy.sh`
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
3. `deploy-production.yml` validates the requested `image_tag` locally in the GitHub Actions runner before constructing any SSH command
4. `deploy-production.yml` opens an SSH session to the server only after validation succeeds
5. Remote commands:
   - change into `/home/ubuntu/hahabot`
   - persistently update `.env` so `IMAGE_TAG` matches the workflow input
   - run `./deploy.sh`
   - print deployment verification output, using the same Docker permission model as `deploy.sh`

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
  - also supports `sha-<40-char-github-commit-sha>`

Secrets:

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_PORT` optional, default `22`
- `DEPLOY_SSH_PRIVATE_KEY`
- `DEPLOY_SSH_KNOWN_HOSTS`

Execution steps:

1. Validate `image_tag` locally in the workflow runner
2. Start an SSH agent and load `DEPLOY_SSH_PRIVATE_KEY`
3. Write the pinned host entry from `DEPLOY_SSH_KNOWN_HOSTS` into `known_hosts`
4. Do not use runtime `ssh-keyscan`; host verification is pinned through secret-managed known-host data
5. SSH to the server
6. Update `/home/ubuntu/hahabot/.env` so `IMAGE_TAG=<workflow input>`
7. Run `/home/ubuntu/hahabot/deploy.sh`
8. Print `docker compose ps`
9. On failure, print recent backend/frontend logs

`image_tag` validation rules:

- allow `latest`
- allow `sha-` followed by exactly 40 lowercase hexadecimal characters
- reject everything else before any SSH deployment command is constructed

`.env` update rules:

- if `IMAGE_TAG=` already exists, replace that line in place
- if `IMAGE_TAG=` does not exist, append it exactly once
- the operation must be idempotent so repeated deploys with the same tag do not create duplicates

## SSH Key Strategy

The deployment uses a dedicated SSH key pair created specifically for GitHub Actions.

Rules:

- The private key is stored only in GitHub Actions secret `DEPLOY_SSH_PRIVATE_KEY`
- The server host key entry is stored only in GitHub Actions secret `DEPLOY_SSH_KNOWN_HOSTS`
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
- the deploy user can run the required Docker Compose diagnostics non-interactively, either through direct Docker access or passwordless `sudo docker compose`
- `deploy.sh` can complete either through direct Docker access or via `sudo`
- `curl` is installed on the server because `deploy.sh` requires it
- `.env` contains a valid `DOCKERHUB_NAMESPACE` entry because `deploy.sh` requires it
- the current runtime secrets remain in `.env`

The CD workflow does not recreate the project directory. It assumes the server was bootstrapped once already.
Keeping `/home/ubuntu/hahabot` current with repository changes remains a manual operational prerequisite for this first CD version. The workflow assumes the server copy of `deploy.sh`, `deploy/deploy.sh`, and `docker-compose.yml` has already been synchronized with the repository before routine no-SSH releases begin.

## Remote Command Contract

The deployment workflow must keep the remote command set narrow and predictable.

Allowed remote actions:

- edit the `IMAGE_TAG` line in `/home/ubuntu/hahabot/.env`
- run `/home/ubuntu/hahabot/deploy.sh`
- inspect `docker compose ps`, using the same Docker permission behavior as `deploy.sh`
- inspect `docker compose logs --tail=...`, using the same Docker permission behavior as `deploy.sh`

It should not:

- mutate unrelated files
- rebuild images locally
- rewrite other runtime secrets
- destroy PostgreSQL volumes

If `IMAGE_TAG` is missing in `.env`, the workflow must create it instead of failing.

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
- server persistently rewrites `.env` to that tag and redeploys

## Failure Handling

If remote deployment fails:

- the GitHub Actions job fails visibly
- the workflow prints `docker compose ps`, using the same Docker permission model as `deploy.sh`
- the workflow prints recent `backend` and `frontend` logs, using the same Docker permission model as `deploy.sh`

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

- manual `workflow_dispatch` validation run against the real repository configuration
- successful SSH authentication using the deploy key
- successful remote invocation of `deploy.sh`

### Production Acceptance

- `GET /api/sessions` returns `200`
- `docker compose ps` shows healthy running services
- the server-side `.env` contains the requested `IMAGE_TAG`
- `docker inspect` output shows the deployed frontend and backend containers using the requested image tag
- at least one direct SSE chat request succeeds after deployment by creating a fresh session and posting a one-line prompt such as `请只回复OK`

## Open Questions Resolved

- Trigger mode: manual only
- Authentication mode: SSH private key
- Deployment action: SSH to server, then run server-side pull-based deployment
- Server interaction after setup: no regular manual SSH required for routine releases, except when the server checkout or deploy assets must be manually synchronized

## Scope Boundary for Planning

Implementation planning should cover:

- generating and documenting the deploy SSH key setup
- adding the manual deployment workflow
- updating README and deployment docs
- verifying the workflow against the current server layout

Server bootstrap and keeping the server checkout current remain manual and are out of scope for this change.

Implementation planning should not expand into:

- infrastructure as code
- multi-server orchestration
- secret rotation tooling
- database backup automation
