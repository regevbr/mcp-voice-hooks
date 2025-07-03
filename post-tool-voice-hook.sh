#!/bin/bash

# Check if voice responses are enabled (defaults to false)
VOICE_RESPONSES_ENABLED="${VOICE_RESPONSES_ENABLED:-false}"

if [ "$VOICE_RESPONSES_ENABLED" == "true" ]; then
    echo "Use the 'say' command to respond to the user's voice input before proceeding." >&2
    echo "Example: bash -c 'say -r 300 \"I understand your request. I'll start working on...\"'" >&2
    exit 2
fi
