#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

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

compose() {
  if docker compose version >/dev/null 2>&1; then
    if docker compose "$@"; then
      return
    fi
  fi

  require_command sudo
  sudo docker compose "$@"
}

main() {
  require_command docker
  require_command curl
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
  curl --fail --silent --show-error http://localhost/api/sessions >/dev/null

  echo "[deploy] deployment succeeded"
}

main "$@"
