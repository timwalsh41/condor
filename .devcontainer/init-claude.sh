#!/bin/bash
set -euo pipefail

# Script to initialize Claude configuration on first run
CLAUDE_CONFIG_DIR="/home/node/.claude"
INIT_FLAG="$CLAUDE_CONFIG_DIR/.initialized"

# Exit if already initialized
if [ -f "$INIT_FLAG" ]; then
    exit 0
fi

echo "Initializing Claude Code environment..."

# Ensure config directory exists
mkdir -p "$CLAUDE_CONFIG_DIR"

# Configure Serena MCP server
echo "Adding Serena MCP server..."
claude mcp add serena --global -- uvx --from git+https://github.com/oraios/serena serena start-mcp-server --context ide-assistant

# Mark as initialized
touch "$INIT_FLAG"

echo "✅ Claude Code environment initialized successfully"
