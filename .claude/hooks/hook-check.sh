#!/bin/bash
response=$(curl -s -X POST localhost:3000/api/dequeue-utterances 2>/dev/null)
if [[ "$response" == *'"utterances":['* && "$response" != *'"utterances":[]'* ]]; then
    # Extract and format utterances as TSV
    echo "=== Voice Input Received ===" >&2
    echo "$response" | jq -r '.utterances[] | "\(.timestamp)\t\(.text)"' | while IFS=$'\t' read -r timestamp text; do
        # Format timestamp to be more readable
        formatted_time=$(echo "$timestamp" | sed 's/T/ /' | sed 's/\.[0-9]*Z$//')
        printf "%s\t%s\n" "${formatted_time}" "${text}" >&2
    done
    echo "=== End of Voice Input ===" >&2
    exit 2
else
    exit 0
fi
