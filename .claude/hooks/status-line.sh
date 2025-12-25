#!/bin/bash
# Read JSON input from stdin
input=$(cat)

# Extract values using jq
MODEL_DISPLAY=$(echo "$input" | jq -r '.model.display_name')
CURRENT_DIR=$(echo "$input" | jq -r '.workspace.current_dir')
VERSION=$(echo "$input" | jq -r '.version')
SESSION_ID=$(echo "$input" | jq -r '.session_id')

TOTAL_INPUT=$(echo "$input" | jq -r '.context_window.total_input_tokens')
TOTAL_OUTPUT=$(echo "$input" | jq -r '.context_window.total_output_tokens')
CONTEXT_SIZE=$(echo "$input" | jq -r '.context_window.context_window_size')

TOTAL_TOKENS=$((TOTAL_INPUT + TOTAL_OUTPUT))
PERCENTAGE=$(echo "scale=1; $TOTAL_TOKENS * 100 / $CONTEXT_SIZE" | bc)

echo "(v$VERSION) [$MODEL_DISPLAY] 📁 ${CURRENT_DIR##*/} 🧠 Context: in=${TOTAL_INPUT} out=${TOTAL_OUTPUT} ${PERCENTAGE}% (${TOTAL_TOKENS}/${CONTEXT_SIZE}) [Session $SESSION_ID]"