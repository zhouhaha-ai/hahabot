# Haha Chatbot CD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a manual GitHub Actions CD workflow that SSHes to the Tencent Cloud server, updates `IMAGE_TAG`, runs the existing pull-based deployment script, and verifies the requested Docker image version is live.

**Architecture:** Reuse the existing Docker Hub publishing pipeline and server-side `deploy.sh`. Add one manual `workflow_dispatch` deployment workflow, a small shell helper for remote tag updates and diagnostics, and documentation for the SSH key / GitHub secret bootstrap. The workflow validates `image_tag` locally, uses a pinned SSH host key, and executes a narrow remote command set against `/home/ubuntu/hahabot`.

**Tech Stack:** GitHub Actions, OpenSSH, Bash, Docker Compose, Docker Hub, existing `deploy.sh`

---

## File Structure

### Root

- Modify: `README.md` - document the manual CD workflow, required GitHub secrets, deploy key bootstrap, and manual release steps

### GitHub Actions

- Create: `.github/workflows/deploy-production.yml` - manual production deploy workflow using SSH private key auth and remote `deploy.sh`

### Deploy Helpers

- Create: `deploy/remote-deploy.sh` - server-side helper invoked over SSH to validate/update `IMAGE_TAG`, run `deploy.sh`, and emit diagnostics
- Create: `deploy/tests/test_remote_deploy.sh` - shell tests for `remote-deploy.sh`
- Modify: `deploy/tencent-cloud.md` - document deploy key generation, `authorized_keys`, `known_hosts`, and CD bootstrap

### Notes That Affect Buildability

- The deploy workflow must validate `image_tag` in the runner before constructing any SSH command.
- The workflow must use pinned host verification from `DEPLOY_SSH_KNOWN_HOSTS`; do not use runtime `ssh-keyscan`.
- The remote helper must update `.env` idempotently: replace `IMAGE_TAG=` if present, append it if missing.
- The remote helper must not print full `.env` contents or any secrets.
- Diagnostics should work with the same Docker permission model as `deploy.sh`; the first implementation should call the helper through `sudo /bin/bash ...` so Docker access is consistent.
- Production verification must confirm both service health and the actual deployed image tag.
- The first real workflow validation still depends on manually synchronizing `/home/ubuntu/hahabot` with the new deploy assets before relying on no-SSH routine releases.

## Task 1: Add a Remote Deployment Helper

**Files:**
- Create: `deploy/remote-deploy.sh`
- Create: `deploy/tests/test_remote_deploy.sh`

- [ ] **Step 1: Write the failing helper tests**

```bash
test_updates_existing_image_tag() {
  # .env contains IMAGE_TAG=latest
  # run helper setup/update path
  # assert .env now contains sha tag exactly once
}

test_appends_image_tag_if_missing() {
  # .env has no IMAGE_TAG
  # assert helper appends one IMAGE_TAG line
}

test_rejects_invalid_image_tag() {
  # helper exits non-zero for invalid input like '; rm -rf /'
}
```

- [ ] **Step 2: Run the helper test script to verify it fails**

Run: `bash deploy/tests/test_remote_deploy.sh`
Expected: FAIL because `deploy/remote-deploy.sh` does not exist yet.

- [ ] **Step 3: Implement the minimal remote helper**

Create a focused shell script that:

- requires `PROJECT_ROOT` or defaults to `/home/ubuntu/hahabot`
- requires one positional argument: `image_tag`
- validates `image_tag` against:
  - `latest`
  - `sha-[0-9a-f]{40}`
- replaces or appends `IMAGE_TAG=` in `.env`
- runs `deploy.sh`
- prints `docker compose ps`
- prints `docker inspect` image refs for frontend/backend containers
- on failure, prints recent backend/frontend logs

```bash
if [[ "$IMAGE_TAG" != "latest" && ! "$IMAGE_TAG" =~ ^sha-[0-9a-f]{40}$ ]]; then
  echo "Invalid image tag" >&2
  exit 1
fi
```

- [ ] **Step 4: Rerun the helper tests**

Run: `bash deploy/tests/test_remote_deploy.sh`
Expected: PASS

- [ ] **Step 5: Verify exact tag validation behavior**

Run:

```bash
bash deploy/remote-deploy.sh sha-123 >/tmp/remote-deploy-short.out 2>/tmp/remote-deploy-short.err || true
bash deploy/remote-deploy.sh sha-0123456789abcdef0123456789abcdef01234567 >/tmp/remote-deploy-valid.out 2>/tmp/remote-deploy-valid.err || true
```

Expected:

- the short tag is rejected with `Invalid image tag`
- the exact 40-char SHA tag passes validation and proceeds past the validation gate

- [ ] **Step 6: Run shell syntax verification**

Run: `bash -n deploy/remote-deploy.sh && bash -n deploy/tests/test_remote_deploy.sh`
Expected: no output, exit 0

- [ ] **Step 7: Commit the helper work**

```bash
git add deploy/remote-deploy.sh deploy/tests/test_remote_deploy.sh
git commit -m "feat: add remote deploy helper"
```

## Task 2: Add the Manual CD Workflow

**Files:**
- Create: `.github/workflows/deploy-production.yml`
- Test: `.github/workflows/deploy-production.yml`

- [ ] **Step 1: Write the failing workflow expectations as a checklist comment block**

Add a short checklist comment near the top of the workflow draft covering:

- `workflow_dispatch`
- `image_tag` input with default `latest`
- required secrets: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PORT`, `DEPLOY_SSH_PRIVATE_KEY`, `DEPLOY_SSH_KNOWN_HOSTS`
- local `image_tag` validation before SSH
- SSH agent setup
- pinned `known_hosts`
- remote helper invocation

- [ ] **Step 2: Validate that the workflow file is absent / incomplete**

Run: `test -f .github/workflows/deploy-production.yml`
Expected: exit non-zero before creating the workflow.

- [ ] **Step 3: Implement the deployment workflow**

Use GitHub Actions to:

- accept `image_tag` input
- validate it in a shell step before any SSH command
- start `ssh-agent`
- add the private key from `DEPLOY_SSH_PRIVATE_KEY`
- write `DEPLOY_SSH_KNOWN_HOSTS` into `~/.ssh/known_hosts`
- SSH to `${DEPLOY_USER}@${DEPLOY_HOST}` on `${DEPLOY_PORT:-22}`
- run `sudo /bin/bash /home/ubuntu/hahabot/deploy/remote-deploy.sh <image_tag>`

```yaml
on:
  workflow_dispatch:
    inputs:
      image_tag:
        description: Docker image tag to deploy
        required: true
        default: latest
```

- [ ] **Step 4: Run YAML validation**

Run: `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/deploy-production.yml"); puts "YAML OK"'`
Expected: `YAML OK`

- [ ] **Step 5: Verify workflow tag-validation logic**

Run: `rg -n "latest|sha-\\[0-9a-f\\]\\{40\\}|Invalid image tag|ssh" .github/workflows/deploy-production.yml`
Expected: validation logic appears before the SSH invocation step.

- [ ] **Step 6: Review the workflow for secret leakage**

Run: `sed -n '1,260p' .github/workflows/deploy-production.yml`
Expected: no command echoes secret values or full `.env` content.

- [ ] **Step 7: Commit the workflow**

```bash
git add .github/workflows/deploy-production.yml
git commit -m "feat: add manual production deploy workflow"
```

## Task 3: Document CD Bootstrap and Operations

**Files:**
- Modify: `README.md`
- Modify: `deploy/tencent-cloud.md`

- [ ] **Step 1: Write the failing docs checklist**

Add a temporary checklist in your notes for required doc updates:

- deploy SSH key generation
- `authorized_keys` installation
- `DEPLOY_SSH_KNOWN_HOSTS` generation
- optional `DEPLOY_PORT`
- GitHub CD secrets
- manual `Run workflow` steps
- exact rollback by `sha-...`
- server prerequisites: `curl`, passwordless Docker diagnostics path, synced deploy files

- [ ] **Step 2: Confirm the new CD docs are missing**

Run: `rg -n "DEPLOY_SSH_PRIVATE_KEY|DEPLOY_SSH_KNOWN_HOSTS|DEPLOY_PORT|deploy-production" README.md deploy/tencent-cloud.md`
Expected: no matches before the doc update.

- [ ] **Step 3: Update README**

Add a CD section that explains:

- CI vs CD separation
- required GitHub secrets for CD
- how to generate a deploy SSH key pair
- how to capture the pinned host key for `DEPLOY_SSH_KNOWN_HOSTS`
- how to set optional `DEPLOY_PORT` with default `22`
- how to manually run the deploy workflow
- how to deploy `latest`
- how to deploy / roll back to `sha-...`

- [ ] **Step 4: Update the Tencent deployment guide**

Document the one-time server bootstrap:

- append deploy public key to `~/.ssh/authorized_keys`
- add optional `DEPLOY_PORT` guidance if the host does not use `22`
- ensure `/home/ubuntu/hahabot` contains the latest `deploy.sh`, `deploy/deploy.sh`, `deploy/remote-deploy.sh`, and `docker-compose.yml`
- ensure `curl` exists
- ensure the deploy user can run the required Docker commands non-interactively

- [ ] **Step 5: Run documentation search verification**

Run: `rg -n "DEPLOY_SSH_PRIVATE_KEY|DEPLOY_SSH_KNOWN_HOSTS|DEPLOY_PORT|deploy-production|remote-deploy" README.md deploy/tencent-cloud.md`
Expected: matches for all new CD concepts.

- [ ] **Step 6: Commit the documentation**

```bash
git add README.md deploy/tencent-cloud.md
git commit -m "docs: add cd bootstrap instructions"
```

## Task 4: Verify the Full CD Path and Server Expectations

**Files:**
- Modify: `README.md` if any verification caveats are discovered
- Modify: `deploy/tencent-cloud.md` if any server prerequisite wording is incomplete

- [ ] **Step 1: Run the local verification bundle**

Run:

```bash
bash -n deploy/remote-deploy.sh
bash -n deploy/tests/test_remote_deploy.sh
bash deploy/tests/test_remote_deploy.sh
ruby -e 'require "yaml"; YAML.load_file(".github/workflows/deploy-production.yml"); puts "YAML OK"'
git diff --check
```

Expected:

- shell syntax checks pass
- helper tests pass
- workflow YAML parses
- no whitespace / patch issues

- [ ] **Step 2: Manually synchronize the server deploy assets**

Copy the updated deploy assets to `/home/ubuntu/hahabot` before the first workflow validation:

- `deploy.sh`
- `deploy/deploy.sh`
- `deploy/remote-deploy.sh`
- `docker-compose.yml`

Expected: the server checkout contains the same deploy scripts and compose file the workflow will call.

- [ ] **Step 3: Verify server prerequisites explicitly**

Run on the server:

```bash
cd /home/ubuntu/hahabot
test -f .env
grep '^DOCKERHUB_NAMESPACE=' .env
command -v curl
sudo docker compose ps >/dev/null
```

Expected:

- `.env` exists
- `DOCKERHUB_NAMESPACE` is set
- `curl` is installed
- Docker Compose diagnostics work non-interactively

- [ ] **Step 4: Push the working branch**

```bash
git push origin <working-branch>
```

- [ ] **Step 5: Configure GitHub CD secrets manually**

Set in repository settings:

- `DEPLOY_HOST`
- `DEPLOY_USER`
- optional `DEPLOY_PORT` with default `22`
- `DEPLOY_SSH_PRIVATE_KEY`
- `DEPLOY_SSH_KNOWN_HOSTS`

Expected: secrets exist before the first workflow run.

- [ ] **Step 6: Manually publish the branch images if the branch is not auto-published by CI**

If the working branch is not one of the branches matched by `docker-publish.yml`, manually trigger `docker-publish.yml` with `workflow_dispatch` for that branch.
Expected: the branch produces a publishable `sha-<40-char-commit-sha>` image tag before the first CD validation.

- [ ] **Step 7: Wait for branch image publish and record the exact SHA tag**

After pushing the branch, confirm `docker-publish.yml` completed successfully for that branch and note the published tag:

```text
sha-<40-char-commit-sha>
```

Expected: the exact branch image tag exists before the first CD run.

- [ ] **Step 8: Perform the first manual workflow validation run from the branch using the published SHA tag**

Run the GitHub Actions workflow with `image_tag=sha-<40-char-commit-sha>`.
Expected:

- SSH login succeeds
- remote helper runs
- deployment job passes

- [ ] **Step 9: Verify exact-tag deployment effects**

Run:

```bash
ssh <deploy-user>@<server> "cd /home/ubuntu/hahabot && grep '^IMAGE_TAG=' .env && sudo docker inspect hahabot-backend-1 hahabot-frontend-1 --format '{{.Config.Image}}'"
```

Expected:

- server `.env` contains that exact `IMAGE_TAG`
- `docker inspect` for frontend/backend containers shows images with that exact tag

- [ ] **Step 10: Merge to `main` only after branch validation succeeds**

```bash
git checkout main
git merge --no-ff <working-branch>
git push origin main
```

- [ ] **Step 11: Wait for `main` image publish to complete**

Confirm `docker-publish.yml` succeeded on `main` and that `latest` has been refreshed in Docker Hub.
Expected: production deploy will target a newly published `latest`, not a stale one.

- [ ] **Step 12: Run the production deploy workflow with `image_tag=latest`**

Trigger `deploy-production.yml` manually from `main`.
Expected:

- workflow succeeds
- server updates to the latest stable images

- [ ] **Step 13: Perform the post-deploy production acceptance checks**

Run:

```bash
curl http://<server>/api/sessions
```

Inspect container health:

```bash
ssh <deploy-user>@<server> "cd /home/ubuntu/hahabot && sudo docker compose ps"
```

Create a fresh session ID:

```bash
python3 - <<'PY'
import json, urllib.request
req = urllib.request.Request("http://<server>/api/sessions", data=b"{}", headers={"Content-Type": "application/json"}, method="POST")
with urllib.request.urlopen(req, timeout=20) as resp:
    print(json.load(resp)["id"])
PY
```

Run a direct SSE smoke check:

```bash
curl -N -X POST \
  -H 'Content-Type: application/json' \
  -d '{"message":"请只回复OK"}' \
  http://<server>/api/sessions/<captured-session-id>/messages/stream
```

Expected:

- session API returns `200`
- `frontend`, `backend`, and `postgres` are up, and `postgres` is healthy
- SSE returns `start`, at least one `delta`, and `done`

- [ ] **Step 14: Commit any final doc tweaks from real-world validation**

```bash
git add README.md deploy/tencent-cloud.md
git commit -m "docs: finalize cd verification notes"
```

- [ ] **Step 15: Push follow-up doc tweaks if any were committed**

```bash
git push origin main
```

### Task 5: Optional Cleanup and Handoff

**Files:**
- Modify: `README.md` only if release-operation wording needs tightening after validation

- [ ] **Step 1: Confirm the repository is clean**

Run: `git status --short`
Expected: no uncommitted changes.

- [ ] **Step 2: Summarize the operational handoff**

Document for the human:

- which GitHub secrets must remain configured
- where the deploy public key was installed
- the exact workflow name to click
- whether the current production server still requires occasional manual sync of deploy assets

- [ ] **Step 3: Final commit only if handoff docs changed**

```bash
git add README.md deploy/tencent-cloud.md
git commit -m "docs: polish cd handoff"
```
