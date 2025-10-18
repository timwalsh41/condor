#!/bin/bash
set -euo pipefail

# Script to build the Claude development container
echo "Building Claude development container..."

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Set timezone (adjust as needed)
TZ=${TZ:-$(timedatectl show --property=Timezone --value 2>/dev/null || echo "America/New_York")}

# Build the Docker image
docker build \
  --build-arg TZ="$TZ" \
  -t claude-dev:latest \
  -f "$SCRIPT_DIR/Dockerfile" \
  "$SCRIPT_DIR"

echo "✅ Build complete! Image tagged as 'claude-dev:latest'"
echo "Run './connect-container.sh' to start and connect to the container"
