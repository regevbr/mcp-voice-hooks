#!/bin/bash

# Pre-Tool Hook - Checks for pending utterances before allowing tool execution
# Forces Claude to use dequeue_utterances tool if there are pending utterances

# Check has-pending-utterances endpoint
response=$(curl -s http://localhost:3000/api/has-pending-utterances 2>/dev/null)

if [ $? -ne 0 ]; then
    # Server not available, allow tool execution
    echo '{"decision": "approve"}'
    exit 0
fi

# Extract pending status
hasPending=$(echo "$response" | jq -r '.hasPending')
pendingCount=$(echo "$response" | jq -r '.pendingCount')

if [ "$hasPending" = "true" ]; then
    # There are pending utterances, block tool execution
    cat <<EOF
{
  "decision": "block",
  "reason": "There are $pendingCount pending voice utterances. Please use dequeue_utterances to process them first."
}
EOF
else
    # No pending utterances, allow tool execution
    echo '{"decision": "approve"}'
fi