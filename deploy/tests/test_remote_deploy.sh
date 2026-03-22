#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT_PATH="$ROOT_DIR/deploy/remote-deploy.sh"

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

assert_line_count() {
  local file="$1"
  local expected_line="$2"
  local expected_count="$3"
  local actual_count
  actual_count="$(grep -Fc "$expected_line" "$file" || true)"
  if [[ "$actual_count" != "$expected_count" ]]; then
    echo "Expected $expected_count copies of: $expected_line" >&2
    echo "Actual count: $actual_count" >&2
    echo "--- file contents ---" >&2
    cat "$file" >&2
    echo "---------------------" >&2
    fail "unexpected line count"
  fi
}

test_updates_existing_image_tag() {
  local temp_dir
  temp_dir="$(mktemp -d)"
  trap 'rm -rf "$temp_dir"' RETURN

  local project_dir="$temp_dir/project"
  local bin_dir="$temp_dir/bin"
  local log_file="$temp_dir/commands.log"
  mkdir -p "$project_dir/deploy" "$bin_dir"

  cat > "$project_dir/.env" <<'EOF'
DOCKERHUB_NAMESPACE=zhouhahaai
IMAGE_TAG=latest
QWEN_API_KEY=test-key
EOF

  cat > "$project_dir/deploy.sh" <<EOF
#!/usr/bin/env bash
set -euo pipefail
printf 'deploy %s\n' "\$*" >> "$log_file"
exit 0
EOF

  cat > "$bin_dir/docker" <<EOF
#!/usr/bin/env bash
set -euo pipefail
printf 'docker %s\n' "\$*" >> "$log_file"
if [[ "\$*" == "compose version" ]]; then
  exit 0
fi
if [[ "\$*" == "compose ps -q backend frontend" ]]; then
  printf 'backend-id\nfrontend-id\n'
  exit 0
fi
if [[ "\$1" == "inspect" ]]; then
  printf '/hahabot-backend-1 zhouhahaai/hahabot-backend:sha-0123456789abcdef0123456789abcdef01234567\n'
  printf '/hahabot-frontend-1 zhouhahaai/hahabot-frontend:sha-0123456789abcdef0123456789abcdef01234567\n'
  exit 0
fi
exit 0
EOF

  cat > "$bin_dir/curl" <<EOF
#!/usr/bin/env bash
set -euo pipefail
printf 'curl %s\n' "\$*" >> "$log_file"
exit 0
EOF

  chmod +x "$project_dir/deploy.sh" "$bin_dir/docker" "$bin_dir/curl"

  PATH="$bin_dir:$PATH" PROJECT_ROOT="$project_dir" bash "$SCRIPT_PATH" sha-0123456789abcdef0123456789abcdef01234567

  assert_contains "$project_dir/.env" "IMAGE_TAG=sha-0123456789abcdef0123456789abcdef01234567"
  assert_line_count "$project_dir/.env" "IMAGE_TAG=sha-0123456789abcdef0123456789abcdef01234567" 1
}

test_appends_image_tag_if_missing() {
  local temp_dir
  temp_dir="$(mktemp -d)"
  trap 'rm -rf "$temp_dir"' RETURN

  local project_dir="$temp_dir/project"
  local bin_dir="$temp_dir/bin"
  local log_file="$temp_dir/commands.log"
  mkdir -p "$project_dir/deploy" "$bin_dir"

  cat > "$project_dir/.env" <<'EOF'
DOCKERHUB_NAMESPACE=zhouhahaai
QWEN_API_KEY=test-key
EOF

  cat > "$project_dir/deploy.sh" <<EOF
#!/usr/bin/env bash
set -euo pipefail
printf 'deploy %s\n' "\$*" >> "$log_file"
exit 0
EOF

  cat > "$bin_dir/docker" <<EOF
#!/usr/bin/env bash
set -euo pipefail
printf 'docker %s\n' "\$*" >> "$log_file"
if [[ "\$*" == "compose version" ]]; then
  exit 0
fi
if [[ "\$*" == "compose ps -q backend frontend" ]]; then
  printf 'backend-id\nfrontend-id\n'
  exit 0
fi
if [[ "\$1" == "inspect" ]]; then
  printf '/hahabot-backend-1 zhouhahaai/hahabot-backend:latest\n'
  printf '/hahabot-frontend-1 zhouhahaai/hahabot-frontend:latest\n'
  exit 0
fi
exit 0
EOF

  cat > "$bin_dir/curl" <<EOF
#!/usr/bin/env bash
set -euo pipefail
printf 'curl %s\n' "\$*" >> "$log_file"
exit 0
EOF

  chmod +x "$project_dir/deploy.sh" "$bin_dir/docker" "$bin_dir/curl"

  PATH="$bin_dir:$PATH" PROJECT_ROOT="$project_dir" bash "$SCRIPT_PATH" latest

  assert_contains "$project_dir/.env" "IMAGE_TAG=latest"
  assert_line_count "$project_dir/.env" "IMAGE_TAG=latest" 1
}

test_rejects_invalid_image_tag() {
  local temp_dir
  temp_dir="$(mktemp -d)"
  trap 'rm -rf "$temp_dir"' RETURN

  local project_dir="$temp_dir/project"
  local bin_dir="$temp_dir/bin"
  local stderr_file="$temp_dir/stderr.log"
  mkdir -p "$project_dir/deploy" "$bin_dir"

  cat > "$project_dir/.env" <<'EOF'
DOCKERHUB_NAMESPACE=zhouhahaai
IMAGE_TAG=latest
QWEN_API_KEY=test-key
EOF

  cat > "$project_dir/deploy.sh" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF

  cat > "$bin_dir/docker" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF

  cat > "$bin_dir/curl" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF

  chmod +x "$project_dir/deploy.sh" "$bin_dir/docker" "$bin_dir/curl"

  if PATH="$bin_dir:$PATH" PROJECT_ROOT="$project_dir" bash "$SCRIPT_PATH" 'sha-123' 2>"$stderr_file"; then
    fail "remote-deploy.sh should reject malformed image tags"
  fi

  assert_contains "$stderr_file" "Invalid image tag"
}

test_rejects_mismatched_deployed_image_tag() {
  local temp_dir
  temp_dir="$(mktemp -d)"
  trap 'rm -rf "$temp_dir"' RETURN

  local project_dir="$temp_dir/project"
  local bin_dir="$temp_dir/bin"
  local stderr_file="$temp_dir/stderr.log"
  mkdir -p "$project_dir/deploy" "$bin_dir"

  cat > "$project_dir/.env" <<'EOF'
DOCKERHUB_NAMESPACE=zhouhahaai
IMAGE_TAG=latest
QWEN_API_KEY=test-key
EOF

  cat > "$project_dir/deploy.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
exit 0
EOF

  cat > "$bin_dir/docker" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
if [[ "$*" == "compose version" ]]; then
  exit 0
fi
if [[ "$*" == "compose ps" ]]; then
  exit 0
fi
if [[ "$*" == "compose ps -q backend frontend" ]]; then
  printf 'backend-id\nfrontend-id\n'
  exit 0
fi
if [[ "$1" == "inspect" ]]; then
  printf '/hahabot-backend-1 zhouhahaai/hahabot-backend:latest\n'
  printf '/hahabot-frontend-1 zhouhahaai/hahabot-frontend:latest\n'
  exit 0
fi
if [[ "$1" == "compose" && "$2" == "logs" ]]; then
  exit 0
fi
exit 0
EOF

  chmod +x "$project_dir/deploy.sh" "$bin_dir/docker"

  if PATH="$bin_dir:$PATH" PROJECT_ROOT="$project_dir" bash "$SCRIPT_PATH" sha-0123456789abcdef0123456789abcdef01234567 2>"$stderr_file"; then
    fail "remote-deploy.sh should reject mismatched deployed image tags"
  fi

  assert_contains "$stderr_file" "Deployed image tag does not match requested tag"
}

test_updates_existing_image_tag
test_appends_image_tag_if_missing
test_rejects_invalid_image_tag
test_rejects_mismatched_deployed_image_tag

echo "PASS: remote deploy script"
