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
  touch "$project_dir/.env" "$project_dir/docker-compose.yml"

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
  assert_contains "$command_log" "docker compose up --build -d"
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

test_deploy_happy_path
test_deploy_requires_env_file

echo "PASS: deploy script"
