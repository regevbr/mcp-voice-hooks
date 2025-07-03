#!/bin/bash

# Stop Hook - Requires wait_for_utterance to be called
# This hook triggers when Claude stops working and asks if we should wait for voice input

cat <<EOF
{
  "decision": "approve",
  "reason": "Please use wait_for_utterance to check for voice input before stopping"
}
EOF