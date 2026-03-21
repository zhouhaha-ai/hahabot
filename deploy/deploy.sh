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

compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
    return
  fi

  require_command sudo
  sudo docker compose "$@"
}

main() {
  require_command docker
  require_command curl
  require_file "$PROJECT_ROOT/.env"
  require_file "$PROJECT_ROOT/docker-compose.yml"

  cd "$PROJECT_ROOT"

  echo "[deploy] building and starting containers"
  compose up --build -d

  echo "[deploy] checking compose status"
  compose ps

  echo "[deploy] smoke-checking proxied API"
  curl --fail --silent --show-error http://localhost/api/sessions >/dev/null

  echo "[deploy] deployment succeeded"
}

main "$@"
