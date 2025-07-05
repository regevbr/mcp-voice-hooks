#!/bin/bash

# Pre-Tool Hook - Validates tool execution using unified action validation

# Get port from environment variable or use default
PORT="${MCP_VOICE_HOOKS_PORT:-5111}"

# Call validate-action endpoint
response=$(curl -s -X POST http://localhost:${PORT}/api/validate-action \
  -H "Content-Type: application/json" \
  -d '{"action": "tool-use"}' 2>/dev/null)

if [ $? -ne 0 ]; then
    # Server not available, allow tool execution
    echo '{"decision": "approve"}'
    exit 0
fi

# Extract validation result
allowed=$(echo "$response" | jq -r '.allowed')

if [ "$allowed" = "true" ]; then
    echo '{"decision": "approve"}'
else
    # Pass through the server's reason directly
    reason=$(echo "$response" | jq -r '.reason // "Action not allowed"')
    echo "{\"decision\": \"block\", \"reason\": \"$reason\"}"
fi