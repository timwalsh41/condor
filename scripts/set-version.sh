#!/usr/bin/env bash
# set-version.sh — Determine the application version from git and update
# build-time artifacts accordingly.
#
# Version resolution order:
#   1. Latest git tag reachable from HEAD (e.g. "v1.2.3" → "1.2.3")
#   2. Short git hash prefixed with "unreleased-" (e.g. "unreleased-a1b2c3d")
#   3. "dev" when git is unavailable or not a repo
#
# Outputs:
#   - frontend/package.json    : version field updated
#   - pyproject.toml           : version field updated
#   - backend/version.py       : GENERATED — VERSION constant
#   - frontend/src/version.ts  : GENERATED — VERSION constant
#
# Usage:
#   scripts/set-version.sh          # Run from project root
#   scripts/set-version.sh --dry    # Print version only, don't write files

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ── Version resolution ────────────────────────────────────────────────────────

resolve_version() {
    # Try the latest tag reachable from HEAD
    local tag
    tag=$(git describe --tags --dirty= 2>/dev/null) || true

    if [[ -n "$tag" ]]; then
        # Strip leading 'v' if present
        echo "${tag#v}"
    else
        # Try short commit hash
        local hash
        hash=$(git rev-parse --short=7 HEAD 2>/dev/null) || true
        if [[ -n "$hash" ]]; then
            echo "unreleased-${hash}"
        else
            echo "dev"
        fi
    fi
}

VERSION=$(resolve_version)

# Handle dry-run mode
if [[ "${1:-}" == "--dry" ]]; then
    echo "$VERSION"
    exit 0
fi

echo "Version: $VERSION"

# ── Update frontend/package.json ──────────────────────────────────────────────

sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"${VERSION}\"/" \
    "${PROJECT_ROOT}/frontend/package.json"

# ── Update pyproject.toml ─────────────────────────────────────────────────────

sed -i "s/^version = \".*\"/version = \"${VERSION}\"/" \
    "${PROJECT_ROOT}/pyproject.toml"

# ── Generate backend/version.py ───────────────────────────────────────────────

cat > "${PROJECT_ROOT}/backend/version.py" << PYEOF
"""Auto-generated version string — do not edit manually."""

VERSION = "${VERSION}"
PYEOF

# ── Generate frontend/src/version.ts ──────────────────────────────────────────

cat > "${PROJECT_ROOT}/frontend/src/version.ts" << TSEOF
/** Auto-generated version string — do not edit manually. */
export const VERSION = "${VERSION}";
TSEOF

echo "  → frontend/package.json"
echo "  → pyproject.toml"
echo "  → backend/version.py"
echo "  → frontend/src/version.ts"
