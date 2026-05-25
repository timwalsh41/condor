#!/usr/bin/env sh
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
#   scripts/set-version.sh                 # Resolve from git and write files
#   scripts/set-version.sh --dry           # Resolve from git, print only
#   scripts/set-version.sh VERSION         # Use explicit VERSION, write files
#   scripts/set-version.sh VERSION --dry   # Use explicit VERSION, print only

set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# Allow callers to override PROJECT_ROOT (e.g. when scripts/ is copied into a
# sub-directory of the real project root, as in Docker build contexts).
PROJECT_ROOT="${PROJECT_ROOT:-$(cd "${SCRIPT_DIR}/.." && pwd)}"

# ── Argument parsing ─────────────────────────────────────────────────────────
# Positional arg: optional explicit version (skip git resolution if provided).
# Flag --dry: print version only, don't write files.

EXPLICIT_VERSION=""
DRY_RUN=false

for arg in "$@"; do
    case "$arg" in
        --dry) DRY_RUN=true ;;
        *)     EXPLICIT_VERSION="$arg" ;;
    esac
done

# ── Version resolution ────────────────────────────────────────────────────────

resolve_version() {
    # Try the latest tag reachable from HEAD
    tag=$(git describe --tags --dirty= 2>/dev/null) || true

    if [ -n "$tag" ]; then
        # Strip leading 'v' if present
        echo "${tag#v}"
    else
        # Try short commit hash
        hash=$(git rev-parse --short=7 HEAD 2>/dev/null) || true
        if [ -n "$hash" ]; then
            echo "unreleased-${hash}"
        else
            echo "dev"
        fi
    fi
}

if [ -n "$EXPLICIT_VERSION" ]; then
    VERSION="$EXPLICIT_VERSION"
else
    VERSION=$(resolve_version)
fi

# Handle dry-run mode
if [ "$DRY_RUN" = true ]; then
    echo "$VERSION"
    exit 0
fi

echo "Version: $VERSION"

# ── Update frontend/package.json ──────────────────────────────────────────────

if [ -f "${PROJECT_ROOT}/frontend/package.json" ]; then
    sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"${VERSION}\"/" \
        "${PROJECT_ROOT}/frontend/package.json"
    echo "  → frontend/package.json"
fi

# ── Update pyproject.toml ─────────────────────────────────────────────────────

if [ -f "${PROJECT_ROOT}/pyproject.toml" ]; then
    sed -i "s/^version = \".*\"/version = \"${VERSION}\"/" \
        "${PROJECT_ROOT}/pyproject.toml"
    echo "  → pyproject.toml"
fi

# ── Generate backend/version.py ───────────────────────────────────────────────

if [ -d "${PROJECT_ROOT}/backend" ]; then
    cat > "${PROJECT_ROOT}/backend/version.py" << PYEOF
"""Auto-generated version string — do not edit manually."""

VERSION = "${VERSION}"
PYEOF
    echo "  → backend/version.py"
fi

# ── Generate frontend/src/version.ts ──────────────────────────────────────────

if [ -d "${PROJECT_ROOT}/frontend/src" ]; then
    cat > "${PROJECT_ROOT}/frontend/src/version.ts" << TSEOF
/** Auto-generated version string — do not edit manually. */
export const VERSION = "${VERSION}";
TSEOF
    echo "  → frontend/src/version.ts"
fi
