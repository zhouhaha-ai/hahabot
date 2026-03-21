#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT_PATH="$ROOT_DIR/deploy.sh"

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

assert_contains() {
  local file="$1"
  local expected="$2"
  if ! grep -Fq "$expected" "$file"; then
    echo "Expected to find: $expected" >&2
    echo "--- file contents ---" >&2
    cat "$file" >&2
    echo "---------------------" >&2
    fail "missing expected content"
  fi
}

test_deploy_happy_path() {
  local temp_dir
  temp_dir="$(mktemp -d)"
  trap 'rm -rf "$temp_dir"' RETURN

  local project_dir="$temp_dir/project"
  local bin_dir="$temp_dir/bin"
  local command_log="$temp_dir/commands.log"

  mkdir -p "$project_dir" "$bin_dir"
  cat > "$project_dir/.env" <<'EOF'
DOCKERHUB_NAMESPACE=zhouhaha
POSTGRES_DB=haha_chatbot
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
DATABASE_URL=postgresql+psycopg://postgres:postgres@postgres:5432/haha_chatbot
QWEN_API_KEY=test-key
EOF
  touch "$project_dir/docker-compose.yml"

  cat > "$bin_dir/docker" <<EOF
#!/usr/bin/env bash
set -euo pipefail
printf 'docker %s\n' "\$*" >> "$command_log"
exit 0
EOF

  cat > "$bin_dir/curl" <<EOF
#!/usr/bin/env bash
set -euo pipefail
printf 'curl %s\n' "\$*" >> "$command_log"
exit 0
EOF

  chmod +x "$bin_dir/docker" "$bin_dir/curl"

  PATH="$bin_dir:$PATH" PROJECT_ROOT="$project_dir" bash "$SCRIPT_PATH"

  assert_contains "$command_log" "docker compose version"
  assert_contains "$command_log" "docker compose pull"
  assert_contains "$command_log" "docker compose up -d"
  assert_contains "$command_log" "docker compose ps"
  assert_contains "$command_log" "curl --fail --silent --show-error http://localhost/api/sessions"
}

test_deploy_requires_env_file() {
  local temp_dir
  temp_dir="$(mktemp -d)"
  trap 'rm -rf "$temp_dir"' RETURN

  local project_dir="$temp_dir/project"
  local bin_dir="$temp_dir/bin"
  local stderr_file="$temp_dir/stderr.log"

  mkdir -p "$project_dir" "$bin_dir"
  touch "$project_dir/docker-compose.yml"

  cat > "$bin_dir/docker" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF

  chmod +x "$bin_dir/docker"

  if PATH="$bin_dir:$PATH" PROJECT_ROOT="$project_dir" bash "$SCRIPT_PATH" 2>"$stderr_file"; then
    fail "deploy.sh should fail when .env is missing"
  fi

  assert_contains "$stderr_file" "Missing required file"
}

test_deploy_requires_dockerhub_namespace() {
  local temp_dir
  temp_dir="$(mktemp -d)"
  trap 'rm -rf "$temp_dir"' RETURN

  local project_dir="$temp_dir/project"
  local bin_dir="$temp_dir/bin"
  local stderr_file="$temp_dir/stderr.log"

  mkdir -p "$project_dir" "$bin_dir"
  cat > "$project_dir/.env" <<'EOF'
POSTGRES_DB=haha_chatbot
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
DATABASE_URL=postgresql+psycopg://postgres:postgres@postgres:5432/haha_chatbot
QWEN_API_KEY=test-key
EOF
  touch "$project_dir/docker-compose.yml"

  cat > "$bin_dir/docker" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF

  cat > "$bin_dir/curl" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF

  chmod +x "$bin_dir/docker" "$bin_dir/curl"

  if PATH="$bin_dir:$PATH" PROJECT_ROOT="$project_dir" bash "$SCRIPT_PATH" 2>"$stderr_file"; then
    fail "deploy.sh should fail when DOCKERHUB_NAMESPACE is missing"
  fi

  assert_contains "$stderr_file" "Missing required environment variable: DOCKERHUB_NAMESPACE"
}

test_deploy_falls_back_to_sudo_when_docker_needs_privilege() {
  local temp_dir
  temp_dir="$(mktemp -d)"
  trap 'rm -rf "$temp_dir"' RETURN

  local project_dir="$temp_dir/project"
  local bin_dir="$temp_dir/bin"
  local command_log="$temp_dir/commands.log"

  mkdir -p "$project_dir" "$bin_dir"
  cat > "$project_dir/.env" <<'EOF'
DOCKERHUB_NAMESPACE=zhouhaha
POSTGRES_DB=haha_chatbot
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
DATABASE_URL=postgresql+psycopg://postgres:postgres@postgres:5432/haha_chatbot
QWEN_API_KEY=test-key
EOF
  touch "$project_dir/docker-compose.yml"

  cat > "$bin_dir/docker" <<EOF
#!/usr/bin/env bash
set -euo pipefail
printf 'docker %s\n' "\$*" >> "$command_log"
if [[ "\$*" == "compose version" ]]; then
  exit 0
fi
if [[ "\${DOCKER_VIA_SUDO:-0}" == "1" ]]; then
  exit 0
fi
echo "permission denied while trying to connect to the Docker daemon socket" >&2
exit 1
EOF

  cat > "$bin_dir/sudo" <<EOF
#!/usr/bin/env bash
set -euo pipefail
printf 'sudo %s\n' "\$*" >> "$command_log"
DOCKER_VIA_SUDO=1 "\$@"
EOF

  cat > "$bin_dir/curl" <<EOF
#!/usr/bin/env bash
set -euo pipefail
printf 'curl %s\n' "\$*" >> "$command_log"
exit 0
EOF

  chmod +x "$bin_dir/docker" "$bin_dir/sudo" "$bin_dir/curl"

  PATH="$bin_dir:$PATH" PROJECT_ROOT="$project_dir" bash "$SCRIPT_PATH"

  assert_contains "$command_log" "sudo docker compose pull"
  assert_contains "$command_log" "sudo docker compose up -d"
}

test_deploy_does_not_fall_back_to_sudo_for_non_permission_errors() {
  local temp_dir
  temp_dir="$(mktemp -d)"
  trap 'rm -rf "$temp_dir"' RETURN

  local project_dir="$temp_dir/project"
  local bin_dir="$temp_dir/bin"
  local command_log="$temp_dir/commands.log"
  local stderr_file="$temp_dir/stderr.log"

  mkdir -p "$project_dir" "$bin_dir"
  cat > "$project_dir/.env" <<'EOF'
DOCKERHUB_NAMESPACE=zhouhaha
POSTGRES_DB=haha_chatbot
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
DATABASE_URL=postgresql+psycopg://postgres:postgres@postgres:5432/haha_chatbot
QWEN_API_KEY=test-key
EOF
  touch "$project_dir/docker-compose.yml"

  cat > "$bin_dir/docker" <<EOF
#!/usr/bin/env bash
set -euo pipefail
printf 'docker %s\n' "\$*" >> "$command_log"
if [[ "\$*" == "compose version" ]]; then
  exit 0
fi
echo "manifest for zhouhaha/hahabot-backend:latest not found" >&2
exit 1
EOF

  cat > "$bin_dir/sudo" <<EOF
#!/usr/bin/env bash
set -euo pipefail
printf 'sudo %s\n' "\$*" >> "$command_log"
exit 0
EOF

  cat > "$bin_dir/curl" <<EOF
#!/usr/bin/env bash
set -euo pipefail
printf 'curl %s\n' "\$*" >> "$command_log"
exit 0
EOF

  chmod +x "$bin_dir/docker" "$bin_dir/sudo" "$bin_dir/curl"

  if PATH="$bin_dir:$PATH" PROJECT_ROOT="$project_dir" bash "$SCRIPT_PATH" > /dev/null 2>"$stderr_file"; then
    fail "deploy.sh should fail fast for non-permission docker errors"
  fi

  if grep -Fq "sudo docker compose pull" "$command_log"; then
    fail "deploy.sh should not retry with sudo for non-permission errors"
  fi

  assert_contains "$stderr_file" "manifest for zhouhaha/hahabot-backend:latest not found"
}

test_deploy_happy_path
test_deploy_requires_env_file
test_deploy_requires_dockerhub_namespace
test_deploy_falls_back_to_sudo_when_docker_needs_privilege
test_deploy_does_not_fall_back_to_sudo_for_non_permission_errors

echo "PASS: deploy script"
