#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-/home/ubuntu/hahabot}"
IMAGE_TAG="${1:-}"

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Required command not found: $command_name" >&2
    exit 1
  fi
}

require_file() {
  local path="$1"
  if [[ ! -f "$path" ]]; then
    echo "Missing required file: $path" >&2
    exit 1
  fi
}

is_docker_permission_error() {
  local stderr_output="$1"
  grep -Eiq \
    'permission denied while trying to connect to the Docker daemon socket|docker\.sock: connect: permission denied' \
    <<<"$stderr_output"
}

run_docker() {
  local stderr_file
  local exit_code
  local stderr_output
  stderr_file="$(mktemp)"

  if docker "$@" 2>"$stderr_file"; then
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

  require_command sudo
  sudo docker "$@"
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

validate_image_tag() {
  if [[ "$IMAGE_TAG" != "latest" && ! "$IMAGE_TAG" =~ ^sha-[0-9a-f]{40}$ ]]; then
    echo "Invalid image tag" >&2
    exit 1
  fi
}

update_env_image_tag() {
  local env_file="$1"
  local temp_file
  temp_file="$(mktemp)"

  awk -v image_tag="$IMAGE_TAG" '
    BEGIN { updated = 0 }
    /^IMAGE_TAG=/ {
      if (!updated) {
        print "IMAGE_TAG=" image_tag
        updated = 1
      }
      next
    }
    { print }
    END {
      if (!updated) {
        print "IMAGE_TAG=" image_tag
      }
    }
  ' "$env_file" >"$temp_file"

  mv "$temp_file" "$env_file"
}

print_deployed_images() {
  local container_ids
  container_ids="$(compose ps -q backend frontend)"
  if [[ -z "$container_ids" ]]; then
    echo "No backend/frontend containers found for image inspection" >&2
    return 1
  fi

  # Print the exact image refs the running containers use.
  run_docker inspect $container_ids --format '{{.Name}} {{.Config.Image}}'
}

verify_deployed_image_tag() {
  local deployed_images
  deployed_images="$(print_deployed_images)"
  printf '%s\n' "$deployed_images"

  local backend_image
  local frontend_image
  backend_image="$(grep '/hahabot-backend' <<<"$deployed_images" | awk '{print $2}')"
  frontend_image="$(grep '/hahabot-frontend' <<<"$deployed_images" | awk '{print $2}')"

  if [[ -z "$backend_image" || -z "$frontend_image" ]]; then
    echo "Unable to determine deployed backend/frontend images" >&2
    return 1
  fi

  if [[ "$backend_image" != *":$IMAGE_TAG" || "$frontend_image" != *":$IMAGE_TAG" ]]; then
    echo "Deployed image tag does not match requested tag: $IMAGE_TAG" >&2
    return 1
  fi
}

print_failure_diagnostics() {
  echo "[remote-deploy] docker compose ps" >&2
  compose ps >&2 || true

  echo "[remote-deploy] recent backend/frontend logs" >&2
  compose logs --tail=80 backend frontend >&2 || true
}

on_error() {
  local exit_code="$1"
  print_failure_diagnostics
  exit "$exit_code"
}

main() {
  require_command awk
  require_command docker
  require_file "$PROJECT_ROOT/.env"
  require_file "$PROJECT_ROOT/deploy.sh"

  if [[ -z "$IMAGE_TAG" ]]; then
    echo "Usage: remote-deploy.sh <image_tag>" >&2
    exit 1
  fi

  validate_image_tag

  trap 'on_error $?' ERR

  cd "$PROJECT_ROOT"
  update_env_image_tag "$PROJECT_ROOT/.env"
  /bin/bash "$PROJECT_ROOT/deploy.sh"
  compose ps
  verify_deployed_image_tag
}

main "$@"
