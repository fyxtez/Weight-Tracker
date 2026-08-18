#!/usr/bin/env bash

set -Eeuo pipefail

# Feature: Resolve every path from this script so it works from a terminal or file manager.
PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
ENV_FILE="$BACKEND_DIR/.env"
ENV_EXAMPLE="$BACKEND_DIR/.env.example"

die() {
    printf 'Error: %s\n' "$1" >&2
    exit 1
}

command -v docker >/dev/null 2>&1 || die "Docker is not installed."
command -v cargo >/dev/null 2>&1 || die "Rust/Cargo is not installed."
[[ -f "$PROJECT_DIR/docker-compose.yml" ]] || die "docker-compose.yml is missing."
[[ -f "$BACKEND_DIR/Cargo.toml" ]] || die "backend/Cargo.toml is missing."
[[ -f "$ENV_EXAMPLE" ]] || die "backend/.env.example is missing."

if [[ ! -f "$ENV_FILE" ]]; then
    # Feature: First launch creates local configuration while keeping secrets outside Git.
    cp -- "$ENV_EXAMPLE" "$ENV_FILE"
    printf 'Created backend/.env from backend/.env.example.\n'
fi

# Fix: If the current Linux user cannot access the Docker socket, the launcher falls back to sudo without requiring logout/login.
if docker info >/dev/null 2>&1; then
    DOCKER=(docker)
else
    command -v sudo >/dev/null 2>&1 ||
        die "Docker requires elevated access, but sudo is unavailable."

    DOCKER=(sudo docker)
    printf 'Docker requires elevated access; sudo may ask for your password.\n'
fi

cd -- "$PROJECT_DIR"

printf 'Starting PostgreSQL...\n'
"${DOCKER[@]}" compose up -d postgres

printf 'Waiting for PostgreSQL'
database_ready=false

for _ in {1..30}; do
    if "${DOCKER[@]}" compose exec -T postgres \
        pg_isready -U weight_tracker -d weight_tracker >/dev/null 2>&1; then
        database_ready=true
        break
    fi

    printf '.'
    sleep 1
done

printf '\n'

if [[ "$database_ready" != true ]]; then
    # Fix: Show container diagnostics immediately instead of leaving a failed startup unexplained.
    "${DOCKER[@]}" compose logs --tail=80 postgres >&2 || true
    die "PostgreSQL did not become ready within 30 seconds."
fi

printf 'PostgreSQL is ready.\n'
printf 'Starting Weight Tracker API at http://127.0.0.1:8585\n'
printf 'Stop the backend with Ctrl+C. PostgreSQL will remain available for the next run.\n\n'

cd -- "$BACKEND_DIR"

# Feature: Exec forwards Ctrl+C directly to Axum so graceful shutdown can finish in-flight writes.
exec cargo run