#!/usr/bin/env sh
# deploy.sh — Build and deploy Condor via Docker Compose with the correct
#             application version baked into the images.
#
# Resolves the version from git (via set-version.sh --dry) and passes it as
# the CONDOR_VERSION build arg so that the running application displays the
# correct version string (e.g. "0.1.4") instead of "dev".
#
# Usage:
#   scripts/deploy.sh             # Build & deploy (detached)
#   scripts/deploy.sh --dry-run   # Print version + docker compose command only
#
# All other arguments are forwarded to `docker compose`. For example:
#   scripts/deploy.sh --build backend   # Build & deploy only the backend service

set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="${SCRIPT_DIR}/.."

# ── Resolve version ──────────────────────────────────────────────────────────

VERSION=$("${SCRIPT_DIR}/set-version.sh" --dry)
echo "🔖  Resolved version: ${VERSION}"

# ── Dry-run mode ─────────────────────────────────────────────────────────────

if [ "${1:-}" = "--dry-run" ]; then
    echo "▶   CONDOR_VERSION=${VERSION} docker compose -f \"${PROJECT_ROOT}/docker-compose.yml\" up --build -d"
    exit 0
fi

# ── Build and deploy ─────────────────────────────────────────────────────────

export CONDOR_VERSION="${VERSION}"
echo "🏗️   Building images with CONDOR_VERSION=${CONDOR_VERSION} ..."

exec docker compose -f "${PROJECT_ROOT}/docker-compose.yml" up --build -d "$@"
