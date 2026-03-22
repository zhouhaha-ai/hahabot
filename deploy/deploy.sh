#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
SMOKE_CHECK_RETRIES="${SMOKE_CHECK_RETRIES:-30}"
SMOKE_CHECK_DELAY_SECONDS="${SMOKE_CHECK_DELAY_SECONDS:-2}"

require_file() {
  local path="$1"
  if [[ ! -f "$path" ]]; then
    echo "Missing required file: $path" >&2
    exit 1
  fi
}

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Required command not found: $command_name" >&2
    exit 1
  fi
}

require_env_var_in_file() {
  local env_name="$1"
  local env_file="$2"
  if ! grep -Eq "^${env_name}=.+" "$env_file"; then
    echo "Missing required environment variable: $env_name" >&2
    exit 1
  fi
}

is_docker_permission_error() {
  local stderr_output="$1"
  grep -Eiq \
    'permission denied while trying to connect to the Docker daemon socket|docker\.sock: connect: permission denied' \
    <<<"$stderr_output"
}

compose() {
  if docker compose version >/dev/null 2>&1; then
    local stderr_file
    local exit_code
    local stderr_output
    stderr_file="$(mktemp)"

    if docker compose "$@" 2>"$stderr_file"; then
      rm -f "$stderr_file"
      return
    else
      exit_code=$?
      stderr_output="$(cat "$stderr_file")"
      rm -f "$stderr_file"
      printf '%s\n' "$stderr_output" >&2

      if ! is_docker_permission_error "$stderr_output"; then
        return "$exit_code"
      fi
    fi
  fi

  require_command sudo
  sudo docker compose "$@"
}

smoke_check_api() {
  local attempt=1
  local max_attempts="$SMOKE_CHECK_RETRIES"

  while (( attempt <= max_attempts )); do
    if curl --fail --silent --show-error http://localhost/api/sessions >/dev/null; then
      return 0
    fi

    if (( attempt == max_attempts )); then
      echo "Smoke check failed after ${max_attempts} attempts" >&2
      return 1
    fi

    sleep "$SMOKE_CHECK_DELAY_SECONDS"
    attempt=$((attempt + 1))
  done
}

main() {
  require_command docker
  require_command curl
  require_command sleep
  require_file "$PROJECT_ROOT/.env"
  require_file "$PROJECT_ROOT/docker-compose.yml"
  require_env_var_in_file "DOCKERHUB_NAMESPACE" "$PROJECT_ROOT/.env"

  cd "$PROJECT_ROOT"

  echo "[deploy] pulling images"
  compose pull

  echo "[deploy] starting containers"
  compose up -d

  echo "[deploy] checking compose status"
  compose ps

  echo "[deploy] smoke-checking proxied API"
  smoke_check_api

  echo "[deploy] deployment succeeded"
}

main "$@"
