#!/usr/bin/env zsh
# oc.sh — Manage opencode project containers.
#         Creates a container (if needed), starts it (if needed), and opens a zsh
#         shell to the project workspace within the container.
#
# Usage:
#   ./oc.sh [--fresh | -f] [-p host:container ...]
#
#   --fresh, -f     Remove any existing container for this project and start a new one.
#   -p host:cont    Forward a port: map host port to container port (repeatable).
#                   If the container exists with a different mapping, -f is required.
#
# This script must be run from a project directory (or workspace/ subdirectory) 
# containing .oc-config and .opencode/. Use oc-init.sh from the docker repository 
# to initialize a new project first.
#
# See README.md for full documentation.

set -euo pipefail

SCRIPT_DIR="${0:A:h}"

# Locate project root: check current dir, then parent (for nested mode where oc.sh is in workspace/)
if [[ -f "${SCRIPT_DIR}/.oc-config" ]]; then
  PROJECT_ROOT="${SCRIPT_DIR}"
elif [[ -f "${SCRIPT_DIR}/../.oc-config" ]]; then
  PROJECT_ROOT="${SCRIPT_DIR:h}"
else
  echo "ERROR: Cannot find .oc-config in ${SCRIPT_DIR} or parent directory." >&2
  echo "Initialize the project with oc-init.sh first." >&2
  exit 1
fi

# ── Default settings (overridden by project's .oc-config) ────────────────────
PROJECT_NAME=""          # derived from project folder name if not set in .oc-config
IMAGE="opencode-base"    # docker image to run
MEMORY="8g"              # container memory limit
CPUS="4"                 # container CPU limit
WORKSPACE_MODE="nested"  # nested (default) | direct (existing repo: mount project root as /workspace)

# ── Helpers ───────────────────────────────────────────────────────────────────
usage() {
  sed '/^$/q' "${SCRIPT_DIR}/oc.sh" | grep '^#' | grep -v '^#!' | sed 's/^# \{0,1\}//'
  exit 1
}

die() { echo "ERROR: $*" >&2; exit 1; }

# Return 0 if the existing container's port bindings match the requested specs.
ports_match() {
  local container="$1"; shift
  local -a specs=("$@")       # raw host:container[/proto] specs

  local -a wanted=()
  local s
  for s in "${specs[@]}"; do
    [[ "${s}" == */* ]] || s="${s}/tcp"
    wanted+=("${s}")
  done

  local raw
  raw=$(docker container inspect \
    --format '{{range $port, $bindings := .HostConfig.PortBindings}}{{range $bindings}}{{.HostPort}}:{{$port}} {{end}}{{end}}' \
    "${container}" 2>/dev/null)
  local -a actual=(${=raw})

  local sw sa
  sw=$(printf '%s\n' "${wanted[@]}" | sort)
  sa=$(printf '%s\n' "${actual[@]}" | sort)
  [[ "${sw}" == "${sa}" ]]
}

# ── Argument parsing ───────────────────────────────────────────────────────────
FRESH=false
PORT_FLAGS=()   # --publish pairs forwarded to docker run
PORT_SPECS=()   # raw host:container specs used for port comparison

while [[ $# -gt 0 ]]; do
  case "$1" in
    --fresh|-f)     FRESH=true;             shift ;;
    -p)
      [[ $# -gt 1 ]] || die "-p requires an argument (host:container)"
      PORT_FLAGS+=("--publish" "$2")
      PORT_SPECS+=("$2")
      shift 2
      ;;
    -h|--help) usage ;;
    *)
      die "Unexpected argument: $1"
      ;;
  esac
done

# ── Validate project structure ─────────────────────────────────────────────────
# .oc-config was already found during PROJECT_ROOT detection, just verify .opencode/ exists
[[ -d "${PROJECT_ROOT}/.opencode" ]] || die "Missing .opencode/ in ${PROJECT_ROOT}. Initialize with oc-init.sh first."

# ── Load project config ────────────────────────────────────────────────────────
source "${PROJECT_ROOT}/.oc-config"

# Validate workspace structure based on mode
[[ "${WORKSPACE_MODE}" != "direct" ]] && \
  { [[ -d "${PROJECT_ROOT}/workspace" ]] || die "Missing workspace/ in ${PROJECT_ROOT}. Project appears corrupt."; }

# Derive container name from project folder if not set in .oc-config
[[ -z "${PROJECT_NAME}" ]] && PROJECT_NAME="${PROJECT_ROOT:t}"
# Sanitize: lowercase, replace non-alphanumeric with hyphens
CONTAINER_NAME="opencode-${PROJECT_NAME:l}" 
CONTAINER_NAME="${CONTAINER_NAME//[^a-z0-9\-]/-}"

# ── Handle --fresh ─────────────────────────────────────────────────────────────
if $FRESH; then
  if docker container inspect "${CONTAINER_NAME}" &>/dev/null; then
    echo "==> Removing existing container: ${CONTAINER_NAME}"
    docker rm -f "${CONTAINER_NAME}"
  fi
fi

# ── API key forwarding ─────────────────────────────────────────────────────────
# Variables are forwarded only if set in the host environment.
# Add or remove provider env vars here as needed.
ENV_FLAGS=()
for var in \
  ANTHROPIC_API_KEY \
  OPENAI_API_KEY \
  OPENCODE_API_KEY \
  GEMINI_API_KEY \
  OPENROUTER_API_KEY \
  MISTRAL_API_KEY \
  XAI_API_KEY \
  DEEPSEEK_API_KEY \
  GROQ_API_KEY \
  CONTEXT7_API_KEY; do
  [[ -n "${(P)var+x}" ]] && ENV_FLAGS+=("-e" "${var}")
done

# ── Determine OS for host-gateway ─────────────────────────────────────────────
# host.docker.internal is built-in on Docker Desktop (Mac/Windows).
# On Linux with Docker Engine it must be added explicitly.
HOST_FLAGS=()
if [[ "$(uname -s)" == "Linux" ]]; then
  HOST_FLAGS+=("--add-host" "host.docker.internal:host-gateway")
fi

# ── Resolve volume mounts ────────────────────────────────────────────────────────
# In direct mode the project root IS /workspace, so .opencode/ is visible inside it.
# We override OPENCODE_CONFIG_DIR instead of adding a second volume mount.
if [[ "${WORKSPACE_MODE}" == "direct" ]]; then
  VOLUME_FLAGS=("--volume" "${PROJECT_ROOT}:/workspace")
  ENV_FLAGS+=("-e" "OPENCODE_CONFIG_DIR=/workspace/.opencode")
else
  VOLUME_FLAGS=(
    "--volume" "${PROJECT_ROOT}/workspace:/workspace"
    "--volume" "${PROJECT_ROOT}/.opencode:/home/opencode/.config/opencode"
  )
fi

# ── Start or reuse the container ───────────────────────────────────────────────
if docker container inspect "${CONTAINER_NAME}" &>/dev/null; then
  # Container exists — check port mapping if -p was requested.
  if [[ ${#PORT_SPECS[@]} -gt 0 ]] && ! ports_match "${CONTAINER_NAME}" "${PORT_SPECS[@]}"; then
    die "Container '${CONTAINER_NAME}' exists with a different port mapping. Use --fresh / -f to recreate it with the requested ports."
  fi
  # Start it if stopped, then exec into it.
  STATE="$(docker container inspect --format '{{.State.Status}}' "${CONTAINER_NAME}")"
  if [[ "${STATE}" != "running" ]]; then
    echo "==> Starting existing container: ${CONTAINER_NAME}"
    docker start "${CONTAINER_NAME}"
  fi
  echo "==> Attaching to container: ${CONTAINER_NAME}"
  docker exec -it "${CONTAINER_NAME}" /usr/bin/zsh
else
  # No existing container — create and start it.
  echo "==> Creating container: ${CONTAINER_NAME} (image: ${IMAGE})"
  docker run -it \
    --name "${CONTAINER_NAME}" \
    \
    `# Project mounts` \
    "${VOLUME_FLAGS[@]}" \
    \
    `# Resource limits` \
    --memory "${MEMORY}" \
    --cpus   "${CPUS}" \
    \
    `# Security hardening` \
    --cap-drop ALL \
    --security-opt no-new-privileges \
    \
    `# Host network access for local LLMs` \
    "${HOST_FLAGS[@]}" \
    \
    `# API keys (host env vars, passed only if set)` \
    "${ENV_FLAGS[@]}" \
    \
    `# Port forwarding (-p flags, if any)` \
    "${PORT_FLAGS[@]}" \
    \
    "${IMAGE}:latest"
fi
