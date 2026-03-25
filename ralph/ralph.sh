#!/usr/bin/env bash
# ralph.sh — thin wrapper around ralph.py
#
# Usage:
#   ./ralph.sh <change-id> [-m <model>] [max_iterations]
#
# See ralph.py for full documentation and argument details.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec python3 "$SCRIPT_DIR/ralph.py" "$@"
