#!/bin/bash

# Stop Hook - Intelligently decides whether to wait for voice input
# Checks if there have been any utterances since the last timeout

# Check should-wait endpoint
response=$(curl -s http://localhost:3000/api/should-wait 2>/dev/null)

if [ $? -ne 0 ]; then
    # Server not available, allow stop
    echo '{"decision": "approve"}'
    exit 0
fi

# Extract shouldWait boolean
shouldWait=$(echo "$response" | jq -r '.shouldWait')

if [ "$shouldWait" = "true" ]; then
    # There have been utterances since last timeout, block and ask to wait
    cat <<EOF
{
  "decision": "block",
  "reason": "Assistant tried to end its response. Stopping is not allowed without first checking for voice input. Assistant should now use wait_for_utterance to check for voice input"
}
EOF
else
    # No utterances since last timeout, allow stop
    echo '{"decision": "approve", "reason": "No utterances since last timeout"}'
fi